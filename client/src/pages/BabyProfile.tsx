import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Calendar, Scale, Clock, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/layout/Header';

const BabyProfile = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    babyName: '',
    dateOfBirth: '',
    gestationalAge: '',
    currentWeight: '',
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Profile Saved! 🎉",
        description: `Welcome ${formData.babyName} to BabyCare!`,
      });
      navigate('/dashboard');
    }, 1500);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-healthcare-blue-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Baby className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                What's your baby's name?
              </h3>
              <p className="text-muted-foreground text-sm">
                This helps us personalize the experience
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="babyName">{t('profile.babyName')}</Label>
              <Input
                id="babyName"
                type="text"
                placeholder="Enter baby's name"
                value={formData.babyName}
                onChange={(e) => setFormData({ ...formData, babyName: e.target.value })}
                className="h-14 text-lg text-center bg-secondary/50 border-border"
                required
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-healthcare-mint-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-healthcare-mint" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                When was {formData.babyName || 'your baby'} born?
              </h3>
              <p className="text-muted-foreground text-sm">
                This helps us track age-appropriate milestones
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">{t('profile.dob')}</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="h-14 text-lg text-center bg-secondary/50 border-border"
                required
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-healthcare-peach rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-healthcare-peach-dark" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Gestational age at birth
              </h3>
              <p className="text-muted-foreground text-sm">
                This helps assess developmental milestones accurately
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gestationalAge">{t('profile.gestationalAge')}</Label>
              <div className="relative">
                <Input
                  id="gestationalAge"
                  type="number"
                  min="20"
                  max="45"
                  placeholder="e.g., 38"
                  value={formData.gestationalAge}
                  onChange={(e) => setFormData({ ...formData, gestationalAge: e.target.value })}
                  className="h-14 text-lg text-center bg-secondary/50 border-border pr-16"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  weeks
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Full term is typically 37-42 weeks
              </p>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-healthcare-sage rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Scale className="w-10 h-10 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Current weight
              </h3>
              <p className="text-muted-foreground text-sm">
                This helps monitor healthy growth patterns
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">{t('profile.weight')}</Label>
              <div className="relative">
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 3.5"
                  value={formData.currentWeight}
                  onChange={(e) => setFormData({ ...formData, currentWeight: e.target.value })}
                  className="h-14 text-lg text-center bg-secondary/50 border-border pr-12"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  kg
                </span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-md mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Step {step} of {totalSteps}
              </p>
              <p className="text-sm font-medium text-primary">
                {Math.round((step / totalSteps) * 100)}%
              </p>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-card rounded-3xl border border-border shadow-card p-8">
            {renderStep()}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              {step > 1 ? (
                <Button variant="ghost" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <Button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !formData.babyName) ||
                    (step === 2 && !formData.dateOfBirth) ||
                    (step === 3 && !formData.gestationalAge)
                  }
                  className="gap-2"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.currentWeight || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {t('profile.save')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Steps Indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <button
                key={index}
                onClick={() => setStep(index + 1)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index + 1 === step
                    ? 'w-8 bg-primary'
                    : index + 1 < step
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BabyProfile;
