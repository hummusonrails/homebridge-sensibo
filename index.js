require('dotenv').config();
const axios = require('axios');

let Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerPlatform('homebridge-sensibo-custom', 'SensiboCustom', SensiboPlatform);
  
  return SensiboPlatform;
};

class SensiboPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    
    this.apiKey = config.apiKey;
    this.baseURL = 'https://home.sensibo.com/api/v2';
    this.accessories = [];
    
    if (!this.apiKey) {
      this.log.error('API Key is required. Get yours from https://home.sensibo.com/me/api');
      return;
    }
    
    if (api) {
      this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
  }
  
  async didFinishLaunching() {
    this.log.info('Sensibo Custom Platform finished launching');
    await this.discoverDevices();
  }
  
  async discoverDevices() {
    try {
      this.log.info('Discovering Sensibo devices...');
      
      const response = await axios.get(`${this.baseURL}/users/me/pods`, {
        params: {
          apiKey: this.apiKey,
          fields: '*'
        },
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });
      
      const devices = response.data.result;
      this.log.info(`Found ${devices.length} Sensibo device(s)`);
      
      devices.forEach(device => {
        this.log.info(`Adding device: ${device.room.name} (${device.id})`);
        
        // Create UUID for this accessory
        const uuid = this.api.hap.uuid.generate(device.id);
        
        // Check if accessory already exists
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
        
        if (existingAccessory) {
          this.log.info(`Restoring existing accessory: ${device.room.name}`);
          new SensiboAccessory(this, existingAccessory, device);
        } else {
          this.log.info(`Adding new accessory: ${device.room.name}`);
          const accessory = new this.api.platformAccessory(device.room.name, uuid);
          accessory.context.device = device;
          
          new SensiboAccessory(this, accessory, device);
          
          this.api.registerPlatformAccessories('homebridge-sensibo-custom', 'SensiboCustom', [accessory]);
        }
      });
      
    } catch (error) {
      this.log.error('Error discovering devices:', error.message);
    }
  }
  
  configureAccessory(accessory) {
    // This is called when cached accessories are loaded
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }
}

class SensiboAccessory {
  constructor(platform, accessory, device) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = device || accessory.context.device;
    this.log = platform.log;
    this.apiKey = platform.apiKey;
    this.baseURL = platform.baseURL;
    this.deviceId = this.device.id;
    this.name = this.device.room.name;
    
