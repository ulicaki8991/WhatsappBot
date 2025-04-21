#!/bin/bash
# System startup script for WhatsApp connector
# This script initializes both memory monitoring and WhatsApp health monitoring

LOG_DIR="/tmp"
STARTUP_LOG="$LOG_DIR/whatsapp-startup.log"
SCRIPTS_DIR="$(dirname "$(readlink -f "$0")")"

# Ensure scripts are executable
chmod +x "$SCRIPTS_DIR/memory-optimizer.sh"
chmod +x "$SCRIPTS_DIR/whatsapp-health-check.sh"

# Function to log with timestamp
log_startup() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" 
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$STARTUP_LOG"
}

# Ensure log directory exists
mkdir -p "$LOG_DIR"
log_startup "Starting WhatsApp connector monitoring services..."

# Display system information
log_startup "System information:"
log_startup "Memory: $(free -h | grep Mem | awk '{print $2}') total"
log_startup "Disk space: $(df -h / | grep / | awk '{print $4}') available"
log_startup "Node version: $(node -v 2>/dev/null || echo 'Node.js not found')"

# Set environment variable to tell apps we're in a resource-constrained environment
export LOW_RESOURCE_ENV=true

# Start memory optimizer in background
log_startup "Starting memory optimizer..."
"$SCRIPTS_DIR/memory-optimizer.sh" > /dev/null 2>&1 &
MEMORY_PID=$!
log_startup "Memory optimizer started with PID: $MEMORY_PID"

# Small delay to let memory optimizer initialize
sleep 2

# Start WhatsApp health monitor in background
log_startup "Starting WhatsApp health monitor..."
"$SCRIPTS_DIR/whatsapp-health-check.sh" > /dev/null 2>&1 &
HEALTH_PID=$!
log_startup "WhatsApp health monitor started with PID: $HEALTH_PID"

# Save PIDs to file for future reference
echo "$MEMORY_PID $HEALTH_PID" > "$LOG_DIR/whatsapp-monitor.pid"

log_startup "All monitoring services started successfully"
echo "WhatsApp monitoring services started. Check logs in $LOG_DIR for details."

# Optional: Start the actual WhatsApp connector if not already running
if ! pgrep -f "node src/index.js" > /dev/null; then
  log_startup "Starting WhatsApp connector..."
  cd /app && npm start > /dev/null 2>&1 &
  log_startup "WhatsApp connector started with PID: $!"
else
  log_startup "WhatsApp connector already running"
fi 