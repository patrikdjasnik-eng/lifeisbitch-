'use strict';
(() => {
  const menu = document.querySelector('#menu .intro');
  const accountButton = document.createElement('button');
  accountButton.id = 'accountButton';
  accountButton.textContent = 'ÚČET · PŘIHLÁŠENÍ / REGISTRACE';
  menu.insertBefore(accountButton, document.getElementById('start'));
  const overlay = document.createElement('div');
  overlay.className = 'overlay hidden';
  overlay.id = 'accountOverlay';
  overlay.innerHTML = `<form class="accountPanel">
    <div class="eyebrow">RABBITHOLLOW CODE STUDIO™</div>
    <h2>Tvůj účet. Tvoje ulice.</h2>
    <p>Bez e-mailu a osobních údajů. Účet chrání heslo a obnovovací kód.</p>
    <div class="accountTabs"><button type="button" data-mode="login">Přihlášení</button><button type="button" data-mode="register">Nový účet</button><button type="button" data-mode="recover">Obnova</button></div>
    <label for="accountUsername">Přihlašovací jméno</label><input id="accountUsername" autocomplete="username" minlength="3" maxlength="24" required placeholder="např. zizkov_rabbit">
    <label for="accountPassword">Heslo</label><div class="passwordField"><input id="accountPassword" type="password" autocomplete="current-password" minlength="10" maxlength="128" required><button type="button" id="showPassword" aria-label="Zobrazit heslo">Ukázat</button></div>
    <div id="confirmField" hidden><label for="accountConfirm">Heslo znovu</label><input id="accountConfirm" type="password" autocomplete="new-password" maxlength="128"></div>
    <div id="recoveryField" hidden><label for="accountRecovery">Obnovovací kód</label><input id="accountRecovery" autocomplete="off" maxlength="48"></div>
    <p id="accountStatus" role="status" aria-live="polite"></p>
    <div id="recoveryResult" hidden><p>Ulož si tento kód. Bez e-mailu je to jediná možnost obnovy hesla. Po použití se změní.</p><code id="recoveryCode"></code><label><input id="recoverySaved" type="checkbox"> Mám kód bezpečně uložený</label></div>
    <button id="accountSubmit" type="submit">Přihlásit se</button>
    <button id="accountLogout" type="button" hidden>Odhlásit účet</button>
    <button id="accountClose" type="button">Zpět do hry / offline</button>
  </form>`;
  document.body.append(overlay);
  const byId = id => document.getElementById(id);
  let mode = 'login', busy = false;
  let session = null;
  try { session = sessionStorage.getItem('street-life-account-session'); } catch {}
  function status(message) { byId('accountStatus').textContent = message; }
  function setMode(value) {
    if (busy || !byId('recoveryResult').hidden) return;
    mode = value;
    byId('confirmField').hidden = mode === 'login';
    byId('recoveryField').hidden = mode !== 'recover';
    byId('accountPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    byId('accountSubmit').textContent = mode === 'register' ? 'Vytvořit účet' : mode === 'recover' ? 'Nastavit nové heslo' : 'Přihlásit se';
    overlay.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    status('');
  }
  function close() {
    if (busy) return;
    if (!byId('recoveryResult').hidden && !byId('recoverySaved').checked) {
      status('Nejdřív potvrď, že máš obnovovací kód uložený.');
      return;
    }
    overlay.classList.add('hidden');
    byId('accountPassword').value = '';
    byId('accountConfirm').value = '';
    byId('accountRecovery').value = '';
    byId('recoveryCode').textContent = '';
    byId('recoveryResult').hidden = true;
    byId('recoverySaved').checked = false;
    byId('accountSubmit').hidden = false;
  }
  accountButton.onclick = () => {
    overlay.classList.remove('hidden');
    byId('accountLogout').hidden = !session;
    status(window.gameAccounts ? '' : 'Účty jsou dostupné v aktualizované desktop aplikaci. Web můžeš hrát offline.');
    byId('accountUsername').focus();
  };
  overlay.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode));
  byId('accountClose').onclick = close;
  byId('showPassword').onclick = () => {
    const field = byId('accountPassword');
    field.type = field.type === 'password' ? 'text' : 'password';
    byId('showPassword').textContent = field.type === 'password' ? 'Ukázat' : 'Skrýt';
  };
  byId('accountLogout').onclick = async () => {
    if (busy || !session || !window.gameAccounts) return;
    const result = await window.gameAccounts.request('logout', { session });
    if (!result.ok) { status(result.error); return; }
    session = null;
    try { sessionStorage.removeItem('street-life-account-session'); } catch {}
    accountButton.textContent = 'ÚČET · PŘIHLÁŠENÍ / REGISTRACE';
    byId('accountLogout').hidden = true;
    status('Odhlášeno. Lokální postava zůstává pro offline hraní.');
  };
  overlay.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    if (!window.gameAccounts) { status('Pro přihlášení spusť aktuální desktop aplikaci.'); return; }
    const username = byId('accountUsername').value.trim();
    const password = byId('accountPassword').value;
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) { status('Přihlašovací jméno: 3–24 znaků, bez diakritiky, mezery a speciálních znaků. Jméno postavy může mít 40 znaků.'); return; }
    if (password.length < 10 || password.length > 128) { status('Heslo musí mít 10–128 znaků.'); return; }
    if (mode !== 'login' && password !== byId('accountConfirm').value) { status('Hesla se neshodují.'); return; }
    busy = true; byId('accountSubmit').disabled = true; status('Spojuji se se serverem…');
    try {
      let payload = { username, password };
      if (mode === 'register') {
        const name = byId('characterName').value;
        if (!characterSystem.validName(name)) throw Error('Nejdřív vyplň platné jméno postavy v úvodním menu.');
        const saved = characterSystem.restore(JSON.parse(localStorage.getItem('street-life-character-v1')));
        const character = saved ? { ...saved, name: characterSystem.normalizeName(name) } : characterSystem.create(name, window.crypto);
        let token = localStorage.getItem('street-life-registry-token-v1');
        if (!/^[a-f0-9]{64}$/.test(token || '')) token = Array.from(window.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('street-life-character-v1', JSON.stringify(character));
        localStorage.setItem('street-life-registry-token-v1', token);
        window.dispatchEvent(new CustomEvent('character:updated', { detail: character }));
        const registered = await window.playerRegistry.register({ ...character, token });
        if (!registered.registered) throw Error('Server registrace není dostupný nebo postavu nelze připojit.');
        payload = { ...payload, ...character, token };
      }
      if (mode === 'recover') payload.recovery = byId('accountRecovery').value.trim();
      const result = await window.gameAccounts.request(mode, payload);
      if (!result.ok) throw Error(result.error || 'Akce se nezdařila.');
      if (result.profile) {
        const previous = characterSystem.restore(JSON.parse(localStorage.getItem('street-life-character-v1')));
        if (previous && previous.id !== result.profile.id) {
          if (!window.confirm('Tento účet má jinou postavu. Přepnutí smaže místní postup současné postavy na tomto zařízení. Pokračovat?')) {
            await window.gameAccounts.request('logout', { session: result.session });
            throw Error('Přepnutí účtu zrušeno.');
          }
          localStorage.removeItem('street-life-progress-v1');
        }
        localStorage.setItem('street-life-character-v1', JSON.stringify({ id: result.profile.id, name: result.profile.name }));
        if (result.registryToken) localStorage.setItem('street-life-registry-token-v1', result.registryToken);
        session = result.session;
        sessionStorage.setItem('street-life-account-session', session);
        accountButton.textContent = 'ÚČET · ' + result.profile.username;
        byId('accountLogout').hidden = false;
        window.dispatchEvent(new CustomEvent('character:updated', { detail: result.profile }));
        if (previous && previous.id !== result.profile.id) { location.reload(); return; }
      }
      byId('accountPassword').value = ''; byId('accountConfirm').value = '';
      if (result.recovery) {
        byId('recoveryCode').textContent = result.recovery;
        byId('recoveryResult').hidden = false;
        byId('accountSubmit').hidden = true;
        status(mode === 'recover' ? 'Heslo obnoveno. Ulož nový kód a potom se přihlas.' : 'Účet vytvořen. Ulož si obnovovací kód.');
      } else status('Přihlášení úspěšné. Můžeš pokračovat do hry.');
    } catch (error) { status(error.message || 'Akce se nezdařila.'); }
    finally { busy = false; byId('accountSubmit').disabled = false; }
  };
  setMode('login');
  if (session && window.gameAccounts) {
    window.gameAccounts.request('session', { session }).then(result => {
      if (result.ok) accountButton.textContent = 'ÚČET · ' + result.profile.username;
      else { session = null; sessionStorage.removeItem('street-life-account-session'); }
    }).catch(() => {});
  }
})();
