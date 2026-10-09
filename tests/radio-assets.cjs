const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.join(__dirname, '..', 'web');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'radio-tracks.js'), 'utf8'), context);
const tracks = context.window.streetRadioTracks;
assert.equal(tracks.filter(t => t.pack === 'oldschool').length, 4);
assert.equal(tracks.filter(t => t.pack === 'cloud').length, 3);
for (const track of tracks) {
  assert.match(track.file, /^audio\/[a-z-]+\.mp3$/);
  const bytes = fs.readFileSync(path.join(root, track.file));
  assert.equal(bytes.length, track.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), track.sha256);
  assert.ok(track.duration > 90);
  assert.ok(bytes.length < 8000000);
  assert.equal(bytes.subarray(0, 3).toString(), 'ID3');
}
const files = fs.readdirSync(root, { recursive: true }).map(f => path.join(root, f)).filter(f => fs.statSync(f).isFile());
assert.ok(files.length < 250);
assert.ok(files.reduce((size, file) => size + fs.statSync(file).size, 0) < 25000000);
console.log('PASS: seven offline tracks, both packs, hashes, durations and updater package limits');
