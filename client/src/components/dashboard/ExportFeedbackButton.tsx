/**
 * Export Feedback Logs Component
 * Provides UI for exporting care logs to Google Sheets
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { exportFeedbackLogsToCSV, getExportHistory } from '@/lib/feedbackExportApi';
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ExportFeedbackButtonProps {
  onSuccess?: (data: any) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  showHistory?: boolean;
}

export const ExportFeedbackButton = ({
  onSuccess,
  variant = 'outline',
  showHistory = true,
}: ExportFeedbackButtonProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<any | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const result = await exportFeedbackLogsToCSV();

      if (result.success) {
        setLastExportResult(result);
        toast({
          title: '✅ Export Successful!',
          description: result.totalLogs 
            ? `Downloaded CSV file with ${result.totalLogs} logs`
            : 'CSV file downloaded successfully',
          variant: 'default',
        });

        // Refresh history if available
        if (showHistory) {
          await fetchHistory();
        }

        // Call success callback
        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        if (result.totalLogs === 0) {
          toast({
            title: 'ℹ️ No Data to Export',
            description:
              "You don't have any care logs yet. Start logging your baby's feeding, sleep, alerts, and medications to generate a report.",
            variant: 'default',
          });
        } else {
          toast({
            title: '❌ Export Failed',
            description: result.error || 'Unable to export logs. Please try again.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: '❌ Error',
        description:
          error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await getExportHistory();
      setExportHistory(history);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenDialog = async () => {
    setShowDialog(true);
    if (showHistory) {
      await fetchHistory();
    }
  };

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        variant={variant}
        className="gap-2"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {isLoading ? 'Exporting...' : 'Export to CSV'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Care Logs
            </DialogTitle>
            <DialogDescription>
              Export all your baby's care logs to a CSV file for easy tracking and sharing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Export Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Create New Export</h3>
              <Button
                onClick={handleExport}
                disabled={isLoading}
                className="w-full gap-2"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export All Logs to CSV
                  </>
                )}
              </Button>

              {lastExportResult && lastExportResult.success && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-900">Export Successful!</p>
                      <p className="text-green-800 text-xs mt-1">
                        {lastExportResult.totalLogs 
                        ? `${lastExportResult.totalLogs} logs exported${lastExportResult.dateRange ? ` (${lastExportResult.dateRange.from} to ${lastExportResult.dateRange.to})` : ''}`
                        : 'CSV file downloaded'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History Section */}
            {showHistory && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Export History
                  </h3>
                  {loadingHistory && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {exportHistory.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {exportHistory.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.totalLogs} logs{item.dateRange ? ` • ${item.dateRange.from} to ${item.dateRange.to}` : ''}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                              CSV
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No exports yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExportFeedbackButton;
