// Speech bubble + the wardrobe panel (right-click him to open it).
(function (B) {
  let bubble, bubbleText, bubbleUntil = 0, panel, tab = 'hat';

  function init() {
    bubble = document.getElementById('bubble');
    bubbleText = bubble.querySelector('span');
    panel = document.getElementById('panel');
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    new ResizeObserver(() => placePanel()).observe(panel);
    window.addEventListener('resize', () => placePanel());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function say(text, ms = 2500) {
    if (!text) return;
    bubbleText.textContent = text;
    bubble.classList.add('show');
    bubbleUntil = performance.now() + ms;
    B.emit('say', text);
  }

  const talking = () => performance.now() < bubbleUntil - 400;

  function follow() {
    const S = B.state;
    if (bubble.classList.contains('show')) {
      if (performance.now() > bubbleUntil) bubble.classList.remove('show');
      const top = B.topPos();
      const w = bubble.offsetWidth;
      const x = B.clamp(top.x, w / 2 + 8, window.innerWidth - w / 2 - 8);
      const y = Math.max(bubble.offsetHeight + 8, top.y);
      bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      bubble.style.setProperty('--tail', `${B.clamp(top.x - x + w / 2, 18, w - 18)}px`);
    }
  }
  const isOpen = () => panel.classList.contains('show');

  // ---------- wardrobe ----------
  // The panel hangs next to him with its bottom edge fixed, and re-fits whenever
  // its size changes (tab switch), so it never runs off the screen.
  let anchor = null;
  function placePanel() {
    if (!isOpen()) return;
    const W = window.innerWidth, H = window.innerHeight;
    panel.style.maxHeight = `${H - 16}px`;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    if (!anchor) {
      const S = B.state, k = B.rig.px();
      const right = S.x + 150 * k + pw <= W - 8;
      anchor = { x: right ? S.x + 150 * k : S.x - 150 * k - pw, bottom: S.y - 10 };
    }
    const x = B.clamp(anchor.x, 8, Math.max(8, W - pw - 8));
    const y = B.clamp(anchor.bottom - ph, 8, Math.max(8, H - ph - 8));
    panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function open() {
    const a = B.state.action;
    if (a && ['walk', 'run', 'dance', 'sit', 'sleep'].includes(a.name)) B.do('idle', { dur: 1 });
    anchor = null;
    panel.classList.add('show');
    render();
  }
  function close() {
    panel.classList.remove('show');
    B.state.overUI = false;
  }
  function toggleWardrobe() { panel.classList.contains('show') ? close() : open(); }

  let admireTimer = 0;
  function render() {
    const tabs = [...B.slots.map((s) => ({ id: s.id, icon: s.icon || '•', label: s.label })),
      { id: 'tricks', icon: '✨', label: 'Tricks' }, { id: 'me', icon: '⚙️', label: 'Settings' }];
    const tabHtml = tabs.map((t) => `<button class="tab ${t.id === tab ? 'on' : ''}" data-tab="${t.id}" title="${t.label}">${t.icon}</button>`).join('');

    let body = '';
    if (tab === 'tricks') {
      const builtIn = [
        ['wave', '👋', 'Wave'], ['jump', '⬆️', 'Jump'], ['backflip', '🤸', 'Backflip'], ['dance', '💃', 'Dance'],
        ['run', '🏃', 'Run'], ['sit', '🪑', 'Sit'], ['sleep', '😴', 'Sleep'], ['say', '💬', 'Talk'],
      ];
      body = builtIn.map(([id, icon, label]) => `<button class="item" data-do="${id}"><b>${icon}</b>${label}</button>`).join('')
        + B.tricks.map((t, i) => `<button class="item new" data-trick="${i}"><b>${t.icon || '🎁'}</b>${t.label}</button>`).join('');
    } else if (tab === 'me') {
      body = `
        <label>Name <input id="opt-name" maxlength="16" value="${B.config.name.replace(/"/g, '&quot;')}"></label>
        <label>Size <input id="opt-scale" type="range" min="0.5" max="2" step="0.05" value="${B.config.scale}"></label>
        <label>Chatty <input id="opt-chatty" type="range" min="0" max="2" step="0.5" value="${B.config.chatty}"></label>
        <button class="item wide" data-random="1"><b>🎲</b>Surprise outfit!</button>
        <button class="item wide quit" data-quit="1"><b>👋</b>Bye for now (quit)</button>`;
    } else {
      const items = Object.values(B.items[tab] || {});
      body = items.map((it) => `<button class="item ${B.outfit[tab] === it.id ? 'on' : ''}" data-wear="${it.id}"><b>${it.thumb ? `<img src="${it.thumb}" alt="">` : it.icon || '•'}</b>${it.label}</button>`).join('');
    }
    const title = tabs.find((t) => t.id === tab)?.label || '';
    panel.innerHTML = `<div class="head"><span>${B.config.name}'s ${title.toLowerCase()}</span><button class="x" title="Close">✕</button></div>
      <div class="tabs">${tabHtml}</div><div class="grid">${body}</div>`;
    placePanel();

    panel.querySelector('.x').onclick = close;
    panel.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
    panel.querySelectorAll('[data-wear]').forEach((b) => (b.onclick = () => {
      B.wear(tab, b.dataset.wear);
      B.interacted();
      render();
      clearTimeout(admireTimer);
      admireTimer = setTimeout(() => { if (!B.state.airborne && !B.state.dragging) B.do('admire'); }, 250);
    }));
    panel.querySelectorAll('[data-do]').forEach((b) => (b.onclick = () => { B.interacted(); B.do(b.dataset.do); }));
    panel.querySelectorAll('[data-trick]').forEach((b) => (b.onclick = () => { B.interacted(); try { B.tricks[+b.dataset.trick].run(B); } catch (e) { console.error("[buddy] trick button crashed:", e); B.ui.say("Oops, that one broke!"); } }));
    const q = (id) => panel.querySelector('#' + id);
    if (q('opt-name')) {
      q('opt-name').oninput = (e) => { B.config.name = e.target.value || 'Nisse'; B.api.setName(B.config.name); B.save(); panel.querySelector('.head span').textContent = `${B.config.name}'s settings`; };
      q('opt-scale').oninput = (e) => { B.config.scale = +e.target.value; B.resize(); B.save(); };
      q('opt-chatty').oninput = (e) => { B.config.chatty = +e.target.value; B.save(); };
      panel.querySelector('[data-random]').onclick = () => { B.randomOutfit(); B.do('admire'); };
      panel.querySelector('[data-quit]').onclick = () => { B.ui.say('Bye bye!', 900); setTimeout(() => B.api.quit(), 900); };
    }
  }

  B.ui = { init, say, talking, follow, open, close, toggleWardrobe, render, isOpen };
})(window.Buddy);
