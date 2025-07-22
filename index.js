require('dotenv').config();
const axios = require('axios');

let Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerPlatform('homebridge-sensibo-custom', 'SensiboCustom', SensiboPlatform);
};

class SensiboPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    
    this.apiKey = config.apiKey;
    this.baseURL = 'https://home.sensibo.com/api/v2';
    this.accessories = [];
    this.pollingInterval = config.pollingInterval || 300000; // Default 5 minutes
    this.debug = config.debug || false;
    
    if (!this.apiKey) {
      this.log.error('API Key is required. Get yours from https://home.sensibo.com/me/api');
      return;
    }
    
    if (api) {
      this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
  }
  
  async didFinishLaunching() {
    this.log.info('Sensibo platform finished launching, discovering devices...');
    await this.discoverDevices();
    this.startPolling();
  }
  
  async discoverDevices() {
    try {
      this.log.info('Fetching Sensibo devices...');
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
        this.log.info(`Creating accessory for: ${device.room.name} (${device.id})`);
        const uuid = this.api.hap.uuid.generate(device.id);
        const accessory = new this.api.platformAccessory(device.room.name, uuid);
        accessory.context.device = device;
        
        new SensiboAccessory(this, accessory, device);
        this.api.registerPlatformAccessories('homebridge-sensibo-custom', 'SensiboCustom', [accessory]);
        this.accessories.push(accessory);
      });
    } catch (error) {
      this.log.error('Error discovering devices:', error.message);
    }
  }
  
  startPolling() {
    this.log.info(`Starting polling every ${this.pollingInterval}ms`);
    
    // Only start polling if we have accessories
    if (this.accessories.length === 0) {
      this.log.warn('No accessories found, skipping polling setup');
      return;
    }
    
    // Single polling timer for all devices
    this.pollingTimer = setInterval(() => {
      this.updateAllDevices();
    }, this.pollingInterval);
    
    // Initial update after 10 seconds
    setTimeout(() => this.updateAllDevices(), 10000);
  }
  
  async updateAllDevices() {
    if (this.isUpdating) {
      return; // Skip silently if update in progress
    }
    
    this.isUpdating = true;
    
    try {
      this.log.info('Updating all Sensibo devices...');
      
      // Update devices sequentially with delay to avoid rate limiting
      for (let i = 0; i < this.accessories.length; i++) {
        const accessory = this.accessories[i];
        if (accessory.sensiboAccessory) {
          await accessory.sensiboAccessory.updateDeviceState();
          
          // Add delay between device updates to respect rate limits
          if (i < this.accessories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      this.log.info('Device update completed');
    } catch (error) {
      this.log.error('Error during polling update:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }
  
  configureAccessory(accessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }
}

class SensiboAccessory {
  constructor(platform, accessory, device) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = device;
    this.log = platform.log;
    this.apiKey = platform.apiKey;
    this.baseURL = platform.baseURL;
    this.deviceId = device.id;
    this.name = device.room.name;
    
    // Store reference for polling
    this.accessory.sensiboAccessory = this;
    
    // Current state with HomeKit validation
    this.currentTemperature = this.validateTemperature(device.measurements?.temperature, 20);
    this.targetTemperature = this.validateTargetTemperature(device.acState?.targetTemperature, 20);
    this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
    this.targetHeatingCoolingState = this.mapACModeToHomeKit(device.acState?.mode || 'off');
    this.currentRelativeHumidity = Math.max(0, Math.min(100, device.measurements?.humidity || 50));
    
    this.setupServices();
    this.updateDeviceState();
  }
  
  setupServices() {
    // Information Service
    this.informationService = this.accessory.getService(Service.AccessoryInformation) ||
      this.accessory.addService(Service.AccessoryInformation);
    
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Sensibo')
      .setCharacteristic(Characteristic.Model, this.device.productModel || 'Sensibo Sky')
      .setCharacteristic(Characteristic.SerialNumber, this.deviceId)
      .setCharacteristic(Characteristic.FirmwareRevision, this.device.firmwareVersion || '1.0.0');
    
    // Thermostat Service
    this.thermostatService = this.accessory.getService(Service.Thermostat) ||
      this.accessory.addService(Service.Thermostat, this.name);
    
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 1
      });
    
    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));
    
    // Humidity Sensor Service
    this.humidityService = this.accessory.getService(Service.HumiditySensor) ||
      this.accessory.addService(Service.HumiditySensor, `${this.name} Humidity`);
    
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));
  }
  
  async updateDeviceState() {
    try {
      if (this.platform.debug) this.log.info(`Updating device state for ${this.name}`);
      
      // Get current measurements
      const measurementsResponse = await axios.get(`${this.baseURL}/pods/${this.deviceId}/measurements`, {
        params: { apiKey: this.apiKey },
        headers: { 'Accept-Encoding': 'gzip' }
      });
      
      const measurements = measurementsResponse.data.result[0];
      if (measurements) {
        const newTemp = this.validateTemperature(measurements.temperature, 20);
        const newHumidity = Math.max(0, Math.min(100, measurements.humidity || 50));
        
        if (Math.abs(this.currentTemperature - newTemp) > 0.1) {
          this.currentTemperature = newTemp;
          this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this.currentTemperature);
          if (this.platform.debug) this.log.info(`${this.name}: Temperature updated to ${this.currentTemperature}°C`);
        }
        
        if (Math.abs(this.currentRelativeHumidity - newHumidity) > 1) {
          this.currentRelativeHumidity = newHumidity;
          this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(this.currentRelativeHumidity);
          if (this.platform.debug) this.log.info(`${this.name}: Humidity updated to ${this.currentRelativeHumidity}%`);
        }
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
        const newTargetTemp = this.validateTargetTemperature(acState.targetTemperature, 20);
        if (this.targetTemperature !== newTargetTemp) {
          this.targetTemperature = newTargetTemp;
          this.thermostatService.getCharacteristic(Characteristic.TargetTemperature)
            .updateValue(this.targetTemperature);
          if (this.platform.debug) this.log.info(`${this.name}: Target temperature updated to ${this.targetTemperature}°C`);
        }
        
        let newCurrentState, newTargetState;
        
        if (acState.on) {
          switch (acState.mode) {
            case 'cool':
              newCurrentState = Characteristic.CurrentHeatingCoolingState.COOL;
              newTargetState = Characteristic.TargetHeatingCoolingState.COOL;
              break;
            case 'heat':
              newCurrentState = Characteristic.CurrentHeatingCoolingState.HEAT;
              newTargetState = Characteristic.TargetHeatingCoolingState.HEAT;
              break;
            case 'auto':
              newTargetState = Characteristic.TargetHeatingCoolingState.AUTO;
              if (this.currentTemperature < this.targetTemperature - 1) {
                newCurrentState = Characteristic.CurrentHeatingCoolingState.HEAT;
              } else if (this.currentTemperature > this.targetTemperature + 1) {
                newCurrentState = Characteristic.CurrentHeatingCoolingState.COOL;
              } else {
                newCurrentState = Characteristic.CurrentHeatingCoolingState.OFF;
              }
              break;
            default:
              newCurrentState = Characteristic.CurrentHeatingCoolingState.OFF;
              newTargetState = Characteristic.TargetHeatingCoolingState.OFF;
          }
        } else {
          newCurrentState = Characteristic.CurrentHeatingCoolingState.OFF;
          newTargetState = Characteristic.TargetHeatingCoolingState.OFF;
        }
        
        // Update characteristics if values changed
        if (this.currentHeatingCoolingState !== newCurrentState) {
          this.currentHeatingCoolingState = newCurrentState;
          this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(this.currentHeatingCoolingState);
          if (this.platform.debug) this.log.info(`${this.name}: Current heating/cooling state updated`);
        }
        
        if (this.targetHeatingCoolingState !== newTargetState) {
          this.targetHeatingCoolingState = newTargetState;
          this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(this.targetHeatingCoolingState);
          if (this.platform.debug) this.log.info(`${this.name}: Target heating/cooling state updated`);
        }
      }
    } catch (error) {
      this.log.error(`Error updating device state for ${this.name}:`, error.message);
    }
  }
  
  mapACModeToHomeKit(mode) {
    switch (mode) {
      case 'cool': return Characteristic.TargetHeatingCoolingState.COOL;
      case 'heat': return Characteristic.TargetHeatingCoolingState.HEAT;
      case 'auto': return Characteristic.TargetHeatingCoolingState.AUTO;
      default: return Characteristic.TargetHeatingCoolingState.OFF;
    }
  }
  
  validateTemperature(temp, defaultValue = 20) {
    // Current temperature can be any reasonable value
    if (temp === null || temp === undefined || isNaN(temp)) {
      return defaultValue;
    }
    // Clamp to reasonable range for current temperature
    return Math.max(-40, Math.min(100, temp));
  }
  
  validateTargetTemperature(temp, defaultValue = 20) {
    // Target temperature must be within HomeKit's range (16-30°C)
    if (temp === null || temp === undefined || isNaN(temp)) {
      return defaultValue;
    }
    // Clamp to HomeKit's acceptable range
    return Math.max(16, Math.min(30, temp));
  }
  
  // Characteristic handlers
  getCurrentHeatingCoolingState() {
    this.log.info(`${this.name}: getCurrentHeatingCoolingState called, returning ${this.currentHeatingCoolingState}`);
    return this.currentHeatingCoolingState;
  }
  
  getTargetHeatingCoolingState() {
    this.log.info(`${this.name}: getTargetHeatingCoolingState called, returning ${this.targetHeatingCoolingState}`);
    return this.targetHeatingCoolingState;
  }
  
  async setTargetHeatingCoolingState(value) {
    try {
      let acState = {};
      
      switch (value) {
        case Characteristic.TargetHeatingCoolingState.OFF:
          acState.on = false;
          break;
        case Characteristic.TargetHeatingCoolingState.HEAT:
          acState.on = true;
          acState.mode = 'heat';
          acState.targetTemperature = this.targetTemperature;
          break;
        case Characteristic.TargetHeatingCoolingState.COOL:
          acState.on = true;
          acState.mode = 'cool';
          acState.targetTemperature = this.targetTemperature;
          break;
        case Characteristic.TargetHeatingCoolingState.AUTO:
          acState.on = true;
          acState.mode = 'auto';
          acState.targetTemperature = this.targetTemperature;
          break;
      }
      
      await this.sendACCommand(acState);
      this.targetHeatingCoolingState = value;
      
      if (this.platform.debug) {
        this.log.info(`${this.name}: Set heating/cooling state to ${value}`);
      }
    } catch (error) {
      this.log.error(`Error setting heating/cooling state for ${this.name}:`, error.message);
      throw error;
    }
  }
  
  getCurrentTemperature() {
    this.log.info(`${this.name}: getCurrentTemperature called, returning ${this.currentTemperature}°C`);
    return this.currentTemperature;
  }
  
  getTargetTemperature() {
    this.log.info(`${this.name}: getTargetTemperature called, returning ${this.targetTemperature}°C`);
    return this.targetTemperature;
  }
  
  async setTargetTemperature(value) {
    try {
      const acState = {
        on: true,
        targetTemperature: value
      };
      
      await this.sendACCommand(acState);
      this.targetTemperature = value;
      
      if (this.platform.debug) {
        this.log.info(`${this.name}: Set target temperature to ${value}°C`);
      }
    } catch (error) {
      this.log.error(`Error setting target temperature for ${this.name}:`, error.message);
      throw error;
    }
  }
  
  getTemperatureDisplayUnits() {
    return Characteristic.TemperatureDisplayUnits.CELSIUS;
  }
  
  getCurrentRelativeHumidity() {
    this.log.info(`${this.name}: getCurrentRelativeHumidity called, returning ${this.currentRelativeHumidity}%`);
    return this.currentRelativeHumidity;
  }
  
  async sendACCommand(acState) {
    try {
      const response = await axios.post(`${this.baseURL}/pods/${this.deviceId}/acStates`, {
        acState: acState
      }, {
        params: { apiKey: this.apiKey },
        headers: {
          'Accept-Encoding': 'gzip',
          'Content-Type': 'application/json'
        }
      });
      
      if (this.platform.debug) {
        this.log.info(`${this.name}: AC command sent successfully`);
      }
      
      return response.data;
    } catch (error) {
      this.log.error(`Error sending AC command for ${this.name}:`, error.message);
      throw error;
    }
  }
  
  getServices() {
    return [this.informationService, this.thermostatService, this.humidityService];
  }
}
