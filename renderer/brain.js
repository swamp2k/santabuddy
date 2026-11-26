// The brain: where he is, what he's doing, gravity, and the mouse.
// Every frame: build a fresh pose -> let the current action change it ->
// physics -> hand the pose to the rig.
(function (B) {
  const G = 2200;             // gravity, px/s²
  const S = (B.state = {
    x: 300, y: 0, vx: 0, vy: 0,
    facing: 1,
    airborne: false, flightMax: 0, bounces: 0,
    spin: 0, swing: 0, swingV: 0,
    squash: 0, hatSway: 0,
    time: 0,
    action: null,
    dragging: false, pressed: null, samples: [],
    mouse: { x: -9999, y: -9999, vx: 0 }, hovering: false, overUI: false,
    petDist: 0, petted: 0,
    blinkT: 2, blinkAnim: 0,
    lastInteract: performance.now(),
  });

  const s = () => B.config.scale;
  B.ground = () => window.innerHeight - 1;
  B.width = () => window.innerWidth;
  B.margin = () => 120 * B.rig.px();

  /** Screen position of the middle of his face. */
  B.headPos = () => ({
    x: S.x + (B.rig.HEAD.x - B.rig.FEET.x) * B.rig.px() * S.facing,
    y: S.y - (B.rig.FEET.y - B.rig.HEAD.y) * B.rig.px() - (S.lastBob || 0) * 2 * B.rig.px(),
  });
  B.topPos = () => ({ x: S.x, y: S.y - (B.rig.FEET.y - B.rig.TOP.y) * B.rig.px() - (S.lastBob || 0) * 2 * B.rig.px() });

  B.defaultPose = () => ({
    facing: S.facing, bob: 0, tilt: 0, sx: 1, sy: 1, pivotX: null, pivotY: null,
    legL: 0, legR: 0, armL: 8, armR: 8, head: 0, headY: 0,
    lookX: 0, lookY: 0, eyeOpen: 1, expr: 'normal', mouth: null, hatSway: 0,
  });

  // ---------------- actions ----------------
  // A buggy action (e.g. a new trick file) must never freeze him: if it throws,
  // it is switched off for this session, logged, and he moves on.
  function broken(def, e) {
    console.error(`[buddy] action "${def.name}" crashed and is switched off:`, e);
    def.random = 0;
    def.broken = true;
  }
  function call(def, fn, ...args) {
    try { return def[fn] ? def[fn](...args) : undefined; } catch (e) { broken(def, e); return 'crashed'; }
  }

  B.do = function (name, opts = {}) {
    const def = B.actions[name];
    if (!def || def.broken) { console.warn('[buddy] no action', name); if (name !== 'idle') B.do('idle'); return; }
    if (S.action) call(S.action.def, 'end', S.action, S);
    S.action = { name, def, t: 0, opts, d: {} };
    if (call(def, 'start', S.action, S) === 'crashed') return B.do('idle');
    B.emit('action', name);
  };

  B.next = function () {
    // stand still for dressing up while the wardrobe is open
    if (B.ui.isOpen()) return B.do('idle', { dur: 1 });
    const idleMin = (performance.now() - S.lastInteract) / 60000;
    const pool = [];
    let total = 0;
    for (const def of Object.values(B.actions)) {
      let w = 0;
      try { w = typeof def.random === 'function' ? def.random(S, idleMin) : def.random || 0; } catch (e) { broken(def, e); }
      if (w > 0 && S.action && S.action.name === def.name) w *= 0.3; // avoid repeats
      if (w > 0) { pool.push([def.name, w]); total += w; }
    }
    let r = Math.random() * total;
    for (const [name, w] of pool) { if ((r -= w) <= 0) return B.do(name); }
    B.do('idle');
  };

  B.interacted = () => { S.lastInteract = performance.now(); };

  /** Throw him into the air (used by jumps and throws). */
  B.launch = function (vx, vy) {
    S.vx = vx; S.vy = vy; S.airborne = true; S.flightMax = 0; S.bounces = 0;
  };

  // ---------------- physics ----------------
  function physics(dt) {
    const ground = B.ground(), m = B.margin();
    if (!S.airborne) {
      S.y = ground;
      S.x = B.clamp(S.x, m, B.width() - m);
      return;
    }
    S.vy += G * dt;
    S.x += S.vx * dt;
    S.y += S.vy * dt;
    if (S.x < m) { S.x = m; S.vx = Math.abs(S.vx) * 0.5; B.emit('wall', 'left'); }
    if (S.x > B.width() - m) { S.x = B.width() - m; S.vx = -Math.abs(S.vx) * 0.5; B.emit('wall', 'right'); }
    const top = (B.rig.FEET.y - B.rig.TOP.y) * B.rig.px();
    if (S.y < top) { S.y = top; S.vy = Math.abs(S.vy) * 0.3; }
    if (S.vy > 0) S.flightMax = Math.max(S.flightMax, S.vy);
    if (S.y >= ground) {
      S.y = ground;
      const impact = S.vy;
      for (let i = 0; i < 4; i++) B.fx.emit('puff', S.x + B.rand(-20, 20) * s(), ground - 6, { vx: [-60, 60] });
      if (impact > 750 && S.bounces < 2) {
        S.vy = -impact * 0.36;
        S.vx *= 0.7;
        S.bounces++;
        S.squash = 0.8;
      } else {
        S.airborne = false;
        S.vy = 0;
        S.vx = 0;
        S.squash = B.clamp(impact / 1100, 0.15, 1);
        const a = S.action;
        if (a && a.def.onLand) a.def.onLand(a, S.flightMax, S);
        B.emit('land', S.flightMax);
      }
    }
  }

  // ---------------- input ----------------
  function hitTest(x, y) {
    const el = document.elementFromPoint(x, y);
    S.overUI = !!(el && el.closest('.ui'));
    S.hovering = !S.overUI && B.rig.hit(x, y);
  }

  let clickable = false;
  function updateClickable() {
    const want = S.hovering || S.overUI || S.dragging || !!S.pressed;
    if (want !== clickable) { clickable = want; B.api.setClickable(want); }
    document.body.classList.toggle('grab', S.hovering && !S.dragging);
    document.body.classList.toggle('grabbing', S.dragging);
  }

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - S.mouse.x, dy = e.clientY - S.mouse.y;
    S.mouse.x = e.clientX; S.mouse.y = e.clientY;
    hitTest(e.clientX, e.clientY);

    if (S.pressed && !S.dragging && Math.hypot(e.clientX - S.pressed.x, e.clientY - S.pressed.y) > 6) {
      startDrag();
    }
    if (S.dragging) {
      S.x = e.clientX - S.grab.dx;
      S.y = Math.min(B.ground(), e.clientY - S.grab.dy);
      S.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (S.samples.length > 12) S.samples.shift();
    } else if (S.hovering && Math.abs(dx) + Math.abs(dy) < 200) {
      // petting: wiggle the mouse over him
      S.petDist += Math.abs(dx) + Math.abs(dy);
      if (S.petDist > 450) {
        S.petDist = 0;
        S.petted = 1.4;
        B.interacted();
        const h = B.headPos();
        B.fx.emit('heart', h.x + B.rand(-20, 20), h.y - 30 * s());
        B.emit('pet');
      }
    }
    updateClickable();
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !S.hovering) return;
    S.pressed = { x: e.clientX, y: e.clientY, t: performance.now() };
    updateClickable();
  });

  function startDrag() {
    S.dragging = true;
    S.grab = { dx: S.pressed.x - S.x, dy: S.pressed.y - S.y };
    S.samples = [];
    S.airborne = false;
    S.swing = 0; S.swingV = 0;
    B.interacted();
    B.do('held');
    B.emit('pickup');
  }

  let lastClick = 0;
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (S.dragging) {
      S.dragging = false;
      const now = performance.now();
      const recent = S.samples.filter((p) => now - p.t < 90);
      let vx = 0, vy = 0;
      if (recent.length >= 2) {
        const a = recent[0], b = recent[recent.length - 1];
        const dt = Math.max(16, b.t - a.t) / 1000;
        vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt;
      }
      vx = B.clamp(vx, -3200, 3200); vy = B.clamp(vy, -3200, 3200);
      if (S.y < B.ground() - 2 || Math.hypot(vx, vy) > 250) {
        B.launch(vx, vy);
        B.do('tumble');
        B.emit('throw', vx, vy);
      } else {
        B.do('idle');
      }
    } else if (S.pressed) {
      const quick = performance.now() - S.pressed.t < 450;
      if (quick) {
        B.interacted();
        const now = performance.now();
        const double = now - lastClick < 420;
        lastClick = now;
        B.emit('click', double);
        const a = S.action;
        const handled = a && a.def.onClick && a.def.onClick(a, S, double);
        if (!handled) B.do(double ? 'backflip' : 'giggle');
      }
    }
    S.pressed = null;
    hitTest(e.clientX, e.clientY);
    updateClickable();
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (S.hovering) { B.interacted(); B.ui.toggleWardrobe(); }
  });

  // ---------------- main loop ----------------
  function look(pose) {
    const h = B.headPos();
    const dx = S.mouse.x - h.x, dy = S.mouse.y - h.y;
    const d = Math.hypot(dx, dy);
    if (S.mouse.x < -1000 || d > 900) {
      pose.lookX = Math.sin(S.time * 0.7) * 1.2;
      pose.lookY = 0.3;
    } else {
      const k = Math.min(1, d / 120);
      pose.lookX = (dx / (d || 1)) * 2.3 * k;
      pose.lookY = (dy / (d || 1)) * 2.3 * k;
    }
  }

  function step(dt) {
    S.time += dt;
    const pose = B.defaultPose();

    // blinking
    S.blinkT -= dt;
    if (S.blinkT < 0) { S.blinkT = B.rand(1.8, 5); S.blinkAnim = 0.14; if (Math.random() < 0.15) S.blinkT = 0.25; }
    if (S.blinkAnim > 0) { S.blinkAnim -= dt; pose.eyeOpen = 0.1; }
    look(pose);
    if (S.petted > 0) { S.petted -= dt; pose.expr = 'happy'; }

    if (!S.airborne) S.vx = S.dragging ? S.mouse.vx : 0;
    const a = S.action;
    if (a) {
      a.t += dt;
      const done = a.def.update ? call(a.def, 'update', a, dt, S, pose) : a.t > 1;
      if (done && S.action === a) B.next();
    } else B.next();

    if (!S.dragging) physics(dt);

    // landing squash
    if (S.squash > 0) {
      pose.sy *= 1 - S.squash * 0.28;
      pose.sx *= 1 + S.squash * 0.22;
      S.squash = Math.max(0, S.squash - dt * 4);
    }

    // hat flops behind him when he moves
    const target = B.clamp(-S.vx * S.facing * 0.04, -35, 35) + (S.airborne ? B.clamp(S.vy * 0.015, -20, 20) : 0);
    S.hatSway += (target - S.hatSway) * Math.min(1, dt * 7);
    pose.hatSway += S.hatSway;

    // mouth flaps while he talks
    if (B.ui.talking() && ['normal', 'happy', 'talk', 'focused'].includes(pose.expr) && !pose.mouth) {
      pose.mouth = Math.floor(S.time * 9) % 2 ? 'grin' : 'o';
    }

    pose.facing = S.facing;
    S.lastBob = pose.bob;
    S.pose = pose;
    B.rig.apply(pose, S.time);
    B.rig.el.classList.toggle('breathing', !!pose.breathe);
    render();
  }

  // mouse velocity for swinging while held
  let lastMX = 0;
  setInterval(() => { S.mouse.vx = (S.mouse.x - lastMX) * 30; lastMX = S.mouse.x; }, 33);

  function render() {
    const F = B.rig.FEET, k = B.rig.px(), sc = s();
    B.rig.el.style.transform = `translate(${S.x - F.x * k}px, ${S.y - F.y * k}px) scale(${k})`;
    const sh = document.getElementById('shadow');
    const lift = B.clamp((B.ground() - S.y) / 400, 0, 1);
    sh.style.transform = `translate(${S.x}px, ${B.ground() - 4}px) translate(-50%,-50%) scale(${sc * (1 - lift * 0.6)})`;
    sh.style.opacity = String(0.35 * (1 - lift * 0.8));
    B.ui.follow();
  }

  B.resize = function () { /* size comes from B.rig.px() every frame */ };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try { step(dt); } catch (e) { console.error(e); }
    B.fx.update(dt);
    B.emit('frame', dt);
    requestAnimationFrame(frame);
  }
  B.startLoop = () => requestAnimationFrame(frame);
  B.hitTest = hitTest;
})(window.Buddy);
