#!/bin/bash
# Helper script to retrieve WhatsApp QR code

echo "Checking for WhatsApp QR code..."

# Check if the QR code file exists
if [ -f "/tmp/whatsapp-qr.txt" ]; then
    echo "QR code found!"
    echo "=================================="
    echo "Copy this QR code data and use an online QR code generator to scan it:"
    echo "=================================="
    cat /tmp/whatsapp-qr.txt
    echo ""
    echo "=================================="
    echo "Or visit one of these websites to generate a scannable QR code:"
    echo "1. https://qrcode.online/convert-text-to-qrcode"
    echo "2. https://www.the-qrcode-generator.com/"
    echo "3. https://www.qr-code-generator.com/"
    echo ""
    echo "Just paste the text above into any of these generators to get a scannable QR code."
else
    echo "QR code file not found at /tmp/whatsapp-qr.txt"
    echo "Checking logs for QR code..."
    
    # Try to find QR code in logs
    QR_CODE=$(grep -A 1 -B 0 "WHATSAPP QR CODE START" /var/log/app.log | tail -n 1)
    
    if [ -n "$QR_CODE" ]; then
        echo "QR code found in logs!"
        echo "=================================="
        echo "Copy this QR code data and use an online QR code generator to scan it:"
        echo "=================================="
        echo "$QR_CODE"
        echo ""
        echo "=================================="
        echo "Or visit one of these websites to generate a scannable QR code:"
        echo "1. https://qrcode.online/convert-text-to-qrcode"
        echo "2. https://www.the-qrcode-generator.com/"
        echo "3. https://www.qr-code-generator.com/"
        echo ""
        echo "Just paste the text above into any of these generators to get a scannable QR code."
    else
        echo "No QR code found in logs either."
        echo ""
        echo "This could mean one of two things:"
        echo "1. The WhatsApp client is already authenticated (check health endpoint)"
        echo "2. The QR code hasn't been generated yet (try restarting the service)"
        echo ""
        echo "You can try the following to get a new QR code:"
        echo "1. Clear the authentication data: rm -rf /app/auth_data/*"
        echo "2. Restart the service from the Render dashboard"
        echo "3. Wait a moment and run this script again"
    fi
fi 