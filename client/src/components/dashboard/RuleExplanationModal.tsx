import { HelpCircle, X, AlertCircle, FileText, Lightbulb } from 'lucide-react';
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

interface RuleExplanationModalProps {
  alert: {
    id: number;
    severity: string;
    title: string;
    description: string;
    rule?: string;
    trigger?: string;
    explanation?: string;
  };
}

const RuleExplanationModal = ({ alert }: RuleExplanationModalProps) => {
  const { t } = useLanguage();

  const explanationSteps = [
    {
      icon: AlertCircle,
      label: t('ruleTrace.triggeredRule'),
      content: alert.rule || t('ruleTrace.defaultRule'),
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: FileText,
      label: t('ruleTrace.whatCaused'),
      content: alert.trigger || t('ruleTrace.defaultTrigger'),
      color: 'text-alert-medium',
      bg: 'bg-alert-medium/10',
    },
    {
      icon: Lightbulb,
      label: t('ruleTrace.whyMatters'),
      content: alert.explanation || t('ruleTrace.defaultExplanation'),
      color: 'text-healthcare-mint',
      bg: 'bg-healthcare-mint/10',
    },
  ];

  return (
    <Dialog>
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
                  <p className="text-sm text-foreground leading-relaxed">
                    {step.content}
                  </p>
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
