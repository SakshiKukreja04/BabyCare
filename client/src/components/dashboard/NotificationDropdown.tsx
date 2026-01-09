import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import reminderEventEmitter from '@/services/reminderEvents';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'reminder' | 'alert' | 'info';
}

/**
 * NotificationDropdown Component
 * Shows recent reminders and notifications
 * Displays actual sent reminders instead of dummy data
 */
const NotificationDropdown = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to reminder events
    const unsubscribe = reminderEventEmitter.subscribe(
      'reminder:received',
      (data) => {
        const newNotification: Notification = {
          id: data.reminderId || Date.now().toString(),
          title: '💊 Medicine Reminder',
          message: `Time to give ${data.medicine}`,
          timestamp: new Date(),
          type: 'reminder',
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep last 10
      }
    );

    return () => unsubscribe();
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reminder':
        return 'bg-blue-50 border-blue-200';
      case 'alert':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-96 z-50">
      <Card className="rounded-lg shadow-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h3>
            {notifications.length > 0 && (
              <span className="text-sm text-gray-600">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Reminders will appear here when sent
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 border-l-blue-500 ${getTypeColor(
                    notification.type
                  )} hover:bg-opacity-75 transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-gray-900">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {notification.timestamp.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 text-center">
            <button
              onClick={() => setNotifications([])}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationDropdown;
