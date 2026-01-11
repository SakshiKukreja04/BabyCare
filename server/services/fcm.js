const { admin } = require('../firebaseAdmin');

/**
 * Firebase Cloud Messaging (FCM) Service
 * Sends push notifications to user devices
 * 
 * FCM RULES:
 * - Send FCM for HIGH severity alerts ONLY
 * - Send FCM for ALL care reminders
 * - Do NOT send FCM for MEDIUM/LOW alerts
 * 
 * NOTIFICATION TYPES:
 * - feeding: Show feeding amount, threshold, timestamp
 * - sleep: Show total sleep today, recommended hours
 * - medicine: Show medicine name, scheduled time
 */

/**
 * Get type-specific notification content
 * @param {string} alertType - Type of alert (feeding, sleep, medicine)
 * @param {Object} alert - Alert object with triggerData
 * @returns {Object} Notification title and body
 */
function getAlertNotificationContent(alertType, alert) {
  const triggerData = alert.triggerData || {};
  
  switch (alertType) {
    case 'feeding':
      return {
        title: '🍼 Feeding Alert',
        body: triggerData.isCritical 
          ? `⚠️ CRITICAL: Baby has only had ${triggerData.value || 0}ml today. Feed immediately!`
          : `Baby feeding is below minimum (${triggerData.value || 0}ml of ${triggerData.thresholdMl || 150}ml).`,
        metadata: {
          currentAmount: triggerData.value,
          threshold: triggerData.thresholdMl,
          feedCount: triggerData.feedCount,
          isCritical: triggerData.isCritical,
        }
      };
    
    case 'sleep':
      return {
        title: '😴 Sleep Alert',
        body: triggerData.value !== undefined
          ? `Baby has only slept ${triggerData.value}h today (needs ${triggerData.thresholdHours || 10}h minimum).`
          : 'No sleep logged today. Please log baby\'s sleep.',
        metadata: {
          totalSleepToday: triggerData.value,
          threshold: triggerData.thresholdHours,
          sleepCount: triggerData.sleepCount,
        }
      };
    
    case 'medicine':
      return {
        title: '💊 Medicine Reminder',
        body: `Time to give ${triggerData.medicineName || 'medicine'} (scheduled: ${triggerData.scheduledTime || 'now'}).`,
        metadata: {
          medicineName: triggerData.medicineName,
          dosage: triggerData.dosage,
          scheduledTime: triggerData.scheduledTime,
        }
      };
    
    default:
      return {
        title: '👶 Baby Care Alert',
        body: alert.message || alert.description || 'You have a new care alert',
        metadata: {}
      };
  }
}

/**
 * Get type-specific reminder notification content
 * @param {string} reminderType - Type of reminder (feeding, sleep, medicine)
 * @param {Object} reminder - Reminder object
 * @returns {Object} Notification title and body
 */
function getReminderNotificationContent(reminderType, reminder) {
  const triggerData = reminder.triggerData || {};
  
  switch (reminderType) {
    case 'feeding':
      const hoursSinceLastFeed = triggerData.hoursSinceLast || 0;
      return {
        title: '🍼 Feeding Reminder',
        body: `It's been ${hoursSinceLastFeed.toFixed(1)}h since last feeding. Time to feed baby!`,
        metadata: {
          hoursSinceLastFeed,
          lastFeedTime: triggerData.lastFeedTime,
        }
      };
    
    case 'sleep':
      return {
        title: '😴 Sleep Reminder',
        body: triggerData.totalSleepHours !== undefined
          ? `Total sleep today: ${triggerData.totalSleepHours.toFixed(1)}h. Consider logging more rest.`
          : 'No sleep logged today. Please log baby\'s sleep.',
        metadata: {
          totalSleepToday: triggerData.totalSleepHours,
          recommendedHours: 10,
        }
      };
    
    case 'medicine':
      return {
        title: '💊 Medicine Reminder',
        body: `Time to give ${triggerData.medicineName || 'medicine'} (${triggerData.scheduledTime || 'scheduled now'}).`,
        metadata: {
          medicineName: triggerData.medicineName,
          dosage: triggerData.dosage,
          scheduledTime: triggerData.scheduledTime,
        }
      };
    
    default:
      return {
        title: '👶 Baby Care Reminder',
        body: reminder.message || 'You have a care reminder',
        metadata: {}
      };
  }
}

/**
 * Send push notification to a user
 * @param {string} userId - Firebase user ID
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload
 * @returns {Promise<string>} Message ID
 */
async function sendPushNotification(userId, notification, data = {}) {
  try {
    // Get user's FCM token from Firestore
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found`);
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.warn(`No FCM token found for user ${userId}`);
      return null;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title || 'BabyCare Alert',
        body: notification.body || 'You have a new alert',
      },
      data: {
        ...data,
        // Stringify metadata for FCM (only supports string values)
        metadata: JSON.stringify(data.metadata || {}),
        type: data.type || 'alert',
        createdAt: new Date().toISOString(),
      },
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('🔔 FCM notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending FCM notification:', error.message);
    throw error;
  }
}

/**
 * Send alert notification (only for HIGH severity)
 * @param {string} userId - Firebase user ID
 * @param {Object} alert - Alert object
 * @returns {Promise<string>} Message ID
 */
async function sendAlertNotification(userId, alert) {
  const alertType = alert.type || 'feeding';
  const { title, body, metadata } = getAlertNotificationContent(alertType, alert);
  
  const notification = { title, body };

  const data = {
    type: 'alert',
    alertType: alertType,
    alertId: alert.id,
    babyId: alert.babyId,
    severity: alert.severity || 'HIGH',
    ruleId: alert.ruleId,
    metadata: metadata,
    createdAt: new Date().toISOString(),
  };

  return sendPushNotification(userId, notification, data);
}

/**
 * Send reminder notification (for all care reminders)
 * @param {string} userId - Firebase user ID
 * @param {Object} reminder - Reminder object
 * @returns {Promise<string>} Message ID
 */
async function sendReminderNotification(userId, reminder) {
  const reminderType = reminder.type || 'feeding';
  const { title, body, metadata } = getReminderNotificationContent(reminderType, reminder);
  
  const notification = { title, body };

  const data = {
    type: 'reminder',
    reminderType: reminderType,
    reminderId: reminder.id,
    babyId: reminder.babyId,
    metadata: metadata,
    createdAt: new Date().toISOString(),
  };

  return sendPushNotification(userId, notification, data);
}

module.exports = {
  sendPushNotification,
  sendAlertNotification,
  sendReminderNotification,
};

