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

// Expose initialization state globally for other modules to check
global.isInitializing = false;

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

// Handle browser/page closures and crashes
const setupBrowserMonitoring = () => {
  try {
    if (whatsappClient.pupBrowser) {
      whatsappClient.pupBrowser.on("disconnected", () => {
        debugLog("Browser disconnected unexpectedly");
        isClientReady = false;
        if (!isInitializing) {
          debugLog("Triggering reconnection due to browser disconnect");
          setTimeout(
            () =>
              initialize().catch((err) => {
                debugLog(
                  `Failed to reinitialize after browser disconnect: ${err.message}`
                );
              }),
            5000
          );
        }
      });
    }

    if (whatsappClient.pupPage) {
      whatsappClient.pupPage.on("close", () => {
        debugLog("Page closed unexpectedly");
        isClientReady = false;
        if (!isInitializing) {
          debugLog("Triggering reconnection due to page close");
          setTimeout(
            () =>
              initialize().catch((err) => {
                debugLog(
                  `Failed to reinitialize after page close: ${err.message}`
                );
              }),
            5000
          );
        }
      });

      whatsappClient.pupPage.on("error", (err) => {
        debugLog(`Page error: ${err.message}`);
        isClientReady = false;
      });
    }
  } catch (e) {
    debugLog(`Error setting up browser monitoring: ${e.message}`);
  }
};

whatsappClient.on("ready", () => {
  debugLog("WhatsApp client is ready!");

  // Setup monitoring for browser/page events
  setupBrowserMonitoring();

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
  global.isInitializing = true; // Set global flag

  // Add this check to clear auth data if needed
  try {
    // Check if authentication files exist but might be corrupted
    const authPath = "./auth_data";
    if (fs.existsSync(authPath)) {
      // Look for session data files
      const files = fs.readdirSync(authPath);

      // Check if there's a valid session directory
      const sessionDir = files.find(
        (f) => f === "session-whatsapp-bot" || f === "session"
      );

      if (sessionDir) {
        // Check if the session directory is empty or has invalid files
        const sessionPath = path.join(authPath, sessionDir);

        try {
          if (fs.statSync(sessionPath).isDirectory()) {
            const sessionFiles = fs.readdirSync(sessionPath);

            // If session directory is empty or has very few files, it might be corrupted
            if (sessionFiles.length < 2) {
              debugLog(
                `Session directory ${sessionDir} appears to be corrupted or empty`
              );
              fs.rmdirSync(sessionPath, { recursive: true });
              debugLog(
                `Removed potentially corrupted session directory: ${sessionPath}`
              );
            } else {
              debugLog(
                `Found valid session directory: ${sessionDir} with ${sessionFiles.length} files`
              );
            }
          }
        } catch (dirErr) {
          debugLog(`Error checking session directory: ${dirErr.message}`);
        }
      }

      // Check for other potentially corrupted files
      if (files.length > 0 && !files.some((f) => f.includes("session"))) {
        debugLog("Possible corrupted auth data found, cleaning...");
        for (const file of files) {
          if (file !== ".gitkeep" && file !== "restart_trigger") {
            try {
              const filePath = path.join(authPath, file);
              const stats = fs.statSync(filePath);

              if (stats.isDirectory()) {
                fs.rmdirSync(filePath, { recursive: true });
                debugLog(`Removed directory: ${filePath}`);
              } else {
                fs.unlinkSync(filePath);
                debugLog(`Removed file: ${filePath}`);
              }
            } catch (e) {
              debugLog(`Failed to remove ${file}: ${e.message}`);
            }
          }
        }
      }
    }
  } catch (e) {
    debugLog(`Error checking auth data: ${e.message}`);
  }

  debugLog("Starting WhatsApp client initialization...");

  // Check if we've exceeded max retries
  if (initRetries >= MAX_RETRIES) {
    debugLog(
      `Maximum retries (${MAX_RETRIES}) exceeded. Waiting for manual restart.`
    );
    isInitializing = false;
    global.isInitializing = false; // Clear global flag
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
    global.isInitializing = false; // Clear global flag
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
        global.isInitializing = false; // Clear global flag
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
        global.isInitializing = false; // Clear global flag
        await initialize();
      }, 15000); // Longer delay for timeout errors
    }

    isInitializing = false;
    global.isInitializing = false; // Clear global flag
    return false;
  }
};

