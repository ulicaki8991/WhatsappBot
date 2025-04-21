#!/bin/bash
# WhatsApp Connector Monitoring Tools Installation Script
# This script installs and configures the WhatsApp connector monitoring tools

set -e  # Exit on error

# Configuration
INSTALL_DIR="/opt/whatsapp-monitoring"
LOG_DIR="/var/log/whatsapp-monitoring"
SCRIPT_NAMES=("whatsapp-health-check.sh" "memory-optimizer.sh" "startup.sh")
GITHUB_REPO_URL="https://github.com/YOUR_USERNAME/whatsapp-monitoring"  # Replace with actual repo if exists

# Function to log with timestamp
log_install() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if script is run as root
if [ "$(id -u)" -ne 0 ]; then
  log_install "This script must be run as root. Please use sudo."
  exit 1
fi

log_install "Starting WhatsApp Monitoring Tools Installation..."

# Create directories
log_install "Creating installation directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$LOG_DIR"

# Install dependencies
log_install "Installing dependencies..."
apt-get update
apt-get install -y curl wget htop sysstat procps net-tools

# Check if GitHub repo URL is set
if [[ "$GITHUB_REPO_URL" != *"YOUR_USERNAME"* ]]; then
  # Clone from repository if available
  log_install "Downloading scripts from GitHub repository..."
  cd /tmp
  git clone "$GITHUB_REPO_URL" whatsapp-monitoring-temp
  cp /tmp/whatsapp-monitoring-temp/*.sh "$INSTALL_DIR/"
  rm -rf /tmp/whatsapp-monitoring-temp
else
  # If no repo is specified, copy from current directory
  log_install "Copying scripts from current directory..."
  for script in "${SCRIPT_NAMES[@]}"; do
    if [ -f "$script" ]; then
      cp "$script" "$INSTALL_DIR/"
    else
      log_install "Warning: Script $script not found in current directory."
    fi
  done
fi

# Make scripts executable
log_install "Setting permissions..."
chmod +x "$INSTALL_DIR"/*.sh
chown -R root:root "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
chmod 755 "$LOG_DIR"

# Create symbolic links
log_install "Creating symbolic links..."
ln -sf "$INSTALL_DIR/whatsapp-health-check.sh" /usr/local/bin/whatsapp-health-check
ln -sf "$INSTALL_DIR/memory-optimizer.sh" /usr/local/bin/memory-optimizer

# Set up systemd service
log_install "Setting up systemd service..."
cat > /etc/systemd/system/whatsapp-monitoring.service << EOF
[Unit]
Description=WhatsApp Connector Monitoring Service
After=network.target

[Service]
Type=forking
ExecStart=/bin/bash $INSTALL_DIR/startup.sh
Restart=on-failure
RestartSec=5
StandardOutput=append:$LOG_DIR/service.log
StandardError=append:$LOG_DIR/service-error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
systemctl daemon-reload
systemctl enable whatsapp-monitoring.service

# Create cron job for regular health checks (every 15 minutes)
log_install "Setting up cron job for health checks..."
(crontab -l 2>/dev/null || echo "") | grep -v "whatsapp-health-check" | { cat; echo "*/15 * * * * $INSTALL_DIR/whatsapp-health-check.sh check-only > /dev/null 2>&1"; } | crontab -

log_install "Installation completed successfully!"
log_install "The monitoring services will start automatically on system boot."
log_install "To start the services now, run: systemctl start whatsapp-monitoring"
log_install "To check status, run: systemctl status whatsapp-monitoring"
log_install "Installation directory: $INSTALL_DIR"
log_install "Log directory: $LOG_DIR"

# Optional: Start the service immediately
log_install "Starting the monitoring service..."
systemctl start whatsapp-monitoring.service
log_install "Service started. Check status with: systemctl status whatsapp-monitoring" 