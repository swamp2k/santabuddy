// Nisse mischief: he tiptoes off the edge of the screen and hides, then peeks
// back in, giggling. Get the mouse close (or click him) and he jumps out: BOO!
// He does it more when he's hungry and nobody has given him porridge.
(function (B) {
  const say = (text, ms) => B.ui.say(B.phrase(text), ms);
  const k = () => B.rig.px();

  function boo(a, S) {
    if (a.d.phase === 'boo') return;
    a.d.phase = 'boo';
    a.d.pt = 0;
    S.facing = a.d.side < 0 ? 1 : -1;
    S.x = a.d.side < 0 ? Math.max(S.x, 10 * k()) : Math.min(S.x, B.width() - 10 * k());
    S.noWalls = false;
    B.launch(-a.d.side * B.rand(380, 520) * B.config.scale, -B.rand(700, 850) * Math.sqrt(B.config.scale));
    say(B.pick(['BOO!', 'BOOOO! Hahaha!', 'Gotcha, {kid}!']), 1800);
    const h = B.headPos();
    B.fx.emit('bang', h.x, h.y - 80 * k());
    for (let i = 0; i < 6; i++) B.fx.emit('star', h.x, h.y);
  }

  B.registerAction('peekaboo', {
    random: () => (B.hunger && B.hunger.cheeky ? 7 : 2),
    start(a, S) {
      a.d.side = S.x < B.width() / 2 ? -1 : 1;          // -1 = left edge
      const edge = a.d.side < 0 ? 0 : B.width();
      a.d.hide = edge + a.d.side * 150 * k();           // fully behind the edge
      a.d.peek = edge - a.d.side * 55 * k();            // half a face showing
      a.d.home = edge - a.d.side * (B.margin() + 30);
      a.d.phase = 'sneak';
      a.d.peeks = Math.floor(B.rand(2, 4));
      S.noWalls = true;
      if (Math.random() < 0.5) say(B.pick(['Shhh...', 'Hehehe...', 'Where did the nisse go?']), 1400);
    },
    update(a, dt, S, pose) {
      const move = (to, speed) => {
        const d = to - S.x;
        S.x += Math.sign(d) * Math.min(Math.abs(d), speed * k() * dt);
        return Math.abs(to - S.x) < 1;
      };
      const tiptoe = (t) => { pose.legL = Math.sin(t * 14) * 14; pose.legR = -pose.legL; pose.bob = Math.abs(Math.sin(t * 14)) * 3; };
      a.d.pt = (a.d.pt || 0) + dt;

      // mouse near the hiding spot? jump out
      const edge = a.d.side < 0 ? 0 : B.width();
      const near = Math.abs(S.mouse.x - edge) < 150 && Math.abs(S.mouse.y - (S.y - 80 * k())) < 220;
      if (near && (a.d.phase === 'hidden' || a.d.phase === 'peek')) boo(a, S);

      switch (a.d.phase) {
        case 'sneak':
          S.facing = a.d.side;
          tiptoe(a.t);
          pose.sit = 0.25; pose.expr = 'happy'; pose.tilt = 4 * a.d.side;
          if (move(a.d.hide, 160)) { a.d.phase = 'hidden'; a.d.pt = 0; a.d.wait = B.rand(1.5, 3.5); }
          break;
        case 'hidden':
          S.facing = -a.d.side;
          if (a.d.pt > a.d.wait) { a.d.phase = 'peek'; a.d.pt = 0; }
          break;
        case 'peek': {
          S.facing = -a.d.side;
          const out = a.d.pt < 1.6;
          move(out ? a.d.peek : a.d.hide, out ? 420 : 300);
          pose.tilt = -12 * a.d.side * (out ? 1 : 0.3);
          pose.head = -6 * a.d.side;
          pose.expr = out ? (a.d.pt > 0.7 ? 'laugh' : 'happy') : 'normal';
          if (out && !a.d.giggled && a.d.pt > 0.6) { a.d.giggled = true; if (Math.random() < 0.6) say(B.pick(['Hihihi!', 'Peekaboo!', 'Can you see me?']), 1100); }
          if (a.d.pt > 2.3) {
            a.d.giggled = false;
            if (--a.d.peeks <= 0) { a.d.phase = 'return'; } else { a.d.phase = 'hidden'; a.d.pt = 0; a.d.wait = B.rand(1, 3); }
          }
          break;
        }
        case 'return':
          S.facing = -a.d.side;
          tiptoe(a.t);
          if (move(a.d.home, 140)) { S.noWalls = false; say('Did you miss me?', 1600); return true; }
          break;
        case 'boo':
          pose.expr = 'laugh';
          if (!S.airborne && a.d.pt > 0.3) { B.do('giggle'); return false; }
          break;
      }
      return a.t > 30;
    },
    onClick(a, S) { if (a.d.phase !== 'boo') { boo(a, S); return true; } return false; },
    end(a, S) { S.noWalls = false; },
  });

  B.registerTrick({ label: 'Peekaboo', icon: '🙈', run: () => B.do('peekaboo') });
})(window.Buddy);
