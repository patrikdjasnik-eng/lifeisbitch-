import * as THREE from './vendor/three.module.js';

const source=window.streetLifeScene;
const unit=1/20;
const palette={asphalt:'#17222c',curb:'#61717d',stone:'#b3a99e',plaster:'#7d8386',roof:'#6b3e32',metal:'#526675',dark:'#101c26',window:'#d8b67c',glass:'#3e647b',grass:'#354e3c'};
const materials=new Map();
const boxGeometry=new THREE.BoxGeometry(1,1,1);
const chunks=new Map(),carModels=new Map(),personModels=new Map();
const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scaling=new THREE.Vector3();
let renderer,scene,camera,moon,moonTarget,marker,playerRing,contact,frameCount=0;
let currentTarget=null;
let interiorScene,interiorActor,interiorRing,interiorGroup,interiorKey=null;

function material(color,options={}){
  const key=color+JSON.stringify(options);
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.76,...options}));
  return materials.get(key);
}
function textureCanvas(width,height,draw){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
const plasterTexture=textureCanvas(256,256,(ctx,w,h)=>{
  ctx.fillStyle='#d7d7d2';ctx.fillRect(0,0,w,h);
  let seed=91;
  for(let i=0;i<9000;i++){seed=seed*16807%2147483647;const x=seed%w;seed=seed*16807%2147483647;const y=seed%h;ctx.fillStyle=i%2?'#ffffff14':'#19232d14';ctx.fillRect(x,y,1+(i%2),1)}
  ctx.strokeStyle='#646e6c24';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(30,0);ctx.lineTo(43,58);ctx.lineTo(31,103);ctx.lineTo(45,153);ctx.stroke();
});
plasterTexture.wrapS=plasterTexture.wrapT=THREE.RepeatWrapping;
plasterTexture.repeat.set(2,3);
const roofTexture=textureCanvas(256,256,(ctx,w,h)=>{
  ctx.fillStyle='#b0aca4';ctx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){ctx.fillStyle=(x+y)%32?'#b7afa4':'#939087';ctx.fillRect(x+1,y+1,14,13);ctx.fillStyle='#ffffff20';ctx.fillRect(x+2,y+2,12,1);ctx.fillStyle='#19242a50';ctx.fillRect(x+1,y+14,14,1)}
});roofTexture.wrapS=roofTexture.wrapT=THREE.RepeatWrapping;roofTexture.repeat.set(3,5);
const glowTexture=textureCanvas(128,128,(ctx,w,h)=>{const gradient=ctx.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);gradient.addColorStop(0,'#ffffffff');gradient.addColorStop(.2,'#ffffff88');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h)});
const asphaltTexture=textureCanvas(512,512,(ctx,w,h)=>{
  ctx.fillStyle='#a9b2b8';ctx.fillRect(0,0,w,h);let seed=617;
  for(let i=0;i<26000;i++){seed=seed*16807%2147483647;const x=seed%w;seed=seed*16807%2147483647;const y=seed%h;ctx.fillStyle=i%2?'#ffffff22':'#0e223a24';ctx.fillRect(x,y,1+(i%3),1)}
});asphaltTexture.wrapS=asphaltTexture.wrapT=THREE.RepeatWrapping;asphaltTexture.repeat.set(80,80);
const pavementMaterial=material(palette.asphalt,{map:asphaltTexture,roughness:.28,metalness:.22});

