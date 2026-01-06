import { Calendar, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const Analytics = () => {
  // Mock data
  const monthlyOverview = {
    logsCount: 28,
    missedDays: 3,
    consistency: 'Good' as const,
  };

  const weightData = [
    { date: 'Week 1', weight: 4.2 },
    { date: 'Week 2', weight: 4.4 },
    { date: 'Week 3', weight: 4.5 },
    { date: 'Week 4', weight: 4.7 },
    { date: 'Week 5', weight: 4.8 },
    { date: 'Week 6', weight: 5.0 },
    { date: 'Week 7', weight: 5.1 },
    { date: 'Week 8', weight: 5.2 },
  ];

  const logsPerWeek = [
    { week: 'Week 1', logs: 6 },
    { week: 'Week 2', logs: 7 },
    { week: 'Week 3', logs: 5 },
    { week: 'Week 4', logs: 8 },
  ];

  const alertHistory = {
    low: 12,
    medium: 5,
    high: 1,
  };

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

  const getConsistencyColor = (consistency: string) => {
    switch (consistency) {
      case 'Good':
        return 'bg-alert-success text-alert-success';
      case 'Needs Attention':
        return 'bg-alert-medium text-alert-medium';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

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
                    <p className="text-sm text-muted-foreground mb-1">Total Logs</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyOverview.logsCount}</p>
                  </div>
                  <div className="p-4 bg-healthcare-peach/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Missed Days</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyOverview.missedDays}</p>
                  </div>
                  <div className="p-4 bg-healthcare-mint-light/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Consistency</p>
                    <Badge className={`mt-1 ${getConsistencyColor(monthlyOverview.consistency)}`}>
                      {monthlyOverview.consistency}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-start gap-2">
                    {monthlyOverview.consistency === 'Good' ? (
                      <CheckCircle2 className="w-5 h-5 text-alert-success mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-alert-medium mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Consistency Indicator: {monthlyOverview.consistency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {monthlyOverview.consistency === 'Good'
                          ? 'You\'re maintaining regular care logs. Keep it up!'
                          : 'Consider logging more consistently for better insights.'}
                      </p>
                    </div>
                  </div>
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
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-healthcare-mint" />
                Baby Growth Awareness
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

              <ChartContainer config={chartConfig} className="h-[300px]">
                <LineChart data={weightData}>
                  <XAxis dataKey="date" />
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
            </CardContent>
          </Card>

          {/* Logs Per Week */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Logs Per Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={logsPerWeek}>
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="logs" fill="var(--color-logs)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;

