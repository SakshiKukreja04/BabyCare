import { useState } from 'react';
import {
  Droplet,
  UtensilsCrossed,
  Battery,
  Baby,
  Clock,
  CheckCircle2,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const Nutrition = () => {
  const [waterIntake, setWaterIntake] = useState(false);
  const [meals, setMeals] = useState({
    breakfast: false,
    lunch: false,
    dinner: false,
    snacks: false,
  });
  const [energyLevel, setEnergyLevel] = useState<string>('');
  const [feedingCount, setFeedingCount] = useState<string>('');
  const [feedingType, setFeedingType] = useState<string>('');
  const [lastFeedingTime, setLastFeedingTime] = useState<string>('');

  // Mock data for charts
  const feedingFrequencyData = [
    { day: 'Mon', count: 6 },
    { day: 'Tue', count: 7 },
    { day: 'Wed', count: 6 },
    { day: 'Thu', count: 8 },
    { day: 'Fri', count: 7 },
    { day: 'Sat', count: 6 },
    { day: 'Sun', count: 7 },
  ];

  const hydrationData = [
    { day: 'Mon', logged: true },
    { day: 'Tue', logged: true },
    { day: 'Wed', logged: false },
    { day: 'Thu', logged: true },
    { day: 'Fri', logged: true },
    { day: 'Sat', logged: true },
    { day: 'Sun', logged: true },
  ];

  const chartConfig = {
    count: {
      label: 'Feedings',
      color: 'hsl(var(--healthcare-blue))',
    },
  };

  const handleMealChange = (meal: keyof typeof meals) => {
    setMeals((prev) => ({ ...prev, [meal]: !prev[meal] }));
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Nutrition Awareness</h1>
            <p className="text-muted-foreground">
              Track self-care and baby nutrition habits (for awareness only, not medical advice)
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Mother Self-Care Logs */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-healthcare-peach-dark" />
                  Mother Self-Care Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Water Intake */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <Droplet className="w-5 h-5 text-primary" />
                    Water Intake Today
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="water"
                      checked={waterIntake}
                      onCheckedChange={(checked) => setWaterIntake(checked === true)}
                    />
                    <Label htmlFor="water" className="cursor-pointer">
                      Adequate water intake logged
                    </Label>
                  </div>
                </div>

                {/* Meals */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <UtensilsCrossed className="w-5 h-5 text-healthcare-peach-dark" />
                    Meals Taken Today
                  </Label>
                  <div className="space-y-2">
                    {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((meal) => (
                      <div key={meal} className="flex items-center gap-2">
                        <Checkbox
                          id={meal}
                          checked={meals[meal]}
                          onCheckedChange={() => handleMealChange(meal)}
                        />
                        <Label htmlFor={meal} className="cursor-pointer capitalize">
                          {meal}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Energy Level */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <Battery className="w-5 h-5 text-healthcare-mint" />
                    Energy Level
                  </Label>
                  <Select value={energyLevel} onValueChange={setEnergyLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select energy level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" size="lg">
                  Save Self-Care Log
                </Button>
              </CardContent>
            </Card>

            {/* Baby Daily Eating Habits */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Baby className="w-5 h-5 text-primary" />
                  Baby Daily Eating Habits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Feeding Count */}
                <div className="space-y-3">
                  <Label htmlFor="feedingCount" className="text-base font-medium">
                    Feeding Count Today
                  </Label>
                  <Input
                    id="feedingCount"
                    type="number"
                    placeholder="Enter number of feedings"
                    value={feedingCount}
                    onChange={(e) => setFeedingCount(e.target.value)}
                  />
                </div>

                {/* Feeding Type */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Feeding Type</Label>
                  <Select value={feedingType} onValueChange={setFeedingType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select feeding type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breast">Breast</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Last Feeding Time */}
                <div className="space-y-3">
                  <Label htmlFor="lastFeeding" className="flex items-center gap-2 text-base font-medium">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Last Feeding Time
                  </Label>
                  <Input
                    id="lastFeeding"
                    type="time"
                    value={lastFeedingTime}
                    onChange={(e) => setLastFeedingTime(e.target.value)}
                  />
                </div>

                <Button className="w-full" size="lg">
                  Save Baby Feeding Log
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Nutrition Awareness Summary */}
          <Card className="mt-6 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-healthcare-mint" />
                Nutrition Awareness Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-alert-success" />
                    <span>Consistent feeding logged</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-alert-success" />
                    <span>Hydration reminders helpful</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-alert-success" />
                    <span>Regular meal patterns observed</span>
                  </div>
                </div>
                <div className="p-4 bg-healthcare-mint-light/30 rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> This summary is for awareness purposes only. It does not provide medical advice, calorie counts, or nutritional prescriptions. Always consult with healthcare professionals for medical concerns.
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Feeding Frequency (This Week)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[200px]">
                      <BarChart data={feedingFrequencyData}>
                        <XAxis dataKey="day" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Hydration Consistency (This Week)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[200px]">
                      <BarChart data={hydrationData.map((d) => ({ ...d, logged: d.logged ? 1 : 0 }))}>
                        <XAxis dataKey="day" />
                        <YAxis domain={[0, 1]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="logged" fill="var(--color-count)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Nutrition;

