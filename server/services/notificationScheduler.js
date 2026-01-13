const { db, admin } = require('../firebaseAdmin');
const { sendPushNotification } = require('./fcm');
const { sendSMS } = require('./sms.service');
const { updateReminderStatus } = require('./reminders');

/**
 * Notification Service
 * Sends reminders via FCM (web) and Twilio SMS (for HIGH priority)
 * 
 * OPTIMIZED:
 * - Defensive coding for undefined responses
 * - Quota error handling (code 8)
 * - Single log per batch
 */

/**
 * Send reminder notification via all configured channels
 * @param {Object} reminder - Reminder object
 * @returns {Promise<Object>} Send status for each channel
 */
async function sendReminderNotification(reminder) {
  // Defensive: validate reminder object
  if (!reminder || !reminder.id) {
    console.warn('⚠️ [Notification] Invalid reminder object received');
    return {
      web: { success: false, error: 'Invalid reminder' },
      sms: { success: false, error: 'Invalid reminder' },
    };
  }

  const status = {
    web: { success: false, messageId: null, error: null },
    sms: { success: false, messageId: null, error: null },
  };

  try {
    // Fetch parent user details (for phone number and FCM token)
    const parentRef = db.collection('users').doc(reminder.parentId);
    const parentDoc = await parentRef.get();

    if (!parentDoc.exists) {
      console.warn(`⚠️ [Notification] Parent user ${reminder.parentId} not found`);
      await updateReminderStatus(reminder.id, 'failed', 'Parent not found');
      return {
        web: { success: false, error: 'Parent not found' },
        sms: { success: false, error: 'Parent not found' },
      };
    }

    const parentData = parentDoc.data() || {};
    const fcmToken = parentData.fcmToken;
    const phoneNumber = parentData.phoneNumber;

    // Defensive: ensure channels is an array
    const channels = Array.isArray(reminder.channels) ? reminder.channels : ['web'];

    // Send Web Notification (FCM)
    if (channels.includes('web') || channels.includes('both')) {
      status.web = await sendWebReminder(reminder, fcmToken);
    }

    // Send SMS Notification (Twilio)
    if (channels.includes('sms') || channels.includes('both')) {
      status.sms = await sendSMSReminder(reminder, phoneNumber);
    }

    // Update reminder status based on results
    const webSuccess = status.web.success;
    const smsSuccess = status.sms.success;

    if (webSuccess || smsSuccess) {
      // At least one channel succeeded
      await updateReminderStatus(reminder.id, 'sent');
    } else {
      // All failed
      const errorMsg = [
        status.web.error ? `web: ${status.web.error}` : null,
        status.sms.error ? `sms: ${status.sms.error}` : null,
      ].filter(Boolean).join('; ');
      
      await updateReminderStatus(reminder.id, 'failed', errorMsg || 'All channels failed');
    }

    return status;
  } catch (error) {
    // Handle Firestore quota errors
    if (error.code === 8) {
      console.warn(`⚠️ [Notification] Quota exceeded for reminder ${reminder.id}`);
      return {
        web: { success: false, error: 'Quota exceeded' },
        sms: { success: false, error: 'Quota exceeded' },
      };
    }
    
    console.error('❌ [Notifications] Error sending reminder:', error.message);
    
    try {
      await updateReminderStatus(reminder.id, 'failed', error.message);
    } catch (updateError) {
      // Ignore update errors in catch block
    }
    
    return {
      web: { success: false, error: error.message },
      sms: { success: false, error: error.message },
    };
  }
}

/**
 * Send web/FCM reminder notification
 * @param {Object} reminder - Reminder object
 * @param {string} fcmToken - FCM token
 * @returns {Promise<Object>} Send status
 */
