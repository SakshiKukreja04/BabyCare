const { admin } = require('../firebaseAdmin');

/**
 * Firebase Cloud Messaging (FCM) Service
 * Sends push notifications to user devices
 */

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
        type: data.type || 'alert',
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
    console.log('FCM notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending FCM notification:', error.message);
    throw error;
  }
}

/**
 * Send alert notification
 * @param {string} userId - Firebase user ID
 * @param {Object} alert - Alert object
 * @returns {Promise<string>} Message ID
 */
async function sendAlertNotification(userId, alert) {
  const notification = {
    title: `BabyCare Alert: ${alert.severity.toUpperCase()}`,
    body: alert.title || alert.description || 'You have a new care alert',
  };

  const data = {
    type: 'alert',
    alertId: alert.id,
    babyId: alert.babyId,
    severity: alert.severity,
    ruleId: alert.ruleId,
  };

  return sendPushNotification(userId, notification, data);
}

module.exports = {
  sendPushNotification,
  sendAlertNotification,
};

