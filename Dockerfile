FROM node:16-slim

# Set environment variables for better Chrome behavior
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
# Increase Node.js memory limits
ENV NODE_OPTIONS=--max_old_space_size=512

# Install latest Chrome and dependencies for Puppeteer with more debugging tools
RUN apt-get update \
    && apt-get install -y wget gnupg procps curl htop vim net-tools psmisc iputils-ping lsof \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/logs \
    && chmod 777 /tmp/logs

# Create and ensure proper permissions for auth data directory
RUN mkdir -p /app/auth_data && chmod -R 777 /app/auth_data

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Verify Chrome installation
RUN echo "Verifying Chrome installation..." && \
    google-chrome-stable --version && \
    echo "Chrome installation verified."

# Create directory for logs
RUN mkdir -p /var/log && touch /var/log/puppeteer.log && chmod 777 /var/log/puppeteer.log

# Expose the port
EXPOSE 3000

# Create a more robust startup script with health checking and debugging
RUN echo '#!/bin/bash\n\
echo "Starting WhatsApp Bot service at $(date)"\n\
echo "System information:"\n\
free -m\n\
echo "Node version: $(node -v)"\n\
echo "NPM version: $(npm -v)"\n\
echo "Chrome version: $(google-chrome-stable --version)"\n\
\n\
# Create a monitor in background\n\
(while true; do\n\
  echo "[$(date)] Memory usage:" >> /tmp/system_monitor.log\n\
  free -m >> /tmp/system_monitor.log\n\
  echo "[$(date)] Process list:" >> /tmp/system_monitor.log\n\
  ps aux | grep -E "node|chrome" >> /tmp/system_monitor.log\n\
  sleep 30\n\
done) &\n\
\n\
# Start the application\n\
node src/index.js 2>&1 | tee -a /var/log/app.log\n\
\n\
# Check exit status\n\
EXIT_CODE=$?\n\
if [ $EXIT_CODE -ne 0 ]; then\n\
  echo "Application crashed with exit code $EXIT_CODE"\n\
  echo "Last 50 lines of logs:"\n\
  tail -n 50 /var/log/app.log\n\
  echo "Check /tmp/whatsapp-debug.log for more information"\n\
fi\n\
' > /app/start.sh \
    && chmod +x /app/start.sh

# Start the app
CMD ["/app/start.sh"] 