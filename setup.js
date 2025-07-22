#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create Homebridge config from environment variables for cloud deployment
function createConfigFromEnv() {
  const apiKey = process.env.SENSIBO_API_KEY;
  const pollingInterval = parseInt(process.env.POLLING_INTERVAL) || 30;
  const debug = process.env.DEBUG === 'true';
  
  if (!apiKey) {
    console.error('SENSIBO_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const config = {
    bridge: {
      name: "Homebridge Sensibo",
      username: "CC:22:3D:E3:CE:30",
      port: 51826,
      pin: "031-45-154"
    },
    description: "Homebridge configuration for Sensibo devices (auto-generated)",
    platforms: [
      {
        platform: "SensiboCustom",
        name: "Sensibo Custom",
        apiKey: apiKey,
        pollingInterval: pollingInterval,
        debug: debug
      }
    ]
  };
  
  // Determine config directory
  const configDir = process.env.HOMEBRIDGE_CONFIG_PATH || 
                   path.join(process.env.HOME || os.homedir(), '.homebridge');
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Write config file
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`Configuration written to: ${configPath}`);
  console.log('Homebridge is ready to start!');
}

// Run setup if this script is executed directly
if (require.main === module) {
  createConfigFromEnv();
}

module.exports = { createConfigFromEnv };
