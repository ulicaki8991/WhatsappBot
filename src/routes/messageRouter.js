const express = require("express");
const whatsappClient = require("../services/WhatsppClient");
const messageTemplates = require("../services/MessageTemplates");

const router = new express.Router();

router.get("/", (req, res) => {
  res.send("WhatsApp Bot API is running");
});

// Endpoint to send a message
router.post("/send-message", async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide both 'number' and 'message' in the request body",
      });
    }

    // Format the number (ensure it has the correct format with country code)
    const formattedNumber = number.includes("@c.us")
      ? number
      : `${number.replace(/[^\d]/g, "")}@c.us`;

    // Send the message
    const response = await whatsappClient.sendMessage(formattedNumber, message);

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: response,
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

// New endpoint to send price notification
router.post("/send-price-notification", async (req, res) => {
  try {
    const {
      number,
      price,
      currency = "$",
      templateType = "priceNotification",
      customTemplate,
    } = req.body;

    if (!number || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Please provide both 'number' and 'price' in the request body",
      });
    }

    // Check if WhatsApp client is ready before proceeding - with safer checks
    const clientInfo = whatsappClient.info;

    // Safely check if browser components exist
    let pupPageExists = false;
    let pupBrowserExists = false;
    try {
      pupPageExists = !!whatsappClient.pupPage;
      pupBrowserExists = !!whatsappClient.pupBrowser;
    } catch (e) {
      console.error("Error checking WhatsApp client browser status:", e);
    }

    const isReady = clientInfo && pupPageExists && pupBrowserExists;

    // Safely check if authenticated
    let isAuthenticated = false;
    try {
      isAuthenticated = !!whatsappClient.authStrategy?.isAuthenticated;
    } catch (e) {
      console.error("Error checking authentication status:", e);
    }

    // If not ready, check if we're in a reconnection state
    if (!isReady) {
      console.error("WhatsApp client is not ready. Cannot send message.");

      // Check if we're in the process of reconnecting
      const isInitializing = !!global.isInitializing; // Access global flag if available

      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not fully connected. Try again later.",
        details: {
          clientInfo: !!clientInfo,
          authenticated: isAuthenticated,
          browserReady: pupPageExists && pupBrowserExists,
          isInitializing: isInitializing,
          uptime: process.uptime(),
        },
      });
    }

    // Format the number (ensure it has the correct format with country code)
    const formattedNumber = number.includes("@c.us")
      ? number
      : `${number.replace(/[^\d]/g, "")}@c.us`;

    // Generate the message with the price using the appropriate template
    let message;

    if (templateType === "custom" && customTemplate) {
      message = messageTemplates.custom(price, customTemplate, currency);
    } else if (templateType === "paymentConfirmation") {
      message = messageTemplates.paymentConfirmation(price, currency);
    } else {
      // Default to price notification
      message = messageTemplates.priceNotification(price, currency);
    }

    console.log(
      `Attempting to send message to ${formattedNumber}: ${message.substring(
        0,
        30
      )}...`
    );

    // Send the message with retry
    let response;
    try {
      response = await whatsappClient.sendMessage(formattedNumber, message);
    } catch (messageError) {
      console.error("First message attempt failed:", messageError.message);

      // If the error indicates the client isn't ready, try to check readiness again
      if (
        messageError.message.includes("client is not ready") ||
        messageError.message.includes("page") ||
        messageError.message.includes("browser")
      ) {
        // Wait a moment and retry the readiness check
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Re-check if client is now ready
        const isReadyNow =
          whatsappClient.info &&
          whatsappClient.pupPage &&
          whatsappClient.pupBrowser;

        if (!isReadyNow) {
          throw new Error("WhatsApp client is still not ready after retry");
        }

        // Try again
        response = await whatsappClient.sendMessage(formattedNumber, message);
      } else {
        // For other errors, re-throw
        throw messageError;
      }
    }

    console.log(`Message sent successfully with ID: ${response.id}`);

    res.status(200).json({
      success: true,
      message: "Price notification sent successfully",
      data: {
        to: number,
        price: typeof price === "number" ? price.toFixed(2) : price,
        messageId: response.id,
        template: templateType,
      },
    });
  } catch (error) {
    console.error("Error sending price notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send price notification",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Get connection status
router.get("/status", (req, res) => {
  // More comprehensive status check
  const clientInfo = whatsappClient.info;
  const isReady =
    whatsappClient.pupPage && whatsappClient.pupBrowser && clientInfo;

  const status = isReady ? "Connected" : "Not connected";

  // Safely get the authentication status
  let isAuthenticated = false;
  try {
    isAuthenticated = !!whatsappClient.authStrategy?.isAuthenticated;
  } catch (e) {
    console.error("Error checking authentication status:", e);
  }

  // Safely get the last connection time
  let lastConnect = null;
  try {
    if (clientInfo && clientInfo.lastConnect) {
      const connectTime = new Date(clientInfo.lastConnect);
      if (!isNaN(connectTime.getTime())) {
        lastConnect = connectTime.toISOString();
      }
    }
  } catch (e) {
    console.error("Error formatting connection timestamp:", e);
  }

  // Include more detailed status information to help with debugging
  res.status(200).json({
    status,
    details: {
      clientInfo: !!clientInfo,
      authenticated: isAuthenticated,
      lastConnect: lastConnect,
      serverUptime: process.uptime(),
      browserReady: !!(whatsappClient.pupPage && whatsappClient.pupBrowser),
    },
  });
});

module.exports = router;
