const fs=require('fs'),vm=require('vm');
const storage=new Map(),els=new Map(),canvas={getContext(){return {setTransform(){}}},addEventListener(){}};
function el(){return {firstChild:{textContent:''},style:{},classList:{add(){},remove(){},toggle(){}},replaceChildren(){},append(){}}}
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/style.css','utf8');
if(!html.includes('id="playerMenuToggle"')||!html.includes('id="playerActions"')||!html.includes('id="saveGame"')||html.includes('ZVUK: VYPNUTO'))throw Error('Player menu buttons not grouped/styled');
if(!css.includes('.playerPanel')||!css.includes('#menu #accountButton'))throw Error('Player/account button styles missing');
const context={console,innerWidth:1440,innerHeight:900,devicePixelRatio:1,localStorage:{getItem(k){return storage.get(k)??null},setItem(k,v){storage.set(k,v)}},document:{querySelector(){return canvas},getElementById(id){if(!els.has(id))els.set(id,el());return els.get(id)},querySelectorAll(){return []},createElement(){return el()}},addEventListener(){},requestAnimationFrame(){}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('web/life-system.js','utf8'),context);vm.runInContext(fs.readFileSync('web/game.js','utf8'),context);
vm.runInContext(`
if(missions.length<14)throw Error('Extended story missions missing');
const markers=importantNpcMarkers(true);
for(const short of ['CÍL','BANK','OSVČ','PČR','JÍDLO','POSTEL'])if(!markers.some(marker=>marker.short===short))throw Error('Missing important NPC marker: '+short);
if(phaseFromHour(6)!=='morning'||phaseFromHour(13)!=='day'||phaseFromHour(20)!=='evening'||phaseFromHour(2)!=='night')throw Error('Prague day phase mapping failed');
if(weatherFromCode(61).condition!=='rain'||weatherFromCode(71).condition!=='snow'||weatherFromCode(45).condition!=='fog'||weatherFromCode(0).condition!=='clear')throw Error('Weather code mapping failed');
terrainTiles.set('cached', {});
applyPragueWeatherData({current:{weather_code:0,temperature_2m:11}});
if(pragueWeather.condition!=='clear'||pragueWeather.wet||pragueWeather.temperature!==11||terrainTiles.size!==0)throw Error('Clear weather update failed');
terrainTiles.set('cached', {});
applyPragueWeatherData({current:{weather_code:61,temperature_2m:9}});
if(pragueWeather.condition!=='rain'||!pragueWeather.wet||terrainTiles.size!==0)throw Error('Rain weather update failed');
started=true;missionIndex=4;complete=false;legal=false;storyPath=null;choose('streetPath');
if(storyPath!=='street'||missionIndex!==5||complete)throw Error('Street chapter continuation failed');
missionIndex=4;complete=false;legal=false;storyPath=null;choose('cleanPath');
if(storyPath!=='clean'||missionIndex!==cleanChapterStart||!legal||complete)throw Error('Clean chapter continuation failed');
missionIndex=missions.length-1;complete=false;choose('cleanEnd');if(!complete)throw Error('Clean ending failed');
localStorage.setItem('street-life-progress-v1', JSON.stringify({version:1,life:lifeSystem.create(),health:88,xp:0,cash:1200,rep:0,missionIndex:4,legal:false,complete:true,contractCount:0}));
missionIndex=0;complete=true;legal=false;storyPath='street';restoreProgress();
if(complete||missionIndex!==4||storyPath!==null)throw Error('Old street save migration failed');
localStorage.setItem('street-life-progress-v1', JSON.stringify({version:1,life:lifeSystem.create(),health:88,xp:0,cash:1200,rep:0,missionIndex:4,legal:true,complete:true,contractCount:0}));
missionIndex=0;complete=true;legal=false;storyPath=null;restoreProgress();
if(complete||missionIndex!==cleanChapterStart||storyPath!=='clean'||!legal)throw Error('Old clean save migration failed');
missionIndex=0;complete=false;legal=false;storyPath=null;
`,context);
console.log('PASS: extended story chain, old save migration, Prague clock phases, weather code mapping and cache refresh');

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

