import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AudioWaveform,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Baby,
  FileAudio,
  X,
  RefreshCw,
} from 'lucide-react';
import { cryAnalysisApi } from '@/lib/api';

interface CryAnalysisResult {
  prediction?: string;
  label?: string;  // Alternative field name from some ML models
  confidence?: number;
  score?: number;  // Alternative field name from some ML models
  probabilities?: Record<string, number>;
  recommendations?: string[];
  [key: string]: any;  // Allow additional fields
}

interface AnalysisResponse {
  success: boolean;
  data: CryAnalysisResult;
  meta?: {
    processingTimeMs: number;
    originalFilename: string;
  };
}

const CAUSE_LABELS: Record<string, { label: string; color: string; bgColor: string; icon: string; description: string }> = {
  hungry: { 
    label: 'Hungry', 
    color: 'bg-orange-500', 
    bgColor: 'bg-orange-50 border-orange-200',
    icon: '🍼',
    description: 'Your baby might be hungry. Consider feeding them.'
  },
  hunger: { 
    label: 'Hungry', 
    color: 'bg-orange-500', 
    bgColor: 'bg-orange-50 border-orange-200',
    icon: '🍼',
    description: 'Your baby might be hungry. Consider feeding them.'
  },
  tired: { 
    label: 'Tired / Sleepy', 
    color: 'bg-blue-500', 
    bgColor: 'bg-blue-50 border-blue-200',
    icon: '😴',
    description: 'Your baby seems tired. Try putting them to sleep.'
  },
  discomfort: { 
    label: 'Discomfort', 
    color: 'bg-yellow-500', 
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: '😣',
    description: 'Your baby seems uncomfortable. Check diaper or clothing.'
  },
  belly_pain: { 
    label: 'Belly Pain', 
    color: 'bg-red-500', 
    bgColor: 'bg-red-50 border-red-200',
    icon: '🤒',
    description: 'Your baby might have belly pain. Try gentle tummy massage or burping.'
  },
  burping: { 
    label: 'Needs Burping', 
    color: 'bg-green-500', 
    bgColor: 'bg-green-50 border-green-200',
    icon: '💨',
    description: 'Your baby might need to burp. Hold them upright and pat their back.'
  },
  lonely: { 
    label: 'Wants Attention', 
    color: 'bg-purple-500', 
    bgColor: 'bg-purple-50 border-purple-200',
    icon: '🤗',
    description: 'Your baby wants attention. Try cuddling or talking to them.'
  },
  cold: { 
    label: 'Feeling Cold', 
    color: 'bg-cyan-500', 
    bgColor: 'bg-cyan-50 border-cyan-200',
    icon: '🥶',
    description: 'Your baby might be cold. Add a layer of clothing or blanket.'
  },
  hot: { 
    label: 'Feeling Hot', 
    color: 'bg-rose-500', 
    bgColor: 'bg-rose-50 border-rose-200',
    icon: '🥵',
    description: 'Your baby might be hot. Remove a layer of clothing.'
  },
};

