'use strict';
(() => {
  const actions = document.createElement('div');
  actions.id = 'mobileSettings';
  for (const [label, action] of [
    ['Soukromí', () => {
      const panel = document.getElementById('mobilePrivacy');
      panel.hidden = false;
      keys.clear();
      if (started && !paused && !dialogOpen) document.getElementById('pause').click();
    }],
    ['Smazat místní data', () => {
      if (!confirm('Smazat postavu, ID a celý uložený postup na tomto zařízení? Tuto akci nelze vrátit.')) return;
      try {
        for (const key of ['street-life-progress-v1', 'street-life-character-v1', 'street-life-registry-token-v1']) localStorage.removeItem(key);
        sessionStorage.removeItem('street-life-account-session');
        location.reload();
      } catch { alert('Data se nepodařilo smazat. Použij nastavení Androidu → Aplikace → Úložiště → Vymazat data.'); }
    }]
  ]) {
    const button = document.createElement('button');
    button.textContent = label; button.onclick = action; actions.append(button);
  }
  document.querySelector('#menu .intro').append(actions);
  const privacy = document.createElement('section');
  privacy.id = 'mobilePrivacy'; privacy.hidden = true;
  privacy.innerHTML = '<h2>Soukromí · Android beta</h2><p>Rabbithollow Code Studio™</p><p>Tato beta funguje offline. Jméno postavy, náhodné ID a postup se ukládají pouze do úložiště aplikace na tomto zařízení. Neodesíláme je na server.</p><p>Aplikace neobsahuje reklamy, analytiku, platby ani přihlášení k online účtu. Nemá oprávnění k internetu, kontaktům, poloze, mikrofonu ani fotoaparátu.</p><p>Data můžeš smazat v úvodním menu, nastavení Androidu nebo odinstalováním aplikace. Zálohování aplikace je vypnuté.</p><p>Údaje jsou platné pro offline Android betu 0.1.6, nikoliv desktop verzi s účty. Před veřejným vydáním doplníme ověřený kontakt provozovatele a veřejnou adresu těchto zásad.</p>';
  const close = document.createElement('button'); close.textContent = 'Zavřít'; close.onclick = () => { privacy.hidden = true; };
  privacy.append(close); document.body.append(privacy);
  const intro = document.querySelector('.intro .tagline');
  if (intro) intro.textContent = 'Android beta · hraješ offline na tomto zařízení';
  const controls = document.querySelector('.touch');
  for (const [text, delta] of [['−', 140], ['+', -140]]) {
    const button = document.createElement('button'); button.textContent = text;
    button.setAttribute('aria-label', delta > 0 ? 'Oddálit kameru' : 'Přiblížit kameru');
    button.onclick = () => { if (started && !paused && !dialogOpen) viewZoom = changeZoom(viewZoom, delta, .65, 2.2); };
    controls.append(button);
  }
  document.addEventListener('visibilitychange', () => { keys.clear(); });
})();
