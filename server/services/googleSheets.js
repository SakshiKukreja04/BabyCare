/**
 * Google Sheets Service
 * 
 * Handles integration with Google Sheets API v4 using Service Account
 * - Sheet creation
 * - Data writing
 * - Sheet sharing
 */

const { google } = require('googleapis');
const path = require('path');

// Initialize Google Sheets API client with service account
let sheetsClient = null;
let authClient = null;

/**
 * Initialize Google Sheets API client with service account credentials
 * Uses GOOGLE_SERVICE_ACCOUNT_KEY environment variable (path to JSON key file)
 */
function initializeGoogleSheetsClient() {
  try {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!keyPath) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set. ' +
        'Please provide path to Google Service Account JSON key file.'
      );
    }

    const resolvedKeyPath = path.resolve(keyPath);
    
    // Verify the file exists
    const fs = require('fs');
    if (!fs.existsSync(resolvedKeyPath)) {
      throw new Error(`Service account key file not found: ${resolvedKeyPath}`);
    }

    const keyFile = require(resolvedKeyPath);

    authClient = new google.auth.GoogleAuth({
      keyFile: resolvedKeyPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    
    // Log service account email for reference
    try {
      console.log(`✓ Google Sheets API client initialized`);
      console.log(`  Service Account: ${keyFile.client_email}`);
      console.log(`  Project ID: ${keyFile.project_id}`);
    } catch (e) {
      console.log('✓ Google Sheets API client initialized');
    }
    
    return { sheetsClient, authClient };
  } catch (error) {
    console.error('Failed to initialize Google Sheets client:', error.message);
    throw error;
  }
}

/**
 * Get or initialize the Sheets client and Auth client
 */
function getClient() {
  if (!sheetsClient || !authClient) {
    initializeGoogleSheetsClient();
  }
  return sheetsClient;
}

/**
 * Get authenticated client (for use with Drive API and other services)
 */
function getAuthClient() {
  if (!authClient) {
    initializeGoogleSheetsClient();
  }
  return authClient;
}

/**
 * Create a new Google Sheet with given title using Drive API
 * This creates the sheet INSIDE the shared folder, avoiding permission issues
 * For Google users, creates without folder (will be transferred to their Drive)
 * @param {string} title - Title for the new sheet
 * @param {boolean} isGoogleUser - Whether user signed up with Google (creates without folder)
 * @returns {Promise<string>} - Spreadsheet ID
 */
async function createSpreadsheet(title, isGoogleUser = false) {
  try {
    console.log(`[Drive API] Creating spreadsheet: "${title}"`);
    console.log(`[Drive API] Is Google user: ${isGoogleUser}`);
    
    // Ensure auth client is initialized
    const auth = getAuthClient();
    console.log(`[Drive API] Using authenticated service account`);
    
    // Initialize Drive client with authenticated client
    const driveClient = google.drive({ version: 'v3', auth: auth });
    
    // For Google users, create without folder (will be in their Drive after transfer)
    // For non-Google users, use the shared folder
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    };
    
    if (!isGoogleUser) {
      // Get folder ID from environment for non-Google users
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in .env');
      }
      fileMetadata.parents = [folderId];
      console.log(`[Drive API] Using folder ID: ${folderId}`);
    } else {
      console.log(`[Drive API] Creating without folder (will be transferred to user's Drive)`);
    }
    
    console.log(`[Drive API] Creating file with metadata:`, JSON.stringify(fileMetadata));
    
    const response = await driveClient.files.create({
      resource: fileMetadata,
      fields: 'id, name, webViewLink',
    });
    
    const spreadsheetId = response.data.id;
    const spreadsheetUrl = response.data.webViewLink;
    
    console.log(`✓ [Drive API] Spreadsheet created successfully`);
    console.log(`  ID: ${spreadsheetId}`);
    console.log(`  URL: ${spreadsheetUrl}`);
    
    return spreadsheetId;
  } catch (error) {
    console.error(`❌ [Drive API] Error creating spreadsheet:`, error.message);
    
    // Provide helpful error message for common issues
    if (error.message.includes('Folder not found')) {
      console.error('\n💡 Folder ID is invalid or deleted');
      console.error('   Check GOOGLE_DRIVE_FOLDER_ID in .env');
    } else if (error.message.includes('permission') || error.message.includes('Permission') || 
               error.message.includes('Caller') || error.message.includes('notFound')) {
      try {
        const serviceAccountData = require(path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY));
        const serviceEmail = serviceAccountData.client_email;
        
        console.error('\n❌ Permission Denied - Service Account Cannot Create Sheets');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('\n📧 Service Account: ' + serviceEmail);
        console.error('\n✅ SOLUTION:');
        console.error('\n1. Go to: https://drive.google.com/');
        console.error('\n2. Open the folder with ID: ' + process.env.GOOGLE_DRIVE_FOLDER_ID);
        console.error('\n3. Right-click folder → Share');
        console.error('\n4. Paste: ' + serviceEmail);
        console.error('\n5. Select: Editor role');
        console.error('\n6. Click: Share');
        console.error('\n7. Restart server: npm start');
      } catch (e) {
        console.error('Could not read service account details');
      }
    }
    
    throw new Error(`Failed to create Google Sheet via Drive API: ${error.message}`);
  }
}