// Add a method to check if client is fully ready
whatsappClient.isReady = function () {
  try {
    return !!(this.info && this.pupPage && this.pupBrowser && isClientReady);
  } catch (e) {
    debugLog(`Error checking ready state: ${e.message}`);
    return false;
  }
};

// Replace the default initialize method with our custom one
whatsappClient.initialize = initialize;

// Function to safely handle errors with connection and try to reconnect
whatsappClient.tryReconnect = function (errorMessage) {
  debugLog(`Connection issue detected: ${errorMessage}`);

  // Only attempt reconnection if not already initializing
  if (!isInitializing) {
    isClientReady = false;

    // If we have a browser, try to close it first
    if (this.pupBrowser) {
      try {
        debugLog("Closing browser before reconnection attempt");
        this.pupBrowser.close().catch((e) => {
          debugLog(`Error closing browser: ${e.message}`);
        });
      } catch (err) {
        debugLog(`Error during browser closure: ${err.message}`);
      }
    }

    // Wait a bit then initialize again
    debugLog("Scheduling reconnection attempt in 10 seconds");
    setTimeout(() => {
      initialize().catch((err) => {
        debugLog(`Failed to reconnect: ${err.message}`);
      });
    }, 10000);
  } else {
    debugLog("Reconnection already in progress, skipping new attempt");
  }
};

// Add a method to safely check connection state
whatsappClient.checkConnection = function () {
  try {
    const isConnected =
      this.info && this.pupPage && this.pupBrowser && isClientReady;
    if (!isConnected && !isInitializing) {
      debugLog("Connection check failed, triggering reconnection");
      this.tryReconnect("Connection check failed");
    }
    return isConnected;
  } catch (e) {
    debugLog(`Error during connection check: ${e.message}`);
    this.tryReconnect(e.message);
    return false;
  }
};

// Add error handling to sendMessage method by monkey patching it
const originalSendMessage = whatsappClient.sendMessage;
whatsappClient.sendMessage = async function (chatId, content, options) {
  try {
    // Check connection first
    if (!this.checkConnection()) {
      throw new Error("Client is not connected. Cannot send message.");
    }

    // Call the original method
    return await originalSendMessage.call(this, chatId, content, options);
  } catch (error) {
    debugLog(`Error in sendMessage: ${error.message}`);

    // Check for connection-related errors
    if (
      error.message.includes("page") ||
      error.message.includes("browser") ||
      error.message.includes("not connected") ||
      error.message.includes("not ready")
    ) {
      this.tryReconnect(error.message);
    }

    throw error;
  }
};

// Function to force clean authentication data
whatsappClient.forceCleanAuth = async function () {
  debugLog("Force cleaning authentication data");

  // First close browser if it exists
  if (this.pupBrowser) {
    try {
      debugLog("Closing browser");
      await this.pupBrowser.close().catch((e) => {
        debugLog(`Error closing browser: ${e.message}`);
      });
    } catch (e) {
      debugLog(`Error closing browser: ${e.message}`);
    }
  }

  // Reset flags
  isClientReady = false;

  // Clean auth data
  try {
    const authPath = "./auth_data";
    debugLog("Removing auth data");

    // Delete auth data files but keep directory
    if (fs.existsSync(authPath)) {
      const files = fs.readdirSync(authPath);
      for (const file of files) {
        if (file !== ".gitkeep") {
          const filePath = path.join(authPath, file);

          // Check if it's a directory or file and handle accordingly
          try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              // Recursively remove directory
              debugLog(`Removing directory: ${filePath}`);
              fs.rmdirSync(filePath, { recursive: true });
            } else {
              // Remove file
              debugLog(`Removing file: ${filePath}`);
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            debugLog(`Error removing ${filePath}: ${err.message}`);
          }
        }
      }
      debugLog("Auth data cleaned");
    }
  } catch (e) {
    debugLog(`Error cleaning auth data: ${e.message}`);
  }

  // Make sure initialization flags are reset
  isInitializing = false;
  global.isInitializing = false;

  // Trigger re-initialization
  debugLog("Scheduling re-initialization");
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const result = await initialize();
        resolve(result);
      } catch (e) {
        debugLog(`Error during re-initialization: ${e.message}`);
        resolve(false);
      }
    }, 3000);
  });
};

module.exports = whatsappClient;
