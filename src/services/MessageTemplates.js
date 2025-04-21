/**
 * Message template service for WhatsApp messages
 * Contains various templates that can be used for different notification types
 */

const templates = {
  /**
   * Generate a price notification message with the given price
   * @param {number|string} price - The price to include in the message
   * @param {string} currencySymbol - Currency symbol to use (default: $)
   * @returns {string} Formatted message with the price
   */
  priceNotification: (price, currencySymbol = "$") => {
    // Format the price to ensure it displays with 2 decimal places if it's a number
    const formattedPrice = typeof price === "number" ? price.toFixed(2) : price;
    return `Thank you for your purchase! The total price is ${currencySymbol}${formattedPrice}. Please confirm your payment details at your earliest convenience.`;
  },

  /**
   * Generate a payment confirmation message
   * @param {number|string} price - The price that was paid
   * @param {string} currencySymbol - Currency symbol to use (default: $)
   * @returns {string} Formatted payment confirmation message
   */
  paymentConfirmation: (price, currencySymbol = "$") => {
    const formattedPrice = typeof price === "number" ? price.toFixed(2) : price;
    return `Your payment of ${currencySymbol}${formattedPrice} has been successfully processed. Thank you for your business!`;
  },

  /**
   * Generate a custom message with price information
   * @param {number|string} price - The price to include in the message
   * @param {string} messageTemplate - Custom message template with {price} placeholder
   * @param {string} currencySymbol - Currency symbol to use (default: $)
   * @returns {string} Formatted custom message with the price
   */
  custom: (price, messageTemplate, currencySymbol = "$") => {
    const formattedPrice = typeof price === "number" ? price.toFixed(2) : price;
    return messageTemplate.replace(
      "{price}",
      `${currencySymbol}${formattedPrice}`
    );
  },
};

module.exports = templates;
