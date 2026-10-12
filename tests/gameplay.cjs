const fs=require('fs'),vm=require('vm');
const storage=new Map(),els=new Map(),canvas={getContext(){return {setTransform(){}}},addEventListener(){}};
function el(){return {firstChild:{textContent:''},style:{setProperty(){}},setAttribute(){},classList:{add(){},remove(){},toggle(){}},children:[],replaceChildren(){this.children=[]},append(...items){this.children.push(...items)}}}
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/style.css','utf8');
if(!html.includes('id="playerMenuToggle"')||!html.includes('id="playerActions"')||!html.includes('id="saveGame"')||html.includes('ZVUK: VYPNUTO'))throw Error('Player menu buttons not grouped/styled');
if(!css.includes('.playerPanel')||!css.includes('#menu #accountButton'))throw Error('Player/account button styles missing');
const context={console,innerWidth:1440,innerHeight:900,devicePixelRatio:1,localStorage:{getItem(k){return storage.get(k)??null},setItem(k,v){storage.set(k,v)}},document:{querySelector(){return canvas},getElementById(id){if(!els.has(id))els.set(id,el());return els.get(id)},querySelectorAll(){return []},createElement(){return el()}},addEventListener(){},requestAnimationFrame(){}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('web/life-system.js','utf8'),context);vm.runInContext(fs.readFileSync('web/game.js','utf8'),context);
vm.runInContext(`
if(missions.length<14)throw Error('Extended story missions missing');
const markers=importantNpcMarkers(true);
for(const short of ['CÍL','BANK','OSVČ','PČR','JÍDLO','POSTEL'])if(!markers.some(marker=>marker.short===short))throw Error('Missing important NPC marker: '+short);
for(const name of ['HASIČI','NEMOCNICE'])if(!buildings.some(building=>building.name===name))throw Error('Missing emergency building: '+name);
if(trafficLights.length<1000)throw Error('Traffic lights missing');
const signal=trafficLights[0],redTime=12-signal.offset,greenTime=2-signal.offset;
if(trafficState(signal,redTime).eastWest!=='red'||trafficState(signal,greenTime).eastWest!=='green')throw Error('Traffic signal cycle failed');
const lightCar={x:signal.x-40,y:signal.y,axis:true,speed:50,parked:false};
if(nextTrafficLight(lightCar)?.light!==signal)throw Error('Next traffic light detection failed');
if(!emergencyVehicles.some(car=>car.service==='fire')||!emergencyVehicles.some(car=>car.service==='ambulance')||!emergencyVehicles.some(car=>car.service==='police'))throw Error('Emergency vehicles missing');
if(!people.some(person=>person.role==='firefighter')||!people.some(person=>person.role==='paramedic'))throw Error('Emergency NPCs missing');
const crashA={x:signal.x+120,y:signal.y,angle:0,axis:true,speed:70,color:'#777',parked:false};
const crashB={x:signal.x+145,y:signal.y,angle:0,axis:true,speed:30,color:'#888',parked:false};
cars.push(crashA,crashB);const incident=createIncident(signal.x+132,signal.y,[crashA,crashB],'test');
if(!incident||!crashA.crashed||!incident.assigned.police||!incident.assigned.fire||!incident.assigned.ambulance)throw Error('Incident dispatch failed');
incident.assigned.police.x=incident.x;incident.assigned.police.y=incident.y;updateEmergencyServices(.2);
if(!incident.arrived.police||!incident.crew.some(member=>member.service==='police'))throw Error('Police response failed');
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
for(const lot of parkingLots){if(buildingBuckets.has(cellKey(lot.row,lot.col)))throw Error('Parking covered by buildings');if(collision(lot.col*400+200,lot.row*400+200,10))throw Error('Parking unreachable');}
for(const stop of transitStops)if(collision(stop.x,stop.y,10))throw Error('Blocked transit stop');
const stop=transitStops[0];player.x=stop.x;player.y=stop.y;player.cash=100;
showTransitMenu(stop);if(!rideTransit(1)||player.cash!==60||!transitRide||player.x===transitStops[1].x)throw Error('Transit passenger boarding failed');
if(rideTransit(1)||player.cash!==60)throw Error('Repeated transit charge');
for(let i=0;i<260&&transitRide;i++)update(.1);
if(transitRide||Math.abs(player.x-transitStops[1].x)>1||Math.abs(player.y-transitStops[1].y)>1)throw Error('Transit passenger arrival failed');
player.x=stop.x;player.y=stop.y;player.cash=0;showTransitMenu(stop);if(rideTransit(1))throw Error('Free transit accepted');closeContracts();
for(const car of cars.filter(item=>item.transit)){const x=car.x,y=car.y;for(let i=0;i<1000;i++)updateTransitVehicle(car,.1);if(car.x===x&&car.y===y)throw Error('Vehicle stuck');if(carCollision(car.x,car.y,car.angle))throw Error('Transit drives through buildings');}
if(people.filter(person=>person.role).length<16||cars.filter(car=>car.police).length<20)throw Error('Patrols missing');
`,context);
console.log('PASS: civic buildings/doors, parking, accessible stops, passenger transit ride, stale/insufficient fare, vehicle routes, police patrols');

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

