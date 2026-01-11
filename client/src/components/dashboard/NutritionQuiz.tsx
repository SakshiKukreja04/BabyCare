import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { nutritionMotherApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuizQuestion {
  id: string;
  question: string;
  options: Array<{ value: number; label: string }>;
}

interface QuizResult {
  totalScore: number;
  classification: 'excellent' | 'needs_improvement' | 'poor';
}

const NutritionQuiz = ({ onQuizComplete }: { onQuizComplete?: () => void }) => {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuizData();
  }, []);

  const loadQuizData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Always load questions
      const questionsResponse = await nutritionMotherApi.getQuizQuestions();
      setQuestions(questionsResponse.questions);

      // Check if already completed today
      const todayResponse = await nutritionMotherApi.getTodayQuiz();
      if (todayResponse.hasCompletedToday) {
        setHasCompletedToday(true);
        setResult({
          totalScore: todayResponse.response.totalScore,
          classification: todayResponse.response.classification,
        });
      }
    } catch (err) {
      console.error('Error loading quiz data:', err);
      setError('Failed to load quiz. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleRetake = () => {
    console.log('🔄 Retaking quiz...');
    console.log('📝 Questions available:', questions.length);
    setHasCompletedToday(false);
    setResult(null);
    setFeedback('');
    setAnswers({});
    setCurrentStep(0);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await nutritionMotherApi.submitQuiz({
        protein: answers.protein || 0,
        vegetables: answers.vegetables || 0,
        fruits: answers.fruits || 0,
        ironFoods: answers.ironFoods || 0,
        hydration: answers.hydration || 0,
      });

      setResult(response.result);
      setFeedback(response.feedback);
      setHasCompletedToday(true);
      
      // Call callback if provided
      if (onQuizComplete) {
        onQuizComplete();
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreColor = (classification: string) => {
    switch (classification) {
      case 'excellent':
        return 'text-green-600';
      case 'needs_improvement':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getScoreIcon = (classification: string) => {
    switch (classification) {
      case 'excellent':
        return <CheckCircle2 className="w-8 h-8 text-green-600" />;
      case 'needs_improvement':
        return <CheckCircle2 className="w-8 h-8 text-yellow-600" />;
      case 'poor':
        return <XCircle className="w-8 h-8 text-red-600" />;
      default:
        return null;
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'excellent':
        return 'Excellent';
      case 'needs_improvement':
        return 'Needs Improvement';
      case 'poor':
        return 'Poor';
      default:
        return classification;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-purple-600">Loading quiz...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
        <CardContent className="py-6">
          <p className="text-red-600 text-center">{error}</p>
          <Button 
            onClick={loadQuizData} 
            variant="outline" 
            className="mt-4 w-full"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show result if already completed
  if (hasCompletedToday && result) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-purple-600" />
            </div>
            Today's Nutrition Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-4">
            {getScoreIcon(result.classification)}
            <div className={`text-4xl font-bold mt-2 ${getScoreColor(result.classification)}`}>
              {result.totalScore}/10
            </div>
            <div className={`text-sm font-medium mt-1 ${getScoreColor(result.classification)}`}>
              {getClassificationLabel(result.classification)}
            </div>
            {feedback && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                {feedback}
              </p>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <Button 
              onClick={handleRetake}
              variant="outline"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              Retake Quiz
            </Button>
            <div className="p-3 bg-purple-100/50 rounded-xl border border-purple-200">
              <p className="text-xs text-muted-foreground text-center italic">
                For awareness only. Not medical advice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show quiz questions
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const isLastQuestion = currentStep === questions.length - 1;
  const canProceed = currentQuestion && answers[currentQuestion.id] !== undefined;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-purple-600" />
          </div>
          Daily Nutrition Quiz
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Question {currentStep + 1} of {questions.length}
        </p>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-4 h-2" />

        {currentQuestion && (
          <div className="space-y-4">
            <h3 className="font-medium text-foreground">
              {currentQuestion.question}
            </h3>

            <RadioGroup
              value={answers[currentQuestion.id]?.toString()}
              onValueChange={(value) => handleAnswer(currentQuestion.id, parseInt(value))}
              className="space-y-2"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-purple-200 bg-white/60 hover:bg-purple-50 transition-colors cursor-pointer"
                >
                  <RadioGroupItem
                    value={option.value.toString()}
                    id={`${currentQuestion.id}-${option.value}`}
                  />
                  <Label
                    htmlFor={`${currentQuestion.id}-${option.value}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex gap-2 pt-4">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex-1"
                >
                  Previous
                </Button>
              )}
              
              {isLastQuestion ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed || isSubmitting}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Quiz'
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-purple-100/50 rounded-xl border border-purple-200">
          <p className="text-xs text-muted-foreground text-center italic">
            For awareness only. Not medical advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionQuiz;
