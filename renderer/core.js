// The Buddy namespace. Everything hangs off window.Buddy so new tricks can
// plug in from their own files in renderer/tricks/ without touching the rest.
// Uncaught errors (e.g. from a trick file) go to the log with a stack trace.
window.addEventListener('error', (e) => console.error('[buddy] uncaught:', (e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[buddy] unhandled promise:', (e.reason && e.reason.stack) || e.reason));

window.Buddy = (() => {
  const stub = {
    setClickable() {},
    setName() {},
    quit() { console.log('[buddy] quit'); },
    listTricks: async () => [],
    readJSON: (name) => fetch(name).then((r) => r.json()),
    onCommand() {},
  };

  const listeners = {};
  const saved = JSON.parse(localStorage.getItem('buddy.settings') || '{}');

  const B = {
    api: window.api || stub,
    inElectron: !!window.api,

    config: Object.assign(
      {
        name: 'Nisse',      // the buddy's name, Balder can rename him in the wardrobe
        kidName: 'Balder',  // who he talks to
        scale: 1.2,         // size on screen
        chatty: 1,          // 0 = quiet, 1 = normal, 2 = blabbermouth
      },
      saved.config || {}
    ),

    actions: {},  // name -> { random, start, update, end, onLand, onClick }
    items: {},    // slot -> { id -> item }
    slots: [],    // ordered list of wardrobe slots { id, label }
    outfit: Object.assign({}, saved.outfit || {}),
    outfitDate: saved.outfitDate || null, // day Balder last dressed him by hand
    tricks: [],   // buttons shown in the Tricks tab { id, label, icon, run }

    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    emit(evt, ...args) { (listeners[evt] || []).forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } }); },

    save() {
      localStorage.setItem('buddy.settings', JSON.stringify({ config: B.config, outfit: B.outfit, outfitDate: B.outfitDate }));
    },

    /** Register something he can do. See README for the shape. */
    registerAction(name, def) { B.actions[name] = Object.assign({ name }, def); },

    /** Register a wardrobe slot (tab). */
    registerSlot(id, label, opts = {}) {
      if (!B.slots.find((s) => s.id === id)) B.slots.push(Object.assign({ id, label }, opts));
      B.items[id] = B.items[id] || {};
    },

    /** Register a piece of clothing / accessory. */
    registerItem(slot, id, def) {
      B.registerSlot(slot, slot);
      B.items[slot][id] = Object.assign({ id, slot }, def);
    },

    /** Register a button in the Tricks tab. */
    registerTrick(def) { B.tricks.push(def); },

    rand: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };
  return B;
})();
