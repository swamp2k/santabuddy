// Letters from the North Pole (letters.json). On a letter's date an envelope
// floats down from the top of the screen and lands on the taskbar. He runs
// over and asks Balder to open it; clicking it unfolds the letter. It comes
// back every start until it has been read. Read it again from the ✨ tab.
// Test: Buddy.letters.reset() then reload; or Buddy.letters.show('11-29').
(function (B) {
  const now = () => (B.today ? B.today() : new Date());
  const DAY = 86400000;
  const say = (text, ms) => B.ui.say(B.phrase(text), ms);
  const fill = (s) => String(s || '').replace(/{kid}/g, B.config.kidName).replace(/{name}/g, B.config.name);

  let letters = {};
  const READ = 'buddy.letters';
  const readList = () => { try { return JSON.parse(localStorage.getItem(READ)) || []; } catch { return []; } };
  const tag = (key) => `${now().getFullYear()}-${key}`;
  const isRead = (key) => readList().includes(tag(key));
  const markRead = (key) => { const l = readList(); if (!l.includes(tag(key))) { l.push(tag(key)); localStorage.setItem(READ, JSON.stringify(l.slice(-60))); } };

  const dateOf = (key) => { const [m, d] = key.split('-').map(Number); return new Date(now().getFullYear(), m - 1, d); };
  const today = () => { const n = now(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const keys = () => Object.keys(letters).filter((k) => /^\d\d-\d\d$/.test(k)).sort();
  /** the newest unread letter that is due (on its date or up to 6 days after) */
  function due() {
    const t = today();
    return keys().filter((k) => !isRead(k) && dateOf(k) <= t && t - dateOf(k) < 7 * DAY).pop() || null;
  }
  /** the newest letter that has arrived (for reading again) */
  const latest = () => keys().filter((k) => dateOf(k) <= today()).pop() || null;

  // ---------- look ----------
  const css = document.createElement('style');
  css.textContent = `
    #envelope { position: fixed; z-index: 0; cursor: pointer; width: 74px; height: 52px; left: 0; top: 0; display: none; }
    #envelope.show { display: block; }
    #envelope.waiting { animation: env-hop 1.8s ease-in-out infinite; }
    #envelope:hover { filter: brightness(1.06); }
    @keyframes env-hop { 0%,70%,100% { transform: translateY(0) rotate(0) } 80% { transform: translateY(-14px) rotate(-6deg) } 90% { transform: translateY(-4px) rotate(4deg) } }
    #letter { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 50; background: rgba(20, 12, 8, .28); }
    #letter.show { display: flex; animation: letter-in .45s ease-out; }
    @keyframes letter-in { from { opacity: 0 } to { opacity: 1 } }
    #letter .paper {
      position: relative; width: min(540px, 92vw); max-height: 86vh; overflow-y: auto; box-sizing: border-box;
      padding: 34px 40px 28px; color: #3a2418; border: 4px solid #3a2418; border-radius: 10px;
      background: radial-gradient(circle at 30% 20%, #fffaf0, #f6e8c9 70%, #efd9ad);
      box-shadow: 0 14px 40px rgba(0,0,0,.35);
      font-family: 'Segoe Print', 'Comic Sans MS', cursive; font-size: 16px; line-height: 1.55;
      animation: unfold .55s cubic-bezier(.2,1.4,.4,1); transform-origin: 50% 0;
    }
    @keyframes unfold { from { transform: scaleY(.15) rotate(-2deg) } to { transform: none } }
    #letter h1 { margin: 0 0 14px; font-size: 22px; color: #b3202a; text-align: center; }
    #letter p { margin: 0 0 11px; }
    #letter ul { margin: 0 0 11px; padding-left: 22px; }
    #letter li { margin: 3px 0; }
    #letter .sign { text-align: right; margin-top: 6px; font-size: 22px; color: #b3202a; transform: rotate(-3deg); }
    #letter .place { text-align: right; font-size: 13px; opacity: .75; }
    #letter .seal { position: absolute; left: 22px; bottom: 18px; width: 54px; height: 54px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #e2404a, #a31620); border: 3px solid #6e0e14; color: #ffd9d9;
      display: flex; align-items: center; justify-content: center; font-size: 24px; transform: rotate(-12deg); }
    #letter button { display: block; margin: 16px auto 0; font: 700 15px 'Segoe UI', sans-serif; color: #fff; cursor: pointer;
      background: #2e7d4a; border: 3px solid #163f24; border-radius: 20px; padding: 6px 22px; }
    #letter button:hover { background: #379257; }
  `;
  document.head.appendChild(css);

  const env = document.createElement('div');
  env.id = 'envelope';
  env.className = 'ui';
  env.title = 'A letter!';
  env.innerHTML = `<svg viewBox="0 0 74 52" width="100%" height="100%" style="overflow:visible">
    <rect x="2" y="2" width="70" height="48" rx="5" fill="#fff4dc" stroke="#3a2418" stroke-width="3.5"/>
    <path d="M4 5 L37 30 L70 5" fill="none" stroke="#3a2418" stroke-width="3" stroke-linejoin="round"/>
    <path d="M4 48 L28 25 M70 48 L46 25" stroke="#d9c39a" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="37" cy="30" r="8" fill="#c62b32" stroke="#6e0e14" stroke-width="2.5"/>
    <text x="37" y="34.5" font-size="11" text-anchor="middle" fill="#ffd9d9">❄</text>
  </svg>`;
  document.body.insertBefore(env, document.body.firstChild); // behind him

  const sheet = document.createElement('div');
  sheet.id = 'letter';
  sheet.className = 'ui';
  document.body.appendChild(sheet);

  // ---------- the letter ----------
  let showing = null, firstRead = false;
  function show(key) {
    const l = letters[key];
    if (!l) return;
    showing = key;
    firstRead = !isRead(key);
    const paper = document.createElement('div');
    paper.className = 'paper';
    const h = document.createElement('h1'); h.textContent = fill(l.title || 'A letter'); paper.appendChild(h);
    // paragraphs; "- " lines become a list (built as text, never as HTML)
    for (const block of fill(l.body).split(/\n\s*\n/)) {
      const lines = block.split('\n');
      let ul = null, p = null;
      for (const line of lines) {
        if (/^\s*- /.test(line)) {
          if (!ul) { ul = document.createElement('ul'); paper.appendChild(ul); p = null; }
          const li = document.createElement('li'); li.textContent = line.replace(/^\s*- /, ''); ul.appendChild(li);
        } else {
          if (!p) { p = document.createElement('p'); paper.appendChild(p); ul = null; } else p.appendChild(document.createElement('br'));
          p.appendChild(document.createTextNode(line));
        }
      }
    }
    if (l.sign) { const s = document.createElement('div'); s.className = 'sign'; s.textContent = fill(l.sign); paper.appendChild(s); }
    if (l.place) { const s = document.createElement('div'); s.className = 'place'; s.textContent = fill(l.place); paper.appendChild(s); }
    const seal = document.createElement('div'); seal.className = 'seal'; seal.textContent = '❄'; paper.appendChild(seal);
    const btn = document.createElement('button'); btn.textContent = firstRead ? 'Wow!' : 'Close'; btn.onclick = close; paper.appendChild(btn);
    sheet.replaceChildren(paper);
    sheet.classList.add('show');
    markRead(key);
    hideEnvelope();
  }
  function close() {
    if (!showing) return;
    sheet.classList.remove('show');
    const wasFirst = firstRead;
    showing = null;
    if (wasFirst) {
      setTimeout(() => {
        say(B.pick(['A Christmas Trainee! ME!', 'A sleigh licence?! I will practise SO hard!', 'Did you hear that, {kid}? Santa knows me!']), 3200);
        B.do('dance');
      }, 300);
    }
    setTimeout(deliver, 1500); // another letter waiting?
  }
  sheet.addEventListener('mousedown', (e) => e.stopPropagation());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); }); // click outside the paper
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // ---------- the envelope floats down ----------
  let envKey = null, fall = null;
  const envSize = () => ({ w: 74 * B.config.scale * 0.9, h: 52 * B.config.scale * 0.9 });
  function hideEnvelope() { env.classList.remove('show', 'waiting'); envKey = null; if (fall) cancelAnimationFrame(fall); fall = null; }

  function deliver() {
    const key = due();
    if (!key || envKey || showing) return;
    // wait for the candle to be lit first, and for him to be free
    const busy = ['held', 'tumble', 'dizzy', 'light-candle', 'unwrap', 'peekaboo', 'eat'];
    if ((B.advent && B.advent.due() > B.advent.lit()) || B.state.dragging || busy.includes(B.state.action?.name) || B.ui.isOpen()) {
      setTimeout(deliver, 4000);
      return;
    }
    envKey = key;
    const { w, h } = envSize();
    env.style.width = w + 'px';
    env.style.height = h + 'px';
    // land a little away from him, never on the wreath or the stocking
    const S = B.state, lo = 230 * B.config.scale, hi = B.width() - 230 * B.config.scale;
    const side = S.x < B.width() / 2 ? 1 : -1;
    const landX = B.clamp(S.x + side * B.rand(220, 360) * B.config.scale, lo, hi - w);
    const landY = B.ground() - h - 2;
    const t0 = performance.now(), T = 5200;
    env.classList.add('show');
    if (B.state.action?.name !== 'sleep') say(B.pick(['What is that up there?', 'Look! Something is falling!']), 2000);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / T);
      const e = 1 - Math.pow(1 - p, 1.6);
      const sway = Math.sin(p * Math.PI * 5) * 40 * (1 - p);
      const x = landX + sway, y = -h - 20 + (landY + h + 20) * e;
      env.style.left = x + 'px';
      env.style.top = y + 'px';
      env.style.transform = `rotate(${Math.sin(p * Math.PI * 5) * 18 * (1 - p)}deg)`;
      if (Math.random() < 0.15) B.fx.emit('sparkle', x + w / 2 + B.rand(-20, 20), y + B.rand(0, h));
      if (p < 1) { fall = requestAnimationFrame(step); return; }
      fall = null;
      env.style.left = landX + 'px';
      env.style.top = landY + 'px';
      env.style.transform = '';
      env.classList.add('waiting');
      B.fx.emit('puff', landX + w / 2, B.ground() - 4);
      B.state.mailAt = landX + w / 2;
      B.do('run', { x: B.clamp(landX + w / 2 - side * 95 * B.rig.px(), B.margin(), B.width() - B.margin()), then: 'mail' });
    };
    fall = requestAnimationFrame(step);
  }

  B.registerAction('mail', {
    random: () => (envKey && !fall ? 2 : 0),
    start(a, S) {
      say(B.pick(['A letter! With a red seal! It\'s from... SANTA?! {kid}, open it! Click it!', 'MAIL! From the North Pole! Can you open it for me, {kid}?']), 4200);
    },
    update(a, dt, S, pose) {
      if (S.mailAt != null) S.facing = S.mailAt > S.x ? 1 : -1;
      pose.bob = Math.abs(Math.sin(a.t * 7)) * 5;
      pose.expr = 'happy';
      pose.head = -4;
      return a.t > 3.5;
    },
  });

  env.addEventListener('mousedown', (e) => e.stopPropagation());
  env.addEventListener('click', () => { B.interacted(); if (envKey && !fall) show(envKey); });

  B.registerTrick({
    label: 'Santa\'s letter', icon: '📜',
    run: () => { B.ui.close(); const k = due() || latest(); if (k) show(k); else say('No letters yet! Maybe soon...', 2200); },
  });

  async function load() {
    try { letters = (await B.api.readJSON('letters.json')) || {}; } catch (err) { console.error('[letters]', err); }
  }
  const ready = load();
  B.on('ready', () => ready.then(() => setTimeout(deliver, 8000)));
  B.on('newday', () => setTimeout(deliver, 12000));

  B.letters = { show, deliver, due, reset() { localStorage.removeItem(READ); } };
})(window.Buddy);
