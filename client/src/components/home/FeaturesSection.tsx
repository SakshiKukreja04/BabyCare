import { Baby, Bell, Globe, Sparkles, Phone, AudioWaveform, MessageCircle, Pill, UtensilsCrossed, BarChart3 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: Baby,
      title: t('features.babyCare.title'),
      description: t('features.babyCare.desc'),
      color: 'bg-healthcare-blue-light',
      iconColor: 'text-primary',
    },
    {
      icon: Bell,
      title: t('features.alerts.title'),
      description: t('features.alerts.desc'),
      color: 'bg-healthcare-mint-light',
      iconColor: 'text-healthcare-mint',
    },
    {
      icon: AudioWaveform,
      title: t('features.cryAnalysis.title'),
      description: t('features.cryAnalysis.desc'),
      color: 'bg-healthcare-peach',
      iconColor: 'text-healthcare-peach-dark',
    },
    {
      icon: MessageCircle,
      title: t('features.chatbot.title'),
      description: t('features.chatbot.desc'),
      color: 'bg-healthcare-sage',
      iconColor: 'text-accent-foreground',
    },
    {
      icon: Pill,
      title: t('features.prescriptions.title'),
      description: t('features.prescriptions.desc'),
      color: 'bg-purple-100',
      iconColor: 'text-purple-700',
    },
    {
      icon: UtensilsCrossed,
      title: t('features.nutrition.title'),
      description: t('features.nutrition.desc'),
      color: 'bg-orange-100',
      iconColor: 'text-orange-700',
    },
    {
      icon: BarChart3,
      title: t('features.analytics.title'),
      description: t('features.analytics.desc'),
      color: 'bg-blue-100',
      iconColor: 'text-blue-700',
    },
    {
      icon: Globe,
      title: t('features.multilingual.title'),
      description: t('features.multilingual.desc'),
      color: 'bg-healthcare-sage',
      iconColor: 'text-accent-foreground',
    },
    {
      icon: Sparkles,
      title: t('features.explainableAI.title'),
      description: t('features.explainableAI.desc'),
      color: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: Phone,
      title: t('features.emergency.title'),
      description: t('features.emergency.desc'),
      color: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
            {t('features.title')}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 md:p-10 bg-card rounded-3xl border border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 hover:border-primary/20 bg-gradient-to-br from-card to-card/50"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Subtle background gradient on hover */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-300 opacity-0 group-hover:opacity-100" />
              
              <div className="relative z-10">
                <div
                  className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md group-hover:shadow-lg`}
                >
                  <feature.icon className={`w-8 h-8 ${feature.iconColor} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 leading-tight group-hover:text-primary transition-colors duration-200">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-base md:text-[15px] line-height-[1.7]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
