/**
 * Netlify Function: gettrees
 * Fetches trees from NParks ArcGIS REST API (no auth required).
 * Same data as Trees.sg — species, height, location.
 * Called by app at: GET /api/gettrees?bbox=lng1,lat1,lng2,lat2
 */
var https = require('https');

function httpsGet(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch(e) {
          reject(new Error('Invalid JSON from trees API'));
        }
      });
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  var headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headers, body: '' };
  }

  var bbox = (event.queryStringParameters || {}).bbox;
  if (!bbox) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing bbox' }) };
  }

  // Parse bbox: lng1,lat1,lng2,lat2
  var parts = bbox.split(',');
  if (parts.length !== 4) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid bbox format' }) };
  }

  var xmin = parseFloat(parts[0]);
  var ymin = parseFloat(parts[1]);
  var xmax = parseFloat(parts[2]);
  var ymax = parseFloat(parts[3]);

  // NParks ArcGIS REST API — same source as Trees.sg, no auth needed
  var geometry = JSON.stringify({
    xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax,
    spatialReference: { wkid: 4326 }
  });

  var url = 'https://imaven.nparks.gov.sg/arcgis/rest/services/maven/PTMap/FeatureServer/2/query' +
    '?returnGeometry=true' +
    '&where=1%3D1' +
    '&outSr=4326' +
    '&outFields=*' +
    '&inSr=4326' +
    '&geometry=' + encodeURIComponent(geometry) +
    '&geometryType=esriGeometryEnvelope' +
    '&spatialRel=esriSpatialRelIntersects' +
    '&geometryPrecision=6' +
    '&resultRecordCount=2000' +
    '&f=geojson';

  try {
    var result = await httpsGet(url);

    if (result.status !== 200) {
      throw new Error('Trees API returned HTTP ' + result.status);
    }

    // Return the GeoJSON features directly
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        features: result.data.features || [],
        count: (result.data.features || []).length
      })
    };

  } catch(e) {
    return {
      statusCode: 502,
      headers: headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
