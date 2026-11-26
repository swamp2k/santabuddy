// The nisse's body: stacked transparent .webp layers in a 512x512 container.
// Every layer is a full 512 canvas with its part already in place (built by
// art/tools/build_layers.py), so they stack with position:absolute; inset:0.
// Moving parts (legs, head, hats) are rotated around joints from layers.json.
(function (B) {
  const CANVAS = 512;
  const BASE = 0.5; // screen px per container px at size 1

  // Containers that wardrobe items are mounted into, back to front
  const MOUNTS = ['bodyBack', 'neck', 'headBack', 'headFront', 'bodyFront'];

  let el, P = {}, meta, mask, lastExpr = null;

  const img = (src, cls = '') => `<img class="layer ${cls}" src="art/${src}.webp" draggable="false" alt="">`;

  function build(parent, layersMeta) {
    meta = layersMeta;
    const J = meta.joints;
    const skin = `rgb(${meta.colours.skin.join(',')})`;
    const eye = (id, [x, y]) => `
      <g id="${id}" transform="translate(${x} ${y})">
        <ellipse class="lid" rx="11.5" ry="12.5" fill="${skin}"/>
      </g>`;

    el = document.createElement('div');
    el.id = 'buddy';
    el.className = 'buddy';
    el.innerHTML = `
      <div class="b-root">
        <div class="b-breathe">
          <div class="b-flip">
            <div class="mount" data-mount="bodyBack"></div>
            <div class="b-legL part">${img('legL')}</div>
            <div class="b-legR part">${img('legR')}</div>
            <div class="b-upper part">
              ${img('body')}
              <div class="mount" data-mount="neck"></div>
              <div class="b-head part">
                <div class="b-hats part"><div class="mount" data-mount="headBack"></div></div>
                ${img('head')}
                <svg class="b-face" viewBox="0 0 ${CANVAS} ${CANVAS}">
                  <g class="lids">${eye('b-lidL', J.eyeL)}${eye('b-lidR', J.eyeR)}</g>
                  <path class="ink e-closed" d="M${J.eyeL[0] - 9},${J.eyeL[1] - 1} q9,8 18,0 M${J.eyeR[0] - 9},${J.eyeR[1] - 1} q9,8 18,0"/>
                  <path class="ink e-happy" d="M${J.eyeL[0] - 9},${J.eyeL[1] + 3} q9,-11 18,0 M${J.eyeR[0] - 9},${J.eyeR[1] + 3} q9,-11 18,0"/>
                  <path class="ink e-dizzy" d="M${J.eyeL[0]},${J.eyeL[1]} m-1.5,0 a1.5,1.5 0 1,1 3,0 a4,4 0 1,1 -8,0 a6.5,6.5 0 1,1 13,0 M${J.eyeR[0]},${J.eyeR[1]} m-1.5,0 a1.5,1.5 0 1,1 3,0 a4,4 0 1,1 -8,0 a6.5,6.5 0 1,1 13,0"/>
                  <ellipse class="e-o" cx="${J.mouth[0]}" cy="${J.mouth[1] + 2}" rx="5.5" ry="6.5"/>
                </svg>
                <div class="b-hats part"><div class="mount" data-mount="headFront"></div></div>
              </div>
              <div class="mount" data-mount="bodyFront"></div>
            </div>
          </div>
        </div>
      </div>`;
    parent.appendChild(el);

    const q = (s) => el.querySelector(s);
    P = {
      root: q('.b-root'), flip: q('.b-flip'), upper: q('.b-upper'),
      legL: q('.b-legL'), legR: q('.b-legR'), head: q('.b-head'),
      hats: [...el.querySelectorAll('.b-hats')],
      face: q('.b-face'), lids: q('.lids'), lidL: q('#b-lidL'), lidR: q('#b-lidR'),
      closed: q('.e-closed'), happy: q('.e-happy'), dizzy: q('.e-dizzy'), o: q('.e-o'),
      mounts: Object.fromEntries(MOUNTS.map((m) => [m, q(`[data-mount="${m}"]`)])),
    };
    // joints -> transform origins
    const o = (n) => `${J[n][0]}px ${J[n][1]}px`;
    P.legL.style.transformOrigin = o('hipL');
    P.legR.style.transformOrigin = o('hipR');
    P.head.style.transformOrigin = o('neck');
    P.hats.forEach((h) => (h.style.transformOrigin = o('headTop')));
    q('.b-breathe').style.transformOrigin = o('feet');

    // hit mask: rows of 0/1 over the 512 canvas
    mask = { n: meta.mask.size, rows: meta.mask.rows };

    B.rig.el = B.rig.svg = el;
    B.rig.parts = P;
    B.rig.J = J;
    B.rig.FEET = { x: J.feet[0], y: J.feet[1] };
    B.rig.HEAD = { x: (J.eyeL[0] + J.eyeR[0]) / 2, y: J.eyeL[1] };
    B.rig.TOP = { x: J.headTop[0], y: J.headTop[1] - 40 };
    B.rig.CENTER = { x: 256, y: 330 };
    return el;
  }

  /** Screen px per container px. */
  const px = () => B.config.scale * BASE;

  /** Put an item layer into one of the mounts. */
  function mount(where, src, id) {
    const m = P.mounts[where];
    if (!m) return;
    const tag = document.createElement('img');
    tag.className = 'layer item';
    tag.src = src;
    tag.draggable = false;
    tag.dataset.item = id;
    m.appendChild(tag);
  }
  function unmount(id) { el.querySelectorAll(`[data-item="${id}"]`).forEach((n) => n.remove()); }

  // expression -> which overlays to show
  const EXPRESSIONS = {
    normal: {}, talk: {}, focused: {}, sad: {},
    happy: { lids: 1, happy: 1 },
    laugh: { lids: 1, happy: 1, o: 1 },
    surprised: { o: 1 },
    sleep: { lids: 1, closed: 1 },
    dizzy: { lids: 1, dizzy: 1 },
  };

  function setExpression(name, blink) {
    const key = name + (blink ? '+b' : '');
    if (key === lastExpr) return;
    lastExpr = key;
    const e = EXPRESSIONS[name] || {};
    const lids = e.lids || blink;
    const show = (node, on) => (node.style.display = on ? 'inline' : 'none');
    show(P.lids, lids);
    show(P.closed, e.closed || (blink && !e.lids));
    show(P.happy, e.happy);
    show(P.dizzy, e.dizzy);
    show(P.o, e.o);
  }

  const f = (n) => Math.round(n * 100) / 100;
  const U = 2; // old pose units (bob, headY) -> container px

  /** Apply a pose object (see brain.js defaultPose). */
  function apply(p) {
    const px0 = p.pivotX ?? B.rig.FEET.x, py0 = p.pivotY ?? B.rig.FEET.y;
    P.root.style.transformOrigin = `${f(px0)}px ${f(py0)}px`;
    P.root.style.transform = `translate(0px, ${f(-p.bob * U)}px) rotate(${f(p.tilt)}deg) scale(${f(p.sx)}, ${f(p.sy)})`;
    P.flip.style.transform = p.facing < 0 ? 'scaleX(-1)' : '';
    P.legL.style.transform = `rotate(${f(p.legL * 0.6)}deg)`;
    P.legR.style.transform = `rotate(${f(p.legR * 0.6)}deg)`;
    // sitting: upper body sinks down over the boots
    P.upper.style.transform = p.sit ? `translateY(${f(p.sit * 62)}px)` : '';
    // the head follows the mouse a little
    const look = (p.lookX || 0) * 1.4 * (p.facing < 0 ? -1 : 1);
    P.head.style.transform = `translateY(${f((p.headY || 0) * U)}px) rotate(${f(p.head + look)}deg)`;
    const wob = f((p.hatSway || 0) * 0.25);
    P.hats.forEach((h) => (h.style.transform = `rotate(${wob}deg)`));
    setExpression(p.expr, p.eyeOpen < 0.5);
  }

  /** Is screen point (x,y) on him? Uses the rest-pose silhouette. */
  function hit(x, y) {
    const S = B.state, k = px();
    const F = B.rig.FEET;
    let lx = (x - S.x) / k + F.x, ly = (y - S.y) / k + F.y;
    const p = S.pose || {};
    ly += (p.bob || 0) * U;
    if (p.tilt) {
      const a = (-p.tilt * Math.PI) / 180, cx = p.pivotX ?? F.x, cy = p.pivotY ?? F.y;
      const dx = lx - cx, dy = ly - cy;
      lx = cx + dx * Math.cos(a) - dy * Math.sin(a);
      ly = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (S.facing < 0) lx = CANVAS - lx;
    if (p.sit && ly < 400) ly -= p.sit * 62;
    if (lx < 0 || ly < 0 || lx >= CANVAS || ly >= CANVAS) return false;
    const r = Math.floor((ly / CANVAS) * mask.n), c = Math.floor((lx / CANVAS) * mask.n);
    return mask.rows[r][c] === '1';
  }

  B.rig = { build, apply, mount, unmount, hit, px, MOUNTS, EXPRESSIONS, CANVAS };
})(window.Buddy);
