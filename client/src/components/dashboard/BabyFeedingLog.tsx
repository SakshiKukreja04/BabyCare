import { useState, useEffect } from 'react';
import { Baby, Clock, Check, Loader2, Milk } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { nutritionBabyApi } from '@/lib/api';

interface BabyFeedingLogProps {
  babyId: string;
  babyName?: string;
  onLogSaved?: () => void;
}

const BabyFeedingLog = ({ babyId, babyName = 'Baby', onLogSaved }: BabyFeedingLogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [suggestedCount, setSuggestedCount] = useState(0);
  
  const [formData, setFormData] = useState({
    feedingType: 'breast' as 'breast' | 'formula' | 'mixed',
    feedingTime: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    useManualCount: false,
    manualCount: '',
  });

  useEffect(() => {
    loadSuggestedCount();
  }, [babyId]);

  const loadSuggestedCount = async () => {
    try {
      setIsLoading(true);
      const response = await nutritionBabyApi.getSuggestedCount(babyId);
      setSuggestedCount(response.suggestedFeedingCount);
    } catch (error) {
      console.error('Error loading suggested count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      
      await nutritionBabyApi.logFeeding(
        babyId,
        formData.feedingType,
        new Date(formData.feedingTime),
        formData.useManualCount && formData.manualCount 
          ? parseInt(formData.manualCount) 
          : undefined
      );
      
      setSavedSuccessfully(true);
      
      // Reload suggested count
      await loadSuggestedCount();
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        feedingTime: new Date().toISOString().slice(0, 16),
        manualCount: '',
      }));
      
      // Notify parent
      onLogSaved?.();
      
      // Hide success message after 3 seconds
      setTimeout(() => setSavedSuccessfully(false), 3000);
    } catch (error) {
      console.error('Error logging feeding:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getFeedingTypeIcon = (type: string) => {
    switch (type) {
      case 'breast':
        return '🤱';
      case 'formula':
        return '🍼';
      case 'mixed':
        return '🤱🍼';
      default:
        return '🍼';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-blue-600">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Baby className="w-4 h-4 text-blue-600" />
          </div>
          Log {babyName}'s Feeding
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track feeding habits for nutrition awareness
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Feeding Count */}
        <div className="p-3 bg-white/60 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Today's Feedings</p>
              <p className="text-2xl font-bold text-blue-600">{suggestedCount}</p>
            </div>
            <Milk className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        {/* Feeding Type Selection */}
        <div className="p-3 bg-white/60 rounded-xl border border-blue-200">
          <Label className="text-sm font-medium mb-2 block">Feeding Type</Label>
          <RadioGroup
            value={formData.feedingType}
            onValueChange={(value: 'breast' | 'formula' | 'mixed') => 
              setFormData(prev => ({ ...prev, feedingType: value }))
            }
            className="grid grid-cols-3 gap-2"
          >
            {[
              { value: 'breast', label: 'Breast', emoji: '🤱' },
              { value: 'formula', label: 'Formula', emoji: '🍼' },
              { value: 'mixed', label: 'Mixed', emoji: '🤱🍼' },
            ].map((option) => (
              <div key={option.value}>
                <RadioGroupItem
                  value={option.value}
                  id={`feeding-${option.value}`}
                  className="sr-only"
                />
                <Label
                  htmlFor={`feeding-${option.value}`}
                  className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.feedingType === option.value
                      ? 'bg-blue-100 border-blue-400'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl mb-1">{option.emoji}</span>
                  <span className="text-xs">{option.label}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Feeding Time */}
        <div className="p-3 bg-white/60 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <Label className="text-sm font-medium">Feeding Time</Label>
          </div>
          <Input
            type="datetime-local"
            value={formData.feedingTime}
            onChange={(e) => setFormData(prev => ({ ...prev, feedingTime: e.target.value }))}
            className="w-full"
          />
        </div>

        {/* Manual Count Override (Optional) */}
        <div className="p-3 bg-white/60 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Manual Count Override</Label>
            <input
              type="checkbox"
              checked={formData.useManualCount}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                useManualCount: e.target.checked,
                manualCount: e.target.checked ? prev.manualCount : ''
              }))}
              className="rounded border-gray-300"
            />
          </div>
          {formData.useManualCount && (
            <Input
              type="number"
              placeholder="Enter total feeding count"
              value={formData.manualCount}
              onChange={(e) => setFormData(prev => ({ ...prev, manualCount: e.target.value }))}
              min="0"
              className="w-full"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Optional: Override the auto-calculated count
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : savedSuccessfully ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Logged Successfully!
            </>
          ) : (
            <>
              {getFeedingTypeIcon(formData.feedingType)} Log Feeding
            </>
          )}
        </Button>

        <div className="p-3 bg-blue-100/50 rounded-xl border border-blue-200">
          <p className="text-xs text-muted-foreground text-center italic">
            For awareness only. Not medical advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BabyFeedingLog;
