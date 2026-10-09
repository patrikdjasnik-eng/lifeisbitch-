'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id),keys=new Set(),size=19200,block=400,gridSize=48;
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
  if (!started || paused || dialogOpen || event.ctrlKey || event.target?.closest?.('button, input, textarea, select, .overlay, .mission, header, footer')) return;
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
addEventListener('pagehide', () => saveProgress());
const buildings=[],cars=[],people=[],lamps=[],puddles=[];
let seed=47;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}function between(a,b){return a+rand()*(b-a)}
const cityBlocks=[];
const civicPlaces = new Map([
  ['1:0', 'UBYTOVNA'], ['3:3', 'BANKA'], ['1:3', 'ZÁKLADNÍ ŠKOLA'], ['3:1', 'ÚŘAD PRÁCE'], ['2:2', 'POLICIE ČR'],
  ['3:4', 'OBCHODNÍ CENTRUM'], ['18:10', 'GYMNÁZIUM VINOHRADY'], ['20:13', 'CENTRUM VINOHRADY']
]);
const parkingLots = [{col:4,row:1},{col:3,row:2},{col:11,row:18}];
function districtAt(x,y){
  if(y>=14400)return {name:'HOLEŠOVICE · DOKY',color:'#dba977',style:'industrial'};
  if(x>=12800)return {name:'NOVÉ MĚSTO',color:'#72d6f5',style:'modern'};
  if(y>=6400&&x>=3200)return {name:'VINOHRADY',color:'#9fcf92',style:'garden'};
  if(y>=6400)return {name:'KARLÍN',color:'#e8b883',style:'old'};
  return {name:'ŽIŽKOV',color:'#d392ef',style:'residential'};
}
for(let row=0;row<gridSize;row++)for(let col=0;col<gridSize;col++){
  const x=col*block+82,y=row*block+82,district=districtAt(x,y);
  const parking=parkingLots.some(lot=>lot.col===col&&lot.row===row);
  const park=(row===2&&col===3)||(district.style==='garden'&&row%8===3&&col%8===5);
  const plaza=district.style==='modern'&&(row+col)%4===0;
  const lot=district.style==='industrial'&&(row+col)%3===0;
  cityBlocks.push({x:col*block,y:row*block,type:parking?'parking':park?'park':plaza?'plaza':lot?'lot':district.style});
  if(!parking&&!park&&!plaza&&!lot){
    const type=district.style;
    const names=type==='industrial'?['SKLAD 07','DOCKS','CARGO']:type==='modern'?['NOVA','HOTEL','ARCADE']:type==='old'?['KAVÁRNA','BAR 22','VINYL']:['BISTRO','NONSTOP','LÉKÁRNA'];
    const height=type==='modern'?between(35,65):type==='industrial'?between(8,17):between(15,30);
    const color=type==='old'?'#5a4942':type==='modern'?'#2d485c':type==='industrial'?'#39434a':['#3e4853','#52464d','#444e53'][Math.floor(rand()*3)];
    const name=civicPlaces.get(row+':'+col)||(col===0&&row===0?'NEON':col===1&&row===0?'ŘEZNICTVÍ':col===2&&row===0?'AUTOSERVIS':col===1&&row===2?'POTRAVINY':rand()>.65?names[Math.floor(rand()*names.length)]:'');
    const protectedBlock=civicPlaces.has(row+':'+col)||(col===1&&row===0)||(col===0&&row===0)||(col===2&&row===0)||(col===1&&row===2)||(col===0&&row===1)||(col===3&&row===3);
    const layout=(row*3+col)%4;
    const addBuilding=(bx,by,bw,bh,scale=1,sign='')=>buildings.push({x:bx,y:by,w:bw,h:bh,height:height*scale,color,name:sign,type,variant:(row+col+Math.floor(bx))%4});
    if(name.includes('CENTRUM')){addBuilding(x,y,250,235,1.3,name);}
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
for(let i=0;i<1200;i++){
  const axis=rand()>.5,local=i<65,lane=Math.floor(rand()*(local?6:gridSize))*block+35;
  cars.push({x:axis?between(35,(local?2400:size)-35):lane,y:axis?lane:between(35,(local?2400:size)-35),angle:axis?0:Math.PI/2,axis,speed:between(25,80),color:['#b1bec4','#c69059','#71374b','#337d80','#394d74','#e9d4ad'][i%6],parked:i<12,police:i>=1184});
}
for(let i=1;i<12;i++){const col=(i*7)%gridSize,row=(i*3)%gridSize;cars[i].x=col*block+61;cars[i].y=row*block+205;cars[i].angle=Math.PI/2;}
for(let i=0;i<36;i++){const col=(i*5+1)%gridSize,row=Math.floor(i/3)%gridSize;cars.push({x:col*block+61,y:row*block+270,angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#67798b','#b27151','#46656c'][i%3]});}
cars[0]={x:275,y:350,angle:0,axis:true,speed:0,color:'#b1bec4',parked:true,police:false};
for(let i=0;i<5000;i++){const axis=rand()>.5;people.push({x:axis?between(0,size):Math.floor(rand()*gridSize)*block+67,y:axis?Math.floor(rand()*gridSize)*block+67:between(0,size),axis,dir:rand()>.5?1:-1,color:['#986e4e','#516476','#76816b','#755c72'][i%4]});}
for(let i=0;i<1600;i++)puddles.push({x:between(0,size),y:between(0,size),r:between(5,20)});
for(let row=0;row<gridSize;row++)for(let col=0;col<gridSize;col++){if((row+col)%2===0)cars.push({x:col*block+61,y:row*block+150,angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#74818b','#8c674d','#526e70'][(row+col)%3]})}
for(const lot of parkingLots)for(let slot=0;slot<10;slot++){
  cars.push({x:lot.col*block+105+(slot%5)*43,y:lot.row*block+(slot<5?130:275),angle:Math.PI/2,axis:false,speed:0,parked:true,police:false,color:['#798896','#926f5d','#446a76'][slot%3]});
}
const transitLines = [
  {id:'bus133',name:'Autobus 133',kind:'bus',fare:40,color:'#d66a3f',speed:95,points:[{x:435,y:435},{x:2035,y:435},{x:2035,y:1635},{x:435,y:1635}],stopNames:['Řeznictví · Žižkov','Škola','Obchodní centrum','Úřad práce']},
  {id:'tram9',name:'Tramvaj 9',kind:'tram',fare:40,color:'#d74545',speed:115,points:[{x:835,y:835},{x:4435,y:835},{x:4435,y:7235},{x:835,y:7235}],stopNames:['Policejní stanice','Žižkov východ','Vinohrady','Karlín']}
];
const transitStops = transitLines.flatMap(line=>line.points.map((point,index)=>({x:point.x+32,y:point.y,lineId:line.id,index,name:line.stopNames[index]})));
for(const line of transitLines)for(let vehicle=0;vehicle<2;vehicle++){
  const point=line.points[vehicle*2];cars.push({x:point.x,y:point.y,angle:0,axis:true,speed:line.speed,color:line.color,parked:false,police:false,transit:line.kind,lineId:line.id,routeIndex:(vehicle*2+1)%4,dwell:vehicle?0:5});
}
for(let i=0;i<16;i++)people.push({x:867+(i%4)*400,y:835+Math.floor(i/4)*400,axis:i%2===0,dir:1,color:i%2?'#283d67':'#253f3d',role:i%2?'police':'warden'});
for(let i=0;i<6;i++)cars.push({x:835+(i%3)*400,y:835+Math.floor(i/3)*400,angle:0,axis:true,speed:60,color:'#e7eef2',parked:false,police:true});
function updateTransitVehicle(car,dt){
  const line=transitLines.find(item=>item.id===car.lineId);
  if(car.dwell>0){car.dwell=Math.max(0,car.dwell-dt);return;}
  const target=line.points[car.routeIndex],dx=target.x-car.x,dy=target.y-car.y,length=Math.hypot(dx,dy),step=Math.min(length,car.speed*dt);
  if(length>0){car.x+=dx/length*step;car.y+=dy/length*step;car.angle=Math.atan2(dy,dx);}
  if(length<=step+.01){car.x=target.x;car.y=target.y;car.routeIndex=(car.routeIndex+1)%line.points.length;car.dwell=5;}
}
let activeTransitStop=null;
function nearestTransitStop(){return interior||player.car?null:transitStops.find(stop=>distance(player,stop)<42)||null;}
function showTransitMenu(stop){
  if(!stop||dialogOpen||interior||player.car)return false;
  const line=transitLines.find(item=>item.id===stop.lineId);activeTransitStop=stop;dialogOpen=true;keys.clear();
  $('dialog').classList.remove('hidden');$('speaker').textContent='MHD · '+line.name;$('dialogTitle').textContent=stop.name;
  $('dialogText').textContent='Jízdenka '+line.fare+' Kč · zvol cílovou zastávku. Cesta je v této betě zkrácený přesun, ne jízda uvnitř vozidla.';
  $('choices').replaceChildren();
  for(const destination of transitStops.filter(item=>item.lineId===line.id&&item!==stop)){
    const button=document.createElement('button');button.textContent=destination.name+' · '+line.fare+' Kč';button.disabled=player.cash<line.fare;button.onclick=()=>rideTransit(destination.index);$('choices').append(button);
  }
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=()=>{activeTransitStop=null;closeContracts();};$('choices').append(close);return true;
}
function rideTransit(index){
  const stop=activeTransitStop;
  if(!dialogOpen||!stop||interior||player.car||distance(player,stop)>=42)return false;
  const line=transitLines.find(item=>item.id===stop.lineId),destination=transitStops.find(item=>item.lineId===line.id&&item.index===index);
  if(!destination||destination===stop||player.cash<line.fare||collision(destination.x,destination.y,10))return false;
  player.cash-=line.fare;player.x=destination.x;player.y=destination.y;camera.x=player.x;camera.y=player.y;activeTransitStop=null;closeContracts();saveProgress();updateHud();notify(line.name+' · '+destination.name+' · −'+line.fare+' Kč');return true;
}
const buildingBuckets=new Map();
for(const b of buildings){const key=Math.floor(b.y/block)*gridSize+Math.floor(b.x/block);if(!buildingBuckets.has(key))buildingBuckets.set(key,[]);buildingBuckets.get(key).push(b)}
function nearbyBuildings(x,y,rx,ry=rx){const result=[];for(let row=Math.max(0,Math.floor((y-ry)/block));row<=Math.min(gridSize-1,Math.floor((y+ry)/block));row++)for(let col=Math.max(0,Math.floor((x-rx)/block));col<=Math.min(gridSize-1,Math.floor((x+rx)/block));col++){const items=buildingBuckets.get(row*gridSize+col);if(items)result.push(...items)}return result;}
const missions=[
 {title:'Dluhy nespí',text:'Najdi Viktora před klubem Neon. Má pro tebe práci.',x:210,y:350,label:'Viktor · klub Neon',speaker:'VIKTOR',dialog:'Nájem se sám nezaplatí, Adame. Mám zásilku konopí pro jednoho známého. Neptáš se, doručíš. Nebo vezmi směnu v servisu. Tvoje volba.',choices:[['Vezmu konopí. (+1 800 Kč, +80 XP)','illegal'],['Radši práci v servisu. (+900 Kč)','legal']]},
 {title:'Cena rychlých peněz',text:'Doruč konopí kontaktu u podchodu. Policie hlídá hlavní ulice.',x:665,y:455,label:'Kontakt · podchod',speaker:'KONTAKT',dialog:'Viktor říkal, že přijdeš. Tady máš peníze. Pamatuj: rychlý prachy mají dlouhej stín.',choices:[['Předat konopí a odejít','deliver']]},
 {title:'Rodina před ulicí',text:'Sestra tě čeká před potravinami. Potřebuje s tebou mluvit.',x:470,y:1110,label:'Eliška · potraviny',speaker:'ELIŠKA',dialog:'Máma potřebuje léky a já další brigádu neutáhnu. Nechci vědět, odkud ty peníze jsou. Jen mi slib, že se vrátíš domů.',choices:[['Pomoci rodině. (−800 Kč, +15 respekt)','family'],['Teď nemůžu. Potřebuju splatit dluh.','decline']]},
 {title:'Zmizet z očí',text:'Dostaň se do úkrytu a stáhni na sebe co nejméně pozornosti.',x:1265,y:1510,label:'Úkryt · stará prádelna',speaker:'ADAM',dialog:'Na chvíli ticho. Jen déšť za oknem. Můžeš běžet pořád dál, ale jednou si musíš vybrat, kam vlastně chceš dojít.',choices:[['Vyčkat v úkrytu. (sníží policejní pozornost)','hide']]},
 {title:'Kdo chceš být?',text:'Vrať se k Viktorovi. Dnešní noc rozhodne o zítřku.',x:210,y:350,label:'Viktor · klub Neon',speaker:'VIKTOR',dialog:'Obstál jsi. Můžeme spolu dělat dál. Víc peněz, víc problémů. Nebo odejdi a zkus si ten život postavit jinak.',choices:[['Zůstat v ulicích.','streetEnd'],['Začít znovu v servisu.','cleanEnd']]}
];
let missionIndex=0,legal=false,complete=false;
function mission(){if(activeContract){const item=substances.find(entry=>entry.id===activeContract.substanceId),route=deliveryRoutes[activeContract.routeIndex];return {...route,title:'Zakázka · '+item.name,text:'Doruč '+item.name+' kontaktu. Odměna '+item.reward.toLocaleString('cs-CZ')+' Kč a '+item.xp+' XP.',speaker:'KONTAKT'}}return missions[missionIndex]}function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function notify(text){$('toast').textContent=text;$('toast').style.opacity='1';toastTimer=4}
function updateHud(){ if($('health'))$('health').textContent=Math.round(player.health)+'/100';$('cash').textContent=player.cash.toLocaleString('cs-CZ')+' Kč';$('rep').textContent=player.rep;$('heat').textContent='★'.repeat(Math.ceil(player.heat))+'☆'.repeat(5-Math.ceil(player.heat));$('missionTitle').textContent=complete&&!activeContract?'Nový den':mission().title;$('missionText').textContent=complete&&!activeContract?'První noc je za tebou. Otevři Kontakty a pokračuj v zakázkách.':mission().text;$('objective').textContent=complete&&!activeContract?'J · Kontakty a zakázky':mission().label;updateProgressionHud();if(interior)updateInteriorHud();}
function advance(){missionIndex=Math.min(missionIndex+1,4);updateHud()}
function showDialog(){if(complete||dialogOpen)return;dialogOpen=true;keys.clear();$('dialog').classList.remove('hidden');$('speaker').textContent=mission().speaker;$('dialogTitle').textContent=mission().title;$('dialogText').textContent=mission().dialog;$('choices').replaceChildren();for(const [text,action]of mission().choices){const button=document.createElement('button');button.textContent=text;button.onclick=()=>choose(action);$('choices').append(button)}}
function choose(action){dialogOpen=false;$('dialog').classList.add('hidden');if(action==='illegal'){player.heat=1.8;notify('Zásilka převzata. Policie je ve střehu.');advance()}if(action==='legal'){legal=true;missions[1]={title:'Poctivá směna',text:'Dojdi do autoservisu. Ještě dnes potřebují pomoc.',x:1070,y:315,label:'Pavel · autoservis',speaker:'PAVEL',dialog:'Viktor tě poslal? Potřebuju někoho na noční směnu. Žádný otázky, ale taky žádný problémy. Tady máš devět stovek.',choices:[['Dokončit směnu. (+900 Kč)','deliver']]};advance()}if(action==='deliver'&&missionIndex===1&&!complete){awardXp(80);player.cash+=legal?900:1800;player.rep+=10;notify('Úkol splněn · '+(legal?'900':'1 800')+' Kč');advance()}if(action==='family'){awardXp(40);player.cash-=800;player.rep+=15;notify('Eliška: Díky. Dávej na sebe pozor.');advance()}if(action==='decline')advance();if(action==='hide'){awardXp(40);player.heat=0;notify('Pozornost policie klesla.');advance()}if(action.endsWith('End')){complete=true;notify(action==='streetEnd'?'Konec kapitoly: Král bez koruny.':'Konec kapitoly: Druhá šance.');$('missionText').textContent=action==='streetEnd'?'Ulice ti otevřela dveře. Otázka je, co si vezme zpátky.':'Peníze nejsou všechno. Zítra začínáš v servisu.';}updateHud();saveProgress()}
function collision(x,y,r){if(interior)return interiorCollision(x,y,r);return x<r||y<r||x>size-r||y>size-r||nearbyBuildings(x,y,r).some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)}
function doorFor(b){return {x:b.x+b.w/2,y:b.y+b.h+12}}
function nearestDoor(){let nearest=null,best=42;for(const b of nearbyBuildings(player.x,player.y,100)){const door=doorFor(b),d=distance(player,door);if(d<best&&!collision(door.x,door.y,10)){nearest=b;best=d}}return nearest}
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
function interact(){if(!started||paused||dialogOpen)return;if(interior){useInterior();return;}const stop=nearestTransitStop();if(stop){showTransitMenu(stop);return;}if(targetAvailable()&&distance(player,mission())<65){if(activeContract)completeContract();else showDialog();return;}const door=nearestDoor();if(door){enterBuilding(door);return;}notify('Přibliž se ke kontaktu nebo k fialově osvětlenému vstupu.');}

function enterCar(){if(!started||paused||dialogOpen)return;if(interior){notify('Auto je venku na ulici.');return;}if(player.car){const car=player.car;for(const offset of [Math.PI/2,-Math.PI/2,Math.PI]){const x=car.x+Math.cos(car.angle+offset)*38,y=car.y+Math.sin(car.angle+offset)*38;if(!collision(x,y,10)){player.x=x;player.y=y;player.car=null;car.velocity=0;car.parked=true;notify('Vystoupil jsi.');return}}notify('Není tu prostor pro vystoupení.');return;}const nearest=cars.filter(c=>!c.police&&!c.transit).sort((a,b)=>distance(player,a)-distance(player,b))[0];if(nearest&&distance(player,nearest)<65){player.car=nearest;nearest.parked=true;nearest.velocity=0;player.x=nearest.x;player.y=nearest.y;player.angle=nearest.angle;notify('W plyn · S brzda / zpátečka · A/D zatáčení · mezerník ruční brzda')}else notify('Přibliž se k autu a stiskni F.')}
function togglePause(){if(!started||dialogOpen)return;paused=!paused;$('menu').classList.toggle('hidden',!paused);$('start').innerHTML='POKRAČOVAT <span>↗</span>';keys.clear()}
$('start').onclick=()=>{started=true;paused=false;$('menu').classList.add('hidden');notify('První noc · Najdi Viktora před klubem.');};$('pause').onclick=togglePause;
addEventListener('keydown',e=>{if(e.target?.matches?.('input, textarea, select, [contenteditable="true"]'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(e.target?.matches?.('input, textarea, select')){keys.delete(k);return;}if(k==='p')openLifeMenu('phone');if(k==='e')interact();if(k==='f')enterCar();if(k==='m')mapExpanded=!mapExpanded;if(k==='j')openContracts();if(k==='escape'){if(dialogOpen)closeContracts();else togglePause()}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();if(started&&!paused&&!dialogOpen)togglePause()});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key)}$('touchE').onclick=interact;$('touchF').onclick=enterCar;
$('sound').onclick=()=>{try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();sound=!sound;$('sound').textContent='ZVUK: '+(sound?'ZAPNUTO':'VYPNUTO');if(sound){const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.035;const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();filter.type='lowpass';filter.frequency.value=850;source.buffer=buffer;source.loop=true;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();audio.rainGain=gain}else audio.suspend()}catch{notify('Zvuk není v tomto prohlížeči dostupný.')}};
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
function rect(x,y,ww,hh,color){ctx.fillStyle=color;ctx.fillRect(x,y,ww,hh)}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function carCollision(x,y,angle){
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const halfLength=23,halfWidth=13;
  const extentX=Math.abs(cos)*halfLength+Math.abs(sin)*halfWidth;
  const extentY=Math.abs(sin)*halfLength+Math.abs(cos)*halfWidth;
  if(x<extentX||y<extentY||x>size-extentX||y>size-extentY)return true;
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
    car.velocity=Math.max(-105,Math.min(310,car.velocity));
    const steering=Number(input.right)-Number(input.left);
    const turnRate=Math.min(2.15,Math.abs(car.velocity)*.033);
    const angle=car.angle+steering*turnRate*step*Math.sign(car.velocity);
    if(!carCollision(car.x,car.y,angle))car.angle=angle;
    const nx=car.x+Math.cos(car.angle)*car.velocity*step;
    const ny=car.y+Math.sin(car.angle)*car.velocity*step;
    if(!carCollision(nx,ny,car.angle)){
      car.x=nx;car.y=ny;
    }else{
      if(Math.abs(car.velocity)>80&&car.crashCooldown===0){
        player.cash=Math.max(0,player.cash-50);
        player.heat=Math.min(5,player.heat+.3);
        car.crashCooldown=1.5;
        notify('Nehoda · −50 Kč');saveProgress();updateHud();
      }
      car.velocity=0;
    }
  }
}

function update(dt){time+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').style.opacity=0}if(!started||paused||dialogOpen)return;lifeState.elapsed+=dt;lifeSaveElapsed+=dt;if(lifeSaveElapsed>=10){lifeSaveElapsed=0;saveProgress();}if(lifeState.elapsed>=300){lifeState.elapsed-=300;lifeSystem.nextDay(lifeState);saveProgress();notify('Den '+lifeState.day+' · zkontroluj účty v telefonu (P)');}const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');if(player.car){const c=player.car;updateDriving(c,{up,down,left,right,brake:keys.has(' ')},dt);player.x=c.x;player.y=c.y;player.angle=c.angle}else{let dx=right-left,dy=down-up,len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;const speed=keys.has('shift')?155:90;if(!collision(player.x+dx*speed*dt,player.y,10))player.x+=dx*speed*dt;if(!collision(player.x,player.y+dy*speed*dt,10))player.y+=dy*speed*dt;player.angle=Math.atan2(dy,dx);player.step+=dt*12}}
for(const c of cars){if(interior||c===player.car||c.parked)continue;if(c.transit){updateTransitVehicle(c,dt);continue;}if(c.police&&player.heat>.5&&distance(c,player)<650){const angle=Math.atan2(player.y-c.y,player.x-c.x);c.angle=angle;const nx=c.x+Math.cos(angle)*105*dt,ny=c.y+Math.sin(angle)*105*dt;if(!collision(nx,ny,21)){c.x=nx;c.y=ny}if(distance(c,player)<38){player.cash=Math.max(0,player.cash-400);player.heat=0;player.x=255;player.y=350;if(player.car){player.car.x=275;player.car.y=350;player.car.velocity=0;player.car=null}const lostCargo=Boolean(activeContract);activeContract=null;notify(lostCargo?'Zadržení · zásilka zabavena · pokuta 400 Kč':'Zadržení · pokuta 400 Kč · návrat do čtvrti');saveProgress();updateHud()}}else{if(c.axis)c.x=(c.x+c.speed*dt)%size;else c.y=(c.y+c.speed*dt)%size;c.angle=c.axis?0:Math.PI/2}}
for(const p of people){if(p.role&&!interior&&player.heat>1&&distance(p,player)<180&&!player.car){const dx=player.x-p.x,dy=player.y-p.y,len=Math.hypot(dx,dy);if(len>0){const nx=p.x+dx/len*42*dt,ny=p.y+dy/len*42*dt;if(!collision(nx,ny,10)){p.x=nx;p.y=ny;}}if(len<20){player.cash=Math.max(0,player.cash-250);player.heat=0;activeContract=null;notify((p.role==='warden'?'Strážník':'Policista')+' · kontrola a pokuta 250 Kč');saveProgress();updateHud();}continue;}if(p.axis)p.x=(p.x+p.dir*18*dt+size)%size;else p.y=(p.y+p.dir*18*dt+size)%size}if(player.heat>0){player.heat=Math.max(0,player.heat-dt*.025);$('heat').textContent='★'.repeat(Math.ceil(player.heat))+'☆'.repeat(5-Math.ceil(player.heat))}camera.x+=(player.x-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-camera.y)*Math.min(1,dt*5);const currentDistrict=districtAt(player.x,player.y);$('location').firstChild.textContent=currentDistrict.name+' ';$('location').style.color=currentDistrict.color;$('distance').textContent=targetAvailable()?Math.round(distance(player,mission()))+' m':'';const near=targetAvailable()&&distance(player,mission())<65;const nearCar=cars.some(c=>!c.police&&!c.transit&&distance(c,player)<60);$('prompt').style.display=near||nearCar||player.car?'block':'none';$('prompt').textContent=near?'[E] Promluvit · '+mission().speaker:player.car?'[F] Vystoupit z auta':'[F] Nastoupit do auta';if(interior)updateInteriorHud();else{const door=nearestDoor();if(door&&!near){$('prompt').style.display='block';$('prompt').textContent='[E] Vstoupit · '+(door.name||'činžovní dům')}const stop=nearestTransitStop();if(stop){$('prompt').style.display='block';$('prompt').textContent='[E] MHD · '+stop.name}}}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}
function rounded(x,y,width,height,radius,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.fill()}
function visible(x,y,margin=250){const scale=(w<800?1.04:1.32)*viewZoom,cx=Math.max(w/(2*scale),Math.min(size-w/(2*scale),camera.x)),cy=Math.max(h/(2*scale),Math.min(size-h/(2*scale),camera.y));return Math.abs(x-cx)<w/(2*scale)+margin&&Math.abs(y-cy)<h/(2*scale)+margin}
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
  if(b.type==='old'){
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
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);
  rounded(-25,-10,52,25,9,'#00091099');
  const beam=ctx.createLinearGradient(20,0,150,0);beam.addColorStop(0,'#fff5d159');beam.addColorStop(.35,'#ffedb71b');beam.addColorStop(1,'#fff6d000');
  for(const yy of [-7,7])polygon([[20,yy-3],[150,yy-30],[165,yy+28],[20,yy+3]],beam);
  rounded(-19,-15,11,6,2,'#080d13');rounded(10,-15,11,6,2,'#080d13');rounded(-19,9,11,6,2,'#080d13');rounded(10,9,11,6,2,'#080d13');
  const paint=ctx.createLinearGradient(0,-12,0,12);paint.addColorStop(0,'#c2ced0');paint.addColorStop(.15,c.police?'#f2f4f2':c.color);paint.addColorStop(.65,c.police?'#99b3c1':c.color);paint.addColorStop(1,'#182c3a');
  rounded(-24,-12,49,24,6,paint);ctx.strokeStyle='#ffffff45';ctx.lineWidth=.8;ctx.stroke();
  rounded(-10,-10,24,20,4,'#092432');
  const glass=ctx.createLinearGradient(-10,-9,14,8);glass.addColorStop(0,'#6596ac');glass.addColorStop(.4,'#214758');glass.addColorStop(1,'#0a2230');
  polygon([[8,-9],[14,-7],[14,7],[8,9]],glass);polygon([[-11,-8],[-7,-9],[-7,9],[-11,8]],glass);
  rounded(-6,-8,13,16,2,c.police?'#edf3f1':c.color);rect(-5,-7,10,1,'#ffffff50');
  ctx.strokeStyle='#101e2b99';ctx.beginPath();ctx.moveTo(16,-9);ctx.lineTo(16,9);ctx.moveTo(-16,-9);ctx.lineTo(-16,9);ctx.stroke();
  rect(-2,-14,5,2,c.color);rect(-2,12,5,2,c.color);rounded(21,-10,4,6,1,'#fff1bf');rounded(21,4,4,6,1,'#fff1bf');
  rect(-25,-10,3,5,'#ff5264');rect(-25,5,3,5,'#ff5264');glow(-27,0,24,'#ff254019');
  rect(24,-4,2,8,'#08151f');rect(-25,-4,2,8,'#08151f');
  if(c.police){rect(-2,-8,5,16,'#142535');glow(0,-5,35,time%1<.5?'#368bff80':'#ff304960');glow(0,5,35,time%1<.5?'#ff304960':'#368bff80');rect(-2,-8,5,7,'#47a0ff');rect(-2,1,5,7,'#ff4861');}
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
  const centerX=Math.max(w/(2*scale),Math.min(size-w/(2*scale),camera.x));
  const centerY=Math.max(h/(2*scale),Math.min(size-h/(2*scale),camera.y));
  const startCol=Math.max(0,Math.floor((centerX-w/(2*scale))/block));
  const endCol=Math.min(gridSize-1,Math.floor((centerX+w/(2*scale))/block));
  const startRow=Math.max(0,Math.floor((centerY-h/(2*scale))/block));
  const endRow=Math.min(gridSize-1,Math.floor((centerY+h/(2*scale))/block));
  for(let row=startRow;row<=endRow;row++)for(let col=startCol;col<=endCol;col++){
    const key=row*gridSize+col;
    let tile=terrainTiles.get(key);
    if(!tile){
      tile=document.createElement('canvas');tile.width=block;tile.height=block;
      const t=tile.getContext('2d');const type=cityBlocks[key].type;
      t.fillStyle=type==='park'?'#234036':type==='plaza'?'#3b4652':'#2b343d';t.fillRect(0,0,block,block);
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
      for(const p of puddles){if(p.x>=col*block&&p.x<(col+1)*block&&p.y>=row*block&&p.y<(row+1)*block&&!collision(p.x,p.y,2)){t.fillStyle='#7297b82b';t.beginPath();t.ellipse(p.x-col*block,p.y-row*block,p.r*2,p.r,.3,0,7);t.fill()}}
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
  for(let row=0;row<gridSize;row++)for(let col=0;col<gridSize;col++){
    const x=col*block+65,y=row*block+180;if(!visible(x,y))continue;
    rect(x-6,y+4,16,22,'#060f1766');rounded(x-8,y,13,20,2,'#326660');rect(x-9,y,15,3,'#779d88');rect(x-5,y+5,7,1,'#0c302b');
    rect(x-3,y+56,5,32,'#080e16');rect(x-5,y+55,10,3,'#e1b766');
    glow(x+275,y+94,23,'#000b1380');ctx.fillStyle='#1e5550';for(let k=0;k<5;k++){ctx.beginPath();ctx.arc(x+272+Math.sin(k*2)*8,y+88+Math.cos(k*2)*8,12,0,7);ctx.fill()}ctx.fillStyle='#467a6260';ctx.beginPath();ctx.arc(x+268,y+85,10,0,7);ctx.fill();
  }
}

function drawBoundaryFog2d() {
  const band = 900;
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const horizontal = edge === 'left' || edge === 'right';
    const reversed = edge === 'right' || edge === 'bottom';
    const outside = reversed ? size : 0;
    const inside = reversed ? size-band : band;
    const gradient = horizontal ? ctx.createLinearGradient(outside, 0, inside, 0) : ctx.createLinearGradient(0, outside, 0, inside);
    gradient.addColorStop(0, '#465768');
    gradient.addColorStop(.4, '#465768cc');
    gradient.addColorStop(1, '#46576800');
    ctx.fillStyle = gradient;
    if (horizontal) ctx.fillRect(reversed ? size-band : 0, 0, band, size);
    else ctx.fillRect(0, reversed ? size-band : 0, size, band);
  }
}

function renderLegacy(){if(interior){renderInterior2d();return;}
  ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,'#0b1723');ctx.save();
  const scale=(w<800?1.04:1.32)*viewZoom;
  const viewX=Math.max(w/(2*scale),Math.min(size-w/(2*scale),camera.x));
  const viewY=Math.max(h/(2*scale),Math.min(size-h/(2*scale),camera.y));
  ctx.translate(w/2-viewX*scale,h/2-viewY*scale);ctx.scale(scale,scale);
  drawTerrain();drawLandmarks();drawStreetProps();drawStreetNames();
  for(const b of buildings)if(visible(b.x+b.w/2,b.y+b.h/2))drawBuilding(b);
  for(const l of lamps){if(!visible(l.x,l.y,130))continue;glow(l.x,l.y,130,'#ffc27b29');ctx.strokeStyle='#0a1622';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(l.x,l.y+10);ctx.lineTo(l.x-5,l.y-12);ctx.lineTo(l.x+6,l.y-18);ctx.stroke();glow(l.x+6,l.y-18,12,'#fff0bcdf');rounded(l.x+1,l.y-20,10,4,2,'#fff0b9')}
  for(const p of people)if(visible(p.x,p.y,30))drawPerson(p.x,p.y,p.axis?(p.dir>0?0:Math.PI):(p.dir>0?Math.PI/2:-Math.PI/2),p.color,time*7);
  for(const c of cars)if(visible(c.x,c.y,160))drawCar(c);
  if(targetAvailable()){const m=mission();glow(m.x,m.y,60,'#ae7bfa23');drawPerson(m.x,m.y,-Math.PI/2,'#7c5185');ctx.strokeStyle='#c5f46b';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(m.x,m.y,23+Math.sin(time*3),15,0,0,7);ctx.stroke();ctx.fillStyle='#c5f46b';polygon([[m.x,m.y-29+Math.sin(time*2)*3],[m.x-5,m.y-37+Math.sin(time*2)*3],[m.x+5,m.y-37+Math.sin(time*2)*3]],'#c5f46b');ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(m.speaker,m.x,m.y-48)}
  if(!player.car){drawPerson(player.x,player.y,player.angle,'#2d3945',player.step,true);ctx.strokeStyle='#37d6ffee';ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,15,0,7);ctx.stroke()}
  drawBoundaryFog2d();
  ctx.restore();
  drawDistrictAtmosphere();
  ctx.strokeStyle='#c3e3ff20';ctx.lineWidth=1;ctx.beginPath();const count=Math.min(130,Math.floor(w/9));for(let i=0;i<count;i++){const rx=(i*137.7+time*70)%w,ry=(i*91.3+time*480)%h;ctx.moveTo(rx,ry);ctx.lineTo(rx-4,ry+13)}ctx.stroke();
  drawMap();if(player.car){ctx.font='700 26px Arial';ctx.textAlign='right';ctx.fillStyle='#c5f46b';ctx.fillText(Math.round(Math.abs(player.car.velocity||0)*.35)+' km/h',w-35,h-235)}
}

