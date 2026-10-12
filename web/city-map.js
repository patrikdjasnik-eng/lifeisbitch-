'use strict';
window.lifeCityMap = (() => {
  const source = window.streetLifeScene, mapCanvas = $('cityMapCanvas'), mapCtx = mapCanvas?.getContext?.('2d');
  const state = { x: player.x, y: player.y, scale: .23, width: innerWidth, height: innerHeight, category: 'all', query: '', selected: null, destination: null, route: [], markers: [], dirty: true };
  const categories = [
    ['all','Vše','#6d7680','●'], ['quest','Úkoly','#e89c28','!'], ['finance','Finance','#50886d','Kč'],
    ['dealer','Autosalony','#8061ad','A'], ['transit','MHD','#5282be','M'], ['service','Služby','#cc705d','S'], ['district','Čtvrti','#738277','Č']
  ];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const position = () => interior ? interior.outside : player;
  function pois() {
    const points = [];
    for (const config of importantNpcConfigs) {
      const building = buildings.find(item => item.name === config.name); if (!building) continue;
      const point = doorFor(building), category = building.name.endsWith('AUTOSALON') ? 'dealer' : ['BANKA','BURZA PRAHA'].includes(building.name) ? 'finance' : 'service';
      points.push({id:'building:'+building.x+':'+building.y,name:building.name,subtitle:config.label,category,...point});
    }
    for (const building of buildings.filter(b => ['BESEDA OŘECHOVKA','HANSPAULSKÝ KLUB','ZÁKLADNÍ ŠKOLA','GYMNÁZIUM VINOHRADY','STŘEDNÍ ŠKOLA','KNIHOVNA ZAHRADNÍ MĚSTO','FAKE INTERNET CAFÉ'].includes(b.name))) points.push({id:'building:'+building.x+':'+building.y,name:building.name,subtitle:'Místní centrum',category:'service',...doorFor(building)});
    for (const npc of districtContacts) points.push({id:'npc:'+npc.id,name:npc.speaker,subtitle:npc.district+' · '+districtJobs.filter(job=>job.contactId===npc.id&&!completedDistrictJobs.includes(job.id)).length+' zbývající úkoly',category:'quest',x:npc.x,y:npc.y});
    for (const [index,stop] of transitStops.entries()) points.push({id:'stop:'+index,name:stop.name,subtitle:transitLines.find(line=>line.id===stop.lineId).name,category:'transit',x:stop.x,y:stop.y});
    for (const district of [...pragueDistrictAnchors,{name:'ŽIŽKOV',x:2000,y:2000},{name:'KARLÍN',x:1600,y:8000},{name:'VINOHRADY',x:8000,y:10000},{name:'ZAHRADNÍ MĚSTO',x:9000,y:11600},{name:'NOVÉ MĚSTO',x:15000,y:6000},{name:'HOLEŠOVICE · DOKY',x:8000,y:16000}]) points.push({id:'district:'+district.name,name:district.name,subtitle:'Čtvrť · vycentrovat mapu',category:'district',x:district.x,y:district.y});
    for (const owned of lifeState.vehicles) { const car=cars.find(item=>item.ownedId===owned.id); if(car)points.push({id:'car:'+owned.id,name:lifeSystem.vehicleCatalog.find(model=>model.id===owned.modelId).name,subtitle:'Tvoje auto · '+(owned.lease?'leasing':'vlastní'),category:'dealer',x:car.x,y:car.y}); }
    if (targetAvailable()) { const target=mission();points.unshift({id:'mission',name:target.title,subtitle:'Aktivní cíl · '+target.label,category:'quest',x:target.x,y:target.y,active:true}); }
    return points;
  }
  function find(query=state.query, category=state.category) {
    const word=normalize(query),origin=position();
    return pois().filter(point=>(category==='all'||point.category===category)&&(!word||normalize(point.name+' '+point.subtitle+' '+districtAt(point.x,point.y).name).includes(word))).sort((a,b)=>distance(a,origin)-distance(b,origin));
  }
  const toScreen = point => ({x:state.width/2+(point.x-state.x)*state.scale,y:state.height/2+(point.y-state.y)*state.scale});
  const toWorld = point => ({x:state.x+(point.x-state.width/2)/state.scale,y:state.y+(point.y-state.height/2)/state.scale});
  function clampCenter() { state.x=Math.max(worldMin,Math.min(size,state.x));state.y=Math.max(worldMin,Math.min(size,state.y));state.dirty=true; }
  function zoomAt(factor, screen={x:state.width/2,y:state.height/2}) {
    const before=toWorld(screen);state.scale=Math.max(.018,Math.min(1.8,state.scale*factor));const after=toWorld(screen);state.x+=before.x-after.x;state.y+=before.y-after.y;clampCenter();
  }
  function segmentClear(a,b) {
    const steps=Math.max(1,Math.ceil(distance(a,b)/12));
    for(let i=0;i<=steps;i++){
      const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
      if(x<worldMin+10||y<worldMin+10||x>size-10||y>size-10)return false;
      const bucket=source.buildingBuckets.get(cellKey(Math.floor(y/block),Math.floor(x/block)))||[];
      if(bucket.some(building=>x>building.x-4&&x<building.x+building.w+4&&y>building.y-4&&y<building.y+building.h+4))return false;
    }
    return true;
  }
  const lane = value => Math.max(worldMin+35,Math.min(size-block+35,Math.round((value-35)/block)*block+35));
  function roadAccess(point) {
    const x=lane(point.x),y=lane(point.y),candidates=[{x,y:point.y},{x:point.x,y},{x:x-block,y:point.y},{x:x+block,y:point.y},{x:point.x,y:y-block},{x:point.x,y:y+block}];
    return candidates.filter(candidate=>segmentClear(point,candidate)).sort((a,b)=>distance(a,point)-distance(b,point))[0]||null;
  }
  function buildRoute(start,end) {
    const a=roadAccess(start),b=roadAccess(end);if(!a||!b)return [];
    const aj={x:lane(a.x),y:lane(a.y)},bj={x:lane(b.x),y:lane(b.y)};
    const choices=[{x:bj.x,y:aj.y},{x:aj.x,y:bj.y}].map(corner=>[start,a,aj,corner,bj,b,end].filter((point,i,all)=>i===0||distance(point,all[i-1])>.1));
    return choices.find(route=>route.every((point,i)=>i===0||segmentClear(route[i-1],point)))||[];
  }
  const routeLength = route => route.reduce((sum,point,index)=>sum+(index?distance(point,route[index-1]):0),0);
  function routeTo(id) {
    const destination=pois().find(point=>point.id===id);if(!destination||destination.category==='district')return false;
    const route=buildRoute(position(),destination);if(!route.length){notify('K tomuto místu se nyní nepodařilo najít volnou cestu.');return false;}
    state.destination=id;state.route=route;state.selected=id;state.dirty=true;
    try{localStorage.setItem('street-life-navigation-v1',id)}catch{}
    updateDetails();notify('Navigace · '+destination.name);return true;
  }
  function clearRoute() { state.destination=null;state.route=[];state.dirty=true;try{localStorage.removeItem?.('street-life-navigation-v1')}catch{}updateDetails(); }
  function selectPlace(id) {
    const point=pois().find(item=>item.id===id);if(!point)return false;
    state.selected=id;state.x=point.x;state.y=point.y;state.scale=Math.max(state.scale,.15);clampCenter();updateDetails();return true;
  }
  function updateDetails() {
    const point=pois().find(item=>item.id===state.selected),details=$('cityMapDetails');details.classList.toggle('hidden',!point);
    if(!point)return;
    const category=categories.find(item=>item[0]===point.category),origin=position();
    $('cityMapPlaceKind').textContent=category[1]+' · '+districtAt(point.x,point.y).name;$('cityMapPlaceName').textContent=point.name;
    let text=point.subtitle+' · '+Math.round(distance(origin,point)).toLocaleString('cs-CZ')+' m vzdušnou čarou';
    if(state.destination===point.id&&state.route.length){const meters=routeLength(state.route),seconds=Math.max(1,Math.ceil(meters/(player.car?180:90)));text+=' · trasa '+Math.round(meters).toLocaleString('cs-CZ')+' m · přibližně '+Math.floor(seconds/60)+' min '+seconds%60+' s herní cesty';}
    $('cityMapPlaceText').textContent=text;$('cityMapNavigate').disabled=point.category==='district';$('cityMapClearRoute').classList.toggle('hidden',!state.destination);
  }
  function refreshResults() {
    const results=$('cityMapResults'),points=find();results.replaceChildren();
    const heading=document.createElement('p');heading.className='mapResultCount';heading.textContent=points.length+' míst · nejbližší jako první';results.append(heading);
    for(const point of points.slice(0,14)){
      const category=categories.find(item=>item[0]===point.category),button=document.createElement('button');button.className='mapPlaceResult';
      const icon=document.createElement('span'),text=document.createElement('span'),title=document.createElement('strong'),subtitle=document.createElement('small');
      icon.className='mapResultIcon';icon.style.background=category[2];icon.textContent=category[3];title.textContent=point.name;subtitle.textContent=point.subtitle;text.append(title,subtitle);button.append(icon,text);button.onclick=()=>selectPlace(point.id);results.append(button);
    }
    if(!points.length){const empty=document.createElement('p');empty.textContent='Nic nenalezeno. Zkus jiný název nebo kategorii.';results.append(empty);}
    state.dirty=true;
  }
  function resize() { const bounds=mapCanvas.getBoundingClientRect?.()||{width:innerWidth,height:innerHeight};state.width=bounds.width||innerWidth;state.height=bounds.height||innerHeight;mapCanvas.width=Math.round(state.width*Math.min(devicePixelRatio||1,2));mapCanvas.height=Math.round(state.height*Math.min(devicePixelRatio||1,2));state.dirty=true; }
  function toggle(force) {
    const opening=typeof force==='boolean'?force:!mapExpanded;if(opening&&(!started||dialogOpen||paused))return false;
    mapExpanded=opening;keys.clear();$('cityMapOverlay').classList.toggle('hidden',!mapExpanded);
    if(mapExpanded){resize();const origin=position();state.x=origin.x;state.y=origin.y;clampCenter();refreshResults();updateDetails();render();$('cityMapClose').focus?.();}else $('cityMapButton')?.focus?.();return true;
  }
  function path(points,color,width) {mapCtx.strokeStyle=color;mapCtx.lineWidth=width;mapCtx.lineCap='round';mapCtx.lineJoin='round';mapCtx.beginPath();points.forEach((point,index)=>{const p=toScreen(point);if(index)mapCtx.lineTo(p.x,p.y);else mapCtx.moveTo(p.x,p.y)});mapCtx.stroke();}
  function label(text,x,y,color,font='12px Arial') {mapCtx.font=font;mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.lineWidth=3;mapCtx.strokeStyle='#f7f5ef';mapCtx.strokeText(text,x,y);mapCtx.fillStyle=color;mapCtx.fillText(text,x,y);}
  function render() {
    if(!mapCtx||!mapExpanded||!state.dirty)return;state.dirty=false;
    const ratio=Math.min(devicePixelRatio||1,2);mapCtx.setTransform(ratio,0,0,ratio,0,0);mapCtx.fillStyle='#f2f0e9';mapCtx.fillRect(0,0,state.width,state.height);
    const top=toWorld({x:-100,y:-100}),bottom=toWorld({x:state.width+100,y:state.height+100}),s=state.scale;
    const visible = area => area.x+block>=top.x&&area.y+block>=top.y&&area.x<=bottom.x&&area.y<=bottom.y;
    for(const area of cityBlocks.filter(visible)){
      const p=toScreen({x:area.x+72,y:area.y+72});mapCtx.fillStyle=area.type==='park'?'#c9dfb7':area.type==='villa'?'#e0e9d3':area.type==='industrial'?'#e4ddd1':area.type==='plaza'?'#e1e5df':'#e9e5de';mapCtx.fillRect(p.x,p.y,270*s,270*s);
    }
    // Roads are drawn from the actual game grid, so navigation follows the same streets.
    const startCol=Math.max(minCell,Math.floor(top.x/block)),endCol=Math.min(gridSize-1,Math.ceil(bottom.x/block)),startRow=Math.max(minCell,Math.floor(top.y/block)),endRow=Math.min(gridSize-1,Math.ceil(bottom.y/block));
    for(const [color,width]of [['#d8d5cf',Math.max(3,48*s)],['#fffef9',Math.max(2,39*s)]]){
      for(let col=startCol;col<=endCol;col++)path([{x:col*block+35,y:worldMin},{x:col*block+35,y:size}],color,width);
      for(let row=startRow;row<=endRow;row++)path([{x:worldMin,y:row*block+35},{x:size,y:row*block+35}],color,width);
    }
    for(let row=startRow;row<=endRow;row++)if(row%4===0)path([{x:worldMin,y:row*block+35},{x:size,y:row*block+35}],'#f6d998',Math.max(1,17*s));
    if(s>.08)for(const b of buildings){if(b.x+b.w<top.x||b.y+b.h<top.y||b.x>bottom.x||b.y>bottom.y)continue;const p=toScreen(b);mapCtx.fillStyle=b.type==='villa'?'#d3d2bf':'#d8d4cc';mapCtx.fillRect(p.x,p.y,b.w*s,b.h*s);}
    for(const point of pois().filter(point=>point.category==='district')){const p=toScreen(point);if(p.x<0||p.y<0||p.x>state.width||p.y>state.height)continue;label(point.name,p.x,p.y,'#6e7970',s>.06?'bold 16px Arial':'bold 11px Arial');}
    if(s>.19){const names=['SEIFERTOVA','BOŘIVOJOVA','HUSITSKÁ','TÁBORITSKÁ'];for(let row=startRow;row<=endRow;row++){const y=row*block+35,x=state.x;if(row%2)continue;const p=toScreen({x,y}),district=districtAt(x,y);const name=district.name==='OŘECHOVKA'?'NA OŘECHOVCE':district.name==='HANSPAULKA'?'NA HANSPAULCE':district.name==='DEJVICE'?'DEJVICKÁ':district.name==='BUBENEČ'?'ČS. ARMÁDY':names[Math.abs(row)%names.length];label(name,p.x+90,p.y,'#979489','10px Arial');}}
    if(state.route.length){path(state.route,'#fff',8);path(state.route,'#4285df',5);}
    const collisions=[],markers=[];
    for(const point of find().filter(point=>point.category!=='district').sort((a,b)=>Number(b.id===state.selected||b.active)-Number(a.id===state.selected||a.active))){
      const p=toScreen(point),priority=point.id===state.selected||point.active;if(p.x<10||p.y<10||p.x>state.width-10||p.y>state.height-10)continue;
      if(!priority&&collisions.some(previous=>Math.hypot(previous.x-p.x,previous.y-p.y)<(s>.12?30:23)))continue;
      const category=categories.find(item=>item[0]===point.category),r=priority?14:10;mapCtx.beginPath();mapCtx.moveTo(p.x,p.y+12);mapCtx.bezierCurveTo(p.x-22,p.y-9,p.x-8,p.y-28,p.x,p.y-28);mapCtx.bezierCurveTo(p.x+8,p.y-28,p.x+22,p.y-9,p.x,p.y+12);mapCtx.fillStyle=priority?'#d25b38':category[2];mapCtx.fill();mapCtx.strokeStyle='#fff';mapCtx.lineWidth=2;mapCtx.stroke();
      mapCtx.fillStyle='#fff';mapCtx.font=category[3]==='Kč'?'bold 8px Arial':'bold 11px Arial';mapCtx.textAlign='center';mapCtx.fillText(point.active?'!':category[3],p.x,p.y-12);
      if(priority||s>.25)label(point.name,p.x,p.y+25,priority?'#b74328':'#626c73','bold 10px Arial');collisions.push(p);markers.push({id:point.id,x:p.x,y:p.y-9,r:r+10});
    }
    state.markers=markers;
    const me=toScreen(position());mapCtx.beginPath();mapCtx.arc(me.x,me.y,19,0,Math.PI*2);mapCtx.fillStyle='#4285df28';mapCtx.fill();mapCtx.beginPath();mapCtx.arc(me.x,me.y,7,0,Math.PI*2);mapCtx.fillStyle='#4285df';mapCtx.fill();mapCtx.strokeStyle='#fff';mapCtx.lineWidth=3;mapCtx.stroke();
    const meters=[50,100,200,500,1000,2000,5000].find(value=>value*s>=60)||5000;$('cityMapScale').textContent=meters>=1000?meters/1000+' km':meters+' m';$('cityMapScale').style.width=Math.min(180,meters*s)+'px';
  }
  let drag=null,pointers=new Map(),pinch=null,lastOrigin=null,lastTarget=null,lastRefresh=-Infinity;
  const eventPoint = event => {const b=mapCanvas.getBoundingClientRect();return {x:event.clientX-b.left,y:event.clientY-b.top};};
  mapCanvas.addEventListener?.('pointerdown',event=>{const p=eventPoint(event);pointers.set(event.pointerId,p);mapCanvas.setPointerCapture?.(event.pointerId);drag={id:event.pointerId,start:p,last:p,moved:false};if(pointers.size===2){const pair=[...pointers.values()];pinch={distance:distance(pair[0],pair[1])};}});
  mapCanvas.addEventListener?.('pointermove',event=>{if(!pointers.has(event.pointerId))return;const p=eventPoint(event);pointers.set(event.pointerId,p);if(pointers.size===2){const pair=[...pointers.values()],next=distance(pair[0],pair[1]);if(pinch&&pinch.distance>0)zoomAt(next/pinch.distance,{x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});pinch={distance:next};if(drag)drag.moved=true;return;}if(!drag||drag.id!==event.pointerId)return;state.x-=(p.x-drag.last.x)/state.scale;state.y-=(p.y-drag.last.y)/state.scale;drag.last=p;if(distance(drag.start,p)>6)drag.moved=true;clampCenter();});
  mapCanvas.addEventListener?.('pointerup',event=>{pointers.delete(event.pointerId);if(!drag)return;if(!drag.moved&&!pinch){const p=eventPoint(event),marker=state.markers.find(marker=>Math.hypot(marker.x-p.x,marker.y-p.y)<marker.r);if(marker)selectPlace(marker.id);}drag=null;pinch=null;});
  mapCanvas.addEventListener?.('pointercancel',event=>{pointers.delete(event.pointerId);drag=null;pinch=null;});
  mapCanvas.addEventListener?.('wheel',event=>{event.preventDefault();zoomAt(Math.exp(-Math.max(-300,Math.min(300,event.deltaY))*.002),eventPoint(event));},{passive:false});
  $('cityMapSearch').oninput=event=>{state.query=event.target.value;refreshResults();};
  $('cityMapSearch').onkeydown=event=>{if(event.key==='Escape'){$('cityMapSearch').blur?.();toggle(false);}if(event.key==='Enter'){event.preventDefault();const first=find()[0];if(first)selectPlace(first.id);}};
  $('cityMapClose').onclick=()=>toggle(false);$('cityMapButton').onclick=()=>toggle();
  $('cityMapLocate').onclick=()=>{const origin=position();state.x=origin.x;state.y=origin.y;state.scale=Math.max(state.scale,.23);clampCenter();};
  $('cityMapZoomIn').onclick=()=>zoomAt(1.4);$('cityMapZoomOut').onclick=()=>zoomAt(1/1.4);
  $('cityMapFit').onclick=()=>{state.x=(worldMin+size)/2;state.y=(worldMin+size)/2;state.scale=Math.min(state.width,state.height)*.85/worldSpan;clampCenter();};
  $('cityMapNavigate').onclick=()=>routeTo(state.selected);$('cityMapClearRoute').onclick=clearRoute;
  for(const category of categories){const button=document.createElement('button');button.textContent=category[1];button.className=category[0]==='all'?'selected':'';button.setAttribute?.('aria-pressed',String(category[0]==='all'));button.onclick=()=>{state.category=category[0];for(const child of $('cityMapFilters').children){child.classList.remove('selected');child.setAttribute?.('aria-pressed','false');}button.classList.add('selected');button.setAttribute?.('aria-pressed','true');refreshResults();};$('cityMapFilters').append(button);}
  addEventListener('keydown',event=>{
    if(!mapExpanded||event.key!=='Tab')return;
    const elements=Array.from($('cityMapOverlay').querySelectorAll('button:not(:disabled),input')).filter(element=>element.offsetParent!==null);
    const first=elements[0],last=elements[elements.length-1];if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  addEventListener('resize',()=>{if(mapExpanded)resize();});
  try{const saved=localStorage.getItem('street-life-navigation-v1');if(saved&&pois().some(point=>point.id===saved)){state.destination=saved;state.selected=saved;state.route=buildRoute(position(),pois().find(point=>point.id===saved));}}catch{}
  function tick(){
    if(!mapExpanded&&!state.destination)return;render();if(time-lastRefresh<.3)return;lastRefresh=time;
    const origin=position(),destination=pois().find(point=>point.id===state.destination);
    if(state.destination&&!destination)clearRoute();
    if(destination&&(!lastOrigin||distance(origin,lastOrigin)>25||!lastTarget||distance(destination,lastTarget)>5)){state.route=buildRoute(origin,destination);lastOrigin={x:origin.x,y:origin.y};lastTarget={x:destination.x,y:destination.y};state.dirty=true;if(mapExpanded)updateDetails();}
    render();
  }
  function drawRadarRoute(context,mapScale){if(!state.route.length)return;context.save();context.strokeStyle='#61b5ff';context.lineWidth=2;context.beginPath();state.route.forEach((point,index)=>{if(index)context.lineTo(point.x*mapScale,point.y*mapScale);else context.moveTo(point.x*mapScale,point.y*mapScale)});context.stroke();context.restore();}
  return {state,pois,find,normalize,toScreen,toWorld,zoomAt,buildRoute,routeLength,routeTo,selectPlace,clearRoute,toggle,render,tick,drawRadarRoute};
})();
