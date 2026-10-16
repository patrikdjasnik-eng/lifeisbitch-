import * as THREE from './vendor/three.module.js';

const W = globalThis.FantasyWorld;
const Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), matrix = new THREE.Object3D();
const materials = new Map();
const pickMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
let stoneDetail;
function stoneTexture() {
  if (stoneDetail) return stoneDetail;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d'), image = context.createImageData(256, 256), random = W.seeded(811);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const index = (y * 256 + x) * 4, value = 170 + random() * 38 + Math.sin(x * .12 + Math.sin(y * .04) * 3) * 5;
    image.data[index] = value; image.data[index + 1] = value + 2; image.data[index + 2] = value; image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  for (let index = 0; index < 30; index++) {
    const x = random() * 256, y = random() * 256;
    context.strokeStyle = '#444a4223'; context.lineWidth = .5 + random(); context.beginPath(); context.moveTo(x, y); context.lineTo(x + random() * 10 - 5, y + 10 + random() * 25); context.lineTo(x - 6, y + 35); context.stroke();
  }
  stoneDetail = new THREE.CanvasTexture(canvas); stoneDetail.wrapS = stoneDetail.wrapT = THREE.RepeatWrapping; stoneDetail.colorSpace = THREE.SRGBColorSpace; return stoneDetail;
}
function material(color, metalness = 0, roughness = .85, extra = {}) {
  const key = `${color}-${metalness}-${roughness}-${JSON.stringify(extra)}`;
  if (!materials.has(key)) {
    if ([0x9a9b91, 0xb8b6a0, 0x565d5b, 0x9fa499, 0x7f8981, 0x878c80, 0x605c4a].includes(color)) extra = { map: stoneTexture(), bumpMap: stoneTexture(), bumpScale: .06, ...extra };
    materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra }));
  }
  return materials.get(key);
}
const geometry = {
  sphere: new THREE.SphereGeometry(1, 14, 10), box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 14), crystal: new THREE.OctahedronGeometry(1, 0)
};
function mesh(parent, shape, size, position, mat, rotation) {
  const object = new THREE.Mesh(geometry[shape] || shape, mat);
  object.scale.set(...size); object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function cylinderBetween(parent, a, b, radius, mat) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
  const object = mesh(parent, 'cylinder', [radius, direction.length(), radius], start.add(end).multiplyScalar(.5).toArray(), mat);
  object.quaternion.setFromUnitVectors(Y, direction.normalize()); return object;
}
function groundTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d'), pixels = context.createImageData(256, 256), random = W.seeded(174);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = random() * 38 + 188;
    pixels.data[index] = grain; pixels.data[index + 1] = grain; pixels.data[index + 2] = grain * .94; pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  for (let index = 0; index < 4600; index++) {
    const x = random() * 256, y = random() * 256;
    context.strokeStyle = random() > .5 ? '#b1b3a044' : '#555e4b44';
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + random() * 3 - 1.5, y - random() * 5); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(95, 95); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function makeTerrain(scene) {
  const ground = new THREE.PlaneGeometry(500, 500, 240, 240); ground.rotateX(-Math.PI / 2);
  const positions = ground.attributes.position, colors = [], random = W.seeded(34);
  const green = new THREE.Color('#829366'), path = new THREE.Color('#b6ad8d'), rock = new THREE.Color('#777f73'), frost = new THREE.Color('#b6c5c0');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), z = positions.getZ(index), height = W.heightAt(x, z);
    positions.setY(index, height);
    const color = green.clone().multiplyScalar(.91 + random() * .18);
    if (W.onPath(x, z)) color.lerp(path, .9);
    if (Math.hypot(x, z) < 17.5) color.lerp(path, .8);
    if (W.zoneAt(x, z).id === 'forest') color.multiplyScalar(.72);
    if (x < -45 && z > 50) color.lerp(frost, THREE.MathUtils.clamp((75 - Math.hypot(x + 104, z - 110)) / 32, 0, .85));
    if (height > 5) color.lerp(rock, Math.min(1, height / 15));
    if (Math.abs(z - W.riverZ(x)) < 4.7) color.lerp(rock, .7);
    colors.push(color.r, color.g, color.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); ground.computeVertexNormals();
  const terrain = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ map: groundTexture(), vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true; scene.add(terrain);
  const points = [], indices = [];
  for (let index = 0; index <= 180; index++) {
    const x = -250 + index / 180 * 500;
    for (const side of [-1, 1]) { const z = W.riverZ(x) + side * 3.4; points.push(x, W.heightAt(x, z) + .24, z); }
    if (index < 180) { const n = index * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const waterGeometry = new THREE.BufferGeometry(); waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); waterGeometry.setIndex(indices); waterGeometry.computeVertexNormals();
  scene.add(new THREE.Mesh(waterGeometry, material(0x709ea3, .5, .17, { transparent: true, opacity: .73, side: THREE.DoubleSide })));
  return terrain;
}
function instance(scene, shape, records, mat, transform, shadows = true) {
  // Spatial batches let the camera and shadow frusta cull distant forest sections.
  const chunks = new Map();
  const batches = [];
  for (const record of records) {
    const key = `${Math.floor(record.x / 64)},${Math.floor(record.z / 64)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(record);
  }
  for (const records of chunks.values()) {
  const batch = new THREE.InstancedMesh(shape, mat, records.length), color = new THREE.Color();
  records.forEach((record, index) => {
    matrix.position.set(record.x, W.heightAt(record.x, record.z), record.z);
    matrix.rotation.set(0, record.rotation, 0); matrix.scale.setScalar(record.scale);
    transform(matrix, record, index); matrix.updateMatrix(); batch.setMatrixAt(index, matrix.matrix);
    color.setScalar(.82 + (index % 13) / 40); batch.setColorAt(index, color);
  });
  batch.castShadow = shadows; batch.receiveShadow = true; batch.computeBoundingSphere(); scene.add(batch); batches.push(batch);
  }
  return batches;
}
function makeLandscape(scene, focus, eye) {
  const broad = W.DECOR.trees;
  const extraFoliage = [];
  instance(scene, new THREE.CylinderGeometry(.12, .24, 4.8, 7), W.DECOR.trees, material(0x605c4a), object => { object.position.y += 2.4 * object.scale.y; });
  const foliage = new THREE.TextureLoader().load('./assets/oak-foliage.png'); foliage.colorSpace = THREE.SRGBColorSpace;
  foliage.anisotropy = 4;
  const leaves = new THREE.MeshLambertMaterial({ color: 0xe1e5c8, map: foliage, alphaTest: .45, side: THREE.DoubleSide });
  // Keep a sight corridor clear when foreground foliage covers the hero.
  leaves.onBeforeCompile = shader => {
    shader.uniforms.riftFocus = { value: focus }; shader.uniforms.riftEye = { value: eye };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 riftLeafPosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 riftPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        riftPosition = instanceMatrix * riftPosition;
      #endif
      riftLeafPosition = (modelMatrix * riftPosition).xyz;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 riftLeafPosition; uniform vec3 riftFocus; uniform vec3 riftEye;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      vec3 riftLine = riftFocus - riftEye;
      float riftAlong = dot(riftLeafPosition - riftEye, riftLine) / max(dot(riftLine, riftLine), 0.01);
      if (riftAlong > -0.05 && riftAlong < 1.03) {
        float riftDistance = length(riftLeafPosition - (riftEye + clamp(riftAlong, 0.0, 1.0) * riftLine));
        if (riftDistance < 2.8) discard;
      }
    `);
  };
  for (let crown = 0; crown < 7; crown++) {
    const batches = instance(scene, new THREE.PlaneGeometry(1, 1), broad, leaves, (object, record) => {
    const angle = crown * 2.1 + record.rotation;
    object.position.x += Math.sin(angle) * record.scale * .6; object.position.z += Math.cos(angle) * record.scale * .6;
    object.position.y += (4.9 + crown % 3 * .55) * record.scale;
    object.rotation.set(crown % 3 === 0 ? -1.05 : -.18, angle, Math.sin(crown) * .18);
    object.scale.set(record.scale * 4.3, record.scale * 3.9, record.scale);
  });
    if (crown > 2) extraFoliage.push(...batches);
  }
  instance(scene, new THREE.DodecahedronGeometry(1, 1), W.DECOR.rocks, material(0x878c80), (object, record) => {
    object.position.y += record.scale * .4; object.scale.set(record.scale * 1.2, record.scale * .8, record.scale); object.rotation.z = .22;
  });
  instance(scene, new THREE.ConeGeometry(.25, .7, 3), W.DECOR.grass, material(0x8c9668, 0, 1), (object, record) => { object.position.y += .3 * record.scale; object.scale.x *= .7; }, false);
  const random = W.seeded(172);
  for (let index = 0; index < 34; index++) {
    const angle = index / 34 * Math.PI * 2, radius = 295 + random() * 45;
    const mountain = mesh(scene, new THREE.ConeGeometry(1, 1, 11), [28 + random() * 38, 35 + random() * 70, 28 + random() * 30], [Math.sin(angle) * radius, 19, Math.cos(angle) * radius], material(index % 2 ? 0x71838a : 0x8f9a9b));
    mountain.rotation.y = random() * 6; mountain.castShadow = false;
  }
  return extraFoliage;
}
function stoneColumn(parent, x, z, height = 5.5) {
  const stone = material(0x9a9b91, .08, .88);
  mesh(parent, 'cylinder', [.58, .24, .58], [x, .12, z], stone);
  mesh(parent, 'cylinder', [.4, height, .4], [x, height / 2 + .2, z], stone);
  for (const y of [.4, height + .15]) mesh(parent, 'cylinder', [.51, .22, .51], [x, y, z], stone);
  mesh(parent, 'box', [1.2, .32, 1.1], [x, height + .4, z], stone);
}
function makeSanctuary(scene) {
  const group = new THREE.Group(); scene.add(group); const stone = material(0xb8b6a0, .08, .84);
  mesh(group, new THREE.CylinderGeometry(10.8, 10.8, .25, 96), [1, 1, 1], [0, -.07, 0], stone);
  for (const radius of [4.4, 9.4, 10.5]) {
    const ring = mesh(group, new THREE.TorusGeometry(radius, .035, 6, 110), [1, 1, 1], [0, .07, 0], material(0xb4a56d, .65, .3)); ring.rotation.x = Math.PI / 2;
  }
  mesh(group, 'cylinder', [1.8, .32, 1.8], [0, .24, 0], stone);
  mesh(group, 'cylinder', [1.1, .5, 1.1], [0, .57, 0], material(0x565d5b));
  const crystal = mesh(group, 'crystal', [.57, 1.6, .57], [0, 2.5, 0], material(0x9ed7d5, .35, .22, { emissive: 0x62b6bb, emissiveIntensity: .5 }));
  const light = new THREE.PointLight(0x96d9e0, 5, 12, 2); light.position.set(0, 3, 0); group.add(light);
  for (let index = 0; index < 10; index++) {
    const angle = index / 10 * Math.PI * 2, x = Math.sin(angle) * 13.5, z = Math.cos(angle) * 13.5;
    stoneColumn(group, x, z, index % 3 === 0 ? 2.8 : 5.3);
    if (index % 3 !== 0) mesh(group, 'cone', [.24, 1.2, .24], [x, 6.4, z], material(0xafa077, .6, .4));
  }
  return crystal;
}
function makeRuins(scene) {
  const group = new THREE.Group(); group.position.set(97, W.heightAt(97, -68), -68); group.rotation.y = -.2; scene.add(group);
  const stone = material(0x9fa499, .07, .9); mesh(group, 'cylinder', [20, .3, 20], [0, -.15, 0], material(0x7f8981));
  for (let index = 0; index < 7; index++) {
    stoneColumn(group, -14 + index * 4.6, -10, index === 2 ? 3 : 7.7);
    if (index < 6 && index !== 2) mesh(group, 'box', [4.9, .7, 1.2], [-11.7 + index * 4.6, 8.5, -10], stone);
  }
  for (const x of [-7, 7]) { stoneColumn(group, x, 8, 11); mesh(group, 'box', [2, 2.4, 1.4], [x, 11.8, 8], stone); }
  mesh(group, new THREE.TorusGeometry(7, .6, 9, 32, Math.PI), [1, 1, 1], [0, 11, 8], stone);
  const random = W.seeded(734);
  for (let index = 0; index < 28; index++) mesh(group, 'box', [1 + random() * 2, .5 + random(), .7 + random()], [(random() - .5) * 33, .4, (random() - .5) * 27], stone, [random(), random() * 6, random() * .3]);
  for (const x of [-7, 7]) { const idol = human('warrior', 0x85958d, true); idol.scale.setScalar(2.4); idol.position.set(x, .2, -2); group.add(idol); }
  const rift = new THREE.Group(); rift.position.set(171, W.heightAt(171, 137), 137); scene.add(rift);
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * 6.28;
    mesh(rift, 'crystal', [1.1, 4 + index % 3, 1.2], [Math.sin(angle) * 12, 2, Math.cos(angle) * 12], material(0x4b455b, .4, .4, { emissive: 0x5b3059, emissiveIntensity: .22 }), [0, 0, Math.sin(angle) * .2]);
  }
}
function human(classId, color, statue = false, appearance = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.userData.body = body;
  const metal = material(statue ? color : appearance.armor === 'jadeArmor' ? 0x7da99f : 0xb5bfc0, statue ? .15 : .72, statue ? .9 : .33), edge = material(statue ? color : 0xafa077, .65, .4);
  const enchanted = ['jadeSword', 'moonBow', 'emberStaff'].includes(appearance.weapon);
  const weapon = enchanted ? material(0xb9dfd4, .7, .26, { emissive: 0x548f88, emissiveIntensity: .45 }) : metal;
  const dark = material(statue ? color : 0x313b43, .2, .65), skin = material(statue ? color : 0xd1b39c);
  const cloth = material(color || (classId === 'ranger' ? 0x3c5d4e : classId === 'mystic' ? 0x444c70 : 0x4b4b5b), .03, .9);
  mesh(body, 'sphere', [.33, .39, .19], [0, 1.29, 0], classId === 'mystic' ? cloth : metal);
  mesh(body, 'sphere', [.27, .23, .17], [0, 1.02, 0], dark); mesh(body, 'box', [.52, .07, .35], [0, 1.03, 0], edge);
  mesh(body, 'crystal', [.09, .11, .05], [0, 1.37, .19], edge); mesh(body, 'cylinder', [.075, .15, .075], [0, 1.72, 0], skin);
  mesh(body, 'sphere', [.155, .205, .16], [0, 1.91, .015], skin);
  mesh(body, 'sphere', [.162, .12, .168], [0, 2.03, -.01], material(statue ? color : 0x514b40));
  mesh(body, 'sphere', [.04, .04, .055], [0, 1.91, .17], skin);
  for (const side of [-1, 1]) {
    mesh(body, 'box', [.048, .018, .02], [side * .07, 1.95, .157], material(0x4c5553));
    const leg = new THREE.Group(); leg.position.set(side * .15, 1, 0); body.add(leg);
    mesh(leg, 'sphere', [.115, .28, .12], [0, -.25, 0], classId === 'mystic' ? cloth : dark);
    mesh(leg, 'sphere', [.12, .1, .12], [0, -.51, .025], metal); mesh(leg, 'sphere', [.105, .23, .105], [0, -.72, 0], metal);
    mesh(leg, 'sphere', [.11, .09, .19], [0, -.94, .08], dark); root.userData[side < 0 ? 'leftLeg' : 'rightLeg'] = leg;
    const arm = new THREE.Group(); arm.position.set(side * .35, 1.54, 0); body.add(arm);
    mesh(arm, 'sphere', [.17, .11, .18], [side * .04, -.02, 0], metal); mesh(arm, 'sphere', [.085, .23, .085], [side * .05, -.23, 0], dark);
    mesh(arm, 'sphere', [.095, .19, .1], [side * .05, -.51, .015], metal); mesh(arm, 'sphere', [.075, .09, .07], [side * .05, -.7, .025], skin);
    root.userData[side < 0 ? 'leftArm' : 'rightArm'] = arm;
  }
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.04, 5, 9), new THREE.MeshStandardMaterial({ color: color || 0x294b52, side: THREE.DoubleSide, roughness: 1 }));
  cape.position.set(0, 1.04, -.22); cape.rotation.x = -.1; body.add(cape); root.userData.cape = cape;
  if (classId === 'mystic') {
    mesh(body, 'cone', [.31, .8, .3], [0, .7, 0], cloth);
    mesh(root.userData.rightArm, 'cylinder', [.023, 1.7, .023], [.1, -.3, .16], edge);
    mesh(root.userData.rightArm, 'crystal', [.11, .22, .11], [.1, .58, .16], material(0xa0d8e0, .3, .2, { emissive: 0x5db9d0, emissiveIntensity: .5 }));
  } else if (classId === 'ranger') {
    const bow = mesh(root.userData.leftArm, new THREE.TorusGeometry(.47, .025, 6, 18, Math.PI), [1, 1, 1], [-.1, -.5, .14], enchanted ? weapon : edge); bow.rotation.z = Math.PI / 2;
    cylinderBetween(root.userData.leftArm, [-.1, -.97, .14], [-.1, -.03, .14], .005, metal); mesh(body, 'cylinder', [.09, .7, .09], [.19, 1.32, -.26], dark, [0, 0, -.3]);
  } else {
    const arm = root.userData.rightArm;
    mesh(arm, 'box', [.075, .83, .025], [.06, -.07, .15], weapon); mesh(arm, 'cone', [.055, .16, .025], [.06, .41, .15], weapon);
    mesh(arm, 'box', [.27, .035, .06], [.06, -.5, .15], edge); mesh(arm, 'cylinder', [.025, .23, .025], [.06, -.64, .15], dark);
  }
  return root;
}
function creature(kind) {
  if (kind === 'golem' || kind === 'warden') {
    const object = human('warrior', kind === 'warden' ? 0x5b4354 : 0x737d71, true); object.scale.setScalar(kind === 'warden' ? 2.4 : 1.55);
    mesh(object.userData.body, 'crystal', [.1, .19, .1], [0, 1.35, .23], material(kind === 'warden' ? 0xda81b9 : 0x9cd1c4, .3, .3, { emissive: kind === 'warden' ? 0xa52c78 : 0x4e9e91, emissiveIntensity: 1.2 })); return object;
  }
  const object = new THREE.Group(), type = W.ENEMIES[kind], mat = material(type.color);
  if (kind === 'shard') {
    mesh(object, 'cylinder', [1.4, .3, 1.4], [0, .05, 0], material(0x53505c));
    for (let index = 0; index < 5; index++) mesh(object, 'crystal', [.4, 1.4 + index % 3 * .4, .4], [Math.sin(index * 2.4) * .65, 1.1, Math.cos(index * 2.4) * .65], material(0x7f7296, .45, .28, { emissive: 0x714984, emissiveIntensity: .45 }), [0, index, Math.sin(index) * .3]);
    return object;
  }
  const body = new THREE.Group(); object.add(body); object.userData.body = body;
  if (kind === 'spider') {
    mesh(body, 'sphere', [.65, .4, .8], [0, .65, -.3], mat); mesh(body, 'sphere', [.4, .3, .4], [0, .6, .55], material(0x383a47));
    for (const side of [-1, 1]) for (let index = 0; index < 4; index++) {
      const start = [side * .3, .6, -.7 + index * .4], joint = [side * 1.1, .85, -.9 + index * .55], end = [side * 1.5, .07, -1.1 + index * .65];
      cylinderBetween(body, start, joint, .045, mat); cylinderBetween(body, joint, end, .035, mat);
    }
    for (const side of [-1, 1]) mesh(body, 'sphere', [.055, .05, .045], [side * .16, .69, .9], material(0xd8857c, .1, .3, { emissive: 0x772222 })); return object;
  }
  const boar = kind === 'boar'; object.scale.setScalar(kind === 'frostwolf' ? 1.15 : 1);
  mesh(body, 'sphere', [boar ? .46 : .32, boar ? .48 : .35, .78], [0, .87, 0], mat); mesh(body, 'sphere', [.27, .31, .37], [0, 1.1, .77], mat);
  mesh(body, 'sphere', [.16, .15, .3], [0, .98, 1.06], mat); mesh(body, 'sphere', [.1, .08, .05], [0, 1, 1.32], material(0x252e32));
  for (const side of [-1, 1]) {
    mesh(body, 'cone', [.11, .25, .09], [side * .19, 1.42, .68], mat, [0, 0, side * -.25]); mesh(body, 'sphere', [.035, .03, .03], [side * .22, 1.15, .99], material(0xe4bd70, .1, .3));
    if (boar) mesh(body, 'cone', [.045, .35, .045], [side * .2, .91, 1.1], material(0xdcd4bc), [.5, 0, side * -.4]);
    for (const z of [-.47, .46]) {
      const leg = new THREE.Group(); leg.position.set(side * .25, .8, z); body.add(leg);
      mesh(leg, 'sphere', [.09, .38, .11], [0, -.33, 0], mat); mesh(leg, 'sphere', [.1, .06, .15], [0, -.72, .03], material(0x3e4646)); object.userData[`leg${side}${z}`] = leg;
    }
  }
  mesh(body, 'cone', [.13, .7, .13], [0, .85, -.99], mat, [-1.1, 0, 0]); return object;
}