function drawDistrictAtmosphere(){
  const district=districtAt(camera.x,camera.y);
  const tint=district.style==='industrial'?'#e2974d08':district.style==='old'?'#d19f7507':district.style==='modern'?'#48bbff09':'#9b5dc908';
  rect(0,0,w,h,tint);
  const haze=ctx.createLinearGradient(0,0,0,h);haze.addColorStop(0,'#9fb8dc0b');haze.addColorStop(.5,'#9fb8dc00');haze.addColorStop(1,'#030c1615');rect(0,0,w,h,haze);
}
function drawMap(){
  const mw=w<800?115:190,x=w-mw-26,y=h-mw-76,zoom=mapExpanded?cityMapZoom:nearbyMapZoom;
  const span=size/zoom,s=mw/span,cx=mapExpanded&&cityMapZoom===1?size/2:Math.max(span/2,Math.min(size-span/2,player.x)),cy=mapExpanded&&cityMapZoom===1?size/2:Math.max(span/2,Math.min(size-span/2,player.y));
  rect(x-8,y-8,mw+16,mw+16,'#080f18ed');ctx.save();ctx.beginPath();ctx.rect(x,y,mw,mw);ctx.clip();ctx.translate(x-(cx-span/2)*s,y-(cy-span/2)*s);
  rect(0,0,size*s,size*s,'#24353e');
  for(const area of cityBlocks){rect(area.x*s,area.y*s,block*s,block*s,area.type==='park'?'#365c48':area.type==='modern'?'#2e495a':area.type==='industrial'?'#4c4440':'#2c3840')}
  for(let i=0;i<gridSize;i++){rect(i*block*s,0,52*s,size*s,'#69787f');rect(0,i*block*s,size*s,52*s,'#69787f')}
  for(const b of buildings)rect(b.x*s,b.y*s,b.w*s,b.h*s,'#0d1b28');
  if(targetAvailable()){ctx.fillStyle='#c5f46b';ctx.beginPath();ctx.arc(mission().x*s,mission().y*s,4,0,7);ctx.fill()}
  for(const c of cars.filter(c=>c.police)){ctx.fillStyle='#5c99ef';ctx.fillRect(c.x*s,c.y*s,3,3)}
  if(mapExpanded){ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillStyle='#e3e7dc';for(const label of [{x:5000,y:3300,name:'ŽIŽKOV'},{x:8000,y:10000,name:'VINOHRADY'},{x:1800,y:9500,name:'KARLÍN'},{x:15800,y:6500,name:'CENTRUM'},{x:10000,y:16800,name:'HOLEŠOVICE'}])ctx.fillText(label.name,label.x*s,label.y*s)}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x*s,player.y*s,4,0,7);ctx.fill();ctx.restore();ctx.font='10px Arial';ctx.textAlign='left';ctx.fillStyle='#bdcad1';ctx.fillText(mapExpanded?'CELÉ MĚSTO · [M]':'OKOLÍ · [M] CELÉ MĚSTO',x,y-17);
}
let mapExpanded=false;
canvas.addEventListener?.('pointerup',event=>{
  const bounds=canvas.getBoundingClientRect(),px=event.clientX-bounds.left,py=event.clientY-bounds.top;
  const mapWidth=w<800?115:190,mapX=w-mapWidth-26,mapY=h-mapWidth-76;
  if(px>=mapX-8&&px<=mapX+mapWidth+8&&py>=mapY-24&&py<=mapY+mapWidth+8)mapExpanded=!mapExpanded;
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
function playerLevel(){let level=1;while(level<levelThresholds.length&&player.xp>=levelThresholds[level])level++;return level}
function awardXp(amount){
  const oldLevel=playerLevel();player.xp+=amount;
  if(playerLevel()>oldLevel){const unlocked=substances.filter(item=>item.level>oldLevel&&item.level<=playerLevel());notify('LEVEL '+playerLevel()+' · '+(unlocked.length?'Odemčeno: '+unlocked.map(item=>item.name).join(', '):'Nová úroveň zkušeností'));}
  saveProgress();
}
function targetAvailable(){return Boolean(activeContract)||!complete}
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
  for(const item of substances){
    const button=document.createElement('button'),unlocked=playerLevel()>=item.level;
    button.className='substanceCard';button.style.borderLeftColor=item.color;
    const title=document.createElement('strong');title.textContent=item.name+' · LVL '+item.level;
    const details=document.createElement('span');details.textContent=unlocked?item.category+' · '+item.reward.toLocaleString('cs-CZ')+' Kč · '+item.xp+' XP · riziko '+Math.ceil(item.risk)+'/5':'Zamčeno · odemkne se na levelu '+item.level;
    button.append(title,details);button.disabled=!unlocked||!complete||Boolean(activeContract);button.onclick=()=>acceptContract(item.id);$('choices').append(button);
  }
  if(activeContract){const cancel=document.createElement('button');cancel.textContent='Zrušit zakázku (bez odměny a XP)';cancel.onclick=()=>{activeContract=null;closeContracts();saveProgress();updateHud();notify('Zakázka zrušena.');};$('choices').append(cancel)}
  const close=document.createElement('button');close.textContent='Zavřít';close.onclick=closeContracts;$('choices').append(close);
}
function closeContracts(){lifeMenu=null;activeShop=null;dialogOpen=false;$('dialog').classList.add('hidden');keys.clear()}
function acceptContract(id){
  const item=substances.find(entry=>entry.id===id);
  if(!item||!complete||activeContract||playerLevel()<item.level)return false;
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
  try{localStorage.setItem('street-life-progress-v1',JSON.stringify({version:1,life:lifeState,health:player.health,xp:player.xp,cash:player.cash,rep:player.rep,missionIndex,legal,complete,activeContract,contractCount}));}catch{}
}
function restoreProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem('street-life-progress-v1')||'null');if(!saved||saved.version!==1)return;
    if(!['xp','cash','rep','missionIndex','contractCount'].every(key=>Number.isSafeInteger(saved[key])&&saved[key]>=0)||saved.missionIndex>4||typeof saved.legal!=='boolean'||typeof saved.complete!=='boolean')return;
    lifeState=lifeSystem.restore(saved.life);player.xp=saved.xp;player.cash=saved.cash;player.rep=saved.rep;missionIndex=saved.missionIndex;legal=saved.legal;complete=saved.complete;contractCount=saved.contractCount;
    if(Number.isFinite(saved.health)&&saved.health>=0&&saved.health<=100)player.health=saved.health;
    if(legal)setServiceMission();
    const contract=saved.activeContract;
    if(complete&&contract&&Number.isInteger(contract.routeIndex)&&contract.routeIndex>=0&&contract.routeIndex<deliveryRoutes.length&&substances.some(item=>item.id===contract.substanceId&&item.level<=playerLevel()))activeContract={substanceId:contract.substanceId,routeIndex:contract.routeIndex};
    if(activeContract)player.heat=substances.find(item=>item.id===activeContract.substanceId).risk;
  }catch{}
}
function setServiceMission(){missions[1]={title:'Poctivá směna',text:'Dojdi do autoservisu. Ještě dnes potřebují pomoc.',x:1070,y:315,label:'Pavel · autoservis',speaker:'PAVEL',dialog:'Potřebuju někoho na noční směnu. Tady máš devět stovek.',choices:[['Dokončit směnu. (+900 Kč)','deliver']]};}

