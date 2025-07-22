# Homebridge Sensibo Custom Plugin

A custom Homebridge plugin for controlling Sensibo smart air conditioner devices through Apple HomeKit.

## Features

- **Full HomeKit Integration**: Control your Sensibo devices using Siri, Apple Home app, and other HomeKit-compatible apps
- **Multiple Device Support**: Automatically discovers and manages all Sensibo devices in your account
- **Temperature Control**: Set target temperature and view current temperature
- **Humidity Monitoring**: View current humidity levels from your Sensibo sensors
- **AC Mode Control**: Switch between heating, cooling, auto, and off modes
- **Real-time Updates**: Polls device status every 30 seconds for up-to-date information
- **Cloud Deployment Ready**: Designed to run on cloud services like Render

## Installation

### Prerequisites

- Node.js 18.15.0 or higher
- Homebridge 1.3.0 or higher
- Sensibo API key (get yours from [https://home.sensibo.com/me/api](https://home.sensibo.com/me/api))

### Local Installation

1. Install Homebridge globally:
```bash
npm install -g homebridge
```

2. Clone this repository:
```bash
git clone <your-repo-url>
cd homebridge-sensibo-custom
```

3. Install dependencies:
```bash
npm install
```

4. Link the plugin for development:
```bash
npm link
```

### Configuration

1. Copy the example configuration:
```bash
cp config.json.example ~/.homebridge/config.json
```

2. Edit the configuration file and add your Sensibo API key:
```json
{
  "platforms": [
    {
      "platform": "SensiboCustom",
      "name": "Sensibo Custom",
      "apiKey": "YOUR_SENSIBO_API_KEY_HERE",
      "pollingInterval": 30,
      "debug": false
    }
  ]
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `platform` | string | `"SensiboCustom"` | Platform identifier (required) |
| `name` | string | `"Sensibo Custom"` | Platform name |
| `apiKey` | string | - | Your Sensibo API key (required) |
| `pollingInterval` | number | `30` | How often to check for updates (seconds) |
| `debug` | boolean | `false` | Enable debug logging |

## Usage

### Running Locally

Start Homebridge in debug mode:
```bash
homebridge -D
```

Or use the npm script:
```bash
npm start
```

### Adding to HomeKit

1. Open the Apple Home app on your iOS device
2. Tap the "+" button and select "Add Accessory"
3. Scan the QR code displayed in the Homebridge logs
4. Your Sensibo devices will appear as separate accessories

### Voice Control Examples

- "Hey Siri, set the living room temperature to 22 degrees"
- "Hey Siri, turn on the bedroom air conditioner"
- "Hey Siri, what's the temperature in the office?"
- "Hey Siri, turn off all air conditioners"

## Cloud Deployment

This plugin is designed to run on cloud services like Render, Railway, or Heroku.

### Render Deployment

1. Fork this repository to your GitHub account
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `homebridge -I`
   - **Environment Variables**:
     - `SENSIBO_API_KEY`: Your Sensibo API key
     - `NODE_ENV`: `production`

### Environment Variables

For cloud deployment, you can use environment variables instead of a config file:

- `SENSIBO_API_KEY`: Your Sensibo API key
- `POLLING_INTERVAL`: Polling interval in seconds (optional, default: 30)
- `DEBUG`: Set to `true` to enable debug logging (optional)

## Supported Devices

- Sensibo Sky
- Sensibo Air
- Sensibo Air Pro
- Any Sensibo device that supports the v2 API

## Supported HomeKit Services

- **Thermostat**: Temperature control and AC mode switching
- **Humidity Sensor**: Current humidity readings
- **Accessory Information**: Device details and firmware version

## Troubleshooting

### Common Issues

1. **"API Key is required" error**
   - Make sure you've added your API key to the configuration
   - Verify the API key is correct at [https://home.sensibo.com/me/api](https://home.sensibo.com/me/api)

2. **Devices not appearing in HomeKit**
   - Check the Homebridge logs for errors
   - Ensure your Sensibo devices are online and connected to WiFi
   - Try restarting Homebridge

3. **Commands not working**
   - Verify your API key has the necessary permissions
   - Check if the Sensibo app can control the devices
   - Enable debug logging to see detailed API responses

### Debug Logging

Enable debug logging in your configuration:
```json
{
  "platforms": [
    {
      "platform": "SensiboCustom",
      "debug": true
    }
  ]
}
```

Or set the environment variable:
```bash
export DEBUG=true
```

## API Rate Limits

The Sensibo API has rate limits. This plugin:
- Uses gzip compression to increase rate limits
- Polls devices every 30 seconds by default (configurable)
- Batches API calls when possible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

This means:
- ✅ You can use, modify, and distribute this software
- ✅ You must provide source code for any modifications
- ⚠️ If you run this software on a server/network service, you must make the source code available to users
- ✅ Any derivative works must also be licensed under AGPL-3.0

## Support

- Create an issue on GitHub for bugs or feature requests
- Check the Homebridge community forums for general help
- Refer to the Sensibo API documentation for API-related questions
