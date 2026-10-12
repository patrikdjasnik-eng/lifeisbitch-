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
  const assets = {
    EUR: { name: 'Euro', kind: 'fiat', base: 25.2, volatility: .035 },
    USD: { name: 'Americký dolar', kind: 'fiat', base: 23.1, volatility: .045 },
    PLN: { name: 'Polský zlotý', kind: 'fiat', base: 5.9, volatility: .04 },
    BETON: { name: 'BetonCoin', kind: 'shitcoin', base: 12, volatility: .62 }
  };
  const emptyPortfolio = () => Object.fromEntries(Object.keys(assets).map(id => [id, 0]));
  function create() {
    return { day: 1, elapsed: 0, account: false, balance: 0, loan: null, rental: null, bills: [], messages: [{ from: 'Viktor', text: 'Stav se před Neonem. Mám pro tebe práci.', day: 1 }], sentDay: 0, portfolio: emptyPortfolio(), business: { osvc: false, company: false, taxFiledDay: 0 }, properties: [] };
  }
  const has = (feature, entitlements = []) => entitlements.some(id => packages[id]?.features.includes(feature));
  const validAmount = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000;
  const safeName = value => typeof value === 'string' && value.length > 0 && value.length <= 80;
  function marketPrice(state, id) {
    const asset = assets[id];
    if (!asset) return 0;
    const wave = Math.sin((state.day * 11 + id.charCodeAt(0)) * .43) + Math.cos((state.day * 5 + id.charCodeAt(id.length - 1)) * .31) * .55;
    const shock = id === 'BETON' ? Math.sin(state.day * 1.7) * .35 + ((state.day % 7) - 3) * .06 : 0;
    return Math.max(id === 'BETON' ? 1.5 : asset.base * .65, Math.round((asset.base * (1 + wave * asset.volatility + shock)) * 100) / 100);
  }
  function market(state) {
    return Object.entries(assets).map(([id, asset]) => ({ id, name: asset.name, kind: asset.kind, price: marketPrice(state, id) }));
  }
  function portfolioValue(state) {
    const portfolio = state.portfolio || emptyPortfolio();
    return Object.keys(assets).reduce((sum, id) => sum + Math.floor((portfolio[id] || 0) * marketPrice(state, id) / 100), 0);
  }
  function propertyValue(state) {
    return (state.properties || []).reduce((sum, item) => sum + Math.max(0, item.value - (item.mortgage || 0)), 0);
  }
  function netWorth(state, player) {
    return Math.max(0, Math.floor((player?.cash || 0) + state.balance + portfolioValue(state) + propertyValue(state)));
  }
  function takeFunds(state, player, amount) {
    if (!validAmount(amount) || player.cash + state.balance < amount) return false;
    const cash = Math.min(player.cash, amount);
    player.cash -= cash; state.balance -= amount - cash;
    return true;
  }
  function addFunds(state, player, amount) {
    if (!validAmount(amount)) return false;
    if (state.account) state.balance = Math.min(1000000, state.balance + amount);
    else player.cash = Math.min(1000000, player.cash + amount);
    return true;
  }
  function validPropertyOffer(value) {
    return Boolean(value && safeName(value.id) && safeName(value.name) && safeName(value.district) && validAmount(value.price) && validAmount(value.rent));
  }
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
    for (const property of state.properties || []) {
      if (property.rented && property.lastRentDay !== state.day) message(state, 'Nájemník', property.name + ': nájem čeká k vyzvednutí v nemovitostech.');
      if (property.mortgage && state.day % 4 === 0) {
        state.bills.push({ id: 'mortgage-' + property.id + '-' + state.day, name: 'Hypotéka · ' + property.name, amount: Math.min(1200, property.mortgage), due: state.day + 3 });
        message(state, 'Banka', 'Nová splátka hypotéky: ' + property.name + '.');
      }
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
    } else if (action === 'trade') {
      if (!state.account || !value || !['buy', 'sell', 'swap'].includes(value.type)) return false;
      state.portfolio ||= emptyPortfolio();
      if (value.type === 'buy') {
        if (!assets[value.asset] || !validAmount(value.czk) || state.balance < value.czk) return false;
        state.balance -= value.czk; state.portfolio[value.asset] += Math.floor(value.czk * 100 / marketPrice(state, value.asset) * .99);
      } else if (value.type === 'sell') {
        if (!assets[value.asset]) return false;
        const units = value.units === 'all' ? state.portfolio[value.asset] : value.units;
        if (!Number.isSafeInteger(units) || units <= 0 || units > state.portfolio[value.asset]) return false;
        state.portfolio[value.asset] -= units; state.balance = Math.min(1000000, state.balance + Math.floor(units * marketPrice(state, value.asset) / 100 * .98));
      } else {
        if (!assets[value.from] || !assets[value.to] || value.from === value.to) return false;
        const units = value.units === 'all' ? state.portfolio[value.from] : value.units;
        if (!Number.isSafeInteger(units) || units <= 0 || units > state.portfolio[value.from]) return false;
        const czk = Math.floor(units * marketPrice(state, value.from) / 100 * .98);
        state.portfolio[value.from] -= units; state.portfolio[value.to] += Math.floor(czk * 100 / marketPrice(state, value.to) * .99);
      }
      message(state, 'Broker', 'Obchod proveden. Portfolio má hodnotu asi ' + portfolioValue(state) + ' Kč.');
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
    } else if (action === 'business') {
      state.business ||= { osvc: false, company: false, taxFiledDay: 0 };
      if (value === 'osvc') {
        if (state.business.osvc || netWorth(state, player) < 8000 || !takeFunds(state, player, 1000)) return false;
        state.business.osvc = true; player.rep += 10; message(state, 'Úřad', 'OSVČ založeno. Teď už jen faktury, odvody a disciplína.');
      } else if (value === 'company') {
        if (!state.business.osvc || state.business.company || netWorth(state, player) < 60000 || !takeFunds(state, player, 12000)) return false;
        state.business.company = true; player.rep += 25; message(state, 'Úřad', 'Firma zapsaná. Gratuluju, máš vlastní papírovou realitu.');
      } else if (value === 'tax') {
        const fee = state.business.company ? 1200 : state.business.osvc ? 400 : 0;
        if (!fee || state.business.taxFiledDay === state.day || !takeFunds(state, player, fee)) return false;
        state.business.taxFiledDay = state.day; player.rep += state.business.company ? 12 : 5; message(state, 'Finanční úřad', 'Daňové přiznání podané. Dneska jsi systém přežil.');
      } else return false;
    } else if (action === 'rentFlat') {
      if (!validPropertyOffer(value) || state.rental || !takeFunds(state, player, value.rent)) return false;
      state.rental = { type: 'flat', buildingId: value.id, name: value.name, district: value.district, until: state.day + 7, slept: false, rent: value.rent };
      message(state, 'Správce', 'Byt pronajatý na 7 dní: ' + value.name + '.');
    } else if (action === 'buyProperty' || action === 'mortgageProperty') {
      if (!validPropertyOffer(value) || state.properties.some(item => item.id === value.id)) return false;
      const mortgage = action === 'mortgageProperty', down = mortgage ? Math.ceil(value.price * .25) : value.price;
      if (!takeFunds(state, player, down)) return false;
      state.properties.push({ id: value.id, name: value.name, district: value.district, value: value.price, rent: value.rent, mortgage: mortgage ? value.price - down : 0, rented: false, lastRentDay: 0 });
      message(state, 'Katastr', (mortgage ? 'Hypotéka schválená: ' : 'Nemovitost koupená: ') + value.name + '.');
    } else if (['rentOutProperty', 'collectRent', 'payMortgage'].includes(action)) {
      const property = state.properties.find(item => item.id === value);
      if (!property) return false;
      if (action === 'rentOutProperty') {
        if (property.rented) return false;
        property.rented = true; message(state, 'Správce', property.name + ': byt je nabídnutý k pronájmu.');
      } else if (action === 'collectRent') {
        if (!property.rented || property.lastRentDay === state.day) return false;
        property.lastRentDay = state.day; addFunds(state, player, property.rent); message(state, 'Nájemník', property.name + ': nájem ' + property.rent + ' Kč dorazil.');
      } else {
        const amount = Math.min(1000, property.mortgage || 0);
        if (!amount || !takeFunds(state, player, amount)) return false;
        property.mortgage -= amount; message(state, 'Banka', property.name + ': mimořádná splátka hypotéky ' + amount + ' Kč.');
      }
    } else return false;
    return true;
  }
  function restore(value) {
    if (!value || typeof value !== 'object') return create();
    const n = number => Number.isSafeInteger(number) && number >= 0 && number <= 1000000;
    const validBill = bill => Boolean(bill && typeof bill.id === 'string' && typeof bill.name === 'string' && (bill.id === 'phone-' + (bill.due - 2) || bill.id.startsWith('mortgage-')) && (bill.name === 'Telefonní tarif' || bill.name.startsWith('Hypotéka · ')) && n(bill.amount) && n(bill.due));
    if (!n(value.day) || value.day < 1 || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed >= 300 || typeof value.account !== 'boolean' || !n(value.balance) || !n(value.sentDay)) return create();
    if (value.loan !== null && (!value.loan || ![1000, 5000].includes(value.loan.principal) || !n(value.loan.remaining) || value.loan.remaining < 1 || value.loan.remaining > value.loan.principal * 1.1 || !n(value.loan.due) || typeof value.loan.overdue !== 'boolean')) return create();
    if (value.rental !== null && (!value.rental || !['bed', 'room', 'flat'].includes(value.rental.type) || !n(value.rental.until) || typeof value.rental.slept !== 'boolean')) return create();
    if (!Array.isArray(value.bills) || value.bills.length > 10000 || value.bills.some(bill => !validBill(bill)) || new Set(value.bills.map(bill => bill.id)).size !== value.bills.length) return create();
    if (!Array.isArray(value.messages) || value.messages.length > 80 || value.messages.some(item => !item || typeof item.from !== 'string' || item.from.length > 40 || typeof item.text !== 'string' || item.text.length > 300 || !n(item.day))) return create();
    const state = JSON.parse(JSON.stringify(value));
    state.portfolio = emptyPortfolio();
    if (value.portfolio && typeof value.portfolio === 'object') for (const id of Object.keys(assets)) state.portfolio[id] = n(value.portfolio[id]) ? value.portfolio[id] : 0;
    state.business = value.business && typeof value.business === 'object' && typeof value.business.osvc === 'boolean' && typeof value.business.company === 'boolean' && n(value.business.taxFiledDay) ? { osvc: value.business.osvc, company: value.business.company, taxFiledDay: value.business.taxFiledDay } : { osvc: false, company: false, taxFiledDay: 0 };
    state.properties = [];
    if (Array.isArray(value.properties) && value.properties.length <= 24) {
      const ids = new Set();
      for (const item of value.properties) {
        if (!item || !safeName(item.id) || ids.has(item.id) || !safeName(item.name) || !safeName(item.district) || !n(item.value) || !n(item.rent) || !n(item.mortgage) || item.mortgage > item.value || typeof item.rented !== 'boolean' || !n(item.lastRentDay)) return create();
        ids.add(item.id); state.properties.push({ id: item.id, name: item.name, district: item.district, value: item.value, rent: item.rent, mortgage: item.mortgage, rented: item.rented, lastRentDay: item.lastRentDay });
      }
    }
    return state;
  }
  return { create, act, restore, nextDay, packages, products, assets, market, marketPrice, portfolioValue, propertyValue, netWorth, has };
})();
if (typeof module !== 'undefined') module.exports = lifeSystem;
