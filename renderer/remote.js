// pcwatch: settings and "say now" lines from the dashboard (only when pcwatch
// installed him; see main.js). Lines are said in his normal speech bubble, a
// little while after they arrive, so it never looks like they came from somewhere.
(function (B) {
  if (!B.api.onRemote) return;

  const REV = 'buddy.remoteRev';
  const seen = new Set();   // message ids already queued (they keep coming until acked)
  const queue = [];
  let pumping = false;

  function applySettings(s) {
    if (!s || s.rev == null || String(s.rev) === localStorage.getItem(REV)) return;
    // a change on the dashboard wins; until then the kid's own tweaks in ⚙️ stay
    if (s.kidName) B.config.kidName = s.kidName;
    if (s.name) { B.config.name = s.name; B.api.setName(s.name); }
    if (typeof s.scale === 'number') B.config.scale = s.scale;
    if (typeof s.chatty === 'number') B.config.chatty = s.chatty;
    B.save();
    localStorage.setItem(REV, String(s.rev));
    window.dispatchEvent(new Event('resize')); // stocking/wreath follow his size
    if (B.ui.isOpen()) B.ui.render();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = () => B.state.dragging || ['held', 'tumble', 'dizzy', 'unwrap', 'light-candle', 'peekaboo'].includes(B.state.action?.name) || B.ui.talking();

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        await wait(B.rand(6000, 40000));          // not the instant you press send
        for (let i = 0; i < 30 && busy(); i++) await wait(2000);
        const m = queue.shift();
        if (B.state.action?.name === 'sleep') { B.do('wakeup'); await wait(1800); }
        const text = B.phrase(m.text);
        B.ui.say(text, Math.min(9000, 2600 + text.length * 55));
        B.api.remoteSaid(m.id);
        console.log('[remote] said', m.id);
        await wait(12000);
      }
    } catch (e) {
      console.error('[remote]', e);
    } finally {
      pumping = false;
    }
  }

  B.api.onRemote((data) => {
    try {
      applySettings(data.settings);
      for (const m of data.messages || []) {
        if (!m || typeof m.text !== 'string' || seen.has(m.id)) continue;
        seen.add(m.id);
        queue.push(m);
      }
      pump();
    } catch (e) {
      console.error('[remote]', e);
    }
  });

  // what he's wearing and doing, for the dashboard
  const report = () => B.api.remoteStatus({ outfit: Object.assign({}, B.outfit), action: B.state.action?.name || null });
  setInterval(report, 30000);
  B.on('ready', report);
})(window.Buddy);
