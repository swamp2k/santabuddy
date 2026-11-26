// Builds dist/Nisse-win-x64.zip: Electron renamed to Nisse.exe with the app in
// resources/app. That zip goes on a GitHub Release of swamp2k/santabuddy, where
// pcwatch's installer downloads it from (releases/latest/download/...).
//   npm run package
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(dist, 'Nisse');
const zip = path.join(dist, 'Nisse-win-x64.zip');
const electron = path.join(root, 'node_modules', 'electron', 'dist');

if (!fs.existsSync(path.join(electron, 'electron.exe'))) {
  console.error('node_modules/electron is missing: run npm install first');
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(electron, out, { recursive: true });
fs.renameSync(path.join(out, 'electron.exe'), path.join(out, 'Nisse.exe'));
fs.rmSync(path.join(out, 'resources', 'default_app.asar'), { force: true });

const app = path.join(out, 'resources', 'app');
fs.mkdirSync(app, { recursive: true });
for (const f of ['main.js', 'preload.js']) fs.copyFileSync(path.join(root, f), path.join(app, f));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
  name: pkg.name, productName: 'Nisse', version: pkg.version, description: pkg.description, main: pkg.main, private: true,
}, null, 2));
// the renderer, minus local test tricks (_something.js)
fs.cpSync(path.join(root, 'renderer'), path.join(app, 'renderer'), {
  recursive: true,
  filter: (src) => !/[\\/]tricks[\\/]_[^\\/]*$/.test(src),
});

// Windows' own tar writes a normal zip that Expand-Archive can open
const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-a', '-c', '-f', zip, '-C', out, '.'], { stdio: 'inherit' });
console.log(`${path.relative(root, zip)}  ${(fs.statSync(zip).size / 1e6).toFixed(1)} MB  (version ${pkg.version})`);
