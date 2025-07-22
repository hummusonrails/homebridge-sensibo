# Deployment Guide

This guide covers deploying your Homebridge Sensibo plugin to cloud services like Render.

## Prerequisites

1. **Sensibo API Key**: Get yours from [https://home.sensibo.com/me/api](https://home.sensibo.com/me/api)
2. **GitHub Repository**: Push your code to a GitHub repository
3. **Cloud Service Account**: Sign up for Render, Railway, or similar

## Render Deployment (Recommended)

### Step 1: Prepare Your Repository

1. Push this code to your GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit: Homebridge Sensibo Custom Plugin"
git remote add origin https://github.com/yourusername/homebridge-sensibo-custom.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `homebridge-sensibo`
   - **Environment**: `Node`
   - **Build Command**: `npm install && node setup.js`
   - **Start Command**: `homebridge -I -U ~/.homebridge`
   - **Instance Type**: `Starter` (free tier)

### Step 3: Set Environment Variables

Add these environment variables in Render:

| Variable | Value | Description |
|----------|--------|-------------|
| `SENSIBO_API_KEY` | `your_api_key_here` | Your Sensibo API key |
| `NODE_ENV` | `production` | Node environment |
| `POLLING_INTERVAL` | `30` | Update interval (optional) |
| `DEBUG` | `false` | Debug logging (optional) |

### Step 4: Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete
3. Your Homebridge instance will be running at the provided URL

## Alternative: Railway Deployment

1. Go to [railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Add the same environment variables as above
5. Railway will automatically detect and deploy your Node.js app

## Alternative: Docker Deployment

Build and run with Docker:

```bash
# Build the image
docker build -t homebridge-sensibo .

# Run the container
docker run -d \
  --name homebridge-sensibo \
  -p 51826:51826 \
  -e SENSIBO_API_KEY=your_api_key_here \
  -e NODE_ENV=production \
  --restart unless-stopped \
  homebridge-sensibo
```

## Connecting to HomeKit

Once deployed, your Homebridge instance will be running in the cloud. To connect it to HomeKit:

### Option 1: QR Code (Recommended)
1. Check your deployment logs for the HomeKit QR code
2. Open the Apple Home app on your iOS device
3. Tap "+" → "Add Accessory"
4. Scan the QR code from the logs

### Option 2: Manual Setup
1. Open the Apple Home app
2. Tap "+" → "Add Accessory" → "I Don't Have a Code or Cannot Scan"
3. Look for "Homebridge Sensibo" in the list
4. Enter the PIN from your deployment logs (default: 031-45-154)

## Monitoring and Logs

### Render
- View logs in the Render dashboard under your service
- Logs will show device discovery and HomeKit pairing information

### Railway
- Check the deployment logs in your Railway project dashboard

### Docker
- View logs: `docker logs homebridge-sensibo`
- Follow logs: `docker logs -f homebridge-sensibo`

## Troubleshooting

### Common Issues

1. **Service won't start**
   - Check that `SENSIBO_API_KEY` is set correctly
   - Verify your API key at https://home.sensibo.com/me/api

2. **Devices not appearing**
   - Check logs for API errors
   - Ensure your Sensibo devices are online
   - Verify API key permissions

3. **HomeKit pairing fails**
   - Make sure the service is running and accessible
   - Check firewall settings if using custom hosting
   - Try resetting HomeKit pairing in logs

### Debug Mode

Enable debug logging by setting `DEBUG=true` in your environment variables. This will provide detailed API request/response information.

## Updating Your Deployment

1. Make changes to your code locally
2. Test locally: `npm start`
3. Commit and push changes:
```bash
git add .
git commit -m "Update plugin"
git push
```
4. Your cloud service will automatically redeploy

## Security Notes

- Never commit your API key to version control
- Use environment variables for all sensitive data
- Consider using a dedicated Sensibo account for the plugin
- Regularly rotate your API keys

## Cost Considerations

- **Render Free Tier**: 750 hours/month (sufficient for 24/7 operation)
- **Railway**: $5/month for hobby plan
- **Docker hosting**: Varies by provider

The free tier of most services is sufficient for running Homebridge 24/7.

## Support

If you encounter issues:
1. Check the deployment logs first
2. Test your API key with the test script: `SENSIBO_API_KEY=your_key node test.js`
3. Review the Homebridge community forums
4. Create an issue on your GitHub repository
