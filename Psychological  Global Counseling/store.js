// store.js – simple Pub/Sub state management for VANBRANSA app

export const Store = (function () {
  // private state copy
  let state = {};
  const listeners = [];

  // initialize with the original STATE object from app.js (will be imported later)
  function init(initialState) {
    state = { ...initialState };
    // expose state as read‑only proxy
    return getState();
  }

  function getState() {
    return new Proxy(state, {
      get(target, prop) {
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        // notify listeners
        listeners.forEach((fn) => fn(state));
        return true;
      }
    });
  }

  function set(key, value) {
    state[key] = value;
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) {
    listeners.push(fn);
    // return unsubscribe
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  return {
    init,
    getState,
    set,
    subscribe
  };
})();
