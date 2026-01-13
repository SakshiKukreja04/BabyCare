import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center gradient-hero overflow-hidden">
      {/* Enhanced Background Decorations with Animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-400/40 to-purple-400/40 rounded-full blur-3xl opacity-60 animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-gradient-to-br from-pink-400/40 to-rose-400/40 rounded-full blur-3xl opacity-60 animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-300/30 via-pink-300/30 to-blue-300/30 rounded-full blur-3xl opacity-40 animate-pulse-slow" style={{ animationDelay: '2s' }} />
        {/* Floating particles effect */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/60 rounded-full animate-float" style={{ animationDelay: '0s' }} />
        <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-pink-400/60 rounded-full animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-400/60 rounded-full animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left animate-fade-up">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 backdrop-blur-sm rounded-full text-sm font-semibold text-primary mb-6 shadow-lg border border-primary/10 animate-fade-in">
              <span className="w-2.5 h-2.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Your Baby's Care Companion
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-8 tracking-tight animate-fade-in-up">
              {t('hero.title')}
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
                {t('hero.titleHighlight')}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="group shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-base"
                >
                  {t('hero.cta.primary')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/60 backdrop-blur-sm hover:bg-white/80 border-2 w-full sm:w-auto hover:scale-105 active:scale-95 transition-all duration-300 font-semibold px-8 py-6 text-base shadow-md hover:shadow-lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {t('hero.cta.secondary')}
                </Button>
              </a>
            </div>

            {/* Enhanced Trust Badges */}
            <div className="mt-12 flex flex-wrap items-center gap-6 justify-center lg:justify-start">
              <div className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-400/30 group-hover:shadow-xl group-hover:shadow-green-400/50 transition-all duration-300">
                  <span className="text-white font-bold">✓</span>
                </div>
                <span className="font-semibold">Doctor Approved</span>
              </div>
              <div className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-400/30 group-hover:shadow-xl group-hover:shadow-blue-400/50 transition-all duration-300">
                  <span className="text-white text-lg">🔒</span>
                </div>
                <span className="font-semibold">Privacy First</span>
              </div>
              <div className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-400/30 group-hover:shadow-xl group-hover:shadow-orange-400/50 transition-all duration-300">
                  <span className="text-white text-lg">🇮🇳</span>
                </div>
                <span className="font-semibold">Made in India</span>
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

              {/* Enhanced Floating Elements with Gradients */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl shadow-xl shadow-blue-400/30 flex items-center justify-center text-3xl animate-float hover:scale-110 transition-transform duration-300">
                💙
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl shadow-xl shadow-pink-400/30 flex items-center justify-center text-2xl animate-float hover:scale-110 transition-transform duration-300" style={{ animationDelay: '1s' }}>
                🍼
              </div>
              <div className="absolute top-1/2 -right-8 w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl shadow-lg shadow-purple-400/30 flex items-center justify-center text-xl animate-float" style={{ animationDelay: '2s' }}>
                ⭐
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
