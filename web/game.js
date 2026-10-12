'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id),keys=new Set(),size=19200,block=400,gridSize=48,worldMin=-6400,minCell=-16,worldSpan=size-worldMin;
function cellKey(row,col){return (row-minCell)*(gridSize-minCell)+col-minCell;}
function wrapWorld(value){return ((value-worldMin)%worldSpan+worldSpan)%worldSpan+worldMin;}
// Approximate neighborhood centers projected in meters from Žižkov (50.084, 14.452).
const pragueDistrictAnchors=[
  {name:'OŘECHOVKA',lat:50.094,lng:14.381,color:'#e7c784',style:'villa'},
  {name:'HANSPAULKA',lat:50.110,lng:14.374,color:'#aed692',style:'villa'},
  {name:'STŘEŠOVICE',lat:50.087,lng:14.372,color:'#e2b99b',style:'old'},
  {name:'DEJVICE',lat:50.101,lng:14.394,color:'#80cbd6',style:'modern'},
  {name:'BUBENEČ',lat:50.105,lng:14.414,color:'#b7d29f',style:'garden'},
  {name:'HRADČANY',lat:50.090,lng:14.398,color:'#d7b486',style:'old'}
].map(d=>({...d,x:(d.lng-14.452)*111320*Math.cos(50.084*Math.PI/180),y:-(d.lat-50.084)*111320}));
let w=innerWidth,h=innerHeight,dpr=1,started=false,paused=false,dialogOpen=false,last=0,time=0,toastTimer=0,audio=null,sound=false;
const player={x:255,y:350,angle:0,car:null,cash:1200,rep:0,heat:0,health:100,step:0,xp:0};
const camera={x:player.x,y:player.y};
let viewZoom = 1;
let cityMapZoom = 1;
let nearbyMapZoom = 12;
function changeZoom(current, delta, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, current * Math.exp(-Math.max(-300, Math.min(300, delta)) * .0015)));
}
addEventListener('wheel', event => {
  if (!started || paused || dialogOpen || mapExpanded || event.ctrlKey || event.target?.closest?.('button, input, textarea, select, .overlay, .mission, .playerPanel, header, footer')) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? h : 1);
  if (!Number.isFinite(delta) || delta === 0) return;
  const mapWidth = w < 800 ? 115 : 190;
  const mapX = w - mapWidth - 26, mapY = h - mapWidth - 76;
  const overMap = !interior && event.clientX >= mapX && event.clientX <= mapX + mapWidth && event.clientY >= mapY && event.clientY <= mapY + mapWidth;
  event.preventDefault();
  if (overMap) {
    if (mapExpanded) cityMapZoom = changeZoom(cityMapZoom, delta, 1, 32);
    else nearbyMapZoom = changeZoom(nearbyMapZoom, delta, 2, 48);
  } else viewZoom = changeZoom(viewZoom, delta, .65, 2.2);
}, { passive: false });

