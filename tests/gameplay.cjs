const fs=require('fs'),vm=require('vm');
const storage=new Map(),els=new Map(),canvas={getContext(){return {setTransform(){}}},addEventListener(){}};
function el(){return {firstChild:{textContent:''},style:{},classList:{add(){},remove(){},toggle(){}},replaceChildren(){},append(){}}}
const context={console,innerWidth:1440,innerHeight:900,devicePixelRatio:1,localStorage:{getItem(k){return storage.get(k)??null},setItem(k,v){storage.set(k,v)}},document:{querySelector(){return canvas},getElementById(id){if(!els.has(id))els.set(id,el());return els.get(id)},querySelectorAll(){return []},createElement(){return el()}},addEventListener(){},requestAnimationFrame(){}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('web/game.js','utf8'),context);
vm.runInContext(`
started=true;const shop=buildings.find(b=>b.name==='ŘEZNICTVÍ');if(!shop)throw Error('Shop missing');
const door=doorFor(shop);player.x=door.x;player.y=door.y;if(nearestDoor()!==shop)throw Error('Shop entrance unreachable');
enterBuilding(shop);const point=butcherPoint();if(interiorCollision(point.x,point.y,10))throw Error('Counter interaction blocked');
player.x=point.x;player.y=point.y;player.cash=200;player.health=40;useInterior();
if(!dialogOpen||activeShop!==shop)throw Error('Merchant interaction failed');
if(!buyButcherProduct('sausage')||player.cash!==105||player.health!==60)throw Error('Wrong purchase effect');
if(buyButcherProduct('sausage')||player.cash!==105)throw Error('Stale click charged twice');
showButcherShop();if(buyButcherProduct('meal')||player.cash!==105)throw Error('Insufficient funds accepted');
if(buyButcherProduct('missing'))throw Error('Unknown item accepted');closeShop();
player.cash=500;player.health=95;showButcherShop();buyButcherProduct('roll');if(player.health!==100)throw Error('Health cap failed');
player.cash=0;player.health=0;restoreProgress();if(player.cash!==455||player.health!==100)throw Error('Purchase not persisted');
showButcherShop();player.x=point.x+100;if(buyButcherProduct('roll'))throw Error('Remote purchase accepted');closeShop();
interior.floor=1;if(showButcherShop())throw Error('Wrong floor merchant');
`,context);
console.log('PASS: butcher entrance, NPC interaction, prices, cash/health, health cap, save/restore, insufficient funds, stale click, distance/floor checks');

vm.runInContext(`
interior=null;player.car=null;dialogOpen=false;activeShop=null;
for(const name of ['ZÁKLADNÍ ŠKOLA','ÚŘAD PRÁCE','POLICIE ČR','OBCHODNÍ CENTRUM','GYMNÁZIUM VINOHRADY','CENTRUM VINOHRADY']){
 const b=buildings.find(item=>item.name===name);if(!b)throw Error('Missing civic place: '+name);const door=doorFor(b);if(collision(door.x,door.y,10))throw Error('Blocked civic door');
}
for(const lot of parkingLots){if(buildingBuckets.has(lot.row*gridSize+lot.col))throw Error('Parking covered by buildings');if(collision(lot.col*400+200,lot.row*400+200,10))throw Error('Parking unreachable');}
for(const stop of transitStops)if(collision(stop.x,stop.y,10))throw Error('Blocked transit stop');
const stop=transitStops[0];player.x=stop.x;player.y=stop.y;player.cash=100;
showTransitMenu(stop);if(!rideTransit(1)||player.cash!==60||player.x!==transitStops[1].x)throw Error('Transit purchase/arrival failed');
if(rideTransit(1)||player.cash!==60)throw Error('Repeated transit charge');
player.x=stop.x;player.y=stop.y;player.cash=0;showTransitMenu(stop);if(rideTransit(1))throw Error('Free transit accepted');closeContracts();
for(const car of cars.filter(item=>item.transit)){const x=car.x,y=car.y;for(let i=0;i<1000;i++)updateTransitVehicle(car,.1);if(car.x===x&&car.y===y)throw Error('Vehicle stuck');if(carCollision(car.x,car.y,car.angle))throw Error('Transit drives through buildings');}
if(people.filter(person=>person.role).length<16||cars.filter(car=>car.police).length<20)throw Error('Patrols missing');
`,context);
console.log('PASS: civic buildings/doors, parking, accessible stops, transit fare and arrival, stale/insufficient fare, vehicle routes, police patrols');
