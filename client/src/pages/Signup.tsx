import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Baby, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Signup = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { loginWithGoogle, signupWithEmail, user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const passwordRequirements = [
    { text: 'At least 8 characters', met: formData.password.length >= 8 },
    { text: 'Contains a number', met: /\d/.test(formData.password) },
    { text: 'Passwords match', met: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await signupWithEmail(formData.name, formData.email, formData.password);
      toast({
        title: "Welcome to BabyCare! 💙",
        description: "Your account has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      toast({
        title: "Welcome to BabyCare! 💙",
        description: "Account created with Google.",
      });
    } catch (error) {
      toast({
        title: "Google Sign-up failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // After any successful auth (including Google redirect), send user to baby profile
  useEffect(() => {
    if (!loading && user) {
      navigate('/baby-profile');
    }
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen flex gradient-hero">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="relative">
              <Baby className="w-10 h-10 text-primary" />
              <Heart className="w-4 h-4 text-healthcare-peach-dark absolute -bottom-0.5 -right-0.5" />
            </div>
            <span className="font-bold text-2xl text-foreground">
              Care<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Nest</span>
            </span>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight tracking-tight">
              {t('auth.signup.title')}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              {t('auth.signup.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors duration-200 peer-focus:text-primary" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-12 bg-secondary/30 border-border/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors duration-200 peer-focus:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 bg-secondary/30 border-border/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors duration-200 peer-focus:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 pr-12 bg-secondary/30 border-border/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110 active:scale-95"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors duration-200 peer-focus:text-primary" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-12 bg-secondary/30 border-border/50"
                  required
                />
              </div>
            </div>

            {/* Password Requirements */}
            <div className="p-5 bg-secondary/30 rounded-2xl border border-border/50 space-y-3 shadow-sm">
              {passwordRequirements.map((req, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                      req.met ? 'bg-alert-success shadow-sm scale-110' : 'bg-muted/50'
                    }`}
                  >
                    {req.met && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`leading-relaxed ${req.met ? 'text-alert-success font-medium' : 'text-muted-foreground'}`}>
                    {req.text}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold mt-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                t('auth.signupBtn')
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-background px-4 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-semibold"
            onClick={handleGoogleSignup}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t('auth.googleBtn')}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-10 leading-relaxed">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline transition-all duration-200 hover:text-primary/80">
              {t('nav.login')}
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-healthcare-mint-light rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-healthcare-peach rounded-full blur-3xl opacity-60" />
        </div>
        
        <div className="relative z-10 text-center max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="relative">
              <Baby className="w-16 h-16 text-primary" />
              <Heart className="w-6 h-6 text-healthcare-peach-dark absolute -bottom-1 -right-1" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Baby<span className="text-primary">Care</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of Indian families who trust us with their caregiving journey.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-soft">
              <div className="w-12 h-12 bg-healthcare-blue-light rounded-xl flex items-center justify-center text-xl">
                📊
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Track Everything</p>
                <p className="text-sm text-muted-foreground">Feeding, sleep, growth & more</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-soft">
              <div className="w-12 h-12 bg-healthcare-mint-light rounded-xl flex items-center justify-center text-xl">
                🔔
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Smart Alerts</p>
                <p className="text-sm text-muted-foreground">Safety checks & reminders</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-soft">
              <div className="w-12 h-12 bg-healthcare-peach rounded-xl flex items-center justify-center text-xl">
                💙
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Mental Health</p>
                <p className="text-sm text-muted-foreground">Weekly wellness check-ins</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