let interior=null;
let lifeState = lifeSystem.create();
const lifeEntitlements = [];
let lifeMenu = null;
let lifeSaveElapsed = 0;
const featureLog = [
  'Novinka: Zahradní Město je nová hratelná čtvrť s knihovnou, fake internetem a střední školou.',
  'Novinka: Policie odemyká herní zbraně až po dokončení 20otázkového vědomostního testu.',
  'Novinka: Rozšířený inventář sleduje doklady, studium, certifikáty a herní vybavení.',
  'Novinka: Střední škola odemyká lepší práce; dostaneš se k ní levelem nebo samostudiem.'
];
const inventoryCatalog = {
  phone: { name: 'Telefon', type: 'utility' },
  idcard: { name: 'Občanka', type: 'document' },
  notebook: { name: 'Studijní sešit', type: 'study' },
  diploma: { name: 'Vysvědčení ze střední školy', type: 'document' },
  webNotes: { name: 'Poznámky z fake internetu', type: 'study' },
  libraryCard: { name: 'Průkaz do knihovny', type: 'document' },
  policeCertificate: { name: 'Policejní certifikát bezpečnosti', type: 'document' },
  pepper: { name: 'Pepřový sprej', type: 'weapon' },
  baton: { name: 'Teleskopický obušek', type: 'weapon' },
  trainingPistol: { name: 'Tréninková pistole', type: 'weapon' }
};
const baseInventory = () => [{ id: 'phone', qty: 1 }, { id: 'idcard', qty: 1 }, { id: 'notebook', qty: 1 }];
let inventory = baseInventory();
let gameplayLog = featureLog.map((text, index) => ({ day: 1, text, system: true, order: index + 1 }));
let educationState = { studyPoints: 0, highSchool: false, method: null, betterJobs: false };
let policeKnowledgeState = { passed: false, active: false, index: 0, score: 0 };
let unlockedWeapons = [];
const policeWeapons = [
  { id: 'pepper', name: 'Pepřový sprej', level: 1 },
  { id: 'baton', name: 'Teleskopický obušek', level: 2 },
  { id: 'trainingPistol', name: 'Tréninková pistole', level: 3 }
];
const policeKnowledgeQuestions = [
  ['Co uděláš při kontrole dokladů?', ['Uteču', 'Zůstanu v klidu a komunikuju', 'Schovám se v autě'], 1],
  ['Kdy voláš tísňovou linku?', ['Při reálném ohrožení', 'Kvůli parkování', 'Když chci slevu'], 0],
  ['Co znamená červená na semaforu?', ['Zrychlit', 'Zastavit', 'Jet jen na chodník'], 1],
  ['Jak se chováš u nehody?', ['Zavolám pomoc a neblokujem zásah', 'Natáčím zprostředka silnice', 'Odjedu'], 0],
  ['Co patří k legální práci?', ['Docházka a smlouva', 'Jen slib v chatu', 'Žádné papíry'], 0],
  ['Co je respekt ve městě?', ['Strach všech kolem', 'Spolehlivost a reputace', 'Jen hotovost'], 1],
  ['Kdy použiješ sebeobranný prostředek?', ['Jen v nouzi a přiměřeně', 'Pro zábavu', 'Kvůli hádce o drobné'], 0],
  ['Co uděláš s nalezenou cizí peněženkou?', ['Vrátím ji nebo předám policii', 'Nechám si ji', 'Prodám doklady'], 0],
  ['Co zvyšuje policejní pozornost?', ['Rizikové zakázky', 'Studium v knihovně', 'Nákup rohlíku'], 0],
  ['Jak bezpečně přejdeš ulici?', ['Na přechodu a rozhlédnout se', 'Mezi auty bez koukání', 'Zavřu oči'], 0],
  ['Co znamená samostudium?', ['Učit se mimo školu', 'Kupovat auta', 'Ignorovat úkoly'], 0],
  ['Kde získáš klidné znalosti?', ['V knihovně', 'V honičce', 'U bouračky'], 0],
  ['Co je férová směna?', ['Práce za dohodnutou odměnu', 'Práce bez domluvy', 'Dluh bez konce'], 0],
  ['Kdy je lepší ustoupit?', ['Když konflikt roste', 'Nikdy', 'Až po pokutě'], 0],
  ['Co znamená inventář?', ['Seznam tvých věcí', 'Stav počasí', 'Cena benzínu'], 0],
  ['Proč chodit do školy?', ['Kvůli lepším pracím', 'Aby nešlo ukládat', 'Kvůli větším pokutám'], 0],
  ['Co je fake internet ve hře?', ['Herní studijní zdroj', 'Reálný návod k útoku', 'Bankovní hack'], 0],
  ['Co uděláš, když nemáš peníze na jízdenku?', ['Nejedu nebo vydělám', 'Vynutím si odvoz', 'Zablokuju autobus'], 0],
  ['Jak snížíš riziko na ulici?', ['Legální práce a klid', 'Rychlé zakázky', 'Provokování hlídek'], 0],
  ['Co odemkne test na policii?', ['Herní bezpečnostní vybavení', 'Nekonečné peníze', 'Teleport'], 0]
].map(([question, choices, answer], index) => ({ id: 'q' + (index + 1), question, choices, answer }));
const betterJobs = [
  { id: 'warehouse', title: 'Koordinátor skladu', level: 3, reward: 3200, xp: 150, rep: 12 },
  { id: 'it-helpdesk', title: 'Junior IT podpora', level: 4, reward: 5200, xp: 210, rep: 18 },
  { id: 'automation', title: 'Automatizace objednávek', level: 5, reward: 8200, xp: 290, rep: 25 }
];
function inventoryCapacity() { return educationState.highSchool ? 32 : 24; }
function inventoryCount() { return inventory.reduce((sum, item) => sum + item.qty, 0); }
function inventoryName(id) { return inventoryCatalog[id]?.name || id; }
function addInventoryItem(id, qty = 1) {
  if (!inventoryCatalog[id] || !Number.isSafeInteger(qty) || qty <= 0 || inventoryCount() + qty > inventoryCapacity()) return false;
  const item = inventory.find(entry => entry.id === id);
  if (item) item.qty += qty; else inventory.push({ id, qty });
  recordLog('Inventář: přidáno ' + inventoryName(id) + (qty > 1 ? ' ×' + qty : '') + '.');
  return true;
}
function hasInventoryItem(id) { return inventory.some(item => item.id === id && item.qty > 0); }
function recordLog(text) {
  gameplayLog.push({ day: lifeState.day || 1, text, system: false, order: gameplayLog.length + 1 });
  gameplayLog = gameplayLog.slice(-80);
}
function educationStatusText() {
  return 'Studium ' + educationState.studyPoints + '/6 · ' + (educationState.highSchool ? 'střední škola hotová' : 'škola zamčená do LVL 3 nebo 6 bodů samostudia');
}
function canFinishHighSchool() { return !educationState.highSchool && (playerLevel() >= 3 || educationState.studyPoints >= 6); }
addEventListener('pagehide', () => saveProgress());
const pragueWeather = {
  condition: 'rain',
  description: 'Déšť',
  temperature: null,
  code: 61,
  phase: 'night',
  phaseLabel: 'noc',
  hour: 23,
  minute: 47,
  wet: true,
  updatedAt: 0,
  source: 'fallback'
};
function phaseFromHour(hour) {
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}
function phaseLabel(phase) {
  return phase === 'morning' ? 'ráno' : phase === 'day' ? 'den' : phase === 'evening' ? 'večer' : 'noc';
}
function pragueClockParts(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    return { hour: Number(parts.find(part => part.type === 'hour')?.value || 0), minute: Number(parts.find(part => part.type === 'minute')?.value || 0) };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}
function syncPragueClock() {
  const clock = pragueClockParts(), phase = phaseFromHour(clock.hour);
  pragueWeather.hour = clock.hour; pragueWeather.minute = clock.minute; pragueWeather.phase = phase; pragueWeather.phaseLabel = phaseLabel(phase);
}
function weatherFromCode(code) {
  if ([95, 96, 99].includes(code)) return { condition: 'storm', description: 'Bouřka', wet: true };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: 'snow', description: 'Sníh', wet: false };
  if ([51, 53, 55, 56, 57].includes(code)) return { condition: 'drizzle', description: 'Mrholení', wet: true };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { condition: 'rain', description: 'Déšť', wet: true };
  if ([45, 48].includes(code)) return { condition: 'fog', description: 'Mlha', wet: true };
  if ([1, 2, 3].includes(code)) return { condition: 'cloudy', description: 'Oblačno', wet: false };
  return { condition: 'clear', description: 'Jasno', wet: false };
}
function weatherAudioLevel() {
  return pragueWeather.condition === 'storm' ? .055 : pragueWeather.condition === 'rain' ? .035 : pragueWeather.condition === 'drizzle' ? .018 : 0;
}
function updateWeatherHud() {
  const meta = document.querySelector('#location span');
  const temperature = Number.isFinite(pragueWeather.temperature) ? ' · ' + Math.round(pragueWeather.temperature) + '°C' : '';
  if (meta) meta.textContent = String(pragueWeather.hour).padStart(2, '0') + ':' + String(pragueWeather.minute).padStart(2, '0') + ' · ' + pragueWeather.phaseLabel.toUpperCase() + ' · ' + pragueWeather.description.toUpperCase() + temperature;
  if (audio?.rainGain) audio.rainGain.gain.value = weatherAudioLevel();
}
function applyPragueWeatherData(data) {
  const current = data?.current || data?.current_weather || {};
  const code = Number(current.weather_code ?? current.weathercode ?? pragueWeather.code);
  const next = weatherFromCode(code), changed = next.condition !== pragueWeather.condition;
  pragueWeather.code = code; pragueWeather.condition = next.condition; pragueWeather.description = next.description; pragueWeather.wet = next.wet;
  pragueWeather.temperature = Number(current.temperature_2m ?? current.temperature ?? pragueWeather.temperature);
  pragueWeather.updatedAt = Date.now(); pragueWeather.source = 'open-meteo';
  syncPragueClock(); updateWeatherHud();
  if (changed) terrainTiles?.clear?.();
}
function refreshPragueWeather() {
  if (typeof fetch !== 'function') { syncPragueClock(); updateWeatherHud(); return; }
  fetch('https://api.open-meteo.com/v1/forecast?latitude=50.0755&longitude=14.4378&current=temperature_2m,weather_code,is_day,precipitation,rain,snowfall,cloud_cover&timezone=Europe%2FPrague', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('weather offline')))
    .then(applyPragueWeatherData)
    .catch(() => { pragueWeather.source = 'fallback'; syncPragueClock(); updateWeatherHud(); });
}
const buildings=[],cars=[],people=[],lamps=[],puddles=[];
let seed=47;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}function between(a,b){return a+rand()*(b-a)}
const cityBlocks=[];
const civicPlaces = new Map([
  ['1:0', 'UBYTOVNA'], ['3:3', 'BANKA'], ['1:3', 'ZÁKLADNÍ ŠKOLA'], ['3:1', 'ÚŘAD PRÁCE'], ['2:2', 'POLICIE ČR'],
  ['2:4', 'HASIČI'], ['4:2', 'NEMOCNICE'], ['3:4', 'OBCHODNÍ CENTRUM'], ['18:10', 'GYMNÁZIUM VINOHRADY'], ['20:13', 'CENTRUM VINOHRADY'],
  ['28:22', 'KNIHOVNA ZAHRADNÍ MĚSTO'], ['28:23', 'STŘEDNÍ ŠKOLA'], ['27:24', 'FAKE INTERNET CAFÉ'],
  ['-1:-3','BURZA PRAHA'], ['-4:-10','BAVARIA AUTOSALON'], ['-3:-12','VIER AUTOSALON'], ['-6:-9','STERN AUTOSALON'], ['-6:-6','NORD AUTOSALON'], ['-3:-13','BESEDA OŘECHOVKA'], ['-8:-14','HANSPAULSKÝ KLUB']
]);
const parkingLots = [{col:4,row:1},{col:3,row:2},{col:11,row:18}];
function districtAt(x,y){
  if(x<0||y<0){let best=pragueDistrictAnchors[0];for(const d of pragueDistrictAnchors)if(Math.hypot(x-d.x,y-d.y)<Math.hypot(x-best.x,y-best.y))best=d;return best;}
  if(y>=14400)return {name:'HOLEŠOVICE · DOKY',color:'#dba977',style:'industrial'};
  if(x>=12800)return {name:'NOVÉ MĚSTO',color:'#72d6f5',style:'modern'};
  if(x>=7600&&y>=10400&&y<14400)return {name:'ZAHRADNÍ MĚSTO',color:'#8fd38a',style:'garden'};
  if(y>=6400&&x>=3200)return {name:'VINOHRADY',color:'#9fcf92',style:'garden'};
  if(y>=6400)return {name:'KARLÍN',color:'#e8b883',style:'old'};
  return {name:'ŽIŽKOV',color:'#d392ef',style:'residential'};
}
for(let row=minCell;row<gridSize;row++)for(let col=minCell;col<gridSize;col++){
  const x=col*block+82,y=row*block+82,district=districtAt(x,y);
  const parking=parkingLots.some(lot=>lot.col===col&&lot.row===row);
  const protectedPlace=civicPlaces.has(row+':'+col);
  const park=!protectedPlace&&((row===2&&col===3)||(district.style==='garden'&&row%8===3&&col%8===5)||(district.style==='villa'&&(row+col)%7===0));
  const plaza=!protectedPlace&&district.style==='modern'&&(row+col)%4===0;
  const lot=!protectedPlace&&district.style==='industrial'&&(row+col)%3===0;
  cityBlocks.push({x:col*block,y:row*block,type:parking?'parking':park?'park':plaza?'plaza':lot?'lot':district.style});
  if(!parking&&!park&&!plaza&&!lot){
    const type=district.style;
    const names=type==='industrial'?['SKLAD 07','DOCKS','CARGO']:type==='modern'?['NOVA','HOTEL','ARCADE']:type==='old'?['KAVÁRNA','BAR 22','VINYL']:['BISTRO','NONSTOP','LÉKÁRNA'];
    const height=type==='villa'?between(5,9):type==='modern'?between(35,65):type==='industrial'?between(8,17):between(15,30);
    const color=type==='villa'?'#b29377':type==='old'?'#5a4942':type==='modern'?'#2d485c':type==='industrial'?'#39434a':['#3e4853','#52464d','#444e53'][Math.floor(rand()*3)];
    const name=civicPlaces.get(row+':'+col)||(col===0&&row===0?'NEON':col===1&&row===0?'ŘEZNICTVÍ':col===2&&row===0?'AUTOSERVIS':col===1&&row===2?'POTRAVINY':rand()>.65?names[Math.floor(rand()*names.length)]:'');
    const protectedBlock=civicPlaces.has(row+':'+col)||(col===1&&row===0)||(col===0&&row===0)||(col===2&&row===0)||(col===1&&row===2)||(col===0&&row===1)||(col===3&&row===3);
    const layout=(row*3+col)%4;
    const addBuilding=(bx,by,bw,bh,scale=1,sign='')=>buildings.push({x:bx,y:by,w:bw,h:bh,height:height*scale,color,name:sign,type,variant:((row+col+Math.floor(bx))%4+4)%4});
    if(name.includes('CENTRUM')){addBuilding(x,y,250,235,1.3,name);}
    else if(type==='villa'&&!protectedBlock){addBuilding(x+22,y+24,98,116,1,'');addBuilding(x+170,y+104,78,98,.88,'');}
    else if(protectedBlock||type==='industrial'){
      addBuilding(x,y,type==='industrial'?240:125,type==='industrial'?175:235,1,name);
      if(type!=='industrial')addBuilding(x+145,y+25,105,type==='modern'?175:210,.8);
    }else if(type==='residential'||type==='garden'){
      if(layout%2===0){addBuilding(x,y,76,235,1,name);addBuilding(x+78,y,82,235,.92);addBuilding(x+162,y,88,235,1.04);}
      else{addBuilding(x,y,70,235,1,name);addBuilding(x+73,y,177,78,.9);addBuilding(x+73,y+155,177,80,.88);}
    }else if(layout===0){
      addBuilding(x,y,76,235,1,name);addBuilding(x+93,y,157,82,.8);addBuilding(x+93,y+153,157,82,.8);
    }else if(layout===1){
      addBuilding(x,y,105,112,.7,name);addBuilding(x+145,y+15,105,112,.85);addBuilding(x+40,y+156,172,79,.6);
    }else if(layout===2){
      addBuilding(x,y,250,103,.9,name);addBuilding(x+25,y+143,88,92,.65);addBuilding(x+149,y+143,100,92,.7);
    }else{
      addBuilding(x,y,100,220,1,name);addBuilding(x+131,y+54,119,180,.75);
    }

  }
  lamps.push({x:col*block+65,y:row*block+65},{x:col*block+335,y:row*block+335});
}
for(let i=0;i<520;i++){
  const axis=rand()>.5,local=i<65,lane=Math.floor(rand()*(local?6:gridSize))*block+35;
  cars.push({x:axis?between(35,(local?2400:size)-35):lane,y:axis?lane:between(35,(local?2400:size)-35),angle:axis?0:Math.PI/2,axis,speed:between(25,80),color:['#b1bec4','#c69059','#71374b','#337d80','#394d74','#e9d4ad'][i%6],parked:i<12,police:i>=502});
}
for(let i=1;i<12;i++){const col=(i*7)%gridSize,row=(i*3)%gridSize;cars[i].x=col*block+61;cars[i].y=row*block+205;cars[i].angle=Math.PI/2;}
for(let i=0;i<36;i++){const col=(i*5+1)%gridSize,row=Math.floor(i/3)%gridSize;cars.push({x:col*block+61,y:row*block+270,angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#67798b','#b27151','#46656c'][i%3]});}
cars[0]={x:275,y:350,angle:0,axis:true,speed:0,color:'#b1bec4',parked:true,police:false};
for(let i=0;i<1200;i++){const axis=rand()>.5;people.push({x:axis?between(0,size):Math.floor(rand()*gridSize)*block+67,y:axis?Math.floor(rand()*gridSize)*block+67:between(0,size),axis,dir:rand()>.5?1:-1,color:['#986e4e','#516476','#76816b','#755c72'][i%4]});}
for(let i=0;i<520;i++)puddles.push({x:between(0,size),y:between(0,size),r:between(5,20)});
for(let row=minCell;row<gridSize;row++)for(let col=minCell;col<gridSize;col++){if((row+col)%2===0)cars.push({x:col*block+61,y:row*block+150,angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#74818b','#8c674d','#526e70'][Math.abs(row+col)%3]})}
for(const lot of parkingLots)for(let slot=0;slot<10;slot++){
  cars.push({x:lot.col*block+105+(slot%5)*43,y:lot.row*block+(slot<5?130:275),angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#798896','#926f5d','#446a76'][slot%3]});
}
const transitLines = [
  {id:'bus133',name:'Autobus 133',kind:'bus',fare:40,color:'#d66a3f',speed:95,points:[{x:435,y:435},{x:2035,y:435},{x:2035,y:1635},{x:435,y:1635}],stopNames:['Řeznictví · Žižkov','Škola','Obchodní centrum','Úřad práce']},
  {id:'villa6',name:'Autobus · Praha 6',kind:'bus',fare:40,color:'#5f9c69',speed:145,points:[{x:435,y:35},{x:-1165,y:35},{x:-1165,y:-1565},{x:-3965,y:-1565},{x:-5165,y:-1565},{x:-5165,y:-3165},{x:-2365,y:-3165},{x:435,y:-3165}],stopNames:['Žižkov · přestup','Centrum · burza','Praha 6 · přestup','Dejvice','Ořechovka','Hanspaulka','Bubeneč','Letná']},
  {id:'tram9',name:'Tramvaj 9',kind:'tram',fare:40,color:'#d74545',speed:115,points:[{x:835,y:835},{x:4435,y:835},{x:4435,y:7235},{x:835,y:7235}],stopNames:['Policejní stanice','Žižkov východ','Vinohrady','Karlín']}
];
const transitStops = transitLines.flatMap(line=>line.points.map((point,index)=>({x:point.x+32,y:point.y,lineId:line.id,index,name:line.stopNames[index]})));
for(const line of transitLines)for(let vehicle=0;vehicle<2;vehicle++){
  const stopIndex=(vehicle*2)%line.points.length,point=line.points[stopIndex];cars.push({x:point.x,y:point.y,angle:0,axis:true,speed:line.speed,color:line.color,parked:false,police:false,transit:line.kind,lineId:line.id,currentStopIndex:stopIndex,routeIndex:(stopIndex+1)%line.points.length,dwell:vehicle?0:5});
}
for(let i=0;i<16;i++)people.push({x:867+(i%4)*400,y:835+Math.floor(i/4)*400,axis:i%2===0,dir:1,color:i%2?'#283d67':'#253f3d',role:i%2?'police':'warden'});
for(let i=0;i<6;i++)cars.push({x:835+(i%3)*400,y:835+Math.floor(i/3)*400,angle:0,axis:true,speed:60,color:'#e7eef2',parked:false,police:true});
const trafficLights=[];
for(let row=minCell;row<gridSize;row++)for(let col=minCell;col<gridSize;col++){
  if((row+col)%2!==0)continue;
  trafficLights.push({row,col,x:col*block+35,y:row*block+35,offset:(row*3.7+col*5.1)%20});
}
const trafficLightMap=new Map(trafficLights.map(light=>[light.row+':'+light.col,light]));
function trafficState(light,clock=time){
  const phase=((clock+light.offset)%20+20)%20;
  const allRed=(phase>=8&&phase<10)||phase>=18;
  return {phase,eastWest:!allRed&&phase<8?'green':'red',northSouth:!allRed&&phase>=10&&phase<18?'green':'red'};
}
function nextTrafficLight(car){
  if(car.emergency||car.transit||car.parked||car.crashed)return null;
  if(car.axis){
    const row=Math.round((car.y-35)/block),col=Math.floor((car.x-35)/block)+1,light=trafficLightMap.get(row+':'+col);
    if(!light)return null;const dist=light.x-car.x;return dist>8&&dist<95?{light,dist,lane:'eastWest'}:null;
  }
  const col=Math.round((car.x-35)/block),row=Math.floor((car.y-35)/block)+1,light=trafficLightMap.get(row+':'+col);
  if(!light)return null;const dist=light.y-car.y;return dist>8&&dist<95?{light,dist,lane:'northSouth'}:null;
}
function laneDistanceAhead(car,other){
  if(!other||other===car||other.transit||other.emergency)return Infinity;
  if(car.axis!==other.axis)return Infinity;
  if(car.axis&&Math.abs(car.y-other.y)<18){const dist=other.x-car.x;return dist>0?dist:Infinity;}
  if(!car.axis&&Math.abs(car.x-other.x)<18){const dist=other.y-car.y;return dist>0?dist:Infinity;}
  return Infinity;
}
function trafficBlocker(car){
  for(const other of cars){
    if(other===car||other.transit||other.parked&&!other.crashed)continue;
    if(laneDistanceAhead(car,other)<72)return other;
  }
  const emergency=emergencyVehicles.find(vehicle=>vehicle.duty==='respond'&&distance(vehicle,car)<145);
  return emergency||null;
}
function vehicleAt(car,x,y,range=32){
  return cars.find(other=>other!==car&&!other.transit&&(!other.parked||other.crashed||other.emergency)&&Math.hypot(other.x-x,other.y-y)<range)||null;
}
const incidents=[],emergencyVehicles=[];
let incidentId=0;
function stationDoor(name){
  const building=buildings.find(item=>item.name===name);
  if(!building)return {x:255,y:350};
  const door=doorFor(building);
  return {x:door.x,y:door.y};
}
function addEmergencyVehicle(service,label,stationName,color,index=0){
  const home=stationDoor(stationName),vehicle={x:home.x+index*18,y:home.y+index*10,home:{x:home.x+index*18,y:home.y+index*10},angle:0,axis:true,speed:service==='fire'?135:service==='ambulance'?155:145,color,parked:false,police:service==='police',emergency:true,service,label,duty:'idle',targetIncident:null,trafficVelocity:0};
  emergencyVehicles.push(vehicle);cars.push(vehicle);return vehicle;
}
function addStationNpc(role,stationName,color,index=0){
  const home=stationDoor(stationName);
  people.push({x:home.x-24+index*16,y:home.y+22+index*8,axis:true,dir:1,color,role,stationary:true});
}
function spawnEmergencyServices(){
  addEmergencyVehicle('police','Policie zásah','POLICIE ČR','#e7eef2');
  addEmergencyVehicle('police','Dopravní policie','POLICIE ČR','#dce8ef',1);
  addEmergencyVehicle('fire','Hasiči','HASIČI','#d94a2e');
  addEmergencyVehicle('ambulance','Sanitka','NEMOCNICE','#f3f7f1');
  addStationNpc('police','POLICIE ČR','#253f6e');
  addStationNpc('firefighter','HASIČI','#8c392f');
  addStationNpc('paramedic','NEMOCNICE','#e8efe9');
}
function dispatchEmergency(incident){
  incident.assigned??={};
  for(const service of ['police','fire','ambulance']){
    if(incident.assigned[service])continue;
    const vehicle=emergencyVehicles.find(item=>item.service===service&&item.duty==='idle');
    if(!vehicle)continue;
    vehicle.duty='respond';vehicle.targetIncident=incident.id;vehicle.trafficVelocity=vehicle.speed;
    incident.assigned[service]=vehicle;
  }
}
function createIncident(x,y,vehicles=[],cause='traffic'){
  const nearby=incidents.find(item=>!item.resolved&&distance(item,{x,y})<120);
  if(nearby)return nearby;
  const incident={id:++incidentId,x,y,age:0,cause,vehicles:vehicles.filter(Boolean),assigned:{},arrived:{},crew:[],resolved:false,resolveTimer:0};
  for(const car of incident.vehicles){
    car.crashed=true;car.parked=true;car.velocity=0;car.trafficVelocity=0;car.crashCooldown=2.5;
    if(car===player.car){player.car=null;player.health=Math.max(15,player.health-18);player.x=x+34;player.y=y+20;player.heat=Math.min(5,player.heat+.4);}
  }
  incidents.push(incident);dispatchEmergency(incident);
  if(distance(player,{x,y})<450)notify('Nehoda hlášena · jedou hasiči, policie a sanitka');
  saveProgress();updateHud();return incident;
}
function ensureIncidentCrew(incident,service){
  if(incident.crew.some(member=>member.service===service))return;
  const color=service==='police'?'#1f3f78':service==='fire'?'#983c32':'#e8efe9';
  incident.crew.push({service,x:incident.x+(incident.crew.length-1)*18,y:incident.y+34+incident.crew.length*8,color});
}
function finishIncident(incident){
  incident.resolved=true;
  for(const car of incident.vehicles){car.crashed=false;car.parked=true;car.speed=car.speed||60;car.trafficVelocity=0;}
  for(const vehicle of Object.values(incident.assigned)){vehicle.duty='return';vehicle.targetIncident=null;vehicle.trafficVelocity=vehicle.speed;}
  if(distance(player,incident)<450)notify('Zásah ukončen · nehoda odklizena');
}
function moveEmergencyVehicle(vehicle,target,dt){
  const angle=Math.atan2(target.y-vehicle.y,target.x-vehicle.x),speed=vehicle.speed*(vehicle.duty==='respond'?1.15:.75);
  vehicle.angle=angle;vehicle.x+=Math.cos(angle)*speed*dt;vehicle.y+=Math.sin(angle)*speed*dt;vehicle.trafficVelocity=speed;
}
function updateEmergencyServices(dt){
  for(const incident of incidents){
    if(incident.resolved){incident.resolveTimer+=dt;continue;}
    incident.age+=dt;dispatchEmergency(incident);
    for(const [service,vehicle] of Object.entries(incident.assigned)){
      if(vehicle.duty!=='respond')continue;
      if(distance(vehicle,incident)>45)moveEmergencyVehicle(vehicle,incident,dt);
      else{vehicle.duty='scene';vehicle.trafficVelocity=0;incident.arrived[service]=true;ensureIncidentCrew(incident,service);}
    }
    if(['police','fire','ambulance'].every(service=>incident.arrived[service])||incident.age>45){
      incident.resolveTimer+=dt;
      if(incident.resolveTimer>8)finishIncident(incident);
    }
  }
  for(const vehicle of emergencyVehicles){
    if(vehicle.duty==='return'){
      if(distance(vehicle,vehicle.home)>35)moveEmergencyVehicle(vehicle,vehicle.home,dt);
      else{vehicle.x=vehicle.home.x;vehicle.y=vehicle.home.y;vehicle.duty='idle';vehicle.trafficVelocity=0;vehicle.angle=0;}
    }
  }
  for(let i=incidents.length-1;i>=0;i--)if(incidents[i].resolved&&incidents[i].resolveTimer>10)incidents.splice(i,1);
}
function updateTransitVehicle(car,dt){
  const line=transitLines.find(item=>item.id===car.lineId);
  if(car.dwell>0){car.dwell=Math.max(0,car.dwell-dt);return;}
  const targetIndex=car.routeIndex,target=line.points[targetIndex],dx=target.x-car.x,dy=target.y-car.y,length=Math.hypot(dx,dy),step=Math.min(length,car.speed*dt);
  if(length>0){car.x+=dx/length*step;car.y+=dy/length*step;car.angle=Math.atan2(dy,dx);}
  if(length<=step+.01){car.x=target.x;car.y=target.y;car.currentStopIndex=targetIndex;car.routeIndex=(targetIndex+1)%line.points.length;car.dwell=5;}
}
let activeTransitStop=null;
let transitRide=null;
function nearestTransitStop(){return interior||player.car||transitRide?null:transitStops.find(stop=>distance(player,stop)<42)||null;}
function showTransitMenu(stop){
  if(!stop||dialogOpen||interior||player.car||transitRide)return false;
  const line=transitLines.find(item=>item.id===stop.lineId);activeTransitStop=stop;dialogOpen=true;keys.clear();
  $('dialog').classList.remove('hidden');$('speaker').textContent='MHD · '+line.name;$('dialogTitle').textContent=stop.name;
  $('dialogText').textContent='Jízdenka '+line.fare+' Kč · zvol cílovou zastávku. Nastoupíš jako pasažér a vystoupíš až na cíli.';
  $('choices').replaceChildren();
  for(const destination of transitStops.filter(item=>item.lineId===line.id&&item!==stop)){
    const button=document.createElement('button');button.textContent=destination.name+' · '+line.fare+' Kč';button.disabled=player.cash<line.fare;button.onclick=()=>rideTransit(destination.index);$('choices').append(button);
  }
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=()=>{activeTransitStop=null;closeContracts();};$('choices').append(close);return true;
}
function rideTransit(index){
  const stop=activeTransitStop;
  if(!dialogOpen||!stop||interior||player.car||transitRide||distance(player,stop)>=42)return false;
  const line=transitLines.find(item=>item.id===stop.lineId),destination=transitStops.find(item=>item.lineId===line.id&&item.index===index);
  if(!destination||destination===stop||player.cash<line.fare||collision(destination.x,destination.y,10))return false;
  const vehicle=cars.filter(car=>car.transit&&car.lineId===line.id).sort((a,b)=>distance(a,stop)-distance(b,stop))[0];
  if(!vehicle)return false;
  const point=line.points[stop.index];Object.assign(vehicle,{x:point.x,y:point.y,currentStopIndex:stop.index,routeIndex:(stop.index+1)%line.points.length,dwell:.75,parked:false,speed:line.speed});
  player.cash-=line.fare;player.x=vehicle.x;player.y=vehicle.y;player.angle=vehicle.angle;camera.x=player.x;camera.y=player.y;
  transitRide={lineId:line.id,destinationIndex:destination.index,vehicle};
  activeTransitStop=null;closeContracts();saveProgress();updateHud();notify('Nástup · '+line.name+' → '+destination.name+' · −'+line.fare+' Kč');return true;
}
function transitPassengerOffset(vehicle){return {x:-Math.sin(vehicle.angle)*8,y:Math.cos(vehicle.angle)*8};}
function finishTransitRide(){
  if(!transitRide)return false;
  const line=transitLines.find(item=>item.id===transitRide.lineId),destination=transitStops.find(item=>item.lineId===transitRide.lineId&&item.index===transitRide.destinationIndex);
  if(!line||!destination){transitRide=null;return false;}
  transitRide=null;player.x=destination.x;player.y=destination.y;camera.x=player.x;camera.y=player.y;saveProgress();updateHud();notify('Výstup · '+line.name+' · '+destination.name);return true;
}
function syncTransitPassenger(){
  if(!transitRide)return false;
  const vehicle=transitRide.vehicle,line=transitLines.find(item=>item.id===transitRide.lineId);
  if(!vehicle||!line||vehicle.lineId!==line.id){transitRide=null;return false;}
  const offset=transitPassengerOffset(vehicle);player.x=vehicle.x+offset.x;player.y=vehicle.y+offset.y;player.angle=vehicle.angle;camera.x+=(player.x-camera.x)*.22;camera.y+=(player.y-camera.y)*.22;
  if(vehicle.currentStopIndex===transitRide.destinationIndex&&vehicle.dwell>0)return finishTransitRide();
  return true;
}
const buildingBuckets=new Map();
for(const b of buildings){const key=cellKey(Math.floor(b.y/block),Math.floor(b.x/block));if(!buildingBuckets.has(key))buildingBuckets.set(key,[]);buildingBuckets.get(key).push(b)}
function nearbyBuildings(x,y,rx,ry=rx){const result=[];for(let row=Math.max(minCell,Math.floor((y-ry)/block));row<=Math.min(gridSize-1,Math.floor((y+ry)/block));row++)for(let col=Math.max(minCell,Math.floor((x-rx)/block));col<=Math.min(gridSize-1,Math.floor((x+rx)/block));col++){const items=buildingBuckets.get(cellKey(row,col));if(items)result.push(...items)}return result;}
function visibleBuildingList(margin=520){const scale=(w<800?1.04:1.32)*viewZoom,cx=Math.max(worldMin+w/(2*scale),Math.min(size-w/(2*scale),camera.x)),cy=Math.max(worldMin+h/(2*scale),Math.min(size-h/(2*scale),camera.y));return nearbyBuildings(cx,cy,w/(2*scale)+margin,h/(2*scale)+margin);}
const missions=[
 {title:'Dluhy nespí',text:'Najdi Viktora před klubem Neon. Má pro tebe práci.',x:210,y:350,label:'Viktor · klub Neon',speaker:'VIKTOR',dialog:'Nájem se sám nezaplatí, Adame. Mám zásilku konopí pro jednoho známého. Neptáš se, doručíš. Nebo vezmi směnu v servisu. Tvoje volba.',choices:[['Vezmu konopí. (+1 800 Kč, +80 XP)','illegal'],['Radši práci v servisu. (+900 Kč)','legal']]},
 {title:'Cena rychlých peněz',text:'Doruč konopí kontaktu u podchodu. Policie hlídá hlavní ulice.',x:665,y:455,label:'Kontakt · podchod',speaker:'KONTAKT',dialog:'Viktor říkal, že přijdeš. Tady máš peníze. Pamatuj: rychlý prachy mají dlouhej stín.',choices:[['Předat konopí a odejít','deliver']]},
 {title:'Rodina před ulicí',text:'Sestra tě čeká před potravinami. Potřebuje s tebou mluvit.',x:470,y:1110,label:'Eliška · potraviny',speaker:'ELIŠKA',dialog:'Máma potřebuje léky a já další brigádu neutáhnu. Nechci vědět, odkud ty peníze jsou. Jen mi slib, že se vrátíš domů.',choices:[['Pomoci rodině. (−800 Kč, +15 respekt)','family'],['Teď nemůžu. Potřebuju splatit dluh.','decline']]},
 {title:'Zmizet z očí',text:'Dostaň se do úkrytu a stáhni na sebe co nejméně pozornosti.',x:1265,y:1510,label:'Úkryt · stará prádelna',speaker:'ADAM',dialog:'Na chvíli ticho. Jen déšť za oknem. Můžeš běžet pořád dál, ale jednou si musíš vybrat, kam vlastně chceš dojít.',choices:[['Vyčkat v úkrytu. (sníží policejní pozornost)','hide']]},
 {title:'Kdo chceš být?',text:'Vrať se k Viktorovi. Dnešní noc rozhodne o zítřku.',x:210,y:350,label:'Viktor · klub Neon',speaker:'VIKTOR',dialog:'Obstál jsi. Můžeme spolu dělat dál. Víc peněz, víc problémů. Nebo odejdi a zkus si ten život postavit jinak.',choices:[['Zůstat v ulicích.','streetPath'],['Začít znovu v servisu.','cleanPath']]},
 {title:'Druhá noc',text:'Viktor posílá další kontakt. Tentokrát si máš vyzvednout telefon u podchodu.',x:665,y:455,label:'Spojka · podchod',speaker:'SPOJKA',dialog:'Tady máš čistý telefon a adresu. Žádné hrdinství, jen doručit a zmizet. Viktor už počítá, že se nezalekneš.',choices:[['Vzít telefon a zakázku. (+1 300 Kč, +90 XP)','streetPickup']]},
 {title:'Tichý převoz',text:'Zavez balíček ke skladu za magistrálou. Hlavní tahy hlídá policie.',x:1580,y:680,label:'Skladová spojka',speaker:'SKLADNÍK',dialog:'Jdeš pozdě. Ale balík je celý, takže ber prachy a miz. Jestli tě někdo sledoval, problém padá na tebe.',choices:[['Předat balíček. (+2 200 Kč, +120 XP)','streetDrop']]},
 {title:'Eliščina zpráva',text:'Eliška čeká u potravin. Ví, že se kolem tebe znovu něco děje.',x:470,y:1110,label:'Eliška · potraviny',speaker:'ELIŠKA',dialog:'Nechci tě hlídat. Jen už poznám, kdy lžeš. Jestli máš peníze, pomoz doma. Jestli nemáš, aspoň mi řekni pravdu.',choices:[['Nechat doma peníze. (−1 200 Kč, +20 respekt)','helpMore'],['Zatajit zakázku a pokračovat.','ignoreMore']]},
 {title:'Nabídka bez návratu',text:'Viktor chce, abys vzal větší věc. Tohle už není jen jedna noc.',x:210,y:350,label:'Viktor · klub Neon',speaker:'VIKTOR',dialog:'Dneska ses osvědčil. Další práce už není malá. Buď do toho půjdeš naplno, nebo odejdi teď, dokud máš ještě jméno a nohy celé.',choices:[['Jít naplno do ulic.','streetEnd'],['Zastavit to a jít do servisu.','cleanSwitch']]},
 {title:'První ranní směna',text:'Pavel tě čeká v autoservisu. Špinavá práce, ale čisté peníze.',x:1070,y:315,label:'Pavel · autoservis',speaker:'PAVEL',dialog:'Přišel jsi. To je první věc, co se počítá. Zvedni vrata, uklidíme dílnu a pak uvidíme, jestli umíš držet slovo.',choices:[['Odpracovat směnu. (+1 100 Kč, +100 XP)','garageShift']]},
 {title:'Papíry a realita',text:'Zajdi na úřad práce. Pavel chce, abys měl legální stopu a ne jen sliby.',x:1350,y:748,label:'Úřad práce',speaker:'ÚŘEDNICE',dialog:'Bez papírů jste pro systém duch. Můžeme vám dát doporučení na sklad, servis a krátké rekvalifikace. Ale chodit musíte vy.',choices:[['Vyřídit registraci. (+300 Kč, +70 XP)','jobOffice']]},
 {title:'Nákup pro mámu',text:'Eliška poslala seznam. Vezmi základní jídlo z potravin.',x:470,y:1110,label:'Potraviny · Eliščin seznam',speaker:'ELIŠKA',dialog:'Stačí chleba, mlíko, něco teplého a žádný kecy, že to nepotřebuješ řešit. Doma se pozná, jestli se fakt měníš.',choices:[['Nakoupit domů. (−450 Kč, +20 respekt)','familyGroceries']]},
 {title:'Čistý štít',text:'Na policii se dá urovnat stará kontrola. Nebude to příjemné, ale sníží to tlak.',x:945,y:1145,label:'Policie ČR · přepážka',speaker:'POLICISTA',dialog:'Máme tu záznam o kontrole. Nic velkého, ale jestli chceš pracovat čistě, přestaň utíkat před každým majákem.',choices:[['Dát věci do pořádku. (pozornost na 0)','clearRecord']]},
 {title:'Druhá šance',text:'Vrať se za Pavlem. Jestli vydržíš ještě jeden den, město ti dá jiný začátek.',x:1070,y:315,label:'Pavel · autoservis',speaker:'PAVEL',dialog:'Nikdo po tobě nechce, abys byl svatej. Stačí, když zítra vstaneš a dorazíš znovu. To je celý tajemství normálního života.',choices:[['Dokončit kapitolu čistou cestou.','cleanEnd']]}
];
const firstChapterEnd=4,cleanChapterStart=9;
let missionIndex=0,legal=false,complete=false,storyPath=null;
function mission(){if(activeDistrictJob){const job=districtJobs.find(item=>item.id===activeDistrictJob);return {...job.target,title:job.title,text:job.text+' Odměna '+formatMoney(job.reward)+' · '+job.xp+' XP.',speaker:job.receiver}}if(activeContract){const item=substances.find(entry=>entry.id===activeContract.substanceId),route=deliveryRoutes[activeContract.routeIndex];return {...route,title:'Zakázka · '+item.name,text:'Doruč '+item.name+' kontaktu. Odměna '+item.reward.toLocaleString('cs-CZ')+' Kč a '+item.xp+' XP.',speaker:'KONTAKT'}}return missions[missionIndex]}function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function notify(text){$('toast').textContent=text;$('toast').style.opacity='1';toastTimer=4}
function chapterEyebrow(){if(complete&&!activeContract&&!activeDistrictJob)return'VOLNÝ REŽIM / ZAKÁZKY';return missionIndex<=firstChapterEnd?'KAPITOLA 01 / PRVNÍ NOC':storyPath==='street'?'KAPITOLA 02 / ULICE VRACÍ ÚDER':'KAPITOLA 02 / DRUHÁ ŠANCE'}
function updateHud(){ if($('health'))$('health').textContent=Math.round(player.health)+'/100';$('cash').textContent=player.cash.toLocaleString('cs-CZ')+' Kč';$('rep').textContent=player.rep;$('heat').textContent='★'.repeat(Math.ceil(player.heat))+'☆'.repeat(5-Math.ceil(player.heat));$('missionTitle').textContent=complete&&!activeContract&&!activeDistrictJob?'Nový den':mission().title;$('missionText').textContent=complete&&!activeContract&&!activeDistrictJob?'Druhá kapitola je za tebou. Otevři Kontakty a pokračuj v zakázkách.':mission().text;$('objective').textContent=complete&&!activeContract&&!activeDistrictJob?'J · Kontakty a zakázky':mission().label;const eyebrow=document.querySelector('.mission .eyebrow');if(eyebrow)eyebrow.textContent=chapterEyebrow();updateProgressionHud();if(interior)updateInteriorHud();}
function advance(){missionIndex=Math.min(missionIndex+1,missions.length-1);updateHud()}
function showDialog(){if(complete||dialogOpen)return;dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('speaker').textContent=mission().speaker;$('dialogTitle').textContent=mission().title;$('dialogText').textContent=mission().dialog;$('choices').replaceChildren();for(const [text,action]of mission().choices){const button=document.createElement('button');button.textContent=text;button.onclick=()=>choose(action);$('choices').append(button)}}
function choose(action){dialogOpen=false;$('dialog').classList.add('hidden');if(action==='illegal'){player.heat=1.8;notify('Zásilka převzata. Policie je ve střehu.');advance()}if(action==='legal'){legal=true;storyPath='clean';setServiceMission();advance()}if(action==='deliver'&&missionIndex===1&&!complete){awardXp(80);player.cash+=legal?900:1800;player.rep+=10;notify('Úkol splněn · '+(legal?'900':'1 800')+' Kč');advance()}if(action==='family'){awardXp(40);player.cash=Math.max(0,player.cash-800);player.rep+=15;notify('Eliška: Díky. Dávej na sebe pozor.');advance()}if(action==='decline')advance();if(action==='hide'){awardXp(40);player.heat=0;notify('Pozornost policie klesla.');advance()}if(action==='streetPath'){storyPath='street';missionIndex=5;player.heat=Math.min(5,player.heat+.8);notify('Kapitola 02: Ulice vrací úder.')}if(action==='cleanPath'){storyPath='clean';legal=true;missionIndex=cleanChapterStart;player.heat=Math.max(0,player.heat-.5);notify('Kapitola 02: Druhá šance.')}if(action==='streetPickup'){awardXp(90);player.cash+=1300;player.rep+=8;player.heat=Math.min(5,player.heat+1);notify('Telefon převzat · +1 300 Kč');advance()}if(action==='streetDrop'){awardXp(120);player.cash+=2200;player.rep+=12;player.heat=Math.min(5,player.heat+1.2);notify('Balík předán · +2 200 Kč');advance()}if(action==='helpMore'){awardXp(60);player.cash=Math.max(0,player.cash-1200);player.rep+=20;player.heat=Math.max(0,player.heat-.4);notify('Doma necháváš peníze a trochu klidu.');advance()}if(action==='ignoreMore'){player.rep=Math.max(0,player.rep-5);player.heat=Math.min(5,player.heat+.5);notify('Eliška mlčí. Tohle bude bolet později.');advance()}if(action==='cleanSwitch'){storyPath='clean';legal=true;missionIndex=cleanChapterStart;player.heat=0;notify('Zastavil ses včas. Pavel čeká v servisu.')}if(action==='garageShift'){awardXp(100);player.cash+=1100;player.rep+=12;player.heat=Math.max(0,player.heat-.3);notify('Směna hotová · +1 100 Kč');advance()}if(action==='jobOffice'){awardXp(70);player.cash+=300;player.rep+=12;notify('Registrace hotová · doporučení na práci · +300 Kč');advance()}if(action==='familyGroceries'){awardXp(50);player.cash=Math.max(0,player.cash-450);player.rep+=20;player.health=Math.min(100,player.health+10);notify('Nákup doručen domů · +10 zdraví');advance()}if(action==='clearRecord'){awardXp(80);player.heat=0;player.rep+=15;notify('Pozornost policie vymazaná na nulu.');advance()}if(action.endsWith('End')){complete=true;notify(action==='streetEnd'?'Konec kapitoly: Král bez koruny.':'Konec kapitoly: Druhá šance.');$('missionText').textContent=action==='streetEnd'?'Ulice ti otevřela dveře. Otázka je, co si vezme zpátky.':'Peníze nejsou všechno. Zítra začínáš v servisu.';}updateHud();saveProgress()}
function collision(x,y,r){if(interior)return interiorCollision(x,y,r);return x<worldMin+r||y<worldMin+r||x>size-r||y>size-r||nearbyBuildings(x,y,r).some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)}
function doorFor(b){return {x:b.x+b.w/2,y:b.y+b.h+12}}
const importantNpcConfigs = [
  { name: 'NEON', label: 'Viktor', short: 'VIK', color: '#d36bff' },
  { name: 'AUTOSERVIS', label: 'Pavel', short: 'PAV', color: '#f0a23c' },
  { name: 'POTRAVINY', label: 'Eliška / potraviny', short: 'JÍDLO', color: '#c5f46b' },
  { name: 'ŘEZNICTVÍ', label: 'Karel / řeznictví', short: 'KAR', color: '#ff9f7a' },
  { name: 'BANKA', label: 'Bankéř', short: 'BANK', color: '#4fb9ff' },
  {name:'BURZA PRAHA',label:'Broker · burza',short:'BURZA',color:'#55d7c2'},
  ...['BAVARIA','VIER','STERN','NORD'].map(name=>({name:name+' AUTOSALON',label:name+' · prodejce',short:'AUTO',color:'#f3c477'})),
  { name: 'ÚŘAD PRÁCE', label: 'Úředník', short: 'OSVČ', color: '#ff77c8' },
  { name: 'POLICIE ČR', label: 'Policie', short: 'PČR', color: '#68a0ff' },
  { name: 'HASIČI', label: 'Hasiči', short: 'HZS', color: '#ff5c3f' },
  { name: 'NEMOCNICE', label: 'Sanitka', short: 'EMS', color: '#f1f7f2' },
  { name: 'UBYTOVNA', label: 'Správce ubytovny', short: 'POSTEL', color: '#ffd166' },
  { name: 'KNIHOVNA ZAHRADNÍ MĚSTO', label: 'Knihovna · samostudium', short: 'KNIH', color: '#91d98f' },
  { name: 'STŘEDNÍ ŠKOLA', label: 'Střední škola', short: 'ŠKOLA', color: '#f0d06c' },
  { name: 'FAKE INTERNET CAFÉ', label: 'Fake internet · samostudium', short: 'NET', color: '#68d7ff' },
  { name: 'OBCHODNÍ CENTRUM', label: 'Obchody', short: 'SHOP', color: '#72e2d1' },
  { name: 'CENTRUM VINOHRADY', label: 'Obchody', short: 'SHOP', color: '#72e2d1' }
];
function importantNpcMarkers(includeTarget = false) {
  const markers = [];
  if (includeTarget && targetAvailable()) {
    const m = mission();
    markers.push({ x: m.x, y: m.y, label: m.speaker, short: 'CÍL', color: '#c5f46b', target: true });
  }
  for (const config of importantNpcConfigs) {
    const building = buildings.find(item => item.name === config.name);
    if (!building) continue;
    const door = doorFor(building);
    markers.push({ ...config, x: door.x, y: door.y - 8, building });
  }
  for(const contact of districtContacts)markers.push({...contact,label:contact.speaker,short:'QUEST',color:'#ffd166'});
  return markers;
}
function nearestDoor(){let nearest=null,best=42;for(const b of nearbyBuildings(player.x,player.y,100)){const door=doorFor(b),d=distance(player,door);if(d<best&&!collision(door.x,door.y,10)){nearest=b;best=d}}return nearest}
spawnEmergencyServices();
function interiorFurniture(){if(!interior)return [];return [{x:interior.width*.18,y:interior.depth*.45,w:interior.width*.22,h:interior.depth*.12},{x:interior.width*.16,y:interior.depth*.7,w:interior.width*.25,h:interior.depth*.12}]}
function interiorCollision(x,y,r){return x<r+4||y<r+4||x>interior.width-r-4||y>interior.depth-r-4||interiorFurniture().some(item=>x+r>item.x&&x-r<item.x+item.w&&y+r>item.y&&y-r<item.y+item.h)}
function enterBuilding(b){if(player.car){notify('Nejdřív vystup z auta.');return;}interior={building:b,width:b.w,depth:b.h,floor:0,maxFloor:Math.max(1,Math.min(5,Math.floor(b.height/6))),outside:{x:player.x,y:player.y,angle:player.angle}};player.x=interior.width/2;player.y=interior.depth-22;camera.x=player.x;camera.y=player.y;updateHud();notify('Vstup: '+(b.name||'činžovní dům')+' · E u schodiště / dveří');}
function interiorPoints(){return {up:{x:interior.width-22,y:interior.depth*.2},down:{x:interior.width-22,y:interior.depth*.42},exit:{x:interior.width/2,y:interior.depth-15}}}
const butcherProducts = [
  { id: 'roll', name: 'Rohlík se šunkou', price: 45, health: 8 },
  { id: 'sausage', name: 'Teplá klobása s chlebem', price: 95, health: 20 },
  { id: 'schnitzel', name: 'Řízek v housce', price: 135, health: 30 },
  { id: 'meal', name: 'Pořádná masová porce', price: 220, health: 50 }
];
let activeShop = null;
function isButcherRoom() { return Boolean(interior && interior.floor === 0 && interior.building.name === 'ŘEZNICTVÍ'); }
function butcherPoint() { return { x: interior.width * .55, y: interior.depth * .52 }; }
function closeShop() { activeShop = null; dialogOpen = false; $('dialog').classList.add('hidden'); keys.clear(); }
function showButcherShop() {
  if (!isButcherRoom() || dialogOpen) return false;
  activeShop = interior.building;
  dialogOpen = true;
  keys.clear();
  $('dialog').classList.remove('hidden');
  $('speaker').textContent = 'KAREL · ŘEZNÍK';
  $('dialogTitle').textContent = 'Co si dáš, sousede?';
  $('dialogText').textContent = 'Čerstvý jídlo, žádný dluhy. Jídlo sníš hned po nákupu. Zdraví ' + Math.round(player.health) + '/100 · hotovost ' + player.cash.toLocaleString('cs-CZ') + ' Kč.';
  $('choices').replaceChildren();
  for (const item of butcherProducts) {
    const button = document.createElement('button');
    button.textContent = item.name + ' · ' + item.price + ' Kč · +' + item.health + ' zdraví';
    button.disabled = player.cash < item.price;
    button.onclick = () => buyButcherProduct(item.id);
    $('choices').append(button);
  }
  const close = document.createElement('button');
  close.textContent = 'Díky, zatím nic';
  close.onclick = closeShop;
  $('choices').append(close);
  return true;
}
function buyButcherProduct(id) {
  const item = butcherProducts.find(product => product.id === id);
  if (!item || !dialogOpen || !isButcherRoom() || activeShop !== interior.building || distance(player, butcherPoint()) > 45) return false;
  if (player.cash < item.price) { notify('Na tohle nemáš dost hotovosti.'); return false; }
  player.cash -= item.price;
  player.health = Math.min(100, player.health + item.health);
  closeShop();
  saveProgress();
  updateHud();
  notify('Koupeno: ' + item.name + ' · −' + item.price + ' Kč · zdraví ' + Math.round(player.health) + '/100');
  return true;
}
function useInterior(){if(isLifeService() && distance(player, lifeServicePoint()) <= 45){openLifeMenu('service');return;}if(isButcherRoom()&&distance(player,butcherPoint())<=45){showButcherShop();return;}const points=interiorPoints();if(distance(player,points.exit)<25&&interior.floor===0){const outside=interior.outside;interior=null;Object.assign(player,outside);camera.x=player.x;camera.y=player.y;updateHud();notify('Zpátky na ulici.');return;}if(distance(player,points.up)<Math.min(18,interior.depth*.075)){if(interior.floor<interior.maxFloor){interior.floor++;player.x=points.down.x;player.y=points.down.y;updateHud();notify('Patro '+interior.floor)}else notify('Jsi v nejvyšším patře.');return;}if(distance(player,points.down)<Math.min(18,interior.depth*.075)){if(interior.floor>0){interior.floor--;player.x=points.up.x;player.y=points.up.y;updateHud();notify(interior.floor?'Patro '+interior.floor:'Přízemí')}else notify('Jsi v přízemí.');return;}notify('Přejdi ke schodišti nebo k východu.');}
function updateInteriorHud(){const points=interiorPoints();$('missionTitle').textContent=interior.building.name||'Činžovní dům';$('missionText').textContent='Průřez budovou · '+(interior.floor?'patro '+interior.floor:'přízemí')+' / '+interior.maxFloor+'. U schodiště stiskni E.';$('objective').textContent=interior.floor?'Schodiště ↑ / ↓':'Schodiště ↑ · východ ↓';$('distance').textContent='';$('location').firstChild.textContent='INTERIÉR · '+(interior.floor?'PATRO '+interior.floor:'PŘÍZEMÍ')+' ';$('prompt').style.display='block';$('prompt').textContent=distance(player,points.up)<Math.min(18,interior.depth*.075)?'[E] O patro výš':distance(player,points.down)<Math.min(18,interior.depth*.075)?'[E] O patro níž':interior.floor===0&&distance(player,points.exit)<25?'[E] Vyjít na ulici':'E · interakce u schodiště / dveří';if(isButcherRoom()){$('missionText').textContent='Karel za pultem · E pro nabídku jídla a ceny. Jídlo doplní zdraví, platíš hotově.';if(distance(player,butcherPoint())<=45)$('prompt').textContent='[E] Karel · nakoupit';}}
function interact(){if(!started||paused||dialogOpen)return;if(transitRide){notify('Jedeš MHD. Vystoupíš na cílové zastávce.');return;}if(interior){useInterior();return;}const stop=nearestTransitStop();if(stop){showTransitMenu(stop);return;}if(targetAvailable()&&distance(player,mission())<65){if(activeDistrictJob)completeDistrictJob();else if(activeContract)completeContract();else showDialog();return;}const contact=nearestDistrictContact();if(contact){showDistrictJobs(contact);return;}const door=nearestDoor();if(door){enterBuilding(door);return;}notify('Přibliž se ke kontaktu nebo k fialově osvětlenému vstupu.');}

function enterCar(){if(!started||paused||dialogOpen)return;if(transitRide){notify('Jedeš jako pasažér. Vystoupíš na cílové zastávce.');return;}if(interior){notify('Auto je venku na ulici.');return;}if(player.car){const car=player.car;for(const offset of [Math.PI/2,-Math.PI/2,Math.PI]){const x=car.x+Math.cos(car.angle+offset)*38,y=car.y+Math.sin(car.angle+offset)*38;if(!collision(x,y,10)){player.x=x;player.y=y;player.car=null;car.velocity=0;car.parked=true;notify('Vystoupil jsi.');return}}notify('Není tu prostor pro vystoupení.');return;}const nearest=cars.filter(c=>!c.police&&!c.transit&&!c.emergency&&!c.crashed).sort((a,b)=>distance(player,a)-distance(player,b))[0];if(nearest&&distance(player,nearest)<65){player.car=nearest;nearest.parked=true;nearest.velocity=0;player.x=nearest.x;player.y=nearest.y;player.angle=nearest.angle;notify('W plyn · S brzda / zpátečka · A/D zatáčení · mezerník ruční brzda')}else notify('Přibliž se k autu a stiskni F.')}
function togglePause(){if(!started||dialogOpen)return;paused=!paused;$('menu').classList.toggle('hidden',!paused);$('start').innerHTML='POKRAČOVAT <span>↗</span>';keys.clear()}
$('start').onclick=()=>{started=true;paused=false;$('menu').classList.add('hidden');notify('První noc · Najdi Viktora před klubem.');};$('pause').onclick=togglePause;
addEventListener('keydown',e=>{if(e.target?.matches?.('input, textarea, select, [contenteditable="true"]'))return;const k=e.key.toLowerCase();if(mapExpanded){if(k==='m'||k==='escape'){e.preventDefault();window.lifeCityMap?.toggle(false);}return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(e.target?.matches?.('input, textarea, select')){keys.delete(k);return;}if(k==='p')openLifeMenu('phone');if(k==='i')openInventory();if(k==='e')interact();if(k==='f')enterCar();if(k==='m')window.lifeCityMap?.toggle();if(k==='j')openContracts();if(k==='k')manualSave();if(k==='escape'){if(dialogOpen)closeContracts();else togglePause()}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();if(started&&!paused&&!dialogOpen&&!mapExpanded)togglePause()});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key)}$('touchE').onclick=interact;$('touchF').onclick=enterCar;
$('sound').onclick=()=>{try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();sound=!sound;$('sound').textContent='Zvuk · '+(sound?'zapnuto':'vypnuto');if(sound){const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.035;const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();filter.type='lowpass';filter.frequency.value=850;gain.gain.value=weatherAudioLevel();source.buffer=buffer;source.loop=true;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();audio.rainGain=gain}else audio.suspend()}catch{notify('Zvuk není v tomto prohlížeči dostupný.')}};
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
function rect(x,y,ww,hh,color){ctx.fillStyle=color;ctx.fillRect(x,y,ww,hh)}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function carCollision(x,y,angle){
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const halfLength=23,halfWidth=13;
  const extentX=Math.abs(cos)*halfLength+Math.abs(sin)*halfWidth;
  const extentY=Math.abs(sin)*halfLength+Math.abs(cos)*halfWidth;
  if(x<worldMin+extentX||y<worldMin+extentY||x>size-extentX||y>size-extentY)return true;
  return nearbyBuildings(x,y,extentX,extentY).some(b=>{
    const dx=b.x+b.w/2-x,dy=b.y+b.h/2-y;
    if(Math.abs(dx)>=b.w/2+extentX||Math.abs(dy)>=b.h/2+extentY)return false;
    if(Math.abs(dx*cos+dy*sin)>=halfLength+b.w/2*Math.abs(cos)+b.h/2*Math.abs(sin))return false;
    if(Math.abs(-dx*sin+dy*cos)>=halfWidth+b.w/2*Math.abs(sin)+b.h/2*Math.abs(cos))return false;
    return true;
  });
}
function updateDriving(car,input,dt){
  const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
  car.velocity??=0;
  car.crashCooldown=Math.max(0,(car.crashCooldown||0)-dt);
  for(let i=0;i<steps;i++){
    const throttle=Number(input.up)-Number(input.down);
    const opposing=throttle*car.velocity<0;
    if(input.brake||opposing){
      const braking=(input.brake?620:440)*step;
      car.velocity=Math.sign(car.velocity)*Math.max(0,Math.abs(car.velocity)-braking);
    }else if(throttle){
      car.velocity+=throttle*(throttle>0?230:150)*step;
    }else{
      const drag=55*step;
      car.velocity=Math.sign(car.velocity)*Math.max(0,Math.abs(car.velocity)-drag);
    }
    car.velocity=Math.max(-105,Math.min(car.maxSpeed||310,car.velocity));
    const steering=Number(input.right)-Number(input.left);
    const turnRate=Math.min(2.15,Math.abs(car.velocity)*.033);
    const angle=car.angle+steering*turnRate*step*Math.sign(car.velocity);
    if(!carCollision(car.x,car.y,angle))car.angle=angle;
    const nx=car.x+Math.cos(car.angle)*car.velocity*step;
    const ny=car.y+Math.sin(car.angle)*car.velocity*step;
    const hit=vehicleAt(car,nx,ny,34);
    if(!hit&&!carCollision(nx,ny,car.angle)){
      car.x=nx;car.y=ny;
    }else{
      if(Math.abs(car.velocity)>80&&car.crashCooldown===0){
        if(hit)createIncident((car.x+hit.x)/2,(car.y+hit.y)/2,[car,hit],'player-crash');
        player.cash=Math.max(0,player.cash-(hit?120:50));
        player.heat=Math.min(5,player.heat+(hit&&hit.emergency ? .5 : .3));
        car.crashCooldown=1.5;
        notify(hit?'Dopravní nehoda · volá se IZS':'Nehoda · −50 Kč');saveProgress();updateHud();
      }
      car.velocity=0;
    }
  }
}
function updateTrafficCar(car,dt){
  if(car.crashed)return;
  car.trafficVelocity??=car.speed||0;
  let desired=car.speed||0;
  const light=nextTrafficLight(car);
  if(light&&trafficState(light.light)[light.lane]==='red')desired=0;
  if(trafficBlocker(car))desired=0;
  const accel=desired>car.trafficVelocity?70:240;
  if(desired>car.trafficVelocity)car.trafficVelocity=Math.min(desired,car.trafficVelocity+accel*dt);
  else car.trafficVelocity=Math.max(desired,car.trafficVelocity-accel*dt);
  const speed=car.trafficVelocity,angle=car.axis?0:Math.PI/2,nx=wrapWorld(car.x+Math.cos(angle)*speed*dt),ny=wrapWorld(car.y+Math.sin(angle)*speed*dt);
  car.angle=angle;
  const hit=vehicleAt(car,nx,ny,30);
  if(hit){
    if(speed>45||((hit.trafficVelocity||hit.velocity||hit.speed||0)>45))createIncident((car.x+hit.x)/2,(car.y+hit.y)/2,[car,hit],'traffic-crash');
    car.trafficVelocity=0;return;
  }
  if(!carCollision(nx,ny,angle)){car.x=nx;car.y=ny;}
  else car.trafficVelocity=0;
}

function update(dt){time+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').style.opacity=0}if(!started||paused)return;const previousTick=Math.floor(lifeState.elapsed/30);lifeState.elapsed+=dt;lifeSaveElapsed+=dt;if(lifeState.elapsed>=300){lifeState.elapsed-=300;lifeSystem.nextDay(lifeState);reconcileOwnedVehicles();saveProgress();notify('Den '+lifeState.day+' · zkontroluj účty v telefonu (P)');}if(lifeSaveElapsed>=10){lifeSaveElapsed=0;saveProgress();}if(mapExpanded)return;if(dialogOpen){if(lifeMenu==='service'&&lifeServiceKind()==='exchange'&&previousTick!==Math.floor(lifeState.elapsed/30)){const mode=lifeMenu;closeContracts();openLifeMenu(mode);}return;}const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');if(!transitRide){if(player.car){const c=player.car;updateDriving(c,{up,down,left,right,brake:keys.has(' ')},dt);player.x=c.x;player.y=c.y;player.angle=c.angle}else{let dx=right-left,dy=down-up,len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;const speed=keys.has('shift')?155:90;if(!collision(player.x+dx*speed*dt,player.y,10))player.x+=dx*speed*dt;if(!collision(player.x,player.y+dy*speed*dt,10))player.y+=dy*speed*dt;player.angle=Math.atan2(dy,dx);player.step+=dt*12}}}
updateEmergencyServices(dt);
for(const c of cars){if(interior||c===player.car||c.parked)continue;if(c.transit){updateTransitVehicle(c,dt);continue;}if(c.emergency)continue;if(c.police&&!transitRide&&player.heat>.5&&distance(c,player)<650){const angle=Math.atan2(player.y-c.y,player.x-c.x);c.angle=angle;const nx=c.x+Math.cos(angle)*105*dt,ny=c.y+Math.sin(angle)*105*dt;if(!collision(nx,ny,21)&&!vehicleAt(c,nx,ny,34)){c.x=nx;c.y=ny}if(distance(c,player)<38){player.cash=Math.max(0,player.cash-400);player.heat=0;player.x=255;player.y=350;if(player.car){player.car.x=275;player.car.y=350;player.car.velocity=0;player.car=null}const lostCargo=Boolean(activeContract);activeContract=null;notify(lostCargo?'Zadržení · zásilka zabavena · pokuta 400 Kč':'Zadržení · pokuta 400 Kč · návrat do čtvrti');saveProgress();updateHud()}}else updateTrafficCar(c,dt)}
if(transitRide)syncTransitPassenger();
for(const p of people){if(p.stationary)continue;if(['police','warden'].includes(p.role)&&!interior&&!transitRide&&player.heat>1&&distance(p,player)<180&&!player.car){const dx=player.x-p.x,dy=player.y-p.y,len=Math.hypot(dx,dy);if(len>0){const nx=p.x+dx/len*42*dt,ny=p.y+dy/len*42*dt;if(!collision(nx,ny,10)){p.x=nx;p.y=ny;}}if(len<20){player.cash=Math.max(0,player.cash-250);player.heat=0;activeContract=null;notify((p.role==='warden'?'Strážník':'Policista')+' · kontrola a pokuta 250 Kč');saveProgress();updateHud();}continue;}if(p.axis)p.x=wrapWorld(p.x+p.dir*18*dt);else p.y=wrapWorld(p.y+p.dir*18*dt)}if(player.heat>0){player.heat=Math.max(0,player.heat-dt*.025);$('heat').textContent='★'.repeat(Math.ceil(player.heat))+'☆'.repeat(5-Math.ceil(player.heat))}camera.x+=(player.x-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-camera.y)*Math.min(1,dt*5);if(transitRide){const line=transitLines.find(item=>item.id===transitRide.lineId),destination=transitStops.find(item=>item.lineId===transitRide.lineId&&item.index===transitRide.destinationIndex);syncPragueClock();$('location').firstChild.textContent='MHD · '+(line?.name||'linka')+' ';$('location').style.color=line?.color||'#d66a3f';updateWeatherHud();$('distance').textContent='';$('prompt').style.display='block';$('prompt').textContent='Pasažér · jedeš na '+(destination?.name||'cílovou zastávku');return;}const currentDistrict=districtAt(player.x,player.y);syncPragueClock();$('location').firstChild.textContent=currentDistrict.name+' ';$('location').style.color=currentDistrict.color;updateWeatherHud();$('distance').textContent=targetAvailable()?Math.round(distance(player,mission()))+' m':'';const near=targetAvailable()&&distance(player,mission())<65;const nearCar=cars.some(c=>!c.police&&!c.transit&&!c.emergency&&!c.crashed&&distance(c,player)<60);$('prompt').style.display=near||nearCar||player.car?'block':'none';$('prompt').textContent=near?'[E] Promluvit · '+mission().speaker:player.car?'[F] Vystoupit z auta':'[F] Nastoupit do auta';if(interior)updateInteriorHud();else{const door=nearestDoor();if(door&&!near){$('prompt').style.display='block';$('prompt').textContent='[E] Vstoupit · '+(door.name||'činžovní dům')}const stop=nearestTransitStop();if(stop){$('prompt').style.display='block';$('prompt').textContent='[E] MHD · '+stop.name}const contact=nearestDistrictContact();if(contact&&!near){$('prompt').style.display='block';$('prompt').textContent='[E] '+contact.speaker+' · úkoly ve čtvrti'}}}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}
function rounded(x,y,width,height,radius,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.fill()}
function visible(x,y,margin=250){const scale=(w<800?1.04:1.32)*viewZoom,cx=Math.max(worldMin+w/(2*scale),Math.min(size-w/(2*scale),camera.x)),cy=Math.max(worldMin+h/(2*scale),Math.min(size-h/(2*scale),camera.y));return Math.abs(x-cx)<w/(2*scale)+margin&&Math.abs(y-cy)<h/(2*scale)+margin}
function drawBuilding(b){
  const elevation=24+b.height*1.1,dx=-elevation*.22,dy=-elevation*.5;
  polygon([[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w+elevation*.9,b.y+b.h+elevation*.8],[b.x+elevation*.9,b.y+b.h+elevation*.8]],'#00080f65');
  const front=ctx.createLinearGradient(0,b.y+b.h+dy,0,b.y+b.h);front.addColorStop(0,b.type==='old'?'#856759':b.type==='garden'?'#7d7770':b.type==='modern'?'#486e82':'#54606b');front.addColorStop(1,b.type==='old'?'#43372f':'#1c303c');
  polygon([[b.x+dx,b.y+b.h+dy],[b.x+b.w+dx,b.y+b.h+dy],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]],front);
  polygon([[b.x+b.w+dx,b.y+dy],[b.x+b.w+dx,b.y+b.h+dy],[b.x+b.w,b.y+b.h],[b.x+b.w,b.y]],'#13222b');
  for(let floor=1;floor<4;floor++)for(let window=0;window<b.w/17-1;window++){
    const t=floor/4,x=b.x+dx*(1-t)+window*17+8,y=b.y+b.h+dy*(1-t);
    const lit=(window+floor+Math.floor(b.x/100))%4!==0;
    rect(x-1,y-1,10,7,'#131e2788');rect(x,y,8,5,lit?(b.type==='modern'?'#8dc8d8':'#edbd7e'):'#10222e');rect(x+3,y,1,5,'#31343977');
    if(lit){ctx.globalAlpha=.15;rect(x,y+5,8,3,'#ffd595');ctx.globalAlpha=1;}
  }
  const roof=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);roof.addColorStop(0,b.type==='old'?'#986957':b.type==='modern'?'#6d9daf':'#68727a');roof.addColorStop(.55,b.color);roof.addColorStop(1,b.type==='old'?'#513d36':'#344854');
  rect(b.x+dx,b.y+dy,b.w,b.h,roof);
  ctx.strokeStyle='#b1b9b93b';ctx.lineWidth=3;ctx.strokeRect(b.x+dx+2,b.y+dy+2,b.w-4,b.h-4);
  ctx.strokeStyle='#040a1270';ctx.lineWidth=3;ctx.strokeRect(b.x+dx+7,b.y+dy+7,b.w-14,b.h-14);
  for(let yy=18;yy<b.h-10;yy+=16)rect(b.x+dx+10,b.y+dy+yy,b.w-20,1,'#ffffff06');
  if(b.variant!==2){
  rounded(b.x+dx+17,b.y+dy+28,34,45,2,'#0c151dc0');
  rect(b.x+dx+15,b.y+dy+24,34,45,'#5a6871');rect(b.x+dx+18,b.y+dy+27,28,39,'#273742');
  for(let l=0;l<6;l++)rect(b.x+dx+20,b.y+dy+31+l*5,24,2,'#87959965');
  const fanX=b.x+dx+b.w-30,fanY=b.y+dy+b.h-52;
  rounded(fanX-17,fanY-14,31,31,3,'#63717a');ctx.fillStyle='#22343f';ctx.beginPath();ctx.arc(fanX-2,fanY+1,11,0,7);ctx.fill();
  ctx.strokeStyle='#94a4ad';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fanX-11,fanY+1);ctx.lineTo(fanX+7,fanY+1);ctx.moveTo(fanX-2,fanY-8);ctx.lineTo(fanX-2,fanY+10);ctx.stroke();
  rect(b.x+dx+b.w-29,b.y+dy+20,17,24,'#14222e');rect(b.x+dx+b.w-31,b.y+dy+17,17,24,'#5f6b72');
  }
  drawRoofDetails(b,dx,dy);drawRoofFixtures(b,dx,dy);
  if(b.name){
    const neon=b.name==='NEON'?'#eb6dff':b.type==='old'?'#ffb876':b.type==='industrial'?'#e7bc6b':'#55eadb',signY=b.y+b.h-9;
    rounded(b.x+8,signY-19,b.w-16,23,2,'#08121a');ctx.fillStyle=neon;ctx.shadowColor=neon;ctx.shadowBlur=14;ctx.font='bold '+(b.name.length>7?10:17)+'px Arial';ctx.textAlign='center';ctx.fillText(b.name,b.x+b.w/2,signY-3);ctx.shadowBlur=0;
    glow(b.x+b.w/2,signY+22,125,b.name==='NEON'?'#d23df948':'#36dbce35');
    for(let k=0;k<9;k++){ctx.globalAlpha=(1-k/9)*.13;rect(b.x+12-k*2,signY+10+k*6,b.w-24+k*4,2,neon)}ctx.globalAlpha=1;
    rect(b.x+b.w/2-13,b.y+b.h-3,26,6,'#b2a9bf');
  }
}
function drawRoofFixtures(b,dx,dy){
  const x=b.x+dx,y=b.y+dy;
  if(b.variant===0){
    ctx.strokeStyle='#aebbc5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+b.w-20,y+15);ctx.lineTo(x+b.w-20,y-5);ctx.moveTo(x+b.w-30,y+1);ctx.lineTo(x+b.w-10,y+1);ctx.moveTo(x+b.w-27,y-3);ctx.lineTo(x+b.w-13,y-3);ctx.stroke();
    ctx.strokeStyle='#879bad55';ctx.beginPath();ctx.moveTo(x+12,y+b.h-16);ctx.lineTo(x+b.w-12,y+b.h-16);ctx.stroke();
  }
  if(b.variant===1&&b.type!=='old'){
    ctx.fillStyle='#07182290';ctx.beginPath();ctx.ellipse(x+b.w-20,y+40,13,7,-.6,0,7);ctx.fill();
    const metal=ctx.createLinearGradient(x+b.w-30,y+20,x+b.w-10,y+45);metal.addColorStop(0,'#d1d8d4');metal.addColorStop(1,'#5a788b');ctx.fillStyle=metal;ctx.beginPath();ctx.ellipse(x+b.w-23,y+34,11,6,-.6,0,7);ctx.fill();
  }
  if(b.type==='industrial'){
    rect(x+14,y+b.h-21,b.w-28,4,'#caaa6470');
    for(let k=0;k<Math.floor(b.w/20);k++)polygon([[x+14+k*20,y+b.h-21],[x+22+k*20,y+b.h-21],[x+17+k*20,y+b.h-17],[x+9+k*20,y+b.h-17]],'#152733');
  }
}
function drawRoofDetails(b,dx,dy){
  const x=b.x+dx,y=b.y+dy;
  if(b.type==='old'||b.type==='villa'){
    polygon([[x+8,y+10],[x+b.w/2,y+20],[x+b.w/2,y+b.h-20],[x+8,y+b.h-10]],'#9b6951');
    polygon([[x+b.w/2,y+20],[x+b.w-8,y+10],[x+b.w-8,y+b.h-10],[x+b.w/2,y+b.h-20]],'#694638');
    for(let line=20;line<b.h-15;line+=8){ctx.strokeStyle='#d7966440';ctx.beginPath();ctx.moveTo(x+10,y+line);ctx.lineTo(x+b.w/2,y+line+5);ctx.lineTo(x+b.w-10,y+line);ctx.stroke()}
    rect(x+24,y+50,12,18,'#282931');rect(x+21,y+46,15,4,'#b08468');
  }else if(b.type==='modern'){
    for(let panel=0;panel<Math.min(3,Math.floor((b.h-20)/35));panel++){rounded(x+13,y+20+panel*35,b.w-26,26,2,'#163448');for(let line=0;line<4;line++)rect(x+16+line*(b.w-30)/4,y+23+panel*35,1,20,'#6798ba66');rect(x+16,y+32+panel*35,b.w-32,1,'#bad9e844')}
    glow(x+b.w/2,y+b.h-15,60,'#33b7e625');
  }else if(b.type==='industrial'){
    for(let line=12;line<b.w-8;line+=12)rect(x+line,y+10,2,b.h-20,'#94a0a329');
    for(let k=0;k<3;k++){rounded(x+30+k*61,y+65,39,31,2,'#162c39');rect(x+32+k*61,y+67,35,1,'#a7cde055')}
  }else if(b.variant===2){
    rounded(x+18,y+30,b.w-36,b.h-60,5,'#34564c');
    for(let k=0;k<Math.floor((b.h-40)/35);k++)drawTree(x+b.w/2,y+35+k*35,Math.min(13,b.w/5));
    rect(x+18,y+b.h-20,b.w-36,3,'#788781');
  }else if(b.variant===3){
    ctx.fillStyle='#61747e';ctx.beginPath();ctx.ellipse(x+b.w/2,y+b.h/2,20,23,0,0,7);ctx.fill();ctx.fillStyle='#94a2a7';ctx.beginPath();ctx.ellipse(x+b.w/2-3,y+b.h/2-5,16,18,0,0,7);ctx.fill();
  }
}
function drawCar(c){
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);if(c.luxury)ctx.scale(c.vehicleClass==='limousine'?1.2:1.08,c.vehicleClass==='suv'||c.vehicleClass==='box'?1.16:1.05);
  rounded(-25,-10,52,25,9,'#00091099');
  const beam=ctx.createLinearGradient(20,0,150,0);beam.addColorStop(0,'#fff5d159');beam.addColorStop(.35,'#ffedb71b');beam.addColorStop(1,'#fff6d000');
  for(const yy of [-7,7])polygon([[20,yy-3],[150,yy-30],[165,yy+28],[20,yy+3]],beam);
  rounded(-19,-15,11,6,2,'#080d13');rounded(10,-15,11,6,2,'#080d13');rounded(-19,9,11,6,2,'#080d13');rounded(10,9,11,6,2,'#080d13');
  const bodyColor=c.service==='fire'?'#d94a2e':c.service==='ambulance'?'#f3f7f1':c.police?'#f2f4f2':c.color,bodyShade=c.service==='fire'?'#812d25':c.service==='ambulance'?'#b8d1d5':c.police?'#99b3c1':c.color;
  const paint=ctx.createLinearGradient(0,-12,0,12);paint.addColorStop(0,'#c2ced0');paint.addColorStop(.15,bodyColor);paint.addColorStop(.65,bodyShade);paint.addColorStop(1,'#182c3a');
  rounded(-24,-12,49,24,6,paint);ctx.strokeStyle='#ffffff45';ctx.lineWidth=.8;ctx.stroke();
  if(c.service==='fire')rect(-12,-13,25,4,'#f6d06c');
  if(c.service==='ambulance'){rect(-8,-13,17,4,'#e0344a');rect(-1,-19,4,16,'#e0344a');}
  rounded(-10,-10,24,20,4,'#092432');
  const glass=ctx.createLinearGradient(-10,-9,14,8);glass.addColorStop(0,'#6596ac');glass.addColorStop(.4,'#214758');glass.addColorStop(1,'#0a2230');
  polygon([[8,-9],[14,-7],[14,7],[8,9]],glass);polygon([[-11,-8],[-7,-9],[-7,9],[-11,8]],glass);
  rounded(-6,-8,13,16,2,c.police?'#edf3f1':c.color);rect(-5,-7,10,1,'#ffffff50');
  ctx.strokeStyle='#101e2b99';ctx.beginPath();ctx.moveTo(16,-9);ctx.lineTo(16,9);ctx.moveTo(-16,-9);ctx.lineTo(-16,9);ctx.stroke();
  rect(-2,-14,5,2,c.color);rect(-2,12,5,2,c.color);rounded(21,-10,4,6,1,'#fff1bf');rounded(21,4,4,6,1,'#fff1bf');
  rect(-25,-10,3,5,'#ff5264');rect(-25,5,3,5,'#ff5264');glow(-27,0,24,'#ff254019');
  if(c.luxury){rect(23,-5,3,10,'#c2cdd3');rect(20,-10,4,2,'#e3faff');rect(20,8,4,2,'#e3faff');if(c.vehicleClass==='box')rounded(-29,-7,6,14,2,'#111b24');}
  rect(24,-4,2,8,'#08151f');rect(-25,-4,2,8,'#08151f');
  if(c.police||c.emergency){rect(-2,-8,5,16,'#142535');glow(0,-5,35,time%1<.5?'#368bff80':'#ff304960');glow(0,5,35,time%1<.5?'#ff304960':'#368bff80');rect(-2,-8,5,7,c.service==='fire'?'#ffcc44':'#47a0ff');rect(-2,1,5,7,'#ff4861');}
  if(c.crashed){ctx.globalAlpha=.7;polygon([[8,-11],[17,-8],[12,0],[21,7],[3,9]],'#151515');ctx.globalAlpha=.35;glow(0,-19,28,'#9aa0a780');ctx.globalAlpha=1;}
  if(c===player.car&&Math.abs(c.velocity||0)>40){ctx.globalAlpha=.25;for(let k=0;k<3;k++)glow(-30-k*5,Math.sin(time*10+k)*4,7+k*2,'#d6dae855');ctx.globalAlpha=1}
  ctx.restore();
}
function drawPerson(x,y,angle,color,phase=0,isPlayer=false){
  ctx.fillStyle='#00080db0';ctx.beginPath();ctx.ellipse(x+4,y+5,9,5,angle,0,7);ctx.fill();
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  const stride=Math.sin(phase)*3;
  rounded(-7+stride,-6,9,4,2,'#18242e');rounded(-7-stride,2,9,4,2,'#18242e');
  rounded(-2,-9,11,18,5,color);rect(-1,-7,3,14,isPlayer?'#839078':'#ffffff20');
  rounded(3+stride,-10,6,4,2,'#c69d7c');rounded(3-stride,6,6,4,2,'#c69d7c');
  glow(5,0,5,'#00000065');ctx.fillStyle='#cda380';ctx.beginPath();ctx.arc(6,0,5,0,7);ctx.fill();
  ctx.fillStyle=isPlayer?'#0e1720':'#45362f';ctx.beginPath();ctx.arc(4,0,4.5,Math.PI/2,Math.PI*1.5);ctx.fill();ctx.restore();
}
const terrainTiles=new Map();
function drawTerrain(){
  const scale=(w<800?1.04:1.32)*viewZoom;
  const centerX=Math.max(worldMin+w/(2*scale),Math.min(size-w/(2*scale),camera.x));
  const centerY=Math.max(worldMin+h/(2*scale),Math.min(size-h/(2*scale),camera.y));
  const startCol=Math.max(minCell,Math.floor((centerX-w/(2*scale))/block));
  const endCol=Math.min(gridSize-1,Math.floor((centerX+w/(2*scale))/block));
  const startRow=Math.max(minCell,Math.floor((centerY-h/(2*scale))/block));
  const endRow=Math.min(gridSize-1,Math.floor((centerY+h/(2*scale))/block));
  for(let row=startRow;row<=endRow;row++)for(let col=startCol;col<=endCol;col++){
    const key=cellKey(row,col);
    let tile=terrainTiles.get(key);
    if(!tile){
      tile=document.createElement('canvas');tile.width=block;tile.height=block;
      const t=tile.getContext('2d');const type=cityBlocks[key].type;
      t.fillStyle=type==='villa'?'#446340':type==='park'?'#234036':type==='plaza'?'#3b4652':'#2b343d';t.fillRect(0,0,block,block);
      t.fillStyle='#586773';t.fillRect(0,0,70,block);t.fillRect(0,0,block,70);t.fillRect(348,0,52,block);t.fillRect(0,348,block,52);
      t.strokeStyle='#c4d0c020';t.lineWidth=1;
      for(let k=0;k<block;k+=16){t.beginPath();t.moveTo(54,k);t.lineTo(69,k);t.moveTo(k,54);t.lineTo(k,69);t.moveTo(349,k);t.lineTo(357,k);t.moveTo(k,349);t.lineTo(k,357);t.stroke()}
      t.fillStyle='#17232e';t.fillRect(0,0,52,block);t.fillRect(0,0,block,52);t.fillRect(358,0,42,block);t.fillRect(0,358,block,42);
      t.fillStyle='#b9c8c350';t.fillRect(43,130,1,188);t.fillRect(130,43,188,1);
      t.strokeStyle='#d9c79a70';t.setLineDash([20,22]);t.beginPath();t.moveTo(5,0);t.lineTo(5,block);t.moveTo(0,5);t.lineTo(block,5);t.stroke();t.setLineDash([]);
      t.fillStyle='#cad3c274';for(let k=0;k<7;k++){t.fillRect(0,76+k*8,39,4);t.fillRect(358,76+k*8,42,4);t.fillRect(76+k*8,0,4,39);t.fillRect(76+k*8,358,4,42)}
      let tileSeed=725+key*333;for(let i=0;i<2200;i++){tileSeed=(tileSeed*16807)%2147483647;const x=tileSeed%block;tileSeed=(tileSeed*16807)%2147483647;const y=tileSeed%block;t.fillStyle=i%2?'#d3eff00c':'#03090f25';t.fillRect(x,y,1+(i%3),1)}
      t.strokeStyle='#71859622';t.beginPath();t.moveTo(20,160);t.lineTo(27,182);t.lineTo(21,203);t.moveTo(164,27);t.lineTo(181,19);t.lineTo(195,28);t.stroke();
      if(type==='park'){t.fillStyle='#82755e';t.fillRect(191,72,20,270);t.fillRect(72,201,270,20);t.strokeStyle='#a5957730';t.strokeRect(77,77,261,261)}
      if(type==='plaza'){t.strokeStyle='#9faebb26';for(let k=75;k<345;k+=24){t.beginPath();t.moveTo(k,72);t.lineTo(k,343);t.moveTo(72,k);t.lineTo(343,k);t.stroke()}}
      if(type==='lot'||type==='parking'){t.fillStyle='#26313b';t.fillRect(80,80,258,260);t.strokeStyle='#e2d4ab88';for(let k=95;k<310;k+=35){t.strokeRect(k,100,30,55);t.strokeRect(k,255,30,55)}}
      if(type==='old'||type==='garden'){t.fillStyle=type==='garden'?'#39533e':'#4b4140';t.fillRect(120,120,165,165);t.strokeStyle='#bcb29a28';for(let k=120;k<285;k+=12){t.beginPath();t.moveTo(k,120);t.lineTo(k,285);t.stroke()}}
      if(pragueWeather.wet)for(const p of puddles){if(p.x>=col*block&&p.x<(col+1)*block&&p.y>=row*block&&p.y<(row+1)*block&&!collision(p.x,p.y,2)){t.fillStyle='#7297b82b';t.beginPath();t.ellipse(p.x-col*block,p.y-row*block,p.r*2,p.r,.3,0,7);t.fill()}}
      terrainTiles.set(key,tile);if(terrainTiles.size>32)terrainTiles.delete(terrainTiles.keys().next().value);
    }
    ctx.drawImage(tile,col*block,row*block);
  }
}
function drawTree(x,y,radius=17){
  ctx.fillStyle='#000d1b55';ctx.beginPath();ctx.ellipse(x+11,y+12,radius*1.2,radius*.7,.5,0,7);ctx.fill();
  const g=ctx.createRadialGradient(x-6,y-8,1,x,y,radius*1.2);g.addColorStop(0,'#61826d');g.addColorStop(.5,'#2e5748');g.addColorStop(1,'#142f30');
  for(let k=0;k<6;k++){ctx.fillStyle=g;ctx.beginPath();ctx.arc(x+Math.sin(k*2.4)*radius*.38,y+Math.cos(k*2.4)*radius*.38,radius*.7,0,7);ctx.fill()}
}
function drawStreetNames(){
  const streets=[{x:240,y:405,name:'SEIFERTOVA'},{x:2040,y:2005,name:'VINOHRADSKÁ'},{x:440,y:2005,name:'KŘIŽÍKOVA'},{x:3640,y:805,name:'VÁCLAVSKÉ NÁM.'},{x:2440,y:3605,name:'PŘÍSTAVNÍ'}];
  ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillStyle='#e7e9db38';
  for(const street of streets)if(visible(street.x,street.y))ctx.fillText(street.name,street.x,street.y+22);
}
function drawLandmarks(){
  for(const area of cityBlocks){
    if(!visible(area.x+200,area.y+200,400))continue;
    const x=area.x,y=area.y;
    if(area.type==='villa'){for(const tx of [94,245,310])for(const ty of [108,290])drawTree(x+tx,y+ty,20);rect(x+80,y+315,255,3,'#b7ad86');rect(x+160,y+285,35,28,'#82b4bd');}
    if(area.type==='park'){
      for(const tx of [113,155,258,306])for(const ty of [113,163,260,312])drawTree(x+tx,y+ty,18);
      ctx.fillStyle='#768a8d';ctx.beginPath();ctx.arc(x+201,y+211,31,0,7);ctx.fill();ctx.fillStyle='#163e52';ctx.beginPath();ctx.arc(x+201,y+211,25,0,7);ctx.fill();glow(x+201,y+211,35,'#62d6ec40');
      for(let k=0;k<5;k++){ctx.strokeStyle='#8edbef80';ctx.beginPath();ctx.ellipse(x+201,y+211,6+k*4,4+k*3,0,0,7);ctx.stroke()}
      for(const bx of [155,235]){rounded(x+bx,y+237,23,7,2,'#9d7955');rect(x+bx,y+246,23,2,'#111e29')}
    }
    if(area.x===1200&&area.y===800){drawTower(x+201,y+161)}
    if(area.type==='plaza'){
      rounded(x+148,y+152,108,108,12,'#73898d');rounded(x+155,y+159,94,94,10,'#194257');glow(x+200,y+200,90,'#47b8ed28');
      polygon([[x+188,y+188],[x+203,y+156],[x+220,y+188],[x+203,y+213]],'#8eb6c7');
      for(const tx of [105,304])for(const ty of [107,305])drawTree(x+tx,y+ty,21);
      ctx.font='12px Arial';ctx.textAlign='center';ctx.fillStyle='#b6cbd0';ctx.fillText('NÁMĚSTÍ',x+202,y+322);
    }
    if(area.type==='parking'){rect(x+80,y+80,255,255,'#26313b');ctx.strokeStyle='#ddd7ba';for(let slot=0;slot<5;slot++){ctx.strokeRect(x+86+slot*43,y+97,39,63);ctx.strokeRect(x+86+slot*43,y+245,39,63)}ctx.fillStyle='#97c7ec';ctx.font='bold 24px Arial';ctx.fillText('P',x+210,y+207);}if(area.type==='lot'){
      for(let k=0;k<5;k++){const xx=x+98+k*43,yy=y+180;rounded(xx,yy,35,57,2,['#794642','#567379','#857453'][k%3]);rect(xx+3,yy+3,29,2,'#c9ba9a44');for(let r=0;r<5;r++)rect(xx+3,yy+10+r*8,29,1,'#131d2e66')}
      ctx.font='bold 16px Arial';ctx.fillStyle='#e6bf8e';ctx.textAlign='center';ctx.fillText('CARGO TERMINAL',x+208,y+85);
      for(let k=0;k<4;k++){ctx.fillStyle='#dbb567';ctx.beginPath();ctx.arc(x+95+k*62,y+335,3,0,7);ctx.fill()}
    }
  }
}
function drawTower(x,y){
  polygon([[x-14,y+18],[x+25,y+27],[x+62,y+70],[x+20,y+62]],'#020b1477');
  for(const offset of [-15,0,15]){rect(x+offset-3,y-85,6,100,'#91a4ae');rect(x+offset-2,y-85,2,96,'#d1dce0')}
  rounded(x-31,y-64,62,21,8,'#c7d4da');rounded(x-23,y-103,46,19,6,'#adbec8');
  rect(x-17,y-98,35,7,'#244b68');rect(x-25,y-59,49,8,'#32637c');
  rect(x-2,y-150,4,47,'#b0c4cc');glow(x,y-150,15,'#ff485d70');rect(x-2,y-153,4,4,'#ff6276');
  ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillStyle='#b0c9d1';ctx.fillText('ŽIŽKOVSKÁ VĚŽ',x,y+40);
}
function drawStreetProps(){
  for(let row=minCell;row<gridSize;row++)for(let col=minCell;col<gridSize;col++){
    const x=col*block+65,y=row*block+180;if(!visible(x,y))continue;
    rect(x-6,y+4,16,22,'#060f1766');rounded(x-8,y,13,20,2,'#326660');rect(x-9,y,15,3,'#779d88');rect(x-5,y+5,7,1,'#0c302b');
    rect(x-3,y+56,5,32,'#080e16');rect(x-5,y+55,10,3,'#e1b766');
    glow(x+275,y+94,23,'#000b1380');ctx.fillStyle='#1e5550';for(let k=0;k<5;k++){ctx.beginPath();ctx.arc(x+272+Math.sin(k*2)*8,y+88+Math.cos(k*2)*8,12,0,7);ctx.fill()}ctx.fillStyle='#467a6260';ctx.beginPath();ctx.arc(x+268,y+85,10,0,7);ctx.fill();
  }
}
function drawTrafficLights(){
  for(const light of trafficLights){
    if(!visible(light.x,light.y,90))continue;
    const state=trafficState(light),x=light.x-18,y=light.y-18;
    rect(x-2,y-2,4,33,'#111a24');rounded(x-8,y-13,14,25,3,'#091018');
    rounded(x-5,y-10,8,8,4,state.eastWest==='red'?'#ff3049':'#3a1118');
    rounded(x-5,y+1,8,8,4,state.eastWest==='green'?'#62e36f':'#112a18');
    glow(x-1,y+(state.eastWest==='red'?-6:5),18,state.eastWest==='red'?'#ff304955':'#62e36f44');
    const x2=light.x+16,y2=light.y+16;
    rect(x2-2,y2-24,4,33,'#111a24');rounded(x2-8,y2-34,14,25,3,'#091018');
    rounded(x2-5,y2-31,8,8,4,state.northSouth==='red'?'#ff3049':'#3a1118');
    rounded(x2-5,y2-20,8,8,4,state.northSouth==='green'?'#62e36f':'#112a18');
    glow(x2-1,y2+(state.northSouth==='red'?-27:-16),18,state.northSouth==='red'?'#ff304955':'#62e36f44');
  }
}
function drawEmergencyIncidents(){
  for(const incident of incidents){
    if(!visible(incident.x,incident.y,220))continue;
    glow(incident.x,incident.y,70,'#ff6b3d25');
    ctx.fillStyle='#111923dd';ctx.beginPath();ctx.arc(incident.x,incident.y,22+Math.sin(time*6)*2,0,7);ctx.fill();
    ctx.strokeStyle='#ffcc66';ctx.lineWidth=2;ctx.beginPath();ctx.arc(incident.x,incident.y,29,0,7);ctx.stroke();
    ctx.fillStyle='#ffcc66';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('NEHODA',incident.x,incident.y-35);
    ctx.globalAlpha=.35;for(let k=0;k<5;k++){ctx.fillStyle='#9aa0a7';ctx.beginPath();ctx.arc(incident.x-12+k*6+Math.sin(time+k)*5,incident.y-24-k*9,9+k*2,0,7);ctx.fill()}ctx.globalAlpha=1;
    for(const member of incident.crew)drawPerson(member.x,member.y,-Math.PI/2,member.color,time*7,false);
  }
}

