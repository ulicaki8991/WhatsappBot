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
   - **Instance Type**: Choose at least a Standard instance (512 MB RAM is too low, use at least 2 GB RAM)

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

### Issue: Stuck at "Initializing WhatsApp client..."

If your deployment gets stuck at the initialization phase, follow these steps:

1. **Increase Instance Size First**:
   - This is the most common solution! WhatsApp-web.js requires significant memory
   - Go to your service settings in Render
   - Upgrade to at least a 2GB RAM instance (Standard Plus or higher)
   - Redeploy the service

2. **Force Delete Authentication Data**:
   - In Render dashboard, go to Shell
   - Run: `rm -rf /app/auth_data/*`
   - Then restart the service: Click "Manual Deploy" > "Deploy latest commit"

3. **Check Debug Logs**:
   - After deploying, check for detailed logs:
   - In Render dashboard, look for `/tmp/whatsapp-debug.log` in the logs tab
   - Or connect to the shell and run: `cat /tmp/whatsapp-debug.log`

4. **Look for Memory Issues**:
   - Connect to the shell and run: `free -m`
   - If available memory is consistently low (< 200MB), you need a larger instance
   - Check Chrome processes: `ps aux | grep chrome`

5. **Time the Initialization**:
   - Normal initialization can take up to 2-3 minutes
   - If it's still initializing after 5 minutes, there's likely a problem
   - Restart the service and watch the logs carefully

6. **Clear Browser Data**:
   - Connect to the shell
   - Run: `rm -rf /tmp/.org.chromium.Chromium*`
   - Then restart the service

7. **Check for QR Code in File**:
   - Connect to the shell and run: `cat /tmp/whatsapp-qr.txt`
   - If a QR code is present, scan it with your WhatsApp mobile app

### Issue: No QR Code in Logs

If you're not seeing a QR code in your logs after deployment, follow these steps:

1. **Check the Debug Log File**:
   - Connect to the shell
   - Run: `cat /tmp/whatsapp-debug.log`
   - Look for any error messages related to QR code generation

2. **Restart the Service**:
   - Sometimes a fresh restart is needed
   - In your Render dashboard, click "Manual Deploy" > "Deploy latest commit"

3. **Check for Chrome/Puppeteer Errors**:
   - Look for errors related to Chrome, Puppeteer, or browser initialization
   - Common errors include memory issues, timeouts, or browser launch failures

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

## Important Memory Requirements

WhatsApp-web.js is resource-intensive because:
1. It runs a full Chrome browser instance
2. It maintains a WebSocket connection to WhatsApp Web
3. It handles multiple event listeners and message processing

**Minimum recommended resources for Render.com:**
- 2GB RAM (Standard Plus plan or higher)
- 1 CPU core minimum

Using an instance with insufficient memory is the #1 cause of initialization issues.

## Tips for Success

1. **Always Use Headless Mode**: The updated code sets Puppeteer to always use headless mode, which is required for Render.

2. **Persistent Authentication**: The persistent disk ensures your WhatsApp session remains authenticated between deployments.

3. **Monitor Logs**: Regularly check the logs for issues or unexpected behaviors.

4. **QR Code Scanning**: When scanning the QR code, do it quickly as they expire after a short time.

5. **Adequate Resources**: Ensure your Render instance has enough memory (at least 2 GB).

6. **Keep WhatsApp Updated**: Ensure your WhatsApp mobile app is updated to the latest version.

## Command-Line Debug Tips

If you need to debug issues, you can connect to the Render shell and run these commands:

```bash
# Check if Chrome is installed and working
google-chrome-stable --version

# Check available memory
free -m

# Check running processes
ps aux | grep -E "node|chrome"

# View application logs
cat /var/log/app.log

# View debug logs
cat /tmp/whatsapp-debug.log

# View system monitor logs
cat /tmp/system_monitor.log

# Check for active QR code
cat /tmp/whatsapp-qr.txt

# Force restart Chrome processes
pkill -9 chrome
```

## WhatsApp Policies

Remember that WhatsApp has policies regarding automated messaging. Excessive messaging can get your number banned. Follow WhatsApp's Business Policy guidelines when using this bot. 