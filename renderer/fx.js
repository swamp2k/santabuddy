// Little particles: music notes, Zzz, hearts, stars, dust puffs.
// Buddy.fx.emit('heart', x, y, { vx, vy, life, size }) with screen coordinates.
(function (B) {
  const layer = () => document.getElementById('fx');
  const list = [];

  const TYPES = {
    note: { chars: ['♪', '♫', '♬'], color: '#2f8a4a', vy: -60, vx: [-25, 25], life: 1.8, size: 22, wobble: 1 },
    z: { chars: ['Z', 'z'], color: '#4a6fb5', vy: -35, vx: [10, 25], life: 2.4, size: 18, wobble: 0.6, grow: 1 },
    heart: { chars: ['❤'], color: '#e8435a', vy: -70, vx: [-30, 30], life: 1.4, size: 20, wobble: 1 },
    star: { chars: ['★', '✦'], color: '#f3c64b', vy: -120, vx: [-120, 120], life: 0.9, size: 16, grav: 300, spin: 1 },
    sparkle: { chars: ['✦', '✧'], color: '#ffe27a', vy: -30, vx: [-40, 40], life: 0.9, size: 14, spin: 1 },
    bang: { chars: ['!'], color: '#d62f3a', vy: -40, vx: [0, 0], life: 0.9, size: 30, bold: 1 },
    puff: { puff: true, vy: -20, vx: [-30, 30], life: 0.6, size: 10 },
    snow: { chars: ['❄'], color: '#cfe6ff', vy: -40, vx: [-60, 60], life: 1.2, size: 14, grav: 120, spin: 1 },
  };

  function emit(type, x, y, opts = {}) {
    const t = Object.assign({}, TYPES[type] || TYPES.sparkle, opts);
    const el = document.createElement('div');
    el.className = 'fx' + (t.puff ? ' puff' : '');
    const size = t.size * B.config.scale ** 0.5;
    if (t.puff) {
      el.style.width = el.style.height = size + 'px';
    } else {
      el.textContent = opts.text || B.pick(t.chars);
      el.style.color = t.color;
      el.style.fontSize = size + 'px';
      if (t.bold) el.style.fontWeight = '900';
    }
    layer().appendChild(el);
    const vx = Array.isArray(t.vx) ? B.rand(t.vx[0], t.vx[1]) : t.vx;
    list.push({ el, x, y, vx, vy: t.vy, life: t.life, age: 0, grav: t.grav || 0, wobble: t.wobble || 0,
      spin: t.spin ? B.rand(-360, 360) : 0, grow: t.grow, phase: Math.random() * 6, puff: t.puff });
    return el;
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { p.el.remove(); list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += (p.vx + Math.sin(p.age * 6 + p.phase) * 30 * p.wobble) * dt;
      p.y += p.vy * dt;
      const k = p.age / p.life;
      const sc = p.puff ? 1 + k * 1.5 : p.grow ? 0.7 + k * 0.8 : 1;
      p.el.style.opacity = String(1 - k * k);
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(${sc}) rotate(${p.spin * p.age}deg)`;
    }
  }

  B.fx = { emit, update, TYPES };
})(window.Buddy);
