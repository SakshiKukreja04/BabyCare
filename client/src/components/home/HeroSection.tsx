import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center gradient-hero overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-healthcare-blue-light rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-healthcare-mint-light rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-healthcare-peach rounded-full blur-3xl opacity-30" />
      </div>

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm font-medium text-primary mb-6 shadow-soft">
              <span className="w-2 h-2 bg-alert-success rounded-full animate-pulse" />
              India-First Healthcare Platform
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              {t('hero.title')}
              <br />
              <span className="text-gradient">{t('hero.titleHighlight')}</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link to="/signup">
                <Button size="lg" className="group shadow-glow hover:shadow-hover transition-all w-full sm:w-auto">
                  {t('hero.cta.primary')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="bg-white/50 backdrop-blur-sm w-full sm:w-auto">
                  <Play className="w-4 h-4 mr-2" />
                  {t('hero.cta.secondary')}
                </Button>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="mt-12 flex flex-wrap items-center gap-6 justify-center lg:justify-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-healthcare-mint flex items-center justify-center">
                  ✓
                </div>
                Doctor Approved
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-healthcare-blue-light flex items-center justify-center">
                  🔒
                </div>
                Privacy First
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-healthcare-peach flex items-center justify-center">
                  🇮🇳
                </div>
                Made in India
              </div>
            </div>
          </div>

          {/* Illustration */}
          <div className="relative animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative w-full mx-auto">
              {/* Main Card */}
              <div className="rounded-3xl shadow-card overflow-hidden">
                <img 
                  src="/baby_home.png" 
                  alt="Baby care" 
                  className="w-full h-auto object-cover rounded-3xl"
                />
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-healthcare-mint rounded-2xl shadow-card flex items-center justify-center text-3xl animate-float">
                💙
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-healthcare-peach rounded-2xl shadow-card flex items-center justify-center text-2xl animate-float" style={{ animationDelay: '1s' }}>
                🍼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave Decoration */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
