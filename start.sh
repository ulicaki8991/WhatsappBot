#!/bin/bash

echo "Starting Simple WhatsApp Connector..."

# Create auth_data directory if it doesn't exist
mkdir -p auth_data

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the application
echo "Starting application..."
npm start 