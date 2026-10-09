'use strict';
(() => {
  const tracks = window.streetRadioTracks || [];
  if (!tracks.length) return;
  const packs = { oldschool: 'OLD SCHOOL · Temné beaty', cloud: 'CLOUD TRAP · Noční Praha' };
  const storageKey = 'street-life-radio-v1';
  let settings = { enabled: true, volume: 0.25, index: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved) settings = {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
      volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.25,
      index: Number.isInteger(saved.index) && saved.index >= 0 && saved.index < tracks.length ? saved.index : 0
    };
  } catch {}
  const music = new Audio();
  music.preload = 'none';
  music.volume = settings.volume;
  let playing = false;
  let pending = false;
  const packTracks = () => tracks.map((t, i) => i).filter(i => tracks[i].pack === tracks[settings.index].pack);
  const adjacent = direction => { const list = packTracks(); return list[(list.indexOf(settings.index) + direction + list.length) % list.length]; };
  let playRequest = 0;
  let failedTracks = new Set();
  let errorText = '';
  let focusBeforeRadio = null;

  const panel = document.createElement('div');
  panel.id = 'radioOverlay';
  panel.className = 'overlay hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'radioTitle');
  panel.innerHTML = `<div class="dialogBox radioPanel">
    <div class="eyebrow">STREET LIFE / UNDERGROUND RADIO</div>
    <h2 id="radioTitle">Zvuk ulice</h2>
    <p id="radioTrack" aria-live="polite"></p>
    <p id="radioStatus" role="status"></p>
    <div class="radioTransport"><button id="radioPrevious" aria-label="Předchozí skladba">← Zpět</button><button id="radioToggle">Přehrát</button><button id="radioNext" aria-label="Další skladba">Další →</button></div>
    <label for="radioVolume">HLASITOST <output id="radioVolumeValue"></output></label>
    <input id="radioVolume" type="range" min="0" max="100" step="1">
    <label for="radioPack">STANICE</label><select id="radioPack"></select>
    <label for="radioSelect">SKLADBA</label><select id="radioSelect"></select>
    <p class="radioCredits">Skladby jsou součástí hry a hrají offline. Oldschool: Holizna a Gichco (CC0). Cloud trap: vlastní aranžmá s CC0 melodiemi Holizna. Hudbu zapne první kliknutí na hraní; mimo aktivní okno se pozastaví.</p>
    <button id="radioClose">Zpět do hry · Esc</button>
  </div>`;
  document.body.append(panel);
  const byId = id => document.getElementById(id);
  const headerButton = document.createElement('button');
  headerButton.id = 'radioButton';
  headerButton.textContent = '♪ RÁDIO';
  headerButton.setAttribute('aria-label', 'Otevřít herní rádio');
  document.querySelector('.stats').append(headerButton);
  const menuButton = document.createElement('button');
  menuButton.id = 'menuRadio';
  menuButton.textContent = '♪ HUDBA · UNDERGROUND RADIO';
  document.querySelector('#menu .intro').append(menuButton);
  for (const [id, title] of Object.entries(packs)) {
    const option = document.createElement('option');
    option.value = id; option.textContent = title;
    byId('radioPack').append(option);
  }
  function updatePlaylist() {
    byId('radioSelect').replaceChildren();
    for (const index of packTracks()) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = tracks[index].artist + ' — ' + tracks[index].title;
      byId('radioSelect').append(option);
    }
  }
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch {} };
  function refresh() {
    const track = tracks[settings.index];
    byId('radioTrack').textContent = track.artist + ' — ' + track.title;
    byId('radioStatus').textContent = errorText || (playing ? 'HRAJE · ' : settings.enabled ? 'PŘIPRAVENO · ' : 'VYPNUTO · ') + (packTracks().indexOf(settings.index) + 1) + '/' + packTracks().length + ' · ' + track.rights;
    byId('radioToggle').textContent = playing || pending ? 'Vypnout hudbu' : 'Přehrát';
    byId('radioPack').value = track.pack;
    byId('radioSelect').value = String(settings.index);
    byId('radioVolume').value = String(Math.round(settings.volume * 100));
    byId('radioVolumeValue').textContent = Math.round(settings.volume * 100) + ' %';
    byId('sound').textContent = playing ? '♪ ' + track.artist : '♪ HUDBA';
    headerButton.title = (playing ? 'Hraje: ' : 'Rádio: ') + track.title;
  }
  function stop() {
    playRequest++;
    pending = false;
    music.pause();
    playing = false;
    refresh();
  }
  async function play() {
    if (!settings.enabled || document.hidden) return;
    const request = ++playRequest;
    pending = true;
    refresh();
    const source = new URL(tracks[settings.index].file, document.baseURI).href;
    if (music.src !== source) music.src = source;
    try {
      await music.play();
      if (request !== playRequest) return;
      if (!settings.enabled || document.hidden) { stop(); return; }
      pending = false;
      playing = true;
      errorText = '';
      failedTracks.clear();
      refresh();
    } catch (error) {
      if (request !== playRequest) return;
      pending = false;
      playing = false;
      errorText = error.name === 'NotAllowedError' ? 'Pro zapnutí hudby stiskni Přehrát.' : 'Skladbu nelze přehrát. Zkus jinou skladbu.';
      refresh();
    }
  }
  function select(index, enable = false) {
    stop();
    if (!Number.isInteger(index) || index < 0 || index >= tracks.length) return;
    settings.index = index;
    updatePlaylist();
    if (enable) settings.enabled = true;
    errorText = '';
    save(); refresh();
    if (settings.enabled) void play();
  }
  function close() {
    panel.classList.add('hidden');
    dialogOpen = false;
    keys.clear();
    focusBeforeRadio?.focus?.();
  }
  function open() {
    if (dialogOpen) return;
    focusBeforeRadio = document.activeElement;
    dialogOpen = true;
    keys.clear();
    refresh();
    panel.classList.remove('hidden');
    byId('radioToggle').focus();
  }
  headerButton.onclick = menuButton.onclick = byId('sound').onclick = open;
  byId('radioClose').onclick = close;
  byId('radioToggle').onclick = () => {
    if (playing || pending) { settings.enabled = false; errorText = ''; stop(); }
    else { settings.enabled = true; failedTracks.clear(); void play(); }
    save(); refresh();
  };
  byId('radioPrevious').onclick = () => select(adjacent(-1), true);
  byId('radioNext').onclick = () => select(adjacent(1), true);
  byId('radioPack').onchange = event => { failedTracks.clear(); select(tracks.findIndex(t => t.pack === event.target.value), true); };
  byId('radioSelect').onchange = event => select(Number(event.target.value), true);
  byId('radioVolume').oninput = event => {
    settings.volume = Math.max(0, Math.min(1, Number(event.target.value) / 100));
    music.volume = settings.volume;
    save(); refresh();
  };
  music.addEventListener('ended', () => select(adjacent(1)));
  music.addEventListener('error', () => {
    failedTracks.add(settings.index);
    const next = packTracks().find(i => !failedTracks.has(i));
    if (settings.enabled && next !== undefined) select(next);
    else { stop(); errorText = 'Hudební soubory nejsou dostupné. Hra může pokračovat bez hudby.'; refresh(); }
  });
  byId('start').addEventListener('click', () => {
    if (started && !paused && settings.enabled && !playing) void play();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (started && settings.enabled) void play();
  });
  window.addEventListener('blur', stop);
  window.addEventListener('focus', () => { if (started && settings.enabled) void play(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('keydown', event => {
    if (panel.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      event.stopImmediatePropagation();
      const controls = [...panel.querySelectorAll('button, input, select')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  updatePlaylist();
  refresh();
})();
