const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { update, installed, blobHash, validFile } = require('../desktop/updater.cjs');
(async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'street-updater-'));
  const sha = 'a'.repeat(40);
  const contents = { 'web/index.html': '<html>game</html>', 'web/game.js': 'const game = true;', 'web/renderer3d.js': 'const renderer = true;' };
  const entries = Object.entries(contents).map(([name, content]) => ({ path: name, type: 'blob', mode: '100644', sha: blobHash(Buffer.from(content)), size: Buffer.byteLength(content) }));
  const response = object => ({ ok: true, json: async () => object });
  const fetcher = async url => {
    if (url.includes('/commits/')) return response({ sha });
    if (url.includes('/git/trees/')) return response({ tree: entries, truncated: false });
    const name = url.slice(url.indexOf('/web/') + 1);
    return { ok: true, arrayBuffer: async () => Buffer.from(contents[name]) };
  };
  try {
    assert.equal(await installed(folder), null);
    const result = await update(folder, () => {}, fetcher);
    assert.equal(result.sha, sha);
    assert.equal((await installed(folder)).sha, sha);
    assert.equal((await update(folder, () => {}, fetcher)).sha, sha);
    assert.equal(validFile({ ...entries[0], path: 'web/../escape.js' }), false);
    assert.equal(validFile({ ...entries[0], mode: '120000' }), false);
    const corrupt = async url => url.includes('/commits/') ? response({ sha: 'b'.repeat(40) }) : url.includes('/git/trees/') ? response({ tree: entries, truncated: false }) : { ok: true, arrayBuffer: async () => Buffer.from('broken') };
    await assert.rejects(update(folder, () => {}, corrupt), /Kontrola/);
    assert.equal((await installed(folder)).sha, sha);
    await assert.rejects(update(folder, () => {}, async () => { throw Error('offline'); }), /offline/);
    assert.equal((await installed(folder)).sha, sha);
    await fs.writeFile(path.join(result.root, 'game.js'), 'tampered');
    assert.equal(await installed(folder), null);
    console.log('PASS: updater install, current version, paths/symlinks, integrity, failed update preserves previous version, offline and tampered cache');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
