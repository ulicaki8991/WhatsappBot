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
  "qrCodeAvailable": false
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

If the application fails to connect:

1. Use the `/force-reconnect` endpoint to clear authentication data and restart
2. Check the logs for error messages
3. If running on Render.com, make sure you're using at least the "Standard" plan, not the free tier
4. Ensure the authentication data is being saved to a persistent disk

## Environment Variables

- `PORT`: The port the server will run on (default: 3000)
- `NODE_ENV`: Set to "production" when deploying to Render.com

## Usage Example with cURL

```bash
curl -X POST https://your-render-url.onrender.com/send-message \
  -H "Content-Type: application/json" \
  -d '{"number": "1234567890", "message": "Hello from WhatsApp Connector!"}'
``` 