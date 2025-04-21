#!/bin/bash
# Memory Optimizer for WhatsApp Connector
# This script monitors and optimizes system memory usage for the WhatsApp connector

# Configuration
LOG_DIR="/var/log/whatsapp-monitoring"
LOG_FILE="${LOG_DIR}/memory-optimizer.log"
MAX_LOG_SIZE=10485760  # 10MB
MEMORY_CHECK_INTERVAL=300  # Check every 5 minutes
MEMORY_THRESHOLD=85  # Percentage of memory usage that triggers optimization
NODE_PROCESS_NAME="node"  # Process to monitor/optimize
WHATSAPP_CONNECTOR_SERVICE="whatsapp-connector"  # Name of the service

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize log file
touch "$LOG_FILE"

# Function to log with timestamp
log_memory() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Memory Optimizer] $1" | tee -a "$LOG_FILE"
}

# Function to rotate logs if they get too large
rotate_logs() {
  if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
    timestamp=$(date +"%Y%m%d%H%M%S")
    mv "$LOG_FILE" "${LOG_FILE}.${timestamp}"
    touch "$LOG_FILE"
    log_memory "Log file rotated to ${LOG_FILE}.${timestamp}"
    
    # Keep only the last 5 log files
    ls -t "${LOG_FILE}."* | tail -n +6 | xargs -r rm
  fi
}

# Function to get current memory usage percentage
get_memory_usage() {
  free | grep Mem | awk '{print int($3/$2 * 100)}'
}

# Function to get memory usage of WhatsApp connector processes
get_whatsapp_memory() {
  ps -C "$NODE_PROCESS_NAME" -o pid,pmem,cmd --sort=-pmem | grep -i whatsapp | awk '{sum+=$2} END {print sum}'
}

# Function to optimize memory
optimize_memory() {
  log_memory "Memory optimization triggered - current usage: $1%"
  
  # Clear disk caches
  log_memory "Clearing disk caches..."
  sync
  echo 1 > /proc/sys/vm/drop_caches
  
  # Clear swap
  if [ "$(swapon --show | wc -l)" -gt 0 ]; then
    log_memory "Optimizing swap..."
    swapoff -a && swapon -a
  fi
  
  # Clear system slabs
  log_memory "Clearing kernel slabs..."
  echo 2 > /proc/sys/vm/drop_caches
  
  # Check if node processes are using too much memory
  node_memory=$(get_whatsapp_memory)
  if [ ! -z "$node_memory" ] && [ $(echo "$node_memory > 50" | bc -l) -eq 1 ]; then
    log_memory "WhatsApp Node processes using high memory: $node_memory%"
    
    # Attempt to restart service if it exists and system supports systemd
    if systemctl is-active --quiet "$WHATSAPP_CONNECTOR_SERVICE"; then
      log_memory "Restarting WhatsApp connector service..."
      systemctl restart "$WHATSAPP_CONNECTOR_SERVICE"
    else
      log_memory "WhatsApp service not found or not using systemd, trying to identify and restart manually..."
      # Find the largest Node.js process related to WhatsApp
      largest_pid=$(ps -C "$NODE_PROCESS_NAME" -o pid,%mem,cmd --sort=-%mem | grep -i whatsapp | head -1 | awk '{print $1}')
      if [ ! -z "$largest_pid" ]; then
        log_memory "Sending SIGUSR2 to Node.js process $largest_pid (if it supports graceful restart)"
        kill -SIGUSR2 "$largest_pid" 2>/dev/null || log_memory "Failed to send SIGUSR2, process may not support it"
      fi
    fi
  fi
  
  # Re-check memory usage after optimization
  new_usage=$(get_memory_usage)
  log_memory "Memory optimization completed - new usage: $new_usage%"
}

# Function to display system info
display_system_info() {
  total_mem=$(free -h | grep Mem | awk '{print $2}')
  used_mem=$(free -h | grep Mem | awk '{print $3}')
  free_mem=$(free -h | grep Mem | awk '{print $4}')
  swap_total=$(free -h | grep Swap | awk '{print $2}')
  swap_used=$(free -h | grep Swap | awk '{print $3}')
  load=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
  uptime=$(uptime -p)
  
  log_memory "System Information:"
  log_memory " - Total Memory: $total_mem"
  log_memory " - Used Memory: $used_mem"
  log_memory " - Free Memory: $free_mem"
  log_memory " - Swap: $swap_used / $swap_total"
  log_memory " - Load Average: $load"
  log_memory " - Uptime: $uptime"
  
  # Display top memory processes
  log_memory "Top 5 memory-consuming processes:"
  ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -6 | tail -5 | while read line; do
    log_memory " - $line"
  done
}

# Main program
log_memory "Memory optimizer started with PID $$"
log_memory "Memory threshold set to $MEMORY_THRESHOLD%"
log_memory "Check interval set to $MEMORY_CHECK_INTERVAL seconds"

# Display initial system information
display_system_info

# Create a PID file
echo $$ > "${LOG_DIR}/memory-optimizer.pid"

# Trap to handle script termination
trap 'log_memory "Memory optimizer stopped"; rm -f "${LOG_DIR}/memory-optimizer.pid"; exit 0' INT TERM EXIT

# Main loop
while true; do
  # Rotate logs if needed
  rotate_logs
  
  # Get current memory usage
  memory_usage=$(get_memory_usage)
  log_memory "Current memory usage: $memory_usage%"
  
  # Optimize memory if usage exceeds threshold
  if [ "$memory_usage" -ge "$MEMORY_THRESHOLD" ]; then
    optimize_memory "$memory_usage"
  else
    log_memory "Memory usage is below threshold, no optimization needed"
  fi
  
  # Sleep for the specified interval
  sleep "$MEMORY_CHECK_INTERVAL"
done 