import { useState, useEffect } from 'react';
import {
  Leaf,
  Heart,
  AlertCircle,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import MotherSelfCareLog from '@/components/dashboard/MotherSelfCareLog';
import NutritionQuiz from '@/components/dashboard/NutritionQuiz';
import NutritionAnalytics from '@/components/dashboard/NutritionAnalytics';
import { nutritionMotherApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const Nutrition = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [motherSummary, setMotherSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('mother');

  // Load data on mount
  useEffect(() => {
    if (!user) return;
    loadNutritionData();
  }, [user, refreshTrigger]);

  const loadNutritionData = async () => {
    try {
      if (refreshTrigger > 0) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const response = await nutritionMotherApi.getSummary().catch((err) => {
        console.error('API Error:', err);
        return null;
      });
      
      console.log('🔄 Mother nutrition summary response:', response);
      console.log('🔄 Response thisWeek:', response?.thisWeek);
      
      if (response && response.thisWeek) {
        console.log('✅ Setting mother summary:', response);
        setMotherSummary(response);
      } else {
        console.warn('⚠️ No thisWeek data in response:', response);
        setMotherSummary(null);
      }
    } catch (error) {
      console.error('❌ Error loading nutrition data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-lg text-muted-foreground">Loading nutrition data...</span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Leaf className="w-8 h-8 text-healthcare-mint" />
              Mother Nutrition & Self-Care Tracker
            </h1>
            <p className="text-muted-foreground">
              Track mother's self-care, nutrition awareness, and daily wellness habits for awareness purposes only
            </p>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mother" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Mother Care
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex items-center gap-2">
                <Leaf className="w-4 h-4" />
                Daily Quiz
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Nutrition Analytics
              </TabsTrigger>
            </TabsList>

            {/* Mother Care Tab */}
            <TabsContent value="mother" className="space-y-6">
              {/* Self-Care Log Component */}
              <MotherSelfCareLog onLogSaved={(summary) => {
                console.log('📝 Self-care saved, received summary:', summary);
                if (summary) {
                  console.log('✅ Immediately setting summary from POST response');
                  setMotherSummary(summary);
                  // Auto-switch to quiz tab after save
                  setTimeout(() => setActiveTab('quiz'), 1000);
                } else {
                  console.log('⚠️ No summary received, fetching via GET');
                  setRefreshTrigger(prev => prev + 1);
                }
              }} />

              {/* Helpful Message */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 mb-1">Next Steps</h3>
                      <p className="text-sm text-blue-800">
                        After logging your self-care, take the Daily Quiz tab to complete your nutrition awareness tracking.
                        View all your analytics in the Nutrition Analytics tab.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Nutrition Quiz Tab */}
            <TabsContent value="quiz" className="space-y-6">
              <NutritionQuiz onQuizComplete={() => {
                console.log('📊 Quiz completed, refreshing data...');
                setRefreshTrigger(prev => prev + 1);
                // Auto-switch to analytics tab after quiz
                setTimeout(() => setActiveTab('analytics'), 1000);
              }} />

              {/* Helpful Message */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-900 mb-1">View Your Results</h3>
                      <p className="text-sm text-green-800">
                        After completing the quiz, head to the Nutrition Analytics tab to see your comprehensive tracking data,
                        charts, and insights.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Nutrition Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              {(() => {
                console.log('🔍 Analytics tab - motherSummary:', motherSummary);
                console.log('🔍 motherSummary.thisWeek:', motherSummary?.thisWeek);
                return null;
              })()}
              
              {isRefreshing && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="pt-6">
                    <div className="flex gap-3 items-center">
                      <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                      <p className="text-sm text-yellow-800">Refreshing analytics data...</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {motherSummary ? (
                <>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-green-900 mb-1">Your Analytics Are Ready!</h3>
                          <p className="text-sm text-green-800">
                            View your comprehensive nutrition tracking data and insights below.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <NutritionAnalytics motherSummary={motherSummary} />
                </>
              ) : (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-blue-900 mb-1">No Data Yet</h3>
                        <p className="text-sm text-blue-800">
                          Complete the Mother Care log and Daily Quiz to see your nutrition analytics and tracking data here.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Disclaimer */}
          <Card className="mt-8 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">For Awareness Only</h3>
                  <p className="text-sm text-blue-800">
                    This nutrition tracker is designed for awareness purposes only. It does not provide medical
                    advice, calorie counts, or nutritional prescriptions. Always consult with healthcare
                    professionals for medical concerns or personalized nutrition guidance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
export default Nutrition;

