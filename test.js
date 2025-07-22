#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

// Test script to verify Sensibo API connectivity
async function testSensiboAPI() {
  const apiKey = process.env.SENSIBO_API_KEY;
  
  if (!apiKey) {
    console.error('❌ SENSIBO_API_KEY environment variable is required');
    console.log('Get your API key from: https://home.sensibo.com/me/api');
    process.exit(1);
  }
  
  try {
    console.log('🔍 Testing Sensibo API connectivity...');
    
    const response = await axios.get('https://home.sensibo.com/api/v2/users/me/pods', {
      params: {
        apiKey: apiKey,
        fields: '*'
      },
      headers: {
        'Accept-Encoding': 'gzip'
      }
    });
    
    const devices = response.data.result;
    console.log(`✅ Successfully connected to Sensibo API`);
    console.log(`📱 Found ${devices.length} device(s):`);
    
    devices.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.room.name} (${device.id})`);
      console.log(`      Model: ${device.productModel || 'Unknown'}`);
      console.log(`      Status: ${device.connectionStatus?.isAlive ? 'Online' : 'Offline'}`);
    });
    
    if (devices.length === 0) {
      console.log('⚠️  No devices found. Make sure your Sensibo devices are set up and online.');
    }
    
    console.log('\n🎉 Plugin is ready to use!');
    
  } catch (error) {
    console.error('❌ Error connecting to Sensibo API:', error.message);
    if (error.response?.status === 401) {
      console.error('   Invalid API key. Please check your API key at https://home.sensibo.com/me/api');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testSensiboAPI();
}
