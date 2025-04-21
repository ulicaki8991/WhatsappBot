const express = require("express");
const path = require("path");
const messageRouter = require("./routes/messageRouter");
const whatsappClient = require("./services/WhatsppClient");

console.log("===========================================");
console.log("Starting WhatsApp Bot service...");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log("===========================================");

// Add unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Add uncaught exception handler
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Initialize WhatsApp client
whatsappClient
  .initialize()
  .then((success) => {
    if (success) {
      console.log("WhatsApp client initialized successfully");
    } else {
      console.warn("WhatsApp client initialization completed with issues");
    }
  })
  .catch((err) => {
    console.error("Error initializing WhatsApp client:", err);
  });

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Add detailed logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Started`
  );

  // Add response logging
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${
        res.statusCode
      } (${duration}ms)`
    );
  });

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

// Enhanced health check endpoint for Render
app.get("/health", (req, res) => {
  const clientInfo = whatsappClient.info;
  const isAuthenticated = whatsappClient.authStrategy?.isAuthenticated;
  const isReady =
    clientInfo && whatsappClient.pupPage && whatsappClient.pupBrowser;

  let clientStatus = "Initializing";

  if (isReady) {
    clientStatus = "Connected";
  } else if (isAuthenticated) {
    clientStatus = "Authenticated but not ready";
  } else if (!clientInfo && process.uptime() > 60) {
    clientStatus = "Not authenticated";
  }

  // Check if we need authentication
  const needsAuth = !isAuthenticated && process.uptime() > 60;

  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    whatsapp: {
      status: clientStatus,
      connectedAt: clientInfo
        ? new Date(clientInfo.lastConnect).toISOString()
        : null,
      needsAuthentication: needsAuth,
      isAuthenticated: isAuthenticated,
      isFullyReady: isReady,
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
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
