/**
 * Feedback Export Service - Client Side
 * 
 * Usage example for React/Vue/Angular components
 * Handles exporting feedback logs to Google Sheets
 */

/**
 * Export user's feedback logs to Google Sheets
 * @param {string} authToken - Firebase ID token from user authentication
 * @param {string} apiBaseUrl - API server URL (e.g., http://localhost:5000)
 * @returns {Promise<Object>} - Export result with spreadsheet URL
 */
export const exportFeedbackLogs = async (authToken, apiBaseUrl = 'http://127.0.0.1:5000') => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/export-feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Export failed');
    }

    return {
      success: true,
      spreadsheetUrl: data.data.spreadsheetUrl,
      spreadsheetId: data.data.spreadsheetId,
      totalLogs: data.data.totalLogs,
      dateRange: data.data.dateRange,
      message: data.message,
    };
  } catch (error) {
    console.error('Error exporting feedback logs:', error);
    return {
      success: false,
      error: error.message,
      spreadsheetUrl: null,
    };
  }
};

/**
 * Get export history for the user
 * @param {string} authToken - Firebase ID token
 * @param {string} apiBaseUrl - API server URL
 * @returns {Promise<Array>} - Array of previous exports
 */
export const getExportHistory = async (authToken, apiBaseUrl = 'http://127.0.0.1:5000') => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/export-feedback/history`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching export history:', error);
    return [];
  }
};

// ============================================
// REACT COMPONENT EXAMPLES
// ============================================

/**
 * React Hook for Feedback Export
 */
export const useFeedbackExport = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [result, setResult] = React.useState(null);

  const exportLogs = React.useCallback(async (authToken, apiBaseUrl) => {
    setLoading(true);
    setError(null);

    const result = await exportFeedbackLogs(authToken, apiBaseUrl);

    if (result.success) {
      setResult(result);
    } else {
      setError(result.error);
    }

    setLoading(false);
    return result;
  }, []);

  return { exportLogs, loading, error, result };
};

/**
 * Example: Export Button Component
 */
function ExportFeedbackButton({ authToken, onSuccess }) {
  const { exportLogs, loading, error } = useFeedbackExport();

  const handleExport = async () => {
    const result = await exportLogs(authToken);

    if (result.success) {
      // Show success message
      alert(`✓ Export successful! Total logs: ${result.totalLogs}`);

      // Open sheet in new tab
      if (result.spreadsheetUrl) {
        window.open(result.spreadsheetUrl, '_blank');
      }

      // Callback for parent component
      if (onSuccess) {
        onSuccess(result);
      }
    } else {
      // Show error message
      alert(`✗ Export failed: ${error}`);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="export-btn"
    >
      {loading ? 'Exporting...' : '📊 Export to Google Sheets'}
    </button>
  );
}

/**
 * Example: Export History Component
 */
function ExportHistory({ authToken }) {
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const exports = await getExportHistory(authToken);
      setHistory(exports);
      setLoading(false);
    };

    if (authToken) {
      fetchHistory();
    }
  }, [authToken]);

  if (loading) {
    return <div>Loading export history...</div>;
  }

  if (history.length === 0) {
    return <div>No exports yet. Create your first export!</div>;
  }

  return (
    <div className="export-history">
      <h3>Export History</h3>
      <ul>
        {history.map((exp) => (
          <li key={exp.id} className="export-item">
            <div className="export-date">
              {new Date(exp.createdAt).toLocaleDateString()}
            </div>
            <div className="export-info">
              <span>Logs: {exp.totalLogs}</span>
              <span>Date Range: {exp.dateRange.from} to {exp.dateRange.to}</span>
            </div>
            <a
              href={exp.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="export-link"
            >
              Open Sheet →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example: Full Dashboard Component
 */
function FeedbackExportDashboard({ authToken, apiBaseUrl }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleExportSuccess = (result) => {
    console.log('Export successful:', result);
    // Refresh history, show notification, etc.
  };

  return (
    <div className="feedback-export-dashboard">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toggle-export"
      >
        {isOpen ? 'Hide' : 'Show'} Export Options
      </button>

      {isOpen && (
        <div className="export-panel">
          <ExportFeedbackButton
            authToken={authToken}
            onSuccess={handleExportSuccess}
          />

          <div className="divider"></div>

          <ExportHistory authToken={authToken} />
        </div>
      )}
    </div>
  );
}

// ============================================
// STYLING EXAMPLES
// ============================================

const exportStyles = `
.export-btn {
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.3s ease;
}

.export-btn:hover:not(:disabled) {
  background-color: #357ae8;
}

.export-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.export-btn:active {
  transform: scale(0.98);
}

.export-history {
  margin-top: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.export-history h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #333;
}

.export-history ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.export-item {
  padding: 12px;
  border-left: 4px solid #4285f4;
  background-color: white;
  margin-bottom: 10px;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-date {
  font-weight: 600;
  color: #4285f4;
  min-width: 100px;
}

.export-info {
  flex: 1;
  margin: 0 20px;
  display: flex;
  gap: 15px;
  font-size: 13px;
  color: #666;
}

.export-link {
  color: #4285f4;
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
  padding: 5px 10px;
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

.export-link:hover {
  background-color: #f0f4ff;
}

.export-panel {
  padding: 20px;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-top: 15px;
}

.divider {
  height: 1px;
  background-color: #e0e0e0;
  margin: 20px 0;
}

.toggle-export {
  padding: 8px 16px;
  background-color: transparent;
  border: 1px solid #4285f4;
  color: #4285f4;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.toggle-export:hover {
  background-color: #f0f4ff;
}

.toggle-export:active {
  background-color: #e8f0fe;
}
`;

// ============================================
// INTEGRATION IN YOUR APP
// ============================================

/*
 * 1. IN YOUR MAIN APP COMPONENT:
 *
 * import { FeedbackExportDashboard } from './services/feedbackExport.client.js';
 * 
 * function App() {
 *   const { user } = useAuth();
 *   const [authToken, setAuthToken] = React.useState(null);
 *
 *   React.useEffect(() => {
 *     if (user) {
 *       user.getIdToken().then(token => setAuthToken(token));
 *     }
 *   }, [user]);
 *
 *   return (
 *     <div>
 *       {authToken && (
 *         <FeedbackExportDashboard authToken={authToken} />
 *       )}
 *     </div>
 *   );
 * }
 *
 * 2. IN YOUR PAGE/SCREEN COMPONENT:
 *
 * import { ExportFeedbackButton } from './services/feedbackExport.client.js';
 *
 * function FeedbackLogsPage({ authToken }) {
 *   return (
 *     <div>
 *       <h1>Feedback Logs</h1>
 *       <ExportFeedbackButton authToken={authToken} />
 *     </div>
 *   );
 * }
 *
 * 3. USING THE SERVICE DIRECTLY:
 *
 * import { exportFeedbackLogs } from './services/feedbackExport.client.js';
 *
 * const handleExport = async () => {
 *   const result = await exportFeedbackLogs(authToken);
 *   if (result.success) {
 *     window.open(result.spreadsheetUrl);
 *   }
 * };
 */

export default {
  exportFeedbackLogs,
  getExportHistory,
  useFeedbackExport,
  ExportFeedbackButton,
  ExportHistory,
  FeedbackExportDashboard,
};
