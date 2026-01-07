const axios = require('axios');

/**
 * WhatsApp Business API Service
 * Sends text alerts via WhatsApp
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Send WhatsApp message
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., +919876543210)
 * @param {string} message - Message text
 * @returns {Promise<Object>} API response
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp credentials not configured, skipping WhatsApp notification');
    return null;
  }

  try {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message,
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('WhatsApp message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send alert via WhatsApp
 * @param {string} phoneNumber - Recipient phone number
 * @param {Object} alert - Alert object
 * @returns {Promise<Object>} API response
 */
async function sendAlertViaWhatsApp(phoneNumber, alert) {
  const message = `🚨 BabyCare Alert (${alert.severity.toUpperCase()})\n\n` +
    `${alert.title}\n\n` +
    `${alert.description}\n\n` +
    `This is an automated alert from BabyCare. Please review your baby's care logs.`;

  return sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Get user's phone number from Firestore
 * @param {string} userId - Firebase user ID
 * @returns {Promise<string|null>} Phone number or null
 */
async function getUserPhoneNumber(userId) {
  try {
    const { db } = require('../firebaseAdmin');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    return userData.phoneNumber || null;
  } catch (error) {
    console.error('Error fetching user phone number:', error.message);
    return null;
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendAlertViaWhatsApp,
  getUserPhoneNumber,
};

