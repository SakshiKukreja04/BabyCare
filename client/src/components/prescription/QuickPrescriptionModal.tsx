import { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { prescriptionsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import PrescriptionReviewModal from './PrescriptionReviewModal';

interface QuickPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  babyId: string;
  onSuccess: () => void; // Callback to refresh medication logs
}

const QuickPrescriptionModal = ({
  isOpen,
  onClose,
  babyId,
  onSuccess,
}: QuickPrescriptionModalProps) => {
  const [imageBase64, setImageBase64] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('⏭️  [QuickPrescriptionModal] No file selected');
      return;
    }

    console.log('📄 [QuickPrescriptionModal] File selected:', file.name, 'size:', file.size);
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.split(',')[1];
        console.log('✅ [QuickPrescriptionModal] File converted to base64, length:', base64Data.length);
        setImageBase64(base64Data);
        setShowReview(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ [QuickPrescriptionModal] Error reading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to read image file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPrescription = (prescriptionId: string) => {
    console.log('✅ [QuickPrescriptionModal] Prescription confirmed:', prescriptionId);
    // Reset state and close
    setImageBase64('');
    setShowReview(false);
    console.log('✅ [QuickPrescriptionModal] Calling onSuccess callback...');
    onSuccess(); // Trigger refresh of medication logs
    onClose();
  };

  if (showReview && imageBase64) {
    return (
      <PrescriptionReviewModal
        isOpen={showReview}
        onClose={() => {
          setShowReview(false);
          setImageBase64('');
        }}
        babyId={babyId}
        imageBase64={imageBase64}
        onConfirm={handleConfirmPrescription}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Prescription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a clear photo of the prescription to extract medication details automatically.
          </p>
          
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-center w-full p-6 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {isLoading ? 'Processing...' : 'Click to upload prescription image'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG up to 5MB
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isLoading}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickPrescriptionModal;
