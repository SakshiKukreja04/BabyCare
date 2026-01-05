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
                Baby<span className="text-primary">Care</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm mb-4">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="mailto:support@babycare.in" className="flex items-center gap-1 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                support@babycare.in
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <a href="/#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('nav.features')}
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('nav.howItWorks')}
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('footer.about')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('footer.privacy')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('footer.disclaimer')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BabyCare. Made with 💙 in India.
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-full">
              <Phone className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
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
