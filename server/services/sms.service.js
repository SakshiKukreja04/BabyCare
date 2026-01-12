const twilio = require('twilio');
const { db } = require('../firebaseAdmin');

/**
 * Twilio SMS Service
 * Sends SMS alerts via Twilio
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Get user phone number from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Phone number or null
 */
async function getUserPhoneNumber(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().phoneNumber || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user phone number:', error);
    return null;
  }
}

/**
 * Send SMS message via Twilio
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., +919876543210)
 * @param {string} message - Message text
 * @returns {Promise<Object>} SMS send result
 */
async function sendSMS(phoneNumber, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ [SMS] Twilio credentials not configured, skipping SMS notification');
    return {
      success: false,
      error: 'Twilio credentials not configured',
    };
  }

  try {
    if (!phoneNumber) {
      console.warn('⚠️ [SMS] No phone number provided');
      return {
        success: false,
        error: 'No phone number provided',
      };
    }

    const client = getTwilioClient();
    if (!client) {
      console.warn('⚠️ [SMS] Failed to initialize Twilio client');
      return {
        success: false,
        error: 'Failed to initialize Twilio client',
      };
    }

    console.log(`📱 [SMS] Sending SMS to ${phoneNumber}...`);
    const result = await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      body: message,
    });

    console.log(`✅ [SMS] SMS sent successfully
      ├─ To: ${phoneNumber}
      ├─ SID: ${result.sid}
      ├─ Status: ${result.status}
      ├─ Message Length: ${message.length} chars
      └─ Timestamp: ${new Date().toISOString()}`);
    
    return {
      success: true,
      sid: result.sid,
      messageSid: result.sid,
      to: result.to,
      status: result.status,
    };
  } catch (error) {
    console.error(`❌ [SMS] Error sending SMS to ${phoneNumber}:
      ├─ Error: ${error.message}
      ├─ Code: ${error.code}
      └─ Timestamp: ${new Date().toISOString()}`);
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      to: phoneNumber,
    };
  }
}

/**
 * Send medication reminder SMS
 * @param {string} phoneNumber - Recipient phone number
 * @param {Object} medicationData - Medication details
 * @param {string} medicationData.medicineName - Name of medicine
 * @param {string} medicationData.dosage - Dosage
 * @param {string} medicationData.time - Scheduled time
 * @returns {Promise<Object>} SMS result
 */
async function sendMedicationReminderSMS(phoneNumber, medicationData) {
  const { medicineName, dosage, time } = medicationData;
  const message = `CareNest Reminder 💊\nGive ${medicineName} (${dosage}) now.\nScheduled at ${time}.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Send feeding alert SMS
 * @param {string} phoneNumber - Recipient phone number
 * @param {Object} alertData - Alert details
 * @param {string} alertData.babyName - Baby name
 * @returns {Promise<Object>} SMS result
 */
async function sendFeedingAlertSMS(phoneNumber, alertData) {
  const { babyName } = alertData;
  const message = `CareNest Alert 🍼\nFeeding overdue for ${babyName}.\nPlease feed the baby.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Send sleep reminder SMS
 * @param {string} phoneNumber - Recipient phone number
 * @returns {Promise<Object>} SMS result
 */
async function sendSleepReminderSMS(phoneNumber) {
  const message = `CareNest Reminder 😴\nSleep routine pending.\nBaby may be tired.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Send alert SMS based on severity
 * @param {string} phoneNumber - Recipient phone number
 * @param {Object} alert - Alert object
 * @returns {Promise<Object>} SMS result
 */
async function sendAlertSMS(phoneNumber, alert) {
  // Only send SMS for HIGH severity alerts
  if (alert.severity !== 'HIGH') {
    return {
      success: false,
      message: `Alert severity ${alert.severity} does not qualify for SMS (HIGH only)`,
    };
  }

  const message = `CareNest Alert\n${alert.name}\n${alert.description}`;
  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendMedicationReminderSMS,
  sendFeedingAlertSMS,
  sendSleepReminderSMS,
  sendAlertSMS,
  getUserPhoneNumber,
};
