import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Check, X } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface NutritionAnalyticsProps {
  motherSummary: any;
}

const NutritionAnalytics = ({ motherSummary }: NutritionAnalyticsProps) => {
  if (!motherSummary) {
    return null;
  }

  // 1️⃣ Daily Nutrition Score Trend (Line Chart)
  const nutritionScoreData = useMemo(() => {
    console.log('📊 motherSummary:', motherSummary);
    console.log('📊 thisWeek:', motherSummary?.thisWeek);
    console.log('📊 nutritionScoreChart:', motherSummary?.thisWeek?.nutritionScoreChart);
    
    const chartData = motherSummary?.thisWeek?.nutritionScoreChart || [];
    console.log('📊 Chart data for line chart:', chartData);
    
    return {
      labels: chartData.map((item: any) => item.day || ''),
      datasets: [
        {
          label: 'Nutrition Score',
          data: chartData.map((item: any) => item.score ?? 0),
          borderColor: 'rgb(147, 51, 234)',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [motherSummary]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `Score: ${context.parsed.y}/10`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        ticks: {
          stepSize: 2,
        },
      },
    },
  };

  // 2️⃣ Meal Consistency Heatmap Data
  const mealConsistencyData = useMemo(() => {
    const weekData = motherSummary?.thisWeek?.mealConsistency || [];
    console.log('📊 Meal consistency data from backend:', weekData);
    
    // Log each day's meal details
    weekData.forEach((day: any) => {
      const mealCount = Object.values(day.meals || {}).filter(Boolean).length;
      console.log(`  📅 ${day.day} (${day.date}): ${mealCount} meals logged`, day.meals);
    });
    
    return weekData;
  }, [motherSummary]);

  // 3️⃣ Weekly Meal Frequency Bar Chart
  const mealFrequencyData = useMemo(() => {
    const chartData = motherSummary?.thisWeek?.mealFrequencyChart || [];
    console.log('📊 Meal frequency data:', chartData);
    
    return {
      labels: chartData.map((item: any) => item.day || ''),
      datasets: [
        {
          label: 'Meals Logged',
          data: chartData.map((item: any) => item.count ?? 0),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
        },
      ],
    };
  }, [motherSummary]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y} meals`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 4,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // 4️⃣ Nutrition Category Radar Chart
  const categoryRadarData = useMemo(() => {
    const categories = motherSummary?.thisWeek?.nutritionCategories || {
      protein: 0,
      vegetables: 0,
      fruits: 0,
      iron: 0,
      hydration: 0,
    };
    console.log('📊 Nutrition categories:', categories);

    return {
      labels: ['Protein', 'Vegetables', 'Fruits', 'Iron', 'Hydration'],
      datasets: [
        {
          label: 'Weekly Average',
          data: [
            categories.protein ?? 0,
            categories.vegetables ?? 0,
            categories.fruits ?? 0,
            categories.iron ?? 0,
            categories.hydration ?? 0,
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(59, 130, 246)',
        },
      ],
    };
  }, [motherSummary]);

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 2,
        ticks: {
          stepSize: 0.5,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nutrition Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your weekly nutrition insights and tracking data
          </p>
        </div>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-pink-50 to-pink-100/50 border-pink-200">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Today's Status</div>
            <div className={`text-lg font-bold ${
              motherSummary.today?.isComplete ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {motherSummary.today?.isComplete ? '✓ Complete' : '○ Incomplete'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Water Logged</div>
            <div className="text-lg font-bold text-cyan-600">
              {motherSummary.today?.selfCare?.waterIntake ? '✓ Yes' : '○ No'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Meals Logged</div>
            <div className="text-lg font-bold text-orange-600">
              {Object.values(motherSummary.today?.selfCare?.mealsTaken || {}).filter(Boolean).length}/4
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1️⃣ Daily Nutrition Score Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Nutrition Score Trend</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track your nutrition quiz scores throughout the week (0-10 scale)
          </p>
        </CardHeader>
        <CardContent>
          {motherSummary?.thisWeek?.nutritionScoreChart && 
           motherSummary.thisWeek.nutritionScoreChart.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Line data={nutritionScoreData} options={lineOptions} />
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <p>No quiz data yet. Complete the daily quiz to see your score trend.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2️⃣ Meal Consistency Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meal Consistency Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visual pattern of your meal logging habits this week
          </p>
        </CardHeader>
        <CardContent>
          {mealConsistencyData && mealConsistencyData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 bg-gray-50 text-sm font-medium">Day</th>
                    <th className="border p-2 bg-gray-50 text-sm font-medium">Breakfast</th>
                    <th className="border p-2 bg-gray-50 text-sm font-medium">Lunch</th>
                    <th className="border p-2 bg-gray-50 text-sm font-medium">Dinner</th>
                    <th className="border p-2 bg-gray-50 text-sm font-medium">Snacks</th>
                  </tr>
                </thead>
                <tbody>
                  {mealConsistencyData.map((day: any, index: number) => (
                    <tr key={index}>
                      <td className="border p-2 font-medium text-sm">{day.day}</td>
                      <td className={`border p-3 text-center ${
                        day.meals.breakfast ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {day.meals.breakfast ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className={`border p-3 text-center ${
                        day.meals.lunch ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {day.meals.lunch ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className={`border p-3 text-center ${
                        day.meals.dinner ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {day.meals.dinner ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className={`border p-3 text-center ${
                        day.meals.snacks ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {day.meals.snacks ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <p>No meal logs yet. Log your mother care meals to see the consistency pattern.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3️⃣ Weekly Meal Frequency Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Meal Frequency</CardTitle>
            <p className="text-sm text-muted-foreground">
              Number of meals logged per day
            </p>
          </CardHeader>
          <CardContent>
            <div style={{ height: '280px' }}>
              <Bar data={mealFrequencyData} options={barOptions} />
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Target: 3 main meals per day
            </div>
          </CardContent>
        </Card>

        {/* 4️⃣ Nutrition Category Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nutrition Category Balance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Weekly average across key nutrition areas
            </p>
          </CardHeader>
          <CardContent>
            <div style={{ height: '280px' }}>
              <Radar data={categoryRadarData} options={radarOptions} />
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Scale: 0 (None) to 2 (Good amount)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Self-Care Stats */}
      {motherSummary.thisWeek?.selfCareStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Self-Care Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-muted-foreground mb-1">Days Tracked</p>
                <p className="text-2xl font-bold text-blue-600">
                  {motherSummary.thisWeek.selfCareStats.daysTracked}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm text-muted-foreground mb-1">Complete Days</p>
                <p className="text-2xl font-bold text-green-600">
                  {motherSummary.thisWeek.selfCareStats.completeDays}
                </p>
              </div>
              <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200">
                <p className="text-sm text-muted-foreground mb-1">Water Days</p>
                <p className="text-2xl font-bold text-cyan-600">
                  {motherSummary.thisWeek.selfCareStats.waterDays}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                <p className="text-sm text-muted-foreground mb-1">Meal Days (2+)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {motherSummary.thisWeek.selfCareStats.mealDays}
                </p>
              </div>
            </div>

            {/* Completion Rate Progress Bar */}
            <div className="p-4 bg-white/60 rounded-xl border border-pink-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Weekly Completion Rate</span>
                <span className="text-xl font-bold text-pink-600">
                  {motherSummary.thisWeek.selfCareStats.completionRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-pink-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${motherSummary.thisWeek.selfCareStats.completionRate}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Nutrition Score */}
      {motherSummary.thisMonth?.averageScore !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Nutrition Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                <p className="text-3xl font-bold text-purple-600">
                  {motherSummary.thisMonth.averageScore.toFixed(1)}
                  <span className="text-lg">/10</span>
                </p>
              </div>
              <div className="p-4 bg-white/60 rounded-xl border border-pink-200">
                <p className="text-sm text-muted-foreground mb-1">Days Tracked</p>
                <p className="text-2xl font-bold">
                  {motherSummary.thisMonth.daysTracked}
                </p>
              </div>
              <div className="p-4 bg-white/60 rounded-xl border border-pink-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Trend</p>
                  <p className="text-sm font-medium capitalize">
                    {motherSummary.thisMonth.trend}
                  </p>
                </div>
                {getTrendIcon(motherSummary.thisMonth.trend)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positive Indicators */}
      {motherSummary.positiveIndicators?.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg text-green-700">
              ✓ Positive Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {motherSummary.positiveIndicators.map((indicator: string, index: number) => (
                <li
                  key={index}
                  className="text-sm text-green-700 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-green-600" />
                  {indicator}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NutritionAnalytics;
