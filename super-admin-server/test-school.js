const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5OTM5Y2Q1ZThmOWUxZmZjZGI3N2Y4NyIsImlhdCI6MTc3MTI4MTY3MSwiZXhwIjoxNzcxMzY4MDcxfQ.iLq4ET8Lp5D5W5vBz-fjTdrOrqYh6OLfi0k4Cit-69E';

const data = JSON.stringify({
  name: 'Demo School',
  subdomain: 'demo-school',
  deploymentType: 'cloud'
});

const options = {
  hostname: 'localhost',
  port: 6000,
  path: '/api/schools',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
