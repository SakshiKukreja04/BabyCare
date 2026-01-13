const cron = require('node-cron');
const { processPendingReminders } = require('./notificationScheduler');
const { deleteOldReminders } = require('./reminders');

/**
 * Background Scheduler
 * Runs scheduled jobs for reminders and cleanup
 * 
 * OPTIMIZED:
 * - Single log per scheduler cycle
 * - Defensive error handling for quota errors
 * - Configurable batch sizes
 */

let schedulerInstance = null;
let cycleCount = 0;

// Configuration
const REMINDER_BATCH_SIZE = 20; // Process max 20 reminders per cycle
const CLEANUP_DAYS = 7; // Delete reminders older than 7 days
const CLEANUP_BATCH_SIZE = 50; // Delete max 50 per cleanup run

/**
 * Initialize background scheduler
 * Runs every minute to check for pending reminders
 * Runs cleanup daily at 2 AM
 */
function initializeScheduler() {
  try {
    // Main reminder checker - runs every minute
    const reminderJob = cron.schedule('* * * * *', async () => {
      cycleCount++;
      const cycleStart = Date.now();
      
      try {
        const result = await processPendingReminders(REMINDER_BATCH_SIZE);
        
        // Single log per cycle with summary
        if (result.total > 0) {
          console.log(`📊 [Scheduler] Cycle #${cycleCount}: Processed ${result.total} reminders (${result.sent} sent, ${result.failed} failed) in ${Date.now() - cycleStart}ms`);
        }
        // Skip logging when no reminders to reduce noise
      } catch (error) {
        // Handle Firestore quota errors (code 8) gracefully
        if (error.code === 8) {
          console.warn(`⚠️ [Scheduler] Cycle #${cycleCount}: Firestore quota exceeded, skipping cycle`);
          return;
        }
        console.error(`❌ [Scheduler] Cycle #${cycleCount}: Error in reminder check:`, error.message);
      }
    });

    // Cleanup old reminders - runs daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 [Scheduler] Running cleanup job...');
        let totalDeleted = 0;
        let batchDeleted = 0;
        
        // Delete in batches to avoid quota issues
        do {
          batchDeleted = await deleteOldReminders(CLEANUP_DAYS);
          totalDeleted += batchDeleted;
          
          // Small delay between batches
          if (batchDeleted > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } while (batchDeleted >= CLEANUP_BATCH_SIZE);
        
        console.log(`✅ [Scheduler] Cleanup completed, deleted ${totalDeleted} old reminders`);
      } catch (error) {
        if (error.code === 8) {
          console.warn('⚠️ [Scheduler] Cleanup skipped: Firestore quota exceeded');
          return;
        }
        console.error('❌ [Scheduler] Error in cleanup job:', error.message);
      }
    });

    schedulerInstance = {
      reminderJob,
      cleanupJob,
    };

    console.log('✅ [Scheduler] Background scheduler initialized');
    console.log('   - Reminder checker: every 1 minute (batch size: ' + REMINDER_BATCH_SIZE + ')');
    console.log('   - Cleanup job: daily at 2:00 AM');

    return schedulerInstance;
  } catch (error) {
    console.error('❌ [Scheduler] Error initializing scheduler:', error.message);
    throw error;
  }
}

/**
 * Stop background scheduler
 */
function stopScheduler() {
  try {
    if (schedulerInstance) {
      schedulerInstance.reminderJob.stop();
      schedulerInstance.cleanupJob.stop();
      schedulerInstance = null;
      console.log('✅ [Scheduler] Background scheduler stopped');
    }
  } catch (error) {
    console.error('❌ [Scheduler] Error stopping scheduler:', error.message);
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  if (!schedulerInstance) {
    return { status: 'not initialized' };
  }

  return {
    status: 'running',
    cycleCount,
    config: {
      reminderBatchSize: REMINDER_BATCH_SIZE,
      cleanupDays: CLEANUP_DAYS,
    },
    reminderJob: {
      status: schedulerInstance.reminderJob._task?.running ? 'running' : 'stopped',
      pattern: '* * * * * (every minute)',
    },
    cleanupJob: {
      status: schedulerInstance.cleanupJob._task?.running ? 'running' : 'stopped',
      pattern: '0 2 * * * (daily at 2 AM)',
    },
  };
}

module.exports = {
  initializeScheduler,
  stopScheduler,
  getSchedulerStatus,
};
