FROM node:16-slim

# Set environment variables for better Chrome behavior
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=384"
# Add extra Chrome flags
ENV CHROME_EXTRA_FLAGS="--disable-dev-shm-usage --disable-software-rasterizer --no-sandbox --disable-setuid-sandbox"

# Install minimal Chrome dependencies for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
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
RUN npm install --production --no-optional --no-audit

# Copy project files
COPY . .

# Verify Chrome installation
RUN echo "Chrome version: $(google-chrome-stable --version || echo 'not installed')"

# Create memory monitoring script
RUN echo '#!/bin/bash\n\
while true; do\n\
  echo "Memory stats $(date):"\n\
  free -m\n\
  echo "Chrome processes:"\n\
  ps -o pid,rss,command | grep chrome | grep -v grep\n\
  echo "Node processes:"\n\
  ps -o pid,rss,command | grep node | grep -v grep\n\
  echo "-----------------------------------"\n\
  sleep 60\n\
done' > /app/monitor.sh && chmod +x /app/monitor.sh

# Expose the port
EXPOSE 3000

# Start the app with the memory monitor in background
CMD /app/monitor.sh & node src/simple-whatsapp.js 