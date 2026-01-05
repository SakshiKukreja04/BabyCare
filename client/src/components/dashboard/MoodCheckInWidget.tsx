import { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const MoodCheckInWidget = () => {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [showResponse, setShowResponse] = useState(false);

  const moods = [
    { value: 1, emoji: '😔', label: t('mood.struggling') },
    { value: 2, emoji: '😐', label: t('mood.okay') },
    { value: 3, emoji: '😌', label: t('mood.good') },
  ];

  const handleMoodSelect = (value: number) => {
    setSelectedMood(value);
    setShowResponse(false);
    // Slight delay for animation effect
    setTimeout(() => setShowResponse(true), 150);
  };

  const getResponse = (mood: number): string => {
    switch (mood) {
      case 1:
        return t('mood.response.struggling');
      case 2:
        return t('mood.response.okay');
      case 3:
        return t('mood.response.good');
      default:
        return '';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-healthcare-peach/30 via-healthcare-cream/40 to-healthcare-mint-light/30 border-healthcare-peach/30 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-healthcare-peach/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-healthcare-mint-light/20 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-healthcare-peach/30 flex items-center justify-center">
            <Heart className="w-4 h-4 text-healthcare-peach-dark" />
          </div>
          {t('mood.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t('mood.subtitle')}
        </p>
      </CardHeader>
      
      <CardContent className="relative">
        <div className="flex justify-center gap-4 mb-4">
          {moods.map((mood) => (
            <button
              key={mood.value}
              onClick={() => handleMoodSelect(mood.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 ${
                selectedMood === mood.value
                  ? 'bg-white shadow-card scale-110 ring-2 ring-healthcare-peach/30'
                  : 'hover:bg-white/60 hover:scale-105'
              }`}
            >
              <span className="text-3xl" role="img" aria-label={mood.label}>
                {mood.emoji}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {mood.label}
              </span>
            </button>
          ))}
        </div>

        {selectedMood && showResponse && (
          <div className="animate-fade-up">
            <div className="p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-healthcare-peach/20 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-healthcare-peach/30 to-healthcare-mint-light/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-healthcare-peach-dark" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground leading-relaxed">
                    {getResponse(selectedMood)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3 italic">
              {t('mood.disclaimer')}
            </p>
          </div>
        )}

        {!selectedMood && (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              {t('mood.prompt')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MoodCheckInWidget;
