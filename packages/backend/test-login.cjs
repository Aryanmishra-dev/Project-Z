#!/usr/bin/env node

const http = require('http');

const credentials = {
  email: 'demo@test.com',
  password: 'Demo123456!'
};

const data = JSON.stringify(credentials);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 5000
};

console.log('\n🔐 Testing demo login...\n');

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (response.success) {
        console.log('✅ Login successful!\n');
        console.log('📋 Demo Credentials:');
        console.log('   Email:    demo@test.com');
        console.log('   Password: Demo123456!\n');
        console.log('🌐 Application:');
        console.log('   Frontend: http://localhost:5173');
        console.log('   Login:    http://localhost:5173/login\n');
      } else {
        console.log('❌ Login failed:', response.error?.message || 'Unknown error\n');
      }
    } catch (e) {
      console.log('Response:', body, '\n');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message, '\n');
});

req.on('timeout', () => {
  console.error('❌ Request timed out\n');
  req.destroy();
});

req.write(data);
req.end();
