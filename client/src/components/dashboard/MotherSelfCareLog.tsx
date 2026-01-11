import { useState, useEffect } from 'react';
import { Heart, Droplets, Utensils, Zap, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { nutritionMotherApi } from '@/lib/api';

const MotherSelfCareLog = ({ onLogSaved }: { onLogSaved?: (summary: any) => void }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  
  const [selfCare, setSelfCare] = useState({
    waterIntake: false,
    mealsTaken: {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: false,
    },
    energyLevel: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    loadTodaySelfCare();
  }, []);

  const loadTodaySelfCare = async () => {
    try {
      setIsLoading(true);
      const response = await nutritionMotherApi.getSelfCare();
      
      if (response.log) {
        setSelfCare({
          waterIntake: response.log.waterIntake || false,
          mealsTaken: {
            breakfast: response.log.mealsTaken?.breakfast || false,
            lunch: response.log.mealsTaken?.lunch || false,
            dinner: response.log.mealsTaken?.dinner || false,
            snacks: response.log.mealsTaken?.snacks || false,
          },
          energyLevel: response.log.energyLevel || 'medium',
        });
      }
    } catch (error) {
      console.error('Error loading self-care:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSelfCare(prev => {
      if (field.startsWith('meals.')) {
        const mealType = field.split('.')[1] as keyof typeof prev.mealsTaken;
        return {
          ...prev,
          mealsTaken: {
            ...prev.mealsTaken,
            [mealType]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
    setHasChanges(true);
    setSavedSuccessfully(false);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log('💾 Saving mother self-care:', JSON.stringify(selfCare, null, 2));
      
      const response = await nutritionMotherApi.logSelfCare(selfCare);
      console.log('✅ Self-care save response:', response);
      console.log('📊 Response structure:', { hasLog: !!response?.log, hasSummary: !!response?.summary });
      console.log('📊 Summary in response:', response?.summary);
      
      // Log the meal details from response
      if (response?.log) {
        console.log('📋 Saved log details:');
        console.log('   Date:', response.log.date);
        console.log('   Water:', response.log.waterIntake);
        console.log('   Meals:', response.log.mealsTaken);
        console.log('   Energy:', response.log.energyLevel);
      }
      
      setHasChanges(false);
      setSavedSuccessfully(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSavedSuccessfully(false), 3000);
      
      // Call parent callback with summary data
      // Response structure: { log, summary, message }
      if (onLogSaved && response?.summary) {
        console.log('🔄 Calling onLogSaved with summary');
        onLogSaved(response.summary);
      } else {
        console.warn('⚠️ No summary in response or no callback');
        console.warn('⚠️ response keys:', Object.keys(response || {}));
      }
    } catch (error) {
      console.error('❌ Error saving self-care:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'low':
        return 'Low Energy';
      case 'medium':
        return 'Normal';
      case 'high':
        return 'High Energy';
      default:
        return level;
    }
  };

  const getEnergyColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-pink-50 to-pink-100/50 border-pink-200">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
          <span className="ml-2 text-pink-600">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  const mealsLogged = Object.values(selfCare.mealsTaken).filter(Boolean).length;
  const isComplete = selfCare.waterIntake && mealsLogged >= 2;

  return (
    <Card className="bg-gradient-to-br from-pink-50 to-pink-100/50 border-pink-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-pink-700">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
            <Heart className="w-4 h-4 text-pink-600" />
          </div>
          Mother's Self-Care Today
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track your daily wellness for better self-care awareness
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion Status */}
        <div className={`p-3 rounded-xl border ${
          isComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {isComplete ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-yellow-500" />
            )}
            <span className={`text-sm font-medium ${
              isComplete ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {isComplete 
                ? "Today's self-care is complete!" 
                : `Log water and ${2 - mealsLogged > 0 ? `${2 - mealsLogged} more meal(s)` : 'water'} to complete`}
            </span>
          </div>
        </div>

        {/* Water Intake */}
        <div className="p-3 bg-white/60 rounded-xl border border-pink-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className={`w-5 h-5 ${
                selfCare.waterIntake ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <Label htmlFor="water" className="text-sm font-medium">
                Stayed Hydrated Today
              </Label>
            </div>
            <Switch
              id="water"
              checked={selfCare.waterIntake}
              onCheckedChange={(checked) => handleChange('waterIntake', checked)}
            />
          </div>
        </div>

        {/* Meals */}
        <div className="p-3 bg-white/60 rounded-xl border border-pink-200">
          <div className="flex items-center gap-2 mb-3">
            <Utensils className="w-5 h-5 text-orange-500" />
            <Label className="text-sm font-medium">Meals Taken</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'breakfast', label: 'Breakfast' },
              { id: 'lunch', label: 'Lunch' },
              { id: 'dinner', label: 'Dinner' },
              { id: 'snacks', label: 'Snacks' },
            ].map((meal) => (
              <div 
                key={meal.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                  selfCare.mealsTaken[meal.id as keyof typeof selfCare.mealsTaken]
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Label htmlFor={meal.id} className="text-xs cursor-pointer">
                  {meal.label}
                </Label>
                <Switch
                  id={meal.id}
                  checked={selfCare.mealsTaken[meal.id as keyof typeof selfCare.mealsTaken]}
                  onCheckedChange={(checked) => handleChange(`meals.${meal.id}`, checked)}
                  className="scale-75"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Energy Level */}
        <div className="p-3 bg-white/60 rounded-xl border border-pink-200">
          <div className="flex items-center gap-2 mb-3">
            <Zap className={`w-5 h-5 ${getEnergyColor(selfCare.energyLevel)}`} />
            <Label className="text-sm font-medium">Energy Level</Label>
          </div>
          <RadioGroup
            value={selfCare.energyLevel}
            onValueChange={(value) => handleChange('energyLevel', value)}
            className="flex gap-2"
          >
            {['low', 'medium', 'high'].map((level) => (
              <div
                key={level}
                className={`flex-1 p-2 rounded-lg border text-center cursor-pointer transition-colors ${
                  selfCare.energyLevel === level
                    ? level === 'low'
                      ? 'bg-red-50 border-red-200'
                      : level === 'medium'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <RadioGroupItem
                  value={level}
                  id={`energy-${level}`}
                  className="sr-only"
                />
                <Label
                  htmlFor={`energy-${level}`}
                  className={`text-xs cursor-pointer ${getEnergyColor(level)}`}
                >
                  {getEnergyLabel(level)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="w-full bg-pink-600 hover:bg-pink-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : savedSuccessfully ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            'Save Self-Care Log'
          )}
        </Button>

        <div className="p-3 bg-pink-100/50 rounded-xl border border-pink-200">
          <p className="text-xs text-muted-foreground text-center italic">
            For awareness only. Not medical advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MotherSelfCareLog;
