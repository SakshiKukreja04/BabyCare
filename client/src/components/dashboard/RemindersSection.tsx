import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertCircle, Clock, Send, MessageCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import reminderEventEmitter from '@/services/reminderEvents';

/**
 * RemindersSection Component
 * Displays today's medicine reminders for a baby
 * Shows pending, sent, and dismissed reminders with real-time updates
 * Includes notification status and delivery channels
 * Listens for reminder events and refreshes automatically
 */
const RemindersSection = ({ babyId, babyName = 'Baby' }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    sent: 0,
    dismissed: 0,
    failed: 0,
  });
  const { toast } = useToast();

  /**
   * Fetch today's reminders
   */
  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<any>(`/api/reminders/today?babyId=${babyId}`);
      console.log('📋 [RemindersSection] API Response:', response);
      
      // API returns { success: true, data: { reminders, summary } }
      const { reminders = [], summary = {} } = response.data || response;
      
      console.log('📋 [RemindersSection] Fetched reminders:', reminders.length, 'Summary:', summary);
      
      setReminders(reminders);
      setSummary(summary);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching reminders:', err.message);
      setError(err.message);
      toast({
        title: 'Error loading reminders',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mark reminder as dismissed (medicine already given)
   */
  const handleDismissReminder = async (reminderId) => {
    try {
      await apiRequest(`/api/reminders/${reminderId}/dismiss`, {
        method: 'POST',
      });

      // Update local state
      setReminders(reminders.map(r => 
        r.id === reminderId ? { ...r, status: 'dismissed' } : r
      ));

      toast({
        title: '✅ Reminder marked as given',
        description: 'Great job taking care of the medicine schedule!',
      });

      // Refresh reminders after a short delay
      setTimeout(fetchReminders, 500);
    } catch (err) {
      console.error('❌ Error dismissing reminder:', err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Fetch reminders on component mount and set up polling
  useEffect(() => {
    if (!babyId) {
      console.warn('⚠️ [RemindersSection] No babyId provided');
      return;
    }

    console.log('📋 [RemindersSection] Mounting, babyId:', babyId);
    fetchReminders();

    // Subscribe to reminder received events (real-time)
    const unsubscribeReminderReceived = reminderEventEmitter.subscribe(
      'reminder:received',
      (data) => {
        console.log('🔔 [RemindersSection] Reminder received event, refreshing reminders:', data);
        // Fetch reminders immediately when a reminder is received
        fetchReminders();
      }
    );

    // Subscribe to reminder sent events from server
    const unsubscribeReminderSent = reminderEventEmitter.subscribe(
      'reminder:sent',
      () => {
        console.log('✅ [RemindersSection] Reminder sent event, refreshing reminders');
        // Fetch reminders when server sends a reminder
        fetchReminders();
      }
    );

    // Poll for new reminders every 10 seconds (faster than before)
    const pollInterval = setInterval(() => {
      console.log('📋 [RemindersSection] Polling for reminders...');
      fetchReminders();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeReminderReceived();
      unsubscribeReminderSent();
    };
  }, [babyId]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Medicine Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
            <p className="mt-4 text-gray-600">Loading reminders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Medicine Reminders for {babyName}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReminders}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          <div className="bg-blue-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-xl font-bold text-blue-600">{summary.total}</p>
          </div>
          <div className="bg-yellow-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">Pending</p>
            <p className="text-xl font-bold text-yellow-600">{summary.pending}</p>
          </div>
          <div className="bg-green-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">Sent</p>
            <p className="text-xl font-bold text-green-600">{summary.sent}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">Dismissed</p>
            <p className="text-xl font-bold text-gray-600">{summary.dismissed}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">Failed</p>
            <p className="text-xl font-bold text-red-600">{summary.failed}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            <p className="font-semibold">Error loading reminders</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {reminders.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No reminders for today</p>
            <p className="text-sm text-gray-500 mt-1">
              Reminders will appear here once prescriptions are confirmed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onDismiss={handleDismissReminder}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Individual Reminder Card Component
 */
const ReminderCard = ({ reminder, onDismiss }) => {
  const scheduledTime = new Date(reminder.scheduled_for);
  const formattedTime = scheduledTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'sent':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'dismissed':
        return <CheckCircle2 className="w-5 h-5 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Sent ✓</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Given ✓</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed ✗</Badge>;
      default:
        return <Badge variant="default">Unknown</Badge>;
    }
  };

  const getChannelIcons = (channels) => {
    if (!channels || channels.length === 0) return null;
    
    return (
      <div className="flex gap-1 mt-2">
        {channels.includes('web') && (
          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-xs">
            <Smartphone className="w-3 h-3 text-blue-600" />
            <span className="text-blue-600">Web</span>
          </div>
        )}
        {channels.includes('whatsapp') && (
          <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded text-xs">
            <MessageCircle className="w-3 h-3 text-green-600" />
            <span className="text-green-600">WhatsApp</span>
          </div>
        )}
      </div>
    );
  };

  const isPast = new Date() > scheduledTime;
  const isOverdue = reminder.status === 'pending' && isPast;

  return (
    <div
      className={`border rounded-lg p-4 flex items-start justify-between ${
        isOverdue
          ? 'border-red-300 bg-red-50'
          : reminder.status === 'dismissed'
          ? 'border-gray-200 bg-gray-50'
          : reminder.status === 'sent'
          ? 'border-green-200 bg-green-50'
          : reminder.status === 'failed'
          ? 'border-red-200 bg-red-50'
          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      } transition-colors`}
    >
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-1">{getStatusIcon(reminder.status)}</div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{reminder.medicine_name}</h3>
            {getStatusBadge(reminder.status)}
            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
            {reminder.status === 'sent' && <Badge className="bg-blue-600">📬 Sent</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
            <div>
              <p className="text-xs text-gray-500">Dosage</p>
              <p className="font-medium">{reminder.dosage}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Scheduled Time</p>
              <p className="font-medium">{formattedTime}</p>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-2">
            <p>Frequency: {reminder.frequency}</p>
            {reminder.attempt_count > 0 && (
              <p className="text-gray-600">
                Send attempts: <span className="font-medium">{reminder.attempt_count}</span>
              </p>
            )}
            {reminder.error_message && (
              <p className="text-red-600 mt-1">Error: {reminder.error_message}</p>
            )}
          </div>

          {/* Show notification channels */}
          {getChannelIcons(reminder.channels)}
        </div>
      </div>

      {reminder.status === 'pending' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDismiss(reminder.id)}
          className="ml-4 whitespace-nowrap"
        >
          Mark Given ✓
        </Button>
      )}
    </div>
  );
};

export default RemindersSection;
