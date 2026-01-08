import { useState, useEffect } from 'react';
import { getCareLogsByBaby, getBabiesByParent } from '@/lib/firestore';
import { alertsApi, babiesApi, prescriptionsApi } from '@/lib/api';
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
  Pill,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  const [babyId, setBabyId] = useState<string | null>(null);
  const [ageSummary, setAgeSummary] = useState<{
    actualAgeWeeks: number;
    correctedAgeWeeks: number;
    weeksEarly: number;
    isPremature: boolean;
    gestationalAge: number | null;
  } | null>(null);
  const [developmentThisWeek, setDevelopmentThisWeek] = useState<string | null>(null);
  const [loadingDevelopment, setLoadingDevelopment] = useState(false);
  const [dailySummary, setDailySummary] = useState({
    totalFeedMl: 0,
    totalSleepMinutes: 0,
  });
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

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
        setBabyId(baby.id);
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

        // Fetch deterministic age summary for dual-timeline tracker
        try {
          const summary = await babiesApi.getAgeSummary(baby.id);
          setAgeSummary({
            actualAgeWeeks: summary.actualAgeWeeks,
            correctedAgeWeeks: summary.correctedAgeWeeks,
            weeksEarly: summary.weeksEarly,
            isPremature: summary.isPremature,
            gestationalAge: summary.gestationalAge,
          });
        } catch (error) {
          console.error('Error fetching age summary:', error);
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

        // Fetch prescriptions for this baby
        try {
          const prescriptionsData = await prescriptionsApi.getByBaby(baby.id);
          setPrescriptions(prescriptionsData.prescriptions || []);
        } catch (error) {
          console.error('Error fetching prescriptions:', error);
        }
      }
    }
    fetchBabyAndLogs();
  }, [user]);

  // Fetch Gemini explainability for development milestones (premature only)
  useEffect(() => {
    async function fetchDevelopmentThisWeek() {
      console.log('🔄 [Frontend] useEffect triggered for development insight');
      console.log('   - ageSummary:', ageSummary);
      console.log('   - babyId:', babyId);
      console.log('   - isPremature:', ageSummary?.isPremature);
      console.log('   - correctedAgeWeeks:', ageSummary?.correctedAgeWeeks);
      
      if (!ageSummary || !ageSummary.isPremature || !babyId) {
        console.log('⚠️ [Frontend] Conditions not met, skipping fetch:');
        console.log('   - ageSummary exists:', !!ageSummary);
        console.log('   - isPremature:', ageSummary?.isPremature);
        console.log('   - babyId exists:', !!babyId);
        setDevelopmentThisWeek(null);
        return;
      }

      try {
        setLoadingDevelopment(true);
        console.log('🔍 [Frontend] Fetching development insight for baby:', babyId);
        console.log('📊 [Frontend] Age summary:', JSON.stringify(ageSummary, null, 2));
        console.log('📊 [Frontend] Corrected age check:', ageSummary.correctedAgeWeeks, 'weeks (should be > 0)');
        
        const result = await babiesApi.getDevelopmentThisWeek(babyId);
        
        console.log('✅ [Frontend] Received response from API:');
        console.log('   - Full result:', JSON.stringify(result, null, 2));
        console.log('   - Corrected age:', result.correctedAgeWeeks, 'weeks');
        console.log('   - Is premature:', result.isPremature);
        console.log('   - Content type:', typeof result.content);
        console.log('   - Content value:', result.content);
        console.log('   - Content is null:', result.content === null);
        console.log('   - Content is undefined:', result.content === undefined);
        console.log('   - Content is empty string:', result.content === '');
        console.log('   - Content length:', result.content?.length || 0, 'characters');
        
        if (result && result.isPremature) {
          if (result.content) {
            console.log('✅ [Frontend] Setting development content (content exists)');
            console.log('   - Content preview:', result.content.substring(0, 200));
            setDevelopmentThisWeek(result.content);
          } else {
            console.warn('⚠️ [Frontend] Content is null/empty, setting to null');
            console.warn('   - This means AI call may have failed or returned empty');
            setDevelopmentThisWeek(null);
          }
        } else {
          console.log('ℹ️ [Frontend] Baby is not premature, clearing content');
          setDevelopmentThisWeek(null);
        }
      } catch (error) {
        console.error('❌ [Frontend] Error fetching development this week content:', error);
        console.error('   - Error message:', error.message);
        console.error('   - Error stack:', error.stack);
        setDevelopmentThisWeek(null);
      } finally {
        setLoadingDevelopment(false);
        console.log('🏁 [Frontend] Fetch complete, loading set to false');
      }
    }

    fetchDevelopmentThisWeek();
  }, [ageSummary, babyId]);

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
              {/* Baby Summary + Dual Timeline Card */}
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
                            {ageSummary?.isPremature && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                                <span className="text-xs">🟣</span>
                                <span>PREMATURE</span>
                              </span>
                            )}
                            {babyType && !ageSummary?.isPremature && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  babyType === 'PREMATURE'
                                    ? 'bg-healthcare-peach/20 text-healthcare-peach-dark'
                                    : 'bg-healthcare-mint-light/20 text-healthcare-mint'
                                }`}
                              >
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
                  <CardContent className="pt-6 space-y-6">
                    {/* Dual Timeline Tracker (Actual vs Corrected Age) */}
                    {ageSummary && (
                      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-primary/10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              Age Tracker
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Based on your baby&apos;s birth and gestational age.
                            </p>
                          </div>
                          {ageSummary.isPremature && (
                            <div className="text-right max-w-xs text-xs text-muted-foreground">
                              <span className="font-medium text-foreground block mb-1">
                                Why corrected age?
                              </span>
                              <span>
                                Corrected age accounts for early birth and is used for developmental tracking.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">Actual age</span>
                            <span className="font-semibold text-foreground">
                              {ageSummary.actualAgeWeeks} weeks
                            </span>
                          </div>
                          {ageSummary.isPremature && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-purple-700">Corrected age</span>
                              <span className="font-semibold text-purple-700">
                                {ageSummary.correctedAgeWeeks} weeks
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Progress bars (max 52 weeks) */}
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
                              <span>Chronological age (actual)</span>
                              <span>{Math.min(ageSummary.actualAgeWeeks, 52)} / 52 weeks</span>
                            </div>
                            {/* Using a simple div-based progress bar to keep styling consistent */}
                            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(
                                    (ageSummary.actualAgeWeeks / 52) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          {ageSummary.isPremature && (
                            <div>
                              <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
                                <span>Developmental age (corrected)</span>
                                <span>{Math.min(ageSummary.correctedAgeWeeks, 52)} / 52 weeks</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-purple-500 transition-all"
                                  style={{
                                    width: `${Math.min(
                                      (ageSummary.correctedAgeWeeks / 52) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Summary metrics */}
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

              {/* Development This Week (Gemini explainability-only, premature only) */}
              {ageSummary?.isPremature && (
                <Card className="border border-primary/20 shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Development This Week</CardTitle>
                    </div>
                    {typeof ageSummary.correctedAgeWeeks === 'number' && (
                      <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
                        Corrected age: <span className="font-semibold text-primary">{ageSummary.correctedAgeWeeks} weeks</span>
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingDevelopment && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing developmental milestones for this week...
                      </div>
                    )}

                    {!loadingDevelopment && developmentThisWeek && (() => {
                      // Parse the content to extract milestones and tips
                      const lines = developmentThisWeek.split('\n').filter(line => line.trim());
                      const milestones: string[] = [];
                      const tips: string[] = [];
                      let currentSection = '';
                      let introText = '';

                      lines.forEach(line => {
                        const trimmed = line.trim();
                        // Detect milestone markers
                        if (trimmed.includes('**') && (trimmed.toLowerCase().includes('rolling') || 
                            trimmed.toLowerCase().includes('sitting') || 
                            trimmed.toLowerCase().includes('hands') ||
                            trimmed.toLowerCase().includes('crawling') ||
                            trimmed.toLowerCase().includes('babbling') ||
                            trimmed.toLowerCase().includes('grasping'))) {
                          const milestone = trimmed.replace(/\*\*/g, '').replace(/^[•\-\*]\s*/, '').trim();
                          if (milestone) milestones.push(milestone);
                        } else if (trimmed.toLowerCase().includes('play tip') || trimmed.toLowerCase().includes('fun tip')) {
                          currentSection = 'tip';
                        } else if (currentSection === 'tip' && trimmed.length > 10 && !trimmed.includes('Remember')) {
                          const tip = trimmed.replace(/\*\*/g, '').replace(/^[•\-\*]\s*/, '').trim();
                          if (tip && !tip.toLowerCase().includes('tip:')) tips.push(tip);
                        } else if (trimmed.length > 30 && !trimmed.includes('milestone') && !trimmed.includes('**') && 
                                   !trimmed.toLowerCase().includes('remember') && !trimmed.toLowerCase().includes('concern')) {
                          introText = trimmed.substring(0, 150) + (trimmed.length > 150 ? '...' : '');
                        }
                      });

                      // Fallback: extract any bullet points or numbered items
                      if (milestones.length === 0) {
                        lines.forEach(line => {
                          const trimmed = line.trim();
                          if ((trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || 
                               /^\d+\./.test(trimmed) || trimmed.startsWith('**')) && 
                              trimmed.length > 15 && !trimmed.toLowerCase().includes('remember')) {
                            const cleaned = trimmed.replace(/^\d+\.\s*/, '').replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, '').trim();
                            if (cleaned) {
                              if (cleaned.toLowerCase().includes('tip') || cleaned.toLowerCase().includes('play')) {
                                tips.push(cleaned);
                              } else {
                                milestones.push(cleaned);
                              }
                            }
                          }
                        });
                      }

                      // If still no milestones, show first few meaningful lines as bullets
                      if (milestones.length === 0 && lines.length > 0) {
                        lines.slice(0, 5).forEach(line => {
                          const trimmed = line.trim();
                          if (trimmed.length > 20 && !trimmed.toLowerCase().includes('remember') && 
                              !trimmed.toLowerCase().includes('pediatrician') && !trimmed.toLowerCase().includes('concern')) {
                            milestones.push(trimmed.substring(0, 120) + (trimmed.length > 120 ? '...' : ''));
                          }
                        });
                      }

                      return (
                        <div className="space-y-4">
                          {introText && (
                            <p className="text-sm text-foreground leading-relaxed">
                              {introText}
                            </p>
                          )}

                          {milestones.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                Milestones This Week
                              </h4>
                              <ul className="space-y-2 ml-4">
                                {milestones.slice(0, 4).map((milestone, idx) => (
                                  <li key={idx} className="text-sm text-foreground/90 leading-relaxed list-disc">
                                    <span className="font-medium">{milestone.split(':')[0]}</span>
                                    {milestone.includes(':') && (
                                      <span className="text-muted-foreground">: {milestone.split(':').slice(1).join(':').trim()}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {tips.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/40">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Play Tip
                              </h4>
                              <ul className="space-y-2 ml-4">
                                {tips.slice(0, 2).map((tip, idx) => (
                                  <li key={idx} className="text-sm text-foreground/90 leading-relaxed list-disc">
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Separator className="my-3" />
                          
                          <p className="text-xs text-muted-foreground italic">
                            This is general developmental information, not medical advice.
                          </p>
                        </div>
                      );
                    })()}

                    {!loadingDevelopment && !developmentThisWeek && (
                      <p className="text-sm text-muted-foreground">
                        Developmental highlights for this week will appear here when available.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Prescription Status Section */}
              {prescriptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Pill className="w-5 h-5 text-healthcare-peach-dark" />
                      Medication Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {prescriptions
                      .filter((p: any) => p.status === 'confirmed' || p.status === 'scheduled')
                      .slice(0, 3)
                      .flatMap((prescription: any) => {
                        // Handle both old format (single medicine) and new format (medicines array)
                        const medicines = prescription.medicines || (prescription.medicine_name ? [{
                          medicine_name: prescription.medicine_name,
                          dosage: prescription.dosage,
                          frequency: prescription.frequency,
                          times_per_day: prescription.times_per_day,
                          suggested_start_time: prescription.suggested_start_time,
                        }] : []);

                        return medicines.map((medicine: any, medIndex: number) => {
                          // Calculate next dose time
                          const [hours, minutes] = (medicine.suggested_start_time || '08:00').split(':');
                          const nextDose = new Date();
                          nextDose.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                          
                          // If time has passed today, set for tomorrow
                          if (nextDose < new Date()) {
                            nextDose.setDate(nextDose.getDate() + 1);
                          }

                          const isUpcoming = nextDose > new Date();
                          const timeStr = nextDose.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          });

                          return (
                            <div
                              key={`${prescription.id}-${medIndex}`}
                              className="p-4 rounded-xl border border-healthcare-peach/20 bg-healthcare-peach/5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Pill className="w-4 h-4 text-healthcare-peach-dark" />
                                    <span className="font-medium text-foreground">
                                      {medicine.medicine_name || 'Medication'}
                                    </span>
                                    {medicines.length > 1 && (
                                      <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                                        {medIndex + 1}/{medicines.length}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {medicine.dosage || 'As prescribed'} • {medicine.frequency || 'As directed'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {medicine.times_per_day || 2}x per day
                                  </p>
                                  {isUpcoming ? (
                                    <p className="text-xs text-healthcare-peach-dark font-medium">
                                      Next dose: {timeStr}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Scheduled for {timeStr}
                                    </p>
                                  )}
                                </div>
                                {!isUpcoming && (
                                  <CheckCircle2 className="w-5 h-5 text-alert-success flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })}
                    {prescriptions.filter((p: any) => {
                      const medicines = p.medicines || (p.medicine_name ? [p] : []);
                      return (p.status === 'confirmed' || p.status === 'scheduled') && medicines.length > 0;
                    }).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active medication schedules
                      </p>
                    )}
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
