import { useState } from 'react';
import { HelpCircle, X, AlertCircle, FileText, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertsApi } from '@/lib/api';

interface RuleExplanationModalProps {
  alert: {
    id: string;
    severity: string;
    title: string;
    description: string;
    rule?: string;
    trigger?: string;
    explanation?: string;
    ruleId?: string;
    triggerData?: any;
  };
}

const RuleExplanationModal = ({ alert }: RuleExplanationModalProps) => {
  const { t } = useLanguage();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchExplanation = async () => {
    if (explanation || isLoadingExplanation) return;
    
    setIsLoadingExplanation(true);
    try {
      const result = await alertsApi.getExplanation(alert.id);
      setExplanation(result.explanation);
    } catch (error) {
      console.error('Error fetching explanation:', error);
      setExplanation(t('ruleTrace.defaultExplanation'));
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !explanation) {
      fetchExplanation();
    }
  };

  // Format trigger data into human-readable text
  const formatTriggerData = (triggerData: any, ruleId?: string): string => {
    if (!triggerData) return t('ruleTrace.defaultTrigger');
    
    // If there's a message field, use it
    if (triggerData.message) {
      return triggerData.message;
    }

    const ruleIdLower = (ruleId || '').toLowerCase();
    
    // Sleep duration alert
    if (ruleIdLower.includes('sleep')) {
      const totalHours = triggerData.value || triggerData.totalSleepHours24h || 0;
      const thresholdHours = triggerData.thresholdHours || 10;
      const totalMinutes = triggerData.totalSleepMinutes || 0;
      return `Total logged sleep in the last 24 hours is ${totalHours.toFixed(1)} hours (${totalMinutes} minutes), which is below the recommended minimum of ${thresholdHours} hours.`;
    }

    // Feeding delay alert
    if (ruleIdLower.includes('feeding_delay')) {
      const hoursSince = triggerData.value || triggerData.hoursSinceLastFeed || 0;
      const thresholdHours = triggerData.thresholdHours || 4;
      return `Last feeding was ${hoursSince.toFixed(1)} hours ago, which exceeds the recommended interval of ${thresholdHours} hours.`;
    }

    // Frequent feeding alert
    if (ruleIdLower.includes('frequent_feeding')) {
      const hoursBetween = triggerData.value || triggerData.hoursBetweenFeeds || 0;
      const thresholdHours = triggerData.thresholdHours || 1;
      return `Feedings are happening ${hoursBetween.toFixed(1)} hours apart, which is less than the recommended minimum interval of ${thresholdHours} hour.`;
    }

    // Low feed quantity alert (individual feed)
    if (ruleIdLower.includes('low_feed_quantity') && !ruleIdLower.includes('daily')) {
      const quantity = triggerData.value || triggerData.feedQuantity || 0;
      const thresholdMl = triggerData.thresholdMl || 30;
      return `Last feeding quantity was ${quantity}ml, which is below the recommended minimum of ${thresholdMl}ml.`;
    }

    // Low daily feeding total alert
    if (ruleIdLower.includes('low_daily_feeding_total') || (ruleIdLower.includes('daily') && ruleIdLower.includes('feeding'))) {
      const dailyTotal = triggerData.value || triggerData.dailyTotalMl || 0;
      const thresholdMl = triggerData.thresholdMl || 150;
      const feedCount = triggerData.feedCount || 0;
      return `Total daily feeding is ${dailyTotal}ml (${feedCount} feed${feedCount !== 1 ? 's' : ''} logged), which is below the recommended minimum of ${thresholdMl}ml per day.`;
    }

    // Weight not updated alert
    if (ruleIdLower.includes('weight')) {
      const daysSince = triggerData.value || triggerData.daysSinceWeightUpdate || 0;
      const thresholdDays = triggerData.thresholdDays || 7;
      return `Weight was last updated ${Math.round(daysSince)} days ago, which exceeds the recommended tracking interval of ${thresholdDays} days.`;
    }

    // Medication alert
    if (ruleIdLower.includes('medication')) {
      return `A scheduled medication was not logged as administered.`;
    }

    // Fallback: try to format common fields
    if (triggerData.checked && triggerData.value !== undefined) {
      return `Alert triggered: ${triggerData.checked} = ${triggerData.value}`;
    }

    // Last resort: show a generic message
    return 'A care pattern was detected that triggered this alert.';
  };

  const explanationSteps = [
    {
      icon: AlertCircle,
      label: t('ruleTrace.triggeredRule'),
      content: alert.title || alert.rule || t('ruleTrace.defaultRule'),
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: FileText,
      label: t('ruleTrace.whatCaused'),
      content: alert.trigger || formatTriggerData(alert.triggerData, alert.ruleId) || t('ruleTrace.defaultTrigger'),
      color: 'text-alert-medium',
      bg: 'bg-alert-medium/10',
    },
    {
      icon: Lightbulb,
      label: t('ruleTrace.whyMatters'),
      content: isLoadingExplanation 
        ? 'Loading explanation...' 
        : (explanation || t('ruleTrace.defaultExplanation')),
      color: 'text-healthcare-mint',
      bg: 'bg-healthcare-mint/10',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {t('ruleTrace.whySeeing')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-primary" />
            {t('ruleTrace.modalTitle')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="p-3 bg-secondary/50 rounded-xl">
            <p className="text-sm font-medium text-foreground">{alert.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
          </div>

          <div className="space-y-3">
            {explanationSteps.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center flex-shrink-0`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${step.color} mb-1`}>
                    {step.label}
                  </p>
                  {isLoadingExplanation && index === 2 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading AI explanation...
                    </div>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">
                      {step.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-healthcare-mint-light/30 rounded-xl border border-healthcare-mint/20">
            <p className="text-xs text-muted-foreground text-center">
              {t('ruleTrace.reassurance')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RuleExplanationModal;
