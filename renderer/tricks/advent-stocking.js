// Advent stocking: a Christmas stocking hangs in the bottom-right corner.
// Every day there's a present in it. Click it and the nisse runs over, grabs
// it, shakes it and unwraps it. Inside is that day's calendar.json entry (new
// clothes, a line, and optionally "do": "some-action"). Days without an entry
// get a random surprise instead.
(function (B) {
  B.calendar.giftMode = true; // today's outfit waits for the present
  const say = (text, ms) => B.ui.say(B.phrase(text), ms);

  const css = document.createElement('style');
  css.textContent = `
    #stocking { position: fixed; z-index: 0; cursor: pointer; transform-origin: 70% 4%; }
    #stocking svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    #stocking .gift { position: absolute; left: 14%; top: -34%; width: 64%; transition: opacity .2s; }
    #stocking:not(.full) .gift { opacity: 0; }
    #stocking.full { animation: sway 3.2s ease-in-out infinite; }
    #stocking.wiggle .gift { animation: hop .6s ease-out; }
    #stocking:hover { filter: brightness(1.08); }
    @keyframes sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
    @keyframes hop { 0%,100% { transform: none } 30% { transform: translateY(-22%) rotate(-8deg) } 60% { transform: translateY(-6%) rotate(6deg) } }
  `;
  document.head.appendChild(css);

  // a cartoon stocking in the same thick-outline style as the nisse
  const el = document.createElement('div');
  el.id = 'stocking';
  el.className = 'ui';
  el.innerHTML = `
    <img class="gift" src="art/thumbs/present.webp" alt="" draggable="false">
    <svg viewBox="0 0 80 110">
      <path d="M60 -6 q8 0 8 8" fill="none" stroke="#3a2418" stroke-width="3" stroke-linecap="round"/>
      <path d="M20 24 L62 24 L62 72 Q62 104 32 104 L16 104 Q3 104 3 91 Q3 78 17 76 L20 74 Z"
            fill="#c62b32" stroke="#3a2418" stroke-width="4" stroke-linejoin="round"/>
      <path d="M21 48 L61 48 M21 58 L61 58" stroke="#f2e6cf" stroke-width="4" stroke-dasharray="6 5"/>
      <path d="M5 90 Q8 79 19 78 L24 104 L16 104 Q5 104 5 90 Z" fill="#2e7d4a"/>
      <path d="M44 104 Q60 100 62 78 L62 96 Q58 104 44 104Z" fill="#a8222a"/>
      <rect x="14" y="4" width="54" height="24" rx="10" fill="#fff7ea" stroke="#3a2418" stroke-width="4"/>
      <path d="M22 11 h8 M38 17 h10 M54 11 h6" stroke="#e5d8c2" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  document.body.insertBefore(el, document.body.firstChild); // behind him

  const s = () => B.config.scale;
  function place() {
    const w = 64 * s(), h = 88 * s();
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = B.width() - w - 14 + 'px';
    el.style.top = B.ground() - h - 30 * s() + 'px';
  }
  const full = () => !B.calendar.gift().opened;
  function refresh() { place(); el.classList.toggle('full', full()); el.title = full() ? 'A present!' : 'Next present tomorrow'; }
  const giftPos = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.46, y: r.top }; };

  window.addEventListener('resize', place);
  B.on('ready', refresh);
  B.on('newday', refresh);
  refresh();

  // every few seconds the present hops and sparkles
  setInterval(() => {
    if (!full() || el.classList.contains('taken')) return;
    el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle');
    const p = giftPos();
    for (let i = 0; i < 4; i++) B.fx.emit('sparkle', p.x + B.rand(-20, 20), p.y + B.rand(-10, 10));
  }, 7000);

  el.addEventListener('mousedown', (e) => e.stopPropagation());
  el.addEventListener('click', () => {
    B.interacted();
    if (!full()) { say(B.pick(['Next present tomorrow!', 'Empty! Only {sleeps} sleeps to Christmas Eve.', 'I peeked. Nothing yet! 🤫']), 2400); return; }
    if (B.state.action?.name === 'unwrap') return;
    say(B.pick(['A PRESENT?!', 'For me?!', 'Ooooh!']), 1400);
    B.do('run', { x: B.width() - 64 * s() - 40, then: 'unwrap' });
  });

  // he points it out himself now and then
  B.registerAction('stocking-hint', {
    random: () => (full() ? 2 : 0),
    start() { say(B.pick(['Psst, {kid}! Something is in the stocking!', 'I think the stocking just moved...', 'Is that a present over there? 👀']), 3200); },
    update(a, dt, S, pose) {
      S.facing = giftPos().x > S.x ? 1 : -1;
      pose.head = -6; pose.bob = Math.abs(Math.sin(a.t * 6)) * 3; pose.expr = 'happy';
      return a.t > 2.2;
    },
  });

  // ---------- the unwrapping ----------
  const CONFETTI = ['#d62f3a', '#f3c64b', '#2e7d4a', '#4a6fb5', '#ffffff', '#e86fa5'];
  function burst(x, y, n = 30) {
    B.fx.emit('bang', x, y - 30);
    for (let i = 0; i < n; i++) {
      B.fx.emit('star', x, y, { chars: ['■', '●', '▲', '★', '✦'], color: B.pick(CONFETTI), vy: -B.rand(150, 420), vx: [-260, 260], life: 1.6, grav: 520 });
    }
  }
  function snowstorm(sec = 4) {
    const end = performance.now() + sec * 1000;
    const t = setInterval(() => {
      if (performance.now() > end) return clearInterval(t);
      for (let i = 0; i < 3; i++) B.fx.emit('snow', B.rand(0, B.width()), -10, { vy: B.rand(60, 140), grav: 40, life: B.rand(3, 5), size: B.rand(12, 22) });
    }, 60);
  }

  // what's in the present on days without a calendar entry
  const SURPRISES = [
    () => { snowstorm(); say('It was full of SNOW! ❄️', 2600); return 'dance'; },
    () => {
      const slot = B.pick(B.slots), items = Object.values(B.items[slot.id] || {});
      if (!items.length) return 'admire';
      const it = B.pick(items);
      B.wear(slot.id, it.id);
      say(`${it.label}! Just what I wanted!`, 2600);
      return 'admire';
    },
    () => { say(B.pick(['A tiny dance! In a box!', 'It was a joke! Hahaha!']), 2400); return 'dance'; },
    () => { say('Another box inside the box?! 📦', 2400); return 'backflip'; },
  ];

  B.registerAction('unwrap', {
    random: 0,
    start(a, S) {
      if (!full()) { a.d.skip = true; return; }
      el.classList.add('taken');
      el.classList.remove('full');
      B.rig.mount('bodyFront', 'art/present.webp', 'gift-box');
      S.facing = S.x > B.width() / 2 ? -1 : 1;
    },
    update(a, dt, S, pose) {
      if (a.d.skip) return true;
      const k = B.rig.px();
      if (a.t < 1.6) {
        const amt = Math.min(1, a.t / 1.2);
        pose.tilt = Math.sin(a.t * 32) * 5 * amt;
        pose.sx = 1 + Math.sin(a.t * 40) * 0.03 * amt;
        pose.head = Math.sin(a.t * 9) * 6;
        pose.expr = a.t < 0.8 ? 'happy' : 'surprised';
        if (!a.d.asked && a.t > 0.3) { a.d.asked = true; say(B.pick(['What could it be?', '*shake shake*', 'It rattles!']), 1300); }
        return false;
      }
      if (!a.d.opened) {
        a.d.opened = true;
        B.rig.unmount('gift-box');
        el.classList.remove('taken');
        const hand = { x: S.x - 125 * k * S.facing, y: S.y - 110 * k };
        burst(hand.x, hand.y);
        const entry = B.calendar.open();
        a.d.next = entry ? entry.do || 'admire' : B.pick(SURPRISES)();
        refresh();
      }
      pose.expr = 'laugh';
      pose.bob = Math.abs(Math.sin((a.t - 1.6) * 9)) * 8;
      if (a.t > 2.4) { B.do(B.actions[a.d.next] ? a.d.next : 'admire'); return false; }
      return false;
    },
    end() { B.rig.unmount('gift-box'); el.classList.remove('taken'); refresh(); },
  });

  // Testing: Buddy.stocking.reset() puts today's present back
  B.stocking = { reset() { localStorage.removeItem('buddy.opened'); localStorage.removeItem('buddy.said'); refresh(); }, refresh };
})(window.Buddy);
