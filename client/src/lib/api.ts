import { auth } from './firebase';
// Note: We only import 'auth' here, not 'db' (firestore)
// because this module makes HTTP requests to the backend API,
// not direct Firestore queries. The backend handles all Firestore operations.

/**
 * API Client for Backend Integration
 * Handles all HTTP requests to the Node.js backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

// Export apiRequest for use in components
export { apiRequest };

/**
 * Care Logs API
 */
export const careLogsApi = {
  /**
   * Create a new care log
   */
  async create(logData: {
    babyId: string;
    type: 'feeding' | 'sleep' | 'medication';
    quantity?: number;
    duration?: number;
    medicationGiven?: boolean;
    notes?: string;
  }) {
    return apiRequest<{ careLog: any; alertsCreated: number }>('/api/care-logs', {
      method: 'POST',
      body: JSON.stringify(logData),
    });
  },

  /**
   * Get care logs for a baby
   */
  async getByBaby(babyId: string, limit = 20) {
    return apiRequest<{ careLogs: any[]; count: number }>(
      `/api/care-logs?babyId=${babyId}&limit=${limit}`
    );
  },
};

/**
 * Alerts API
 */
export const alertsApi = {
  /**
   * Get alerts for a baby
   */
  async getByBaby(babyId: string, resolved?: boolean) {
    const params = new URLSearchParams({ babyId });
    if (resolved !== undefined) {
      params.append('resolved', resolved.toString());
    }
    return apiRequest<{ alerts: any[]; count: number }>(`/api/alerts?${params.toString()}`);
  },

  /**
   * Get AI explanation for an alert
   */
  async getExplanation(alertId: string) {
    return apiRequest<{ explanation: string; alertId: string; ruleId: string }>(
      `/api/alerts/${alertId}/explanation`
    );
  },

  /**
   * Mark alert as resolved
   */
  async resolve(alertId: string, resolved = true) {
    return apiRequest<{ alertId: string; resolved: boolean }>(
      `/api/alerts/${alertId}/resolve`,
      {
        method: 'PATCH',
        body: JSON.stringify({ resolved }),
      }
    );
  },
};

/**
 * Chatbot API
 */
export const chatbotApi = {
  /**
   * Send message to chatbot
   */
  async sendMessage(message: string, babyId?: string, context?: any) {
    return apiRequest<{ response: string; timestamp: string }>('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message, babyId, context }),
    });
  },
};

/**
 * Babies API
 */
export const babiesApi = {
  /**
   * Get baby profile with type classification
   */
  async getById(babyId: string) {
    return apiRequest<{ baby: any }>(`/api/babies/${babyId}`);
  },

  /**
   * Get deterministic age summary for dual-timeline tracker
   */
  async getAgeSummary(babyId: string) {
    return apiRequest<{
      name: string;
      gestationalAge: number | null;
      actualAgeWeeks: number;
      correctedAgeWeeks: number;
      weeksEarly: number;
      isPremature: boolean;
    }>(`/api/babies/${babyId}/age-summary`);
  },

  /**
   * Get explainability-only developmental information for this week (premature only)
   */
  async getDevelopmentThisWeek(babyId: string) {
    return apiRequest<{
      correctedAgeWeeks: number;
      isPremature: boolean;
      content: string | null;
    }>(`/api/babies/${babyId}/development-this-week`);
  },

  /**
   * Get baby status for dashboard summary card (All Good / Alerts)
   */
  async getStatus(babyId: string) {
    return apiRequest<{
      babyId: string;
      babyName: string;
      isAllGood: boolean;
      alertCount: number;
      overallSeverity: 'none' | 'low' | 'medium' | 'high';
      summary: string;
      reasons: string[];
      activeAlerts: Array<{
        id: string;
        ruleId: string;
        severity: string;
        title: string;
        description: string;
        message?: string;
        createdAt: string;
      }>;
    }>(`/api/babies/${babyId}/status`);
  },

  /**
   * Refresh alerts by re-evaluating all rules
   * This updates alert messages with latest data
   */
  async refreshAlerts(babyId: string) {
    return apiRequest<{
      alertsEvaluated: number;
      newAlerts: number;
      updatedAlerts: number;
      status: {
        isAllGood: boolean;
        alertCount: number;
        overallSeverity: string;
        summary: string;
      };
    }>(`/api/babies/${babyId}/refresh-alerts`, {
      method: 'POST',
    });
  },
};

