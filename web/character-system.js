'use strict';
const characterSystem = (() => {
  const normalizeName = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
  const validName = value => {
    const name = normalizeName(value);
    return name.length >= 3 && name.length <= 24 && /^[\p{L}\p{N} _'-]+$/u.test(name);
  };
  function restore(value) {
    if (!value || !validName(value.name) || typeof value.id !== 'string' || !/^LIB-[a-f0-9]{32}$/i.test(value.id)) return null;
    return { name: normalizeName(value.name), id: value.id };
  }
  function create(name, cryptoApi) {
    if (!validName(name)) throw new Error('Jméno musí mít 3–24 znaků: písmena, čísla, mezery, pomlčku nebo apostrof.');
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return { name: normalizeName(name), id: 'LIB-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
  }
  return { normalizeName, validName, restore, create };
})();
if (typeof module !== 'undefined') module.exports = characterSystem;
