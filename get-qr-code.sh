#!/bin/bash
# Lightweight helper script for WhatsApp QR code - optimized for small instances

# Simple function to show QR code
show_qr() {
    if [ -f "/tmp/whatsapp-qr.txt" ]; then
        echo "===== WHATSAPP QR CODE FOUND ====="
        cat /tmp/whatsapp-qr.txt
        echo "===== END OF QR CODE ====="
        echo "Copy this text and create a QR code at: https://qrcode.online"
        return 0
    else
        echo "No QR code file found at /tmp/whatsapp-qr.txt"
        return 1
    fi
}

# Main command handler
case "$1" in
    -f|--force)
        echo "Forcing new QR code generation..."
        # Clean up everything
        rm -rf /app/auth_data/* 2>/dev/null || true
        pkill -9 chrome 2>/dev/null || true
        # Wait a moment
        sleep 2
        # Touch a file to trigger restart
        touch /app/src/index.js
        echo "Restart triggered. Wait 30 seconds then run this script again."
        ;;
    -r|--restart)
        echo "Restarting WhatsApp client..."
        pkill -9 chrome 2>/dev/null || true
        # Touch a file to trigger restart
        touch /app/src/index.js
        echo "Chrome processes terminated. Wait 15 seconds then check logs."
        ;;
    -h|--help)
        echo "WhatsApp QR Code Helper (Lightweight)"
        echo "Usage:"
        echo "  ./get-qr-code.sh         Show current QR code"
        echo "  ./get-qr-code.sh -f      Force new QR code generation"
        echo "  ./get-qr-code.sh -r      Restart Chrome browser"
        echo "  ./get-qr-code.sh -h      Show this help"
        ;;
    *)
        # Try to show QR code from file
        if ! show_qr; then
            # If no QR in file, try logs
            echo "Checking logs for QR code..."
            # Use simplified grep to save memory
            QR=$(grep -A 1 "WHATSAPP QR CODE" /var/log/app.log | tail -1)
            if [ -n "$QR" ]; then
                echo "===== QR CODE FOUND IN LOGS ====="
                echo "$QR"
                echo "===== END OF QR CODE ====="
                echo "Copy this text and create a QR code at: https://qrcode.online"
            else
                echo "No QR code found. Try restarting with: ./get-qr-code.sh -f"
            fi
        fi
        ;;
esac 