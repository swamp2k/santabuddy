// Advent wreath: sits in the bottom-left corner from the 1st Advent Sunday.
// One more candle every Advent Sunday. On the day a new candle is due, the
// nisse walks over and lights it himself. Lit candles burn a little shorter
// every day, like a real wreath.
// Test another day: Buddy.today = () => new Date(2026, 11, 6); Buddy.advent.refresh()
(function (B) {
  const now = () => (B.today ? B.today() : new Date());
  const DAY = 86400000;
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /** The four Advent Sundays of the Christmas that is coming (or just passed). */
  function sundays(d = now()) {
    const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const xmas = new Date(y, 11, 25);
    const fourth = new Date(y, 11, 25 - (xmas.getDay() || 7)); // last Sunday before the 25th
    return [3, 2, 1, 0].map((w) => new Date(fourth - w * 7 * DAY));
  }
  /** How many candles should be burning today (0 before Advent). */
  function due(d = now()) { return sundays(d).filter((s) => s <= midnight(d)).length; }
  const inSeason = (d = now()) => { const s = sundays(d); return midnight(d) >= s[0] && midnight(d) <= new Date(s[0].getFullYear(), 11, 31); };

  // candles he has lit himself (so a new one waits for him)
  const KEY = 'buddy.candles';
  const litKey = () => `${sundays()[0].getFullYear()}`;
  function litCount() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.y === litKey() ? v.n : 0; } catch { return 0; } }
  function setLit(n) { localStorage.setItem(KEY, JSON.stringify({ y: litKey(), n })); }

  const say = (text, ms) => B.ui.say(B.phrase(text), ms);

  const css = document.createElement('style');
  css.textContent = `
    #wreath { position: fixed; z-index: 0; cursor: pointer; display: none; }
    #wreath.season { display: block; }
    #wreath:hover { filter: brightness(1.08); }
    #wreath svg { width: 100%; height: 100%; overflow: visible; }
    #wreath .flame { transform-box: fill-box; transform-origin: 50% 100%; opacity: 0; transition: opacity .4s; }
    #wreath .lit .flame { opacity: 1; animation: flicker 1.1s ease-in-out infinite alternate; }
    #wreath .glow { opacity: 0; transition: opacity .6s; }
    #wreath .lit .glow { opacity: .55; animation: glow 2.3s ease-in-out infinite alternate; }
    @keyframes flicker { 0% { transform: scale(1, 1) rotate(-2deg) } 40% { transform: scale(.92, 1.08) rotate(2deg) } 100% { transform: scale(1.04, .94) rotate(-1deg) } }
    @keyframes glow { from { opacity: .4 } to { opacity: .65 } }
  `;
  document.head.appendChild(css);

  const el = document.createElement('div');
  el.id = 'wreath';
  el.className = 'ui';
  document.body.insertBefore(el, document.body.firstChild); // behind him

  // candle x positions (viewBox 160 x 120) and how far back they stand
  const CANDLES = [{ x: 30, y: 92 }, { x: 64, y: 84 }, { x: 98, y: 84 }, { x: 132, y: 92 }];
  const TALL = 46;

  // a lit candle loses a bit every day since its Sunday
  const shown = () => Math.min(due(), litCount());
  const height = (i) => (i < shown() ? Math.max(12, TALL - Math.max(0, (midnight(now()) - sundays()[i]) / DAY) * 1.1) : TALL);

  function draw() {
    const shownN = shown();
    const candles = CANDLES.map((c, i) => {
      const h = height(i);
      const top = c.y - h;
      return `<g class="candle${i < shownN ? ' lit' : ''}" data-i="${i}">
        <circle class="glow" cx="${c.x}" cy="${top - 9}" r="15" fill="url(#wr-glow)"/>
        <rect x="${c.x - 7}" y="${top}" width="14" height="${h}" rx="3" fill="#c62b32" stroke="#3a2418" stroke-width="3"/>
        <path d="M${c.x - 4} ${top + 5} v${Math.max(4, h - 10)}" stroke="#e8606a" stroke-width="3" stroke-linecap="round"/>
        <path d="M${c.x} ${top} v-6" stroke="#3a2418" stroke-width="2" stroke-linecap="round"/>
        <path class="flame" d="M${c.x} ${top - 21} C${c.x + 7} ${top - 12} ${c.x + 6} ${top - 5} ${c.x} ${top - 4} C${c.x - 6} ${top - 5} ${c.x - 7} ${top - 12} ${c.x} ${top - 21} Z" fill="url(#wr-flame)" stroke="#d9761f" stroke-width="1.2"/>
      </g>`;
    }).join('');
    // the ring: back half, candles, front half (so the front branches hide the candle feet)
    const sprigs = (from, to, y0) => Array.from({ length: 12 }, (_, i) => {
      const a = from + (to - from) * (i / 11);
      const x = 80 + Math.cos(a) * 66, y = y0 + Math.sin(a) * 15;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="7" transform="rotate(${(Math.cos(a) * 30).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? '#2e7d4a' : '#246b3c'}" stroke="#163f24" stroke-width="2"/>`;
    }).join('');
    const berries = [[22, 104], [52, 110], [80, 112], [110, 110], [140, 104], [46, 92], [116, 92]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#d62f3a" stroke="#3a2418" stroke-width="1.5"/>`).join('');
    el.innerHTML = `<svg viewBox="0 0 160 120">
      <defs>
        <radialGradient id="wr-flame" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#f08a24"/></radialGradient>
        <radialGradient id="wr-glow"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="80" cy="100" rx="74" ry="20" fill="#1d5530" stroke="#163f24" stroke-width="3"/>
      ${sprigs(Math.PI, Math.PI * 2, 100)}
      ${candles}
      ${sprigs(0, Math.PI, 100)}
      ${berries}
      <path d="M72 108 l-14 10 l4 -12 Z M88 108 l14 10 l-4 -12 Z" fill="#b3202a" stroke="#3a2418" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="80" cy="107" r="5" fill="#d62f3a" stroke="#3a2418" stroke-width="2"/>
    </svg>`;
  }

  const sc = () => B.config.scale;
  function place() {
    const w = 180 * sc(), h = 135 * sc();
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = '14px';
    el.style.top = B.ground() - h - 4 * sc() + 'px';
  }
  function refresh() { el.classList.toggle('season', inSeason()); place(); draw(); }
  const pending = () => inSeason() && due() > litCount();
  /** where candle i's wick is on screen */
  function wick(i) {
    const r = el.getBoundingClientRect(), k = r.width / 160;
    const c = CANDLES[i];
    const top = c.y - height(i);
    return { x: r.left + c.x * k, y: r.top + (top - 8) * k };
  }

  window.addEventListener('resize', place);
  B.on('newday', () => { refresh(); setTimeout(tryLight, 4000); });
  refresh();

  // ---------- he lights the new candle ----------
  const LINES = [
    'The first candle! Advent has begun! 🕯️',
    'Two candles! Christmas is getting closer!',
    'Three candles! Can you feel it, {kid}?',
    'ALL FOUR candles! Christmas is almost here!',
  ];
  const standX = () => el.getBoundingClientRect().right + 115 * B.rig.px();

  function tryLight() {
    if (!pending() || B.ui.isOpen()) return false;
    const busy = ['held', 'tumble', 'dizzy', 'sleep', 'unwrap', 'light-candle', 'peekaboo', 'eat'];
    if (B.state.dragging || busy.includes(B.state.action?.name)) return false;
    say(B.pick(['Oh! It\'s Advent Sunday!', 'Wait! Today is a candle day!']), 1600);
    B.do('run', { x: standX(), then: 'light-candle' });
    return true;
  }

  B.registerAction('light-candle', {
    random: 0,
    start(a, S) {
      a.d.i = litCount();
      if (!pending()) { a.d.skip = true; return; }
      S.facing = -1;
    },
    update(a, dt, S, pose) {
      if (a.d.skip) return true;
      S.facing = -1;
      // lean in and reach
      const reach = Math.min(1, a.t / 0.8);
      pose.tilt = -8 * reach;
      pose.head = 6 * reach;
      pose.expr = a.t < 1.6 ? 'normal' : 'happy';
      if (!a.d.struck && a.t > 0.9) {
        a.d.struck = true;
        const w = wick(a.d.i);
        B.fx.emit('puff', w.x, w.y);
        for (let i = 0; i < 6; i++) B.fx.emit('sparkle', w.x + B.rand(-8, 8), w.y + B.rand(-6, 4));
      }
      if (!a.d.lit && a.t > 1.3) {
        a.d.lit = true;
        setLit(a.d.i + 1);
        draw();
        say(LINES[a.d.i] || LINES[3], 3400);
        B.emit('candle', a.d.i + 1);
      }
      if (a.t > 1.3) { pose.tilt = -8 * Math.max(0, 1 - (a.t - 1.3) * 2); pose.bob = Math.abs(Math.sin(a.t * 8)) * 4; }
      if (a.d.lit && due() > litCount()) { a.d.i = litCount(); a.d.struck = a.d.lit = false; a.t = 0.5; return false; } // PC was off: catch up
      if (a.t > 3) {
        if (a.d.i === 0 && Math.random() < 0.7) setTimeout(() => say('(Real candles: only with a grown-up! 🕯️)', 2600), 3600);
        B.do('admire');
        return false;
      }
      return false;
    },
  });

  // check soon after he arrives on screen, and again now and then (in case he was busy)
  B.on('ready', () => setTimeout(tryLight, 5000));
  setInterval(() => { if (pending()) tryLight(); }, 45000);

  el.addEventListener('mousedown', (e) => e.stopPropagation());
  el.addEventListener('click', () => {
    B.interacted();
    if (pending()) { if (!tryLight()) say('Hold on, I need to light the candle!', 2000); return; }
    const n = litCount(), s = sundays(), next = s[n];
    if (n < 4 && next) {
      const sleeps = Math.round((next - midnight(now())) / DAY);
      say(`${n} candle${n === 1 ? '' : 's'} burning. The next one in ${sleeps} sleep${sleeps === 1 ? '' : 's'}!`, 2800);
    } else {
      say(B.pick(['All four candles! {sleeps} sleeps to Christmas Eve!', 'Pretty, isn\'t it, {kid}?', 'Shhh... listen to the candles. 🕯️']), 2600);
    }
  });

  B.advent = { sundays, due, lit: litCount, refresh, reset() { localStorage.removeItem(KEY); refresh(); } };
})(window.Buddy);
