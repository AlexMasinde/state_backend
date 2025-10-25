#!/usr/bin/env node

/**
 * Simple test script to test login endpoint with debugging
 * Run this after starting the server to test the login process
 */

const axios = require('axios');

async function testLogin() {
  const baseURL = process.env.BASE_URL || 'http://localhost:5100';
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'password123';

  console.log('🧪 Testing login endpoint...');
  console.log(`📍 Base URL: ${baseURL}`);
  console.log(`📧 Test Email: ${testEmail}`);
  console.log(`🔐 Password Length: ${testPassword.length}`);

  try {
    const response = await axios.post(`${baseURL}/api/auth/signin`, {
      email: testEmail,
      password: testPassword
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Login successful!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`🎫 Access Token Length: ${response.data.access_token?.length || 'null'}`);
    console.log(`🍪 Cookies: ${response.headers['set-cookie']?.length || 0} cookies set`);

  } catch (error) {
    console.error('❌ Login failed!');
    console.error(`📊 Status: ${error.response?.status || 'No response'}`);
    console.error(`📝 Message: ${error.response?.data?.message || error.message}`);
    console.error(`📋 Data:`, error.response?.data || 'No data');
    
    if (error.code) {
      console.error(`🔍 Error Code: ${error.code}`);
    }
  }
}

// Run the test
testLogin().catch(console.error);
