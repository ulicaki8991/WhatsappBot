#!/bin/bash
# WhatsApp Bot Troubleshooting Script for Render.com
# Run this in the Render.com shell to diagnose and fix common issues

# Print header
echo "====================================================="
echo "WhatsApp Bot Troubleshooting Script"
echo "====================================================="
echo "Running diagnostics..."

# Check system resources
echo -e "\n📊 SYSTEM RESOURCES:"
echo "-----------------------------------------------------"
echo "Memory Usage:"
free -m
echo "-----------------------------------------------------"
echo "Disk Usage:"
df -h
echo "-----------------------------------------------------"
echo "CPU Info:"
lscpu | grep "CPU(s):" | head -1
echo "-----------------------------------------------------"

# Check running processes
echo -e "\n🔍 PROCESS CHECK:"
echo "-----------------------------------------------------"
echo "Node.js processes:"
ps aux | grep node | grep -v grep
echo "-----------------------------------------------------"
echo "Chrome processes:"
ps aux | grep chrome | grep -v grep
echo "-----------------------------------------------------"
echo "Process count:"
ps aux | grep -E 'node|chrome' | grep -v grep | wc -l
echo "-----------------------------------------------------"

# Check for Chrome installation
echo -e "\n🌐 CHROME VERIFICATION:"
echo "-----------------------------------------------------"
if command -v google-chrome-stable &> /dev/null; then
    CHROME_VERSION=$(google-chrome-stable --version)
    echo "Chrome is installed: $CHROME_VERSION"
else
    echo "❌ ERROR: Chrome is not installed!"
fi
echo "-----------------------------------------------------"

# Check log files
echo -e "\n📜 LOG FILES CHECK:"
echo "-----------------------------------------------------"
echo "Debug log exists:"
if [ -f "/tmp/whatsapp-debug.log" ]; then
    echo "✅ Debug log found"
    echo "Last 5 debug log entries:"
    tail -n 5 /tmp/whatsapp-debug.log
else
    echo "❌ Debug log not found"
fi

echo "-----------------------------------------------------"
echo "QR code file exists:"
if [ -f "/tmp/whatsapp-qr.txt" ]; then
    echo "✅ QR code file found"
    echo "QR code is available at /tmp/whatsapp-qr.txt"
else
    echo "❌ QR code file not found"
fi
echo "-----------------------------------------------------"

# Check auth data
echo -e "\n🔑 AUTHENTICATION DATA:"
echo "-----------------------------------------------------"
if [ -d "/app/auth_data" ]; then
    echo "Auth data directory exists"
    echo "Contents:"
    ls -la /app/auth_data
else
    echo "❌ Auth data directory not found!"
fi
echo "-----------------------------------------------------"

# Fix options menu
echo -e "\n🔧 FIX OPTIONS:"
echo "-----------------------------------------------------"
echo "1. Clear auth data (force new QR code)"
echo "2. Restart Chrome processes"
echo "3. Clear browser cache"
echo "4. Show current QR code (if available)"
echo "5. View detailed debug logs"
echo "6. Monitor system resources in real-time"
echo "7. Exit"
echo "-----------------------------------------------------"

read -p "Enter option (1-7): " option

case $option in
    1)
        echo "Clearing auth data..."
        rm -rf /app/auth_data/*
        echo "✅ Auth data cleared. You should restart the service now."
        ;;
    2)
        echo "Restarting Chrome processes..."
        pkill -9 chrome
        echo "✅ Chrome processes killed. They will restart automatically."
        ;;
    3)
        echo "Clearing browser cache..."
        rm -rf /tmp/.org.chromium.Chromium*
        echo "✅ Browser cache cleared. You should restart the service now."
        ;;
    4)
        if [ -f "/tmp/whatsapp-qr.txt" ]; then
            echo "Current QR code:"
            cat /tmp/whatsapp-qr.txt
        else
            echo "❌ No QR code file found."
        fi
        ;;
    5)
        if [ -f "/tmp/whatsapp-debug.log" ]; then
            echo "Detailed debug logs (last 50 lines):"
            tail -n 50 /tmp/whatsapp-debug.log
        else
            echo "❌ No debug log file found."
        fi
        ;;
    6)
        echo "Monitoring system resources (Ctrl+C to exit)..."
        while true; do
            clear
            date
            echo "Memory:"
            free -m
            echo "Top processes:"
            ps aux --sort=-%mem | head -6
            sleep 2
        done
        ;;
    7)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo -e "\n✅ Troubleshooting complete."
echo "For more detailed instructions, refer to RENDER_DEPLOYMENT.md"
echo "=====================================================" 