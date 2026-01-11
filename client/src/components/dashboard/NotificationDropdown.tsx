import React, { useState, useEffect } from 'react';
import { Bell, X, Droplet, Moon, Pill, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import reminderEventEmitter from '@/services/reminderEvents';

interface NotificationMetadata {
  // Feeding
  currentAmount?: number;
  threshold?: number;
  feedCount?: number;
  isCritical?: boolean;
  hoursSinceLastFeed?: number;
  lastFeedTime?: string;
  // Sleep
  totalSleepToday?: number;
  recommendedHours?: number;
  sleepCount?: number;
  // Medicine
  medicineName?: string;
  dosage?: string;
  scheduledTime?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'reminder' | 'alert' | 'info';
  alertType?: 'feeding' | 'sleep' | 'medicine';
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata?: NotificationMetadata;
}

/**
 * NotificationDropdown Component
 * Shows recent notifications for feeding, sleep, and medicine
 * Displays type-specific metadata for each notification type
 */
const NotificationDropdown = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to unified notification events (new system)
    const unsubscribeNotification = reminderEventEmitter.subscribe(
      'notification:received',
      (data) => {
        const newNotification: Notification = {
          id: data.id || Date.now().toString(),
          title: data.title || getDefaultTitle(data.alertType),
          message: data.message,
          timestamp: data.timestamp || new Date(),
          type: data.type || 'alert',
          alertType: data.alertType || 'feeding',
          severity: data.severity,
          metadata: data.metadata || {},
        };

        setNotifications(prev => {
          // Avoid duplicates by checking id
          if (prev.some(n => n.id === newNotification.id)) {
            // Update existing notification instead
            return prev.map(n => n.id === newNotification.id ? newNotification : n);
          }
          return [newNotification, ...prev].slice(0, 10);
        });
      }
    );

    // Subscribe to legacy reminder events (backward compatibility)
    const unsubscribeReminder = reminderEventEmitter.subscribe(
      'reminder:received',
      (data) => {
        // Only add if not already handled by notification:received
        if (!data.id) {
          const newNotification: Notification = {
            id: data.reminderId || Date.now().toString(),
            title: '💊 Medicine Reminder',
            message: `Time to give ${data.medicine}`,
            timestamp: new Date(),
            type: 'reminder',
            alertType: 'medicine',
            metadata: { medicineName: data.medicine },
          };

          setNotifications(prev => {
            // Avoid duplicates
            if (prev.some(n => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev].slice(0, 10);
          });
        }
      }
    );

    return () => {
      unsubscribeNotification();
      unsubscribeReminder();
    };
  }, []);

  const getDefaultTitle = (alertType: string) => {
    switch (alertType) {
      case 'feeding': return '🍼 Feeding Alert';
      case 'sleep': return '😴 Sleep Alert';
      case 'medicine': return '💊 Medicine Reminder';
      default: return '👶 Baby Care Alert';
    }
  };

  const getTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'feeding': return <Droplet className="w-4 h-4 text-blue-500" />;
      case 'sleep': return <Moon className="w-4 h-4 text-purple-500" />;
      case 'medicine': return <Pill className="w-4 h-4 text-green-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTypeColor = (alertType: string, severity?: string) => {
    if (severity === 'HIGH') {
      return 'bg-red-50 border-red-200 border-l-red-500';
    }
    switch (alertType) {
      case 'feeding': return 'bg-blue-50 border-blue-200 border-l-blue-500';
      case 'sleep': return 'bg-purple-50 border-purple-200 border-l-purple-500';
      case 'medicine': return 'bg-green-50 border-green-200 border-l-green-500';
      default: return 'bg-gray-50 border-gray-200 border-l-gray-500';
    }
  };

  const renderMetadata = (notification: Notification) => {
    const { alertType, metadata } = notification;
    if (!metadata) return null;

    switch (alertType) {
      case 'feeding':
        return (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            {metadata.currentAmount !== undefined && (
              <p className="flex items-center gap-1">
                <Droplet className="w-3 h-3" />
                Today: <span className="font-medium">{metadata.currentAmount}ml</span>
                {metadata.threshold && <span className="text-gray-400">/ {metadata.threshold}ml</span>}
              </p>
            )}
            {metadata.feedCount !== undefined && (
              <p>Feeds today: {metadata.feedCount}</p>
            )}
            {metadata.hoursSinceLastFeed !== undefined && (
              <p className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last feed: {metadata.hoursSinceLastFeed.toFixed(1)}h ago
              </p>
            )}
          </div>
        );

      case 'sleep':
        return (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            {metadata.totalSleepToday !== undefined && (
              <p className="flex items-center gap-1">
                <Moon className="w-3 h-3" />
                Sleep today: <span className="font-medium">{metadata.totalSleepToday.toFixed(1)}h</span>
                {metadata.recommendedHours && (
                  <span className="text-gray-400">/ {metadata.recommendedHours}h recommended</span>
                )}
              </p>
            )}
            {metadata.sleepCount !== undefined && (
              <p>Sleep sessions: {metadata.sleepCount}</p>
            )}
            {metadata.totalSleepToday === undefined && (
              <p className="text-amber-600">⚠️ No sleep logged today - please add a log</p>
            )}
          </div>
        );

      case 'medicine':
        return (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            {metadata.medicineName && (
              <p className="flex items-center gap-1">
                <Pill className="w-3 h-3" />
                Medicine: <span className="font-medium">{metadata.medicineName}</span>
              </p>
            )}
            {metadata.dosage && (
              <p>Dosage: {metadata.dosage}</p>
            )}
            {metadata.scheduledTime && (
              <p className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Scheduled: <span className="font-medium">{metadata.scheduledTime}</span>
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
                Alerts and reminders will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 ${getTypeColor(
                    notification.alertType || 'feeding',
                    notification.severity
                  )} hover:bg-opacity-75 transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.alertType || 'feeding')}
                        <h4 className="font-semibold text-sm text-gray-900">
                          {notification.title}
                        </h4>
                        {notification.severity === 'HIGH' && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                            HIGH
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      
                      {/* Type-specific metadata */}
                      {renderMetadata(notification)}
                      
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
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
