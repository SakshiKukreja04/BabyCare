import { useState, useEffect } from 'react';
import { Loader2, Check, X, Upload, Image as ImageIcon, Edit2, Trash2, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prescriptionsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PrescriptionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string;
  imageBase64: string;
  onConfirm: (prescriptionId: string) => void;
}

interface Medicine {
  medicine_name: string;
  dosage: string;
  frequency: string;
  times_per_day: number;
  suggested_start_time: string;
  dose_schedule?: string[]; // Array of all dose times
}

const PrescriptionReviewModal = ({
  isOpen,
  onClose,
  babyId,
  imageBase64,
  onConfirm,
}: PrescriptionReviewModalProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen && imageBase64 && medicines.length === 0 && !isScanning) {
      scanPrescription();
    }
  }, [isOpen, imageBase64]);

  const scanPrescription = async () => {
    setIsScanning(true);
    try {
      const result = await prescriptionsApi.scanPrescription(babyId, imageBase64);
      // Calculate dose schedule for each medicine
      const medicinesWithSchedule = (result.medicines || []).map(med => ({
        ...med,
        dose_schedule: calculateDoseSchedule(med.frequency, med.times_per_day, med.suggested_start_time),
      }));
      setMedicines(medicinesWithSchedule);
      setPrescriptionId(result.prescriptionId);
    } catch (error: any) {
      console.error('Error scanning prescription:', error);
      toast({
        title: 'Scan failed',
        description: error.message || 'Failed to scan prescription image',
        variant: 'destructive',
      });
      onClose();
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (!prescriptionId || medicines.length === 0) return;

    // Validate all medicines
    const invalidMedicines = medicines.filter(
      med => !med.medicine_name.trim() || !med.dosage.trim()
    );
    if (invalidMedicines.length > 0) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields for all medicines',
        variant: 'destructive',
      });
      return;
    }

    setIsConfirming(true);
    try {
      await prescriptionsApi.confirmPrescription(prescriptionId, medicines);
      toast({
        title: 'Prescription confirmed! ✨',
        description: `Successfully scheduled ${medicines.length} ${medicines.length === 1 ? 'medication' : 'medications'}.`,
      });
      onConfirm(prescriptionId);
      onClose();
    } catch (error: any) {
      console.error('Error confirming prescription:', error);
      toast({
        title: 'Confirmation failed',
        description: error.message || 'Failed to confirm prescription',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    setMedicines([]);
    setPrescriptionId(null);
    setEditingIndex(null);
    onClose();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index: number) => {
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    const newMedicines = medicines.filter((_, i) => i !== index);
    setMedicines(newMedicines);
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
    toast({
      title: 'Medicine removed',
      description: 'You can add it back if needed',
    });
  };

  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      {
        medicine_name: '',
        dosage: '',
        frequency: '',
        times_per_day: 2,
        suggested_start_time: '08:00',
      },
    ]);
    setEditingIndex(medicines.length);
  };

  /**
   * Extract times_per_day from frequency text (same logic as backend)
   */
  const extractTimesPerDay = (frequency: string): number => {
    if (!frequency) return 2;
    const freqLower = frequency.toLowerCase();
    
    // Match "X doses in 24hrs" (handle OCR error "closes")
    const dosesMatch = freqLower.match(/(\d+)\s*(?:doses?|times?|closes?)\s*(?:in|per|a)\s*(?:24\s*hrs?|day|daily)/);
    if (dosesMatch) {
      const count = parseInt(dosesMatch[1], 10);
      if (count > 0 && count <= 12) return count;
    }
    
    // Match "every X hours" or "every X-Y hours"
    const everyHoursMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s+(\d+))?\s*(?:hour|hr|h)/);
    if (everyHoursMatch) {
      const firstHour = parseInt(everyHoursMatch[1], 10);
      const secondHour = everyHoursMatch[2] ? parseInt(everyHoursMatch[2], 10) : null;
      const hours = secondHour && secondHour > firstHour ? secondHour : firstHour;
      if (hours > 0 && hours <= 24) {
        const calculated = Math.floor(24 / hours);
        if (calculated >= 1 && calculated <= 12) return calculated;
      }
    }
    
    // Explicit counts
    if (freqLower.includes('once')) return 1;
    if (freqLower.includes('twice')) return 2;
    if (freqLower.includes('thrice') || freqLower.includes('three times')) return 3;
    if (freqLower.includes('four times') || freqLower.includes('4 times')) return 4;
    
    return 2;
  };

  /**
   * Calculate dose schedule based on frequency and times_per_day
   */
  const calculateDoseSchedule = (frequency: string, timesPerDay: number, startTime: string): string[] => {
    console.log('🕐 [calculateDoseSchedule] frequency:', frequency, 'timesPerDay:', timesPerDay, 'startTime:', startTime);
    const times: string[] = [];
    const freqLower = frequency.toLowerCase();
    
    // Parse start time - handle both "HH:MM" format and invalid formats
    let startHour = 8;
    let startMin = 0;
    
    if (startTime && startTime.includes(':')) {
      const parts = startTime.split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        startHour = parts[0];
        startMin = parts[1];
      } else {
        console.warn('⚠️  Invalid start time format:', startTime);
      }
    }
    
    console.log('🕐 [calculateDoseSchedule] Parsed startHour:', startHour, 'startMin:', startMin);
    
    // Handle "every X hours" or "every X-Y hours"
    const everyHoursMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s+(\d+))?\s*(?:hour|hr|h)/);
    if (everyHoursMatch) {
      const firstHour = parseInt(everyHoursMatch[1], 10);
      const secondHour = everyHoursMatch[2] ? parseInt(everyHoursMatch[2], 10) : null;
      const hoursBetweenDoses = secondHour && secondHour > firstHour ? secondHour : firstHour;
      
      for (let i = 0; i < timesPerDay; i++) {
        const doseHour = (startHour + (i * hoursBetweenDoses)) % 24;
        times.push(`${String(doseHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`);
      }
      const result = times.sort((a, b) => {
        const [h1, m1] = a.split(':').map(Number);
        const [h2, m2] = b.split(':').map(Number);
        return h1 * 60 + m1 - (h2 * 60 + m2);
      });
      console.log('🕐 [calculateDoseSchedule] Every X hours result:', result);
      return result;
    }
    
    // Once daily
    if (timesPerDay === 1) {
      const formattedTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      console.log('🕐 [calculateDoseSchedule] Once daily:', [formattedTime]);
      return [formattedTime];
    }
    
    // Twice daily (morning and evening)
    if (timesPerDay === 2) {
      const result = [
        `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 12) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      ];
      console.log('🕐 [calculateDoseSchedule] Twice daily:', result);
      return result;
    }
    
    // Thrice daily
    if (timesPerDay === 3) {
      const result = [
        `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 8) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 16) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      ];
      console.log('🕐 [calculateDoseSchedule] Thrice daily:', result);
      return result;
    }
    
    // 4 times per day (every 6 hours)
    if (timesPerDay === 4) {
      const result = [
        `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 6) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 12) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        `${String((startHour + 18) % 24).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      ];
      console.log('🕐 [calculateDoseSchedule] 4 times daily:', result);
      return result;
    }
    
    // Default: distribute evenly
    const intervalHours = 24 / timesPerDay;
    for (let i = 0; i < timesPerDay; i++) {
      const totalMinutes = startHour * 60 + startMin + (i * intervalHours * 60);
      const doseHour = Math.floor((totalMinutes / 60) % 24);
      const doseMin = Math.floor(totalMinutes % 60);
      times.push(`${String(doseHour).padStart(2, '0')}:${String(doseMin).padStart(2, '0')}`);
    }
    
    const result = times.sort((a, b) => {
      const [h1, m1] = a.split(':').map(Number);
      const [h2, m2] = b.split(':').map(Number);
      return h1 * 60 + m1 - (h2 * 60 + m2);
    });
    console.log('🕐 [calculateDoseSchedule] Default distributed:', result);
    return result;
  };

  const updateMedicine = (index: number, field: keyof Medicine, value: any) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    
    // If frequency changed, automatically recalculate times_per_day and dose schedule
    if (field === 'frequency') {
      const calculatedTimesPerDay = extractTimesPerDay(value);
      updated[index].times_per_day = calculatedTimesPerDay;
      const schedule = calculateDoseSchedule(
        value,
        calculatedTimesPerDay,
        updated[index].suggested_start_time
      );
      updated[index].dose_schedule = schedule;
    }
    // If times_per_day or start_time changed, recalculate dose schedule
    else if (field === 'times_per_day' || field === 'suggested_start_time') {
      const med = updated[index];
      const schedule = calculateDoseSchedule(
        med.frequency,
        med.times_per_day,
        med.suggested_start_time
      );
      updated[index].dose_schedule = schedule;
    }
    
    setMedicines(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Review Prescription
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Original Image */}
          <div className="relative">
            <div className="w-full h-48 bg-secondary/50 rounded-xl overflow-hidden flex items-center justify-center border border-border">
              {imageBase64 ? (
                <img
                  src={`data:image/jpeg;base64,${imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64}`}
                  alt="Prescription"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            {isScanning && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Analyzing prescription...</p>
                  <p className="text-xs text-muted-foreground">Extracting medication details</p>
                </div>
              </div>
            )}
          </div>

          {/* Medicines List */}
          {!isScanning && medicines.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Medicines Found ({medicines.length})</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMedicine}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Medicine
                </Button>
              </div>

              {medicines.map((medicine, index) => (
                <Card key={index} className={editingIndex === index ? 'border-primary border-2' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {index + 1}
                        </span>
                        {medicine.medicine_name || 'New Medicine'}
                      </CardTitle>
                      <div className="flex gap-2">
                        {editingIndex === index ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveEdit(index)}
                            className="h-8 gap-1"
                          >
                            <Check className="w-4 h-4" />
                            Save
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(index)}
                            className="h-8 gap-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(index)}
                          className="h-8 gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingIndex === index ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`medicine_name_${index}`}>Medicine Name *</Label>
                          <Input
                            id={`medicine_name_${index}`}
                            value={medicine.medicine_name}
                            onChange={(e) => updateMedicine(index, 'medicine_name', e.target.value)}
                            placeholder="e.g., Paracetamol"
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`dosage_${index}`}>Dosage *</Label>
                          <Input
                            id={`dosage_${index}`}
                            value={medicine.dosage}
                            onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                            placeholder="e.g., 5ml or 250mg"
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`frequency_${index}`}>Frequency</Label>
                          <Input
                            id={`frequency_${index}`}
                            value={medicine.frequency}
                            onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                            placeholder="e.g., Twice daily"
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`times_per_day_${index}`}>Times Per Day</Label>
                          <Input
                            id={`times_per_day_${index}`}
                            type="number"
                            min="1"
                            max="6"
                            value={medicine.times_per_day}
                            onChange={(e) => updateMedicine(index, 'times_per_day', parseInt(e.target.value, 10) || 1)}
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`suggested_start_time_${index}`}>Start Time</Label>
                          <Input
                            id={`suggested_start_time_${index}`}
                            type="time"
                            value={medicine.suggested_start_time}
                            onChange={(e) => updateMedicine(index, 'suggested_start_time', e.target.value)}
                            className="h-10"
                          />
                          {medicine.dose_schedule && medicine.dose_schedule.length > 0 && (
                            <div className="mt-2 p-2 bg-primary/5 rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">Dose Schedule:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {medicine.dose_schedule.map((time, timeIndex) => (
                                  <span
                                    key={timeIndex}
                                    className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium"
                                  >
                                    {time}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Dosage:</span>
                            <p className="font-medium">{medicine.dosage || 'Not specified'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Frequency:</span>
                            <p className="font-medium">{medicine.frequency || 'Not specified'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Times Per Day:</span>
                            <p className="font-medium">{medicine.times_per_day}x</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Start Time:</span>
                            <p className="font-medium">{medicine.suggested_start_time}</p>
                          </div>
                        </div>
                        {medicine.dose_schedule && medicine.dose_schedule.length > 0 && (
                          <div className="pt-2 border-t border-border/40">
                            <span className="text-muted-foreground text-sm block mb-2">Dose Schedule:</span>
                            <div className="flex flex-wrap gap-2">
                              {medicine.dose_schedule
                                .filter((time: string) => time && !time.includes('NaN'))
                                .map((time: string, timeIndex: number) => (
                                  <span
                                    key={timeIndex}
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    {time}
                                  </span>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Doses will be scheduled at these times throughout the day
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isScanning && medicines.length === 0 && prescriptionId && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No medicines extracted. Please add them manually.</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddMedicine}
                className="mt-4 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Medicine
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isConfirming || isScanning}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          {!isScanning && medicines.length > 0 && (
            <Button onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm & Schedule
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrescriptionReviewModal;
