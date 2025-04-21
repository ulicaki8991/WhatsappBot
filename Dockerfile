FROM node:16-slim

# Install latest Chrome and dependencies for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg procps \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create and set permissions for auth data directory
RUN mkdir -p /app/auth_data && chmod -R 777 /app/auth_data

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Expose the port
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Create a script to start with error catching
RUN echo '#!/bin/bash\necho "Starting WhatsApp Bot..."\nnode src/index.js\nif [ $? -ne 0 ]; then\n  echo "Application crashed, logs:"\n  tail -n 50 /var/log/puppeteer.log\nfi' > /app/start.sh \
    && chmod +x /app/start.sh

# Start the app
CMD ["/app/start.sh"] 