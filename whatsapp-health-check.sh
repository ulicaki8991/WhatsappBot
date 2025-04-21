#!/bin/bash
# WhatsApp Health Check Script
# This script monitors the health of the WhatsApp connector and performs recovery actions

# Configuration
LOG_DIR="/var/log/whatsapp-monitoring"
LOG_FILE="${LOG_DIR}/health-check.log"
MAX_LOG_SIZE=10485760  # 10MB
HEALTH_CHECK_INTERVAL=60  # Check every minute
MAX_RESTART_ATTEMPTS=3    # Maximum restart attempts before alerting
RESTART_COOLDOWN=1800     # 30 minutes cooldown between restart attempts
WHATSAPP_CONNECTOR_SERVICE="whatsapp-connector"  # Name of the service
WHATSAPP_PORT=3000        # Default port to check (modify as needed)
NODE_PROCESS_NAME="node"  # Process name to check
WHATSAPP_API_ENDPOINT="/health"  # Health check endpoint (modify as needed)
API_TIMEOUT=10           # API timeout in seconds

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize log file
touch "$LOG_FILE"

# Function to log with timestamp
log_health() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Health Check] $1" | tee -a "$LOG_FILE"
}

# Function to rotate logs if they get too large
rotate_logs() {
  if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
    timestamp=$(date +"%Y%m%d%H%M%S")
    mv "$LOG_FILE" "${LOG_FILE}.${timestamp}"
    touch "$LOG_FILE"
    log_health "Log file rotated to ${LOG_FILE}.${timestamp}"
    
    # Keep only the last 5 log files
    ls -t "${LOG_FILE}."* | tail -n +6 | xargs -r rm
  fi
}

# Function to check if a process is running
check_process() {
  pgrep -f "$1" >/dev/null
  return $?
}

# Function to check if the port is listening
check_port() {
  nc -z localhost "$1" >/dev/null 2>&1
  return $?
}

# Function to check API health endpoint
check_api_health() {
  if command -v curl >/dev/null 2>&1; then
    response=$(curl -s -m "$API_TIMEOUT" "http://localhost:${WHATSAPP_PORT}${WHATSAPP_API_ENDPOINT}" 2>&1)
    if [[ "$response" == *"status"*":"*"ok"* ]] || [[ "$response" == *"health"*":"*"ok"* ]]; then
      return 0
    fi
  elif command -v wget >/dev/null 2>&1; then
    response=$(wget -q -O - -T "$API_TIMEOUT" "http://localhost:${WHATSAPP_PORT}${WHATSAPP_API_ENDPOINT}" 2>&1)
    if [[ "$response" == *"status"*":"*"ok"* ]] || [[ "$response" == *"health"*":"*"ok"* ]]; then
      return 0
    fi
  fi
  return 1
}

# Function to restart the service
restart_service() {
  log_health "Attempting to restart WhatsApp connector service..."
  
  # Check if service is managed by systemd
  if systemctl is-active --quiet "$WHATSAPP_CONNECTOR_SERVICE" 2>/dev/null || systemctl is-enabled --quiet "$WHATSAPP_CONNECTOR_SERVICE" 2>/dev/null; then
    log_health "Restarting through systemd..."
    systemctl restart "$WHATSAPP_CONNECTOR_SERVICE"
    sleep 15  # Wait for service to restart
    
    if systemctl is-active --quiet "$WHATSAPP_CONNECTOR_SERVICE"; then
      log_health "Service successfully restarted via systemd"
      return 0
    else
      log_health "Failed to restart service via systemd"
      return 1
    fi
  else
    # Manual restart if systemd service is not found
    log_health "No systemd service found, attempting manual restart..."
    
    # Find main WhatsApp connector process
    whatsapp_pid=$(ps -ef | grep -i "whatsapp" | grep -v grep | grep node | awk '{print $2}' | head -1)
    
    if [ -n "$whatsapp_pid" ]; then
      log_health "Found WhatsApp process with PID $whatsapp_pid, stopping it..."
      kill "$whatsapp_pid"
      sleep 5
      
      # Check if it's still running and force kill if needed
      if ps -p "$whatsapp_pid" >/dev/null 2>&1; then
        log_health "Process didn't stop gracefully, force killing..."
        kill -9 "$whatsapp_pid" 2>/dev/null
      fi
    fi
    
    # Look for a startup script
    startup_script=$(find /opt -name "*.sh" -type f -exec grep -l "whatsapp" {} \; | head -1)
    
    if [ -n "$startup_script" ]; then
      log_health "Found startup script at $startup_script, executing..."
      bash "$startup_script" &
      sleep 15
      
      # Check if restarted successfully
      if check_process "whatsapp"; then
        log_health "Successfully restarted WhatsApp connector manually"
        return 0
      else
        log_health "Failed to restart WhatsApp connector manually"
        return 1
      fi
    else
      log_health "No startup script found, cannot restart manually"
      return 1
    fi
  fi
}

