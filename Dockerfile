FROM node:16-slim

# Set environment variables for better Chrome behavior
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
# Optimize Node.js memory settings
ENV NODE_OPTIONS="--max_old_space_size=384 --optimize-for-size --gc-interval=100 --max-http-header-size=10240"
# Add extra Chrome flags
ENV CHROME_EXTRA_FLAGS="--disable-dev-shm-usage --disable-software-rasterizer --no-sandbox --disable-setuid-sandbox"

# Install latest Chrome and dependencies for Puppeteer with more debugging tools
RUN apt-get update \
    && apt-get install -y wget gnupg procps curl htop vim \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-noto-color-emoji fonts-freefont-ttf libxss1 \
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

# Install app dependencies with production flag
RUN npm install --production --no-optional --no-audit

# Bundle app source
COPY . .

# Verify Chrome installation
RUN echo "Verifying Chrome installation..." && \
    google-chrome-stable --version && \
    echo "Chrome installation verified."

# Create directory for logs
RUN mkdir -p /var/log && touch /var/log/puppeteer.log && chmod 777 /var/log/puppeteer.log

# Optimize for Render.com environment - clean up unnecessary files
RUN find /app/node_modules -name "*.md" -type f -delete && \
    find /app/node_modules -name "*.map" -type f -delete && \
    find /app/node_modules -name "LICENSE" -type f -delete && \
    find /app/node_modules -name "README*" -type f -delete

# Expose the port
EXPOSE 3000

# Create an improved startup script with better error handling and memory optimization
RUN echo '#!/bin/bash\n\
echo "Starting WhatsApp Bot service at $(date)"\n\
echo "System information:"\n\
free -m\n\
echo "Node version: $(node -v)"\n\
echo "Chrome version: $(google-chrome-stable --version)"\n\
\n\
# Clean up any stray Chrome processes before starting\n\
pkill -9 chrome || true\n\
\n\
# Clean up any cache files\n\
rm -rf /tmp/.org.chromium.Chromium* || true\n\
\n\
# Create a memory monitor in background\n\
(while true; do\n\
  echo "[$(date)] Memory usage (MB):" >> /tmp/memory_monitor.log\n\
  free -m | grep "Mem:" >> /tmp/memory_monitor.log\n\
  echo "[$(date)] Node memory:" >> /tmp/memory_monitor.log\n\
  ps -o pid,rss,command | grep "node" | grep -v grep >> /tmp/memory_monitor.log\n\
  echo "[$(date)] Chrome memory:" >> /tmp/memory_monitor.log\n\
  ps -o pid,rss,command | grep "chrome" | grep -v grep >> /tmp/memory_monitor.log\n\
  sleep 30\n\
done) &\n\
\n\
# Start the application with proper failure handling\n\
node --expose-gc src/index.js 2>&1 | tee -a /var/log/app.log\n\
\n\
# Check exit status\n\
EXIT_CODE=$?\n\
if [ $EXIT_CODE -ne 0 ]; then\n\
  echo "Application crashed with exit code $EXIT_CODE"\n\
  echo "Last 50 lines of logs:"\n\
  tail -n 50 /var/log/app.log\n\
  echo "Memory at time of crash:"\n\
  free -m\n\
  echo "Last Chrome processes:"\n\
  ps aux | grep chrome\n\
  echo "Check /tmp/whatsapp-debug.log for more information"\n\
fi\n\
' > /app/start.sh \
    && chmod +x /app/start.sh

# Start the app
CMD ["/app/start.sh"] 