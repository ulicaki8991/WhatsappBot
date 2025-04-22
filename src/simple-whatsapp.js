const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// Check if we're in production (Render.com)
const isProduction =
  process.env.NODE_ENV === "production" || process.env.RENDER === "true";

console.log(`Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);
console.log(
  `System memory: ${
    process.memoryUsage().heapTotal / 1024 / 1024
  } MB heap total`
);

// Create Express app
const app = express();
app.use(express.json());

// Add initialization flag to prevent multiple calls
let isInitializing = false;
let initRetries = 0;
const MAX_RETRIES = 5;

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Make sure auth_data directory exists
const authPath = "./auth_data";
if (!fs.existsSync(authPath)) {
  fs.mkdirSync(authPath, { recursive: true });
  console.log("Created auth_data directory");
}

// Enhanced configuration for Render.com compatibility with ultra-low memory settings
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
    // Ultra aggressive memory limits
    "--js-flags=--max-old-space-size=128",
    "--disable-web-security",
    "--window-size=640,480", // Smaller viewport
    "--disable-notifications",
    "--disable-desktop-notifications",
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
    "--disable-sync",
    "--disable-translate",
    "--disable-domain-reliability",
    "--disable-infobars",
    "--disable-features=TranslateUI",
    "--disable-session-crashed-bubble",
  ],
  // Important for Render.com
  executablePath: isProduction ? "/usr/bin/google-chrome-stable" : undefined,
  // Increased timeout for slower environments like Render
  timeout: 120000,
  // Smaller viewport to reduce memory usage
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

// Clean up any existing Chrome processes before starting
if (isProduction) {
  try {
    console.log("Cleaning up any existing Chrome processes...");
    require("child_process").execSync("pkill -9 chrome || true");

    // Wait a moment to let processes terminate
    setTimeout(() => {
      console.log("Chrome cleanup completed");
    }, 2000);
  } catch (error) {
    console.log("Chrome cleanup attempt (non-critical if it fails)");
  }
}

// Basic configuration for WhatsApp client
const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./auth_data",
    clientId: "whatsapp-bot",
  }),
  puppeteer: puppeteerConfig,
  // Longer timeouts for slower environments
  authTimeoutMs: 600000, // 10 minutes
  qrTimeoutMs: 120000, // 2 minutes
  // Disable caching to reduce memory usage
  webVersionCache: {
    type: "none",
  },
  restartOnAuthFail: true,
});

// Enhanced QR code handling for production
whatsappClient.on("qr", (qr) => {
  console.log("\n=== SCAN THIS QR CODE WITH YOUR WHATSAPP ===");

  // In development, show QR in terminal
  if (!isProduction) {
    qrcode.generate(qr, { small: true });
  } else {
    // In production, output the QR code prominently in logs
    console.log("\n\n");
    console.log("=".repeat(80));
    console.log("=".repeat(30) + " WHATSAPP QR CODE " + "=".repeat(30));
    console.log("=".repeat(80));
    console.log(qr); // Print the QR code text for external generators
    console.log("=".repeat(80));
    console.log("SCAN THIS QR CODE WITH YOUR WHATSAPP APP TO AUTHENTICATE");
    console.log(
      "Use an online QR code generator if needed (copy the text above)"
    );
    console.log("=".repeat(80));

    // Also save QR to file for easier access
    try {
      const qrFilePath = path.join(authPath, "latest-qr.txt");
      fs.writeFileSync(qrFilePath, qr);
      console.log(`QR code also saved to ${qrFilePath}`);
    } catch (error) {
      console.error("Failed to write QR code to file:", error.message);
    }
  }
});

// Client ready handler
whatsappClient.on("ready", () => {
  console.log("WhatsApp client is ready and connected");

  // Reset retry counter on successful connection
  initRetries = 0;

  // Clear any stored QR code when ready
  try {
    const qrFilePath = path.join(authPath, "latest-qr.txt");
    if (fs.existsSync(qrFilePath)) {
      fs.unlinkSync(qrFilePath);
      console.log("Cleared saved QR code");
    }
  } catch (error) {
    console.error("Error clearing QR code file:", error.message);
  }
});

// Authentication event
whatsappClient.on("authenticated", () => {
  console.log("WhatsApp client authenticated successfully");
});

// Handle authentication failure
whatsappClient.on("auth_failure", (msg) => {
  console.error(`Authentication failure: ${msg}`);
  console.log("You may need to rescan the QR code.");

  // Force clean auth data on failure
  try {
    console.log("Clearing auth data due to auth failure");
    if (fs.existsSync(authPath)) {
      fs.readdirSync(authPath).forEach((file) => {
        if (file !== ".gitkeep") {
          try {
            const filePath = path.join(authPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`Error removing ${file}:`, error.message);
          }
        }
      });
    }
  } catch (error) {
    console.error("Error clearing auth data:", error.message);
  }
});

// Disconnection event with enhanced reconnection
whatsappClient.on("disconnected", (reason) => {
  console.log(`WhatsApp client disconnected: ${reason}`);
  console.log("Attempting to reconnect...");

  // Wait a bit then try to reconnect
  setTimeout(() => {
    console.log("Reinitializing client...");
    // Reset initialization flag
    isInitializing = false;
    initialize().catch((err) => {
      console.error("Failed to reinitialize:", err);
    });
  }, 5000);
});

// Simplified initialization approach
const initialize = async () => {
  // Prevent multiple simultaneous initialization attempts
  if (isInitializing) {
    console.log("Initialization already in progress, skipping duplicate call");
    return false;
  }

  isInitializing = true;

  // Check if we've exceeded max retries
  if (initRetries >= MAX_RETRIES) {
    console.log(
      `Maximum retries (${MAX_RETRIES}) exceeded. Waiting for manual restart.`
    );
    isInitializing = false;
    return false;
  }

  initRetries++;
  console.log(`Initialization attempt ${initRetries} of ${MAX_RETRIES}`);

  try {
    // If we have global gc, run it to free up memory
    if (global.gc) {
      console.log("Running garbage collection");
      global.gc();
    }

    // Wait a moment to let Chrome processes fully terminate
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Use a safer approach to initialization with longer timeouts
    const timeoutMs = 300000; // 5 minutes
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

    console.log("WhatsApp client initialization completed successfully");
    isInitializing = false;
    return true;
  } catch (error) {
    console.error(`WhatsApp client initialization failed: ${error.message}`);

    // More specific error handling
    if (
      error.message.includes("Session closed") ||
      error.message.includes("page has been closed")
    ) {
      console.log(
        "Browser session was closed - likely due to memory constraints"
      );

      // Higher retry delay when we hit this error
      const retryDelay = 10000 + initRetries * 5000;
      console.log(`Will retry in ${retryDelay / 1000} seconds...`);

      // Clean up Chrome processes
      if (isProduction) {
        try {
          console.log("Cleaning up Chrome processes before retry");
          require("child_process").execSync("pkill -9 chrome || true");
        } catch (e) {
          console.log("Chrome cleanup attempt (non-critical if it fails)");
        }
      }

      setTimeout(async () => {
        isInitializing = false;
        await initialize();
      }, retryDelay);
    } else if (error.message.includes("timeout")) {
      console.log(
        "Initialization timed out - your server might have limited resources"
      );

      // Still try to recover with a longer delay
      setTimeout(async () => {
        isInitializing = false;
        await initialize();
      }, 15000);
    } else {
      // General retry for other errors
      setTimeout(async () => {
        isInitializing = false;
        await initialize();
      }, 5000);
    }

    isInitializing = false;
    return false;
  }
};

// Replace the default initialize method with our custom one
whatsappClient.initialize = initialize;

// The single endpoint to send a message
app.post("/send-message", async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide both 'number' and 'message' in the request body",
      });
    }

    // Format the number correctly for WhatsApp
    const formattedNumber = number.includes("@c.us")
      ? number
      : `${number.replace(/[^\d]/g, "")}@c.us`;

    // Check if client is ready
    if (!whatsappClient.info) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first.",
        initializationStatus: {
          isInitializing: isInitializing,
          currentRetry: initRetries,
          maxRetries: MAX_RETRIES,
        },
      });
    }

    // Send the message
    const response = await whatsappClient.sendMessage(formattedNumber, message);

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      messageId: response.id,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

// Health check endpoint with more details
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    whatsappConnected: !!whatsappClient.info,
    uptime: process.uptime(),
    environment: isProduction ? "production" : "development",
    timestamp: new Date().toISOString(),
    qrCodeAvailable: fs.existsSync(path.join(authPath, "latest-qr.txt")),
    initializationStatus: {
      isInitializing: isInitializing,
      currentRetry: initRetries,
      maxRetries: MAX_RETRIES,
    },
    memory: {
      heapTotal: `${Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024
      )} MB`,
      heapUsed: `${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )} MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    },
  });
});