/**
 * Prescriptions API
 */
export const prescriptionsApi = {
  /**
   * Scan prescription image and extract medication data
   */
  async scanPrescription(babyId: string, imageBase64: string) {
    return apiRequest<{
      prescriptionId: string;
      medicines: Array<{
        medicine_name: string;
        dosage: string;
        frequency: string;
        times_per_day: number;
        suggested_start_time: string;
        dose_schedule?: string[]; // Array of all dose times
      }>;
      raw_ai_output: string;
    }>('/api/prescriptions/scan-prescription', {
      method: 'POST',
      body: JSON.stringify({ babyId, imageBase64 }),
    });
  },

  /**
   * Confirm and activate a prescription schedule
   */
  async confirmPrescription(
    prescriptionId: string,
    medicines: Array<{
      medicine_name: string;
      dosage: string;
      frequency: string;
      times_per_day: number;
      suggested_start_time: string;
      dose_schedule?: string[]; // Optional: will be calculated on backend if not provided
    }>
  ) {
    return apiRequest<{
      prescriptionId: string;
      status: string;
      message: string;
    }>(`/api/prescriptions/${prescriptionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ medicines }),
    });
  },

  /**
   * Get prescriptions for a baby
   */
  async getByBaby(babyId: string) {
    return apiRequest<{
      prescriptions: any[];
      count: number;
    }>(`/api/prescriptions?babyId=${babyId}`);
  },

  /**
   * Get medication logs for the current user (optionally filtered by babyId)
   */
  async getMedicationLogs(babyId?: string) {
    let url = '/api/prescriptions/logs';
    if (babyId) url += `?babyId=${babyId}`;
    return apiRequest<{ logs: any[] }>(url);
  },
};

/**
 * Cry Analysis API
 */
export const cryAnalysisApi = {
  /**
   * Analyze baby cry audio
   * @param audioFile - WAV or MP3 audio file
   */
  async analyze(audioFile: File) {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await fetch('https://pranjal2510-baby-cry-ai.hf.space/analyze-cry', {
      method: 'POST',
      // Note: Don't set Content-Type for FormData - browser sets it with boundary
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Check cry analysis service health
   */
  async checkHealth() {
    const response = await fetch('https://pranjal2510-baby-cry-ai.hf.space/health');
    return response.json();
  },
};

/**
 * Health check (no auth required)
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

// ============================================
// NUTRITION AWARENESS API
// ============================================

/**
 * Nutrition API - Baby Feeding
 */
export const nutritionBabyApi = {
  /**
   * Get complete baby feeding summary
   */
  async getSummary(babyId: string) {
    return apiRequest<{
      today: {
        suggestedFeedingCount: number;
        logs: any[];
      };
      thisWeek: {
        feedingFrequencyChart: Array<{ day: string; count: number }>;
        feedingTypeDistribution: {
          breast: { count: number; percentage: number };
          formula: { count: number; percentage: number };
          mixed: { count: number; percentage: number };
          total: number;
        };
        consistencyIndicator: {
          status: 'consistent' | 'irregular' | 'insufficient_data';
          variance: number | null;
          averageFeedings: number;
          daysTracked: number;
          message: string;
        };
      };
      positiveIndicators: string[];
      disclaimer: string;
    }>(`/api/nutrition/baby/summary?babyId=${babyId}`);
  },

  /**
   * Get suggested feeding count for today
   */
  async getSuggestedCount(babyId: string) {
    return apiRequest<{
      suggestedFeedingCount: number;
      message: string;
    }>(`/api/nutrition/baby/suggested-count?babyId=${babyId}`);
  },

  /**
   * Log a baby feeding
   */
  async logFeeding(babyId: string, feedingType: 'breast' | 'formula' | 'mixed', feedingTime?: Date, feedingCount?: number) {
    return apiRequest<{
      log: any;
      summary: any;
      message: string;
    }>('/api/nutrition/baby/log', {
      method: 'POST',
      body: JSON.stringify({ babyId, feedingType, feedingTime, feedingCount }),
    });
  },

  /**
   * Get weekly feeding frequency chart data
   */
  async getWeeklyChart(babyId: string) {
    return apiRequest<{
      chartData: Array<{ day: string; count: number }>;
      chartType: string;
      xAxis: string;
      yAxis: string;
    }>(`/api/nutrition/baby/chart/weekly-frequency?babyId=${babyId}`);
  },

  /**
   * Get feeding consistency indicator
   */
  async getConsistency(babyId: string) {
    return apiRequest<{
      status: 'consistent' | 'irregular' | 'insufficient_data';
      variance: number | null;
      averageFeedings: number;
      daysTracked: number;
      message: string;
    }>(`/api/nutrition/baby/consistency?babyId=${babyId}`);
  },
};

/**
 * Nutrition API - Mother Self-Care & Quiz
 */
export const nutritionMotherApi = {
  /**
   * Get complete mother nutrition summary
   */
  async getSummary() {
    return apiRequest<{
      today: {
        selfCare: any;
        quiz: any;
        isComplete: boolean;
      };
      thisWeek: {
        selfCareStats: {
          daysTracked: number;
          completeDays: number;
          waterDays: number;
          mealDays: number;
          completionRate: number;
        };
        nutritionScoreChart: Array<{ day: string; date: string; score: number | null }>;
      };
      thisMonth: {
        averageScore: number | null;
        daysTracked: number;
        trend: 'improving' | 'stable' | 'declining';
        lastMonthAverage: number | null;
      };
      positiveIndicators: string[];
      quizQuestions: any[];
      disclaimer: string;
    }>('/api/nutrition/mother/summary');
  },

  /**
   * Log daily self-care
   */
  async logSelfCare(data: {
    waterIntake: boolean;
    mealsTaken: {
      breakfast: boolean;
      lunch: boolean;
      dinner: boolean;
      snacks: boolean;
    };
    energyLevel: 'low' | 'medium' | 'high';
  }) {
    return apiRequest<{
      log: any;
      summary: any;
      message: string;
    }>('/api/nutrition/mother/self-care', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get today's self-care log
   */
  async getSelfCare(date?: string) {
    const params = date ? `?date=${date}` : '';
    return apiRequest<{
      log: any;
      isComplete: boolean;
    }>(`/api/nutrition/mother/self-care${params}`);
  },

  /**
   * Get nutrition quiz questions
   */
  async getQuizQuestions() {
    return apiRequest<{
      questions: Array<{
        id: string;
        question: string;
        options: Array<{ value: number; label: string }>;
      }>;
      maxScore: number;
      disclaimer: string;
    }>('/api/nutrition/mother/quiz/questions');
  },

  /**
   * Submit nutrition quiz
   */
  async submitQuiz(answers: {
    protein: number;
    vegetables: number;
    fruits: number;
    ironFoods: number;
    hydration: number;
  }) {
    return apiRequest<{
      result: {
        totalScore: number;
        classification: 'excellent' | 'needs_improvement' | 'poor';
        answers: any;
      };
      feedback: string;
      summary: any;
      message: string;
    }>('/api/nutrition/mother/quiz', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  /**
   * Get today's quiz response
   */
  async getTodayQuiz() {
    return apiRequest<{
      response: any;
      hasCompletedToday: boolean;
    }>('/api/nutrition/mother/quiz/today');
  },

  /**
   * Get weekly nutrition score chart
   */
  async getWeeklyScoreChart() {
    return apiRequest<{
      chartData: Array<{ day: string; date: string; score: number | null }>;
      chartType: string;
      xAxis: string;
      yAxis: string;
      maxScore: number;
    }>('/api/nutrition/mother/chart/weekly-score');
  },

  /**
   * Get monthly score card
   */
  async getMonthlyScore() {
    return apiRequest<{
      averageScore: number | null;
      daysTracked: number;
      trend: 'improving' | 'stable' | 'declining';
      lastMonthAverage: number | null;
    }>('/api/nutrition/mother/monthly-score');
  },
};

