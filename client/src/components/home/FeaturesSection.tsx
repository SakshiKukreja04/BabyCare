import { Baby, Bell, Brain, Globe, Sparkles, Phone } from 'lucide-react';
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
      icon: Brain,
      title: t('features.mentalHealth.title'),
      description: t('features.mentalHealth.desc'),
      color: 'bg-healthcare-peach',
      iconColor: 'text-healthcare-peach-dark',
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
    <section id="features" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('features.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 md:p-8 bg-card rounded-2xl border border-border shadow-soft hover:shadow-hover transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}
              >
                <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
