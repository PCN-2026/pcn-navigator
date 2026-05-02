/**
 * Netlify Function: gettoken
 * Called by the app at GET /api/gettoken
 * Reads OM_EMAIL + OM_PASSWORD from Netlify environment variables.
 * Credentials are NEVER sent from the browser — zero exposure.
 * Set env vars in: Netlify → Site configuration → Environment variables
 */
var https = require('https');

function post(url, data) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(data);
    var req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch(e) {
          reject(new Error('Invalid JSON from OneMap'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
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

  // Read credentials from Netlify environment variables
  // These are NEVER visible to users
  var email    = process.env.OM_EMAIL;
  var password = process.env.OM_PASSWORD;

  if (!email || !password) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        error: 'Server not configured. Set OM_EMAIL and OM_PASSWORD in Netlify environment variables.'
      })
    };
  }

  try {
    var result = await post(
      'https://www.onemap.gov.sg/api/auth/post/getToken',
      { email: email, password: password }
    );

    // Pass OneMap response directly to browser
    // (contains access_token and expiry_timestamp)
    return {
      statusCode: result.status,
      headers: headers,
      body: JSON.stringify(result.data)
    };

  } catch (err) {
    return {
      statusCode: 502,
      headers: headers,
      body: JSON.stringify({ error: 'Could not reach OneMap: ' + err.message })
    };
  }
};
