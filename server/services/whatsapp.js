/**
 * DEPRECATED: WhatsApp Business API Service
 * This module is deprecated. Use sms.service.js with Twilio instead.
 * 
 * Migration guide:
 * - Replace sendAlertViaWhatsApp with sendAlertSMS from sms.service.js
 * - SMS notifications are now handled by Twilio
 * - All HIGH severity alerts trigger SMS notifications
 */

const axios = require('axios');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * @deprecated Use Twilio SMS service instead
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  console.warn('⚠️ DEPRECATED: sendWhatsAppMessage is no longer used. Use Twilio SMS service instead.');
  
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp credentials not configured');
    return null;
  }

  try {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message },
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('WhatsApp error:', error.message);
    throw error;
  }
}

/**
 * @deprecated Use sendAlertSMS from sms.service.js instead
 */
async function sendAlertViaWhatsApp(phoneNumber, alert) {
  console.warn('⚠️ DEPRECATED: sendAlertViaWhatsApp is no longer used. Use sendAlertSMS from sms.service.js instead.');
  
  const message = `🚨 BabyCare Alert (${alert.severity.toUpperCase()})\n\n` +
    `${alert.name || alert.title}\n\n` +
    `${alert.description}\n\n` +
    `This is an automated alert from CareNest. Please review your baby's care logs.`;

  return sendWhatsAppMessage(phoneNumber, message);
}

/**
 * @deprecated Use getUserPhoneNumber from sms.service.js instead
 */
async function getUserPhoneNumber(userId) {
  console.warn('⚠️ DEPRECATED: This function is moved to sms.service.js');
  
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

