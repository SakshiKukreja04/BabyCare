import { useState, useEffect } from 'react';
import { getCareLogsByBaby, getBabiesByParent } from '@/lib/firestore';
import { alertsApi, babiesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Baby,
  Heart,
  Moon,
  Droplet,
  AlertTriangle,
  Phone,
  MapPin,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import NutritionAwarenessCard from '@/components/dashboard/NutritionAwarenessCard';
import RuleExplanationModal from '@/components/dashboard/RuleExplanationModal';
import MoodCheckInWidget from '@/components/dashboard/MoodCheckInWidget';

const Dashboard = () => {
  const { t } = useLanguage();

  const { user } = useAuth();
  const [babyData, setBabyData] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [babyType, setBabyType] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState({
    totalFeedMl: 0,
    totalSleepMinutes: 0,
  });
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    async function fetchBabyAndLogs() {
      if (!user) return;
      const babies = await getBabiesByParent(user.uid);
      // Debug: verify babies fetched for this parent
      // eslint-disable-next-line no-console
      console.log('Dashboard: babies for parent', user.uid, babies);

      if (babies.length > 0) {
        // Type assertion for baby
        const baby = babies[0] as {
          id: string;
          name?: string;
          dob?: string;
          gestationalAge?: number;
          currentWeight?: number;
        };
        const logs = (await getCareLogsByBaby(baby.id, user.uid)) as Array<{
          id: string;
          type?: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          timestamp?: any;
          quantity?: number;
          duration?: number;
          medicationGiven?: boolean;
        }>;

        // Debug: verify logs used for summary and recent activity
        // eslint-disable-next-line no-console
        console.log('Dashboard: logs for baby', baby.id, logs);

        // Compute today's totals for feed and sleep
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLogs = logs.filter((log) => {
          const ts = log.timestamp?.toDate?.() || log.timestamp;
          if (!ts) return false;
          const d = new Date(ts);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });

        const totalFeedMl = todayLogs
          .filter((l) => l.type === 'feeding' && l.quantity)
          .reduce((sum, l) => sum + (l.quantity || 0), 0);

        const totalSleepMinutes = todayLogs
          .filter((l) => l.type === 'sleep' && l.duration)
          .reduce((sum, l) => sum + (l.duration || 0), 0);

        setDailySummary({
          totalFeedMl,
          totalSleepMinutes,
        });

        // Find last feed, sleep, medication logs
        const lastFeedLog = logs.find(l => l.type === 'feeding');
        const lastSleepLog = logs.find(l => l.type === 'sleep');
        const lastMedicationLog = logs.find(l => l.type === 'medication');
        setBabyData({
          name: baby.name || '',
          ageMonths: getAgeMonths(baby.dob),
          ageDays: getAgeDays(baby.dob),
          gestationalAge: baby.gestationalAge || '',
          lastFeed: lastFeedLog && lastFeedLog.timestamp ? timeAgo(lastFeedLog.timestamp) : '',
          lastSleep: lastSleepLog && lastSleepLog.timestamp ? timeAgo(lastSleepLog.timestamp) : '',
          lastMedication: lastMedicationLog ? (lastMedicationLog.medicationGiven ? 'Given' : 'Not Given') : '',
          status: 'good',
          weight: (baby.currentWeight !== undefined ? baby.currentWeight : '') + ' kg',
        });

        // Debug: verify computed summary data
        // eslint-disable-next-line no-console
        console.log('Dashboard: computed babyData summary', {
          name: baby.name,
          lastFeedLog,
          lastSleepLog,
          lastMedicationLog,
        });

        setRecentLogs(logs);

        // Fetch baby profile with type classification
        try {
          const babyProfile = await babiesApi.getById(baby.id);
          if (babyProfile.baby) {
            setBabyType(babyProfile.baby.babyType || null);
          }
        } catch (error) {
          console.error('Error fetching baby profile:', error);
        }

        // Fetch alerts for this baby (HIGH and MEDIUM severity)
        try {
          const alertsData = await alertsApi.getByBaby(baby.id, false);
          const allAlerts = alertsData.alerts || [];
          
          // Separate alerts (HIGH/MEDIUM) from reminders (LOW)
          const highMediumAlerts = allAlerts.filter((a: any) => 
            !a.resolved && (a.severity === 'HIGH' || a.severity === 'MEDIUM')
          );
          const lowReminders = allAlerts.filter((a: any) => 
            !a.resolved && a.severity === 'LOW'
          );
          
          setAlerts(highMediumAlerts);
          setReminders(lowReminders);
        } catch (error) {
          console.error('Error fetching alerts:', error);
        }
      }
    }
    fetchBabyAndLogs();
  }, [user]);

  // Helper functions
  function getAgeMonths(dob?: string) {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    return now.getMonth() - birth.getMonth() + 12 * (now.getFullYear() - birth.getFullYear());
  }
  function getAgeDays(dob?: string) {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)) % 30;
  }
  function timeAgo(date: Date | string | any) {
    if (!date) return '';
    
    // Handle different timestamp formats
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date.toDate && typeof date.toDate === 'function') {
      // Firestore Timestamp object
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (date.toMillis && typeof date.toMillis === 'function') {
      // Firestore Timestamp with toMillis
      dateObj = new Date(date.toMillis());
    } else {
      // Try to parse as Date
      dateObj = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'just now';
    if (diffH === 1) return '1 hour ago';
    return `${diffH} hours ago`;
  }

  function formatTimestamp(raw: any) {
    if (!raw) return '';
    
    // Handle different timestamp formats
    let date: Date;
    if (typeof raw === 'string') {
      date = new Date(raw);
    } else if (raw.toDate && typeof raw.toDate === 'function') {
      // Firestore Timestamp object
      date = raw.toDate();
    } else if (raw instanceof Date) {
      date = raw;
    } else if (raw.toMillis && typeof raw.toMillis === 'function') {
      // Firestore Timestamp with toMillis
      date = new Date(raw.toMillis());
    } else {
      // Try to parse as Date
      date = new Date(raw);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-alert-success';
      case 'attention':
        return 'bg-alert-medium';
      case 'urgent':
        return 'bg-alert-high';
      default:
        return 'bg-muted';
    }
  };

  const getSeverityStyles = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    switch (severityLower) {
      case 'low':
        return {
          border: 'border-alert-low/30',
          bg: 'bg-alert-low/5',
          badge: 'bg-alert-low/20 text-alert-low',
        };
      case 'medium':
        return {
          border: 'border-alert-medium/30',
          bg: 'bg-alert-medium/5',
          badge: 'bg-alert-medium/20 text-alert-medium',
        };
      case 'high':
        return {
          border: 'border-alert-high/30',
          bg: 'bg-alert-high/5',
          badge: 'bg-alert-high/20 text-alert-high',
        };
      default:
        return {
          border: 'border-border',
          bg: 'bg-card',
          badge: 'bg-muted text-muted-foreground',
        };
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="pb-12 px-4 pt-8">
          <div className="container mx-auto max-w-6xl">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Heart className="w-5 h-5 animate-pulse-soft" />
              <span className="text-sm font-medium">{t('dashboard.welcome')} 💙</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Welcome back, Parent!
            </h1>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Baby Summary Card */}
              {babyData && (
                <Card className="overflow-hidden border-2 border-primary/20 shadow-card">
                  <CardHeader className="bg-gradient-to-r from-healthcare-blue-light to-healthcare-mint-light pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-soft flex items-center justify-center text-3xl">
                          👶
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-2xl text-foreground">{babyData.name}</CardTitle>
                            {babyType && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                babyType === 'PREMATURE' 
                                  ? 'bg-healthcare-peach/20 text-healthcare-peach-dark' 
                                  : 'bg-healthcare-mint-light/20 text-healthcare-mint'
                              }`}>
                                {babyType === 'PREMATURE' ? '👶 Premature' : '👶 Full Term'}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {babyData.ageMonths} months, {babyData.ageDays} days old
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${getStatusColor(babyData.status)} animate-pulse`} />
                        <span className="text-sm font-medium text-foreground capitalize">
                          {babyData.status === 'good' ? 'All Good' : babyData.status}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-healthcare-blue-light/30 rounded-2xl">
                        <Droplet className="w-6 h-6 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">Total Feed Today</p>
                        <p className="font-semibold text-foreground">
                          {dailySummary.totalFeedMl > 0 ? `${dailySummary.totalFeedMl} ml` : 'No logs yet'}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-healthcare-mint-light/30 rounded-2xl">
                        <Moon className="w-6 h-6 text-healthcare-mint mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">Total Sleep Today</p>
                        <p className="font-semibold text-foreground">
                          {dailySummary.totalSleepMinutes > 0
                            ? `${(dailySummary.totalSleepMinutes / 60).toFixed(1)} hrs`
                            : 'No logs yet'}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-healthcare-peach/30 rounded-2xl">
                        <Baby className="w-6 h-6 text-healthcare-peach-dark mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Weight</p>
                        <p className="font-semibold text-foreground">{babyData.weight}</p>
                      </div>
                    </div>
                    <Link to="/daily-log">
                      <Button className="w-full mt-6 h-12 gap-2 shadow-soft hover:shadow-hover">
                        <Plus className="w-5 h-5" />
                        Add Care Log
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Care Logs directly below summary card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Care Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(showAllLogs ? recentLogs : recentLogs.slice(0, 4)).map((log, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              log.type === 'feeding' ? 'bg-healthcare-blue-light' : log.type === 'sleep' ? 'bg-healthcare-mint-light' : 'bg-healthcare-peach'
                            }`}
                          >
                            {log.type === 'feeding' ? (
                              <Droplet className="w-5 h-5 text-primary" />
                            ) : log.type === 'sleep' ? (
                              <Moon className="w-5 h-5 text-healthcare-mint" />
                            ) : (
                              <Baby className="w-5 h-5 text-healthcare-peach-dark" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground capitalize">{log.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(log.timestamp)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {log.type === 'feeding' && log.quantity ? `${log.quantity}ml` : ''}
                          {log.type === 'sleep' && log.duration ? `${log.duration} min` : ''}
                          {log.type === 'medication' && log.medicationGiven ? 'Medication given' : ''}
                        </span>
                      </div>
                    ))}

                    {recentLogs.length > 4 && (
                      <div className="pt-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setShowAllLogs((prev) => !prev)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {showAllLogs ? 'View less' : `View more (${recentLogs.length - 4} more)`}
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reminders Section (LOW severity alerts) */}
              {reminders.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-alert-low" />
                      Reminders
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {reminders.length} active
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {reminders.map((reminder) => {
                      const styles = getSeverityStyles(reminder.severity);
                      return (
                        <div
                          key={reminder.id}
                          className={`p-3 rounded-xl border ${styles.border} ${styles.bg}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                                  Reminder
                                </span>
                                <span className="text-sm font-medium text-foreground">{reminder.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{reminder.description}</p>
                              {reminder.triggerData && reminder.triggerData.message && (
                                <p className="text-xs text-muted-foreground italic">
                                  {reminder.triggerData.message}
                                </p>
                              )}
                            </div>
                            <RuleExplanationModal alert={reminder} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Alerts Section (HIGH/MEDIUM severity) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-alert-medium" />
                    {t('dashboard.alerts')}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {alerts.length} active
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-alert-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Heart className="w-8 h-8 text-alert-success" />
                      </div>
                      <p className="text-sm text-muted-foreground">No active alerts. All good! 💙</p>
                    </div>
                  ) : (
                    alerts.map((alert) => {
                      const styles = getSeverityStyles(alert.severity);
                      return (
                        <details
                          key={alert.id}
                          className={`group p-4 rounded-2xl border ${styles.border} ${styles.bg} cursor-pointer`}
                        >
                          <summary className="flex items-center justify-between list-none">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
                                {alert.severity}
                              </span>
                              <span className="font-medium text-foreground">{alert.title}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-open:rotate-90 transition-transform" />
                          </summary>
                          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                            
                            {/* Show triggerData if available */}
                            {alert.triggerData && alert.triggerData.message && (
                              <div className="p-3 bg-secondary/50 rounded-xl">
                                <p className="text-xs font-medium text-foreground mb-1">Details:</p>
                                <p className="text-sm text-muted-foreground">{alert.triggerData.message}</p>
                              </div>
                            )}
                            
                            {/* Rule Explanation Button */}
                            <div className="flex justify-end">
                              <RuleExplanationModal alert={alert} />
                            </div>
                          </div>
                        </details>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Mood Check-in Widget (Emotional Safety Guardrail) */}
              <MoodCheckInWidget />

              {/* Nutrition Awareness Card (India-First Diet Helper) */}
              <NutritionAwarenessCard />

              {/* Emergency Support */}
              <Card className="border-2 border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    {t('dashboard.emergency')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    For medical emergencies, always contact professionals immediately.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-12 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Phone className="w-5 h-5" />
                    {t('dashboard.callDoctor')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-12 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <MapPin className="w-5 h-5" />
                    {t('dashboard.findHospital')}
                  </Button>
                  <div className="pt-3 border-t border-destructive/20">
                    <p className="text-xs text-muted-foreground text-center">
                      Emergency: <strong>112</strong> | Child Helpline: <strong>1098</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link to="/baby-profile">
                    <Button variant="ghost" className="w-full justify-start gap-3">
                      <Baby className="w-5 h-5 text-primary" />
                      Edit Baby Profile
                    </Button>
                  </Link>
                  <Link to="/daily-log">
                    <Button variant="ghost" className="w-full justify-start gap-3">
                      <Plus className="w-5 h-5 text-primary" />
                      Add Care Log
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
    </DashboardLayout>
  );
};

export default Dashboard;
