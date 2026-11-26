# Tricks

Every `.js` file in this folder is loaded automatically when the nisse starts
(alphabetical order). Name them by date, e.g. `dec-01-snow.js`, `dec-04-hide-and-seek.js`.

Template:

```js
(function (B) {
  // a new thing he can do
  B.registerAction('spin', {
    random: 3,                      // how often he does it on his own (0 = never)
    update(a, dt, S, pose) {
      pose.tilt = a.t * 720;        // pose fields: see defaultPose() in brain.js
      pose.pivotX = B.rig.CENTER.x; // spin around his belly
      pose.pivotY = B.rig.CENTER.y;
      pose.expr = 'laugh';
      return a.t > 0.5;             // true = done
    },
  });

  // a button for it in the wardrobe's ✨ Tricks tab
  B.registerTrick({ label: 'Spin', icon: '🌀', run: () => B.do('spin') });

  // new clothes: a 512x512 transparent layer already lined up on him
  B.registerItem('hat', 'party', { label: 'Party hat', layer: 'art/party.webp', thumb: 'art/thumbs/party.webp', mount: 'headFront' });

  // react to stuff: click, pickup, throw, land, pet, wear, say, action, frame, wall
  B.on('land', (impact) => { /* ... */ });
})(window.Buddy);
```
