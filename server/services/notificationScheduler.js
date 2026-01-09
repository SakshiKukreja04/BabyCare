const { db, admin } = require('../firebaseAdmin');
const { sendPushNotification } = require('./fcm');
const { sendWhatsAppMessage } = require('./whatsapp');
const { updateReminderStatus } = require('./reminders');

/**
 * Notification Service
 * Sends reminders via FCM (web) and WhatsApp
 */

/**
 * Send reminder notification via all configured channels
 * @param {Object} reminder - Reminder object
 * @returns {Promise<Object>} Send status for each channel
 */
async function sendReminderNotification(reminder) {
  const status = {
    web: { success: false, messageId: null, error: null },
    whatsapp: { success: false, messageId: null, error: null },
  };

  try {
    // Fetch parent user details (for phone number and FCM token)
    const parentRef = db.collection('users').doc(reminder.parentId);
    const parentDoc = await parentRef.get();

    if (!parentDoc.exists) {
      throw new Error(`Parent user ${reminder.parentId} not found`);
    }

    const parentData = parentDoc.data();
    const fcmToken = parentData.fcmToken;
    const phoneNumber = parentData.phoneNumber;

    // Send Web Notification (FCM)
    if (reminder.channels.includes('web') || reminder.channels.includes('both')) {
      status.web = await sendWebReminder(reminder, fcmToken);
    }

    // Send WhatsApp Notification
    if (reminder.channels.includes('whatsapp') || reminder.channels.includes('both')) {
      status.whatsapp = await sendWhatsAppReminder(reminder, phoneNumber);
    }

    // Update reminder status based on results
    const allSucceeded = status.web.success && status.whatsapp.success;
    const anyFailed = !status.web.success || !status.whatsapp.success;

    if (allSucceeded) {
      // All channels succeeded
      await updateReminderStatus(reminder.id, 'sent');
      console.log(`✅ [Notification] Reminder sent successfully
        ├─ ID: ${reminder.id}
        ├─ Medicine: ${reminder.medicine_name}
        ├─ Web: Success (${status.web.messageId})
        ├─ WhatsApp: Success (${status.whatsapp.messageId})
        └─ Status: SENT`);
    } else if (status.web.success) {
      // At least web notification succeeded, mark as sent
      await updateReminderStatus(reminder.id, 'sent');
      console.log(`✅ [Notification] Reminder sent (web only)
        ├─ ID: ${reminder.id}
        ├─ Medicine: ${reminder.medicine_name}
        ├─ Web: Success (${status.web.messageId})
        ├─ WhatsApp: ${status.whatsapp.error || 'Not sent'}
        └─ Status: SENT`);
    } else {
      // All failed or only partial success
      const errorMsg = Object.entries(status)
        .filter(([, result]) => !result.success)
        .map(([channel, result]) => `${channel}: ${result.error}`)
        .join('; ');
      
      await updateReminderStatus(reminder.id, 'failed', errorMsg);
      console.log(`❌ [Notification] Reminder failed
        ├─ ID: ${reminder.id}
        ├─ Medicine: ${reminder.medicine_name}
        ├─ Web: ${status.web.error || 'Failed'}
        ├─ WhatsApp: ${status.whatsapp.error || 'Failed'}
        └─ Status: FAILED`);
    }

    return status;
  } catch (error) {
    console.error('❌ [Notifications] Error sending reminder:', error.message);
    await updateReminderStatus(reminder.id, 'failed', error.message);
    return {
      web: { success: false, error: error.message },
      whatsapp: { success: false, error: error.message },
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
 * Send WhatsApp reminder notification
 * @param {Object} reminder - Reminder object
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object>} Send status
 */
async function sendWhatsAppReminder(reminder, phoneNumber) {
  try {
    if (!phoneNumber) {
      return { success: false, error: 'No phone number available' };
    }

    const message = `👶 *BabyCare Reminder*

It's time to give *${reminder.medicine_name}* (${reminder.dosage}).

Frequency: ${reminder.frequency}

You're doing great! ❤️

_BabyCare - Your Baby's Health, Our Priority_`;

    const response = await sendWhatsAppMessage(phoneNumber, message);

    if (response && response.messages && response.messages[0]) {
      const messageId = response.messages[0].id;
      console.log(`✅ [WhatsApp] Notification sent
        ├─ Message ID: ${messageId}
        ├─ Reminder: ${reminder.id}
        ├─ Medicine: ${reminder.medicine_name}
        ├─ To: ${phoneNumber}
        └─ Timestamp: ${new Date().toISOString()}`);
      return { success: true, messageId };
    }

    return { success: false, error: 'Invalid WhatsApp response' };
  } catch (error) {
    console.error('❌ [WhatsApp] Error sending reminder notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Batch send all pending reminders (called by scheduler)
 * @returns {Promise<Object>} Summary of sent reminders
 */
async function processPendingReminders() {
  try {
    const { getPendingReminders } = require('./reminders');
    const pendingReminders = await getPendingReminders();

    if (pendingReminders.length === 0) {
      console.log('📭 [Scheduler] No pending reminders');
      return { total: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const result = await sendReminderNotification(reminder);
        
        // Consider it sent if at least web notification succeeded
        if (result.web.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ [Scheduler] Failed to process reminder ${reminder.id}:`, error.message);
        failed++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ [Scheduler] Batch processing complete
      ├─ Total reminders: ${pendingReminders.length}
      ├─ Successfully sent: ${sent}
      ├─ Failed: ${failed}
      └─ Success rate: ${sent > 0 ? Math.round((sent / pendingReminders.length) * 100) : 0}%`);
    return {
      total: pendingReminders.length,
      sent,
      failed,
    };
  } catch (error) {
    console.error('❌ [Scheduler] Error processing reminders:', error.message);
    return { total: 0, sent: 0, failed: 0 };
  }
}

module.exports = {
  sendReminderNotification,
  sendWebReminder,
  sendWhatsAppReminder,
  processPendingReminders,
};
