// Clothes and props. Each item is a pre-aligned transparent layer (a full 512
// canvas, see art/tools/build_layers.py) mounted into one of the rig's mounts:
//   bodyBack  behind everything (props held behind the hand)
//   neck      over the coat, under the beard (scarves)
//   headBack  behind the head (antlers)
//   headFront on top of the head (hats, crowns)
//   bodyFront in front of everything (props held in front of the hand)
//
// Add more with Buddy.registerItem(slot, id, { label, layer, thumb, mount }).
(function (B) {
  [['hat', 'Hats', '🎩'], ['neck', 'Neck', '🧣'], ['hand', 'Hands', '🎁']]
    .forEach(([id, label, icon]) => B.registerSlot(id, label, { icon }));

  B.defaultOutfit = { hat: 'none', neck: 'none', hand: 'none' };

  const none = { label: 'Nothing', icon: '🚫' };
  ['hat', 'neck', 'hand'].forEach((s) => B.registerItem(s, 'none', none));

  const item = (slot, id, label, mount) =>
    B.registerItem(slot, id, { label, mount, layer: `art/${id}.webp`, thumb: `art/thumbs/${id}.webp` });

  item('hat', 'hat-santa', 'Nisse hat', 'headFront');
  item('hat', 'hat-wool', 'Wool hat', 'headFront');
  item('hat', 'lucia-crown', 'Lucia crown', 'headFront');
  item('hat', 'antlers', 'Antlers', 'headBack');
  item('neck', 'scarf', 'Scarf', 'neck');
  item('hand', 'lantern', 'Lantern', 'bodyBack');
  item('hand', 'porridge', 'Rice pudding', 'bodyFront');
  item('hand', 'present', 'Present', 'bodyFront');

  B.wear = function (slot, id, { save = true } = {}) {
    const it = (B.items[slot] || {})[id];
    if (!it) return;
    const prev = (B.items[slot] || {})[B.outfit[slot]];
    if (prev && prev.layer) B.rig.unmount(prev.id);
    B.rig.el.querySelectorAll(`[data-slot="${slot}"]`).forEach((n) => n.remove());
    B.outfit[slot] = id;
    if (it.layer) {
      B.rig.mount(it.mount || 'bodyFront', it.layer, it.id);
      B.rig.el.querySelector(`[data-item="${it.id}"]`).dataset.slot = slot;
    }
    if (save) B.save();
    B.emit('wear', slot, id);
  };

  B.wearAll = function (outfit = B.outfit) {
    for (const s of B.slots) {
      const want = outfit[s.id];
      const id = want in (B.items[s.id] || {}) ? want : B.defaultOutfit[s.id] || 'none';
      B.wear(s.id, id, { save: false });
    }
  };

  B.randomOutfit = function () {
    for (const s of B.slots) B.wear(s.id, B.pick(Object.keys(B.items[s.id] || {})), { save: false });
    B.save();
  };
})(window.Buddy);
