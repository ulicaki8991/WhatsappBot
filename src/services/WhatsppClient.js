const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

// Determine if we're in production (Render.com) or development
const isProduction = process.env.NODE_ENV === "production";

console.log(`Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);
console.log(
  `System memory: ${
    process.memoryUsage().heapTotal / 1024 / 1024
  } MB heap total`
);

// Create debug log function
const debugLog = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);

  // Also write to a file for persistent logging
  if (isProduction) {
    try {
      fs.appendFileSync("/tmp/whatsapp-debug.log", logMessage + "\n");
    } catch (error) {
      console.error("Could not write to debug log file:", error.message);
    }
  }
};

debugLog("Setting up WhatsApp client configuration");

// Extra low memory settings for Puppeteer
const puppeteerConfig = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-software-rasterizer",
    "--disable-features=site-per-process",
    "--js-flags=--max-old-space-size=256", // More aggressive memory limit
    "--disable-web-security",
    "--window-size=800,600",
    "--disable-notifications",
    "--disable-desktop-notifications",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--mute-audio",
    "--disable-speech-api",
    "--hide-scrollbars",
  ],
  timeout: 240000, // 4 minutes timeout
  executablePath: isProduction ? "/usr/bin/google-chrome-stable" : undefined,
  defaultViewport: {
    width: 800,
    height: 600,
  },
  ignoreHTTPSErrors: true,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
};

// Configure WhatsApp client with appropriate settings for environment
const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./auth_data",
    clientId: "whatsapp-bot",
  }),
  puppeteer: puppeteerConfig,
  // Reduce cache usage with remote cache
  webVersionCache: {
    type: "remote",
  },
  // Extend timeouts
  authTimeoutMs: 900000, // 15 minutes
  qrTimeoutMs: 90000, // 1.5 minutes
  takeoverTimeoutMs: 300000,
});

debugLog("WhatsApp client configuration created");

// Log QR code to terminal and save to a file for remote access
whatsappClient.on("qr", (qr) => {
  debugLog("QR code received");

  // Generate QR in terminal for local development
  qrcode.generate(qr, { small: true });

  // For production environment, log QR code clearly
  console.log("\n\n--------- WHATSAPP QR CODE START ---------");
  console.log(qr);
  console.log("---------- WHATSAPP QR CODE END ----------\n\n");

  // Write QR code to a file for easier access
  if (isProduction) {
    try {
      fs.writeFileSync("/tmp/whatsapp-qr.txt", qr);
      debugLog("QR code written to /tmp/whatsapp-qr.txt");
    } catch (error) {
      debugLog(`Failed to write QR code to file: ${error.message}`);
    }
  }
});

whatsappClient.on("loading_screen", (percent, message) => {
  debugLog(`WhatsApp loading: ${percent}% - ${message}`);
});

whatsappClient.on("ready", () => {
  debugLog("WhatsApp client is ready!");

  // Clear any stored QR code
  if (isProduction) {
    try {
      if (fs.existsSync("/tmp/whatsapp-qr.txt")) {
        fs.unlinkSync("/tmp/whatsapp-qr.txt");
      }
    } catch (error) {
      debugLog(`Error clearing QR file: ${error.message}`);
    }
  }
});

whatsappClient.on("authenticated", () => {
  debugLog("WhatsApp client authenticated successfully");
});

whatsappClient.on("auth_failure", (msg) => {
  debugLog(`WhatsApp authentication failure: ${msg}`);
  debugLog("You may need to scan the QR code again.");

  // Force delete the auth data if authentication fails
  if (isProduction) {
    try {
      debugLog("Attempting to clear auth data for a fresh start");
      if (fs.existsSync("./auth_data")) {
        fs.rmdirSync("./auth_data", { recursive: true });
        debugLog("Auth data cleared, will generate new QR on next restart");
      }
    } catch (error) {
      debugLog(`Failed to clear auth data: ${error.message}`);
    }
  }
});

whatsappClient.on("disconnected", (reason) => {
  debugLog(`WhatsApp client disconnected: ${reason}`);
  debugLog("Attempting to reconnect...");

  // Try to reconnect after a short delay
  setTimeout(() => {
    initialize().catch((err) => {
      debugLog(`Failed to reinitialize WhatsApp client: ${err.message}`);
      if (err.stack) {
        debugLog(`Stack trace: ${err.stack}`);
      }
    });
  }, 5000);
});

whatsappClient.on("message", async (msg) => {
  try {
    if (msg.from != "status@broadcast") {
      const contact = await msg.getContact();
      debugLog(
        `Message from ${contact.pushname || contact.number}: ${msg.body}`
      );
    }
  } catch (error) {
    debugLog(`Error handling incoming message: ${error.message}`);
  }
});

// Add initialization with staged approach to avoid timeout
const initialize = async () => {
  debugLog("Starting WhatsApp client initialization...");

  // Log memory usage at start
  debugLog(`Initial memory usage: ${JSON.stringify(process.memoryUsage())}`);

  try {
    // Stage 1: Launch browser
    debugLog("Stage 1: Preparing to launch browser");

    // Use direct initialization instead of _initialize to have more control
    const browser = await whatsappClient.pupBrowser;
    if (!browser) {
      debugLog("Browser instance not available, creating it manually");
      whatsappClient.pupBrowser = await whatsappClient.options.puppeteer.launch(
        whatsappClient.options.puppeteer
      );

      debugLog("Browser launched successfully");
      debugLog(
        `Memory after browser launch: ${JSON.stringify(process.memoryUsage())}`
      );
    }

    // Stage 2: Initialize main client
    debugLog("Stage 2: Starting client initialization");
    await whatsappClient.initialize();

    debugLog("WhatsApp client initialization completed successfully");
    return true;
  } catch (error) {
    debugLog(`WhatsApp client initialization failed: ${error.message}`);

    if (error.stack) {
      debugLog(`Stack trace: ${error.stack}`);
    }

    // Check for common error patterns and provide more specific feedback
    if (error.message.includes("timeout")) {
      debugLog(
        "ERROR: Initialization timed out. This is likely due to insufficient memory."
      );
      debugLog(
        "Suggestion: Upgrade your Render.com instance to at least 2GB RAM."
      );
    } else if (
      error.message.includes("browser") ||
      error.message.includes("Puppeteer")
    ) {
      debugLog(
        "ERROR: Browser/Puppeteer issue detected. This could be due to resource constraints."
      );
      debugLog(
        `Memory usage details: ${JSON.stringify(process.memoryUsage())}`
      );
    }

    // Try to kill any zombie Chrome processes
    try {
      debugLog("Attempting to clean up Chrome processes");
      if (isProduction) {
        require("child_process").execSync("pkill -9 chrome");
        debugLog("Chrome processes terminated");
      }
    } catch (cleanupError) {
      debugLog(`Failed to clean up Chrome processes: ${cleanupError.message}`);
    }

    return false;
  }
};

whatsappClient.initialize = initialize;

module.exports = whatsappClient;
