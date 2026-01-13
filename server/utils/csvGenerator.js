/**
 * CSV Generator Utility
 * Converts data arrays to CSV format with proper escaping
 */

/**
 * Escape CSV field value
 * Handles commas, quotes, and newlines
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of arrays to CSV string
 * @param {Array<Array>} rows - Array of row arrays
 * @param {Array<string>} headers - Optional header row
 * @returns {string} - CSV formatted string
 */
function arrayToCSV(rows, headers = null) {
  const csvRows = [];

  // Add headers if provided
  if (headers && headers.length > 0) {
    csvRows.push(headers.map(escapeCSVField).join(','));
  }

  // Add data rows
  rows.forEach((row) => {
    if (Array.isArray(row)) {
      csvRows.push(row.map(escapeCSVField).join(','));
    }
  });

  return csvRows.join('\n');
}

/**
 * Convert array of objects to CSV string
 * @param {Array<Object>} data - Array of objects
 * @param {Array<string>} headers - Optional custom headers (uses object keys if not provided)
 * @returns {string} - CSV formatted string
 */
function objectsToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    // Return headers only if provided
    if (headers && headers.length > 0) {
      return headers.map(escapeCSVField).join(',') + '\n';
    }
    return '';
  }

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);

  const csvRows = [csvHeaders.map(escapeCSVField).join(',')];

  // Convert each object to CSV row
  data.forEach((obj) => {
    const row = csvHeaders.map((header) => {
      const value = obj[header];
      return escapeCSVField(value);
    });
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

module.exports = {
  escapeCSVField,
  arrayToCSV,
  objectsToCSV,
};
