/**
 * Feedback Export Service
 * Handles exporting care logs to CSV
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
 * Export care logs to CSV
 * Downloads CSV file directly to user's device
 */
export async function exportFeedbackLogsToCSV(): Promise<{
  success: boolean;
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
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Try to parse JSON error response
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        `Export failed with status ${response.status}`
      );
    }

    // Check if response is CSV
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'feedback_logs.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Get CSV content
      const csvContent = await response.text();

      // Create blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        message: 'CSV file downloaded successfully',
      };
    } else {
      // Handle JSON response (for empty data case)
      const data = await response.json();
      if (data.success === false) {
        return {
          success: false,
          error: data.message || 'Export failed',
        };
      }
      return {
        success: true,
        totalLogs: data.data?.totalLogs || 0,
        dateRange: data.data?.dateRange,
        message: data.message,
      };
    }
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
    totalLogs: number;
    dateRange: {
      from: string;
      to: string;
    };
    format: string;
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
