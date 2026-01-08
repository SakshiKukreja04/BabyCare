import { auth } from './firebase';
// Note: We only import 'auth' here, not 'db' (firestore)
// because this module makes HTTP requests to the backend API,
// not direct Firestore queries. The backend handles all Firestore operations.

/**
 * API Client for Backend Integration
 * Handles all HTTP requests to the Node.js backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
};

/**
 * Health check (no auth required)
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

