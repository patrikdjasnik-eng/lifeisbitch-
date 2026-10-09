'use strict';
(() => {
  const storageKey = 'street-life-character-v1';
  let character = null;
  try { character = characterSystem.restore(JSON.parse(localStorage.getItem(storageKey))); } catch {}
  const input = document.getElementById('characterName');
  const error = document.getElementById('characterError');
  const identity = document.getElementById('characterIdentity');
  const startButton = document.getElementById('start');
  const originalStart = startButton.onclick;
  function showIdentity() {
    identity.textContent = character ? character.name + ' · ' + character.id : 'Vytvoř si postavu';
    input.value = character?.name || '';
    input.disabled = false;
    startButton.textContent = character ? 'POKRAČOVAT V NOCI ↗' : 'VYTVOŘIT POSTAVU A HRÁT ↗';
  }
  startButton.onclick = event => {
    try {
      if (!characterSystem.validName(input.value)) throw new Error('Jméno musí mít 3–40 znaků: písmena, čísla, mezery, pomlčku nebo apostrof.');
      const updated = character ? { ...character, name: characterSystem.normalizeName(input.value) } : characterSystem.create(input.value, window.crypto);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      character = updated;
    } catch (cause) {
      error.textContent = cause.message || 'Postavu se nepodařilo uložit.';
      input.focus();
      return;
    }
    error.textContent = '';
    showIdentity();
    originalStart(event);
    if (window.playerRegistry) {
      try {
        let token = localStorage.getItem('street-life-registry-token-v1');
        if (!/^[a-f0-9]{64}$/.test(token || '')) {
          const bytes = window.crypto.getRandomValues(new Uint8Array(32));
          token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
          localStorage.setItem('street-life-registry-token-v1', token);
        }
        window.playerRegistry.register({ ...character, token }).then(result => {
          identity.textContent = character.name + ' · ' + character.id + (result.registered ? ' · registrováno na serveru' : ' · offline registrace');
        }).catch(() => {});
      } catch {}
    }
  };
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); startButton.click(); }
  });
  const board = document.getElementById('scoreboard');
  function closeBoard() { board.classList.add('hidden'); dialogOpen = false; keys.clear(); }
  function openBoard() {
    if (!started || paused || dialogOpen || !character) return;
    keys.clear();
    dialogOpen = true;
    const row = document.getElementById('scoreboardRow');
    row.replaceChildren();
    for (const value of [character.name, character.id, playerLevel(), player.xp, player.rep, player.cash.toLocaleString('cs-CZ') + ' Kč']) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    board.classList.remove('hidden');
  }
  document.getElementById('scoreboardButton').onclick = openBoard;
  document.getElementById('closeScoreboard').onclick = closeBoard;
  window.addEventListener('keydown', event => {
    if (event.target?.matches?.('input, textarea, select')) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      if (!event.repeat) board.classList.contains('hidden') ? openBoard() : closeBoard();
    }
    if (event.key === 'Escape' && !board.classList.contains('hidden')) {
      event.preventDefault(); event.stopImmediatePropagation(); closeBoard();
    }
  }, true);
  window.addEventListener('character:updated', event => {
    const updated = characterSystem.restore(event.detail);
    if (updated) { character = updated; showIdentity(); }
  });
  showIdentity();
})();
