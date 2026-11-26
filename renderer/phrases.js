// Everything he says. {kid} becomes Balder's name, {name} his own name,
// {sleeps} the number of sleeps until Christmas Eve. Translate freely!
(function (B) {
  B.phrases = {
    hello: ['Hi {kid}!', 'Hello {kid}!', 'Ho ho ho!', 'Psst, {kid}! It\'s me, {name}!'],
    random: [
      'Only {sleeps} sleeps until Christmas Eve!',
      'Is it Christmas yet?',
      'I love snow!',
      'Got any cookies?',
      'Rice pudding... with a BIG lump of butter!',
      'Don\'t forget my porridge, {kid}!',
      'I\'m a nisse. We are very good at hiding.',
      'La la laaa ♪',
      'Hmm... what should we do today?',
      'Have you been good this year, {kid}?',
      'My hat is the pointiest hat.',
      'I can count to... uhh... lots!',
    ],
    pickedUp: ['Hey! Put me down!', 'Wheee, I can fly!', 'Whoa!', 'Up up up!', 'Hihi, tickles!'],
    thrown: ['Wheeeee!', 'Again! Again!', 'AAAAAH!', 'Whoooosh!'],
    dizzy: ['Everything is spinning...', 'Who moved the floor?', 'Ooooh... my hat...', 'Wobbly wobbly...'],
    giggle: ['Hihi!', 'That tickles!', 'Hehehe!', 'Stop it, {kid}, hihi!', 'Boop!'],
    wake: ['I\'m awake! I\'m awake!', 'Huh?! What?!', 'I wasn\'t sleeping!'],
    sleepy: ['*yawn*', 'So... sleepy...', 'Just a little nap...'],
    dance: ['Dance party!', 'Look at my moves!', 'Boogie time!'],
    landed: ['Ta-daa!', 'Nailed it!', 'Ten points!'],
    newClothes: ['Ooh, fancy!', 'How do I look?', 'I love it!', 'So stylish!', 'Very nisse-ish!'],
  };

  B.sleepsUntilChristmas = function () {
    const now = new Date();
    let eve = new Date(now.getFullYear(), 11, 24);
    if (now > new Date(now.getFullYear(), 11, 26)) eve = new Date(now.getFullYear() + 1, 11, 24);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((eve - today) / 86400000));
  };

  B.phrase = function (kind) {
    const list = B.phrases[kind] || [kind];
    let s = B.pick(list);
    const sleeps = B.sleepsUntilChristmas();
    if (s.includes('{sleeps}') && sleeps === 0) s = 'It\'s CHRISTMAS EVE!!!';
    return s.replace(/{kid}/g, B.config.kidName).replace(/{name}/g, B.config.name).replace(/{sleeps}/g, sleeps);
  };
})(window.Buddy);
