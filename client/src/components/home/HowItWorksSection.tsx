import { UserPlus, ClipboardList, ShieldCheck, MessageCircle, Ambulance } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HowItWorksSection = () => {
  const { t } = useLanguage();

  const steps = [
    {
      icon: UserPlus,
      title: t('howItWorks.step1.title'),
      description: t('howItWorks.step1.desc'),
      color: 'bg-healthcare-blue-light',
      iconColor: 'text-primary',
    },
    {
      icon: ClipboardList,
      title: t('howItWorks.step2.title'),
      description: t('howItWorks.step2.desc'),
      color: 'bg-healthcare-mint-light',
      iconColor: 'text-healthcare-mint',
    },
    {
      icon: ShieldCheck,
      title: t('howItWorks.step3.title'),
      description: t('howItWorks.step3.desc'),
      color: 'bg-healthcare-peach',
      iconColor: 'text-healthcare-peach-dark',
    },
    {
      icon: MessageCircle,
      title: t('howItWorks.step4.title'),
      description: t('howItWorks.step4.desc'),
      color: 'bg-healthcare-sage',
      iconColor: 'text-accent-foreground',
    },
    {
      icon: Ambulance,
      title: t('howItWorks.step5.title'),
      description: t('howItWorks.step5.desc'),
      color: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
            {t('howItWorks.title')}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div className="relative max-w-4xl mx-auto">
          {/* Connection Line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-healthcare-mint to-healthcare-peach-dark -translate-x-1/2" />

          {/* Steps */}
          <div className="space-y-8 md:space-y-0">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative flex flex-col md:flex-row items-center gap-6 md:gap-12 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Content Card */}
                <div
                  className={`flex-1 p-8 bg-card rounded-3xl border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group ${
                    index % 2 === 0 ? 'md:text-right' : 'md:text-left'
                  }`}
                >
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 leading-tight group-hover:text-primary transition-colors duration-200">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-base">{step.description}</p>
                </div>

                {/* Icon Circle */}
                <div className="relative z-10 flex-shrink-0 order-first md:order-none">
                  <div
                    className={`w-16 h-16 ${step.color} rounded-full flex items-center justify-center shadow-card border-4 border-background`}
                  >
                    <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                  </div>
                  {/* Step Number */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center shadow-soft">
                    {index + 1}
                  </div>
                </div>

                {/* Spacer for alignment */}
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
