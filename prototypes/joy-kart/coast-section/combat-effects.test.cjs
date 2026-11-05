const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=new Function(['circuit.js','simple-engine.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n')+';return {...createCoastSimpleModule(createKartCircuit(),true),resolveKartWaves,kartImpact,kartThreat};')();
function pair(){return [0,1].map(()=>{const r=new api.SimpleRace();r.phase='running';r.time=10;r.k.s=100;r.k.v=38;return r;});}
test('real rocket hits carry immutable timing metadata through snapshots and reset',()=>{
 const racers=pair();racers[1].k.rocket={s:100,lat:0};api.resolveKartWaves(racers,[0,0]);
 const old=racers[0].snapshot();assert.equal(old.slow,1.8);assert.equal(api.kartImpact(old).burst,1);
 racers[0].time+=.2;racers[1].k.rocket={s:100,lat:0};api.resolveKartWaves(racers,[0,0]);
 assert.equal(old.impact.time,10);assert.equal(racers[0].k.impact.time,10.2);
 assert.equal(api.kartImpact({...old,time:11}).burst,0);
 assert.equal(api.kartImpact({...old,lastHit:'banana',impact:null}).slip,false);
 racers[0].begin();assert.equal(racers[0].snapshot().impact,null);
});
test('banana and shield effects follow actual contact rules without changing penalties',()=>{
 const racers=pair();racers[1].k.banana={s:100,lat:0};api.resolveKartWaves(racers,[0,0]);
 assert.equal(racers[0].k.slow,2.5);assert.equal(api.kartImpact(racers[0].snapshot()).slip,true);
 racers[0].k.item='shield';racers[0].queueTurbo();racers[0].advance(1/30);
 racers[1].k.rocket={s:racers[0].k.s,lat:0};api.resolveKartWaves(racers,[0,0]);
 const k=racers[0].snapshot();assert.equal(k.slow,0);assert.equal(k.blocked,1.2);assert.equal(k.shield,0);assert.equal(api.kartImpact(k).blocked,true);
 assert.equal(api.kartImpact({...k,phase:'finished'}).burst,0);
});
test('threat direction wraps at the finish line and banana warnings respect lane and jumps',()=>{
 const course=api.course,k={phase:'running',s:course.lapLength-8,lat:0,lift:0};
 assert.equal(api.kartThreat(k,{rocket:{s:4}},course).behind,false);
 assert.equal(api.kartThreat({...k,s:4},{rocket:{s:course.lapLength-8}},course).behind,true);
 assert.equal(api.kartThreat(k,{banana:{s:4,lat:0}},course).kind,'banana');
 assert.equal(api.kartThreat({...k,lift:1},{banana:{s:4,lat:0}},course),null);
 assert.equal(api.kartThreat(k,{banana:{s:4,lat:3}},course),null);
 assert.equal(api.kartThreat({...k,phase:'finished'},{rocket:{s:4}},course),null);
});
