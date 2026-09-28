/**
 * INTELLIGENT LOG FORENSIC - EVENT BUS
 * High-performance decoupled Pub/Sub architecture with BroadcastChannel support
 */

class ForensicEventBus {
  constructor() {
    this.subscribers = new Map();
    try {
      this.channel = new BroadcastChannel('ilf_forensic_bus');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type) {
          this.emitLocal(event.data.type, event.data.payload);
        }
      };
    } catch (e) {
      this.channel = null;
    }
  }

  on(eventName, callback) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    this.subscribers.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (this.subscribers.has(eventName)) {
      this.subscribers.get(eventName).delete(callback);
    }
  }

  emitLocal(eventName, payload) {
    if (this.subscribers.has(eventName)) {
      this.subscribers.get(eventName).forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventBus] Callback error on event: ${eventName}`, err);
        }
      });
    }
  }

  emit(eventName, payload, broadcast = true) {
    this.emitLocal(eventName, payload);
    if (broadcast && this.channel) {
      try {
        this.channel.postMessage({ type: eventName, payload });
      } catch (err) {
        // Fallback for non-serializable payloads
      }
    }
  }
}

// Global Singleton
window.eventBus = new ForensicEventBus();
