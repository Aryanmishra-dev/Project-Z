#!/usr/bin/env node

const http = require('http');

const demoUser = {
  email: 'demo@test.com',
  password: 'Demo123456!',
  fullName: 'Demo User'
};

const data = JSON.stringify(demoUser);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 5000
};

console.log('Creating demo user...');
console.log('Email:', demoUser.email);
console.log('Password:', demoUser.password);

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse status:', res.statusCode);
    try {
      const response = JSON.parse(body);
      if (response.success) {
        console.log('\n✅ Demo user created successfully!');
        console.log('\n📋 Login credentials:');
        console.log('   Email:', demoUser.email);
        console.log('   Password:', demoUser.password);
        console.log('\n🔗 Login at: http://localhost:5173/login');
      } else {
        console.log('\n❌ Error:', response.error?.message || 'Unknown error');
        if (response.error?.code === 'USER_EXISTS') {
          console.log('\n✅ Demo user already exists!');
          console.log('\n📋 Login credentials:');
          console.log('   Email:', demoUser.email);
          console.log('   Password:', demoUser.password);
          console.log('\n🔗 Login at: http://localhost:5173/login');
        }
      }
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Error:', error.message);
  console.log('\n⚠️  Make sure the backend server is running on port 3000');
  process.exit(1);
});

req.on('timeout', () => {
  console.error('\n❌ Request timed out');
  console.log('\n⚠️  Backend server might be stuck');
  req.destroy();
  process.exit(1);
});

req.write(data);
req.end();
