/**
 * Netlify Function: gettrees
 * Proxies OneMap Themes API (trees) to avoid CORS.
 * Called by app at: GET /api/gettrees?bbox=lng1,lat1,lng2,lat2
 * Reads OM_EMAIL + OM_PASSWORD from env vars to get token,
 * then calls OneMap Themes API server-to-server.
 */
var https = require('https');

function httpsGet(url, headers) {
  return new Promise(function(resolve, reject) {
    https.get(url, {headers: headers || {}}, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          resolve({status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString())});
        } catch(e) {
          reject(new Error('Invalid JSON from OneMap'));
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, body) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify(body);
    var req = https.request(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)}
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          resolve({status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString())});
        } catch(e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Simple in-memory token cache (lasts for function warm period)
var cachedToken = null;
var cachedExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < cachedExpiry - 60000) return cachedToken;
  var r = await httpsPost('https://www.onemap.gov.sg/api/auth/post/getToken', {
    email: process.env.OM_EMAIL,
    password: process.env.OM_PASSWORD
  });
  if (!r.data.access_token) throw new Error('Could not get OneMap token');
  cachedToken = r.data.access_token;
  cachedExpiry = r.data.expiry_timestamp ? r.data.expiry_timestamp * 1000 : Date.now() + 3*24*3600*1000;
  return cachedToken;
}

exports.handler = async function(event) {
  var headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') return {statusCode: 200, headers: headers, body: ''};

  var bbox = (event.queryStringParameters || {}).bbox;
  if (!bbox) return {statusCode: 400, headers: headers, body: JSON.stringify({error: 'Missing bbox parameter'})};

  try {
    var token = await getToken();
    var url = 'https://www.onemap.gov.sg/api/public/themes/search' +
      '?queryName=trees&returnGeom=Y&getAddrDetails=N&bbox=' + bbox;
    var r = await httpsGet(url, {'Authorization': token});
    return {statusCode: r.status, headers: headers, body: JSON.stringify(r.data)};
  } catch(e) {
    return {statusCode: 502, headers: headers, body: JSON.stringify({error: e.message})};
  }
};
