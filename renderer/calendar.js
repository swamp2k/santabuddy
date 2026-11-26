// December calendar: calendar.json decides what he wears each day.
// If Balder changes clothes in the wardrobe, that sticks until the next day.
// Test another date with Buddy.calendar.apply('12-13').
(function (B) {
  let data = {};

  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = () => { const d = new Date(); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /** The entry in effect on `key` (MM-DD): the latest one on or before it, in December. */
  function entryFor(key) {
    if (!key.startsWith('12-')) return null;
    const keys = Object.keys(data).filter((k) => /^12-\d\d$/.test(k) && k <= key).sort();
    return keys.length ? Object.assign({ date: keys[keys.length - 1] }, data[keys[keys.length - 1]]) : null;
  }

  function apply(key = todayKey(), { force = false } = {}) {
    const e = entryFor(key);
    if (!e) return null;
    // Balder dressed him up today? keep that.
    if (!force && B.outfitDate === key) return e;
    const outfit = {};
    for (const s of B.slots) if (e[s.id]) outfit[s.id] = e[s.id];
    B.wearAll(Object.assign({}, B.outfit, outfit));
    B.save();
    return e;
  }

  async function load() {
    try { data = (await B.api.readJSON('calendar.json')) || {}; } catch (err) { console.error('[calendar]', err); }
    const key = todayKey();
    const e = apply(key);
    // say today's line once a day
    if (e && e.say && localStorage.getItem('buddy.said') !== key) {
      localStorage.setItem('buddy.said', key);
      setTimeout(() => B.ui.say(B.phrase(e.say), 4500), 2500);
    }
    // roll over at midnight
    let last = key;
    setInterval(() => { const k = todayKey(); if (k !== last) { last = k; apply(k); } }, 60000);
  }

  // remember when the wardrobe was used by hand
  B.on('wear', () => { if (B.ui && B.ui.isOpen && B.ui.isOpen()) { B.outfitDate = todayKey(); B.save(); } });

  B.calendar = { load, apply, entryFor, get data() { return data; } };
})(window.Buddy);