function drawBoundaryFog2d() {
  const band = 900;
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const horizontal = edge === 'left' || edge === 'right';
    const reversed = edge === 'right' || edge === 'bottom';
    const outside = reversed ? size : worldMin;
    const inside = reversed ? size-band : worldMin+band;
    const gradient = horizontal ? ctx.createLinearGradient(outside, 0, inside, 0) : ctx.createLinearGradient(0, outside, 0, inside);
    gradient.addColorStop(0, '#465768');
    gradient.addColorStop(.4, '#465768cc');
    gradient.addColorStop(1, '#46576800');
    ctx.fillStyle = gradient;
    if (horizontal) ctx.fillRect(reversed ? size-band : worldMin, worldMin, band, worldSpan);
    else ctx.fillRect(worldMin, reversed ? size-band : worldMin, worldSpan, band);
  }
}
function atmosphereColors() {
  const phase = pragueWeather.phase;
  const base = phase === 'morning' ? { sky: '#16283a', tint: '#ffd28a12', haze: '#ffdfaa18' } : phase === 'day' ? { sky: '#1b3343', tint: '#9fd7ff10', haze: '#d9f3ff13' } : phase === 'evening' ? { sky: '#1a2438', tint: '#ff9f6514', haze: '#ffbf8f18' } : { sky: '#0b1723', tint: '#435c8f17', haze: '#9fb8dc0b' };
  if (pragueWeather.condition === 'fog') return { ...base, sky: '#283745', tint: '#d5e6ea22', haze: '#d7e5eacc' };
  if (['rain', 'drizzle', 'storm'].includes(pragueWeather.condition)) return { ...base, sky: '#0d1a25', tint: '#6c89a626', haze: '#9fb8dc22' };
  if (pragueWeather.condition === 'snow') return { ...base, sky: '#233140', tint: '#d8ecff24', haze: '#edf7ff26' };
  if (pragueWeather.condition === 'cloudy') return { ...base, sky: '#172432', tint: '#9fb0bd17', haze: '#c8d5df1b' };
  return base;
}
function drawWeatherOverlay() {
  const colors = atmosphereColors();
  rect(0,0,w,h,colors.tint);
  const top=ctx.createLinearGradient(0,0,0,h);top.addColorStop(0,colors.haze);top.addColorStop(.55,'#00000000');top.addColorStop(1,pragueWeather.phase==='night'?'#02081334':'#ffffff05');rect(0,0,w,h,top);
  if (pragueWeather.condition === 'fog') {
    for (let layer=0;layer<5;layer++) {
      ctx.globalAlpha=.08+layer*.025;ctx.fillStyle='#d7e5ea';
      const y=(time*10+layer*93)%h;
      ctx.beginPath();ctx.ellipse(w*.25+Math.sin(time*.2+layer)*90,y,w*.55,42+layer*9,0,0,7);ctx.ellipse(w*.75+Math.cos(time*.17+layer)*90,(y+160)%h,w*.5,38+layer*7,0,0,7);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  if (['rain','drizzle','storm'].includes(pragueWeather.condition)) {
    ctx.strokeStyle=pragueWeather.condition==='drizzle'?'#c3e3ff18':'#c3e3ff28';ctx.lineWidth=pragueWeather.condition==='storm'?1.4:1;ctx.beginPath();
    const count=pragueWeather.condition==='drizzle'?Math.min(90,Math.floor(w/12)):Math.min(190,Math.floor(w/7));
    for(let i=0;i<count;i++){const rx=(i*137.7+time*(pragueWeather.condition==='storm'?110:70))%w,ry=(i*91.3+time*(pragueWeather.condition==='drizzle'?260:480))%h;ctx.moveTo(rx,ry);ctx.lineTo(rx-4,ry+(pragueWeather.condition==='drizzle'?8:15))}
    ctx.stroke();
    if(pragueWeather.condition==='storm'&&Math.sin(time*3.7)>.985)rect(0,0,w,h,'#e8f3ff2a');
  }
  if (pragueWeather.condition === 'snow') {
    ctx.fillStyle='#f4fbffbd';
    const count=Math.min(130,Math.floor(w/9));
    for(let i=0;i<count;i++){const rx=(i*83.1+Math.sin(time*.45+i)*22)%w,ry=(i*71.7+time*46)%h;ctx.beginPath();ctx.arc(rx,ry,1.2+(i%3)*.45,0,7);ctx.fill();}
  }
}
function markerTint(color, alpha) { return /^#[0-9a-f]{6}$/i.test(color) ? color + alpha : color; }
function drawWorldNpcMarkers() {
  for (const marker of importantNpcMarkers()) {
    if (!visible(marker.x, marker.y, 130)) continue;
    const bob = Math.sin(time * 3 + marker.x * .01) * 2, y = marker.y - 46 + bob;
    glow(marker.x, marker.y - 18, 46, markerTint(marker.color, '30'));
    ctx.beginPath();
    ctx.roundRect(marker.x - 25, y - 14, 50, 20, 5);
    ctx.fillStyle = '#07101de6';
    ctx.fill();
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    polygon([[marker.x, y + 10], [marker.x - 5, y + 17], [marker.x + 5, y + 17]], marker.color);
    ctx.fillStyle = marker.color;
    ctx.font = '800 8px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(marker.short, marker.x, y - 1);
  }
}

function renderLegacy(){if(interior){renderInterior2d();return;}
  ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,atmosphereColors().sky);ctx.save();
  const scale=(w<800?1.04:1.32)*viewZoom;
  const viewX=Math.max(worldMin+w/(2*scale),Math.min(size-w/(2*scale),camera.x));
  const viewY=Math.max(worldMin+h/(2*scale),Math.min(size-h/(2*scale),camera.y));
  ctx.translate(w/2-viewX*scale,h/2-viewY*scale);ctx.scale(scale,scale);
  drawTerrain();drawLandmarks();drawStreetProps();drawTrafficLights();drawStreetNames();
  for(const b of visibleBuildingList())if(visible(b.x+b.w/2,b.y+b.h/2))drawBuilding(b);
  for(const l of lamps){if(!visible(l.x,l.y,130))continue;glow(l.x,l.y,130,'#ffc27b29');ctx.strokeStyle='#0a1622';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(l.x,l.y+10);ctx.lineTo(l.x-5,l.y-12);ctx.lineTo(l.x+6,l.y-18);ctx.stroke();glow(l.x+6,l.y-18,12,'#fff0bcdf');rounded(l.x+1,l.y-20,10,4,2,'#fff0b9')}
  for(const p of people)if(visible(p.x,p.y,30))drawPerson(p.x,p.y,p.axis?(p.dir>0?0:Math.PI):(p.dir>0?Math.PI/2:-Math.PI/2),p.color,time*7);
  for(const c of cars)if(visible(c.x,c.y,160))drawCar(c);
  drawEmergencyIncidents();
  if(targetAvailable()){const m=mission();glow(m.x,m.y,60,'#ae7bfa23');drawPerson(m.x,m.y,-Math.PI/2,'#7c5185');ctx.strokeStyle='#c5f46b';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(m.x,m.y,23+Math.sin(time*3),15,0,0,7);ctx.stroke();ctx.fillStyle='#c5f46b';polygon([[m.x,m.y-29+Math.sin(time*2)*3],[m.x-5,m.y-37+Math.sin(time*2)*3],[m.x+5,m.y-37+Math.sin(time*2)*3]],'#c5f46b');ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(m.speaker,m.x,m.y-48)}
  drawWorldNpcMarkers();
  if(!player.car&&!transitRide){drawPerson(player.x,player.y,player.angle,'#2d3945',player.step,true);ctx.strokeStyle='#37d6ffee';ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,15,0,7);ctx.stroke()}
  drawBoundaryFog2d();
  ctx.restore();
  drawDistrictAtmosphere();
  drawWeatherOverlay();
  drawMap();if(player.car){ctx.font='700 26px Arial';ctx.textAlign='right';ctx.fillStyle='#c5f46b';ctx.fillText(Math.round(Math.abs(player.car.velocity||0)*.35)+' km/h',w-35,h-235)}
}

function drawDistrictAtmosphere(){
  const district=districtAt(camera.x,camera.y);
  const tint=district.style==='industrial'?'#e2974d08':district.style==='old'?'#d19f7507':district.style==='modern'?'#48bbff09':'#9b5dc908';
  rect(0,0,w,h,tint);
  const colors=atmosphereColors(),haze=ctx.createLinearGradient(0,0,0,h);haze.addColorStop(0,colors.haze);haze.addColorStop(.5,'#9fb8dc00');haze.addColorStop(1,pragueWeather.phase==='day'?'#030c1608':'#030c1620');rect(0,0,w,h,haze);
}
function drawMap(){
  const mw=w<800?115:190,x=w-mw-26,y=h-mw-76,zoom=nearbyMapZoom;
  const span=worldSpan/zoom,s=mw/span,cx=mapExpanded&&cityMapZoom===1?(size+worldMin)/2:Math.max(worldMin+span/2,Math.min(size-span/2,player.x)),cy=mapExpanded&&cityMapZoom===1?(size+worldMin)/2:Math.max(worldMin+span/2,Math.min(size-span/2,player.y));
  rect(x-8,y-8,mw+16,mw+16,'#080f18ed');ctx.save();ctx.beginPath();ctx.rect(x,y,mw,mw);ctx.clip();ctx.translate(x-(cx-span/2)*s,y-(cy-span/2)*s);
  rect(worldMin*s,worldMin*s,worldSpan*s,worldSpan*s,'#24353e');
  for(const area of cityBlocks){rect(area.x*s,area.y*s,block*s,block*s,area.type==='park'?'#365c48':area.type==='modern'?'#2e495a':area.type==='industrial'?'#4c4440':'#2c3840')}
  for(let i=minCell;i<gridSize;i++){rect(i*block*s,worldMin*s,52*s,worldSpan*s,'#69787f');rect(worldMin*s,i*block*s,worldSpan*s,52*s,'#69787f')}
  for(const b of buildings)rect(b.x*s,b.y*s,b.w*s,b.h*s,'#0d1b28');
  window.lifeCityMap?.drawRadarRoute(ctx,s);
  for (const marker of importantNpcMarkers(true)) {
    const radius = marker.target ? 4.8 : 3.2;
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(marker.x*s,marker.y*s,radius,0,7);
    ctx.fill();
    if (mapExpanded) {
      ctx.font = marker.target ? 'bold 9px Arial' : 'bold 7px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = marker.target ? '#eaffb7' : '#f4f1e6';
      ctx.fillText(marker.short,marker.x*s,marker.y*s-7);
    }
  }
  for(const c of cars.filter(c=>c.police)){ctx.fillStyle='#5c99ef';ctx.fillRect(c.x*s,c.y*s,3,3)}
  for(const c of emergencyVehicles){ctx.fillStyle=c.service==='fire'?'#ff5c3f':c.service==='ambulance'?'#f1f7f2':'#5c99ef';ctx.fillRect(c.x*s-1.5,c.y*s-1.5,4,4)}
  for(const incident of incidents){ctx.fillStyle='#ffcc66';ctx.beginPath();ctx.arc(incident.x*s,incident.y*s,4.5,0,7);ctx.fill();if(mapExpanded){ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText('NEHODA',incident.x*s,incident.y*s-7)}}
  if(mapExpanded){ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillStyle='#e3e7dc';for(const label of [{x:5000,y:3300,name:'ŽIŽKOV'},{x:8000,y:10000,name:'VINOHRADY'},{x:9000,y:11600,name:'ZAHRADNÍ MĚSTO'},{x:1800,y:9500,name:'KARLÍN'},{x:15800,y:6500,name:'CENTRUM'},{x:10000,y:16800,name:'HOLEŠOVICE'}])ctx.fillText(label.name,label.x*s,label.y*s)}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x*s,player.y*s,4,0,7);ctx.fill();ctx.restore();ctx.font='10px Arial';ctx.textAlign='left';ctx.fillStyle='#bdcad1';ctx.fillText(mapExpanded?'CELÉ MĚSTO · [M]':'OKOLÍ · [M] CELÉ MĚSTO',x,y-17);
}
let mapExpanded=false;
canvas.addEventListener?.('pointerup',event=>{
  const bounds=canvas.getBoundingClientRect(),px=event.clientX-bounds.left,py=event.clientY-bounds.top;
  const mapWidth=w<800?115:190,mapX=w-mapWidth-26,mapY=h-mapWidth-76;
  if(px>=mapX-8&&px<=mapX+mapWidth+8&&py>=mapY-24&&py<=mapY+mapWidth+8)window.lifeCityMap?.toggle();
});
const levelThresholds=[0,120,300,560,900,1320,1820,2400];
const substances=[
  {id:'herb',name:'Konopí',category:'Konopné látky',level:1,reward:1800,xp:70,risk:.65,color:'#91c77e'},
  {id:'resin',name:'Hašiš',category:'Konopné koncentráty',level:2,reward:2900,xp:95,risk:1,color:'#d1ad70'},
  {id:'stim',name:'Stimulanty',category:'Stimulanty',level:3,reward:4400,xp:125,risk:1.5,color:'#e8c474'},
  {id:'psyche',name:'Psychedelika',category:'Psychedelika',level:4,reward:6200,xp:155,risk:2,color:'#b9a0ed'},
  {id:'synthetic',name:'Syntetické látky',category:'Syntetické látky',level:6,reward:9200,xp:200,risk:2.7,color:'#69cbdc'},
  {id:'opiate',name:'Opiáty',category:'Opiáty',level:8,reward:14500,xp:260,risk:3.6,color:'#e99da8'}
];
const deliveryRoutes=[
  {x:465,y:455,label:'Kontakt · Karlín'},
  {x:8065,y:8455,label:'Kontakt · Vinohrady'},
  {x:14465,y:4855,label:'Kontakt · centrum'},
  {x:5265,y:15655,label:'Kontakt · doky'},
  {x:865,y:7655,label:'Kontakt · Karlín'}
];
let activeContract=null,contractCount=0;
const districtContacts=[
  {id:'zizkov',district:'ŽIŽKOV',speaker:'LENKA · SOUSEDKA',x:667,y:455},
  {id:'karlin',district:'KARLÍN',speaker:'ADAM · KURÝR',x:867,y:7655},
  {id:'vinohrady',district:'VINOHRADY',speaker:'TEREZA · FLORISTKA',x:8067,y:8455},
  {id:'zahradni',district:'ZAHRADNÍ MĚSTO',speaker:'MÍRA · KNIHOVNÍK',x:8867,y:11455},
  {id:'centrum',district:'NOVÉ MĚSTO',speaker:'MARTIN · ANALYTIK',x:14467,y:4855},
  {id:'docks',district:'HOLEŠOVICE · DOKY',speaker:'JIRKA · DISPEČER',x:5267,y:15655},
  ...pragueDistrictAnchors.map((d,i)=>({id:'p6-'+i,district:d.name,speaker:['ALENA · SPRÁVKYNĚ VIL','DAVID · SBĚRATEL','PETR · RESTAURÁTOR','KLÁRA · STUDENTKA','SOFIE · ZAHRADNICE','ONDŘEJ · PRŮVODCE'][i],x:Math.floor(d.x/block)*block+67,y:Math.floor(d.y/block)*block+255}))
];
const districtJobs=districtContacts.flatMap((contact,i)=>{
  const next=districtContacts[(i+1)%districtContacts.length];
  const topics=[['Sousedská výpomoc','Doruč ztracené klíče správci domu.'],['Ranní rozvoz','Doruč podklady do kavárny.'],['Květiny pro sousedy','Odnes objednávku na druhý konec čtvrti.'],['Tichá knihovna','Doruč učební materiály do Zahradního Města.'],['První investiční analýza','Doruč analytické podklady brokerovi.'],['Dokumenty z doků','Předej přepravní listy dispečerovi.'],['Zahrady Ořechovky','Doruč plán obnovy zahrady majiteli vily.'],['Veterán na Hanspaulce','Odnes servisní dokumentaci sběrateli.'],['Oprava fasády','Předej návrh restaurátorovi.'],['Studentská brigáda','Doruč vybavení pro univerzitní projekt.'],['Zelená Bubeneč','Předej sazenice správci parku.'],['Hradčanská procházka','Dones průvodci podklady pro novou trasu.']];
  return [
    {id:contact.id+'-1',contactId:contact.id,district:contact.district,title:topics[i][0],text:topics[i][1],receiver:'MÍSTNÍ KONTAKT',target:{x:contact.x+400,y:contact.y,label:'Předání · '+contact.district},reward:900+i*350,xp:65+i*5},
    {id:contact.id+'-2',contactId:contact.id,district:contact.district,title:'Kontakty za hranicí čtvrti',text:'Doruč doporučení kontaktu ve čtvrti '+next.district+'.',receiver:next.speaker,target:{x:next.x,y:next.y,label:next.speaker},reward:2100+i*500,xp:110+i*5,requires:contact.id+'-1'}
  ];
});
let activeDistrictJob=null,completedDistrictJobs=[];
for(const contact of districtContacts)people.push({x:contact.x,y:contact.y,angle:-Math.PI/2,color:'#d3a766',stationary:true,role:'quest',contactId:contact.id});
for(let i=0;i<700;i++){const axis=i%2===0;people.push({x:axis?between(worldMin,0):Math.floor(between(minCell,0))*block+67,y:axis?Math.floor(between(minCell,0))*block+67:between(worldMin,0),axis,dir:i%3?1:-1,color:i%2?'#73816a':'#755c72'});}
for(let i=0;i<90;i++){const model=lifeSystem.vehicleCatalog[i%lifeSystem.vehicleCatalog.length];cars.push({x:Math.floor(between(minCell,0))*block+35,y:Math.floor(between(minCell,0))*block+35,axis:i%2===0,angle:i%2?Math.PI/2:0,speed:between(40,80),parked:false,color:model.color,vehicleClass:model.body,modelId:model.id,luxury:true});}
function nearestDistrictContact(){return interior||player.car?null:districtContacts.find(contact=>distance(player,contact)<45)||null;}
function showDistrictJobs(contact=null){
  if(!started||paused||dialogOpen||interior)return false;
  dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('choices').replaceChildren();
  $('speaker').textContent=contact?contact.speaker:'MĚSTSKÉ KONTAKTY';$('dialogTitle').textContent=contact?contact.district:'Úkoly ze všech čtvrtí';
  $('dialogText').textContent=activeDistrictJob?'Aktivní úkol sleduj na mapě. Po dokončení se vrátí hlavní příběh.':'Místní lidé mají práci. První úkol odemkne navazující cestu do další čtvrti. Vyber trasu a dojdi na označené místo.';
  for(const job of districtJobs.filter(job=>!contact||job.contactId===contact.id)){
    const done=completedDistrictJobs.includes(job.id),unlocked=!job.requires||completedDistrictJobs.includes(job.requires),button=document.createElement('button');
    button.textContent=job.district+' · '+job.title+' · '+formatMoney(job.reward)+' · '+job.xp+' XP'+(done?' · HOTOVO':!unlocked?' · nejdřív dokonči místní úkol':'');
    button.disabled=done||!unlocked||Boolean(activeDistrictJob)||Boolean(activeContract);
    button.onclick=()=>acceptDistrictJob(job.id);$('choices').append(button);
  }
  if(activeDistrictJob){const cancel=document.createElement('button');cancel.textContent='Zrušit místní úkol';cancel.onclick=()=>{activeDistrictJob=null;closeContracts();saveProgress();updateHud();};$('choices').append(cancel);}
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=closeContracts;$('choices').append(close);return true;
}
function acceptDistrictJob(id){
  const job=districtJobs.find(item=>item.id===id);
  if(!started||interior||activeDistrictJob||activeContract||!job||completedDistrictJobs.includes(id)||(job.requires&&!completedDistrictJobs.includes(job.requires)))return false;
  activeDistrictJob=id;closeContracts();saveProgress();updateHud();notify('Přijato · '+job.title);return true;
}
function completeDistrictJob(){
  const job=districtJobs.find(item=>item.id===activeDistrictJob);
  if(!job||interior||distance(player,job.target)>=65||completedDistrictJobs.includes(job.id))return false;
  completedDistrictJobs.push(job.id);activeDistrictJob=null;player.cash=Math.min(1000000,player.cash+job.reward);player.rep+=10;awardXp(job.xp);saveProgress();updateHud();notify('Hotovo · +'+formatMoney(job.reward)+' · +'+job.xp+' XP');return true;
}

