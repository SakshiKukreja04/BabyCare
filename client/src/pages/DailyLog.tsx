import { useState, useEffect, useRef } from 'react';
import { getBabiesByParent } from '@/lib/firestore';
import { careLogsApi, weightTrackingApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Droplet,
  Moon,
  Pill,
  Clock,
  Check,
  ArrowLeft,
  Plus,
  Minus,
  Upload,
  Image as ImageIcon,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/layout/Header';
import PrescriptionReviewModal from '@/components/prescription/PrescriptionReviewModal';
import ExportFeedbackButton from '@/components/dashboard/ExportFeedbackButton';

const DailyLog = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'feeding' | 'sleep' | 'medication'>('feeding');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [babyId, setBabyId] = useState(null);

  const [feedingData, setFeedingData] = useState({
    time: new Date().toTimeString().slice(0, 5),
    quantity: 100,
  });

  const [sleepData, setSleepData] = useState({
    startTime: '',
    duration: 2,
  });

  const [medicationData, setMedicationData] = useState({
    given: false,
    notes: '',
  });
  const [weightData, setWeightData] = useState({
    weight: '',
  });
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchBaby() {
      if (user) {
        const babies = await getBabiesByParent(user.uid);
        if (babies.length > 0) setBabyId(babies[0].id);
      }
    }
    fetchBaby();
  }, [user]);

  const tabs = [
    { id: 'feeding' as const, label: t('log.feeding'), icon: Droplet, color: 'bg-healthcare-blue-light', iconColor: 'text-primary' },
    { id: 'sleep' as const, label: t('log.sleep'), icon: Moon, color: 'bg-healthcare-mint-light', iconColor: 'text-healthcare-mint' },
    { id: 'medication' as const, label: t('log.medication'), icon: Pill, color: 'bg-healthcare-peach', iconColor: 'text-healthcare-peach-dark' },
  ];

  const handleSubmit = async () => {
    if (!babyId) {
      toast({ title: 'No baby profile found', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const babies = await getBabiesByParent(user.uid);
      const baby = babies.find(b => b.id === babyId);
      if (!baby) throw new Error('Baby not found');
      
      let logData: any = { babyId };
      
      if (activeTab === 'feeding') {
        logData = {
          babyId,
          type: 'feeding',
          quantity: feedingData.quantity,
        };
      } else if (activeTab === 'sleep') {
        logData = {
          babyId,
          type: 'sleep',
          duration: sleepData.duration * 60, // convert hours to minutes
        };
      } else if (activeTab === 'medication') {
        logData = {
          babyId,
          type: 'medication',
          medicationGiven: medicationData.given,
        };
      }

      const result = await careLogsApi.create(logData);
      
      // If weight was entered, save it
      if (weightData.weight) {
        try {
          await weightTrackingApi.createOrUpdateWeight(
            babyId,
            Number(weightData.weight)
          );
        } catch (weightError) {
          console.error('Error saving weight:', weightError);
          // Don't fail the entire request if weight save fails
        }
      }
      
      toast({
        title: 'Log saved! ✨',
        description: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} entry has been recorded.${result.alertsCreated > 0 ? ` ${result.alertsCreated} alert(s) generated.` : ''}`,
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Error saving log', description: error.message || 'Failed to save log', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustQuantity = (amount: number) => {
    setFeedingData((prev) => ({
      ...prev,
      quantity: Math.max(0, prev.quantity + amount),
    }));
  };

  const adjustDuration = (amount: number) => {
    setSleepData((prev) => ({
      ...prev,
      duration: Math.max(0, Math.round((prev.duration + amount) * 10) / 10),
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPrescriptionImage(base64);
      setShowPrescriptionModal(true);
    };
    reader.onerror = () => {
      toast({
        title: 'Upload failed',
        description: 'Failed to read image file',
        variant: 'destructive',
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePrescriptionConfirm = (prescriptionId: string) => {
    toast({
      title: 'Prescription scheduled! ✨',
      description: 'Medication reminders have been set up.',
    });
    // Optionally refresh or navigate
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-lg">
          {/* Back Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <h1 className="text-2xl font-bold text-foreground mb-6">{t('log.title')}</h1>

          {/* Export Button */}
          <div className="mb-6 flex justify-end">
            <ExportFeedbackButton variant="outline" showHistory={false} />
          </div>
          <div className="flex gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                  activeTab === tab.id
                    ? `${tab.color} shadow-card scale-105`
                    : 'bg-secondary/50 hover:bg-secondary'
                }`}
              >
                <tab.icon
                  className={`w-6 h-6 ${
                    activeTab === tab.id ? tab.iconColor : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Form Content */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {activeTab === 'feeding' && <Droplet className="w-5 h-5 text-primary" />}
                {activeTab === 'sleep' && <Moon className="w-5 h-5 text-healthcare-mint" />}
                {activeTab === 'medication' && <Pill className="w-5 h-5 text-healthcare-peach-dark" />}
                {t(`log.${activeTab}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feeding Form */}
              {activeTab === 'feeding' && (
                <>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {t('log.time')}
                    </Label>
                    <Input
                      type="time"
                      value={feedingData.time}
                      onChange={(e) => setFeedingData({ ...feedingData, time: e.target.value })}
                      className="h-14 text-lg text-center bg-secondary/50"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>{t('log.quantity')}</Label>
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-2xl"
                        onClick={() => adjustQuantity(-10)}
                      >
                        <Minus className="w-6 h-6" />
                      </Button>
                      <div className="w-32 h-20 bg-healthcare-blue-light rounded-2xl flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-primary">
                          {feedingData.quantity}
                        </span>
                        <span className="text-xs text-muted-foreground">ml</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-2xl"
                        onClick={() => adjustQuantity(10)}
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[60, 90, 120, 150].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setFeedingData({ ...feedingData, quantity: preset })}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            feedingData.quantity === preset
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {preset}ml
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Sleep Form */}
              {activeTab === 'sleep' && (
                <>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Start Time
                    </Label>
                    <Input
                      type="time"
                      value={sleepData.startTime}
                      onChange={(e) => setSleepData({ ...sleepData, startTime: e.target.value })}
                      className="h-14 text-lg text-center bg-secondary/50"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>{t('log.duration')}</Label>
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-2xl"
                        onClick={() => adjustDuration(-0.5)}
                      >
                        <Minus className="w-6 h-6" />
                      </Button>
                      <div className="w-32 h-20 bg-healthcare-mint-light rounded-2xl flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-healthcare-mint">
                          {sleepData.duration}
                        </span>
                        <span className="text-xs text-muted-foreground">hours</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-2xl"
                        onClick={() => adjustDuration(0.5)}
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[0.5, 1, 1.5, 2, 3].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setSleepData({ ...sleepData, duration: preset })}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            sleepData.duration === preset
                              ? 'bg-healthcare-mint text-white'
                              : 'bg-secondary text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {preset}h
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Medication Form */}
              {activeTab === 'medication' && (
                <div className="space-y-6">
                  {/* Prescription Upload Button */}
                  <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20">
                    <div className="flex items-center gap-3 mb-3">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Scan Prescription</p>
                        <p className="text-xs text-muted-foreground">
                          Upload a photo of your prescription to automatically extract medication details
                        </p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Prescription Image
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span>OR</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-secondary/50 rounded-2xl">
                    <div>
                      <p className="font-medium text-foreground">Medication Given Today?</p>
                      <p className="text-sm text-muted-foreground">
                        Toggle if any prescribed medication was given
                      </p>
                    </div>
                    <Switch
                      checked={medicationData.given}
                      onCheckedChange={(checked) =>
                        setMedicationData({ ...medicationData, given: checked })
                      }
                    />
                  </div>

                  <div
                    className={`p-4 rounded-2xl ${
                      medicationData.given
                        ? 'bg-alert-success/10 border border-alert-success/30'
                        : 'bg-secondary/30 border border-border'
                    }`}
                  >
                    <p className="text-sm font-medium text-center">
                      {medicationData.given ? (
                        <span className="text-alert-success">✓ {t('log.given')}</span>
                      ) : (
                        <span className="text-muted-foreground">{t('log.notGiven')}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Weekly Weight Input Section */}
              <div className="space-y-4 p-4 bg-secondary/30 rounded-2xl border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-healthcare-mint" />
                    <Label className="font-semibold">Weekly Baby Weight (kg)</Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWeightInput(!showWeightInput)}
                  >
                    {showWeightInput ? 'Cancel' : 'Add Weight'}
                  </Button>
                </div>

                {showWeightInput && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="weight-value" className="text-sm text-muted-foreground">
                        Weight (kg)
                      </Label>
                      <Input
                        id="weight-value"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g., 5.2"
                        value={weightData.weight}
                        onChange={(e) => setWeightData({ ...weightData, weight: e.target.value })}
                        className="h-12 bg-background"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This weight entry will be recorded for this week and visible on the Baby Growth Awareness chart.
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-14 text-lg font-semibold shadow-soft hover:shadow-hover transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    {t('log.add')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Prescription Review Modal */}
      {prescriptionImage && babyId && (
        <PrescriptionReviewModal
          isOpen={showPrescriptionModal}
          onClose={() => {
            setShowPrescriptionModal(false);
            setPrescriptionImage(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          babyId={babyId}
          imageBase64={prescriptionImage}
          onConfirm={handlePrescriptionConfirm}
        />
      )}
    </div>
  );
};

export default DailyLog;
