// Things he does. Each action:
//   random:  weight for picking it on his own (number or fn(state, idleMinutes)); 0 = only on request
//   start(a, S)            when it begins (a.d is scratch space, a.opts the options)
//   update(a, dt, S, pose) every frame; change the pose; return true when finished
//   onLand(a, impact, S)   when he hits the ground
//   onClick(a, S, double)  return true to handle a click yourself
//   end(a, S)              when it stops (finished or interrupted)
(function (B) {
  const { rand, clamp, lerp, ease, pick } = B;
  const sc = () => B.config.scale;
  const say = (kind, ms) => B.ui.say(B.phrase(kind), ms);
  const PI = Math.PI;

  function stride(a, dt, pose, freq, amp) {
    a.d.phase = (a.d.phase || 0) + dt * freq;
    const p = Math.sin(a.d.phase);
    pose.legL = p * amp;
    pose.legR = -p * amp;
    pose.armL = 12 - p * amp * 0.7;
    pose.armR = 12 + p * amp * 0.7;
    pose.bob = Math.abs(Math.cos(a.d.phase)) * amp * 0.09;
    pose.head = Math.sin(a.d.phase * 2) * 1.5;
  }

  // gentle breathing is a CSS keyframe animation (style.css .breathing)
  function breathe(pose) { pose.breathe = true; }

  function airPose(pose, S) {
    const up = S.vy < 0;
    pose.armL = up ? 150 : 120;
    pose.armR = up ? 150 : 120;
    pose.legL = up ? 18 : 6;
    pose.legR = up ? -22 : -8;
    pose.expr = 'happy';
  }

  // ---------- standing around ----------
  B.registerAction('idle', {
    random: 30,
    start(a, S) { a.d.dur = a.opts.dur ?? rand(1.5, 4); },
    update(a, dt, S, pose) {
      breathe(pose, S);
      pose.head = Math.sin(a.t * 0.9) * 3;
      // turn towards the mouse if it's close
      const dx = S.mouse.x - S.x;
      if (Math.abs(dx) < 500 && Math.abs(dx) > 30 && Math.abs(S.mouse.y - S.y) < 500) S.facing = Math.sign(dx);
      return a.t > a.d.dur;
    },
  });

  // ---------- walking & running ----------
  function goTo(speed, freq, amp, lean) {
    return {
      start(a, S) {
        const W = B.width(), m = B.margin() + 20;
        let tx = a.opts.x;
        if (tx == null) {
          do { tx = rand(m, W - m); } while (Math.abs(tx - S.x) < 150 && W > 400);
        }
        a.d.tx = clamp(tx, m, W - m);
        S.facing = Math.sign(a.d.tx - S.x) || S.facing;
      },
      update(a, dt, S, pose) {
        const dir = Math.sign(a.d.tx - S.x);
        if (dir) S.facing = dir;
        const v = (a.opts.speed || speed) * sc();
        S.x += dir * Math.min(v * dt, Math.abs(a.d.tx - S.x));
        S.vx = dir * v;
        stride(a, dt, pose, freq, amp);
        pose.tilt = lean * S.facing;
        a.d.dust = (a.d.dust || 0) - dt;
        if (speed > 150 && a.d.dust < 0) {
          a.d.dust = 0.1;
          B.fx.emit('puff', S.x - S.facing * 12 * sc(), B.ground() - 5, { vx: [-S.facing * 60, -S.facing * 20] });
        }
        if (speed > 150) pose.expr = 'happy';
        const arrived = Math.abs(a.d.tx - S.x) < 2;
        if (arrived && a.opts.then) { const t = a.opts.then; a.opts.then = null; B.do(t); return false; }
        return arrived || a.t > 25;
      },
    };
  }
  B.registerAction('walk', Object.assign({ random: 26 }, goTo(75, 9, 24, 3)));
  B.registerAction('run', Object.assign({ random: 6 }, goTo(260, 17, 40, 10)));

  // ---------- jumping ----------
  B.registerAction('jump', {
    random: 5,
    start(a) { a.d.phase = 'crouch'; },
    update(a, dt, S, pose) {
      if (a.d.phase === 'crouch') {
        const k = clamp(a.t / 0.18, 0, 1);
        pose.sy = 1 - 0.14 * k; pose.sx = 1 + 0.08 * k;
        pose.armL = pose.armR = 30 * k;
        if (a.t > 0.18) {
          a.d.phase = 'air';
          B.launch((a.opts.vx ?? rand(-40, 40)) * sc() + S.facing * 60, -(a.opts.power || rand(650, 820)) * Math.sqrt(sc()));
        }
      } else if (a.d.phase === 'air') {
        airPose(pose, S);
      } else {
        a.d.landT += dt;
        pose.expr = 'happy';
        return a.d.landT > 0.3;
      }
    },
    onLand(a) { a.d.phase = 'landed'; a.d.landT = 0; },
  });

  B.registerAction('backflip', {
    random: 2,
    start(a) { a.d.phase = 'crouch'; },
    update(a, dt, S, pose) {
      if (a.d.phase === 'crouch') {
        const k = clamp(a.t / 0.2, 0, 1);
        pose.sy = 1 - 0.18 * k; pose.sx = 1 + 0.1 * k;
        pose.armL = pose.armR = 160 * k;
        if (a.t > 0.2) {
          a.d.phase = 'air';
          const v = 900 * Math.sqrt(sc());
          a.d.airTime = (2 * v) / 2200;
          a.d.t0 = a.t;
          B.launch(-S.facing * 40 * sc(), -v);
        }
      } else if (a.d.phase === 'air') {
        const k = clamp((a.t - a.d.t0) / a.d.airTime, 0, 1);
        pose.pivotX = B.rig.CENTER.x; pose.pivotY = B.rig.CENTER.y;
        pose.tilt = -360 * ease(k) * S.facing;
        pose.armL = pose.armR = 150;
        pose.legL = -40; pose.legR = -40;
        pose.expr = 'laugh';
      } else {
        a.d.landT += dt;
        pose.armL = pose.armR = 150 - a.d.landT * 300;
        pose.expr = 'happy';
        return a.d.landT > 0.5;
      }
    },
    onLand(a) {
      a.d.phase = 'landed'; a.d.landT = 0;
      if (Math.random() < 0.5) say('landed', 1500);
      for (let i = 0; i < 5; i++) B.fx.emit('star', B.state.x, B.ground() - 150 * B.rig.px());
    },
  });

  // ---------- being silly ----------
  B.registerAction('wave', {
    random: 4,
    start(a, S) {
      if (Math.abs(S.mouse.x - S.x) < 900) S.facing = Math.sign(S.mouse.x - S.x) || 1;
      say(a.opts.phrase || 'hello', 2200);
    },
    update(a, dt, S, pose) {
      const k = clamp(a.t / 0.25, 0, 1) * clamp((2.4 - a.t) / 0.25, 0, 1);
      pose.bob = Math.abs(Math.sin(a.t * 9)) * 5 * k;
      pose.tilt = Math.sin(a.t * 9) * 4 * k;
      pose.head = (6 + Math.sin(a.t * 4.5) * 6) * k;
      pose.expr = 'happy';
      return a.t > 2.4;
    },
  });

  B.registerAction('dance', {
    random: 4,
    start(a) { a.d.dur = a.opts.dur ?? rand(4, 7); a.d.note = 0; if (Math.random() < 0.6) say('dance', 1800); },
    update(a, dt, S, pose) {
      const beat = a.t * 2.2; // beats per second
      const b = beat * PI;
      pose.bob = Math.abs(Math.sin(b)) * 9;
      pose.tilt = Math.sin(b) * 9;
      pose.head = -Math.sin(b) * 9;
      pose.armL = 90 + Math.sin(b * 2) * 60;
      pose.armR = 90 - Math.sin(b * 2) * 60;
      pose.legL = Math.max(0, Math.sin(b)) * -30;
      pose.legR = Math.max(0, -Math.sin(b)) * 30;
      pose.expr = 'happy';
      if (Math.floor(beat / 2) !== a.d.flip) { a.d.flip = Math.floor(beat / 2); S.facing *= -1; }
      a.d.note -= dt;
      if (a.d.note < 0) { a.d.note = 0.45; const h = B.headPos(); B.fx.emit('note', h.x + rand(-90, 90) * B.rig.px(), h.y - 120 * B.rig.px()); }
      return a.t > a.d.dur;
    },
  });

  B.registerAction('say', {
    random: (S) => 6 * B.config.chatty,
    start(a) { say(a.opts.kind || 'random', a.opts.ms || 3200); },
    update(a, dt, S, pose) { breathe(pose, S); pose.head = Math.sin(a.t * 3) * 3; return a.t > 3.2; },
  });

  B.registerAction('giggle', {
    start(a) {
      if (Math.random() < 0.6) say('giggle', 1400);
      const h = B.headPos();
      for (let i = 0; i < 3; i++) B.fx.emit('heart', h.x + rand(-25, 25) * sc(), h.y - 25 * sc());
    },
    update(a, dt, S, pose) {
      pose.sx = 1 + Math.sin(a.t * 38) * 0.04;
      pose.sy = 1 - Math.sin(a.t * 38) * 0.04;
      pose.tilt = Math.sin(a.t * 22) * 4;
      pose.armL = pose.armR = 35 + Math.sin(a.t * 20) * 10;
      pose.legL = Math.sin(a.t * 20) * 6; pose.legR = -pose.legL;
      pose.expr = 'laugh';
      return a.t > 1.1;
    },
  });

  // ---------- sitting & sleeping ----------
  // sitting: his coat sinks down over the boots, feet splay out a little
  function sitPose(pose, k) {
    pose.sit = k;
    pose.legL = 14 * k;
    pose.legR = -14 * k;
  }

  B.registerAction('sit', {
    random: 6,
    start(a) { a.d.dur = a.opts.dur ?? rand(5, 11); },
    update(a, dt, S, pose) {
      const k = ease(clamp(a.t / 0.35, 0, 1)) * ease(clamp((a.d.dur - a.t) / 0.35, 0, 1));
      sitPose(pose, k);
      pose.legL += Math.sin(a.t * 3) * 8 * k;
      pose.legR += Math.sin(a.t * 3 + PI) * 8 * k;
      pose.head = Math.sin(a.t * 0.5) * 6;
      breathe(pose, S);
      return a.t > a.d.dur;
    },
  });

  B.registerAction('sleep', {
    random: (S, idleMin) => (idleMin > 3 ? 20 : 0.6),
    start(a) { a.d.dur = a.opts.dur ?? rand(18, 35); a.d.z = 1; if (Math.random() < 0.5) say('sleepy', 1600); },
    update(a, dt, S, pose) {
      const k = ease(clamp(a.t / 0.6, 0, 1)) * ease(clamp((a.d.dur - a.t) / 0.4, 0, 1));
      sitPose(pose, k);
      pose.head = 16 * k;
      pose.headY = 3 * k;
      pose.armL = pose.armR = lerp(8, 18, k);
      pose.sy *= 1 + Math.sin(a.t * 1.6) * 0.025 * k;
      if (a.t > 0.6 && a.t < a.d.dur - 0.4) {
        pose.expr = 'sleep';
        a.d.z -= dt;
        if (a.d.z < 0) { a.d.z = 1.3; const h = B.headPos(); B.fx.emit('z', h.x + 70 * B.rig.px() * S.facing, h.y - 60 * B.rig.px()); }
      }
      return a.t > a.d.dur;
    },
    onClick() { B.do('wakeup'); return true; },
  });

  B.registerAction('wakeup', {
    start(a, S) {
      say('wake', 1600);
      const h = B.headPos();
      B.fx.emit('bang', h.x, h.y - 150 * B.rig.px());
      B.launch(0, -480 * Math.sqrt(sc()));
    },
    update(a, dt, S, pose) {
      pose.expr = 'surprised';
      pose.armL = pose.armR = 140;
      pose.legL = 15; pose.legR = -15;
      if (!S.airborne) { pose.armL = pose.armR = lerp(140, 8, clamp(a.d.lt / 0.3, 0, 1)); a.d.lt = (a.d.lt || 0) + dt; }
      return !S.airborne && a.d.lt > 0.6;
    },
  });

  // ---------- being picked up and thrown ----------
  B.registerAction('held', {
    start(a) { a.d.said = false; a.d.sayAt = rand(0.4, 1.2); },
    update(a, dt, S, pose) {
      // swing like a pendulum around where the mouse is holding him
      const target = clamp(S.mouse.vx * 0.025, -55, 55);
      S.swingV += ((target - S.swing) * 70 - S.swingV * 7) * dt;
      S.swing += S.swingV * dt;
      pose.pivotX = B.rig.FEET.x + S.grab.dx / B.rig.px();
      pose.pivotY = B.rig.FEET.y + S.grab.dy / B.rig.px();
      pose.tilt = S.swing;
      pose.legL = Math.sin(a.t * 15) * 28;
      pose.legR = -Math.sin(a.t * 15) * 28;
      pose.armL = 135 + Math.sin(a.t * 11) * 22;
      pose.armR = 135 + Math.sin(a.t * 11 + 1.5) * 22;
      pose.expr = a.t < 0.5 ? 'surprised' : Math.abs(S.mouse.vx) > 600 ? 'laugh' : 'happy';
      if (!a.d.said && a.t > a.d.sayAt) { a.d.said = true; if (Math.random() < 0.7) say('pickedUp', 1500); }
      return false;
    },
  });

  B.registerAction('tumble', {
    start(a, S) {
      S.spin = 0;
      if (Math.hypot(S.vx, S.vy) > 1200) say('thrown', 1300);
    },
    update(a, dt, S, pose) {
      pose.pivotX = B.rig.CENTER.x; pose.pivotY = B.rig.CENTER.y;
      if (S.airborne) {
        S.spin += clamp(S.vx, -1500, 1500) * dt * 0.6;
        pose.tilt = S.spin;
        pose.armL = 150 + Math.sin(a.t * 18) * 20;
        pose.armR = 150 + Math.sin(a.t * 18 + 2) * 20;
        pose.legL = 25 + Math.sin(a.t * 14) * 15;
        pose.legR = -25 - Math.sin(a.t * 14) * 15;
        pose.expr = Math.abs(S.vx) + Math.abs(S.vy) > 900 ? 'laugh' : 'surprised';
        return false;
      }
      // landed: roll back upright
      a.d.lt = (a.d.lt || 0) + dt;
      const k = ease(clamp(a.d.lt / 0.35, 0, 1));
      pose.tilt = lerp(a.d.from || 0, 0, k);
      pose.expr = 'surprised';
      return a.d.lt > 0.45;
    },
    onLand(a, impact, S) {
      let r = ((S.spin % 360) + 540) % 360 - 180;
      a.d.from = r;
      S.spin = 0;
      if (impact > 1500 || Math.abs(r) > 120) {
        B.do('dizzy');
      } else if (impact > 900 && Math.random() < 0.5) {
        say('landed', 1300);
      }
    },
  });

  B.registerAction('dizzy', {
    start(a) {
      say('dizzy', 2400);
      a.d.stars = [0, 1, 2].map(() => {
        const el = document.createElement('div');
        el.className = 'fx orbit';
        el.textContent = '★';
        document.getElementById('fx').appendChild(el);
        return el;
      });
    },
    update(a, dt, S, pose) {
      pose.tilt = Math.sin(a.t * 5) * 9;
      pose.head = Math.sin(a.t * 5 + 1) * 10;
      pose.legL = Math.sin(a.t * 5) * 6; pose.legR = -pose.legL;
      pose.armL = 20 + Math.sin(a.t * 4) * 10; pose.armR = 20 - Math.sin(a.t * 4) * 10;
      pose.expr = 'dizzy';
      const h = B.headPos();
      a.d.stars.forEach((el, i) => {
        const ang = a.t * 5 + (i * 2 * PI) / 3;
        const k = B.rig.px();
        const x = h.x + Math.cos(ang) * 95 * k;
        const y = h.y - 105 * k + Math.sin(ang) * 18 * k;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${Math.sqrt(sc()) * (0.8 + Math.sin(ang) * 0.25)})`;
        el.style.zIndex = Math.sin(ang) > 0 ? 3 : 1;
      });
      return a.t > 3;
    },
    end(a) { a.d.stars.forEach((el) => el.remove()); },
  });

  // ---------- showing off new clothes ----------
  B.registerAction('admire', {
    start(a) { a.d.flip = 0; },
    update(a, dt, S, pose) {
      if (a.t < 0.8) {
        const n = Math.floor(a.t / 0.2);
        if (n !== a.d.flip) { a.d.flip = n; S.facing *= -1; }
        pose.bob = Math.abs(Math.sin(a.t * PI * 5)) * 6;
        pose.armL = pose.armR = 60;
        pose.expr = 'happy';
      } else {
        if (!a.d.said) { a.d.said = true; say('newClothes', 1600); }
        pose.armL = 30; pose.armR = 110 + Math.sin(a.t * 8) * 10;
        pose.head = 8;
        pose.expr = 'happy';
      }
      return a.t > 2;
    },
  });

  B.registerAction('come', {
    start(a, S) {
      const x = a.opts.x ?? B.width() / 2;
      B.do('run', { x, then: 'wave' });
    },
    update() { return true; },
  });
})(window.Buddy);