function playerLevel(){let level=1;while(level<levelThresholds.length&&player.xp>=levelThresholds[level])level++;return level}
function awardXp(amount){
  const oldLevel=playerLevel();player.xp+=amount;
  if(playerLevel()>oldLevel){const unlocked=substances.filter(item=>item.level>oldLevel&&item.level<=playerLevel());notify('LEVEL '+playerLevel()+' · '+(unlocked.length?'Odemčeno: '+unlocked.map(item=>item.name).join(', '):'Nová úroveň zkušeností'));}
  saveProgress();
}
function unlockPoliceWeapons(){
  let changed=false;
  for(const weapon of policeWeapons){
    if(!unlockedWeapons.includes(weapon.id)){unlockedWeapons.push(weapon.id);changed=true;}
    if(!hasInventoryItem(weapon.id))addInventoryItem(weapon.id);
  }
  if(!hasInventoryItem('policeCertificate'))addInventoryItem('policeCertificate');
  if(changed)recordLog('Policie: dokončen 20otázkový test a odemčen bezpečnostní arzenál.');
  return changed;
}
function renderPoliceKnowledgeQuestion(){
  const question=policeKnowledgeQuestions[policeKnowledgeState.index];
  $('speaker').textContent='POLICIE ČR · TEST '+(policeKnowledgeState.index+1)+'/20';
  $('dialogTitle').textContent='Vědomostní test bezpečnosti';
  $('dialogText').textContent=question.question+' · skóre '+policeKnowledgeState.score+'/'+policeKnowledgeState.index;
  $('choices').replaceChildren();
  question.choices.forEach((choice,index)=>{const button=document.createElement('button');button.textContent=choice;button.onclick=()=>answerPoliceKnowledgeTest(index);$('choices').append(button);});
}
function startPoliceKnowledgeTest(){
  if(!dialogOpen||lifeMenu!=='service'||lifeServiceKind()!=='police'||distance(player,lifeServicePoint())>45||policeKnowledgeState.passed)return false;
  policeKnowledgeState={passed:false,active:true,index:0,score:0};recordLog('Policie: zahájen 20otázkový vědomostní test.');renderPoliceKnowledgeQuestion();return true;
}
function answerPoliceKnowledgeTest(index){
  if(!dialogOpen||lifeMenu!=='service'||lifeServiceKind()!=='police'||!policeKnowledgeState.active)return false;
  const question=policeKnowledgeQuestions[policeKnowledgeState.index];
  if(!question||!Number.isInteger(index))return false;
  if(index===question.answer)policeKnowledgeState.score++;
  policeKnowledgeState.index++;
  if(policeKnowledgeState.index<policeKnowledgeQuestions.length){renderPoliceKnowledgeQuestion();return true;}
  const passed=policeKnowledgeState.score>=16;
  policeKnowledgeState={passed,active:false,index:policeKnowledgeQuestions.length,score:policeKnowledgeState.score};
  if(passed){unlockPoliceWeapons();awardXp(120);notify('Test hotový · zbraně odemčeny u policie');}
  else{recordLog('Policie: test nedokončen úspěšně, skóre '+policeKnowledgeState.score+'/20.');notify('Test hotový · skóre '+policeKnowledgeState.score+'/20 · zkus to znovu');}
  saveProgress();updateHud();const menu=lifeMenu;closeContracts();openLifeMenu(menu);return passed;
}
function finishHighSchool(method='škola'){
  if(educationState.highSchool)return false;
  if(method==='samostudium'?educationState.studyPoints<6:!canFinishHighSchool())return false;
  educationState.highSchool=true;educationState.method=method;educationState.betterJobs=true;
  addInventoryItem('diploma');recordLog('Vzdělání: střední škola dokončena cestou '+method+'. Lepší práce jsou dostupné na úřadu práce.');
  awardXp(180);player.rep+=15;saveProgress();updateHud();notify('Střední škola hotová · lepší práce odemčeny');return true;
}
function studyAt(kind){
  if(!dialogOpen||lifeMenu!=='service'||lifeServiceKind()!==kind||distance(player,lifeServicePoint())>45||educationState.highSchool)return false;
  const gain=kind==='library'?2:1;
  educationState.studyPoints=Math.min(6,educationState.studyPoints+gain);
  if(kind==='library'&&!hasInventoryItem('libraryCard'))addInventoryItem('libraryCard');
  if(kind==='internet'&&!hasInventoryItem('webNotes'))addInventoryItem('webNotes');
  recordLog((kind==='library'?'Knihovna':'Fake internet')+': samostudium +'+gain+' bodů ('+educationState.studyPoints+'/6).');
  awardXp(kind==='library'?55:35);
  if(educationState.studyPoints>=6)finishHighSchool('samostudium');
  saveProgress();updateHud();const menu=lifeMenu;closeContracts();openLifeMenu(menu);return true;
}
function takeBetterJob(id){
  const job=betterJobs.find(item=>item.id===id);
  if(!dialogOpen||lifeMenu!=='service'||lifeServiceKind()!=='office'||distance(player,lifeServicePoint())>45||!job||!educationState.betterJobs||playerLevel()<job.level)return false;
  player.cash=Math.min(1000000,player.cash+job.reward);player.rep+=job.rep;recordLog('Práce: '+job.title+' dokončena za '+formatMoney(job.reward)+'.');
  awardXp(job.xp);saveProgress();updateHud();notify(job.title+' · +'+formatMoney(job.reward)+' · +'+job.xp+' XP');const menu=lifeMenu;closeContracts();openLifeMenu(menu);return true;
}
function openInventory(){
  if(!started||paused||dialogOpen)return false;
  lifeMenu=null;dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('choices').replaceChildren();
  $('speaker').textContent='INVENTÁŘ · '+inventoryCount()+'/'+inventoryCapacity();$('dialogTitle').textContent='Batoh, doklady a vybavení';
  $('dialogText').textContent=educationStatusText()+' · zbraně '+(unlockedWeapons.length?unlockedWeapons.map(inventoryName).join(', '):'zamčené u policie')+'.';
  for(const item of inventory){const meta=inventoryCatalog[item.id]||{};choiceInfo((meta.type||'item').toUpperCase()+' · '+inventoryName(item.id)+(item.qty>1?' ×'+item.qty:''));}
  if(!inventory.length)choiceInfo('Inventář je prázdný.');
  const log=document.createElement('button');log.textContent='Otevřít log novinek';log.onclick=()=>{closeContracts();openLogList();};$('choices').append(log);
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=closeContracts;$('choices').append(close);return true;
}
function openLogList(){
  if(!started||paused||dialogOpen)return false;
  lifeMenu=null;dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('choices').replaceChildren();
  $('speaker').textContent='LOG LIST';$('dialogTitle').textContent='Novinky a události';
  $('dialogText').textContent='Seznam posledních systémových novinek a herních odemčení.';
  for(const item of gameplayLog.slice(-18).reverse())choiceInfo('Den '+item.day+' · '+item.text);
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=closeContracts;$('choices').append(close);return true;
}
function targetAvailable(){return Boolean(activeDistrictJob)||Boolean(activeContract)||!complete}
function updateProgressionHud(){
  const level=playerLevel(),minimum=levelThresholds[level-1],maximum=levelThresholds[level];
  $('level').textContent=level;$('xpText').textContent=maximum?(player.xp-minimum)+' / '+(maximum-minimum)+' XP':'MAX LEVEL · '+player.xp+' XP';
  $('xpFill').style.width=(maximum?Math.min(100,(player.xp-minimum)/(maximum-minimum)*100):100)+'%';
  $('currentCargo').textContent=activeContract?substances.find(item=>item.id===activeContract.substanceId).name:missionIndex===1&&!legal&&!complete?'Konopí':'Bez zakázky';
}
function openContracts(){
  if(!started||paused||dialogOpen)return;
  if(interior){notify('Kontakty jsou dostupné na ulici.');return;}
  dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('speaker').textContent='KONTAKTY · LEVEL '+playerLevel();$('dialogTitle').textContent='Zakázky z ulice';
  $('dialogText').textContent=activeContract?'Aktivní zásilka: '+substances.find(item=>item.id===activeContract.substanceId).name+'. Doruč ji označenému kontaktu.':complete?'Vyber zakázku. Dražší kategorie se odemykají s levelem. Odměny jsou herní hodnoty.':'Další zakázky se zpřístupní po dokončení první kapitoly. Kategorie můžeš prohlédnout už teď.';
  $('choices').replaceChildren();
  const districtButton=document.createElement('button');districtButton.textContent='Místní úkoly · všechny čtvrti';districtButton.onclick=()=>{closeContracts();showDistrictJobs();};$('choices').append(districtButton);
  for(const item of substances){
    const button=document.createElement('button'),unlocked=playerLevel()>=item.level;
    button.className='substanceCard';button.style.borderLeftColor=item.color;
    const title=document.createElement('strong');title.textContent=item.name+' · LVL '+item.level;
    const details=document.createElement('span');details.textContent=unlocked?item.category+' · '+item.reward.toLocaleString('cs-CZ')+' Kč · '+item.xp+' XP · riziko '+Math.ceil(item.risk)+'/5':'Zamčeno · odemkne se na levelu '+item.level;
    button.append(title,details);button.disabled=!unlocked||!complete||Boolean(activeContract)||Boolean(activeDistrictJob);button.onclick=()=>acceptContract(item.id);$('choices').append(button);
  }
  if(activeContract){const cancel=document.createElement('button');cancel.textContent='Zrušit zakázku (bez odměny a XP)';cancel.onclick=()=>{activeContract=null;closeContracts();saveProgress();updateHud();notify('Zakázka zrušena.');};$('choices').append(cancel)}
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=closeContracts;$('choices').append(close);
}
function closeContracts(){$('dialog').classList.remove('marketDialog');lifeMenu=null;activeShop=null;dialogOpen=false;$('dialog').classList.add('hidden');keys.clear()}
function acceptContract(id){
  const item=substances.find(entry=>entry.id===id);
  if(!item||!complete||activeContract||activeDistrictJob||playerLevel()<item.level)return false;
  activeContract={substanceId:id,routeIndex:contractCount%deliveryRoutes.length};
  player.heat=Math.min(5,player.heat+item.risk);closeContracts();saveProgress();updateHud();notify(item.name+' · zakázka přijata');return true;
}
function completeContract(){
  if(!activeContract||distance(player,mission())>=65)return false;
  const item=substances.find(entry=>entry.id===activeContract.substanceId);
  activeContract=null;contractCount++;player.cash+=item.reward;player.rep+=Math.ceil(item.xp/10);
  notify('Doručeno: '+item.name+' · +'+item.reward.toLocaleString('cs-CZ')+' Kč · +'+item.xp+' XP');awardXp(item.xp);saveProgress();updateHud();return true;
}
function saveProgress(){
  try{syncOwnedVehiclePositions();localStorage.setItem('street-life-progress-v1',JSON.stringify({version:1,life:lifeState,health:player.health,xp:player.xp,cash:player.cash,rep:player.rep,missionIndex,legal,complete,storyPath,activeContract,contractCount,activeDistrictJob,completedDistrictJobs,inventory,educationState,policeKnowledge:{passed:policeKnowledgeState.passed,score:policeKnowledgeState.score},unlockedWeapons,gameplayLog,playerPosition:interior?interior.outside:{x:player.x,y:player.y,angle:player.angle}}));}catch{}
}
function restoreProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem('street-life-progress-v1')||'null');if(!saved||saved.version!==1)return;
    if(!['xp','cash','rep','missionIndex','contractCount'].every(key=>Number.isSafeInteger(saved[key])&&saved[key]>=0)||saved.missionIndex>missions.length-1||typeof saved.legal!=='boolean'||typeof saved.complete!=='boolean')return;
    completedDistrictJobs=Array.isArray(saved.completedDistrictJobs)?[...new Set(saved.completedDistrictJobs.filter(id=>districtJobs.some(job=>job.id===id)))]:[];
    inventory=Array.isArray(saved.inventory)?saved.inventory.filter(item=>item&&inventoryCatalog[item.id]&&Number.isSafeInteger(item.qty)&&item.qty>0&&item.qty<=99).map(item=>({id:item.id,qty:item.qty})):baseInventory();
    if(!inventory.length)inventory=baseInventory();
    const education=saved.educationState&&typeof saved.educationState==='object'?saved.educationState:{};
    educationState={studyPoints:Number.isSafeInteger(education.studyPoints)?Math.max(0,Math.min(6,education.studyPoints)):0,highSchool:Boolean(education.highSchool),method:typeof education.method==='string'?education.method:null,betterJobs:Boolean(education.betterJobs||education.highSchool)};
    const police=saved.policeKnowledge&&typeof saved.policeKnowledge==='object'?saved.policeKnowledge:{};
    policeKnowledgeState={passed:Boolean(police.passed),active:false,index:0,score:Number.isSafeInteger(police.score)?Math.max(0,Math.min(20,police.score)):0};
    unlockedWeapons=Array.isArray(saved.unlockedWeapons)?[...new Set(saved.unlockedWeapons.filter(id=>policeWeapons.some(weapon=>weapon.id===id)))]:[];
    if(policeKnowledgeState.passed)for(const weapon of policeWeapons)if(!unlockedWeapons.includes(weapon.id))unlockedWeapons.push(weapon.id);
    const savedLog=Array.isArray(saved.gameplayLog)?saved.gameplayLog.filter(item=>item&&typeof item.text==='string'&&item.text.length<=220).map((item,index)=>({day:Number.isSafeInteger(item.day)?item.day:1,text:item.text,system:Boolean(item.system),order:index+1})).filter(item=>!item.system):[];
    gameplayLog=[...featureLog.map((text,index)=>({day:1,text,system:true,order:index+1})),...savedLog].slice(-80);
    activeDistrictJob=districtJobs.some(job=>job.id===saved.activeDistrictJob&&!completedDistrictJobs.includes(job.id)&&(!job.requires||completedDistrictJobs.includes(job.requires)))?saved.activeDistrictJob:null;
    lifeState=lifeSystem.restore(saved.life);player.xp=saved.xp;player.cash=saved.cash;player.rep=saved.rep;missionIndex=saved.missionIndex;legal=saved.legal;complete=saved.complete;storyPath=['street','clean'].includes(saved.storyPath)?saved.storyPath:null;contractCount=saved.contractCount;
    if(Number.isFinite(saved.health)&&saved.health>=0&&saved.health<=100)player.health=saved.health;
    if(!storyPath&&missionIndex>firstChapterEnd)storyPath=missionIndex>=cleanChapterStart?'clean':'street';
    if(complete&&missionIndex<=firstChapterEnd){complete=false;activeContract=null;if(legal){storyPath='clean';missionIndex=cleanChapterStart}else{storyPath=null;missionIndex=firstChapterEnd}}
    if(missionIndex>=cleanChapterStart)legal=true;
    if(legal)setServiceMission();
    const contract=saved.activeContract;
    if(!activeDistrictJob&&complete&&contract&&Number.isInteger(contract.routeIndex)&&contract.routeIndex>=0&&contract.routeIndex<deliveryRoutes.length&&substances.some(item=>item.id===contract.substanceId&&item.level<=playerLevel()))activeContract={substanceId:contract.substanceId,routeIndex:contract.routeIndex};
    const pos=saved.playerPosition;if(!interior&&pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&!collision(pos.x,pos.y,10)){player.x=pos.x;player.y=pos.y;player.angle=Number.isFinite(pos.angle)?pos.angle:0;camera.x=pos.x;camera.y=pos.y;}
    restoreOwnedVehicles();
    if(activeContract)player.heat=substances.find(item=>item.id===activeContract.substanceId).risk;
  }catch{}
}
function setServiceMission(){missions[1]={title:'Poctivá směna',text:'Dojdi do autoservisu. Ještě dnes potřebují pomoc.',x:1070,y:315,label:'Pavel · autoservis',speaker:'PAVEL',dialog:'Potřebuju někoho na noční směnu. Tady máš devět stovek.',choices:[['Dokončit směnu. (+900 Kč)','deliver']]};}

