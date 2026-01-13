import { Baby, Heart, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-gradient-to-b from-background to-secondary/30 border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="relative">
                <Baby className="w-8 h-8 text-primary" />
                <Heart className="w-4 h-4 text-healthcare-peach-dark absolute -bottom-1 -right-1" />
              </div>
              <span className="font-bold text-xl text-foreground">
                Care<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Nest</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm md:text-base max-w-sm mb-6 leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-4 text-sm md:text-base text-muted-foreground">
              <a href="mailto:support@carenest.in" className="flex items-center gap-2 hover:text-primary transition-all duration-200 hover:scale-105 font-medium">
                <Mail className="w-4 h-4" />
                support@carenest.in
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-foreground mb-5 text-base md:text-lg">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <a href="/#features" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  {t('nav.features')}
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  {t('nav.howItWorks')}
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-foreground mb-5 text-base md:text-lg">Legal</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  {t('footer.about')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  {t('footer.privacy')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm md:text-base text-muted-foreground hover:text-primary transition-all duration-200 font-medium hover:translate-x-1 inline-block">
                  {t('footer.disclaimer')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              © {new Date().getFullYear()} CareNest. Made with 💙 in India.
            </p>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-destructive/10 border border-destructive/20 rounded-full hover:bg-destructive/15 transition-all duration-200 hover:scale-105">
              <Phone className="w-4 h-4 text-destructive" />
              <span className="text-sm md:text-base font-semibold text-destructive">
                Emergency: 112 | Child Helpline: 1098
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
