// December calendar: calendar.json decides what he wears each day.
// If Balder changes clothes in the wardrobe, that sticks until the next day.
// Test another date with Buddy.calendar.apply('12-13').
// If a trick sets B.calendar.giftMode = true (the advent stocking does), a new
// day's outfit + line wait until the day's present is opened: B.calendar.open().
(function (B) {
  let data = {};

  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = () => { const d = new Date(); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /** The entry in effect on `key` (MM-DD): the latest one on or before it (before it, if `strict`), in December. */
  function entryFor(key, strict = false) {
    if (!key.startsWith('12-')) return null;
    const keys = Object.keys(data).filter((k) => /^12-\d\d$/.test(k) && (strict ? k < key : k <= key)).sort();
    return keys.length ? Object.assign({ date: keys[keys.length - 1] }, data[keys[keys.length - 1]]) : null;
  }

  const opened = () => localStorage.getItem('buddy.opened') === todayKey();
  /** Today's present: { key, entry (only if something new starts today), opened } */
  function gift() {
    const key = todayKey(), e = entryFor(key);
    return { key, entry: e && e.date === key ? e : null, opened: opened() };
  }

  function apply(key = todayKey(), { force = false } = {}) {
    // present not opened yet: keep wearing the previous outfit
    const waiting = cal.giftMode && key === todayKey() && !opened() && entryFor(key)?.date === key;
    const e = waiting ? entryFor(key, true) : entryFor(key);
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
    // say today's line once a day (in gift mode: when the present is opened)
    if (!cal.giftMode && e && e.date === key) sayOnce(e, 2500);
    // roll over at midnight
    let last = key;
    setInterval(() => { const k = todayKey(); if (k !== last) { last = k; apply(k); B.emit('newday', k); } }, 60000);
  }

  function sayOnce(e, delay = 0) {
    const key = todayKey();
    if (!e || !e.say || localStorage.getItem('buddy.said') === key) return;
    localStorage.setItem('buddy.said', key);
    setTimeout(() => B.ui.say(B.phrase(e.say), 4500), delay);
  }

  /** Open today's present: wear today's outfit and say today's line. Returns the entry (or null). */
  function open() {
    localStorage.setItem('buddy.opened', todayKey());
    const g = gift();
    if (g.entry) { apply(g.key, { force: true }); sayOnce(g.entry, 900); }
    return g.entry;
  }

  // remember when the wardrobe was used by hand
  B.on('wear', () => { if (B.ui && B.ui.isOpen && B.ui.isOpen()) { B.outfitDate = todayKey(); B.save(); } });

  const cal = { load, apply, entryFor, gift, open, todayKey, giftMode: false, get data() { return data; } };
  B.calendar = cal;
})(window.Buddy);
