/**
 * Reminder Events Service
 * Handles event emissions for reminder updates
 * Allows components to react to real-time reminder changes
 */

type ReminderEventCallback = (data: any) => void;

class ReminderEventEmitter {
  private listeners: Map<string, Set<ReminderEventCallback>> = new Map();

  /**
   * Subscribe to reminder events
   * @param eventType - Type of event (e.g., 'reminder:sent', 'reminder:received')
   * @param callback - Function to call when event occurs
   * @returns Unsubscribe function
   */
  subscribe(eventType: string, callback: ReminderEventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit a reminder event
   * @param eventType - Type of event
   * @param data - Event data
   */
  emit(eventType: string, data: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ [ReminderEvents] Error in ${eventType} callback:`, error);
        }
      });
    }
  }

  /**
   * Clear all listeners for a specific event
   */
  clearListeners(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.listeners.clear();
  }
}

// Global instance
const reminderEventEmitter = new ReminderEventEmitter();

export default reminderEventEmitter;
