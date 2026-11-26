// A real nisse must have his rice pudding (risengrød)!
// After a while he gets hungry and asks for it. Give him the bowl in the
// wardrobe (🎁 tab) and he eats it, bite by bite, until it's all gone.
// If nobody feeds him for a long time, he gets cheeky (see peekaboo.js).
(function (B) {
  const HUNGRY_AFTER = 20;   // minutes after eating
  const CHEEKY_AFTER = 40;   // minutes after eating, when he starts making mischief
  const BITES = 4;

  const say = (text, ms) => B.ui.say(B.phrase(text), ms);
  const fedAt = () => +localStorage.getItem('buddy.fed') || Date.now() - HUNGRY_AFTER * 60000;
  const minutesHungry = () => (Date.now() - fedAt()) / 60000;
  const hasBowl = () => B.outfit.hand === 'porridge';
  let bites = 0;

  B.hunger = {
    get hungry() { return minutesHungry() > HUNGRY_AFTER; },
    get cheeky() { return minutesHungry() > CHEEKY_AFTER && !hasBowl(); },
    feed() { localStorage.setItem('buddy.fed', Date.now()); },
    starve() { localStorage.setItem('buddy.fed', Date.now() - CHEEKY_AFTER * 60000 - 1); }, // for testing
  };

  B.registerAction('hungry', {
    random: () => (B.hunger.hungry && !hasBowl() ? 3 + Math.min(6, minutesHungry() / 10) : 0),
    start(a, S) {
      say(B.pick([
        'My tummy is rumbling... 🍚',
        'A nisse needs his rice pudding, {kid}!',
        'Risengrød? Pleeeease?',
        'Did someone say... PORRIDGE?',
        B.hunger.cheeky ? 'No porridge, no peace! Hehehe...' : 'With a lump of butter on top! Mmm...',
      ]), 3200);
      const h = B.headPos();
      B.fx.emit('note', h.x, h.y - 60 * B.rig.px(), { chars: ['🍚'], color: '#000', life: 2.2, size: 26 });
    },
    update(a, dt, S, pose) {
      pose.sit = Math.min(1, a.t * 3) * 0.5;
      pose.head = -8 + Math.sin(a.t * 2) * 4;
      pose.headY = 2;
      pose.sy = 1 - Math.abs(Math.sin(a.t * 1.4)) * 0.03; // sigh
      return a.t > 3.2;
    },
  });

  // holding the bowl: eat it
  B.registerAction('eat', {
    random: () => (hasBowl() ? 14 : 0),
    update(a, dt, S, pose) {
      const nod = Math.max(0, Math.sin(a.t * 7));
      pose.head = 10 * nod;
      pose.headY = 3 * nod;
      pose.expr = nod > 0.6 ? 'happy' : 'normal';
      a.d.nom = (a.d.nom || 0) - dt;
      if (a.d.nom < 0 && nod > 0.9) {
        a.d.nom = 0.6;
        const h = B.headPos();
        B.fx.emit('note', h.x - 30 * B.rig.px() * S.facing, h.y + 40 * B.rig.px(), { chars: ['nom', 'mmm', 'nam'], color: '#7a4b2a', size: 15 });
      }
      if (a.t < 1.8) return false;
      bites++;
      B.hunger.feed();
      if (bites >= BITES) {
        bites = 0;
        B.wear('hand', 'none');
        const h = B.headPos();
        for (let i = 0; i < 5; i++) B.fx.emit('heart', h.x + B.rand(-30, 30), h.y - 30);
        say(B.pick(['All gone! Tak, {kid}! ❤️', '*burp* ...excuse me!', 'Best. Porridge. Ever.']), 2600);
        B.do('dance');
        return false;
      }
      if (Math.random() < 0.4) say(B.pick(['Mmm!', 'Nom nom nom', 'Yummy!', 'With cinnamon!']), 1200);
      return true;
    },
  });

  // reacts right away when he gets the bowl while hungry
  B.on('wear', (slot, id) => {
    if (slot !== 'hand' || id !== 'porridge') return;
    bites = 0;
    if (B.hunger.hungry) { say(B.pick(['YES! Risengrød!', 'Porridge!! You are the best, {kid}!']), 2200); }
  });
})(window.Buddy);
