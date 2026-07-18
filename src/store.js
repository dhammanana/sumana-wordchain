/**
 * Simple reactive state store with event-based subscriptions
 */
class Store {
  constructor(initialState = {}) {
    this._state = { ...initialState };
    this._listeners = {};
    this._globalListeners = [];
  }

  get(key) {
    return this._state[key];
  }

  getAll() {
    return { ...this._state };
  }

  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    this._notify(key, value, oldValue);
    this._notifyGlobal(key, value, oldValue);
  }

  update(partialState) {
    for (const [key, value] of Object.entries(partialState)) {
      this.set(key, value);
    }
  }

  on(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(callback);
    return () => {
      this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
    };
  }

  onAny(callback) {
    this._globalListeners.push(callback);
    return () => {
      this._globalListeners = this._globalListeners.filter(cb => cb !== callback);
    };
  }

  _notify(key, value, oldValue) {
    (this._listeners[key] || []).forEach(cb => {
      try { cb(value, oldValue); } catch (e) { console.warn('Store listener error:', e); }
    });
  }

  _notifyGlobal(key, value, oldValue) {
    this._globalListeners.forEach(cb => {
      try { cb(key, value, oldValue); } catch (e) { console.warn('Store global listener error:', e); }
    });
  }
}

// Global store instance
export const store = new Store({
  user: null,
  profile: null,
  currentGroup: null,
  currentView: '/',
  isOnline: navigator.onLine,
  connectionStatus: 'disconnected',
});

// Track online status
window.addEventListener('online', () => store.set('isOnline', true));
window.addEventListener('offline', () => store.set('isOnline', false));

export default store;