$('contracts').onclick=openContracts;
window.streetLifeScene={size,block,gridSize,buildingBuckets,districtAt,buildings,cars,people,lamps,cityBlocks,transitStops,transitLines,player,onReady(){notify('3D Žižkov · nový renderer je aktivní');$('renderMode').textContent='3D';},onError(message){$('renderMode').textContent='2D';notify(message)}};
function render(){
  if(!window.streetLifeRenderer){renderLegacy();return;}
  try{
    window.streetLifeRenderer.render({player,camera,time,interior,zoom:viewZoom,target:targetAvailable()?mission():null});
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!interior)drawMap();
    if(player.car){ctx.font='700 26px Arial';ctx.textAlign='right';ctx.fillStyle='#c5f46b';ctx.fillText(Math.round(Math.abs(player.car.velocity||0)*.35)+' km/h',w-35,h-235)}
  }catch(error){console.error('3D frame failed',error);window.streetLifeRenderer=null;document.querySelector('#world3d')?.remove();$('renderMode').textContent='2D';notify('3D vykreslování selhalo. Pokračuje 2D verze.');renderLegacy();}
}
function renderInterior2d(){ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,'#101822');const scale=Math.min(2.5,(h-130)/interior.depth)*viewZoom;ctx.save();ctx.translate(w/2-interior.width*scale/2,h/2-interior.depth*scale/2);ctx.scale(scale,scale);rect(0,0,interior.width,interior.depth,'#9b8874');ctx.strokeStyle='#665648';for(let y=0;y<interior.depth;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(interior.width,y);ctx.stroke()}for(const item of interiorFurniture())rect(item.x,item.y,item.w,item.h,'#536a66');if(isButcherRoom()){drawPerson(interior.width*.29,interior.depth*.35,Math.PI/2,'#c1b4a4',0,false);ctx.fillStyle='#fff';ctx.font='9px Arial';ctx.fillText('KAREL · ŘEZNÍK',interior.width*.12,interior.depth*.3);}const points=interiorPoints();for(const [name,point]of Object.entries(points)){glow(point.x,point.y,20,name==='exit'?'#ca7aff88':'#c5f46b77');ctx.font='10px Arial';ctx.fillStyle='#fff';ctx.fillText(name==='up'?'↑':name==='down'?'↓':'VEN',point.x-9,point.y)}drawPerson(player.x,player.y,player.angle,'#2d3945',player.step,true);ctx.strokeStyle='#37d6ff';ctx.beginPath();ctx.arc(player.x,player.y,14,0,7);ctx.stroke();ctx.restore();}
function isLifeService() {
  return Boolean(interior && interior.floor === 0 && ['UBYTOVNA', 'BANKA', 'POTRAVINY', 'OBCHODNÍ CENTRUM', 'CENTRUM VINOHRADY'].includes(interior.building.name));
}
function lifeServicePoint() { return { x: interior.width * .55, y: interior.depth * .52 }; }
function lifeButton(label, action, value, locked = false) {
  const button = document.createElement('button');
  button.textContent = label; button.disabled = locked;
  button.onclick = () => {
    if (!dialogOpen || !lifeMenu) return;
    const remote = ['bill', 'sms'].includes(action) || (lifeMenu === 'phone' && lifeSystem.has('mobileBank', lifeEntitlements) && ['deposit', 'withdraw', 'repay'].includes(action));
    if (!remote && (!isLifeService() || distance(player, lifeServicePoint()) > 45)) return;
    const name = interior?.building.name;
    if (!remote && ((['account', 'deposit', 'withdraw', 'loan', 'repay'].includes(action) && name !== 'BANKA') || (['rent', 'sleep'].includes(action) && name !== 'UBYTOVNA') || (action === 'buy' && !['POTRAVINY', 'OBCHODNÍ CENTRUM', 'CENTRUM VINOHRADY'].includes(name)))) return;
    if (!lifeSystem.act(lifeState, player, action, value, lifeEntitlements)) { notify('Akce není dostupná nebo nemáš dost peněz.'); return; }
    saveProgress(); updateHud();
    const menu = lifeMenu; closeContracts(); openLifeMenu(menu);
  };
  $('choices').append(button);
}
function bankChoices(mobile = false) {
  if (!lifeState.account) { if (!mobile) lifeButton('Založit účet · zdarma', 'account'); return; }
  for (const amount of [100, 500]) {
    lifeButton('Vložit ' + amount + ' Kč', 'deposit', amount, player.cash < amount);
    lifeButton('Vybrat ' + amount + ' Kč', 'withdraw', amount, lifeState.balance < amount);
  }
  if (lifeState.loan) {
    const amount = Math.min(500, lifeState.loan.remaining);
    lifeButton('Splátka ' + amount + ' Kč · zbývá ' + lifeState.loan.remaining + ' Kč · splatnost den ' + lifeState.loan.due, 'repay', amount, player.cash < amount);
  } else if (!mobile) {
    lifeButton('Půjčit 1 000 Kč · splatíš 1 100 Kč za 7 dní', 'loan', 1000);
    lifeButton('Půjčit 5 000 Kč · splatíš 5 500 Kč · balíček Finance', 'loan', 5000, !lifeSystem.has('largeLoan', lifeEntitlements));
  }
}
function openLifeMenu(mode) {
  if (!started || paused || dialogOpen || (mode === 'service' && (!isLifeService() || distance(player, lifeServicePoint()) > 45))) return false;
  lifeMenu = mode; dialogOpen = true; keys.clear();
  $('dialog').classList.remove('hidden'); $('choices').replaceChildren();
  const name = mode === 'phone' ? 'TELEFON' : interior.building.name;
  $('speaker').textContent = name + ' · DEN ' + lifeState.day;
  $('dialogTitle').textContent = mode === 'phone' ? 'Zprávy a účty' : name === 'UBYTOVNA' ? 'Postel na jednu noc' : name === 'BANKA' ? 'Bankovní přepážka' : 'Co potřebuješ?';
  $('dialogText').textContent = 'Hotovost ' + player.cash + ' Kč · účet ' + lifeState.balance + ' Kč. Jeden den = 5 minut aktivní hry. ' + (name === 'UBYTOVNA' ? 'Nocleh platíš předem, spánek doplní 40 zdraví a posune den.' : '');
  if (name === 'UBYTOVNA') {
    lifeButton('Pronajmout postel · 150 Kč', 'rent', 'bed', Boolean(lifeState.rental) || player.cash < 150);
    lifeButton('Soukromý pokoj · 450 Kč · balíček Domov', 'rent', 'room', !lifeSystem.has('room', lifeEntitlements) || Boolean(lifeState.rental) || player.cash < 450);
    lifeButton('Vyspat se · +40 zdraví', 'sleep', null, !lifeState.rental);
  } else if (name === 'BANKA') bankChoices();
  else if (mode !== 'phone') for (const item of lifeSystem.products) lifeButton(item.name + ' · ' + item.price + ' Kč · +' + item.health + ' zdraví', 'buy', item.id, player.cash < item.price);
  if (mode === 'phone') {
    for (const item of lifeState.messages.slice(-8)) {
      const message = document.createElement('p'); message.textContent = 'Den ' + item.day + ' · ' + item.from + ': ' + item.text; $('choices').append(message);
    }
    for (const contact of ['Viktor', 'Eliška', 'Pavel', 'Správce']) lifeButton('SMS → ' + contact + ' · 5 Kč · max. 1 denně', 'sms', contact, lifeState.sentDay === lifeState.day || player.cash < 5 || (['Pavel', 'Správce'].includes(contact) && !lifeSystem.has('extraContacts', lifeEntitlements)));
    for (const bill of lifeState.bills) lifeButton(bill.name + ' · ' + bill.amount + ' Kč · splatnost den ' + bill.due + (lifeState.day > bill.due ? ' · PO SPLATNOSTI' : ''), 'bill', bill.id, player.cash < bill.amount);
    if (!lifeState.bills.length) { const info = document.createElement('p'); info.textContent = 'Všechny účty zaplacené.'; $('choices').append(info); }
    if (lifeSystem.has('mobileBank', lifeEntitlements)) bankChoices(true);
    for (const pack of Object.values(lifeSystem.packages)) { const info = document.createElement('p'); info.textContent = pack.name + ' · připravovaný balíček, zatím bez prodeje'; $('choices').append(info); }
  }
  const close = document.createElement('button'); close.textContent = 'Zavřít'; close.onclick = closeContracts; $('choices').append(close);
  return true;
}
$('phone').onclick = () => openLifeMenu('phone');
const originalInteriorHud = updateInteriorHud;
updateInteriorHud = function() {
  originalInteriorHud();
  if (isLifeService()) {
    $('missionText').textContent = 'Přejdi doprostřed přízemí a stiskni E · služby: ' + interior.building.name;
    if (distance(player, lifeServicePoint()) <= 45) $('prompt').textContent = '[E] ' + interior.building.name + ' · nabídka služeb';
  }
};

function frame(t){const dt=Math.min((t-last)/1000,.05);last=t;update(dt);render();requestAnimationFrame(frame)}restoreProgress();updateHud();requestAnimationFrame(frame);

document.getElementById('touchMap').onclick=()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true}));};
