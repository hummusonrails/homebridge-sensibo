require('dotenv').config();
const axios = require('axios');

async function testPolling() {
  const apiKey = process.env.SENSIBO_API_KEY;
  const baseURL = 'https://home.sensibo.com/api/v2';
  
  try {
    console.log('Testing device polling...');
    const response = await axios.get(`${baseURL}/users/me/pods`, {
      params: { apiKey, fields: '*' },
      headers: { 'Accept-Encoding': 'gzip' }
    });
    
    const devices = response.data.result;
    console.log(`Found ${devices.length} devices:`);
    
    devices.forEach(device => {
      console.log(`- ${device.room.name}: ${device.measurements.temperature}°C, ${device.measurements.humidity}%`);
      console.log(`  AC State: ${device.acState.on ? 'ON' : 'OFF'}, Mode: ${device.acState.mode}, Target: ${device.acState.targetTemperature}°C`);
    });
  } catch (error) {
    console.error('Polling test failed:', error.message);
  }
}

testPolling();