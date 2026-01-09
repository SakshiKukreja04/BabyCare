import React, { useState, useEffect } from 'react';
import RemindersSection from '@/components/dashboard/RemindersSection';
// ... other imports ...

/**
 * Example Dashboard Integration
 * Shows how to add the RemindersSection component
 */
export default function Dashboard() {
  const [selectedBaby, setSelectedBaby] = useState(null);
  const [babies, setBabies] = useState([]);

  useEffect(() => {
    // Fetch babies and set first as selected
    // Your existing logic here
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Existing dashboard header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Baby care summary and activities</p>
      </div>

      {selectedBaby && (
        <>
          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Overview Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Mood Check-In Widget */}
              <MoodCheckInWidget babyId={selectedBaby.id} />

              {/* Nutrition Awareness Card */}
              <NutritionAwarenessCard babyId={selectedBaby.id} />

              {/* Care Logs Summary */}
              <CareLogsSummary babyId={selectedBaby.id} />

              {/* NEW: Medicine Reminders Section */}
              {/* ========================================= */}
              <div className="mt-8">
                <RemindersSection 
                  babyId={selectedBaby.id} 
                  babyName={selectedBaby.name}
                />
              </div>
              {/* ========================================= */}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Alerts Widget */}
              <AlertsWidget babyId={selectedBaby.id} />

              {/* Baby Profile Card */}
              <BabyProfileCard baby={selectedBaby} />

              {/* Quick Actions */}
              <QuickActionsCard babyId={selectedBaby.id} />
            </div>
          </div>

          {/* Full-width Sections */}
          <div className="grid grid-cols-1 gap-6">
            {/* Care Activities Timeline */}
            <CareActivitiesTimeline babyId={selectedBaby.id} />

            {/* Development Progress */}
            <DevelopmentProgress babyId={selectedBaby.id} />
          </div>
        </>
      )}

      {!selectedBaby && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-900 font-semibold">
            Please select a baby to view the dashboard
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Alternative: Dedicated Reminders Page
 * If you prefer reminders in a separate page/tab
 */
export function RemindersPage() {
  const [selectedBaby, setSelectedBaby] = useState(null);
  const [babies, setBabies] = useState([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Medicine Reminders</h1>
        <p className="text-gray-600">Track and manage medication reminders</p>
      </div>

      {/* Baby Selector */}
      {babies.length > 0 && (
        <div className="flex gap-2">
          {babies.map(baby => (
            <button
              key={baby.id}
              onClick={() => setSelectedBaby(baby)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedBaby?.id === baby.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {baby.name}
            </button>
          ))}
        </div>
      )}

      {/* Reminders Display */}
      {selectedBaby && (
        <RemindersSection 
          babyId={selectedBaby.id} 
          babyName={selectedBaby.name}
        />
      )}
    </div>
  );
}

/**
 * Example: Bell Icon with Reminder Badge in Header
 */
export function HeaderReminders() {
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedBaby, setSelectedBaby] = useState(null);
  const { Bell } = require('lucide-react');

  useEffect(() => {
    if (!selectedBaby) return;

    const fetchPendingCount = async () => {
      try {
        const response = await fetch(`/api/reminders/today?babyId=${selectedBaby.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        const pending = data.data.summary.pending;
        setPendingCount(pending);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    // Fetch immediately
    fetchPendingCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);

    return () => clearInterval(interval);
  }, [selectedBaby]);

  return (
    <div className="relative">
      <Bell className="w-6 h-6 cursor-pointer hover:text-blue-500" />
      
      {pendingCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
          {pendingCount}
        </div>
      )}
    </div>
  );
}

/**
 * Example: Mini Reminders Widget for Sidebar
 */
export function MiniRemindersWidget({ babyId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { Clock, Bell } = require('lucide-react');

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const response = await fetch(`/api/reminders/today?babyId=${babyId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setReminders(data.data.reminders.slice(0, 3)); // Show only first 3
      } catch (error) {
        console.error('Error fetching reminders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
    const interval = setInterval(fetchReminders, 60000); // Poll every minute

    return () => clearInterval(interval);
  }, [babyId]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="animate-pulse h-20 bg-blue-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">Upcoming Reminders</h3>
      </div>

      {reminders.length === 0 ? (
        <p className="text-sm text-gray-600">No pending reminders</p>
      ) : (
        <div className="space-y-2">
          {reminders.map(reminder => (
            <div key={reminder.id} className="text-sm">
              <p className="font-medium text-gray-900">{reminder.medicine_name}</p>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-4 h-4" />
                {new Date(reminder.scheduled_for).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
          {reminders.length > 3 && (
            <p className="text-xs text-blue-600 mt-2">
              +{reminders.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Example: Reminders in Modal/Dialog
 */
export function RemindersModal({ isOpen, onClose, babyId, babyName }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Medicine Reminders - {babyName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <RemindersSection babyId={babyId} babyName={babyName} />
        </div>
      </div>
    </div>
  );
}

/**
 * Implementation Tips:
 * 
 * 1. Import RemindersSection in your Dashboard:
 *    import RemindersSection from '@/components/dashboard/RemindersSection';
 * 
 * 2. Add to your dashboard JSX:
 *    <RemindersSection babyId={selectedBaby.id} babyName={selectedBaby.name} />
 * 
 * 3. Position it where it makes sense:
 *    - Below care summary
 *    - In a dedicated medical section
 *    - Alongside other baby info
 * 
 * 4. Add reminder icon with badge in header/navbar:
 *    <HeaderReminders />
 * 
 * 5. Show mini widget in sidebar:
 *    <MiniRemindersWidget babyId={selectedBaby.id} />
 * 
 * 6. Use modal for quick view:
 *    <RemindersModal isOpen={showReminders} onClose={...} babyId={...} />
 */
