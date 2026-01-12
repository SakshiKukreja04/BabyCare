import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { careLogsApi, weightTrackingApi, alertsApi } from '@/lib/api';
import { getBabiesByParent } from '@/lib/firestore';
import {
  calculateMonthlyAnalytics,
  getMonthName,
  getCurrentMonthInfo,
  getLogsPerWeek,
  getConsistencyStatus,
  getWeightChartData,
  getWeightTrend,
} from '@/lib/analytics';

const Analytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthlyOverview, setMonthlyOverview] = useState({
    month: '',
    daysWithLogs: 0,
    missedDays: 0,
    consistency: 0,
    consistencyLevel: 'Poor' as 'Excellent' | 'Good' | 'Needs Attention' | 'Poor',
    daysCountedForConsistency: 0,
    startDate: null as string | null,
  });
  const [logsPerWeekData, setLogsPerWeekData] = useState<Array<{ week: string; logs: number }>>([]);
  const [weightChartData, setWeightChartData] = useState<Array<{ week: string; weight: number }>>([]);
  const [weightTrend, setWeightTrend] = useState<{ trend: 'increasing' | 'decreasing' | 'stable'; change: number }>({
    trend: 'stable',
    change: 0,
  });
  const [alertHistory, setAlertHistory] = useState({
    low: 0,
    medium: 0,
    high: 0,
  });
  const [babyName, setBabyName] = useState('Baby');

  const chartConfig = {
    weight: {
      label: 'Weight (kg)',
      color: 'hsl(var(--healthcare-blue))',
    },
    logs: {
      label: 'Logs',
      color: 'hsl(var(--healthcare-mint))',
    },
  };

  // Fetch care logs on component mount
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        if (!user?.uid) return;

        // Get babies for the parent
        const babies = await getBabiesByParent(user.uid);
        if (babies.length === 0) {
          setLoading(false);
          return;
        }

        const babyId = babies[0].id;
        setBabyName(babies[0].name || 'Baby');

        // Fetch care logs for the baby
        const response = await careLogsApi.getByBaby(babyId, 1000);
        const careLogs = response.careLogs || [];

        // Calculate monthly analytics for current month
        const { month, year } = getCurrentMonthInfo();
        const analytics = calculateMonthlyAnalytics(careLogs, month, year);

        // Get logs per week for chart (now counts total logs, not unique days)
        const weeksData = getLogsPerWeek(careLogs, month, year);

        // Fetch all weight entries for the baby (to show complete history)
        const weightResponse = await weightTrackingApi.getWeightEntries(babyId, 500);
        const weightEntries = weightResponse.weightEntries || [];

        // Process weight data for chart
        const processedWeightData = getWeightChartData(weightEntries);
        const trend = getWeightTrend(weightEntries);

        // Fetch alert history for current month
        const alertResponse = await alertsApi.getMonthlyHistory(babyId, month, year);
        console.log('Alert response:', alertResponse);
        const alertData = alertResponse.alerts || { low: 0, medium: 0, high: 0 };
        console.log('Alert data:', alertData);

        setMonthlyOverview({
          month: analytics.month,
          daysWithLogs: analytics.daysWithLogs,
          missedDays: analytics.missedDays,
          consistency: analytics.consistency,
          consistencyLevel: analytics.consistencyLevel,
          daysCountedForConsistency: analytics.daysWithLogs + analytics.missedDays,
          startDate: null,
        });

        setLogsPerWeekData(weeksData);
        setWeightChartData(processedWeightData);
        setWeightTrend(trend);
        setAlertHistory({
          low: alertData.low,
          medium: alertData.medium,
          high: alertData.high,
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [user]);

  const getConsistencyColor = (consistencyLevel: string) => {
    switch (consistencyLevel) {
      case 'Excellent':
        return 'bg-alert-success/20 text-alert-success border border-alert-success/30';
      case 'Good':
        return 'bg-healthcare-mint/20 text-healthcare-mint border border-healthcare-mint/30';
      case 'Needs Attention':
        return 'bg-alert-medium/20 text-alert-medium border border-alert-medium/30';
      case 'Poor':
        return 'bg-alert-high/20 text-alert-high border border-alert-high/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Daily Analytics</h1>
            <p className="text-muted-foreground">
              High-level overview of baby care consistency & growth awareness
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Monthly Care Overview */}
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Monthly Care Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-healthcare-blue-light/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Days with Logs</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyOverview.daysWithLogs}</p>
                  </div>
                  <div className="p-4 bg-healthcare-peach/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Missed Days</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyOverview.missedDays}</p>
                  </div>
                  <div className="p-4 bg-healthcare-mint-light/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Consistency %</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyOverview.consistency}%</p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-start gap-2">
                    {monthlyOverview.consistencyLevel === 'Excellent' || monthlyOverview.consistencyLevel === 'Good' ? (
                      <CheckCircle2 className="w-5 h-5 text-alert-success mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-alert-medium mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Consistency Indicator: {monthlyOverview.consistencyLevel}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {monthlyOverview.consistencyLevel === 'Excellent' || monthlyOverview.consistencyLevel === 'Good'
                          ? "You're maintaining regular care logs. Keep it up!"
                          : 'Consider logging more consistently for better insights.'}
                      </p>
                      {monthlyOverview.daysCountedForConsistency > 0 && (
                        <p className="text-xs text-muted-foreground font-medium">
                          Calculated over {monthlyOverview.daysCountedForConsistency} day{monthlyOverview.daysCountedForConsistency !== 1 ? 's' : ''} (from when you started logging)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong>{monthlyOverview.month}</strong> - Consistency is calculated from your first log entry. If logs are entered on any day, that day counts as 1. Only days since you started logging are counted as missed days.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Alert History Summary */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-alert-medium" />
                  Alert History Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-alert-low/10 rounded-xl border border-alert-low/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-alert-low" />
                    <span className="text-sm font-medium">Low Alerts</span>
                  </div>
                  <Badge variant="outline" className="bg-alert-low/20 text-alert-low border-alert-low/30">
                    {alertHistory.low}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-alert-medium/10 rounded-xl border border-alert-medium/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-alert-medium" />
                    <span className="text-sm font-medium">Medium Alerts</span>
                  </div>
                  <Badge variant="outline" className="bg-alert-medium/20 text-alert-medium border-alert-medium/30">
                    {alertHistory.medium}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-alert-high/10 rounded-xl border border-alert-high/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-alert-high" />
                    <span className="text-sm font-medium">High Alerts</span>
                  </div>
                  <Badge variant="outline" className="bg-alert-high/20 text-alert-high border-alert-high/30">
                    {alertHistory.high}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Baby Growth Awareness */}
          <Card className="mb-6 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-healthcare-mint" />
                  Baby Growth Awareness
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-alert-medium/5 border border-alert-medium/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-alert-medium mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Disclaimer</p>
                    <p className="text-xs text-muted-foreground">
                      Trends shown are for awareness only. This is not medical data. Always consult healthcare professionals for medical assessments.
                    </p>
                  </div>
                </div>
              </div>

              {weightChartData.length > 0 ? (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    {weightChartData.length > 1 && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        weightTrend.trend === 'increasing' ? 'bg-alert-success/10' :
                        weightTrend.trend === 'decreasing' ? 'bg-alert-medium/10' :
                        'bg-secondary/50'
                      }`}>
                        {weightTrend.trend === 'increasing' ? (
                          <ArrowUp className="w-4 h-4 text-alert-success" />
                        ) : weightTrend.trend === 'decreasing' ? (
                          <ArrowDown className="w-4 h-4 text-alert-medium" />
                        ) : null}
                        <span className={`text-sm font-medium ${
                          weightTrend.trend === 'increasing' ? 'text-alert-success' :
                          weightTrend.trend === 'decreasing' ? 'text-alert-medium' :
                          'text-muted-foreground'
                        }`}>
                          {weightTrend.trend === 'stable' ? 'Weight Stable' : `${Math.abs(weightTrend.change).toFixed(2)}kg ${weightTrend.trend === 'increasing' ? 'gain' : 'loss'}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={weightChartData}>
                      <XAxis dataKey="week" />
                      <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="var(--color-weight)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </>
              ) : (
                <div className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">No weight data recorded yet. Add weight entries from the Daily Log page.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logs Per Week */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Daily Logs Tracking - {monthlyOverview.month}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsPerWeekData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <BarChart data={logsPerWeekData}>
                    <XAxis dataKey="week" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="logs" fill="var(--color-logs)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">No logs recorded yet for this month</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;

