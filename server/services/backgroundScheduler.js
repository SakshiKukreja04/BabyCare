const cron = require('node-cron');
const { processPendingReminders } = require('./notificationScheduler');
const { deleteOldReminders } = require('./reminders');

/**
 * Background Scheduler
 * Runs scheduled jobs for reminders and cleanup
 */

let schedulerInstance = null;

/**
 * Initialize background scheduler
 * Runs every minute to check for pending reminders
 * Runs cleanup daily at 2 AM
 */
function initializeScheduler() {
  try {
    // Main reminder checker - runs every minute
    const reminderJob = cron.schedule('* * * * *', async () => {
      try {
        console.log('⏰ [Scheduler] Checking for pending reminders...');
        const result = await processPendingReminders();
        
        if (result.total > 0) {
          console.log(`📊 [Scheduler] Processed ${result.total} reminders (${result.sent} sent, ${result.failed} failed)`);
        }
      } catch (error) {
        console.error('❌ [Scheduler] Error in reminder check:', error.message);
      }
    });

    // Cleanup old reminders - runs daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 [Scheduler] Running cleanup job...');
        const deletedCount = await deleteOldReminders(7); // Delete reminders older than 7 days
        console.log(`✅ [Scheduler] Cleanup completed, deleted ${deletedCount} old reminders`);
      } catch (error) {
        console.error('❌ [Scheduler] Error in cleanup job:', error.message);
      }
    });

    schedulerInstance = {
      reminderJob,
      cleanupJob,
    };

    console.log('✅ [Scheduler] Background scheduler initialized');
    console.log('   - Reminder checker: every 1 minute');
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
