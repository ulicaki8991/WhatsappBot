# WhatsApp Bot Deployment Guide for Render.com

This guide will help you deploy the WhatsApp Bot to Render.com and troubleshoot common issues.

## Deployment Steps

### 1. Push Your Updated Code to GitHub

Make sure all the modifications we've made to the code are pushed to your GitHub repository.

### 2. Create a Web Service on Render

1. Log in to your Render dashboard
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure your service:
   - **Name**: `whatsapp-bot` (or your preferred name)
   - **Build Command**: Leave empty (Docker will handle this)
   - **Start Command**: Leave empty (CMD in Dockerfile will be used)
   - **Runtime**: Select "Docker"
   - **Instance Type**: Choose at least a Standard instance (512 MB RAM is too low, use at least 1 GB)

### 3. Add a Persistent Disk

1. In your service settings, go to "Disks"
2. Create a new disk:
   - **Name**: `whatsapp-auth`
   - **Mount Path**: `/app/auth_data`
   - **Size**: 1 GB

### 4. Set Environment Variables (Optional)

If needed, add environment variables in the "Environment" section:
- `NODE_ENV`: `production` (this should be set automatically)

### 5. Deploy the Service

Click "Create Web Service" and wait for the build and deployment to complete.

## Troubleshooting

### Issue: No QR Code in Logs

If you're not seeing a QR code in your logs after deployment, follow these steps:

1. **Check the Most Recent Logs**:
   - Go to your Render dashboard
   - Open your WhatsApp Bot service
   - Click on "Logs"
   - Look for entries between "WHATSAPP QR CODE START" and "WHATSAPP QR CODE END"

2. **Restart the Service**:
   - Sometimes a fresh restart is needed
   - In your Render dashboard, click "Manual Deploy" > "Deploy latest commit"

3. **Check for Chrome/Puppeteer Errors**:
   - Look for errors related to Chrome, Puppeteer, or browser initialization

### Issue: Connection or Authentication Problems

If the WhatsApp client is failing to connect or authenticate:

1. **Check the Health Endpoint**:
   - Visit `https://your-render-url.onrender.com/health`
   - This will show the current connection status and if authentication is needed

2. **Scan QR Code Again**:
   - Force a QR code regeneration by restarting the service
   - Scan the QR code immediately when it appears in the logs

3. **Increase Resource Allocation**:
   - WhatsApp-web.js with Puppeteer requires significant resources
   - Upgrade to a larger instance size if you see memory-related errors

### Issue: Service Crashes or Timeouts

If the service crashes or times out during startup:

1. **Check Memory Usage**:
   - Look at the instance metrics in Render dashboard
   - If memory usage is consistently high, upgrade to a larger instance

2. **Review Logs for Errors**:
   - Look for specific error messages in the logs
   - Common issues include:
     - Chrome/Puppeteer initialization failures
     - Memory exhaustion
     - Connection timeouts

## Tips for Success

1. **Always Use Headless Mode**: The updated code sets Puppeteer to always use headless mode, which is required for Render.

2. **Persistent Authentication**: The persistent disk ensures your WhatsApp session remains authenticated between deployments.

3. **Monitor Logs**: Regularly check the logs for issues or unexpected behaviors.

4. **QR Code Scanning**: When scanning the QR code, do it quickly as they expire after a short time.

5. **Adequate Resources**: Ensure your Render instance has enough memory (at least 1 GB, preferably 2 GB).

6. **Keep WhatsApp Updated**: Ensure your WhatsApp mobile app is updated to the latest version.

## Command-Line Debug Tips

If you need to debug issues, you can connect to the Render shell and run these commands:

```bash
# Check if Chrome is installed and working
google-chrome-stable --version

# Check available memory
free -m

# Check running processes
ps aux

# View application logs
tail -f /var/log/puppeteer.log
```

## WhatsApp Policies

Remember that WhatsApp has policies regarding automated messaging. Excessive messaging can get your number banned. Follow WhatsApp's Business Policy guidelines when using this bot. 