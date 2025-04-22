const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// Check if we're in production (Render.com)
const isProduction =
  process.env.NODE_ENV === "production" || process.env.RENDER === "true";

console.log(`Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);

// Create Express app
const app = express();
app.use(express.json());

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

// Enhanced configuration for Render.com compatibility
const puppeteerConfig = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process", // This helps on Render's free tier
    "--disable-gpu",
    "--disable-extensions",
  ],
  // Important for Render.com
  executablePath: isProduction ? "/usr/bin/google-chrome-stable" : undefined,
  // Increased timeout for slower environments like Render
  timeout: 120000,
};

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
});

// Disconnection event with enhanced reconnection
whatsappClient.on("disconnected", (reason) => {
  console.log(`WhatsApp client disconnected: ${reason}`);
  console.log("Attempting to reconnect...");

  // Wait a bit then try to reconnect
  setTimeout(() => {
    console.log("Reinitializing client...");
    whatsappClient.initialize().catch((err) => {
      console.error("Failed to reinitialize:", err);
    });
  }, 5000);
});

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

    // Reinitialize
    console.log("Reinitializing WhatsApp client");
    whatsappClient
      .initialize()
      .then(() => console.log("Reinitialization started"))
      .catch((err) =>
        console.error("Error during reinitialization:", err.message)
      );

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
whatsappClient.initialize().catch((err) => {
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
