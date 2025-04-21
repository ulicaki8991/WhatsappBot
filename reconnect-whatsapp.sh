#!/bin/bash
# WhatsApp Reconnection Script
# This script forces a clean reconnection of the WhatsApp client

echo "=== WhatsApp Reconnection Tool ==="
echo "This script will force the WhatsApp client to reconnect"
echo "========================================"

# Check if we can find a process ID for the node server
PID=$(pgrep -f "node.*src/index.js")

if [ -z "$PID" ]; then
  echo "Error: WhatsApp node process not found"
  exit 1
fi

echo "Found WhatsApp process with PID: $PID"
echo "Sending SIGUSR1 signal to trigger garbage collection..."

# Try to trigger garbage collection via SIGUSR1 (Node.js special signal)
kill -SIGUSR1 $PID

# Look for any Chrome/Puppeteer processes
echo "Looking for Chrome/Puppeteer processes..."
CHROME_PIDS=$(pgrep -f "chrome|puppeteer|chromium")

if [ -n "$CHROME_PIDS" ]; then
  echo "Found Chrome/Puppeteer processes. Terminating..."
  echo $CHROME_PIDS
  
  # Kill Chrome processes
  for cpid in $CHROME_PIDS; do
    echo "Terminating Chrome process $cpid"
    kill -9 $cpid 2>/dev/null
  done

  echo "All Chrome processes terminated"
else
  echo "No Chrome processes found"
fi

# Clean auth data
echo "Cleaning WhatsApp authentication data..."

# Create a temporary file to tell the application to restart
RESTART_TRIGGER_FILE="./auth_data/restart_trigger"
touch "$RESTART_TRIGGER_FILE"

echo "Reconnection process completed."
echo "Wait 30-60 seconds for WhatsApp to reinitialize and display a QR code."
echo "You may need to reload the web UI to view the updated status."
echo "========================================" 