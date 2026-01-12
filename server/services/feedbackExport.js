/**
 * Feedback Logs Export Service
 * 
 * Handles:
 * - Fetching care logs from Firestore (careLogs collection)
 * - Aggregating data by date
 * - Formatting data for Google Sheets export
 */

const { db } = require('../firebaseAdmin');

/**
 * Fetch all care logs for a user from Firestore
 * ✓ FIXED: Now fetches from careLogs collection with correct field names
 * @param {string} uid - User UID (parentId)
 * @returns {Promise<Array>} - Array of care log documents
 */
async function fetchUserFeedbackLogs(uid) {
  try {
    // Query careLogs collection where parentId matches the authenticated user
    const careLogsRef = db.collection('careLogs');
    const snapshot = await careLogsRef
      .where('parentId', '==', uid)
      .orderBy('timestamp', 'asc')
      .get();

    if (snapshot.empty) {
      console.log(`No care logs found for user ${uid}`);
      return [];
    }

    const logs = [];
    snapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`✓ Fetched ${logs.length} care logs for parent ${uid}`);
    return logs;
  } catch (error) {
    console.error('Error fetching care logs:', error.message);
    throw new Error(`Failed to fetch care logs: ${error.message}`);
  }
}

/**
 * Group care logs by date (YYYY-MM-DD)
 * ✓ FIXED: Now handles timestamp field instead of createdAt
 * @param {Array} logs - Array of care log documents
 * @returns {Object} - Logs grouped by date
 */
function groupLogsByDate(logs) {
  const grouped = {};

  logs.forEach((log) => {
    // Get date from timestamp field (careLogs uses timestamp, not createdAt)
    const date = log.timestamp
      ? new Date(log.timestamp.toDate?.() || log.timestamp)
      : new Date();

    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!grouped[dateString]) {
      grouped[dateString] = [];
    }

    grouped[dateString].push(log);
  });

  return grouped;
}

/**
 * Aggregate data for a single day
 * ✓ FIXED: Now uses correct field names from careLogs collection
 * - quantity (not amountML) for feeding
 * - duration (in minutes, not sleepMinutes) for sleep
 * @param {Array} logs - Logs for a single day
 * @returns {Object} - Aggregated data
 */
function aggregateDayData(logs) {
  let totalFeedingML = 0;
  let totalSleepMinutes = 0;
  const medications = [];
  let latestTimestamp = null;

  logs.forEach((log) => {
    const type = log.type?.toLowerCase();

    switch (type) {
      case 'feeding':
        // Sum all feeding amounts in ML
        // ✓ FIXED: Use quantity field (not amountML)
        if (log.quantity) {
          totalFeedingML += log.quantity;
        }
        break;

      case 'sleep':
        // Sum all sleep duration in minutes
        // ✓ FIXED: Use duration field (not sleepMinutes)
        if (log.duration) {
          totalSleepMinutes += log.duration;
        }
        break;

      case 'medication':
        // Collect medications
        // Note: careLogs only stores medicationGiven (true/false), not medication name
        // For names, we'd need to fetch from prescriptions collection
        if (log.medicationGiven) {
          medications.push({
            name: 'Medication Given',
            time: log.timestamp ? new Date(log.timestamp.toDate?.() || log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Not specified',
          });
        }
        break;

      default:
        // Ignore unknown types
        break;
    }

    // Track latest timestamp
    if (log.timestamp) {
      const logTime = new Date(log.timestamp.toDate?.() || log.timestamp);
      if (!latestTimestamp || logTime > latestTimestamp) {
        latestTimestamp = logTime;
      }
    }
  });

  // Convert sleep from minutes to hours (rounded to 2 decimals)
  const totalSleepHours = totalSleepMinutes > 0 
    ? (totalSleepMinutes / 60).toFixed(2)
    : '0.00';

  // Format medications
  let medicationsText = '';
  let medicationTimesText = '';
  if (medications.length > 0) {
    medicationsText = medications.map((m) => m.name).join(', ');
    medicationTimesText = medications.map((m) => m.time).join(', ');
  }

  return {
    totalFeedingML,
    totalSleepHours,
    medicationsText,
    medicationTimesText,
    latestTimestamp,
  };
}

/**
 * Format aggregated data into rows for Google Sheets
 * @param {Object} groupedLogs - Logs grouped by date
 * @returns {Array<Array>} - Array of rows ready for Google Sheets
 */
function formatDataForSheets(groupedLogs) {
  const rows = [];

  // Sort dates in ascending order
  const sortedDates = Object.keys(groupedLogs).sort();

  sortedDates.forEach((dateString) => {
    const logs = groupedLogs[dateString];
    const aggregated = aggregateDayData(logs);

    // Parse date to get day of week
    const date = new Date(dateString + 'T00:00:00Z');
    const dayName = date.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });

    // Build row with 8 columns
    const row = [
      dateString, // A: Date (YYYY-MM-DD)
      dayName, // B: Day (e.g., Monday)
      aggregated.totalFeedingML || 0, // C: Total Feeding (ml)
      aggregated.totalSleepHours || '0.00', // D: Total Sleep Duration (hrs)
      'Care Provided', // E: Placeholder for alerts/reminders
      aggregated.medicationsText || 'None', // F: Medications Given
      aggregated.medicationTimesText || '', // G: Medication Time
      aggregated.latestTimestamp
        ? aggregated.latestTimestamp.toISOString()
        : '', // H: Timestamp
    ];

    rows.push(row);
  });

  return rows;
}

/**
 * Process feedback logs into exportable data
 * @param {string} uid - User UID
 * @returns {Promise<Object>} - Processed data with rows and metadata
 */
async function processFeedbackLogsForExport(uid) {
  try {
    // Fetch logs
    const logs = await fetchUserFeedbackLogs(uid);

    // Handle empty logs gracefully
    if (logs.length === 0) {
      console.log(`No feedback logs to export for user ${uid}`);
      return {
        rows: [],
        totalLogs: 0,
        dateRange: null,
      };
    }

    // Group by date
    const groupedLogs = groupLogsByDate(logs);

    // Format for sheets
    const rows = formatDataForSheets(groupedLogs);

    // Get date range
    const dates = Object.keys(groupedLogs).sort();
    const dateRange = {
      from: dates[0],
      to: dates[dates.length - 1],
    };

    return {
      rows,
      totalLogs: logs.length,
      dateRange,
    };
  } catch (error) {
    console.error('Error processing feedback logs:', error.message);
    throw error;
  }
}

module.exports = {
  fetchUserFeedbackLogs,
  groupLogsByDate,
  aggregateDayData,
  formatDataForSheets,
  processFeedbackLogsForExport,
};
