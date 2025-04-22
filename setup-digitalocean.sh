#!/bin/bash

# WhatsApp Connector Setup Script for DigitalOcean
echo "==== WhatsApp Connector Setup for DigitalOcean ===="
echo "This script will set up the WhatsApp Connector on your DigitalOcean droplet."

# Update system packages
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce
    systemctl enable docker
    systemctl start docker
else
    echo "Docker is already installed."
fi

# Create directories for persistent data
echo "Creating directories for persistent data..."
mkdir -p /root/whatsapp-connector/auth_data
mkdir -p /root/whatsapp-connector/logs
chmod -R 777 /root/whatsapp-connector

# Copy service file to systemd
echo "Setting up systemd service..."
cp whatsapp-connector.service /etc/systemd/system/
systemctl daemon-reload

# Build Docker image
echo "Building Docker image..."
docker build -t whatsapp-connector .

# Start the service
echo "Starting WhatsApp Connector service..."
systemctl enable whatsapp-connector
systemctl start whatsapp-connector

# Show status
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
echo "  cat /root/whatsapp-connector/auth_data/latest-qr.txt"
echo ""
echo "To restart the service:"
echo "  systemctl restart whatsapp-connector"
echo ""
echo "To force reconnect (if needed):"
echo "  curl -X POST http://localhost:3000/force-reconnect" 