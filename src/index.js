const express = require("express");
const path = require("path");
const messageRouter = require("./routes/messageRouter");
const whatsappClient = require("./services/WhatsppClient");

console.log("Starting WhatsApp Bot service...");

// Initialize WhatsApp client
whatsappClient
  .initialize()
  .then(() => {
    console.log("WhatsApp client initialized successfully");
  })
  .catch((err) => {
    console.error("Error initializing WhatsApp client:", err);
  });

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Add basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use("/api", messageRouter);

// For backwards compatibility
app.use(messageRouter);

// Serve the main HTML file at the root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  const clientStatus = whatsappClient.info ? "Connected" : "Initializing";
  res.status(200).json({
    status: "OK",
    whatsapp: clientStatus,
    timestamp: new Date().toISOString(),
  });
});

// Get port from environment variable for cloud platforms
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local URL: http://localhost:${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`Public URL: ${process.env.RENDER_EXTERNAL_URL}`);
  }
});