# Function to collect diagnostics
collect_diagnostics() {
  diag_file="${LOG_DIR}/whatsapp-diag-$(date +"%Y%m%d%H%M%S").log"
  
  log_health "Collecting diagnostics to $diag_file"
  
  {
    echo "=== WhatsApp Connector Diagnostics ==="
    echo "Date: $(date)"
    echo "Hostname: $(hostname)"
    echo ""
    
    echo "=== System Information ==="
    echo "Uptime: $(uptime)"
    free -h
    df -h
    echo ""
    
    echo "=== Process Information ==="
    ps aux | grep -E "node|whatsapp" | grep -v grep
    echo ""
    
    echo "=== Network Information ==="
    netstat -tuln | grep -E "(LISTEN|$WHATSAPP_PORT)"
    if command -v curl >/dev/null 2>&1; then
      echo "Curl to health endpoint:"
      curl -v "http://localhost:${WHATSAPP_PORT}${WHATSAPP_API_ENDPOINT}" 2>&1
    fi
    echo ""
    
    echo "=== Log Snippets ==="
    echo "Last 20 lines of WhatsApp connector log:"
    find /var/log -name "*whatsapp*" -type f | xargs -I{} tail -20 {} 2>/dev/null
    echo ""
    
    echo "=== Configuration Files ==="
    find /etc -name "*whatsapp*" -type f | xargs -I{} echo "File: {}" 2>/dev/null
    echo ""
    
    echo "=== Service Status ==="
    systemctl status "$WHATSAPP_CONNECTOR_SERVICE" 2>/dev/null || echo "Service not found in systemd"
    echo ""
  } > "$diag_file"
  
  log_health "Diagnostics collected to $diag_file"
}

# Function to check and recover WhatsApp connector
check_whatsapp_health() {
  # Initialize health status
  process_healthy=false
  port_healthy=false
  api_healthy=false
  
  # Check process
  if check_process "whatsapp"; then
    log_health "WhatsApp process check: OK"
    process_healthy=true
  else
    log_health "WhatsApp process check: FAIL - Process not found"
  fi
  
  # Check port
  if check_port "$WHATSAPP_PORT"; then
    log_health "WhatsApp port check ($WHATSAPP_PORT): OK"
    port_healthy=true
  else
    log_health "WhatsApp port check ($WHATSAPP_PORT): FAIL - Port not listening"
  fi
  
  # Check API health endpoint
  if check_api_health; then
    log_health "WhatsApp API health check: OK"
    api_healthy=true
  else
    log_health "WhatsApp API health check: FAIL - Endpoint not responding or unhealthy"
  fi
  
  # Overall health assessment
  if $process_healthy && $port_healthy && $api_healthy; then
    log_health "WhatsApp connector is healthy"
    
    # Reset restart counter if service has been healthy for a while
    last_restart=$(cat "${LOG_DIR}/last_restart.txt" 2>/dev/null || echo "0")
    if [ $(($(date +%s) - last_restart)) -gt "$RESTART_COOLDOWN" ]; then
      echo "0" > "${LOG_DIR}/restart_count.txt"
    fi
    
    return 0
  else
    log_health "WhatsApp connector is unhealthy - initiating recovery"
    
    # Get current restart count
    restart_count=$(cat "${LOG_DIR}/restart_count.txt" 2>/dev/null || echo "0")
    
    # Check if we've exceeded max restart attempts
    if [ "$restart_count" -ge "$MAX_RESTART_ATTEMPTS" ]; then
      log_health "WARNING: Maximum restart attempts ($MAX_RESTART_ATTEMPTS) reached!"
      collect_diagnostics
      
      # Reset counter but back off with longer interval
      echo "0" > "${LOG_DIR}/restart_count.txt"
      echo "$(date +%s)" > "${LOG_DIR}/last_restart.txt"
      
      # TODO: Add alerting mechanism here (e.g., send email, SMS)
      return 1
    fi
    
    # Attempt to restart the service
    if restart_service; then
      # Increment restart counter and update timestamp
      echo "$((restart_count + 1))" > "${LOG_DIR}/restart_count.txt"
      echo "$(date +%s)" > "${LOG_DIR}/last_restart.txt"
      return 0
    else
      log_health "Failed to restart WhatsApp connector"
      collect_diagnostics
      
      # Increment restart counter and update timestamp
      echo "$((restart_count + 1))" > "${LOG_DIR}/restart_count.txt"
      echo "$(date +%s)" > "${LOG_DIR}/last_restart.txt"
      return 1
    fi
  fi
}

# Main program
log_health "WhatsApp Health Check started with PID $$"
log_health "Check interval set to $HEALTH_CHECK_INTERVAL seconds"

# Create a PID file
echo $$ > "${LOG_DIR}/health-check.pid"

# Initialize counter files
touch "${LOG_DIR}/restart_count.txt"
touch "${LOG_DIR}/last_restart.txt"

# Trap to handle script termination
trap 'log_health "Health Check stopped"; rm -f "${LOG_DIR}/health-check.pid"; exit 0' INT TERM EXIT

# Main loop
while true; do
  # Rotate logs if needed
  rotate_logs
  
  # Perform health check
  check_whatsapp_health
  
  # Sleep for the specified interval
  sleep "$HEALTH_CHECK_INTERVAL"
done 