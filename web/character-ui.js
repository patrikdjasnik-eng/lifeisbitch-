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
    input.disabled = Boolean(character);
    startButton.textContent = character ? 'POKRAČOVAT V NOCI ↗' : 'VYTVOŘIT POSTAVU A HRÁT ↗';
  }
  startButton.onclick = event => {
    if (!character) {
      try {
        const created = characterSystem.create(input.value, window.crypto);
        localStorage.setItem(storageKey, JSON.stringify(created));
        character = created;
      } catch (cause) {
        error.textContent = cause.message || 'Postavu se nepodařilo uložit.';
        input.focus();
        return;
      }
    }
    error.textContent = '';
    showIdentity();
    originalStart(event);
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
  showIdentity();
})();
