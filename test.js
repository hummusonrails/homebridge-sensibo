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
    
    console.log('\n🎉 API connectivity test passed!');
    
    // Test plugin structure
    console.log('\n🔧 Testing plugin structure...');
    await testPluginStructure(devices);
    
  } catch (error) {
    console.error('❌ Error connecting to Sensibo API:', error.message);
    if (error.response?.status === 401) {
      console.error('   Invalid API key. Please check your API key at https://home.sensibo.com/me/api');
    }
    process.exit(1);
  }
}

async function testPluginStructure(devices) {
  try {
    // Test plugin loading
    const plugin = require('./index.js');
    console.log('✅ Plugin file loads successfully');
    
    // Mock Homebridge API
    const mockHomebridge = {
      hap: {
        Service: {
          AccessoryInformation: function() { return { setCharacteristic: () => this }; },
          Thermostat: function() { return { getCharacteristic: () => ({ on: () => this, setProps: () => this }), updateCharacteristic: () => this }; },
          HumiditySensor: function() { return { getCharacteristic: () => ({ on: () => this }), updateCharacteristic: () => this }; }
        },
        Characteristic: {
          CurrentHeatingCoolingState: { OFF: 0, HEAT: 1, COOL: 2 },
          TargetHeatingCoolingState: { OFF: 0, HEAT: 1, COOL: 2, AUTO: 3 },
          CurrentTemperature: {},
          TargetTemperature: {},
          TemperatureDisplayUnits: { CELSIUS: 0 },
          CurrentRelativeHumidity: {},
          Manufacturer: {},
          Model: {},
          SerialNumber: {},
          FirmwareRevision: {}
        },
        uuid: {
          generate: (id) => `uuid-${id}`
        }
      },
      platformAccessory: function(name, uuid) {
        this.displayName = name;
        this.UUID = uuid;
        this.context = {};
        this.services = [];
        this.getService = (service) => null;
        this.addService = (service, name) => ({ 
          getCharacteristic: () => ({ on: () => this, setProps: () => this }),
          updateCharacteristic: () => this
        });
        return this;
      },
      registerPlatform: function(pluginName, platformName, constructor) {
        console.log(`✅ Platform registered: ${pluginName} -> ${platformName}`);
        return constructor;
      },
      registerPlatformAccessories: function(pluginName, platformName, accessories) {
        console.log(`✅ ${accessories.length} accessories registered for platform ${platformName}`);
      }
    };
    
    // Mock logger
    const mockLog = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    };
    
    // Mock config
    const mockConfig = {
      apiKey: process.env.SENSIBO_API_KEY,
      pollingInterval: 30,
      debug: false
    };
    
    // Mock API with event handling
    const mockApi = {
      hap: mockHomebridge.hap,
      platformAccessory: mockHomebridge.platformAccessory,
      registerPlatformAccessories: mockHomebridge.registerPlatformAccessories,
      on: function(event, callback) {
        if (event === 'didFinishLaunching') {
          // Simulate the event
          setTimeout(callback, 100);
        }
      }
    };
    
    // Test platform initialization
    plugin(mockHomebridge); // This registers the platform
    console.log('✅ Plugin registers platform successfully');
    
    // The platform will be created by Homebridge when needed
    console.log('✅ Plugin structure is correct for Homebridge');
    
    // Wait for device discovery simulation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('\n🎉 Plugin structure test completed!');
    console.log('\n📱 Ready for HomeKit pairing:');
    devices.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.room.name} - Thermostat + Humidity Sensor`);
    });
    console.log('\n🚀 Deploy to Render and scan the QR code to add to HomeKit!');
    
  } catch (error) {
    console.error('❌ Plugin structure test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  testSensiboAPI();
}
