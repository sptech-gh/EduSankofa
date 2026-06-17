const http = require('http');

const data = JSON.stringify({
  email: 'admin@schoolmgmt.com',
  password: 'Admin123!@#'
});

const options = {
  hostname: 'localhost',
  port: 6000,
  path: '/api/superadmin/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (chunk) => {
    console.log(`Body: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
