#!/bin/bash

# WhatsApp Connector Direct Setup Script for DigitalOcean
echo "==== WhatsApp Connector Setup for DigitalOcean (No Docker) ===="
echo "This script will set up the WhatsApp Connector directly on your DigitalOcean droplet."

# Update system packages
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Node.js
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node -v
npm -v

# Install Chrome dependencies
echo "Installing Chrome and dependencies..."
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable fonts-noto-color-emoji procps curl htop vim

# Verify Chrome installation
google-chrome-stable --version

# Create directories for data and logs
echo "Creating directories for data and logs..."
mkdir -p /opt/whatsapp-connector/auth_data
mkdir -p /opt/whatsapp-connector/logs
chmod -R 777 /opt/whatsapp-connector

# Copy application files
echo "Setting up application..."
cp -r ./* /opt/whatsapp-connector/
cd /opt/whatsapp-connector

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/whatsapp-connector.service << EOL
[Unit]
Description=WhatsApp Connector Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/whatsapp-connector
ExecStart=/usr/bin/node src/simple-whatsapp.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=whatsapp-connector
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max_old_space_size=512

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and start service
echo "Starting service..."
systemctl daemon-reload
systemctl enable whatsapp-connector
systemctl start whatsapp-connector

# Show service status
echo "Service status:"
systemctl status whatsapp-connector

echo "==== Setup Complete ===="
echo "The WhatsApp Connector is now running on port 3000."
echo "You can access it at: http://YOUR_DROPLET_IP:3000"
echo ""
echo "To view logs:"
echo "  journalctl -u whatsapp-connector -f"
echo ""
echo "To check QR code:"
echo "  cat /opt/whatsapp-connector/auth_data/latest-qr.txt"
echo ""
echo "To restart the service:"
echo "  systemctl restart whatsapp-connector"
echo ""
echo "To force reconnect (if needed):"
echo "  curl -X POST http://localhost:3000/force-reconnect" 