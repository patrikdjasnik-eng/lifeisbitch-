'use strict';
const play = document.getElementById('play');
const check = document.getElementById('check');
window.launcher.onStatus(state => {
  document.getElementById('status').textContent = state.text;
  document.getElementById('progress').value = state.progress;
  play.disabled = state.busy; check.disabled = state.busy;
  if (state.version) document.getElementById('version').textContent = 'VERZE ' + state.version + ' · BETONOVÉ SNY';
});
check.onclick = () => window.launcher.check().catch(error => { document.getElementById('status').textContent = error.message; });
play.onclick = () => window.launcher.play().catch(error => { document.getElementById('status').textContent = error.message; });
