const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// Determine if we're in production (Render.com) or development
const isProduction = process.env.NODE_ENV === "production";

console.log(`Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);

// Configure WhatsApp client with appropriate settings for environment
const whatsappClient = new Client({
  authStrategy: new LocalAuth({ dataPath: "./auth_data" }),
  puppeteer: {
    headless: true, // Always use headless mode in Render.com
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
    ],
    timeout: 120000, // Increase timeout to 120 seconds for slower environments
    executablePath: isProduction ? "/usr/bin/google-chrome-stable" : undefined,
  },
});

// Log QR code to terminal and save to a file for remote access
whatsappClient.on("qr", (qr) => {
  // Generate QR in terminal for local development
  qrcode.generate(qr, { small: true });

  // For production environment, log QR code clearly
  console.log("\n\n--------- WHATSAPP QR CODE START ---------");
  console.log(qr);
  console.log("---------- WHATSAPP QR CODE END ----------\n\n");

  // Additional logging for troubleshooting
  console.log(`QR Code received at: ${new Date().toISOString()}`);
});

whatsappClient.on("ready", () => {
  console.log("WhatsApp client is ready!");
  console.log(`Connected at: ${new Date().toISOString()}`);
});

whatsappClient.on("authenticated", () => {
  console.log("WhatsApp client authenticated successfully");
});

whatsappClient.on("auth_failure", (msg) => {
  console.error("WhatsApp authentication failure:", msg);
  console.log("You may need to scan the QR code again.");
});

whatsappClient.on("disconnected", (reason) => {
  console.log("WhatsApp client disconnected:", reason);
  console.log("Attempting to reconnect...");

  // Try to reconnect after a short delay
  setTimeout(() => {
    whatsappClient.initialize().catch((err) => {
      console.error("Failed to reinitialize WhatsApp client:", err);
    });
  }, 5000);
});

whatsappClient.on("message", async (msg) => {
  try {
    if (msg.from != "status@broadcast") {
      const contact = await msg.getContact();
      console.log(
        `Message from ${contact.pushname || contact.number}: ${msg.body}`
      );
    }
  } catch (error) {
    console.log("Error handling incoming message:", error);
  }
});

// Add initialization error handling
const initialize = async () => {
  try {
    console.log("Initializing WhatsApp client...");
    await whatsappClient.initialize();
    return true;
  } catch (error) {
    console.error("Error initializing WhatsApp client:", error);
    return false;
  }
};

whatsappClient.initialize = initialize;

module.exports = whatsappClient;
