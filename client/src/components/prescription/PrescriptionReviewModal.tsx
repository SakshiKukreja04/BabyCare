import { useState, useEffect } from 'react';
import { Loader2, Check, X, Upload, Image as ImageIcon } from 'lucide-react';
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

interface PrescriptionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string;
  imageBase64: string;
  onConfirm: (prescriptionId: string) => void;
}

const PrescriptionReviewModal = ({
  isOpen,
  onClose,
  babyId,
  imageBase64,
  onConfirm,
}: PrescriptionReviewModalProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    medicine_name: string;
    dosage: string;
    frequency: string;
    times_per_day: number;
    suggested_start_time: string;
  } | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [editedData, setEditedData] = useState({
    medicine_name: '',
    dosage: '',
    frequency: '',
    times_per_day: 1,
    suggested_start_time: '08:00',
  });
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen && imageBase64 && !extractedData) {
      scanPrescription();
    }
  }, [isOpen, imageBase64]);

  const scanPrescription = async () => {
    setIsScanning(true);
    try {
      const result = await prescriptionsApi.scanPrescription(babyId, imageBase64);
      setExtractedData(result.extractedData);
      setPrescriptionId(result.prescriptionId);
      setEditedData({
        medicine_name: result.extractedData.medicine_name,
        dosage: result.extractedData.dosage,
        frequency: result.extractedData.frequency,
        times_per_day: result.extractedData.times_per_day,
        suggested_start_time: result.extractedData.suggested_start_time,
      });
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
    if (!prescriptionId) return;

    setIsConfirming(true);
    try {
      await prescriptionsApi.confirmPrescription(prescriptionId, editedData);
      toast({
        title: 'Prescription confirmed! ✨',
        description: 'Medication schedule has been saved and activated.',
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
    setExtractedData(null);
    setPrescriptionId(null);
    setEditedData({
      medicine_name: '',
      dosage: '',
      frequency: '',
      times_per_day: 1,
      suggested_start_time: '08:00',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            AI Prescription Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Original Image */}
          <div className="relative">
            <div className="w-full h-48 bg-secondary/50 rounded-xl overflow-hidden flex items-center justify-center">
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
                  <p className="text-sm font-medium text-foreground">Checking prescription...</p>
                  <p className="text-xs text-muted-foreground">Extracting medication details</p>
                </div>
              </div>
            )}
          </div>

          {/* Extracted Data Form */}
          {extractedData && !isScanning && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm font-medium text-primary mb-1">
                  ✓ Medication details extracted
                </p>
                <p className="text-xs text-muted-foreground">
                  Please review and edit the information below if needed
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medicine_name">Medicine Name</Label>
                  <Input
                    id="medicine_name"
                    value={editedData.medicine_name}
                    onChange={(e) =>
                      setEditedData({ ...editedData, medicine_name: e.target.value })
                    }
                    placeholder="e.g., Paracetamol"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dosage">Dosage</Label>
                  <Input
                    id="dosage"
                    value={editedData.dosage}
                    onChange={(e) =>
                      setEditedData({ ...editedData, dosage: e.target.value })
                    }
                    placeholder="e.g., 500mg"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Input
                    id="frequency"
                    value={editedData.frequency}
                    onChange={(e) =>
                      setEditedData({ ...editedData, frequency: e.target.value })
                    }
                    placeholder="e.g., twice daily"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="times_per_day">Times Per Day</Label>
                  <Input
                    id="times_per_day"
                    type="number"
                    min="1"
                    max="6"
                    value={editedData.times_per_day}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        times_per_day: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="h-11"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="suggested_start_time">Suggested Start Time</Label>
                  <Input
                    id="suggested_start_time"
                    type="time"
                    value={editedData.suggested_start_time}
                    onChange={(e) =>
                      setEditedData({ ...editedData, suggested_start_time: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isConfirming}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          {extractedData && !isScanning && (
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
