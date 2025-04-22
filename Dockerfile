FROM node:16-slim

# Set environment variables for better Chrome behavior
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=512"

# Install Chrome dependencies and system utilities for monitoring
RUN apt-get update \
    && apt-get install -y wget gnupg procps curl htop vim \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-noto-color-emoji \
      --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create and ensure proper permissions for auth data directory
RUN mkdir -p /app/auth_data && chmod -R 777 /app/auth_data

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies 
RUN npm install --production --no-audit

# Copy project files
COPY . .

# Verify Chrome installation
RUN echo "Chrome version: $(google-chrome-stable --version)"

# Create improved startup script with better error handling and memory optimization
RUN echo '#!/bin/bash\n\
echo "Starting WhatsApp Connector service at $(date)"\n\
echo "System information:"\n\
free -m\n\
echo "Node version: $(node -v)"\n\
echo "Chrome version: $(google-chrome-stable --version)"\n\
\n\
# Clean up any stray Chrome processes before starting\n\
pkill -9 chrome || true\n\
\n\
# Create a memory monitor in background\n\
(while true; do\n\
  echo "[$(date)] Memory usage (MB):" >> /app/logs/memory_monitor.log\n\
  free -m | grep "Mem:" >> /app/logs/memory_monitor.log\n\
  echo "[$(date)] Node memory:" >> /app/logs/memory_monitor.log\n\
  ps -o pid,rss,command | grep "node" | grep -v grep >> /app/logs/memory_monitor.log\n\
  echo "[$(date)] Chrome memory:" >> /app/logs/memory_monitor.log\n\
  ps -o pid,rss,command | grep "chrome" | grep -v grep >> /app/logs/memory_monitor.log\n\
  sleep 60\n\
done) &\n\
\n\
# Start the application\n\
node src/simple-whatsapp.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Create logs directory
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Expose the port
EXPOSE 3000

# Start the app
CMD ["/app/start.sh"] 