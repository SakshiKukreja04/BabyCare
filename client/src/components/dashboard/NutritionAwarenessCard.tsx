import { useState, useEffect } from 'react';
import { Leaf, ChevronDown, TrendingUp, TrendingDown, Minus, Droplets, Utensils, Baby, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { nutritionBabyApi, nutritionMotherApi } from '@/lib/api';

interface NutritionAwarenessCardProps {
  babyId?: string;
}

interface ChartData {
  day: string;
  count?: number;
  score?: number | null;
}

const NutritionAwarenessCard = ({ babyId }: NutritionAwarenessCardProps) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('baby');
  const [babySummary, setBabySummary] = useState<any>(null);
  const [motherSummary, setMotherSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNutritionData();
  }, [babyId]);

  const loadNutritionData = async () => {
    try {
      setIsLoading(true);
      
      const [babyData, motherData] = await Promise.all([
        babyId ? nutritionBabyApi.getSummary(babyId).catch(() => null) : Promise.resolve(null),
        nutritionMotherApi.getSummary().catch(() => null),
      ]);
      
      setBabySummary(babyData);
      setMotherSummary(motherData);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMiniBarChart = (data: ChartData[], maxValue: number, color: string) => {
    return (
      <div className="flex items-end gap-1 h-16">
        {data.map((item, index) => {
          const value = item.count ?? item.score ?? 0;
          const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div 
                className={`w-full rounded-t ${color} transition-all`}
                style={{ height: `${Math.max(height, 4)}%`, minHeight: value > 0 ? '4px' : '2px' }}
              />
              <span className="text-[10px] text-muted-foreground mt-1">{item.day}</span>
            </div>
          );
        })}
      </div>
    );
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

  const nutritionTips = [
    {
      id: 'iron',
      title: t('nutrition.iron.title'),
      content: t('nutrition.iron.content'),
    },
    {
      id: 'hydration',
      title: t('nutrition.hydration.title'),
      content: t('nutrition.hydration.content'),
    },
    {
      id: 'meals',
      title: t('nutrition.meals.title'),
      content: t('nutrition.meals.content'),
    },
    {
      id: 'traditional',
      title: t('nutrition.traditional.title'),
      content: t('nutrition.traditional.content'),
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-healthcare-mint-light/40 to-healthcare-mint-light/20 border-healthcare-mint/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-healthcare-mint-dark">
          <div className="w-8 h-8 rounded-full bg-healthcare-mint/20 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-healthcare-mint" />
          </div>
          {t('nutrition.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t('nutrition.subtitle')}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="baby" className="text-xs">
              <Baby className="w-3 h-3 mr-1" />
              Baby Feeding
            </TabsTrigger>
            <TabsTrigger value="mother" className="text-xs">
              <Utensils className="w-3 h-3 mr-1" />
              Mother Care
            </TabsTrigger>
          </TabsList>

          {/* Baby Feeding Tab */}
          <TabsContent value="baby" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Loading feeding data...
              </div>
            ) : babySummary ? (
              <>
                {/* Today's Feeding Count */}
                <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Today's Feedings</p>
                      <p className="text-2xl font-bold text-healthcare-mint-dark">
                        {babySummary.today?.suggestedFeedingCount || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`text-sm font-medium ${
                        babySummary.thisWeek?.consistencyIndicator?.status === 'consistent' 
                          ? 'text-green-600' 
                          : 'text-yellow-600'
                      }`}>
                        {babySummary.thisWeek?.consistencyIndicator?.status === 'consistent' 
                          ? '✓ Consistent' 
                          : babySummary.thisWeek?.consistencyIndicator?.status === 'irregular'
                          ? '○ Irregular'
                          : '— No data'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Weekly Feeding Chart */}
                {babySummary.thisWeek?.feedingFrequencyChart && (
                  <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                    <p className="text-xs text-muted-foreground mb-2">This Week's Feeding Frequency</p>
                    {renderMiniBarChart(
                      babySummary.thisWeek.feedingFrequencyChart,
                      Math.max(...babySummary.thisWeek.feedingFrequencyChart.map((d: ChartData) => d.count || 0), 8),
                      'bg-healthcare-mint'
                    )}
                  </div>
                )}

                {/* Feeding Type Distribution */}
                {babySummary.thisWeek?.feedingTypeDistribution && babySummary.thisWeek.feedingTypeDistribution.total > 0 && (
                  <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                    <p className="text-xs text-muted-foreground mb-2">Feeding Type This Week</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Breast</span>
                        <Progress 
                          value={babySummary.thisWeek.feedingTypeDistribution.breast.percentage} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs w-8 text-right">
                          {babySummary.thisWeek.feedingTypeDistribution.breast.percentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Formula</span>
                        <Progress 
                          value={babySummary.thisWeek.feedingTypeDistribution.formula.percentage} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs w-8 text-right">
                          {babySummary.thisWeek.feedingTypeDistribution.formula.percentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Mixed</span>
                        <Progress 
                          value={babySummary.thisWeek.feedingTypeDistribution.mixed.percentage} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs w-8 text-right">
                          {babySummary.thisWeek.feedingTypeDistribution.mixed.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Positive Indicators */}
                {babySummary.positiveIndicators?.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Positive Observations</p>
                    <ul className="space-y-1">
                      {babySummary.positiveIndicators.map((indicator: string, index: number) => (
                        <li key={index} className="text-xs text-green-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No feeding data available yet.
              </div>
            )}
          </TabsContent>

          {/* Mother Care Tab */}
          <TabsContent value="mother" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Loading self-care data...
              </div>
            ) : motherSummary ? (
              <>
                {/* Today's Self-Care Status */}
                <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Today's Self-Care</p>
                      <p className={`text-sm font-medium ${
                        motherSummary.today?.isComplete ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {motherSummary.today?.isComplete ? '✓ Complete' : '○ Incomplete'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className={`p-2 rounded-lg ${
                        motherSummary.today?.selfCare?.waterIntake ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Droplets className={`w-4 h-4 ${
                          motherSummary.today?.selfCare?.waterIntake ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className={`p-2 rounded-lg ${
                        motherSummary.today?.selfCare?.mealsTaken?.breakfast ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        <Utensils className={`w-4 h-4 ${
                          motherSummary.today?.selfCare?.mealsTaken?.breakfast ? 'text-orange-600' : 'text-gray-400'
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weekly Self-Care Stats */}
                {motherSummary.thisWeek?.selfCareStats && (
                  <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                    <p className="text-xs text-muted-foreground mb-2">This Week's Self-Care</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-healthcare-mint-dark">
                          {motherSummary.thisWeek.selfCareStats.waterDays}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Water Days</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-healthcare-mint-dark">
                          {motherSummary.thisWeek.selfCareStats.mealDays}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Meal Days</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-healthcare-mint-dark">
                          {motherSummary.thisWeek.selfCareStats.completionRate}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">Complete</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weekly Nutrition Score Chart */}
                {motherSummary.thisWeek?.nutritionScoreChart && (
                  <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                    <p className="text-xs text-muted-foreground mb-2">This Week's Nutrition Scores</p>
                    {renderMiniBarChart(
                      motherSummary.thisWeek.nutritionScoreChart,
                      10,
                      'bg-purple-500'
                    )}
                  </div>
                )}

                {/* Monthly Score Card */}
                {motherSummary.thisMonth && motherSummary.thisMonth.averageScore !== null && (
                  <div className="p-3 bg-white/60 rounded-xl border border-healthcare-mint/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Average Score</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {motherSummary.thisMonth.averageScore}/10
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(motherSummary.thisMonth.trend)}
                        <span className="text-xs capitalize">{motherSummary.thisMonth.trend}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Positive Indicators */}
                {motherSummary.positiveIndicators?.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Positive Observations</p>
                    <ul className="space-y-1">
                      {motherSummary.positiveIndicators.map((indicator: string, index: number) => (
                        <li key={index} className="text-xs text-green-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No self-care data available yet.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Nutrition Tips Accordion */}
        <Accordion type="single" collapsible className="space-y-2 mt-4">
          {nutritionTips.map((tip) => (
            <AccordionItem
              key={tip.id}
              value={tip.id}
              className="border rounded-xl bg-white/60 px-4 border-healthcare-mint/20"
            >
              <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-3">
                {tip.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                {tip.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-4 p-3 bg-healthcare-mint/10 rounded-xl border border-healthcare-mint/20">
          <p className="text-xs text-muted-foreground text-center italic">
            {t('nutrition.disclaimer')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionAwarenessCard;
