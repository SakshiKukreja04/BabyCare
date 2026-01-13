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
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
            {t('trust.title')}
          </h2>
        </div>

        {/* Trust Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {trustItems.map((item, index) => (
            <div
              key={index}
              className={`group p-8 md:p-10 rounded-3xl border-2 ${item.color} ${item.bgColor} transition-all duration-300 hover:shadow-xl hover:-translate-y-2 hover:border-opacity-100`}
            >
              <div className="flex items-center gap-5 mb-6">
                <div className={`w-14 h-14 rounded-2xl ${item.bgColor} flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <item.icon className={`w-7 h-7 ${item.iconColor} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors duration-200">
                  {item.title}
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-base line-height-[1.7]">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="p-8 bg-destructive/5 border-2 border-destructive/20 rounded-3xl text-center shadow-sm">
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              <strong className="text-destructive font-semibold">Important:</strong> BabyCare is a caregiving assistant, not a medical diagnosis tool. Always consult qualified healthcare professionals for medical advice. In emergencies, call 112 or visit your nearest hospital immediately.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
