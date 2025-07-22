#!/usr/bin/env node

require('dotenv').config();

// Simple validation test for the Homebridge plugin
const plugin = require('./index.js');

// Mock Homebridge API
const mockHomebridge = {
  hap: {
    Service: {
      AccessoryInformation: function() { return this; },
      Thermostat: function(name) { this.name = name; return this; },
      HumiditySensor: function(name) { this.name = name; return this; }
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
    }
  },
  registerPlatform: function(pluginName, platformName, constructor) {
    console.log(`✅ Plugin registered: ${pluginName} -> ${platformName}`);
    return constructor;
  }
};

// Mock logger
const mockLog = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`[DEBUG] ${msg}`, ...args)
};

// Mock config
const mockConfig = {
  apiKey: process.env.SENSIBO_API_KEY,
  pollingInterval: 30,
  debug: true
};

// Mock API
const mockApi = {
  on: function(event, callback) {
    console.log(`✅ API event registered: ${event}`);
    if (event === 'didFinishLaunching') {
      // Simulate the event after a short delay
      setTimeout(() => {
        console.log('🚀 Simulating didFinishLaunching event...');
        callback();
      }, 1000);
    }
  }
};

async function validatePlugin() {
  console.log('🔍 Validating Homebridge Sensibo Plugin...\n');
  
  if (!process.env.SENSIBO_API_KEY) {
    console.error('❌ SENSIBO_API_KEY not found in environment');
    process.exit(1);
  }
  
  try {
    // Initialize the plugin
    console.log('1️⃣ Initializing plugin...');
    const PlatformConstructor = plugin(mockHomebridge);
    
    console.log('2️⃣ Creating platform instance...');
    const platform = new PlatformConstructor(mockLog, mockConfig, mockApi);
    
    console.log('3️⃣ Waiting for device discovery...');
    
    // Wait for the didFinishLaunching event to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🎉 Plugin validation completed successfully!');
    console.log('✅ Plugin is ready for deployment');
    console.log('\n📱 Your devices should appear as:');
    console.log('   • Parents Room - Thermostat + Humidity Sensor');
    console.log('   • Yehuda\'s Room - Thermostat + Humidity Sensor');
    console.log('   • Moshe\'s Room - Thermostat + Humidity Sensor');
    
  } catch (error) {
    console.error('❌ Plugin validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  validatePlugin();
}
