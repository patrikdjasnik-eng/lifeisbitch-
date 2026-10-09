const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = 'patrikdjasnik-eng/lifeisbitch-';
const shaPattern = /^[a-f0-9]{40}$/;
function blobHash(bytes) {
  return crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
}
function validFile(entry) {
  return entry.type === 'blob' && entry.mode === '100644' && /^web\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(entry.path) && !entry.path.split('/').includes('..') && shaPattern.test(entry.sha) && Number.isSafeInteger(entry.size) && entry.size >= 0 && entry.size <= 8000000;
}
async function request(url, fetcher = fetch) {
  const response = await fetcher(url, { headers: { 'User-Agent': 'Street-Life-Launcher', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw Error('Server aktualizací: ' + response.status);
  return response;
}
async function installed(folder) {
  try {
    const marker = JSON.parse(await fs.readFile(path.join(folder, 'current.json'), 'utf8'));
    if (!shaPattern.test(marker.sha) || !Array.isArray(marker.files) || marker.files.length > 250 || !marker.files.every(validFile)) return null;
    const root = path.join(folder, marker.sha, 'web');
    for (const entry of marker.files) {
      const bytes = await fs.readFile(path.join(folder, marker.sha, entry.path));
      if (blobHash(bytes) !== entry.sha) return null;
    }
    if (!marker.files.some(entry => entry.path === 'web/index.html')) return null;
    return { sha: marker.sha, root };
  } catch { return null; }
}
async function update(folder, report = () => {}, fetcher = fetch) {
  const current = await installed(folder);
  report('Kontroluji aktualizace…', 0);
  const head = await (await request('https://api.github.com/repos/' + repo + '/commits/main', fetcher)).json();
  if (!shaPattern.test(head.sha)) throw Error('Neplatná verze aktualizace.');
  if (head.sha === current?.sha) { report('Máš aktuální verzi.', 100); return current; }
  const tree = await (await request('https://api.github.com/repos/' + repo + '/git/trees/' + head.sha + '?recursive=1', fetcher)).json();
  if (tree.truncated || !Array.isArray(tree.tree)) throw Error('Neúplný seznam souborů.');
  const files = tree.tree.filter(entry => entry.path.startsWith('web/') && entry.type !== 'tree');
  if (!files.length || files.length > 250 || !files.every(validFile) || files.reduce((sum, entry) => sum + entry.size, 0) > 25000000 || !['web/index.html', 'web/game.js', 'web/renderer3d.js'].every(name => files.some(entry => entry.path === name))) throw Error('Neplatný herní balíček.');
  const staging = path.join(folder, head.sha + '.staging');
  await fs.rm(staging, { recursive: true, force: true });
  try {
    for (let index = 0; index < files.length; index++) {
      const entry = files[index];
      report('Stahuji ' + entry.path.slice(4), Math.round(index / files.length * 100));
      const response = await request('https://raw.githubusercontent.com/' + repo + '/' + head.sha + '/' + entry.path, fetcher);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== entry.size || blobHash(bytes) !== entry.sha) throw Error('Kontrola souboru selhala: ' + entry.path);
      const target = path.join(staging, entry.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    }
    const target = path.join(folder, head.sha);
    await fs.rm(target, { recursive: true, force: true });
    await fs.rename(staging, target);
    const marker = path.join(folder, 'current.json');
    await fs.writeFile(marker + '.tmp', JSON.stringify({ sha: head.sha, files }));
    await fs.rename(marker + '.tmp', marker);
    report('Aktualizace připravená. Můžeš hrát.', 100);
    return { sha: head.sha, root: path.join(target, 'web') };
  } catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
}
module.exports = { update, installed, validFile, blobHash };