export class FantasyRenderer {
  constructor(canvas, onPick) {
    this.canvas = canvas; this.onPick = onPick; this.actors = new Map(); this.labels = new Map(); this.effects = [];
    this.yaw = .18; this.distance = 20; this.pitch = .66; this.target = new THREE.Vector3(0, .8, 10);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xb5c8ce); this.scene.fog = new THREE.FogExp2(0xb5c8ce, .0049);
    this.camera = new THREE.PerspectiveCamera(48, 1, .15, 520);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.scene.add(new THREE.HemisphereLight(0xd8e5e8, 0x4d593b, 2.2));
    this.sun = new THREE.DirectionalLight(0xffebce, 3); this.sun.position.set(-35, 70, 35); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -45; this.sun.shadow.camera.right = this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 180; this.sun.shadow.normalBias = .045; this.sun.shadow.bias = -.00015; this.scene.add(this.sun, this.sun.target);
    this.terrain = makeTerrain(this.scene); this.extraFoliage = makeLandscape(this.scene, this.target, this.camera.position); this.crystal = makeSanctuary(this.scene); makeRuins(this.scene);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.15, 64), new THREE.MeshBasicMaterial({ color: 0xe8c789, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring); this.ring.visible = false;
    this.destination = this.ring.clone(); this.destination.material = this.ring.material.clone(); this.destination.material.color.set(0xa7dee2); this.scene.add(this.destination); this.destination.visible = false;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    for (const npc of W.NPCS) this.addActor(npc.id, { ...npc, classId: npc.kind === 'healer' ? 'mystic' : 'warrior', npc: true, hp: 1 }, true);
    this.resize = () => { this.renderer.setSize(innerWidth, innerHeight, false); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); };
    addEventListener('resize', this.resize); this.resize(); this.bindPointer();
    window.streetLifeRenderer = this; window.streetLifeScene = this.scene;
  }
  addActor(id, data, npc = false) {
    const object = data.kind && !npc ? creature(data.kind) : human(data.classId, npc ? data.color : undefined, false, data.appearance);
    const mob = !npc && W.ENEMIES[data.kind];
    const pickHeight = data.kind === 'warden' ? 5 : data.kind === 'golem' ? 3.2 : mob ? 1.7 : 2.2;
    const pickRadius = mob ? mob.radius : .55;
    const pickMesh = new THREE.Mesh(new THREE.CylinderGeometry(pickRadius / object.scale.x, pickRadius / object.scale.x, pickHeight / object.scale.y, 6), pickMaterial);
    pickMesh.position.y = pickHeight / object.scale.y / 2; object.add(pickMesh);
    object.position.set(data.x, W.heightAt(data.x, data.z), data.z); object.rotation.y = data.angle || Math.PI;
    object.traverse(child => { if (child.isMesh) child.userData.actorId = id; }); this.scene.add(object); this.actors.set(id, { object, data, npc });
    const label = document.createElement('div'); label.className = `actor-label${npc ? ' npc' : ''}`;
    const name = document.createElement('span'); name.textContent = data.name; label.append(name);
    if (npc) { label.style.pointerEvents = 'auto'; label.style.cursor = 'pointer'; label.addEventListener('click', () => this.onPick({ id })); }
    const bar = document.createElement('i'); label.append(bar); document.getElementById('labels').append(label); this.labels.set(id, { element: label, bar, name }); return this.actors.get(id);
  }
  bindPointer() {
    let dragging = false, moved = false, lastX = 0, lastY = 0;
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => { if (event.button === 2) { dragging = true; moved = false; lastX = event.clientX; lastY = event.clientY; this.canvas.setPointerCapture(event.pointerId); } });
    this.canvas.addEventListener('pointermove', event => {
      if (!dragging) return; const dx = event.clientX - lastX, dy = event.clientY - lastY;
      this.yaw -= dx * .005; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .004, .27, 1.23); moved ||= Math.abs(dx) + Math.abs(dy) > 2; lastX = event.clientX; lastY = event.clientY;
    });
    this.canvas.addEventListener('pointerup', event => { if (event.button === 2) { dragging = false; return; } if (event.button !== 0 || moved) { moved = false; return; } this.pick(event); });
    this.canvas.addEventListener('wheel', event => { event.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * .018, 7, 37); }, { passive: false });
  }
  pick(event) {
    this.pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2); this.raycaster.setFromCamera(this.pointer, this.camera);
    const hitActor = this.raycaster.intersectObjects([...this.actors.values()].filter(actor => actor.object.visible).map(actor => actor.object), true)[0];
    if (hitActor) { this.onPick({ id: hitActor.object.userData.actorId }); return; }
    const hit = this.raycaster.intersectObject(this.terrain)[0];
    if (hit) { this.destination.position.copy(hit.point); this.destination.position.y += .09; this.destination.visible = true; this.destinationAt = performance.now(); this.onPick({ x: hit.point.x, z: hit.point.z }); }
  }
  sync(snapshot, targetId) {
    this.snapshot = snapshot; this.targetId = targetId; const present = new Set(W.NPCS.map(npc => npc.id));
    for (const data of [...snapshot.players, ...snapshot.enemies]) {
      present.add(data.id);
      let actor = this.actors.get(data.id);
      if (actor && JSON.stringify(actor.data.appearance) !== JSON.stringify(data.appearance)) { this.removeActor(data.id); actor = null; }
      actor ||= this.addActor(data.id, data); actor.data = data; actor.object.visible = data.hp > 0;
      const label = this.labels.get(data.id); label.name.textContent = `${data.kind ? 'Lv. ' + data.level + ' · ' : ''}${data.name}`; label.bar.style.transform = `scaleX(${Math.max(0, data.hp / data.maxHp)})`;
    }
    for (const id of this.actors.keys()) if (!present.has(id)) this.removeActor(id);
    for (const event of snapshot.events) this.effect(event);
  }
  removeActor(id) {
    const actor = this.actors.get(id); if (!actor) return;
    this.scene.remove(actor.object);
    actor.object.traverse(child => { if (child.isMesh && !Object.values(geometry).includes(child.geometry)) child.geometry.dispose(); });
    actor.object.userData.cape?.material.dispose(); this.actors.delete(id); this.labels.get(id).element.remove(); this.labels.delete(id);
  }
  effect(event) {
    if (event.amount || event.type === 'level') {
      const element = document.createElement('div'); element.className = 'damage-number'; element.textContent = event.amount ? String(event.amount) : 'ÚROVEŇ ' + event.level; element.style.color = event.type === 'hurt' ? '#f3a58f' : '#e8d59a';
      document.getElementById('labels').append(element); this.effects.push({ kind: 'text', element, x: event.x, z: event.z, age: 0, duration: 1.1 });
    }
    if (['skill', 'level', 'heal', 'attack'].includes(event.type)) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .035, 5, 48), new THREE.MeshBasicMaterial({ color: event.type === 'skill' ? 0x91d4df : 0xe3d7b0, transparent: true, opacity: .8, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; ring.position.set(event.x, W.heightAt(event.x, event.z) + .13, event.z); this.scene.add(ring); this.effects.push({ kind: 'ring', object: ring, age: 0, duration: event.type === 'attack' ? .25 : .8 });
    }
  }
  render(dt, elapsed) {
    const snapshot = this.snapshot;
    if (snapshot) {
      const blend = 1 - Math.exp(-dt * 14);
      for (const [id, { object, data, npc }] of this.actors) {
        object.position.lerp(v.set(data.x, W.heightAt(data.x, data.z), data.z), blend);
        let delta = (data.angle || 0) - object.rotation.y; object.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * blend;
        const parts = object.userData, stride = data.moving ? Math.sin(elapsed * 9.2) * .53 : Math.sin(elapsed * 1.5) * .025;
        if (parts.leftLeg) {
          parts.leftLeg.rotation.x = stride; parts.rightLeg.rotation.x = -stride; const attacking = snapshot.time < (data.attackUntil || 0);
          parts.rightArm.rotation.x = attacking ? -1.3 + Math.sin(elapsed * 22) * .7 : stride * .6; parts.leftArm.rotation.x = data.classId === 'ranger' && attacking ? -1.15 : -stride * .6;
          parts.body.position.y = data.moving ? Math.abs(Math.sin(elapsed * 9.2)) * .045 : 0;
          const vertices = parts.cape.geometry.attributes.position;
          for (let index = 0; index < vertices.count; index++) { const amount = (.52 - vertices.getY(index)) / 1.04; vertices.setZ(index, -amount * .12 + Math.sin(elapsed * 3 + amount * 4) * amount * (data.moving ? .17 : .045)); } vertices.needsUpdate = true;
        } else if (parts.body) { let index = 0; for (const [key, leg] of Object.entries(parts)) if (key.startsWith('leg')) leg.rotation.x = stride * (index++ % 2 ? -1 : 1); parts.body.position.y = data.moving ? Math.abs(stride) * .08 : Math.sin(elapsed * 2) * .015; }
        const label = this.labels.get(id), important = npc || id === this.targetId || id === snapshot.self.id || !data.kind;
        const show = object.visible && (important || object.position.distanceTo(this.camera.position) < 25 && data.hp < data.maxHp);
        if (show) {
          v.copy(object.position); v.y += npc ? 2.55 : data.kind === 'warden' ? 5.7 : data.kind === 'golem' ? 3.7 : data.kind ? 2 : 2.55; v.project(this.camera);
          label.element.hidden = v.z > 1 || v.z < -1; label.element.style.transform = `translate(-50%,-100%) translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px)`;
          label.element.classList.toggle('selected', id === this.targetId); label.bar.hidden = npc || id === snapshot.self.id;
        } else label.element.hidden = true;
      }
      const actor = this.actors.get(snapshot.self.id);
      if (actor) { this.target.lerp(actor.object.position.clone().add(v.set(0, 1, 0)), 1 - Math.exp(-dt * 5)); this.sun.target.position.copy(this.target); this.sun.position.copy(this.target).add(v.set(-35, 70, 35)); }
      const selected = this.actors.get(this.targetId); this.ring.visible = !!selected && selected.data.hp > 0;
      if (selected) { this.ring.position.copy(selected.object.position); this.ring.position.y += .1; this.ring.scale.setScalar(!selected.npc && W.ENEMIES[selected.data.kind] ? W.ENEMIES[selected.data.kind].radius + .25 : 1); }
    }
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.copy(this.target).add(v.set(Math.sin(this.yaw) * horizontal, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * horizontal)); this.camera.lookAt(this.target);
    this.crystal.rotation.y = elapsed * .26; this.crystal.position.y = 2.5 + Math.sin(elapsed * 1.2) * .16; this.destination.visible &&= performance.now() - this.destinationAt < 1300;
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index]; effect.age += dt; const progress = effect.age / effect.duration;
      if (progress >= 1) { if (effect.element) effect.element.remove(); if (effect.object) { this.scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); } this.effects.splice(index, 1); continue; }
      if (effect.kind === 'text') { v.set(effect.x, W.heightAt(effect.x, effect.z) + 2 + progress * 1.8, effect.z).project(this.camera); effect.element.style.transform = `translate(-50%,-50%) translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px)`; effect.element.style.opacity = String(Math.min(1, (1 - progress) * 3)); }
      else { effect.object.scale.setScalar(.4 + progress * 4); effect.object.material.opacity = (1 - progress) * .8; }
    }
    this.renderer.render(this.scene, this.camera);
  }
  setQuality(low) {
    this.lowQuality = !!low; this.renderer.setPixelRatio(low ? .8 : Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = !low;
    this.camera.far = low ? 145 : 420; this.scene.fog.density = low ? .008 : .0049;
    for (const batch of this.extraFoliage) batch.visible = !low;
    this.resize();
  }
}
