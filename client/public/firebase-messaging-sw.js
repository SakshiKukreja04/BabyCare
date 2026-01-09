// Firebase Cloud Messaging Service Worker
// This file is required for FCM to work properly

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

// Initialize Firebase (with config from main app)
firebase.initializeApp({
  apiKey: 'AIzaSyAWwS4fkKGwPp0FH9SdrNrmfDc8brCRtU0',
  authDomain: 'carenest-b986b.firebaseapp.com',
  projectId: 'carenest-b986b',
  storageBucket: 'carenest-b986b.firebasestorage.app',
  messagingSenderId: '876544740156',
  appId: '1:876544740156:web:251fa0c5c1c69ced006c39',
});

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[Background Message] Received:', payload);

  const notificationTitle = payload.notification?.title || 'Medicine Reminder';
  const notificationOptions = {
    body: payload.notification?.body || 'Time to take your medicine',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.reminderId || 'reminder',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Notification Clicked]:', event.notification);
  event.notification.close();
  
  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app window is already open
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open it
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