// Add a force reconnect endpoint
app.post("/force-reconnect", async (req, res) => {
  console.log("Manual reconnection requested");

  try {
    // If browser exists, try to close it
    if (whatsappClient.pupBrowser) {
      try {
        await whatsappClient.pupBrowser.close();
        console.log("Closed existing browser");
      } catch (error) {
        console.error("Error closing browser:", error.message);
      }
    }

    // Clean up Chrome processes
    if (isProduction) {
      try {
        console.log("Cleaning up Chrome processes");
        require("child_process").execSync("pkill -9 chrome || true");
      } catch (error) {
        console.log("Chrome cleanup attempt (non-critical if it fails)");
      }
    }

    // Clear auth data
    console.log("Clearing auth data for fresh start");
    try {
      if (fs.existsSync(authPath)) {
        fs.readdirSync(authPath).forEach((file) => {
          if (file !== ".gitkeep") {
            try {
              const filePath = path.join(authPath, file);
              if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
              console.log(`Removed ${filePath}`);
            } catch (removeErr) {
              console.error(`Error removing ${file}:`, removeErr.message);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error clearing auth data:", error.message);
    }

    // Reset flags
    isInitializing = false;
    initRetries = 0;

    // Wait a moment before reinitializing
    setTimeout(() => {
      // Reinitialize
      console.log("Reinitializing WhatsApp client");
      initialize()
        .then(() => console.log("Reinitialization started"))
        .catch((err) =>
          console.error("Error during reinitialization:", err.message)
        );
    }, 3000);

    res.status(200).json({
      success: true,
      message: "Reconnection process started. Check logs for QR code.",
    });
  } catch (error) {
    console.error("Error during force reconnect:", error);
    res.status(500).json({
      success: false,
      message: "Error during reconnection process",
      error: error.message,
    });
  }
});

// Initialize client
console.log("Initializing WhatsApp client...");
initialize().catch((err) => {
  console.error("Failed to initialize WhatsApp client:", err);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Simple WhatsApp Connector running on port ${PORT}`);
  console.log(`Local URL: http://localhost:${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`Public URL: ${process.env.RENDER_EXTERNAL_URL}`);
  }
});
