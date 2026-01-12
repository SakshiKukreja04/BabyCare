import React, { useState, useEffect } from 'react';
import { Bell, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  registerFCMToken,
  setupFCMListener,
  updatePhoneNumber,
  getUserNotificationSettings,
} from '@/services/fcm';

/**
 * User Settings Component
 * Allows users to:
 * - Enable/disable web push notifications
 * - Add phone number for SMS notifications (via Twilio)
 * - View notification settings
 */
const UserSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    fcmToken: null as string | null,
    phoneNumber: null as string | null,
  });

  // Load user's current settings on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserSettings();
    }
  }, [user?.uid]);

  const loadUserSettings = async () => {
    if (!user?.uid) return;

    try {
      const settings = await getUserNotificationSettings(user.uid);
      setNotificationSettings(settings);
      setPhoneNumber(settings.phoneNumber || '');
      setFcmToken(settings.fcmToken || null);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const token = await registerFCMToken(user.uid);

      if (token) {
        setFcmToken(token);
        setupFCMListener();
        toast({
          title: '✅ Push notifications enabled',
          description: 'You will receive medicine reminders on this device',
        });
      } else {
        toast({
          title: '⚠️ Could not enable notifications',
          description: 'Please check your browser settings and try again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enable notifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number',
        variant: 'destructive',
      });
      return;
    }

    // Basic phone number validation (should include country code)
    if (!/^\+\d{1,3}\d{4,14}$/.test(phoneNumber)) {
      toast({
        title: 'Invalid phone number',
        description: 'Please use format: +1234567890 (include country code)',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.uid) return;

    setLoading(true);
    try {
      const success = await updatePhoneNumber(user.uid, phoneNumber);

      if (success) {
        setNotificationSettings({
          ...notificationSettings,
          phoneNumber,
        });
        toast({
          title: '✅ Phone number saved',
          description: 'You will receive WhatsApp reminders at this number',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save phone number',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Push Notifications Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Web Push Notifications
            </CardTitle>
            {fcmToken && (
              <Badge className="bg-green-100 text-green-800">Enabled ✓</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fcmToken ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">
                      Push notifications are enabled
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      You will receive medicine reminders as browser notifications
                    </p>
                    <p className="text-xs text-green-600 mt-2 break-all">
                      Token: {fcmToken.substring(0, 30)}...
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Make sure your browser allows notifications from BabyCare and your device
                is connected to the internet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      Enable push notifications
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Get instant browser notifications for medicine reminders
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleEnablePushNotifications}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Enabling...' : 'Enable Push Notifications'}
              </Button>

              <p className="text-xs text-gray-500">
                Your browser will ask for permission to show notifications. Please click
                "Allow" when prompted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Notifications Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              SMS Notifications
            </CardTitle>
            {notificationSettings.phoneNumber && (
              <Badge className="bg-green-100 text-green-800">Enabled ✓</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePhoneNumber} className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <p className="text-xs text-gray-500 mb-2">
                Include country code (e.g., +1 for USA, +91 for India)
              </p>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">
                Format: +[country code][number] (e.g., +919876543210)
              </p>
            </div>

            {notificationSettings.phoneNumber && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✓ Saved: {notificationSettings.phoneNumber}
                </p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Save Phone Number'}
            </Button>

            <p className="text-xs text-gray-600">
              Medicine reminders will be sent via SMS to this number. Ensure you have SMS enabled on your phone.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Notification Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Web Push Notifications</span>
              {fcmToken ? (
                <Badge className="bg-green-100 text-green-800">Ready ✓</Badge>
              ) : (
                <Badge variant="outline">Not enabled</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">SMS Notifications</span>
              {notificationSettings.phoneNumber ? (
                <Badge className="bg-green-100 text-green-800">Ready ✓</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
          </div>

          {fcmToken && notificationSettings.phoneNumber && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✅ All notifications enabled! You're all set to receive medicine reminders.
              </p>
            </div>
          )}

          {!fcmToken && !notificationSettings.phoneNumber && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ No notification methods configured. Enable at least one to receive
                medicine reminders.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSettings;
