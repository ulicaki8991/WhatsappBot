# Simple WhatsApp Connector

A minimalist WhatsApp API connector that provides a single endpoint to send messages.

## Features

- Simple, single-purpose API
- Minimal dependencies
- Auto-reconnection on disconnection
- QR code authentication
- Single endpoint to send messages

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```

## Authentication

When you first start the application, you'll need to authenticate by scanning the QR code that appears in the console. After scanning, the authentication will be saved in the `auth_data` directory for future use.

## API Endpoints

### Send a Message

**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "number": "1234567890",
  "message": "Hello, this is a test message!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "message-id-from-whatsapp"
}
```

### Check Health

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "OK",
  "whatsappConnected": true,
  "uptime": 123.45,
  "environment": "production",
  "timestamp": "2023-05-01T12:00:00.000Z",
  "qrCodeAvailable": false,
  "initializationStatus": {
    "isInitializing": false,
    "currentRetry": 0,
    "maxRetries": 5
  },
  "memory": {
    "heapTotal": "80 MB",
    "heapUsed": "42 MB",
    "rss": "102 MB"
  }
}
```

### Force Reconnection

If the application gets stuck, you can force a reconnection:

**Endpoint:** `POST /force-reconnect`

**Response:**
```json
{
  "success": true,
  "message": "Reconnection process started. Check logs for QR code."
}
```

## Deploying to Render.com

This application is specially configured to work on Render.com:

1. **Create a new Web Service**:
   - Sign up for a Render.com account if you don't have one
   - Click "New" and select "Web Service"
   - Connect your GitHub repository

2. **Configure the service**:
   - **Environment**: Select "Docker"
   - **Name**: Choose a name (e.g., "whatsapp-connector")
   - **Branch**: Select your branch (e.g., "main")
   - **Plan**: Choose at least a "Standard" plan (not the free tier as it has memory limitations)

3. **Set up persistent storage**:
   - In your service settings, go to "Disks" 
   - Add a new disk:
     - Name: "whatsapp-auth"
     - Mount Path: "/app/auth_data"
     - Size: 1 GB (minimum)

4. **After deployment**:
   - Authenticate your WhatsApp account by accessing the QR code
   - The QR code will be printed in the Render logs
   - You can also access it at the path `/app/auth_data/latest-qr.txt` via the Render shell

### Using the render.yaml

Alternatively, if you're using the Blueprint feature:

1. Push your code with the `render.yaml` file to a GitHub repository
2. In Render.com, click "New" → "Blueprint"
3. Connect to your repository
4. Render will automatically set up the service with the correct configuration

## Accessing the QR Code on Render.com

When deploying to Render.com, you'll need to scan a QR code to authenticate:

1. After deploying, go to your service's "Logs" tab in the Render dashboard
2. Look for a section with "=== SCAN THIS QR CODE WITH YOUR WHATSAPP ===" 
3. Copy the QR code data (the text between the markers)
4. Use an online QR code generator (like https://www.the-qrcode-generator.com/) to generate a QR code from this text
5. Scan the generated QR code with your WhatsApp app

Alternatively, you can use the Shell to view the QR code:
1. Go to your service's "Shell" tab
2. Run: `cat auth_data/latest-qr.txt`
3. Copy this text and use an online QR code generator

## Troubleshooting

### Handling "Session closed" Errors

If you see errors like:
```
Failed to initialize WhatsApp client: Error: Protocol error (Network.setUserAgentOverride): Session closed. Most likely the page has been closed.
```

This typically means Chrome is crashing due to memory limitations. Here's how to fix it:

1. **Ensure you're using a Standard plan or higher** - Free tier on Render.com doesn't have enough memory for Chrome.

2. **Use the force reconnect endpoint** to clear everything and start fresh:
   ```
   curl -X POST https://your-render-url.onrender.com/force-reconnect
   ```

3. **Check if your service is out of memory**:
   - Go to the "Logs" tab in Render dashboard
   - Look for "Memory stats" output from the monitoring script
   - If you see values close to the limit, you may need to upgrade your plan

4. **Manual recovery**:
   - Go to the "Shell" tab in Render dashboard
   - Run: `pkill -9 chrome` to kill any stuck Chrome processes
   - Run: `rm -rf /app/auth_data/*` to clear authentication data
   - Restart the service from the Render dashboard

### Auto-Retry Logic

The application includes built-in retry logic that will attempt to reconnect up to 5 times with increasing delays. You can monitor this process through the `/health` endpoint which shows the current retry status.

### Memory Usage Optimization

This application is highly optimized for low memory environments:

- Chrome is configured with minimal resource usage flags
- The Node.js heap size is limited to prevent OOM errors
- A memory monitoring script runs in the background to track usage

If you still experience memory issues, consider:

1. Upgrading to a higher Render.com plan with more memory
2. Further reducing Chrome memory usage by editing the puppeteer configuration in `src/simple-whatsapp.js`

## Environment Variables

- `PORT`: The port the server will run on (default: 3000)
- `NODE_ENV`: Set to "production" when deploying to Render.com
- `NODE_OPTIONS`: Set to "--max_old_space_size=384" to limit Node.js memory usage

## Usage Example with cURL

```bash
curl -X POST https://your-render-url.onrender.com/send-message \
  -H "Content-Type: application/json" \
  -d '{"number": "1234567890", "message": "Hello from WhatsApp Connector!"}'
``` 