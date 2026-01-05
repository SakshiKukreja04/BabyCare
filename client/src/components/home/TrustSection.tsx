import { AlertCircle, Stethoscope, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TrustSection = () => {
  const { t } = useLanguage();

  const trustItems = [
    {
      icon: AlertCircle,
      title: t('trust.aiNote'),
      description: t('trust.aiNoteDesc'),
      color: 'border-alert-medium',
      bgColor: 'bg-alert-medium/10',
      iconColor: 'text-alert-medium',
    },
    {
      icon: Stethoscope,
      title: t('trust.doctorsFirst'),
      description: t('trust.doctorsFirstDesc'),
      color: 'border-primary',
      bgColor: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: Lock,
      title: t('trust.privacy'),
      description: t('trust.privacyDesc'),
      color: 'border-alert-success',
      bgColor: 'bg-alert-success/10',
      iconColor: 'text-alert-success',
    },
  ];

  return (
    <section id="about" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('trust.title')}
          </h2>
        </div>

        {/* Trust Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {trustItems.map((item, index) => (
            <div
              key={index}
              className={`p-6 md:p-8 rounded-2xl border-2 ${item.color} ${item.bgColor} transition-all duration-300 hover:shadow-card`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                  <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl text-center">
            <p className="text-sm text-muted-foreground">
              <strong className="text-destructive">Important:</strong> BabyCare is a caregiving assistant, not a medical diagnosis tool. Always consult qualified healthcare professionals for medical advice. In emergencies, call 112 or visit your nearest hospital immediately.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
