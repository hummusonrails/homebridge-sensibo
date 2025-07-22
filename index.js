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
    this.foundAccessories = [];
    
    if (!this.apiKey) {
      this.log.error('API Key is required. Get yours from https://home.sensibo.com/me/api');
      return;
    }
  }
  
  accessories(callback) {
    this.log.info('Fetching Sensibo devices...');
    
    axios.get(`${this.baseURL}/users/me/pods`, {
      params: {
        apiKey: this.apiKey,
        fields: '*'
      },
      headers: {
        'Accept-Encoding': 'gzip'
      }
    })
    .then(response => {
      const devices = response.data.result;
      this.log.info(`Found ${devices.length} Sensibo device(s)`);
      
      devices.forEach(device => {
        this.log.info(`Creating accessory for: ${device.room.name} (${device.id})`);
        const accessory = new SensiboAccessory(this.log, device, this.apiKey, this.baseURL);
        this.foundAccessories.push(accessory);
      });
      
      callback(this.foundAccessories);
    })
    .catch(error => {
      this.log.error('Error fetching devices:', error.message);
      callback([]);
    });
  }
}

class SensiboAccessory {
  constructor(log, device, apiKey, baseURL) {
    this.log = log;
    this.device = device;
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.deviceId = device.id;
    this.name = device.room.name;
    
    // Required accessory properties
    this.displayName = this.name;
    this.UUID = this.deviceId;
    this.category = 20; // Thermostat category
    
    // Current state
    this.currentTemperature = 20;
    this.targetTemperature = 20;
    this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
    this.currentRelativeHumidity = 50;
    
    this.setupServices();
    this.updateDeviceState();
    
    // Poll for updates every 30 seconds
    setInterval(() => {
      this.updateDeviceState();
    }, 30000);
  }
  
  setupServices() {
    // Information Service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Sensibo')
      .setCharacteristic(Characteristic.Model, this.device.productModel || 'Sensibo Sky')
      .setCharacteristic(Characteristic.SerialNumber, this.deviceId)
      .setCharacteristic(Characteristic.FirmwareRevision, this.device.firmwareVersion || '1.0.0');
    
    // Thermostat Service
    this.thermostatService = new Service.Thermostat(this.name);
    
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetHeatingCoolingState.bind(this))
      .on('set', this.setTargetHeatingCoolingState.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));
    
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this))
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 1
      });
    
    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this));
    
    // Humidity Sensor Service
    this.humidityService = new Service.HumiditySensor(`${this.name} Humidity`);
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
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
              this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.COOL;
              this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
              break;
            case 'heat':
              this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
              this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
              break;
            case 'auto':
              this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
              if (this.currentTemperature < this.targetTemperature - 1) {
                this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
              } else if (this.currentTemperature > this.targetTemperature + 1) {
                this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.COOL;
              } else {
                this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
              }
              break;
            default:
              this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
              this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
          }
        } else {
          this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
          this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
        }
      }
      
      // Update characteristics
      this.thermostatService.updateCharacteristic(Characteristic.CurrentTemperature, this.currentTemperature);
      this.thermostatService.updateCharacteristic(Characteristic.TargetTemperature, this.targetTemperature);
      this.thermostatService.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, this.currentHeatingCoolingState);
      this.thermostatService.updateCharacteristic(Characteristic.TargetHeatingCoolingState, this.targetHeatingCoolingState);
      this.humidityService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, this.currentRelativeHumidity);
      
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
      if (this.targetHeatingCoolingState !== Characteristic.TargetHeatingCoolingState.OFF) {
        await this.sendACCommand(acState);
      }
      
      this.targetTemperature = value;
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  
  getTemperatureDisplayUnits(callback) {
    callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
  }
  
  getCurrentRelativeHumidity(callback) {
    callback(null, this.currentRelativeHumidity);
  }
  
  getServices() {
    return [this.informationService, this.thermostatService, this.humidityService];
  }
}