vm.runInContext(`
closeContracts();interior=null;activeContract=null;activeDistrictJob=null;completedDistrictJobs=[];started=true;paused=false;
if(cityBlocks.length!==4096||new Set(cityBlocks.map(area=>cellKey(Math.floor(area.y/block),Math.floor(area.x/block)))).size!==4096)throw Error('Expanded city spatial index');
for(const anchor of pragueDistrictAnchors){if(districtAt(anchor.x,anchor.y).name!==anchor.name)throw Error('Wrong projected district');if(!districtContacts.some(contact=>contact.district===anchor.name))throw Error('Missing district NPC');}
if(Math.hypot(pragueDistrictAnchors[0].x,pragueDistrictAnchors[0].y)<4500||Math.hypot(pragueDistrictAnchors[0].x,pragueDistrictAnchors[0].y)>6000)throw Error('Villa distance scale');
if(!buildings.some(b=>b.type==='villa'&&b.height<10&&b.w<110)||districtJobs.length!==22||districtContacts.length!==11)throw Error('Villas/local quest content');
for(const contact of districtContacts){if(collision(contact.x,contact.y,10)||districtJobs.filter(job=>job.contactId===contact.id).length!==2)throw Error('Unreachable district contact');}
if(collision(-5165,-1165,10)||!collision(worldMin-5,worldMin+300,10))throw Error('Negative world boundary');
const local=districtJobs[0],follow=districtJobs[1],storyBefore=missionIndex;
if(acceptDistrictJob(follow.id)||!acceptDistrictJob(local.id)||acceptDistrictJob(local.id)||mission().title!==local.title)throw Error('Quest chain gating');
player.x=local.target.x+100;player.y=local.target.y;if(completeDistrictJob())throw Error('Remote quest completion');
player.x=local.target.x;player.y=local.target.y;const questCash=player.cash;
if(!completeDistrictJob()||player.cash!==questCash+local.reward||completeDistrictJob()||missionIndex!==storyBefore||!acceptDistrictJob(follow.id))throw Error('Quest payout/story resume');
saveProgress();activeDistrictJob=null;completedDistrictJobs=[];restoreProgress();if(activeDistrictJob!==follow.id||!completedDistrictJobs.includes(local.id))throw Error('District quest save');
activeDistrictJob=null;lifeState=lifeSystem.create();player.cash=900000;player.car=null;
lifeSystem.act(lifeState,player,'account');lifeSystem.act(lifeState,player,'deposit',700000);
const broker=buildings.find(b=>b.name==='BURZA PRAHA');if(!broker||collision(doorFor(broker).x,doorFor(broker).y,10))throw Error('Exchange entrance');
enterBuilding(broker);Object.assign(player,lifeServicePoint());if(!openLifeMenu('service')||lifeServiceKind()!=='exchange')throw Error('Exchange terminal');
stockBudget=1000;if(!submitExchangeOrder('PMOB','buy')||lifeState.portfolio.PMOB<=0||lifeState.costBasis.PMOB!==1000||lifeState.orders.length!==1||lifeState.balance!==699000)throw Error('Stock UI order');
stockBudget=-1;const unchanged=lifeState.balance;if(submitExchangeOrder('PMOB','buy')||lifeState.balance!==unchanged)throw Error('Invalid order budget');
player.x+=90;stockBudget=1000;if(submitExchangeOrder('PMOB','buy'))throw Error('Remote order');Object.assign(player,lifeServicePoint());
const oldQuote=lifeSystem.marketPrice(lifeState,'PMOB');lifeState.elapsed=60;if(oldQuote===lifeSystem.marketPrice(lifeState,'PMOB'))throw Error('Quote clock frozen');
if(!lifeSystem.act(lifeState,player,'trade',{type:'sell',asset:'PMOB',units:'all'})||lifeState.costBasis.PMOB!==0||lifeState.orders.length!==2||!Number.isSafeInteger(lifeState.realizedPnL))throw Error('P/L accounting');
closeContracts();interior=null;
for(const name of ['BAVARIA','VIER','STERN','NORD']){const b=buildings.find(item=>item.name===name+' AUTOSALON');if(!b||collision(doorFor(b).x,doorFor(b).y,10))throw Error('Dealer entrance');enterBuilding(b);Object.assign(player,lifeServicePoint());if(!openLifeMenu('service')||lifeServiceKind()!=='dealer'||!dealerOffers().length)throw Error('Dealer NPC catalog');closeContracts();interior=null;}
const bavaria=buildings.find(b=>b.name==='BAVARIA AUTOSALON');enterBuilding(bavaria);Object.assign(player,lifeServicePoint());openLifeMenu('service');
lifeButton('Test purchase','buyVehicle','b5');const buyButton=document.getElementById('choices').children.at(-1),fundsBefore=player.cash+lifeState.balance;buyButton.onclick();
const purchased=lifeState.vehicles[0],worldCar=cars.find(car=>car.ownedId===purchased?.id);
if(!purchased||!worldCar||player.cash+lifeState.balance!==fundsBefore-85000||carCollision(worldCar.x,worldCar.y,worldCar.angle))throw Error('Dealer purchase/spawn');
lifeButton('Wrong salon model','buyVehicle','gw');document.getElementById('choices').children.at(-1).onclick();if(lifeState.vehicles.length!==1)throw Error('Unauthorized dealer model');
worldCar.y+=5;saveProgress();lifeState=lifeSystem.create();restoreProgress();if(lifeState.vehicles.length!==1||cars.filter(car=>car.ownedId===purchased.id).length!==1)throw Error('Owned car restart');
closeContracts();Object.assign(player,lifeServicePoint());openLifeMenu('service');const sale=lifeSystem.resaleValue(lifeState,lifeState.vehicles[0]),beforeSale=lifeState.balance;
lifeButton('Test sell','sellVehicle',purchased.id);document.getElementById('choices').children.at(-1).onclick();if(lifeState.vehicles.length||cars.some(car=>car.ownedId===purchased.id)||lifeState.balance!==beforeSale+sale)throw Error('Dealer sale/remove/payout');
lifeButton('Test lease','leaseVehicle','b5');document.getElementById('choices').children.at(-1).onclick();const leased=lifeState.vehicles[0];if(!leased?.lease||leased.lease.remaining!==76160)throw Error('Lease contract');
if(lifeSystem.act(lifeState,player,'payLease',leased.id))throw Error('Early duplicate installment');
for(let day=0;day<3;day++)lifeSystem.nextDay(lifeState);const debtBefore=leased.lease.remaining;if(!lifeSystem.act(lifeState,player,'payLease',leased.id)||leased.lease.remaining!==debtBefore-6347||lifeSystem.act(lifeState,player,'payLease',leased.id))throw Error('Lease installment');
saveProgress();lifeState=lifeSystem.restore(lifeState);if(lifeState.vehicles[0].lease.remaining!==debtBefore-6347)throw Error('Lease restore');
for(let day=0;day<7;day++)lifeSystem.nextDay(lifeState);reconcileOwnedVehicles();if(lifeState.vehicles.length||cars.some(car=>car.ownedId===leased.id))throw Error('Lease repossession');
closeContracts();interior=null;
`,context);
console.log('PASS: projected villa districts, 22 chained quests, NPC reachability, negative city bounds, stock UI orders/P&L/history, dealer purchase/spawn/sale/restore, leasing payments and repossession');