export default function CryAnalysis() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
      const validExtensions = ['.wav', '.mp3'];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
        setError('Please select a valid audio file (.wav or .mp3)');
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File is too large. Maximum size is 10MB.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an audio file first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      console.log('🎤 [CryAnalysis] Starting analysis...');
      const response = await cryAnalysisApi.analyze(selectedFile);
      console.log('🎤 [CryAnalysis] Raw response:', response);
      
      // Normalize the response structure
      // Handle both {success, data} and direct response formats
      let normalizedResult: AnalysisResponse;
      
      if (response.success !== undefined) {
        // Response is already in expected format
        normalizedResult = response;
      } else if (response.data) {
        // Response has data but no success flag
        normalizedResult = { success: true, data: response.data, meta: response.meta };
      } else {
        // Response is the data directly (from Flask)
        normalizedResult = { 
          success: true, 
          data: response,
          meta: undefined
        };
      }
      
      console.log('🎤 [CryAnalysis] Normalized result:', normalizedResult);
      setResult(normalizedResult);
    } catch (err: any) {
      console.error('Cry analysis error:', err);
      
      // Handle specific error types
      if (err.message.includes('unavailable') || err.message.includes('503')) {
        setError('The cry analysis service is currently unavailable. Please try again later.');
      } else if (err.message.includes('timeout') || err.message.includes('504')) {
        setError('Analysis timed out. Please try with a shorter audio clip.');
      } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Session expired. Please refresh the page and try again.');
      } else {
        setError(err.message || 'Failed to analyze audio. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCauseInfo = (cause: string) => {
    return CAUSE_LABELS[cause.toLowerCase()] || { 
      label: cause.charAt(0).toUpperCase() + cause.slice(1).replace(/_/g, ' '), 
      color: 'bg-gray-500',
      bgColor: 'bg-gray-50 border-gray-200',
      icon: '👶',
      description: 'Unable to determine the exact cause.'
    };
  };

  // Extract probabilities from Flask response (excludes top_reason)
  const getProbabilities = () => {
    if (!result?.data) return [];
    
    const data = result.data;
    const excluded = ['top_reason', 'prediction', 'label', 'confidence', 'score', 'recommendations'];
    
    return Object.entries(data)
      .filter(([key, value]) => !excluded.includes(key) && typeof value === 'number')
      .map(([cause, probability]) => ({ cause, probability: probability as number }))
      .sort((a, b) => b.probability - a.probability);
  };

  // Get top reason from Flask response
  const getTopReason = () => {
    if (!result?.data) return null;
    return result.data.top_reason || result.data.prediction || result.data.label || null;
  };

  // Get highest confidence from probabilities
  const getHighestConfidence = () => {
    const probs = getProbabilities();
    if (probs.length === 0) return null;
    return probs[0].probability;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <AudioWaveform className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Baby Cry Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Upload an audio recording of your baby's cry to understand what they might need.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Audio
              </CardTitle>
              <CardDescription>
                Select a .wav or .mp3 file (max 10MB) containing your baby's cry
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* File Input Area */}
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${isAnalyzing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
                `}
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,.mp3,audio/wav,audio/mpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isAnalyzing}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <FileAudio className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                      disabled={isAnalyzing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-4 bg-muted rounded-full w-fit mx-auto">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">
                      WAV or MP3 files up to 10MB
                    </p>
                  </div>
                )}
              </div>

              {/* Analyze Button */}
              <div className="mt-6 flex justify-center">
                <Button
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={!selectedFile || isAnalyzing}
                  className="min-w-[200px]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <AudioWaveform className="mr-2 h-4 w-4" />
                      Analyze Cry
                    </>
                  )}
                </Button>
              </div>

              {/* Loading State */}
              {isAnalyzing && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Baby className="h-4 w-4 animate-bounce" />
                    <span>AI is listening to your baby's cry...</span>
                  </div>
                  <Progress value={undefined} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Section */}
          {result && result.success && result.data && (
            <div className="space-y-6">
              {/* Main Result Card */}
              <Card className={`border-2 ${getCauseInfo(getTopReason() || 'unknown').bgColor}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      Analysis Complete
                    </CardTitle>
                    {result.meta && (
                      <Badge variant="outline" className="text-xs">
                        {(result.meta.processingTimeMs / 1000).toFixed(1)}s
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Top Reason Hero Section */}
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">Your baby is most likely experiencing</p>
                    <div className="inline-flex flex-col items-center gap-3 p-6 rounded-2xl bg-white dark:bg-gray-900 shadow-lg">
                      <span className="text-6xl animate-bounce">
                        {getCauseInfo(getTopReason() || 'unknown').icon}
                      </span>
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {getCauseInfo(getTopReason() || 'unknown').label}
                      </h2>
                      {getHighestConfidence() !== null && (
                        <Badge className={`${getCauseInfo(getTopReason() || 'unknown').color} text-white text-lg px-4 py-1`}>
                          {(getHighestConfidence()! * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="mt-6 text-muted-foreground max-w-md mx-auto">
                      {getCauseInfo(getTopReason() || 'unknown').description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Probability Breakdown Cards */}
              {getProbabilities().length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Breakdown</CardTitle>
                    <CardDescription>All detected patterns in your baby's cry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {getProbabilities().map(({ cause, probability }, index) => {
                        const causeInfo = getCauseInfo(cause);
                        const percentage = probability * 100;
                        const isTopReason = cause.toLowerCase() === (getTopReason() || '').toLowerCase();
                        
                        return (
                          <div 
                            key={cause} 
                            className={`
                              relative p-4 rounded-xl border-2 transition-all
                              ${isTopReason 
                                ? `${causeInfo.bgColor} shadow-md` 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                              }
                            `}
                          >
                            {isTopReason && (
                              <Badge className="absolute -top-2 -right-2 bg-green-500">
                                Top Match
                              </Badge>
                            )}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-3xl">{causeInfo.icon}</span>
                              <div className="flex-1">
                                <h4 className="font-semibold">{causeInfo.label}</h4>
                                <p className="text-2xl font-bold text-primary">
                                  {percentage.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${causeInfo.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Tips Card */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Baby className="h-5 w-5" />
                    What You Can Do
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {getTopReason() === 'belly_pain' && (
                      <>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Try gentle clockwise tummy massage</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Hold baby upright to help with gas</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Try bicycle leg movements</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Warm compress on tummy may help</span>
                        </div>
                      </>
                    )}
                    {(getTopReason() === 'hungry' || getTopReason() === 'hunger') && (
                      <>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Check when the last feeding was</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Look for feeding cues (sucking, rooting)</span>
                        </div>
                      </>
                    )}
                    {getTopReason() === 'tired' && (
                      <>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Create a calm, dark environment</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Try gentle rocking or swaddling</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Play soft white noise</span>
                        </div>
                      </>
                    )}
                    {getTopReason() === 'discomfort' && (
                      <>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Check and change diaper if needed</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Check clothing for comfort</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Ensure room temperature is comfortable</span>
                        </div>
                      </>
                    )}
                    {!['belly_pain', 'hungry', 'hunger', 'tired', 'discomfort'].includes(getTopReason() || '') && (
                      <>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Check basic needs (hunger, diaper, sleep)</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <span className="text-sm">Try comforting with cuddles</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Try Again Button */}
              <Button
                variant="outline"
                onClick={handleRemoveFile}
                className="w-full"
                size="lg"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Analyze Another Recording
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