    // Set accessory information
    this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation)
      .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Sensibo')
      .setCharacteristic(this.platform.api.hap.Characteristic.Model, this.device.productModel || 'Sensibo Sky')
      .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, this.deviceId)
      .setCharacteristic(this.platform.api.hap.Characteristic.FirmwareRevision, this.device.firmwareVersion || '1.0.0');
    
    // Current state
    this.currentTemperature = 20;
    this.targetTemperature = 20;
    this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
    this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.OFF;
    this.currentRelativeHumidity = 50;
    
    this.setupServices();
    this.updateDeviceState();
    
    // Poll for updates every 30 seconds
    setInterval(() => {
      this.updateDeviceState();
    }, 30000);
  }
  
  setupServices() {
    // Get or create Thermostat Service
    this.thermostatService = this.accessory.getService(this.platform.api.hap.Service.Thermostat) ||
      this.accessory.addService(this.platform.api.hap.Service.Thermostat);
    
    this.thermostatService
      .getCharacteristic(this.platform.api.hap.Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(this.platform.api.hap.Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetHeatingCoolingState.bind(this))
      .on('set', this.setTargetHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));
    
    this.thermostatService
      .getCharacteristic(this.platform.api.hap.Characteristic.TargetTemperature)
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this))
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 1
      });
    
    this.thermostatService
      .getCharacteristic(this.platform.api.hap.Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this));
    
    // Get or create Humidity Sensor Service
    this.humidityService = this.accessory.getService(this.platform.api.hap.Service.HumiditySensor) ||
      this.accessory.addService(this.platform.api.hap.Service.HumiditySensor, `${this.name} Humidity`);
    
    this.humidityService
      .getCharacteristic(this.platform.api.hap.Characteristic.CurrentRelativeHumidity)
      .on('get', this.getCurrentRelativeHumidity.bind(this));
  }
  
  async updateDeviceState() {
    try {
      // Get current measurements
      const measurementsResponse = await axios.get(`${this.baseURL}/pods/${this.deviceId}/measurements`, {
        params: { apiKey: this.apiKey },
        headers: { 'Accept-Encoding': 'gzip' }
      });
      
      const measurements = measurementsResponse.data.result[0];
      if (measurements) {
        this.currentTemperature = measurements.temperature || 20;
        this.currentRelativeHumidity = measurements.humidity || 50;
      }
      
      // Get AC state
      const acStateResponse = await axios.get(`${this.baseURL}/pods/${this.deviceId}/acStates`, {
        params: { 
          apiKey: this.apiKey,
          limit: 1
        },
        headers: { 'Accept-Encoding': 'gzip' }
      });
      
      const acState = acStateResponse.data.result[0]?.acState;
      if (acState) {
        this.targetTemperature = acState.targetTemperature || 20;
        
        if (acState.on) {
          switch (acState.mode) {
            case 'cool':
              this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.COOL;
              this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.COOL;
              break;
            case 'heat':
              this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.HEAT;
              this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.HEAT;
              break;
            case 'auto':
              this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.AUTO;
              // Determine current state based on temperature difference
              if (this.currentTemperature < this.targetTemperature - 1) {
                this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.HEAT;
              } else if (this.currentTemperature > this.targetTemperature + 1) {
                this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.COOL;
              } else {
                this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
              }
              break;
            default:
              this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
              this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.OFF;
          }
        } else {
          this.currentHeatingCoolingState = this.platform.api.hap.Characteristic.CurrentHeatingCoolingState.OFF;
          this.targetHeatingCoolingState = this.platform.api.hap.Characteristic.TargetHeatingCoolingState.OFF;
        }
      }
      
      // Update characteristics
      this.thermostatService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature, this.currentTemperature);
      this.thermostatService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetTemperature, this.targetTemperature);
      this.thermostatService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentHeatingCoolingState, this.currentHeatingCoolingState);
      this.thermostatService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetHeatingCoolingState, this.targetHeatingCoolingState);
      this.humidityService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentRelativeHumidity, this.currentRelativeHumidity);
      
    } catch (error) {
      this.log.error(`Error updating device state for ${this.name}:`, error.message);
    }
  }
  
  async sendACCommand(acState) {
    try {
      await axios.post(`${this.baseURL}/pods/${this.deviceId}/acStates`, {
        acState: acState
      }, {
        params: { apiKey: this.apiKey },
        headers: { 
          'Accept-Encoding': 'gzip',
          'Content-Type': 'application/json'
        }
      });
      
      this.log.info(`Command sent to ${this.name}:`, acState);
    } catch (error) {
      this.log.error(`Error sending command to ${this.name}:`, error.message);
      throw error;
    }
  }
  
  // Characteristic Handlers
  getCurrentHeatingCoolingState(callback) {
    callback(null, this.currentHeatingCoolingState);
  }
  
  getTargetHeatingCoolingState(callback) {
    callback(null, this.targetHeatingCoolingState);
  }
  
  async setTargetHeatingCoolingState(value, callback) {
    try {
      let acState = {};
      
      switch (value) {
        case this.platform.api.hap.Characteristic.TargetHeatingCoolingState.OFF:
          acState.on = false;
          break;
        case this.platform.api.hap.Characteristic.TargetHeatingCoolingState.HEAT:
          acState.on = true;
          acState.mode = 'heat';
          acState.targetTemperature = this.targetTemperature;
          break;
        case this.platform.api.hap.Characteristic.TargetHeatingCoolingState.COOL:
          acState.on = true;
          acState.mode = 'cool';
          acState.targetTemperature = this.targetTemperature;
          break;
        case this.platform.api.hap.Characteristic.TargetHeatingCoolingState.AUTO:
          acState.on = true;
          acState.mode = 'auto';
          acState.targetTemperature = this.targetTemperature;
          break;
      }
      
      await this.sendACCommand(acState);
      this.targetHeatingCoolingState = value;
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  
  getCurrentTemperature(callback) {
    callback(null, this.currentTemperature);
  }
  
  getTargetTemperature(callback) {
    callback(null, this.targetTemperature);
  }
  
  async setTargetTemperature(value, callback) {
    try {
      const acState = {
        targetTemperature: value
      };
      
      // Only send command if AC is on
      if (this.targetHeatingCoolingState !== this.platform.api.hap.Characteristic.TargetHeatingCoolingState.OFF) {
        await this.sendACCommand(acState);
      }
      
      this.targetTemperature = value;
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  
  getTemperatureDisplayUnits(callback) {
    callback(null, this.platform.api.hap.Characteristic.TemperatureDisplayUnits.CELSIUS);
  }
  
  getCurrentRelativeHumidity(callback) {
    callback(null, this.currentRelativeHumidity);
  }
}