async function sendWebReminder(reminder, fcmToken) {
  try {
    if (!fcmToken) {
      return { success: false, error: 'No FCM token available' };
    }

    const notification = {
      title: '💊 Medicine Reminder',
      body: `Time to give ${reminder.medicine_name} (${reminder.dosage})`,
    };

    const data = {
      type: 'reminder',
      reminderId: reminder.id,
      babyId: reminder.babyId,
      medicine_name: reminder.medicine_name,
      dosage: reminder.dosage,
      frequency: reminder.frequency,
    };

    const message = {
      token: fcmToken,
      notification,
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {}),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
      },
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `reminder-${reminder.babyId}`,
          requireInteraction: true,
        },
        fcmOptions: {
          link: '/dashboard',
        },
      },
    };

    const messageId = await admin.messaging().send(message);
    console.log(`✅ [FCM] Web notification sent
      ├─ Message ID: ${messageId}
      ├─ Reminder: ${reminder.id}
      ├─ Medicine: ${reminder.medicine_name}
      ├─ To: ${fcmToken.substring(0, 20)}...
      └─ Timestamp: ${new Date().toISOString()}`);

    return { success: true, messageId };
  } catch (error) {
    console.error('❌ [FCM] Error sending reminder notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send SMS reminder notification via Twilio
 * @param {Object} reminder - Reminder object
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object>} Send status
 */
async function sendSMSReminder(reminder, phoneNumber) {
  try {
    if (!phoneNumber) {
      console.warn('⚠️ [SMS] No phone number available for parent, skipping SMS');
      return { success: false, error: 'No phone number available' };
    }

    const message = `🍼 CareNest Medication Reminder\n\nTime to give ${reminder.medicine_name} (${reminder.dosage})\nFrequency: ${reminder.frequency}\n\nYou're doing great! ❤️`;

    const result = await sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`✅ [SMS] Medication reminder sent successfully
        ├─ SID: ${result.sid}
        ├─ To: ${phoneNumber}
        ├─ Medicine: ${reminder.medicine_name}
        ├─ Reminder ID: ${reminder.id}
        └─ Timestamp: ${new Date().toISOString()}`);
      return { success: true, messageId: result.sid };
    } else {
      console.warn(`⚠️ [SMS] Failed to send reminder
        ├─ Phone: ${phoneNumber}
        ├─ Error: ${result.error}
        └─ Medicine: ${reminder.medicine_name}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ [SMS] Error sending reminder notification:', error.message);
    return { success: false, error: error.message };
  }
}


/**
 * Batch send all pending reminders (called by scheduler)
 * OPTIMIZED: Uses efficient query with limit, single log per batch
 * @param {number} limit - Maximum reminders to process per cycle
 * @returns {Promise<Object>} Summary of sent reminders
 */
async function processPendingReminders(limit = 20) {
  const cycleStart = Date.now();
  
  try {
    const { getPendingReminders } = require('./reminders');
    const pendingReminders = await getPendingReminders(limit);

    // Defensive: guard against non-array responses
    if (!pendingReminders || !Array.isArray(pendingReminders)) {
      console.warn('⚠️ [Scheduler] getPendingReminders returned invalid data');
      return { total: 0, sent: 0, failed: 0, durationMs: Date.now() - cycleStart };
    }

    if (pendingReminders.length === 0) {
      // No log for empty cycles to reduce noise
      return { total: 0, sent: 0, failed: 0, durationMs: Date.now() - cycleStart };
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const result = await sendReminderNotification(reminder);
        
        // Consider it sent if at least web notification succeeded
        if (result.web?.success || result.sms?.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        // Handle quota errors gracefully
        if (error.code === 8) {
          console.warn(`⚠️ [Scheduler] Quota exceeded, stopping batch processing`);
          break;
        }
        console.error(`❌ [Scheduler] Failed to process reminder ${reminder.id}:`, error.message);
        failed++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const durationMs = Date.now() - cycleStart;
    
    // Single summary log for the batch
    console.log(`✅ [Scheduler] Batch complete: ${sent}/${pendingReminders.length} sent, ${failed} failed (${durationMs}ms)`);
    
    return {
      total: pendingReminders.length,
      sent,
      failed,
      durationMs,
    };
  } catch (error) {
    // Handle Firestore quota errors (code 8) without crashing
    if (error.code === 8) {
      console.warn('⚠️ [Scheduler] Firestore quota exceeded, skipping cycle');
      return { total: 0, sent: 0, failed: 0, durationMs: Date.now() - cycleStart, skipped: true };
    }
    
    console.error('❌ [Scheduler] Error processing reminders:', error.message);
    return { total: 0, sent: 0, failed: 0, durationMs: Date.now() - cycleStart, error: error.message };
  }
}

module.exports = {
  sendReminderNotification,
  sendWebReminder,
  sendSMSReminder,
  processPendingReminders,
};
