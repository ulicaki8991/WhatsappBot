const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const puppeteer = require("puppeteer");
const path = require("path");

// Determine if we're in production (Render.com) or development
const isProduction = process.env.NODE_ENV === "production";

// Add initialization flag to prevent multiple calls
let isInitializing = false;
let initRetries = 0;
const MAX_RETRIES = 3;

// Memory optimization for very small instances (512MB)
const ULTRA_LOW_MEMORY = true;

console.log(`Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);
console.log(
  `System memory: ${
    process.memoryUsage().heapTotal / 1024 / 1024
  } MB heap total`
);
console.log(
  `Memory optimization mode: ${
    ULTRA_LOW_MEMORY ? "ULTRA LOW MEMORY (512MB)" : "Standard"
  }`
);

// Create debug log function with minimal output in ultra low memory mode
const debugLog = (message) => {
  // Skip some verbose logging in ultra low memory mode
  if (
    ULTRA_LOW_MEMORY &&
    (message.includes("Memory usage") ||
      message.includes("Chrome processes") ||
      message.includes("garbage collection"))
  ) {
    return;
  }

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

// Ultra low memory settings for Puppeteer with bare minimum config
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
    // Ultra aggressive memory limits for 512MB instance
    "--js-flags=--max-old-space-size=128",
    "--disable-web-security",
    "--window-size=640,480", // Smaller viewport
    "--disable-notifications",
    "--disable-desktop-notifications",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--mute-audio",
    "--disable-speech-api",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-hang-monitor",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-sync",
    "--disable-translate",
    "--disable-domain-reliability",
    "--disable-infobars",
    "--disable-features=TranslateUI",
    "--disable-session-crashed-bubble",
  ],
  // Increased timeout for slower environments
  timeout: 300000, // 5 minutes
  executablePath: isProduction ? "/usr/bin/google-chrome-stable" : undefined,
  defaultViewport: {
    width: 640,
    height: 480,
  },
  ignoreHTTPSErrors: true,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
  // Add connection handling options
  protocolTimeout: 180000, // Protocol timeout (helps with session closed errors)
  slowMo: 100, // Slow down operations even more to reduce chance of errors
};

// Function to clean up any existing Chrome processes
const cleanupChromeProcesses = async () => {
  if (isProduction) {
    try {
      debugLog("Cleaning up Chrome processes");
      require("child_process").execSync("pkill -9 chrome || true");

      // Small delay to ensure processes are fully terminated
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      // Silent fail in ultra low memory mode
    }
  }
};

// Clean up Chrome processes before configuring client
cleanupChromeProcesses();

// Configure WhatsApp client with appropriate settings for environment
const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./auth_data",
    clientId: "whatsapp-bot",
  }),
  puppeteer: puppeteerConfig,
  // Disable caching in ultra low memory mode
  webVersionCache: {
    type: "none",
  },
  restartOnAuthFail: true,
  // Extended timeouts for slow environments
  authTimeoutMs: 900000, // 15 minutes
  qrTimeoutMs: 120000, // 2 minutes
  takeoverTimeoutMs: 300000,
});

debugLog("WhatsApp client configuration created");

// Make QR code appear prominently in logs
const displayQRCodeProminent = (qr) => {
  // Clear previous output
  console.log("\n\n\n");

  // Create a clearly visible separator
  console.log("=".repeat(80));
  console.log("=".repeat(30) + " WHATSAPP QR CODE " + "=".repeat(30));
  console.log("=".repeat(80));

  // Output the QR code for logs/terminal
  console.log(qr);

  // Another visible separator
  console.log("=".repeat(80));
  console.log("SCAN THIS QR CODE WITH YOUR WHATSAPP APP TO AUTHENTICATE");
  console.log(
    "Use an online QR code generator if needed (copy the text above)"
  );
  console.log("=".repeat(80));

  // Extra visible marker to make finding in logs easier
  console.log("### QR CODE DISPLAYED ABOVE ###");
};

// Log QR code to terminal and save to a file for remote access
whatsappClient.on("qr", (qr) => {
  debugLog("QR code received");

  // Generate QR in terminal for local development
  if (!isProduction) {
    qrcode.generate(qr, { small: true });
  }

  // For production environment, log QR code clearly as the last thing in logs
  displayQRCodeProminent(qr);

  // Write QR code to a file for easier access
  if (isProduction) {
    try {
      fs.writeFileSync("/tmp/whatsapp-qr.txt", qr);
      debugLog("QR code also written to /tmp/whatsapp-qr.txt");
    } catch (error) {
      debugLog(`Failed to write QR code to file: ${error.message}`);
    }
  }
});

whatsappClient.on("loading_screen", (percent, message) => {
  // Only log major progress in ultra low memory mode
  if (!ULTRA_LOW_MEMORY || percent % 25 === 0) {
    debugLog(`WhatsApp loading: ${percent}% - ${message}`);
  }
});

// Add a ready timeout watchdog - add after the authenticated event
let readyTimeout = null;
let isClientReady = false;

// Function to check if client is in a "stuck" authenticated state
const checkReadyState = () => {
  if (!isClientReady && whatsappClient.authStrategy?.isAuthenticated) {
    debugLog("WARNING: Client is authenticated but not ready after timeout");
    // Force reconnection
    if (whatsappClient.pupBrowser) {
      debugLog("Forcing browser closure to trigger reconnection");
      try {
        whatsappClient.pupBrowser
          .close()
          .catch((e) => debugLog(`Error closing browser: ${e.message}`));
      } catch (err) {
        debugLog(`Error during forced browser closure: ${err.message}`);
      }
    }
  }
};

whatsappClient.on("authenticated", () => {
  debugLog("WhatsApp client authenticated successfully");

  // Set a timeout to check if we reach "ready" state within 2 minutes
  readyTimeout = setTimeout(checkReadyState, 120000);
});

whatsappClient.on("ready", () => {
  debugLog("WhatsApp client is ready!");

  // Clear ready timeout
  if (readyTimeout) {
    clearTimeout(readyTimeout);
    readyTimeout = null;
  }

  isClientReady = true;

  // Reset retry counter on successful connection
  initRetries = 0;

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

whatsappClient.on("auth_failure", (msg) => {
  debugLog(`WhatsApp authentication failure: ${msg}`);
  debugLog("You may need to scan the QR code again.");

  // Force delete the auth data if authentication fails
  if (isProduction) {
    try {
      debugLog("Clearing auth data for a fresh start");
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

  // Reset initialization flag
  isInitializing = false;

  // Try to reconnect after a short delay
  setTimeout(async () => {
    // Clean up Chrome processes before reconnecting
    await cleanupChromeProcesses();

    initialize().catch((err) => {
      debugLog(`Failed to reinitialize WhatsApp client: ${err.message}`);
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

// Simplified initialization approach for ultra low memory systems
const initialize = async () => {
  // Prevent multiple simultaneous initialization attempts
  if (isInitializing) {
    debugLog("Initialization already in progress, skipping duplicate call");
    return false;
  }

  isInitializing = true;
  debugLog("Starting WhatsApp client initialization...");

  // Check if we've exceeded max retries
  if (initRetries >= MAX_RETRIES) {
    debugLog(
      `Maximum retries (${MAX_RETRIES}) exceeded. Waiting for manual restart.`
    );
    isInitializing = false;
    return false;
  }

  // Check for restart trigger file
  const restartTriggerFile = path.join("./auth_data", "restart_trigger");
  if (fs.existsSync(restartTriggerFile)) {
    debugLog("Restart trigger file detected, cleaning auth data");
    try {
      // Clean auth data directory except for the trigger file
      fs.readdirSync("./auth_data").forEach((file) => {
        if (file !== "restart_trigger") {
          const filePath = path.join("./auth_data", file);
          fs.unlinkSync(filePath);
        }
      });
      // Now remove the trigger file
      fs.unlinkSync(restartTriggerFile);
      debugLog("Auth data cleaned for fresh restart");
    } catch (error) {
      debugLog(`Error cleaning auth data: ${error.message}`);
    }
  }

  // Reset ready state flag
  isClientReady = false;

  initRetries++;

  // In ultra low memory mode, log less
  if (!ULTRA_LOW_MEMORY) {
    debugLog(`Initialization attempt ${initRetries} of ${MAX_RETRIES}`);
  }

  try {
    // Clean up memory before initialization
    if (global.gc) {
      global.gc();
    }

    // Wait a moment to let Chrome processes fully terminate
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Use a safer approach to initialization with longer timeouts for slow servers
    const timeoutMs = 360000; // 6 minutes
    const initPromise = Client.prototype.initialize.call(whatsappClient);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Initialization timed out after ${timeoutMs / 60000} minutes`
            )
          ),
        timeoutMs
      );
    });

    // Race between initialization and timeout
    await Promise.race([initPromise, timeoutPromise]);

    debugLog("WhatsApp client initialization completed successfully");
    isInitializing = false;
    initRetries = 0; // Reset retry counter on success
    return true;
  } catch (error) {
    debugLog(`WhatsApp client initialization failed: ${error.message}`);

    // More specific error handling
    if (
      error.message.includes("Session closed") ||
      error.message.includes("page has been closed")
    ) {
      debugLog("Browser session was closed - likely due to memory constraints");

      // Higher retry delay in ultra low memory mode
      const baseDelay = ULTRA_LOW_MEMORY ? 10000 : 5000;
      const retryDelay = initRetries * baseDelay;

      debugLog(`Will retry in ${retryDelay / 1000} seconds...`);

      // Clean up Chrome processes
      await cleanupChromeProcesses();

      setTimeout(async () => {
        isInitializing = false;
        await initialize();
      }, retryDelay);
    } else if (error.message.includes("timeout")) {
      debugLog(
        "ERROR: Initialization timed out - your server has very limited resources"
      );
      debugLog(
        "For 512MB instances, WhatsApp initialization may be unreliable"
      );

      // Still try to recover
      setTimeout(async () => {
        isInitializing = false;
        await initialize();
      }, 15000); // Longer delay for timeout errors
    }

    isInitializing = false;
    return false;
  }
};

// Replace the default initialize method with our custom one
whatsappClient.initialize = initialize;

module.exports = whatsappClient;
