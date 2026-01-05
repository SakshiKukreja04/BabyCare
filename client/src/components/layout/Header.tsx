import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Heart, Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/#how-it-works', label: t('nav.howItWorks') },
    { href: '/#features', label: t('nav.features') },
    { href: '/#about', label: t('nav.about') },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href || location.hash === href.replace('/', '');
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-soft border-b border-border/50'
          : 'bg-transparent'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Baby className="w-8 h-8 text-primary transition-transform group-hover:scale-110" />
              <Heart className="w-4 h-4 text-healthcare-peach-dark absolute -bottom-1 -right-1 animate-pulse-soft" />
            </div>
            <span className="font-bold text-xl text-foreground">
              Baby<span className="text-primary">Care</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors relative',
                  isActive(link.href)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                  'after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left'
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Section */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              {language === 'en' ? 'हिंदी' : 'English'}
            </button>

            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-medium">
                {t('nav.login')}
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="font-medium shadow-soft hover:shadow-hover transition-shadow">
                {t('nav.signup')}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-foreground"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-border shadow-card transition-all duration-300',
          isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        )}
      >
        <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                'px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-4 py-2 rounded-full text-sm font-medium bg-secondary text-secondary-foreground"
            >
              {language === 'en' ? 'हिंदी' : 'English'}
            </button>
            <Link to="/login" className="flex-1" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full">
                {t('nav.login')}
              </Button>
            </Link>
            <Link to="/signup" className="flex-1" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full">
                {t('nav.signup')}
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