function addMesh(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1,cast=true){
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cube(parent,mat,x,y,z,width,height,depth,cast=true){return addMesh(parent,boxGeometry,mat,x,y,z,width,height,depth,cast)}
function batches(group){
  const buffers=new Map();
  return {
    box(mat,x,y,z,width,height,depth,rotation=0){
      if(!buffers.has(mat))buffers.set(mat,[]);
      position.set(x,y,z);quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),rotation);scaling.set(width,height,depth);
      matrix.compose(position,quaternion,scaling);buffers.get(mat).push(matrix.clone());
    },
    finish(){for(const [mat,transforms]of buffers){const mesh=new THREE.InstancedMesh(boxGeometry,mat,transforms.length);transforms.forEach((value,index)=>mesh.setMatrixAt(index,value));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)}}
  };
}
function building(group,b,batch){
  const x=(b.x+b.w/2)*unit,z=(b.y+b.h/2)*unit,width=b.w*unit,depth=b.h*unit;
  const height=b.type==='industrial'?4.2:6+b.height*.18;
  const colors=b.type==='old'?['#a48870','#967e72','#af9877']:b.type==='modern'?['#8a9ca7','#728b9c','#84979f']:b.type==='garden'?['#a9a184','#b6a895','#a49281']:['#9d938c','#a19c90','#8e9b97'];
  const facade=material(colors[b.variant%3],{map:plasterTexture});
  batch.box(facade,x,height/2,z,width,height,depth);
  batch.box(material('#534e4b'),x,.22,z,width+.05,.44,depth+.05);
  const trim=material('#b6b0a1');
  for(let floor=1;floor<height/2;floor++)batch.box(trim,x,floor*2,z,width+.15,.1,depth+.15);
  batch.box(trim,x,height-.2,z,width+.28,.23,depth+.28);
  const columns=Math.max(2,Math.floor(width/1.3)),floors=Math.max(2,Math.floor(height/2));
  const glassDark=material('#153349',{metalness:.4,roughness:.18});
  const glassLit=material(b.type==='modern'?'#88bccc':'#b6925a',{emissive:b.type==='modern'?'#88bccc':'#ffd597',emissiveIntensity:.9,roughness:.27});
  const frame=material('#d1c5af'),sill=material('#b9b4a7');
  for(let row=0;row<floors;row++)for(let col=0;col<columns;col++){
    const wx=x-width/2+(col+.5)*width/columns,wy=1.35+row*(height-1.5)/floors;
    const lit=(row*7+col+b.variant)%4!==0,windowMaterial=lit?glassLit:glassDark;
    batch.box(frame,wx,wy,z+depth/2+.04,.76,1.1,.06);
    batch.box(windowMaterial,wx,wy,z+depth/2+.083,.59,.91,.022);
    batch.box(frame,wx,wy,z+depth/2+.105,.035,.92,.02);
    batch.box(sill,wx,wy-.55,z+depth/2+.16,.87,.12,.32);
    if(row===0&&col===columns-1&&b.name)continue;
  }
  const sideColumns=Math.max(2,Math.floor(depth/1.7));
  for(let row=0;row<floors;row++)for(let col=0;col<sideColumns;col++){
    const wz=z-depth/2+(col+.5)*depth/sideColumns,wy=1.35+row*(height-1.5)/floors;
    batch.box(frame,x+width/2+.04,wy,wz,.06,1.06,.75);
    batch.box((row+col+b.variant)%3?glassLit:glassDark,x+width/2+.08,wy,wz,.025,.89,.6);
    batch.box(sill,x+width/2+.12,wy-.55,wz,.3,.1,.83);
  }
  batch.box(material('#27262b'),x,.85,z+depth/2+.04,1.05,1.7,.07);
  addDoorLight(group,x,.22,z+depth/2+.6);
  const threshold=cube(group,material('#bc6bff',{emissive:'#b548ff',emissiveIntensity:3}),x,.2,z+depth/2+.35,1.3,.035,.6,false);
  const entranceGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#c57aff',transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));entranceGlow.position.set(x,.22,z+depth/2+.5);entranceGlow.scale.set(2.3,2.3,1);group.add(entranceGlow);
  batch.box(trim,x-0.62,.9,z+depth/2+.09,.13,1.8,.15);batch.box(trim,x+.62,.9,z+depth/2+.09,.13,1.8,.15);batch.box(trim,x,1.85,z+depth/2+.09,1.4,.18,.2);
  if(b.type==='old'||b.type==='residential'||b.type==='garden'){
    const rise=Math.min(1.8,width*.28),points=[[-width/2,0,-depth/2],[width/2,0,-depth/2],[0,rise,-depth/2],[-width/2,0,depth/2],[width/2,0,depth/2],[0,rise,depth/2]];
    const triangles=[0,3,5,0,5,2,1,2,5,1,5,4,0,2,1,3,4,5];const positions=[],uv=[];
    for(const i of triangles){positions.push(...points[i]);uv.push((points[i][0]/width)+.5,(points[i][2]/depth)+.5)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    addMesh(group,geo,material(b.variant%2?'#865f48':'#654437',{map:roofTexture}),x,height,z);
    batch.box(material('#6e6158'),x+width*.22,height+1.2,z-depth*.22,.4,1.5,.45);
  }else{
    batch.box(material('#3b4c55'),x,height+.05,z,width,.14,depth);
    batch.box(material('#7c8b93'),x-width*.23,height+.4,z,.8,.7,1.3);
    for(let i=0;i<4;i++)batch.box(material('#283c47'),x-width*.23,height+.77,z-.5+i*.3,.72,.03,.12);
  }
  if(b.name){
    const signTexture=textureCanvas(512,128,(ctx,w,h)=>{ctx.fillStyle='#111922';ctx.fillRect(0,0,w,h);ctx.font='700 58px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=b.name==='NEON'?'#ed78ff':'#efce99';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=15;ctx.fillText(b.name,w/2,h/2)});
    const signMat=new THREE.MeshStandardMaterial({map:signTexture,emissiveMap:signTexture,emissive:'#ffffff',emissiveIntensity:1.8,roughness:.5});
    addMesh(group,new THREE.PlaneGeometry(Math.min(width-.2,5),1.15),signMat,x,2.35,z+depth/2+.17,1,1,1,false);
    batch.box(material(b.name==='NEON'?'#482459':'#4e4540'),x,1.7,z+depth/2+.65,width-.15,.18,1.2);
  }
}
const trunkMaterial=material('#675042'),leafMaterial=material('#395641',{roughness:.9});
const sphereGeometry=new THREE.IcosahedronGeometry(1,1),trunkGeometry=new THREE.CylinderGeometry(.12,.16,1.7,6);
function tree(group,x,z){
  addMesh(group,trunkGeometry,trunkMaterial,x,.85,z);
  addMesh(group,sphereGeometry,leafMaterial,x,2.3,z,.9,1.1,.9);
  addMesh(group,sphereGeometry,material('#597152'),x-.3,2.6,z-.2,.7,.65,.65);
}
function disposeChunk(group){
  scene.remove(group);
  const sharedMaterials=new Set(materials.values());
  group.traverse(object=>{
    if(object.isInstancedMesh)object.dispose();
    if(object.geometry&&![boxGeometry,sphereGeometry,trunkGeometry].includes(object.geometry))object.geometry.dispose();
    if(object.material&&!sharedMaterials.has(object.material)){
      if(object.material.map&&object.material.map!==glowTexture)object.material.map.dispose();
      object.material.dispose();
    }
  });
}
function makeChunk(area,index){
  const group=new THREE.Group(),batch=batches(group),x=area.x*unit,z=area.y*unit;
  const sidewalk=material('#65717b',{roughness:.8});
  batch.box(sidewalk,x+10,.08,z+10,16,.16,16);
  for(let k=0;k<15;k++){batch.box(material('#859294'),x+3.2,.165,z+3.5+k*.9,.55,.012,.025);batch.box(material('#859294'),x+3.5+k*.9,.165,z+3.2,.025,.012,.55)}
  for(let i=0;i<7;i++){
    batch.box(material('#c9c8b9'),x+1,.025,z+4+i*.38,1.9,.025,.18);
    batch.box(material('#c9c8b9'),x+4+i*.38,.025,z+1,.18,.025,1.9);
  }
  for(let i=0;i<7;i++){batch.box(material('#b6b09b'),x+.25,.02,z+2+i*2.7,.045,.02,.7);batch.box(material('#b6b09b'),x+2+i*2.7,.02,z+.25,.7,.02,.045)}
  for(const b of source.buildingBuckets.get(index)||[])building(group,b,batch);
  if(area.type==='park'||area.type==='plaza'){
    batch.box(material(area.type==='park'?'#344c39':'#9b9c91'),x+10.3,.19,z+10.3,13,.08,13);
    if(area.type==='park'){
      batch.box(material('#aca38a'),x+10.1,.24,z+10.3,.85,.04,13);batch.box(material('#aca38a'),x+10.3,.24,z+10.3,13,.04,.85);
      for(const tx of [5.5,7.5,13,15.2])for(const tz of [5.5,7.5,13,15.2])tree(group,x+tx,z+tz);
    }else for(const tx of [5.5,15])for(const tz of [5.5,15])tree(group,x+tx,z+tz);
    addMesh(group,new THREE.CylinderGeometry(1.55,1.6,.3,24),material('#acb8b9'),x+10.1,.34,z+10.5);
    addMesh(group,new THREE.CylinderGeometry(1.35,1.35,.04,24),material('#468a9d',{metalness:.6,roughness:.12,emissive:'#205d70',emissiveIntensity:.5}),x+10.1,.51,z+10.5);
    addMesh(group,new THREE.CylinderGeometry(.3,.4,1.2,12),material('#a9b8b5'),x+10.1,1.1,z+10.5);
  }
  if(area.type==='parking'){
    batch.box(material('#28333b'),x+10.3,.18,z+10.3,13,.04,13);
    for(let slot=0;slot<5;slot++)for(const row of [5,12.3]){
      const xx=x+4.3+slot*2.15;batch.box(material('#ddd8ba'),xx,.21,z+row,.05,.025,3.1);batch.box(material('#ddd8ba'),xx+1,.21,z+row-1.55,2,.025,.05);
    }
    const parkingSign=textureCanvas(128,128,(ctx,w,h)=>{ctx.fillStyle='#245c9b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.fillText('P',w/2,100)});
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),new THREE.MeshBasicMaterial({map:parkingSign,side:THREE.DoubleSide}));sign.position.set(x+4,1.8,z+15.8);group.add(sign);
  }
  for(const stop of source.transitStops||[]){if(stop.x<area.x||stop.x>=area.x+400||stop.y<area.y||stop.y>=area.y+400)continue;
    const sx=stop.x*unit,sz=stop.y*unit;cube(group,material('#465d6a'),sx,1.1,sz,.06,2.2,.06);cube(group,material('#d6393b'),sx,2.15,sz,.65,.45,.08);
    cube(group,material('#335865',{transparent:true,opacity:.5}),sx+1,.8,sz+1,1.4,1.6,.06);cube(group,material('#9aa7a6'),sx+1,1.7,sz+1,1.7,.08,1);cube(group,material('#ae8466'),sx+1,.4,sz+1,1.1,.12,.35);
  }
  for(const line of source.transitLines||[]){if(line.kind!=='tram')continue;for(let edge=0;edge<line.points.length;edge++){
    const a=line.points[edge],b=line.points[(edge+1)%line.points.length];
    if(a.x===b.x&&a.x>=area.x&&a.x<area.x+400){const low=Math.max(area.y,Math.min(a.y,b.y)),high=Math.min(area.y+400,Math.max(a.y,b.y));if(high>low)for(const offset of [-.32,.32])batch.box(material('#acb6bb',{metalness:.8}),a.x*unit+offset,.035,(low+high)*unit/2,.055,.04,(high-low)*unit);}
    if(a.y===b.y&&a.y>=area.y&&a.y<area.y+400){const low=Math.max(area.x,Math.min(a.x,b.x)),high=Math.min(area.x+400,Math.max(a.x,b.x));if(high>low)for(const offset of [-.32,.32])batch.box(material('#acb6bb',{metalness:.8}),(low+high)*unit/2,.035,a.y*unit+offset,(high-low)*unit,.04,.055);}
  }}
  if(area.type==='lot')for(let i=0;i<4;i++){
    const mat=material(['#8e4d3e','#4b7c8b','#9b8756'][i%3]);batch.box(mat,x+5+i*2.8,1.1,z+10.3,2.4,2,4.1);
    for(let rib=0;rib<12;rib++)batch.box(material('#44545e'),x+4+i*2.8+rib*.16,1.1,z+12.38,.025,1.9,.03);
  }
  for(const lamp of [{x:x+3.25,z:z+3.25},{x:x+16.75,z:z+16.75}]){
    batch.box(material('#3b4c56'),lamp.x,1.55,lamp.z,.09,3.1,.09);
    batch.box(material('#405660'),lamp.x+.24,3.1,lamp.z,.55,.08,.08);
    batch.box(material('#ffe3a7',{emissive:'#ffc586',emissiveIntensity:3}),lamp.x+.45,3.08,lamp.z,.18,.1,.18);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#ffbf71',transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending}));halo.position.set(lamp.x+.45,3.07,lamp.z);halo.scale.set(1.8,1.8,1);group.add(halo);
  }
  const district=source.districtAt(area.x,area.y);
  if(district.style==='garden'){for(let i=0;i<5;i++)tree(group,x+3.25,z+5+i*2.3);if(Math.floor(area.x/400)%8===0){batch.box(material('#385a43'),x+.25,.07,z+10,.45,.14,13);for(let i=0;i<4;i++)tree(group,x+.25,z+5+i*3)}}
  tree(group,x+17.05,z+13.8);addStreetPlaques(group,area);
  batch.box(material('#4c7060'),x+3.25,.42,z+9,.5,.7,.6);
  batch.box(material('#8c6b48'),x+3.2,.45,z+12.2,.45,.1,1.3);
  batch.finish();group.visible=false;scene.add(group);chunks.set(index,group);return group;
}
function addStreetPlaques(group,area){
  const district=source.districtAt(area.x,area.y);
  const names=district.style==='residential'?['SEIFERTOVA','BOŘIVOJOVA','HUSITSKÁ','TÁBORITSKÁ','ONDŘÍČKOVA','JESENIOVA']:district.style==='garden'?['VINOHRADSKÁ','KORUNNÍ','SLEZSKÁ','FRANCOUZSKÁ','BĚLEHRADSKÁ','MÁNESOVA']:district.style==='old'?['KŘIŽÍKOVA','SOKOLOVSKÁ','THÁMOVA']:district.style==='industrial'?['PŘÍSTAVNÍ','DĚLNICKÁ','KOMUNARDŮ']:['JINDŘIŠSKÁ','VODIČKOVA','ŠTĚPÁNSKÁ'];
  const name=names[Math.floor(area.y/400)%names.length];
  const texture=textureCanvas(512,160,(ctx,w,h)=>{ctx.fillStyle='#712927';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ead6be';ctx.lineWidth=6;ctx.strokeRect(8,8,w-16,h-16);ctx.fillStyle='#eee7db';ctx.textAlign='center';ctx.font='bold 45px Arial';ctx.fillText(name,w/2,74);ctx.font='22px Arial';ctx.fillText(district.name,w/2,124)});
  const mat=new THREE.MeshBasicMaterial({map:texture});
  const pole=cube(group,material('#65717c'),area.x*unit+3.3,.8,area.y*unit+3.9,.035,1.6,.035);
  addMesh(group,new THREE.PlaneGeometry(1.5,.47),mat,area.x*unit+3.3,1.65,area.y*unit+3.92,1,1,1,false);
}
function makeCar(car){
  if(car.transit){
    const group=new THREE.Group(),length=car.transit==='tram'?7:5;
    cube(group,material(car.color),0,.7,0,length,1.25,1.2);
    cube(group,material('#d5d8d5'),0,1.4,0,length,.12,1.23);
    for(let i=0;i<6;i++)for(const side of [-1,1])cube(group,material('#15394b'),-length/2+.45+i*(length-.9)/5,1.05,side*.61,.48,.5,.025,false);
    cube(group,material('#dbece9',{emissive:'#dfecd8',emissiveIntensity:1}),length/2+.025,1.15,0,.035,.15,.8,false);
    if(car.transit==='tram'){cube(group,material('#adb8bd'),0,1.8,0,.08,.65,.08);cube(group,material('#adb8bd'),0,2.1,0,1.2,.06,.06);}
    group.userData.wheels=[];scene.add(group);carModels.set(car,group);return group;
  }
  const group=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color:car.police?'#a7b8c5':car.color,metalness:.55,roughness:.24});
  const body=cube(group,paint,0,.35,0,2.28,.42,1.05);body.castShadow=true;
  cube(group,paint,-.17,.7,0,1.12,.38,.87);cube(group,material('#143342',{metalness:.3,roughness:.12}),.42,.72,0,.09,.31,.83);
  cube(group,material('#163142',{metalness:.3,roughness:.12}),-.76,.68,0,.075,.28,.81);
  cube(group,material('#20394a',{metalness:.3,roughness:.12}),-.18,.72,.445,1,.28,.03);cube(group,material('#20394a',{metalness:.3,roughness:.12}),-.18,.72,-.445,1,.28,.03);
  const wheelGeometry=new THREE.CylinderGeometry(.23,.23,.16,12),rubber=material('#111720'),rim=material('#adbac1',{metalness:.65,roughness:.3});
  const wheels=[];for(const xx of [-.72,.73])for(const zz of [-.55,.55]){const wheel=addMesh(group,wheelGeometry,rubber,xx,.24,zz);wheel.rotation.x=Math.PI/2;const hub=addMesh(group,new THREE.CylinderGeometry(.11,.11,.17,8),rim,xx,.24,zz);hub.rotation.x=Math.PI/2;wheels.push(wheel)}
  for(const zz of [-.36,.36]){
    cube(group,material('#ffedc7',{emissive:'#ffedc7',emissiveIntensity:2}),1.15,.39,zz,.04,.13,.21,false);
    cube(group,material('#db4047',{emissive:'#ff2839',emissiveIntensity:1}),-1.15,.4,zz,.04,.13,.2,false);
  }
  cube(group,material('#87959c',{metalness:.8}),1.16,.22,0,.04,.08,.92);
  if(car.police){cube(group,material('#174eff',{emissive:'#185eff',emissiveIntensity:2}),-.1,.94,-.2,.3,.09,.23);cube(group,material('#ff3552',{emissive:'#ff3552',emissiveIntensity:2}),-.1,.94,.2,.3,.09,.23)}
  group.userData.wheels=wheels;scene.add(group);carModels.set(car,group);return group;
}
const skinMaterial=material('#c6a180');
function makePerson(color){
  const group=new THREE.Group();
  const torso=addMesh(group,new THREE.CapsuleGeometry(.17,.25,3,6),material(color),0,.77,0);torso.scale.set(1,1,.8);
  addMesh(group,new THREE.SphereGeometry(.14,8,6),skinMaterial,0,1.15,0);
  const limbs=[];
  for(const side of [-1,1]){
    const leg=addMesh(group,new THREE.CapsuleGeometry(.07,.27,2,5),material('#243547'),side*.09,.31,0);limbs.push(leg);
    const arm=addMesh(group,new THREE.CapsuleGeometry(.055,.24,2,5),material(color),side*.24,.75,0);limbs.push(arm);
    cube(group,material('#1b242d'),side*.09,.065,.04,.14,.1,.26);
  }
  group.userData.limbs=limbs;scene.add(group);return group;
}
function setup(){
  const canvas=document.createElement('canvas');canvas.id='world3d';document.body.prepend(canvas);
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){canvas.remove();source.onError('3D není v tomto prohlížeči dostupné. Zůstává zapnutá 2D verze.');return false;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  scene=new THREE.Scene();scene.background=new THREE.Color('#142537');scene.fog=new THREE.FogExp2('#1b2a3c',.011);
  camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,300);
  scene.add(new THREE.HemisphereLight('#bfd9f3','#554336',1.45));
  moon=new THREE.DirectionalLight('#c9ddf7',2.7);moon.position.set(30,50,20);moon.castShadow=true;
  moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-35;moon.shadow.camera.right=35;moon.shadow.camera.top=35;moon.shadow.camera.bottom=-35;moon.shadow.camera.near=1;moon.shadow.camera.far=120;moon.shadow.bias=-.0003;moon.shadow.normalBias=.04;
  moonTarget=new THREE.Object3D();scene.add(moonTarget);moon.target=moonTarget;scene.add(moon);
  const environment=textureCanvas(1024,512,(ctx,w,h)=>{const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#1d304a');gradient.addColorStop(.48,'#b6c0cb');gradient.addColorStop(.6,'#38485b');gradient.addColorStop(1,'#0d1521');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.fillStyle='#f3d8a6';for(let i=0;i<10;i++)ctx.fillRect(i*103+10,h*.45,18,25)});
  environment.mapping=THREE.EquirectangularReflectionMapping;scene.environment=environment;scene.environmentIntensity=.7;
  const ground=cube(scene,pavementMaterial,source.size*unit/2,-.08,source.size*unit/2,source.size*unit,.1,source.size*unit,false);
  ground.receiveShadow=true;
  marker=addMesh(scene,new THREE.TorusGeometry(1.1,.025,6,36),new THREE.MeshBasicMaterial({color:'#c5f46b'}),0,.25,0,1,1,1,false);marker.rotation.x=-Math.PI/2;
  playerRing=addMesh(scene,new THREE.RingGeometry(.55,.66,48),new THREE.MeshBasicMaterial({color:'#37d6ff',transparent:true,opacity:.9,depthTest:false,depthWrite:false,side:THREE.DoubleSide}),0,.22,0,1,1,1,false);playerRing.rotation.x=-Math.PI/2;playerRing.renderOrder=8;
  contact=makePerson('#8c5369');
  const playerModel=makePerson('#475568');personModels.set(source.player,playerModel);
  const lamps=[];for(let i=0;i<4;i++){const light=new THREE.PointLight('#ffbc77',11,10,2);scene.add(light);lamps.push(light)}
  const headlights=new THREE.SpotLight('#ffe4ab',35,18,Math.PI/7,.65,1);headlights.position.set(0,1,0);scene.add(headlights);scene.add(headlights.target);
  const violet=new THREE.PointLight('#d663ee',25,12,2);violet.position.set(6.5,2.4,16.3);scene.add(violet);
  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);updateCameraSize()});updateCameraSize();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();window.streetLifeRenderer=null;canvas.style.display='none';source.onError('3D vykreslování bylo přerušeno. Pokračuje 2D verze. Obnov stránku pro návrat do 3D.');});
  window.streetLifeRenderer={render(state){
    if(state.interior){renderInterior(state);return;}updateCameraSize();
    const center=new THREE.Vector3(state.camera.x*unit,0,state.camera.y*unit);
    camera.position.set(center.x+18,64,center.z+40);camera.lookAt(center.x,0,center.z);
    moonTarget.position.copy(center);moon.position.set(center.x+25,55,center.z+18);
    const col=Math.floor(state.camera.x/400),row=Math.floor(state.camera.y/400);
    for(const [index,group]of chunks){const area=source.cityBlocks[index];group.visible=Math.abs(area.x/400-col)<=3&&Math.abs(area.y/400-row)<=3;if(Math.abs(area.x/400-col)>4||Math.abs(area.y/400-row)>4){disposeChunk(group);chunks.delete(index)}}
    for(let r=Math.max(0,row-3);r<=Math.min(source.gridSize-1,row+3);r++)for(let c=Math.max(0,col-3);c<=Math.min(source.gridSize-1,col+3);c++){
      const index=r*source.gridSize+c;if(!chunks.has(index))makeChunk(source.cityBlocks[index],index);chunks.get(index).visible=true;
    }
    if(chunks.size>81)throw new Error('Chunk cache exceeded its spatial limit');
    for(const car of source.cars){const distance=Math.hypot(car.x-state.camera.x,car.y-state.camera.y),nearby=distance<1000;let model=carModels.get(car);if(model&&distance>2000){disposeChunk(model);carModels.delete(car);continue;}if(nearby&&!model)model=makeCar(car);if(!model)continue;model.visible=nearby;if(nearby){model.position.set(car.x*unit,.02,car.y*unit);model.rotation.y=-car.angle;for(const wheel of model.userData.wheels)wheel.rotation.y=(state.time*(car.velocity||car.speed)*.05)%Math.PI;}}
    for(const person of source.people){const distance=Math.hypot(person.x-state.camera.x,person.y-state.camera.y),nearby=distance<850;let model=personModels.get(person);if(model&&distance>1700){disposeChunk(model);personModels.delete(person);continue;}if(nearby&&!model){model=makePerson(person.color);if(person.role){cube(model,material('#1f293b'),0,1.31,0,.3,.08,.3);cube(model,material('#d5bf73'),.08,.88,.145,.07,.1,.025);}personModels.set(person,model)}if(!model)continue;model.visible=nearby;if(nearby){model.position.set(person.x*unit,.12,person.y*unit);model.rotation.y=person.axis?(person.dir>0?-Math.PI/2:Math.PI/2):(person.dir>0?0:Math.PI);model.userData.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(state.time*7+i%2*Math.PI)*.45)}}
    playerRing.position.set(state.player.x*unit,.22,state.player.y*unit);playerRing.scale.setScalar(state.player.car?2.15:1);
    playerModel.visible=!state.player.car;playerModel.position.set(state.player.x*unit,.12,state.player.y*unit);playerModel.rotation.y=-state.player.angle+Math.PI/2;playerModel.userData.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(state.player.step+i%2*Math.PI)*.45);
    if(state.target){marker.visible=contact.visible=true;marker.position.set(state.target.x*unit,.25,state.target.y*unit);marker.scale.setScalar(1+Math.sin(state.time*3)*.05);contact.position.set(state.target.x*unit,.12,state.target.y*unit);}else marker.visible=contact.visible=false;
    if(frameCount++%12===0){const nearest=source.lamps.map(l=>({l,d:Math.hypot(l.x-state.camera.x,l.y-state.camera.y)})).sort((a,b)=>a.d-b.d).slice(0,4);nearest.forEach(({l},i)=>lamps[i].position.set(l.x*unit+.45,3.05,l.y*unit))}
    headlights.visible=Boolean(state.player.car);
    if(state.player.car){const car=state.player.car;headlights.position.set(car.x*unit+Math.cos(car.angle)*1.2,.45,car.y*unit+Math.sin(car.angle)*1.2);headlights.target.position.set(car.x*unit+Math.cos(car.angle)*12,0,car.y*unit+Math.sin(car.angle)*12)}
    renderer.render(scene,camera);
  }};
  source.onReady();return true;
}
function addDoorLight(group,x,y,z){
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(3,2),new THREE.MeshBasicMaterial({map:glowTexture,color:'#c57aff',transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  glow.rotation.x=-Math.PI/2;glow.position.set(x,y+.015,z);group.add(glow);
  cube(group,material('#e2b4ff',{emissive:'#bd60ff',emissiveIntensity:4}),x,y+.025,z,1.5,.04,.16,false);
}
function renderInterior(state){
  const room=state.interior,key=room.building.x+':'+room.building.y+':'+room.floor;
  if(!interiorScene){interiorScene=new THREE.Scene();interiorScene.background=new THREE.Color('#172333');interiorScene.add(new THREE.HemisphereLight('#f1e5d3','#4e4a51',2));const light=new THREE.DirectionalLight('#ffe4bd',3);light.position.set(8,16,12);interiorScene.add(light);interiorActor=makePerson('#475568');scene.remove(interiorActor);interiorScene.add(interiorActor);interiorRing=new THREE.Mesh(new THREE.RingGeometry(.55,.66,48),new THREE.MeshBasicMaterial({color:'#37d6ff',side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.9}));interiorRing.rotation.x=-Math.PI/2;interiorRing.renderOrder=8;interiorScene.add(interiorRing);}
  if(interiorKey!==key){
    if(interiorGroup){interiorScene.remove(interiorGroup);disposeChunk(interiorGroup)}
    interiorGroup=new THREE.Group();const width=room.width*unit,depth=room.depth*unit;
    const mat=material('#a99277'),wall=material('#b8b0a2'),floor=material('#75614e',{map:roofTexture});
    for(const level of room.floor>0?[-1,0]:[0]){
      const yy=level*3.3;
      cube(interiorGroup,floor,width/2,yy,depth/2,width,.14,depth,false);
      cube(interiorGroup,wall,width/2,yy+1.4,0,width,2.8,.15);cube(interiorGroup,wall,0,yy+1.4,depth/2,.15,2.8,depth);
      cube(interiorGroup,wall,width,yy+.35,depth/2,.15,.7,depth);cube(interiorGroup,wall,width/2,yy+.35,depth,width,.7,.15);
      cube(interiorGroup,material('#d8ccb5'),width*.5,yy+.04,depth*.5,.055,.06,depth*.65,false);
      cube(interiorGroup,material('#687c76'),width*.29,yy+.4,depth*.51,width*.22,.7,depth*.12);
      cube(interiorGroup,material('#927557'),width*.28,yy+.35,depth*.76,width*.25,.6,depth*.12);
      for(let step=0;step<9;step++)cube(interiorGroup,material('#ae9b84'),width-1.05,yy+.075+step*.055,depth*.2-.75+step*.16,1,.12+step*.11,.18);
      cube(interiorGroup,material('#84bc8d',{emissive:'#5fb276',emissiveIntensity:.5}),width-1.1,yy+.025,depth*.42,.75,.035,.75,false);
      addDoorLight(interiorGroup,width/2,yy+.12,depth-.6);
      cube(interiorGroup,material('#c671ff',{emissive:'#a848f1',emissiveIntensity:2}),width/2,yy+.1,depth-.6,1.2,.035,.5,false);
    }
    if (room.floor === 0 && room.building.name === 'ŘEZNICTVÍ') {
      const clerk = makePerson('#d5c9b8');
      scene.remove(clerk);
      clerk.position.set(width*.29,.18,depth*.35);
      clerk.rotation.y = 0;
      interiorGroup.add(clerk);
      cube(interiorGroup,material('#f3eee7'),width*.29,.88,depth*.35+.18,.35,.5,.06);
      cube(interiorGroup,material('#bbd9d6',{transparent:true,opacity:.35}),width*.29,.95,depth*.51,width*.22,.4,depth*.12,false);
      for(let item=0;item<4;item++)cube(interiorGroup,material(item%2?'#bf655a':'#9e4745'),width*.2+item*width*.05,.85,depth*.51,.18,.1,.22);
      const sign=textureCanvas(512,128,(ctx,w,h)=>{ctx.fillStyle='#372c28';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ead9c8';ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('KAREL · ŘEZNÍK',w/2,h/2);});
      const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.55),new THREE.MeshBasicMaterial({map:sign,transparent:true,side:THREE.DoubleSide}));
      plaque.position.set(width*.29,1.9,depth*.35);interiorGroup.add(plaque);
    }
    interiorScene.add(interiorGroup);interiorKey=key;
  }
  interiorActor.position.set(state.player.x*unit,.18,state.player.y*unit);interiorActor.rotation.y=-state.player.angle+Math.PI/2;interiorActor.userData.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(state.player.step+i%2*Math.PI)*.45);
  interiorRing.position.set(state.player.x*unit,.18,state.player.y*unit);
  const cx=room.width*unit/2,cz=room.depth*unit/2,span=Math.max(room.width*unit,room.depth*unit)*.6+2,aspect=innerWidth/innerHeight;
  camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();camera.position.set(cx+9,22,cz+17);camera.lookAt(cx,0,cz);renderer.render(interiorScene,camera);
}
function updateCameraSize(){const aspect=innerWidth/innerHeight,span=innerWidth<800?20:28;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();}
try{setup();}catch(error){console.error('3D renderer initialization failed',error);window.streetLifeRenderer=null;document.querySelector('#world3d')?.remove();source.onError('3D se nepodařilo načíst. Pokračuje 2D verze.');}
