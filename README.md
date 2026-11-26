# Balder's Nisse 🎅

A little Christmas nisse who lives on the desktop. He walks along the top of
the taskbar, talks, dances, naps, and can be dressed up.

## Run it

Double-click `start-nisse.bat`, or run `npm start`. (`npm run dev` prints his
console to the terminal and saves `snapshot.png` after 5 seconds.)

Quit or reload him from the tray icon (the little nisse face by the clock).
He starts with Windows (switched on the first time he runs; untick
**Start with Windows** in the tray menu to stop that).

If something seems broken, run `npm run dev`: everything he logs, including
errors with the file and line, goes to `dev.log`. A trick that crashes is
switched off and logged, and he keeps going. If the whole page crashes he
reloads himself.

Before changing art or code, `git commit -am "before ..."` so you can go back.

## Playing with him

| Do this | He does this |
|---|---|
| Click him | Giggles |
| Double-click | Backflip |
| Drag him | Dangles and kicks his legs, swinging with the mouse |
| Throw him | Flies, bounces off the screen edges, and gets dizzy if you throw him hard |
| Wiggle the mouse over him | Gets petted (hearts!) |
| Click him while he sleeps | Wakes up with a jump |
| Right-click him | Opens the wardrobe |

The **wardrobe** has hats (nisse hat, wool hat, Lucia crown, antlers), a
scarf, and things to hold (lantern, rice pudding, present). The ✨ tab triggers
tricks and ⚙️ has name, size, chattiness and a random outfit.

### December calendar

[`renderer/calendar.json`](renderer/calendar.json) is keyed by December date
(`"12-13"`). Each day he wears the latest entry on or before today, and says its
`say` line once. If Balder dresses him by hand, that sticks until the next day.

## How it's built

```
art/source/sheet.jpg        the character sheet (Gemini)
art/tools/build_layers.py   cuts the sheet into layers  ->  python art/tools/build_layers.py
art/tools/preview.py        contact sheet of all layers/outfits, for checking
main.js / preload.js        Electron: transparent click-through window, tray, file access
renderer/
  art/                      built layers: legL, legR, body, head + one per item (512 canvas, 2x webp)
  art/layers.json           joints (hips, neck, eyes...), hit mask, colours
  rig.js                    stacks the layers in a 512x512 container, poses them, eyelids/expressions
  wardrobe.js               items + which mount they go in (bodyBack, neck, headBack, headFront, bodyFront)
  calendar.js/.json         December outfits by date
  brain.js                  state, physics, mouse (drag/throw/click/pet), main loop
  actions.js                everything he does (idle, walk, run, jump, dance, sit, sleep, ...)
  phrases.js                everything he says
  fx.js, ui.js, style.css   particles, speech bubble + wardrobe, breathing keyframes
  tricks/                   December additions, one file per day (auto-loaded)
```

### New clothes from a new sheet

Put the new sheet in `art/source/`, add the item to `PLACE` in
`build_layers.py` (source box, anchor, where it goes on him, scale), re-run it,
then one line in `wardrobe.js` (`item('hat', 'my-hat', 'My hat', 'headFront')`).

### Adding something new (the December plan)

Drop a file into `renderer/tricks/` (see `renderer/tricks/README.md` for a
template) and reload from the tray. A trick can:

- `B.registerAction(name, {...})` add a new behaviour (with `random` weight so he does it on his own)
- `B.registerTrick({label, icon, run})` add a button in the ✨ tab
- `B.registerItem(slot, id, {label, layer, thumb, mount})` add clothes (a pre-aligned 512 layer)
- `B.on('click' | 'land' | 'throw' | 'pet' | 'frame' | ...)` react to things
- `B.ui.say(text)`, `B.fx.emit('heart', x, y)`, `B.do('dance')`, `B.state`, `B.headPos()`

Pose fields (set them in an action's `update`): `bob tilt sx sy pivotX pivotY
legL legR head headY sit breathe lookX eyeOpen expr hatSway` (pivots in 512
container px). Expressions: `normal happy laugh surprised sleep dizzy`.
