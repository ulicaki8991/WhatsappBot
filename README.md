# WhatsApp Bot

A simple WhatsApp bot that sends automated price notifications using Express.js and whatsapp-web.js.

## Prerequisites

- Node.js v12.x or higher
- Google Chrome browser installed
- A WhatsApp account

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Running the Bot

Start the bot with:

```bash
npm start
```

When you run the bot for the first time:
1. A Chrome browser window will open
2. A QR code will be displayed in your terminal
3. Scan this QR code with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Tap Menu or Settings
   - Select WhatsApp Web
   - Point your phone camera at the QR code

## Using the Price Notification System

### Web Interface

After starting the server, open a browser and go to:
```
http://localhost:3000
```

The web interface allows you to:
- Enter a phone number (including country code)
- Set the price
- Select a message template
- Send price notifications

### API Endpoints

#### Send a Price Notification

```
POST /send-price-notification
```

Request body:
```json
{
  "number": "14155238886",
  "price": 99.99,
  "currency": "$",
  "templateType": "priceNotification"
}
```

Parameters:
- `number`: Phone number with country code (required)
- `price`: Numeric price value (required)
- `currency`: Currency symbol (optional, default: "$")
- `templateType`: Type of message template (optional, options: "priceNotification", "paymentConfirmation", "custom")
- `customTemplate`: Custom message template if templateType is "custom", use {price} as placeholder.

Example custom template:
```json
{
  "number": "14155238886", 
  "price": 99.99,
  "templateType": "custom",
  "customTemplate": "Your order is ready! Please pay {price} upon delivery."
}
```

#### Check Connection Status

```
GET /status
```

Response:
```json
{
  "status": "Connected"
}
```

## Integrating with Other Services

You can integrate this WhatsApp price notification system with your existing services:

### Example in Node.js

```javascript
const axios = require('axios');

async function sendPriceNotification(phoneNumber, price) {
  try {
    const response = await axios.post('http://localhost:3000/send-price-notification', {
      number: phoneNumber,
      price: price
    });
    console.log('Notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending notification:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendPriceNotification('14155238886', 99.99);
```

### Example in Python

```python
import requests

def send_price_notification(phone_number, price):
    try:
        response = requests.post(
            'http://localhost:3000/send-price-notification',
            json={
                'number': phone_number,
                'price': price
            }
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending notification: {e}")
        raise

# Usage
send_price_notification('14155238886', 99.99)
```

## Deployment to Render.com

This application can be deployed to Render.com, but it requires special setup due to the need for a headless Chrome instance.

### Option 1: Using Docker (Recommended)

1. Create a free account on [Render.com](https://render.com)
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - Choose "Docker" as the Environment
   - Set the name to "whatsapp-price-bot" or your preference
   - Select the branch to deploy
   - Set "Instance Type" to at least "Standard" (not "Free" as it needs more memory)
   - Click "Create Web Service"

### Option 2: Using the render.yaml Configuration

1. Push the code with the `render.yaml` file to your repository
2. In Render.com, click "New" and select "Blueprint"
3. Connect your repository
4. Render will detect and use the configuration in the render.yaml file

### Scanning the QR Code on Render

When deploying on Render, you'll need to scan a QR code to authenticate your WhatsApp account. Since there's no visual interface:

1. After deploying, check the logs in the Render dashboard
2. Look for a section in the logs that contains the QR code data
3. Use an online QR code generator like [QR Code Generator](https://www.the-qrcode-generator.com/) and paste the QR code data
4. Scan the generated QR code with your WhatsApp mobile app

### Persistence on Render

To maintain your WhatsApp session between deployments:

1. Go to your web service settings in Render
2. Under "Disks", add a new disk:
   - Mount path: `/app/auth_data`
   - Name: `whatsapp-auth`
   - Size: 1 GB (minimum)

This will preserve your WhatsApp authentication between deployments.

## Troubleshooting

If you encounter timeout errors:

- Make sure Google Chrome is installed on your system
- Ensure you have a stable internet connection
- Try increasing the timeout value in `src/services/WhatsppClient.js`
- Check that WhatsApp is properly registered on your phone

### Render-Specific Troubleshooting

- If you see "Error: Failed to launch the browser process", check that your service plan has sufficient memory
- If WhatsApp keeps disconnecting, ensure you've set up the disk for persistence
- The free tier may not have enough resources to run the bot. Consider upgrading to a paid plan.

## License

ISC 