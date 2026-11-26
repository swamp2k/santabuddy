// Wire everything up and say hello.
(async function (B) {
  const meta = await B.api.readJSON('art/layers.json');
  B.rig.build(document.getElementById('stage'), meta);
  B.ui.init();
  B.api.setName(B.config.name);

  // Load every file in renderer/tricks/ (Electron only; the main process lists them)
  const files = await B.api.listTricks();
  for (const f of files) {
    await new Promise((res) => {
      const el = document.createElement('script');
      el.src = 'tricks/' + f;
      el.onload = res;
      el.onerror = () => { console.error('[buddy] trick failed to load', f); res(); };
      document.body.appendChild(el);
    });
  }
  B.wearAll();               // saved outfit (tricks may have added new clothes)
  await B.calendar.load();   // December: today's outfit from calendar.json

  // Commands from the tray icon
  B.api.onCommand((cmd) => {
    B.interacted();
    if (cmd === 'wardrobe') B.ui.open();
    else if (cmd === 'come') B.do('come');
    else if (cmd.startsWith('do:')) B.do(cmd.slice(3));
    else B.emit('command', cmd);
  });

  // Pop in from the side of the screen
  const S = B.state;
  S.facing = Math.random() < 0.5 ? 1 : -1;
  S.x = S.facing > 0 ? B.margin() : B.width() - B.margin();
  S.y = B.ground();
  B.startLoop();
  B.do('run', { x: B.width() * B.rand(0.3, 0.7), then: 'wave' });
  B.emit('ready');
})(window.Buddy);
