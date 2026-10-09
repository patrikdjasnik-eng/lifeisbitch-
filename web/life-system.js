'use strict';
const lifeSystem = (() => {
  const packages = {
    housing: { name: 'Domov', features: ['room'] },
    finance: { name: 'Finance', features: ['largeLoan', 'mobileBank'] },
    social: { name: 'Kontakty', features: ['extraContacts'] },
    premium: { name: 'Premium', features: ['room', 'largeLoan', 'mobileBank', 'extraContacts'] }
  };
  const products = [
    { id: 'bread', name: 'Chléb a sýr', price: 60, health: 10 },
    { id: 'water', name: 'Voda', price: 25, health: 5 },
    { id: 'medicine', name: 'Lékárnička', price: 180, health: 35 }
  ];
  function create() {
    return { day: 1, elapsed: 0, account: false, balance: 0, loan: null, rental: null, bills: [], messages: [{ from: 'Viktor', text: 'Stav se před Neonem. Mám pro tebe práci.', day: 1 }], sentDay: 0 };
  }
  const has = (feature, entitlements = []) => entitlements.some(id => packages[id]?.features.includes(feature));
  const validAmount = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000;
  function message(state, from, text) {
    state.messages.push({ from, text, day: state.day });
    state.messages = state.messages.slice(-80);
  }
  function nextDay(state) {
    state.day++;
    if (state.rental && state.rental.until <= state.day) state.rental = null;
    if (state.day % 3 === 0) {
      state.bills.push({ id: 'phone-' + state.day, name: 'Telefonní tarif', amount: 80, due: state.day + 2 });
      message(state, 'Operátor', 'Nový účet: 80 Kč. Splatnost den ' + (state.day + 2) + '.');
    }
    if (state.loan && state.loan.due < state.day && !state.loan.overdue) {
      state.loan.overdue = true;
      message(state, 'Banka', 'Půjčka je po splatnosti. Další úvěr získáš po jejím uhrazení.');
    }
  }
  function act(state, player, action, value, entitlements = []) {
    if (action === 'account') {
      if (state.account) return false;
      state.account = true;
      message(state, 'Banka', 'Účet je otevřený. Vklady a výběry jsou bez poplatku.');
    } else if (action === 'deposit' || action === 'withdraw') {
      if (!state.account || !validAmount(value)) return false;
      if (action === 'deposit') {
        if (player.cash < value || state.balance + value > 1000000) return false;
        player.cash -= value; state.balance += value;
      } else {
        if (state.balance < value || player.cash + value > 1000000) return false;
        state.balance -= value; player.cash += value;
      }
    } else if (action === 'loan') {
      if (!state.account || state.loan || ![1000, 5000].includes(value) || (value === 5000 && !has('largeLoan', entitlements)) || player.cash + value > 1000000) return false;
      state.loan = { principal: value, remaining: value + Math.ceil(value * .1), due: state.day + 7, overdue: false };
      player.cash += value;
      message(state, 'Banka', 'Úvěr ' + value + ' Kč. Celkem splatíš ' + state.loan.remaining + ' Kč do dne ' + state.loan.due + '.');
    } else if (action === 'repay') {
      if (!state.loan || !validAmount(value) || value > state.loan.remaining || player.cash < value) return false;
      player.cash -= value; state.loan.remaining -= value;
      if (!state.loan.remaining) state.loan = null;
    } else if (action === 'rent') {
      if (state.rental || !['bed', 'room'].includes(value) || (value === 'room' && !has('room', entitlements))) return false;
      const price = value === 'bed' ? 150 : 450;
      if (player.cash < price) return false;
      player.cash -= price; state.rental = { type: value, until: state.day + 1, slept: false };
    } else if (action === 'sleep') {
      if (!state.rental || state.rental.slept) return false;
      state.rental.slept = true; player.health = Math.min(100, player.health + 40); state.elapsed = 0; nextDay(state);
    } else if (action === 'buy') {
      const item = products.find(product => product.id === value);
      if (!item || player.cash < item.price) return false;
      player.cash -= item.price; player.health = Math.min(100, player.health + item.health);
    } else if (action === 'bill') {
      const index = state.bills.findIndex(bill => bill.id === value);
      if (index < 0 || player.cash < state.bills[index].amount) return false;
      player.cash -= state.bills[index].amount; state.bills.splice(index, 1);
    } else if (action === 'sms') {
      const contacts = ['Viktor', 'Eliška', ...(has('extraContacts', entitlements) ? ['Pavel', 'Správce'] : [])];
      if (!contacts.includes(value) || state.sentDay === state.day || player.cash < 5) return false;
      player.cash -= 5; state.sentDay = state.day;
      message(state, 'Já → ' + value, 'Ahoj, jak to jde?');
      message(state, value, value === 'Viktor' ? 'Práce je dost. Sleduj svoje zakázky přes J.' : value === 'Eliška' ? 'Dávej na sebe pozor. A nezapomeň platit účty.' : 'Ozvu se, až bude něco nového.');
    } else return false;
    return true;
  }
  function restore(value) {
    if (!value || typeof value !== 'object') return create();
    const n = number => Number.isSafeInteger(number) && number >= 0 && number <= 1000000;
    if (!n(value.day) || value.day < 1 || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed >= 300 || typeof value.account !== 'boolean' || !n(value.balance) || !n(value.sentDay)) return create();
    if (value.loan !== null && (!value.loan || ![1000, 5000].includes(value.loan.principal) || !n(value.loan.remaining) || value.loan.remaining < 1 || value.loan.remaining > value.loan.principal * 1.1 || !n(value.loan.due) || typeof value.loan.overdue !== 'boolean')) return create();
    if (value.rental !== null && (!value.rental || !['bed', 'room'].includes(value.rental.type) || !n(value.rental.until) || typeof value.rental.slept !== 'boolean')) return create();
    if (!Array.isArray(value.bills) || value.bills.length > 10000 || value.bills.some(bill => !bill || bill.id !== 'phone-' + (bill.due - 2) || bill.name !== 'Telefonní tarif' || bill.amount !== 80 || !n(bill.due)) || new Set(value.bills.map(bill => bill.id)).size !== value.bills.length) return create();
    if (!Array.isArray(value.messages) || value.messages.length > 80 || value.messages.some(item => !item || typeof item.from !== 'string' || item.from.length > 40 || typeof item.text !== 'string' || item.text.length > 300 || !n(item.day))) return create();
    return JSON.parse(JSON.stringify(value));
  }
  return { create, act, restore, nextDay, packages, products, has };
})();
if (typeof module !== 'undefined') module.exports = lifeSystem;
