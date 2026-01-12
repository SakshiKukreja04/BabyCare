/**
 * Feedback Export Service
 * Handles exporting care logs to Google Sheets
 */

import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

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
 * Export care logs to Google Sheets
 * Creates a new Google Sheet with all feedback logs
 */
export async function exportFeedbackLogsToGoogleSheets(): Promise<{
  success: boolean;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  totalLogs?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  message?: string;
  error?: string;
}> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/export-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        `Export failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.message || 'Export failed',
      };
    }

    return {
      success: true,
      spreadsheetUrl: data.data?.spreadsheetUrl,
      spreadsheetId: data.data?.spreadsheetId,
      totalLogs: data.data?.totalLogs,
      dateRange: data.data?.dateRange,
      message: data.message,
    };
  } catch (error) {
    console.error('Error exporting feedback logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get export history for the current user
 */
export async function getExportHistory(): Promise<
  Array<{
    id: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
    totalLogs: number;
    dateRange: {
      from: string;
      to: string;
    };
    createdAt: string;
  }>
> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/export-feedback/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching export history:', error);
    return [];
  }
}
