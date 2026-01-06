import { useState, useEffect } from 'react';
import { getCareLogsByBaby, addCareLog, getBabiesByParent } from '@/lib/firestore';
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
  const [babyData, setBabyData] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [alerts, setAlerts] = useState([]); // TODO: wire up real alerts if needed

  useEffect(() => {
    async function fetchBabyAndLogs() {
      if (!user) return;
      const babies = await getBabiesByParent(user.uid);
      if (babies.length > 0) {
        // Type assertion for baby
        const baby = babies[0] as {
          id: string;
          name?: string;
          dob?: string;
          gestationalAge?: number;
          currentWeight?: number;
        };
        const logs = (await getCareLogsByBaby(baby.id)) as Array<{
          id: string;
          type?: string;
          timestamp?: any;
          quantity?: number;
          duration?: number;
          medicationGiven?: boolean;
        }>;
        // Find last feed, sleep, medication logs
        const lastFeedLog = logs.find(l => l.type === 'feeding');
        const lastSleepLog = logs.find(l => l.type === 'sleep');
        const lastMedicationLog = logs.find(l => l.type === 'medication');
        setBabyData({
          name: baby.name || '',
          ageMonths: getAgeMonths(baby.dob),
          ageDays: getAgeDays(baby.dob),
          gestationalAge: baby.gestationalAge || '',
          lastFeed: lastFeedLog && lastFeedLog.timestamp ? timeAgo(lastFeedLog.timestamp.toDate ? lastFeedLog.timestamp.toDate() : lastFeedLog.timestamp) : '',
          lastSleep: lastSleepLog && lastSleepLog.timestamp ? timeAgo(lastSleepLog.timestamp.toDate ? lastSleepLog.timestamp.toDate() : lastSleepLog.timestamp) : '',
          lastMedication: lastMedicationLog ? (lastMedicationLog.medicationGiven ? 'Given' : 'Not Given') : '',
          status: 'good',
          weight: (baby.currentWeight !== undefined ? baby.currentWeight : '') + ' kg',
        });
        setRecentLogs(logs);
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
  function timeAgo(date: Date) {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'just now';
    if (diffH === 1) return '1 hour ago';
    return `${diffH} hours ago`;
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
    switch (severity) {
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
                          <CardTitle className="text-2xl text-foreground">{babyData.name}</CardTitle>
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
                        <p className="text-xs text-muted-foreground mb-1">{t('dashboard.lastFeed')}</p>
                        <p className="font-semibold text-foreground">{babyData.lastFeed}</p>
                      </div>
                      <div className="text-center p-4 bg-healthcare-mint-light/30 rounded-2xl">
                        <Moon className="w-6 h-6 text-healthcare-mint mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{t('dashboard.lastSleep')}</p>
                        <p className="font-semibold text-foreground">{babyData.lastSleep}</p>
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

              {/* Alerts Section */}
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
                  {alerts.map((alert) => {
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
                          
                          {/* Rule Explanation Button */}
                          <div className="flex justify-end">
                            <RuleExplanationModal alert={alert} />
                          </div>
                          
                          <div className="p-3 bg-primary/5 rounded-xl">
                            <p className="text-sm font-medium text-primary">{alert.action}</p>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentLogs.map((log, index) => (
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
                            <p className="text-xs text-muted-foreground">{timeAgo(log.timestamp?.toDate?.() || log.timestamp)}</p>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {log.type === 'feeding' && log.quantity ? `${log.quantity}ml` : ''}
                          {log.type === 'sleep' && log.duration ? `${log.duration} min` : ''}
                          {log.type === 'medication' && log.medicationGiven ? 'Medication given' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
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