vm.runInContext(fs.readFileSync('web/city-map.js','utf8'),context);
vm.runInContext(`
closeContracts();interior=null;started=true;paused=false;player.x=255;player.y=350;
const navigation=window.lifeCityMap;
if(!navigation.find('orechovka').some(point=>point.name==='OŘECHOVKA')||!navigation.find('burza','finance').some(point=>point.name==='BURZA PRAHA')||navigation.find('BAVARIA','finance').length)throw Error('Map search/filter');
for(const point of navigation.pois().filter(point=>point.category!=='district')){
 const route=navigation.buildRoute(player,point);if(!route.length)throw Error('No street route to '+point.name);
 if(navigation.routeLength(route)+.01<distance(player,point))throw Error('Route shorter than straight distance');
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];if(Math.abs(a.x-b.x)>.01&&Math.abs(a.y-b.y)>.01)throw Error('Diagonal street routing');const steps=Math.max(1,Math.ceil(distance(a,b)/10));for(let j=0;j<=steps;j++){const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;if(nearbyBuildings(x,y,4).some(building=>x>building.x&&x<building.x+building.w&&y>building.y&&y<building.y+building.h))throw Error('Route through building');}}
}
if(!navigation.toggle(true)||!mapExpanded)throw Error('Map open');
const cursor={x:900,y:500},before=navigation.toWorld(cursor);navigation.zoomAt(1.4,cursor);if(distance(before,navigation.toWorld(cursor))>.01)throw Error('Zoom cursor drift');
const exchange=navigation.find('burza')[0];if(!navigation.selectPlace(exchange.id)||!navigation.routeTo(exchange.id)||!navigation.state.route.length||localStorage.getItem('street-life-navigation-v1')!==exchange.id)throw Error('Map route selection/save');
navigation.clearRoute();if(navigation.state.route.length)throw Error('Map clear route');navigation.toggle(false);if(mapExpanded)throw Error('Map close');
`,context);
console.log('PASS: map search/categories, street routing to every POI without building crossings, cursor zoom, POI selection, saved navigation and open/close');
