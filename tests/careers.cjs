const assert=require('node:assert/strict');
const system=require('../web/career-system.js');
assert.equal(system.catalog.dealer.length,20);assert.equal(system.catalog.worker.length,20);
const all=Object.values(system.catalog).flat();assert.equal(new Set(all.map(q=>q.id)).size,40);assert.equal(new Set(all.map(q=>q.title)).size,40);
let state=system.create();assert.equal(system.accept(state,'unknown',8),false);assert.equal(system.accept(state,'dealer',NaN),false);
for(const track of ['dealer','worker'])for(const quest of system.catalog[track]){
 assert.equal(system.accept(state,track,quest.level-1),false);assert.equal(system.accept(state,track,8),true);assert.equal(system.accept(state,track,8),false);
 for(let stage=0;stage<3;stage++){
  const target=system.target(state),token=quest.id+':'+stage;
  assert.equal(system.advance(state,{x:-100,y:-100},token),null);
  assert.equal(system.advance(state,{x:NaN,y:target.y},token),null);
  assert.equal(system.advance(state,target,'stale'),null);
  state=system.restore(JSON.parse(JSON.stringify(state)));assert.equal(state.active.stage,stage);
  const result=system.advance(state,target,token);assert.equal(result.finished,stage===2);
  if(result.finished)assert.equal(result.reward,quest.reward);
  assert.equal(system.advance(state,target,token),null);
 }
 assert.equal(state.done[track],quest.number);assert.equal(state.active,null);
}
assert.equal(system.accept(state,'dealer',8),false);assert.equal(system.accept(state,'worker',8),false);
assert.deepEqual(system.restore(null),system.create());assert.equal(system.restore({version:1,done:{dealer:999,worker:-1},active:{track:'dealer',id:'dealer-1',stage:90}}).active,null);
assert.equal(system.restore({version:1,done:{dealer:1,worker:0},active:{track:'dealer',id:'dealer-1',stage:0}}).active,null);
console.log('PASS: all 40 quests / 120 objectives, sequential and level unlocks, save restoration, invalid positions, corrupt/stale state, exactly one completion reward');
