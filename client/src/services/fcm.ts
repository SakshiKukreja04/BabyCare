import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import reminderEventEmitter from './reminderEvents';

/**
 * FCM Service for Web Push Notifications
 * Handles registration and listening for push notifications
 */

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_PUBLIC_KEY;

/**
 * Register service worker for Firebase Cloud Messaging
 * Required for background message handling
 */
async function registerServiceWorker(): Promise<ServiceWorkerContainer['controller'] | null> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('✅ [FCM] Service Worker registered successfully');
      return registration.active || registration.installing;
    }
  } catch (error) {
    console.error('❌ [FCM] Error registering Service Worker:', error);
  }
  return null;
}

/**
 * Request permission and register FCM token
 * Saves token to user's profile in Firestore
 */
export async function registerFCMToken(userId: string): Promise<string | null> {
  try {
    // Check if VAPID key is configured
    if (!VAPID_KEY) {
      console.warn('⚠️ [FCM] VAPID_KEY not configured. Push notifications disabled.');
      return null;
    }

    // Register service worker first
    await registerServiceWorker();

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('⚠️ [FCM] Browser does not support notifications');
      return null;
    }

    // Request notification permission
    if (Notification.permission === 'denied') {
      console.warn('⚠️ [FCM] Notification permission denied by user');
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('⚠️ [FCM] User did not grant notification permission');
        return null;
      }
    }

    // Get FCM token
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      console.log('✅ [FCM] Token registered successfully:', token.substring(0, 20) + '...');

      // Save token to user's Firestore profile
      try {
        const userRef = doc(db, 'users', userId);
        
        // First check if user document exists
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.log('📝 [FCM] Creating user document for first time');
        }
        
        // Update with setDoc using merge option to create if doesn't exist
        await setDoc(userRef, {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date(),
        }, { merge: true });
        
        console.log('✅ [FCM] Token saved to user profile');
      } catch (error) {
        console.error('❌ [FCM] Error saving token to Firestore:', error);
        return null;
      }

      return token;
    } else {
      console.warn('⚠️ [FCM] No token received from Firebase');
    }

    return null;
  } catch (error) {
    console.error('❌ [FCM] Error registering FCM token:', error);
    return null;
  }
}

/**
 * Listen for incoming push notifications
 * Handles different notification types: feeding, sleep, medicine
 */
export function setupFCMListener(): void {
  try {
    if (!VAPID_KEY) {
      console.warn('⚠️ [FCM] VAPID_KEY not configured. Cannot setup listener.');
      return;
    }

    const messaging = getMessaging();

    onMessage(messaging, (payload) => {
      console.log('📨 [FCM] Notification received:', payload);

      // Handle notification
      const { notification, data } = payload;

      if (notification) {
        // Show browser notification
        new Notification(notification.title || 'BabyCare Notification', {
          body: notification.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: data?.alertId || data?.reminderId || 'babycare-notification',
          data: data,
        });

        // Parse metadata if it's a string
        let metadata = {};
        try {
          metadata = data?.metadata ? JSON.parse(data.metadata) : {};
        } catch (e) {
          metadata = data?.metadata || {};
        }

        // Emit event for frontend to react to based on type
        const eventData = {
          id: data?.alertId || data?.reminderId || Date.now().toString(),
          type: data?.type || 'alert', // 'alert' or 'reminder'
          alertType: data?.alertType || data?.reminderType || 'feeding', // 'feeding', 'sleep', 'medicine'
          babyId: data?.babyId,
          severity: data?.severity,
          title: notification.title,
          message: notification.body,
          metadata: metadata,
          timestamp: new Date(),
        };

        // Emit unified notification event
        reminderEventEmitter.emit('notification:received', eventData);
        
        // Also emit legacy reminder event for backward compatibility
        if (data?.reminderId) {
          reminderEventEmitter.emit('reminder:received', {
            reminderId: data.reminderId,
            babyId: data.babyId,
            medicine: notification.title,
            message: notification.body,
            timestamp: new Date(),
          });
        }
        
        console.log('🔔 [FCM] Notification event emitted:', eventData.alertType);
      }
    });

    console.log('✅ [FCM] Listener set up successfully');
  } catch (error) {
    console.error('❌ [FCM] Error setting up FCM listener:', error);
  }
}

/**
 * Update user's phone number in Firestore
 */
export async function updatePhoneNumber(
  userId: string,
  phoneNumber: string
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      phoneNumber: phoneNumber,
      phoneNumberUpdatedAt: new Date(),
    });
    console.log('✅ [User] Phone number updated successfully');
    return true;
  } catch (error) {
    console.error('❌ [User] Error updating phone number:', error);
    return false;
  }
}

/**
 * Get user's current FCM token and phone number
 */
export async function getUserNotificationSettings(userId: string): Promise<{
  fcmToken: string | null;
  phoneNumber: string | null;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { fcmToken: null, phoneNumber: null };
    }

    const userData = userDoc.data();
    return {
      fcmToken: userData?.fcmToken || null,
      phoneNumber: userData?.phoneNumber || null,
    };
  } catch (error) {
    console.error('❌ [User] Error getting notification settings:', error);
    return { fcmToken: null, phoneNumber: null };
  }
}