vm.runInContext(`
lifeState=lifeSystem.create();player.cash=2000;player.health=30;closeContracts();interior=null;
if(lifeSystem.act(lifeState,player,'deposit',100))throw Error('Deposit without account');
if(!lifeSystem.act(lifeState,player,'account')||lifeSystem.act(lifeState,player,'account'))throw Error('Duplicate account');
if(!lifeSystem.act(lifeState,player,'deposit',500)||lifeState.balance!==500||player.cash!==1500)throw Error('Deposit failed');
if(lifeSystem.act(lifeState,player,'withdraw',501)||lifeSystem.act(lifeState,player,'deposit',-1))throw Error('Invalid bank amount');
if(lifeSystem.act(lifeState,player,'loan',5000))throw Error('Premium bypass');
if(!lifeSystem.act(lifeState,player,'loan',1000)||lifeSystem.act(lifeState,player,'loan',1000))throw Error('Duplicate loan');
if(lifeSystem.act(lifeState,player,'rent','room'))throw Error('Room entitlement bypass');
if(!lifeSystem.act(lifeState,player,'rent','bed')||lifeSystem.act(lifeState,player,'rent','bed'))throw Error('Duplicate rent');
if(!lifeSystem.act(lifeState,player,'sleep')||lifeState.day!==2||player.health!==70||lifeSystem.act(lifeState,player,'sleep'))throw Error('Sleep failed');
lifeSystem.nextDay(lifeState);const bill=lifeState.bills[0];if(!bill||bill.amount!==80)throw Error('Missing bill');
const beforeBill=player.cash;if(!lifeSystem.act(lifeState,player,'bill',bill.id)||lifeSystem.act(lifeState,player,'bill',bill.id)||player.cash!==beforeBill-80)throw Error('Double bill charge');
if(!lifeSystem.act(lifeState,player,'sms','Viktor')||lifeSystem.act(lifeState,player,'sms','Viktor')||lifeSystem.act(lifeState,player,'sms','Pavel'))throw Error('SMS limits');
saveProgress();const expected=JSON.stringify(lifeState);lifeState=lifeSystem.create();restoreProgress();if(JSON.stringify(lifeState)!==expected)throw Error('Life save failed');
for(let i=0;i<8;i++)lifeSystem.nextDay(lifeState);if(!lifeState.loan.overdue)throw Error('No overdue loan');
if(!lifeSystem.act(lifeState,player,'repay',1100)||lifeState.loan)throw Error('Loan repayment');
if(!lifeSystem.act(lifeState,player,'loan',5000,['finance']))throw Error('Finance unlock');
if(lifeSystem.restore({...lifeState,balance:-1}).balance!==0)throw Error('Corrupt save accepted');
lifeState=lifeSystem.create();player.cash=90000;player.rep=0;
if(lifeSystem.act(lifeState,player,'trade',{type:'buy',asset:'BETON',czk:500}))throw Error('Trade without account');
lifeSystem.act(lifeState,player,'account');lifeSystem.act(lifeState,player,'deposit',50000);
if(!lifeSystem.act(lifeState,player,'trade',{type:'buy',asset:'BETON',czk:500})||lifeState.portfolio.BETON<=0||lifeState.balance!==49500)throw Error('Shitcoin buy failed');
if(!lifeSystem.act(lifeState,player,'trade',{type:'sell',asset:'BETON',units:'all'})||lifeState.portfolio.BETON!==0||lifeState.balance<=49500)throw Error('Shitcoin sell failed');
if(lifeSystem.act(lifeState,player,'business','company'))throw Error('Company before OSVC accepted');
if(!lifeSystem.act(lifeState,player,'business','osvc')||!lifeState.business.osvc||player.rep<10)throw Error('OSVC creation failed');
if(!lifeSystem.act(lifeState,player,'business','tax')||lifeSystem.act(lifeState,player,'business','tax'))throw Error('Tax filing failed');
const flat={id:'test-flat',name:'Byt test',district:'ŽIŽKOV',price:50000,rent:3500};
if(!lifeSystem.act(lifeState,player,'rentFlat',flat)||lifeState.rental.type!=='flat')throw Error('Flat rent failed');
lifeState.rental=null;
if(!lifeSystem.act(lifeState,player,'mortgageProperty',flat)||lifeState.properties[0].mortgage!==37500)throw Error('Mortgage property failed');
if(!lifeSystem.act(lifeState,player,'rentOutProperty','test-flat')||!lifeSystem.act(lifeState,player,'collectRent','test-flat'))throw Error('Property rent income failed');
if(!lifeSystem.act(lifeState,player,'payMortgage','test-flat')||lifeState.properties[0].mortgage!==36500)throw Error('Mortgage payment failed');
const restoredEconomy=lifeSystem.restore(lifeState);if(restoredEconomy.portfolio.BETON!==0||!restoredEconomy.business.osvc||restoredEconomy.properties.length!==1)throw Error('Economy restore failed');
closeContracts();const bank=buildings.find(b=>b.name==='BANKA'),hostel=buildings.find(b=>b.name==='UBYTOVNA');
const office=buildings.find(b=>b.name==='ÚŘAD PRÁCE'),apartment=buildings.find(b=>!b.name&&['residential','garden','old','modern'].includes(b.type));
for(const place of [bank,hostel,office,apartment]){if(!place)throw Error('Service missing');const door=doorFor(place);if(collision(door.x,door.y,10))throw Error('Blocked service door');enterBuilding(place);const point=lifeServicePoint();if(interiorCollision(point.x,point.y,10))throw Error('Blocked service point');player.x=point.x;player.y=point.y;if(!openLifeMenu('service'))throw Error('Service menu failed');closeContracts();interior.floor=1;if(openLifeMenu('service'))throw Error('Wrong floor service');interior=null;}
`, context);
console.log('PASS: bank transfers, trading, business, property rent/buy/mortgage, entitlements, loans/repayment/overdue, rental/sleep, recurring bills, SMS limits, persistence/corrupt saves, service entrances and floors');