$('contracts').onclick=openContracts;
window.streetLifeScene={size,worldMin,worldSpan,minCell,cellKey,block,gridSize,buildingBuckets,districtAt,districtContacts,buildings,cars,people,lamps,cityBlocks,transitStops,transitLines,trafficLights,trafficState,incidents,emergencyVehicles,player,onReady(){notify('3D Žižkov · nový renderer je aktivní');$('renderMode').textContent='3D';},onError(message){$('renderMode').textContent='2D';notify(message)}};
function render(){
  if(!window.streetLifeRenderer){renderLegacy();return;}
  try{
    window.streetLifeRenderer.render({player,camera,time,interior,zoom:viewZoom,transitRide,target:targetAvailable()?mission():null,weather:pragueWeather});
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!interior){drawWeatherOverlay();drawMap();}
    if(player.car){ctx.font='700 26px Arial';ctx.textAlign='right';ctx.fillStyle='#c5f46b';ctx.fillText(Math.round(Math.abs(player.car.velocity||0)*.35)+' km/h',w-35,h-235)}
  }catch(error){console.error('3D frame failed',error);window.streetLifeRenderer=null;document.querySelector('#world3d')?.remove();$('renderMode').textContent='2D';notify('3D vykreslování selhalo. Pokračuje 2D verze.');renderLegacy();}
}
function renderInterior2d(){ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,'#101822');const scale=Math.min(2.5,(h-130)/interior.depth)*viewZoom;ctx.save();ctx.translate(w/2-interior.width*scale/2,h/2-interior.depth*scale/2);ctx.scale(scale,scale);rect(0,0,interior.width,interior.depth,'#9b8874');ctx.strokeStyle='#665648';for(let y=0;y<interior.depth;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(interior.width,y);ctx.stroke()}for(const item of interiorFurniture())rect(item.x,item.y,item.w,item.h,'#536a66');if(isButcherRoom()){drawPerson(interior.width*.29,interior.depth*.35,Math.PI/2,'#c1b4a4',0,false);ctx.fillStyle='#fff';ctx.font='9px Arial';ctx.fillText('KAREL · ŘEZNÍK',interior.width*.12,interior.depth*.3);}if(isLifeService()){const service=lifeServicePoint(),kind=lifeServiceKind();drawPerson(service.x,service.y,Math.PI/2,kind==='bank'?'#2f5f89':kind==='office'?'#6c5c8a':kind==='property'?'#7a6348':'#5b7d68',0,false);ctx.fillStyle='#fff';ctx.font='9px Arial';ctx.fillText(kind==='bank'?'BANKÉŘ':kind==='office'?'ÚŘEDNÍK':kind==='property'?'SPRÁVCE':'OBSLUHA',service.x-28,service.y-18);}const points=interiorPoints();for(const [name,point]of Object.entries(points)){glow(point.x,point.y,20,name==='exit'?'#ca7aff88':'#c5f46b77');ctx.font='10px Arial';ctx.fillStyle='#fff';ctx.fillText(name==='up'?'↑':name==='down'?'↓':'VEN',point.x-9,point.y)}drawPerson(player.x,player.y,player.angle,'#2d3945',player.step,true);ctx.strokeStyle='#37d6ff';ctx.beginPath();ctx.arc(player.x,player.y,14,0,7);ctx.stroke();ctx.restore();}
function isApartmentBuilding() {
  return Boolean(interior && interior.floor === 0 && !interior.building.name && ['residential', 'garden', 'old', 'modern', 'villa'].includes(interior.building.type));
}
function lifeServiceKind() {
  if (!interior || interior.floor !== 0) return null;
  const name = interior.building.name;
  if (name === 'BANKA') return 'bank';
  if (name === 'BURZA PRAHA') return 'exchange';
  if (name?.endsWith('AUTOSALON')) return 'dealer';
  if (name === 'UBYTOVNA') return 'hostel';
  if (['POTRAVINY', 'OBCHODNÍ CENTRUM', 'CENTRUM VINOHRADY'].includes(name)) return 'shop';
  if (name === 'POLICIE ČR') return 'police';
  if (name === 'STŘEDNÍ ŠKOLA' || name === 'GYMNÁZIUM VINOHRADY') return 'school';
  if (name === 'KNIHOVNA ZAHRADNÍ MĚSTO') return 'library';
  if (name === 'FAKE INTERNET CAFÉ') return 'internet';
  if (name === 'ÚŘAD PRÁCE') return 'office';
  if (isApartmentBuilding()) return 'property';
  return null;
}
function isLifeService() { return Boolean(lifeServiceKind()); }
function lifeServicePoint() { return { x: interior.width * .55, y: interior.depth * .52 }; }
function formatMoney(amount) { return Math.round(amount).toLocaleString('cs-CZ') + ' Kč'; }
function formatUnits(units) { return (units / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function choiceInfo(text) { const info = document.createElement('p'); info.textContent = text; $('choices').append(info); return info; }
function propertyOffer() {
  const district = districtAt(interior.building.x, interior.building.y);
  const multiplier = district.style === 'villa' ? 6.5 : district.style === 'modern' ? 4.4 : district.style === 'garden' ? 3.2 : district.style === 'old' ? 2.4 : 1.8;
  const meters = Math.max(28, Math.round((interior.building.w * interior.building.h) / 420));
  const price = Math.min(950000, Math.round((meters * 6500 * multiplier) / 1000) * 1000);
  return { id: Math.round(interior.building.x) + '-' + Math.round(interior.building.y), name: (district.style === 'villa' ? 'Vila ' : 'Byt ') + meters + ' m² · ' + district.name.split(' · ')[0], district: district.name, price, rent: Math.max(3500, Math.round(price / 1800 / 100) * 100) };
}
function lifeButton(label, action, value, locked = false) {
  const button = document.createElement('button');
  button.textContent = label; button.disabled = locked;
  button.onclick = () => {
    if (!dialogOpen || !lifeMenu) return;
    const remote = ['bill', 'sms'].includes(action)||(lifeMenu==='phone'&&action==='payLease') || (lifeMenu === 'phone' && lifeSystem.has('mobileBank', lifeEntitlements) && ['deposit', 'withdraw', 'repay'].includes(action));
    if (!remote && (!isLifeService() || distance(player, lifeServicePoint()) > 45)) return;
    const kind = lifeServiceKind();
    if (!remote && ((['account', 'deposit', 'withdraw', 'loan', 'repay', 'trade'].includes(action) && !['bank','exchange'].includes(kind)) || (['rent', 'sleep'].includes(action) && kind !== 'hostel') || (action === 'buy' && kind !== 'shop') || (action === 'business' && kind !== 'office') || (['buyVehicle','leaseVehicle','sellVehicle','payLease'].includes(action) && kind !== 'dealer') || (['rentFlat', 'buyProperty', 'mortgageProperty', 'rentOutProperty', 'collectRent', 'payMortgage'].includes(action) && kind !== 'property'))) return;
    if (['buyVehicle','leaseVehicle'].includes(action)&&!dealerOffers().some(model=>model.id===value)) return;
    const deliveryPoint=['buyVehicle','leaseVehicle'].includes(action)?freeDealerSlot(interior.building):null;
    if(['buyVehicle','leaseVehicle'].includes(action)&&!deliveryPoint){notify('Před salonem není volné místo. Uvolni parkoviště.');return;}
    if (!lifeSystem.act(lifeState, player, action, value, lifeEntitlements)) { notify('Akce není dostupná nebo nemáš dost peněz.'); return; }
    if(deliveryPoint){const owned=lifeState.vehicles[lifeState.vehicles.length-1];owned.position=deliveryPoint;spawnOwnedVehicle(owned);notify('Klíče převzaty. Vůz čeká před salonem · F pro nastoupení.');}
    reconcileOwnedVehicles();saveProgress(); updateHud();
    const menu = lifeMenu; closeContracts(); openLifeMenu(menu);
  };
  $('choices').append(button);
}
function bankChoices(mobile = false) {
  choiceInfo('Zůstatek účtu: ' + formatMoney(lifeState.balance) + ' · portfolio: ' + formatMoney(lifeSystem.portfolioValue(lifeState)) + ' · net worth: ' + formatMoney(lifeSystem.netWorth(lifeState, player)));
  if (!lifeState.account) { if (!mobile) lifeButton('Založit účet · zdarma', 'account'); return; }
  for (const amount of [100, 500, 1000,10000,50000,100000]) {
    lifeButton('Vložit ' + formatMoney(amount), 'deposit', amount, player.cash < amount);
    lifeButton('Vybrat ' + formatMoney(amount), 'withdraw', amount, lifeState.balance < amount);
  }
  if (lifeState.loan) {
    const amount = Math.min(500, lifeState.loan.remaining);
    lifeButton('Splátka ' + formatMoney(amount) + ' · zbývá ' + formatMoney(lifeState.loan.remaining) + ' · splatnost den ' + lifeState.loan.due, 'repay', amount, player.cash < amount);
  } else if (!mobile) {
    lifeButton('Půjčit 1 000 Kč · splatíš 1 100 Kč za 7 dní', 'loan', 1000);
    lifeButton('Půjčit 5 000 Kč · splatíš 5 500 Kč · balíček Finance', 'loan', 5000, !lifeSystem.has('largeLoan', lifeEntitlements));
  }
  if (!mobile) {
    choiceInfo('Směnárna a shitcoin broker · nákup jde z účtu, prodej se vrací na účet.');
    for (const asset of lifeSystem.market(lifeState).filter(asset=>['fiat','shitcoin'].includes(asset.kind))) {
      const units = lifeState.portfolio?.[asset.id] || 0;
      lifeButton('Koupit ' + asset.id + ' za 500 Kč · kurz ' + asset.price + ' Kč', 'trade', { type: 'buy', asset: asset.id, czk: 500 }, lifeState.balance < 500);
      lifeButton('Prodat vše ' + asset.id + ' · držíš ' + formatUnits(units), 'trade', { type: 'sell', asset: asset.id, units: 'all' }, units <= 0);
    }
    if ((lifeState.portfolio?.EUR || 0) > 0) lifeButton('Swap EUR → USD', 'trade', { type: 'swap', from: 'EUR', to: 'USD', units: 'all' });
    if ((lifeState.portfolio?.USD || 0) > 0) lifeButton('Swap USD → BetonCoin', 'trade', { type: 'swap', from: 'USD', to: 'BETON', units: 'all' });
    if ((lifeState.portfolio?.BETON || 0) > 0) lifeButton('Swap BetonCoin → EUR', 'trade', { type: 'swap', from: 'BETON', to: 'EUR', units: 'all' });
  }
}

let selectedStock='PMOB',stockBudget=1000;
function marketHistory(id,count=30){return Array.from({length:count},(_,i)=>{const tick=Math.max(0,(lifeState.day-1)*10+Math.floor(lifeState.elapsed/30)-(count-1-i));return lifeSystem.marketPrice({day:1+Math.floor(tick/10),elapsed:(tick%10)*30},id);});}
function exchangeChoices(){
  const summary=document.createElement('div');summary.className='marketSummary';
  const cost=Object.values(lifeState.costBasis).reduce((sum,n)=>sum+n,0),worth=lifeSystem.portfolioValue(lifeState),pnl=worth-cost;
  for(const [label,value]of [['VOLNÉ PENÍZE',formatMoney(lifeState.balance)],['PORTFOLIO',formatMoney(worth)],['OTEVŘENÝ ZISK / ZTRÁTA',(pnl>=0?'+':'')+formatMoney(pnl)],['UZAVŘENÝ ZISK / ZTRÁTA',formatMoney(lifeState.realizedPnL)]]){const card=document.createElement('div'),title=document.createElement('small'),number=document.createElement('strong');title.textContent=label;number.textContent=value;card.append(title,number);summary.append(card);}$('choices').append(summary);
  choiceInfo('Herní burza · fiktivní firmy a ETF. Kotace se mění každých 30 sekund aktivní hry. Nákup 1 %, prodej 2 %; poplatky jsou započtené.');
  if(!lifeState.account){choiceInfo('Nejdřív si otevři bankovní účet v bance.');return;}
  const stocks=lifeSystem.market(lifeState).filter(asset=>['stock','fund'].includes(asset.kind)),tickers=document.createElement('div');tickers.className='stockTickers';
  for(const stock of stocks){const hist=marketHistory(stock.id),previous=hist[hist.length-2],change=(stock.price/previous-1)*100,button=document.createElement('button');button.className=stock.id===selectedStock?'selected':'';button.textContent=stock.id+' · '+stock.price.toFixed(2)+' Kč · '+(change>=0?'+':'')+change.toFixed(2)+' %';button.onclick=()=>{selectedStock=stock.id;closeContracts();openLifeMenu('service');};tickers.append(button);}$('choices').append(tickers);
  const stock=stocks.find(item=>item.id===selectedStock)||stocks[0],history=marketHistory(stock.id),low=Math.min(...history)*.99,high=Math.max(...history)*1.01;
  const points=history.map((price,i)=>(20+i*600/(history.length-1)).toFixed(1)+','+(155-(price-low)/(high-low)*120).toFixed(1)).join(' '),chart=document.createElement('div');chart.className='stockChart';
  chart.innerHTML='<svg viewBox="0 0 640 185" role="img" aria-label="Historie kurzu '+stock.id+'"><path d="M20 35H620M20 95H620M20 155H620" stroke="#314553"/><polyline points="'+points+'" fill="none" stroke="#bdf071" stroke-width="3"/><text x="20" y="178" fill="#aab9c5" font-size="11">Historie kotací · 30 bodů</text><text x="480" y="22" fill="#bdf071" font-size="14">'+stock.price.toFixed(2)+' CZK</text></svg>';$('choices').append(chart);
  const units=lifeState.portfolio[stock.id],basis=lifeState.costBasis[stock.id],value=Math.floor(units*stock.price/100);
  choiceInfo(stock.name+' · '+lifeSystem.assets[stock.id].sector+' · držíš '+formatUnits(units)+' kusů · průměrná nákupní cena '+(units?basis*100/units:0).toFixed(2)+' Kč · výnos '+formatMoney(value-basis));
  const label=document.createElement('label'),input=document.createElement('input');label.className='orderBudget';label.textContent='Částka objednávky v Kč';input.type='number';input.min='100';input.max='1000000';input.step='100';input.value=String(stockBudget);input.oninput=()=>{stockBudget=Number(input.value);};label.append(input);$('choices').append(label);
  const buy=document.createElement('button');buy.textContent='Koupit '+stock.id+' · potvrdit tržní objednávku';buy.onclick=()=>submitExchangeOrder(stock.id,'buy');$('choices').append(buy);
  lifeButton('Prodat celou pozici '+stock.id+' · odhad '+formatMoney(Math.floor(value*.98)),'trade',{type:'sell',asset:stock.id,units:'all'},!units);
  choiceInfo('Výpis provedených obchodů');
  for(const order of lifeState.orders.slice(-6).reverse())choiceInfo('Den '+order.day+' · '+(order.side==='buy'?'NÁKUP':'PRODEJ')+' '+order.id+' · '+formatUnits(order.units)+' ks @ '+order.price.toFixed(2)+' Kč · '+formatMoney(order.total)+' · poplatek '+formatMoney(order.fee));
  if(!lifeState.orders.length)choiceInfo('Zatím žádná objednávka. Vyber titul, nastav částku a potvrď nákup.');
}
function submitExchangeOrder(id,side){
  if(!dialogOpen||lifeMenu!=='service'||lifeServiceKind()!=='exchange'||distance(player,lifeServicePoint())>45||!['stock','fund'].includes(lifeSystem.assets[id]?.kind))return false;
  if(side!=='buy'||!Number.isSafeInteger(stockBudget)||stockBudget<100||stockBudget>1000000||!lifeSystem.act(lifeState,player,'trade',{type:'buy',asset:id,czk:stockBudget})){notify('Zkontroluj částku a zůstatek účtu.');return false;}
  saveProgress();updateHud();notify('Objednávka provedena · '+id);closeContracts();openLifeMenu('service');return true;
}
function dealerOffers(){const brand=interior?.building.name.split(' ')[0].toLowerCase();return lifeSystem.vehicleCatalog.filter(model=>model.dealer===brand);}
function freeDealerSlot(building){
  const col=Math.floor(building.x/block),row=Math.floor(building.y/block);
  for(const offset of [0,1,-1,2,-2])for(const yy of [220,285,95]){const point={x:(col+offset)*block+61,y:row*block+yy,angle:Math.PI/2};if(!carCollision(point.x,point.y,point.angle)&&!cars.some(car=>distance(car,point)<58))return point;}
  return null;
}
function spawnOwnedVehicle(owned){
  if(cars.some(car=>car.ownedId===owned.id))return true;
  const model=lifeSystem.vehicleCatalog.find(item=>item.id===owned.modelId);if(!model)return false;
  let point=owned.position;
  if(!point||carCollision(point.x,point.y,point.angle)||cars.some(car=>distance(car,point)<45)){const building=buildings.find(b=>b.name===model.dealer.toUpperCase()+' AUTOSALON');point=freeDealerSlot(building);}
  if(!point)return false;owned.position={...point};
  cars.push({...point,axis:false,speed:0,parked:true,color:model.color,modelId:model.id,vehicleClass:model.body,luxury:true,maxSpeed:model.speed,ownedId:owned.id});return true;
}
function syncOwnedVehiclePositions(){for(const owned of lifeState.vehicles){const car=cars.find(item=>item.ownedId===owned.id);if(car)owned.position={x:car.x,y:car.y,angle:car.angle};}}
function restoreOwnedVehicles(){
  for(let i=cars.length-1;i>=0;i--)if(cars[i].ownedId){if(player.car===cars[i])player.car=null;cars.splice(i,1);}
  for(const owned of lifeState.vehicles)spawnOwnedVehicle(owned);
}
function reconcileOwnedVehicles(){
  for(let i=cars.length-1;i>=0;i--)if(cars[i].ownedId&&!lifeState.vehicles.some(owned=>owned.id===cars[i].ownedId)){if(player.car===cars[i]){player.car=null;player.x=cars[i].x+38;player.y=cars[i].y;}cars.splice(i,1);}
}
function dealerChoices(){
  choiceInfo('Autorizovaný salon herních značek · nákup, výkup a leasing. Ceny jsou přizpůsobené herní ekonomice. Platba z hotovosti a účtu; bankovní účet je podmínkou smlouvy.');
  const funds=player.cash+lifeState.balance;
  for(const model of dealerOffers()){
    const card=document.createElement('div');card.className='dealerCard';
    const preview=document.createElement('div');preview.className='carPreview '+model.body;preview.style.setProperty('--car-paint',model.color);preview.setAttribute('role','img');preview.setAttribute('aria-label',model.name);
    const title=document.createElement('strong');title.textContent=model.name;const details=document.createElement('p');details.textContent=model.description+' · cena '+formatMoney(model.price);
    card.append(preview,title,details);$('choices').append(card);
    const remaining=Math.ceil(model.price*.8*1.12),payment=Math.ceil(remaining/12),down=Math.ceil(model.price*.2);
    lifeButton('Koupit '+model.name+' · '+formatMoney(model.price),'buyVehicle',model.id,!lifeState.account||funds<model.price);
    choiceInfo('Leasing: akontace '+formatMoney(down)+' + 12 × '+formatMoney(payment)+' každé 3 herní dny. Dluh '+formatMoney(remaining)+' včetně 12% navýšení.');
    lifeButton('Podepsat leasing '+model.name+' · '+formatMoney(down)+' dnes','leaseVehicle',model.id,!lifeState.account||funds<down);
  }
  choiceInfo('Tvoje garáž · výkup včetně vyrovnání leasingu');
  for(const owned of lifeState.vehicles){const model=lifeSystem.vehicleCatalog.find(item=>item.id===owned.modelId),sale=lifeSystem.resaleValue(lifeState,owned),debt=owned.lease?.remaining||0;
    choiceInfo(model.name+' · '+owned.id+' · výkup '+formatMoney(sale)+(debt?' · leasingový dluh '+formatMoney(debt)+' · splatnost den '+owned.lease.due:' · plně ve tvém vlastnictví'));
    lifeButton('Prodat '+model.name+' · '+(sale-debt>=0?'výplata ':'doplatek ')+formatMoney(Math.abs(sale-debt)),'sellVehicle',owned.id,sale-debt<0&&funds<debt-sale);
    if(debt)lifeButton('Zaplatit splátku '+formatMoney(Math.min(owned.lease.payment,debt)),'payLease',owned.id,lifeState.day<owned.lease.due||funds<Math.min(owned.lease.payment,debt));
  }
  if(!lifeState.vehicles.length)choiceInfo('Garáž je prázdná. Po podpisu smlouvy se auto objeví před salonem.');
}
function policeChoices(){
  choiceInfo('Zbraně jsou herní bezpečnostní vybavení. Odemknutí proběhne až po dokončení 20 otázek; minimum pro průchod je 16/20.');
  choiceInfo('Stav testu: '+(policeKnowledgeState.passed?'splněno · arzenál odemčen':'čeká na dokončení')+'.');
  if(!policeKnowledgeState.passed){
    const start=document.createElement('button');start.textContent='Spustit 20otázkový vědomostní test';start.onclick=startPoliceKnowledgeTest;$('choices').append(start);
  }else{
    for(const weapon of policeWeapons)choiceInfo('ODEMČENO · '+weapon.name+' · v inventáři '+(hasInventoryItem(weapon.id)?'ano':'ne'));
  }
}
function schoolChoices(){
  choiceInfo(educationStatusText()+'. Formální zápis vyžaduje LVL 3; samostudium stačí na 6 bodů.');
  if(educationState.highSchool){choiceInfo('Dokončeno přes: '+educationState.method+'. Lepší práce hledej na úřadu práce.');return;}
  const enroll=document.createElement('button');enroll.textContent='Dokončit střední školu · LVL 3 nebo 6 bodů samostudia';enroll.disabled=!canFinishHighSchool();enroll.onclick=()=>{if(finishHighSchool(playerLevel()>=3?'škola':'samostudium')){const menu=lifeMenu;closeContracts();openLifeMenu(menu);}};$('choices').append(enroll);
}
function studyChoices(kind){
  choiceInfo(educationStatusText()+'. '+(kind==='library'?'Knihovna dává +2 body samostudia.':'Fake internet dává +1 bod samostudia a rychlé poznámky.'));
  if(educationState.highSchool){choiceInfo('Už máš hotovo. Teď běž na úřad práce pro lepší směny.');return;}
  const button=document.createElement('button');button.textContent=kind==='library'?'Studovat v knihovně · +2 body · +55 XP':'Studovat na fake internetu · +1 bod · +35 XP';button.onclick=()=>studyAt(kind);$('choices').append(button);
}
function betterJobButton(job){
  const button=document.createElement('button');
  button.textContent=job.title+' · LVL '+job.level+' · '+formatMoney(job.reward)+' · '+job.xp+' XP';
  button.disabled=!educationState.betterJobs||playerLevel()<job.level;
  button.onclick=()=>takeBetterJob(job.id);
  $('choices').append(button);
}
function officeChoices() {
  const worth = lifeSystem.netWorth(lifeState, player), funds = player.cash + lifeState.balance;
  choiceInfo('Majetek: ' + formatMoney(worth) + ' · hotovost + účet: ' + formatMoney(funds) + '. OSVČ se odemyká od 8 000 Kč net worth, firma od 60 000 Kč.');
  lifeButton(lifeState.business.osvc ? 'OSVČ už máš založené' : 'Založit OSVČ · 1 000 Kč', 'business', 'osvc', lifeState.business.osvc || worth < 8000 || funds < 1000);
  lifeButton(lifeState.business.company ? 'Firma už je zapsaná' : 'Založit s.r.o. · 12 000 Kč', 'business', 'company', !lifeState.business.osvc || lifeState.business.company || worth < 60000 || funds < 12000);
  lifeButton('Podat daňové přiznání · ' + (lifeState.business.company ? '1 200 Kč' : '400 Kč'), 'business', 'tax', (!lifeState.business.osvc && !lifeState.business.company) || lifeState.business.taxFiledDay === lifeState.day || funds < (lifeState.business.company ? 1200 : 400));
  choiceInfo('Lepší práce · vyžaduje dokončenou střední školu nebo samostudium.');
  for(const job of betterJobs)betterJobButton(job);
}
function propertyChoices() {
  const offer = propertyOffer(), owned = lifeState.properties.find(item => item.id === offer.id), funds = player.cash + lifeState.balance, down = Math.ceil(offer.price * .25);
  choiceInfo(offer.name + ' · nájem ' + formatMoney(offer.rent) + ' / 7 dní · koupě ' + formatMoney(offer.price) + ' · akontace ' + formatMoney(down));
  lifeButton('Pronajmout tento byt na 7 dní', 'rentFlat', offer, Boolean(lifeState.rental) || funds < offer.rent);
  lifeButton('Koupit tento byt', 'buyProperty', offer, Boolean(owned) || funds < offer.price);
  lifeButton('Vzít hypotéku na tento byt', 'mortgageProperty', offer, Boolean(owned) || funds < down);
  if (lifeState.properties.length) choiceInfo('Tvoje nemovitosti:');
  for (const property of lifeState.properties) {
    choiceInfo(property.name + ' · hodnota ' + formatMoney(property.value) + ' · hypotéka ' + formatMoney(property.mortgage || 0) + (property.rented ? ' · pronajato' : ''));
    lifeButton('Pronajímat · ' + property.name, 'rentOutProperty', property.id, property.rented);
    lifeButton('Vybrat nájem · ' + formatMoney(property.rent), 'collectRent', property.id, !property.rented || property.lastRentDay === lifeState.day);
    lifeButton('Splatit hypotéku · max 1 000 Kč', 'payMortgage', property.id, !property.mortgage || funds < Math.min(1000, property.mortgage));
  }
}
function openLifeMenu(mode) {
  if (!started || paused || dialogOpen || (mode === 'service' && (!isLifeService() || distance(player, lifeServicePoint()) > 45))) return false;
  lifeMenu = mode; dialogOpen = true; keys.clear();
  $('dialog').classList.toggle('marketDialog',mode==='service'&&['exchange','dealer'].includes(lifeServiceKind()));
  $('dialog').classList.remove('hidden'); $('choices').replaceChildren();
  const kind = lifeServiceKind(), name = mode === 'phone' ? 'TELEFON' : (interior.building.name || 'SPRÁVCE DOMU');
  $('speaker').textContent = name + ' · DEN ' + lifeState.day;
  $('dialogTitle').textContent = mode === 'phone' ? 'Zprávy a účty' : kind === 'hostel' ? 'Postel na jednu noc' : kind === 'bank' ? 'Bankovní přepážka a broker' : kind === 'office' ? 'Živnostenské okénko' : kind === 'property' ? 'Bydlení a nemovitosti' : kind==='exchange'?'Praha Exchange · investiční terminál':kind==='dealer'?'Autorizovaný prodejce · klíče do ruky':kind==='police'?'Policejní přepážka · bezpečnostní test':kind==='school'?'Střední škola a maturitní cesta':kind==='library'?'Knihovna · samostudium':kind==='internet'?'Fake internet café · samostudium':'Co potřebuješ?';
  $('dialogText').textContent = 'Hotovost ' + player.cash + ' Kč · účet ' + lifeState.balance + ' Kč. Jeden den = 5 minut aktivní hry. ' + (kind === 'hostel' ? 'Nocleh platíš předem, spánek doplní 40 zdraví a posune den.' : kind === 'school' || kind === 'library' || kind === 'internet' ? educationStatusText() : '');
  if (mode === 'service' && kind === 'hostel') {
    lifeButton('Pronajmout postel · 150 Kč', 'rent', 'bed', Boolean(lifeState.rental) || player.cash < 150);
    lifeButton('Soukromý pokoj · 450 Kč · balíček Domov', 'rent', 'room', !lifeSystem.has('room', lifeEntitlements) || Boolean(lifeState.rental) || player.cash < 450);
    lifeButton('Vyspat se · +40 zdraví', 'sleep', null, !lifeState.rental);
  } else if (mode === 'service' && kind === 'bank') bankChoices();
  else if (mode === 'service' && kind === 'exchange') exchangeChoices();
  else if (mode === 'service' && kind === 'dealer') dealerChoices();
  else if (mode==='service'&&kind === 'police') policeChoices();
  else if (mode==='service'&&kind === 'school') schoolChoices();
  else if (mode==='service'&&kind === 'library') studyChoices('library');
  else if (mode==='service'&&kind === 'internet') studyChoices('internet');
  else if (mode==='service'&&kind === 'office') officeChoices();
  else if (mode==='service'&&kind === 'property') propertyChoices();
  else if (mode !== 'phone') for (const item of lifeSystem.products) lifeButton(item.name + ' · ' + item.price + ' Kč · +' + item.health + ' zdraví', 'buy', item.id, player.cash < item.price);
  if (mode === 'phone') {
    for (const item of lifeState.messages.slice(-8)) {
      const message = document.createElement('p'); message.textContent = 'Den ' + item.day + ' · ' + item.from + ': ' + item.text; $('choices').append(message);
    }
    for (const contact of ['Viktor', 'Eliška', 'Pavel', 'Správce']) lifeButton('SMS → ' + contact + ' · 5 Kč · max. 1 denně', 'sms', contact, lifeState.sentDay === lifeState.day || player.cash < 5 || (['Pavel', 'Správce'].includes(contact) && !lifeSystem.has('extraContacts', lifeEntitlements)));
    for(const vehicle of lifeState.vehicles.filter(item=>item.lease)){const model=lifeSystem.vehicleCatalog.find(item=>item.id===vehicle.modelId),amount=Math.min(vehicle.lease.payment,vehicle.lease.remaining);lifeButton('Leasing '+model.name+' · '+formatMoney(amount)+' · splatnost den '+vehicle.lease.due,'payLease',vehicle.id,lifeState.day<vehicle.lease.due||player.cash+lifeState.balance<amount);}
    for (const bill of lifeState.bills) lifeButton(bill.name + ' · ' + bill.amount + ' Kč · splatnost den ' + bill.due + (lifeState.day > bill.due ? ' · PO SPLATNOSTI' : ''), 'bill', bill.id, player.cash < bill.amount);
    if (!lifeState.bills.length) { const info = document.createElement('p'); info.textContent = 'Všechny účty zaplacené.'; $('choices').append(info); }
    if (lifeSystem.has('mobileBank', lifeEntitlements)) bankChoices(true);
    for (const pack of Object.values(lifeSystem.packages)) { const info = document.createElement('p'); info.textContent = pack.name + ' · připravovaný balíček, zatím bez prodeje'; $('choices').append(info); }
  }
  const close = document.createElement('button'); close.textContent = 'Zavřít'; close.onclick = closeContracts; $('choices').append(close);
  return true;
}
function manualSave() { saveProgress(); notify('Hra uložena do localStorage.'); }
$('playerMenuToggle').onclick = () => {
  const hidden = $('playerActions').classList.toggle('hidden');
  $('playerMenuToggle').setAttribute('aria-expanded', String(!hidden));
};
$('phone').onclick = () => openLifeMenu('phone');
$('inventoryButton').onclick = openInventory;
$('logButton').onclick = openLogList;
$('saveGame').onclick = manualSave;
const originalInteriorHud = updateInteriorHud;
updateInteriorHud = function() {
  originalInteriorHud();
  if (isLifeService()) {
    const kind = lifeServiceKind(), label = kind === 'property' ? 'správce domu' : interior.building.name;
    $('missionText').textContent = 'Přejdi k NPC v přízemí a stiskni E · ' + label;
    if (distance(player, lifeServicePoint()) <= 45) $('prompt').textContent = '[E] ' + label + ' · nabídka';
  }
};

function frame(t){window.lifeCityMap?.tick();const dt=Math.min((t-last)/1000,.05);last=t;update(dt);render();requestAnimationFrame(frame)}restoreProgress();syncPragueClock();updateHud();updateWeatherHud();refreshPragueWeather();if(typeof setInterval==='function')setInterval(refreshPragueWeather,15*60*1000);requestAnimationFrame(frame);

document.getElementById('touchMap').onclick=()=>window.lifeCityMap?.toggle();