/**
 * Write header row to sheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {number} sheetId - ID of the sheet (default 0)
 */
async function writeHeaders(spreadsheetId, sheetId = 0) {
  try {
    const client = getClient();

    const headers = [
      'Date',
      'Day',
      'Total Feeding (ml)',
      'Total Sleep Duration (hrs)',
      'Alerts & Reminders',
      'Medications Given',
      'Medication Time',
      'Timestamp',
    ];

    await client.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Feedback Logs!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    console.log(`✓ Headers written to spreadsheet ${spreadsheetId}`);
  } catch (error) {
    console.error('Error writing headers:', error.message);
    throw new Error(`Failed to write headers: ${error.message}`);
  }
}

/**
 * Write data rows to sheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {Array<Array>} rows - Data rows to write
 * @param {number} startRow - Starting row number (default 2 for row after headers)
 */
async function writeData(spreadsheetId, rows, startRow = 2) {
  try {
    if (!rows || rows.length === 0) {
      console.log('No data to write');
      return;
    }

    const client = getClient();

    const range = `Feedback Logs!A${startRow}:H${startRow + rows.length - 1}`;

    await client.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`✓ ${rows.length} rows written to spreadsheet`);
  } catch (error) {
    console.error('Error writing data:', error.message);
    throw new Error(`Failed to write data: ${error.message}`);
  }
}

/**
 * Format header row (bold, background color)
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {number} sheetId - ID of the sheet (default 0)
 */
async function formatHeaders(spreadsheetId, sheetId = 0) {
  try {
    const client = getClient();

    await client.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 8,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.2,
                    blue: 0.2,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1,
                    },
                    bold: true,
                    fontSize: 12,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });

    console.log(`✓ Headers formatted`);
  } catch (error) {
    console.error('Error formatting headers:', error.message);
    // Non-critical error, don't throw
  }
}

/**
 * Transfer spreadsheet ownership from service account to user
 * This moves the spreadsheet to the user's Drive and uses their quota
 * 
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {string} userEmail - User's email to transfer ownership to
 * @returns {Promise<void>}
 */
async function transferOwnership(spreadsheetId, userEmail) {
  try {
    if (!spreadsheetId || !userEmail) {
      console.warn('[Ownership Transfer] Missing spreadsheet ID or user email, skipping');
      return;
    }

    console.log(`[Ownership Transfer] Transferring ownership to: ${userEmail}`);

    const auth = getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // Grant the user "owner" role with ownership transfer
    const response = await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: userEmail,
      },
      transferOwnership: true,
      fields: 'id, emailAddress, role',
    });

    console.log(`✓ [Ownership Transfer] Successfully transferred ownership`);
    console.log(`  File ID: ${spreadsheetId}`);
    console.log(`  Owner Email: ${userEmail}`);
    console.log(`  Permission ID: ${response.data.id}`);
    
    // Now the spreadsheet lives in user's Drive and uses their quota
    // Service account retains editor access automatically from creation
  } catch (error) {
    console.error(`❌ [Ownership Transfer] Error transferring ownership:`, error.message);

    // Provide helpful error messages
    if (error.message.includes('Invalid Credentials')) {
      console.error('  → Service account authentication failed');
      console.error('  → Check GOOGLE_SERVICE_ACCOUNT_KEY in .env');
    } else if (error.message.includes('Invalid email')) {
      console.error(`  → Invalid email address: ${userEmail}`);
      console.error('  → Check user email from Firebase token');
    } else if (error.message.includes('notFound')) {
      console.error('  → Spreadsheet not found (may have been deleted)');
      console.error(`  → Check spreadsheet ID: ${spreadsheetId}`);
    } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
      console.error('  → Permission denied transferring ownership');
      console.error('  → Verify service account has Drive API access');
    }

    throw new Error(`Failed to transfer spreadsheet ownership: ${error.message}`);
  }
}

/**
 * Share spreadsheet with a user
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {string} email - Email to share with
 * @param {string} role - Role to grant: 'reader', 'writer', or 'owner' (default: 'reader')
 * @returns {Promise<void>}
 */
async function shareSpreadsheet(spreadsheetId, email, role = 'reader') {
  try {
    if (!email) {
      console.warn('No email provided for sharing, skipping share step');
      return;
    }

    const auth = getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: role,
        type: 'user',
        emailAddress: email,
      },
      fields: 'id',
    });

    console.log(`✓ Spreadsheet shared with ${email} as ${role}`);
  } catch (error) {
    console.error('Error sharing spreadsheet:', error.message);
    // Non-critical error, continue without throwing
    console.warn('Warning: Could not share sheet with user, but export was successful');
  }
}

/**
 * Get spreadsheet URL
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @returns {string} - Full URL to spreadsheet
 */
function getSpreadsheetUrl(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

module.exports = {
  initializeGoogleSheetsClient,
  getClient,
  getAuthClient,
  createSpreadsheet,
  writeHeaders,
  writeData,
  formatHeaders,
  transferOwnership,
  shareSpreadsheet,
  getSpreadsheetUrl,
};
