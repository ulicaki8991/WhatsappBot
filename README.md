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

## Deploying to DigitalOcean

This application can be deployed to DigitalOcean in two ways - either with Docker or directly on the server.

### Option 1: Direct Installation (Recommended)

This approach runs the application directly on the server without Docker, which is simpler and more resource-efficient:

1. **Create a Droplet**:
   - Log in to your DigitalOcean account
   - Create a new Droplet using Ubuntu (20.04 or newer)
   - Choose a Standard plan with at least 1GB RAM
   - Add your SSH key

2. **Clone and Deploy**:
   ```bash
   # Connect to your droplet
   ssh root@your-droplet-ip
   
   # Clone the repository
   git clone https://github.com/yourusername/whatsapp-connector.git
   cd whatsapp-connector
   
   # Make the setup script executable
   chmod +x setup-direct.sh
   
   # Run the direct setup script
   ./setup-direct.sh
   ```

3. **Scan the QR Code**:
   - After setup, check the logs or QR code file:
     ```bash
     cat /opt/whatsapp-connector/auth_data/latest-qr.txt
     ```
   - Use an online QR code generator to create a scannable QR code
   - Scan with your WhatsApp app to authenticate

### Option 2: Docker Installation

If you prefer to use Docker for isolation and containerization:

1. **Create a Droplet** as described above

2. **Clone and Deploy**:
   ```bash
   # Connect to your droplet
   ssh root@your-droplet-ip
   
   # Clone the repository
   git clone https://github.com/yourusername/whatsapp-connector.git
   cd whatsapp-connector
   
   # Make the setup script executable
   chmod +x setup-digitalocean.sh
   
   # Run the Docker setup script
   ./setup-digitalocean.sh
   ```

3. **Scan the QR Code** as described above, but the file will be at: `/root/whatsapp-connector/auth_data/latest-qr.txt`

## Authentication

When you first start the application, you'll need to authenticate by scanning the QR code. After scanning, the authentication will be saved in the `auth_data` directory for future use.

### Accessing the QR Code on DigitalOcean

To authenticate your WhatsApp account on DigitalOcean:

1. **View the QR Code file**:
   For direct installation:
   ```bash
   cat /opt/whatsapp-connector/auth_data/latest-qr.txt
   ```
   
   For Docker installation:
   ```bash
   cat /root/whatsapp-connector/auth_data/latest-qr.txt
   ```

2. **Generate a scannable QR**:
   - Copy the text content from the file
   - Paste it into an online QR code generator (like https://www.the-qrcode-generator.com/)
   - Scan the resulting QR code with your WhatsApp app

3. **Verify Connection**:
   ```bash
   curl http://localhost:3000/health
   ```
   Check that `whatsappConnected` is `true`

## Managing the Service

### For Direct Installation

```bash
# Check service status
systemctl status whatsapp-connector

# Restart the service
systemctl restart whatsapp-connector

# View logs
journalctl -u whatsapp-connector -f

# Check application logs
cat /opt/whatsapp-connector/logs/whatsapp.log
```

### For Docker Installation

```bash
# Check docker container status
docker ps -a | grep whatsapp-connector

# Restart the container
docker restart whatsapp-connector

# View container logs
docker logs -f whatsapp-connector

# Check application logs
cat /root/whatsapp-connector/logs/whatsapp.log
```

## Troubleshooting

### Common Issues and Solutions

1. **"Session closed" errors**:
   - If you see errors about session being closed, it might indicate memory issues.
   - Solution: Restart the service with `systemctl restart whatsapp-connector` or `docker restart whatsapp-connector` depending on your installation method

2. **Unable to authenticate**:
   - Try forcing a reconnection:
     ```bash
     curl -X POST http://localhost:3000/force-reconnect
     ```
   - Then scan the new QR code

3. **Messages not being delivered**:
   - Make sure the phone number format is correct (include country code)
   - Have the recipient send you a message first
   - Check if your WhatsApp account has any restrictions

4. **Application crashes or restarts**:
   - Check the system logs using the commands in the "Managing the Service" section
   - Ensure your droplet has enough memory (at least 1GB RAM recommended)

## Usage Example with cURL

```bash
curl -X POST http://your-droplet-ip:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{"number": "1234567890", "message": "Hello from WhatsApp Connector!"}'
```

## Security Recommendations

For production use, consider these security enhancements:

1. **Set up a firewall**:
   ```bash
   ufw allow 22/tcp  # SSH
   ufw allow 3000/tcp  # WhatsApp Connector API
   ufw enable
   ```

2. **Add HTTPS with Nginx and Let's Encrypt**:
   ```bash
   apt-get install -y nginx certbot python3-certbot-nginx
   # Configure Nginx as reverse proxy (see separate instructions)
   certbot --nginx -d yourdomain.com
   ```

3. **Add API authentication**:
   - Modify the code to include API key validation
   - Use environment variables to set the API key

## Environment Variables

- `PORT`: The port the server will run on (default: 3000)
- `NODE_ENV`: Set to "production" when deploying
- `NODE_OPTIONS`: Set to "--max_old_space_size=512" to limit Node.js memory usage 