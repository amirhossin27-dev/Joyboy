const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const build=new Function('second','fastRace',source('circuit.js')+source('simple-engine.js')+';return {...createCoastSimpleModule(createKartCircuit(second),fastRace),resolveKartWaves};');
for(const second of [false,true]){
 const {SimpleRace,course}=build(second);
 test(course.name+' offers exactly the four racing items on each lap',()=>{
  for(let lap=0;lap<course.laps;lap++){
   const items=course.boxes.map((_,row)=>course.pickupType(row,lap));
   assert.deepEqual([...new Set(items)].sort(),['banana','rocket','shield','turbo']);
  }
 });
 test(course.name+' Robo sprint finishes in about two minutes and rewards turbo',()=>{
  const {SimpleRace}=build(second,true);
  const times=[false,true].map(useItems=>{
   const race=new SimpleRace();race.begin();
   for(let frame=0;frame<150*30 && race.phase!=='finished';frame++){
    if(useItems)race.queueTurbo();
    race.advance(1/30);
   }
   assert.equal(race.phase,'finished');return race.time;
  });
  assert(times[0]>125 && times[0]<140);assert(times[1]<times[0]-1);
  console.log(course.name+' Robo (seconds, cruise/turbo): '+times.map(t=>t.toFixed(1)).join(' / '));
 });
 test(course.name+' closes at the line and takes 3–4 minutes for three laps',()=>{
  const first=course.point(0,2),last=course.point(course.lapLength,2);
  assert(Math.hypot(first.x-last.x,first.y-last.y,first.z-last.z)<1e-8);assert.equal(first.angle,last.angle);
  let total=0;for(let s=0;s<course.lapLength;s++){const a=course.point(s),b=course.point(s+1);total+=Math.hypot(a.x-b.x,a.z-b.z);}
  assert(Math.abs(total-course.lapLength)<1);
  const times=[];
  for(const useItems of [false,true]){
   const race=new SimpleRace();race.begin();const laps=[1];
   while(race.phase!=='finished'&&race.time<250){
    if(useItems)race.queueTurbo();race.advance(1/30);
    const k=race.snapshot();if(laps.at(-1)!==k.lap)laps.push(k.lap);
    race.takeEvents();
   }
   assert.equal(race.phase,'finished');assert.deepEqual(laps,[1,2,3]);assert.equal(race.k.s,course.lapLength*3);
   assert(race.time>=180&&race.time<=240);times.push(race.time);
  }
  assert(times[1]<times[0]);console.log(course.name+' – ohne/mit Items: '+times.map(t=>t.toFixed(2)).join(' / ')+' Sekunden');
 });
}
test('wave hits across the timing line, respects range and consumes a shield',()=>{
 const {SimpleRace,course,resolveKartWaves}=build(false);
 const racers=[new SimpleRace(),new SimpleRace()];
 for(const r of racers){r.begin();for(let j=0;j<14;j++)r.advance(.25);}
 const [a,b]=racers;a.k.s=course.lapLength-10;b.k.s=course.lapLength+5;
 function fire(){a.k.item='wave';const prev=racers.map(r=>r.stats.itemUses.wave||0);a.queueTurbo();a.advance(.02);resolveKartWaves(racers,prev);}
 b.k.item='shield';b.queueTurbo();b.advance(.02);fire();assert.equal(b.k.slow,0);assert.equal(b.k.shield,0);assert(b.k.blocked>0);
 fire();assert(b.k.slow>2);b.advance(.25);assert(b.k.v<24);
 b.k.slow=0;b.k.s+=150;fire();assert.equal(b.k.slow,0);
});
test('magnet collects from the opposite side and boxes refill on the next lap',()=>{
 const {SimpleRace,course}=build(false);
 const r=new SimpleRace();r.phase='running';r.k.v=24;r.k.lat=-4.5;
 const row=2,mark=course.boxes[row];
 r.k.s=mark-1;r.k.item=null;r.advance(.1);assert.equal(r.k.item,null);
 r.k.s=mark-1;r.k.item='magnet';r.queueTurbo();r.advance(.1);assert.equal(r.k.item,course.pickupType(row,0));
 r.k.s=mark+course.lapLength-1;r.k.item=null;r.advance(.1);
 assert.equal(r.k.item,course.pickupType(row,1));assert.equal(r.stats.boxes,2);
});
test('banana crosses the timing line, misses a different lane and hits once',()=>{
 const {SimpleRace,course,resolveKartWaves}=build(false);
 const racers=[new SimpleRace(),new SimpleRace()], [a,b]=racers;
 for(const r of racers)r.phase='running';
 a.k.s=course.lapLength+3;a.k.item='banana';a.queueTurbo();a.advance(.01);
 const mark=a.k.banana.s;
 b.stepStart=mark-1;b.k.s=mark+1;b.k.lat=3;
 resolveKartWaves(racers,[0,0]);assert(a.k.banana);assert.equal(b.k.slow,0);
 b.k.lat=.2;resolveKartWaves(racers,[0,0]);assert.equal(a.k.banana,null);assert.equal(b.k.lastHit,'banana');
 assert(b.k.slow>2);assert.equal(a.k.slow,0);
});
test('homing rocket catches the leader around the finish line and respects shields',()=>{
 const {SimpleRace,course,resolveKartWaves}=build(true);
 for(const shield of [0,10]){
  const racers=[new SimpleRace(),new SimpleRace()],[a,b]=racers;
  for(const r of racers){r.phase='running';r.k.v=38;}
  a.k.s=course.lapLength-25;b.k.s=course.lapLength+15;b.k.lat=3;b.k.shield=shield;
  a.k.item='rocket';a.queueTurbo();
  for(let i=0;i<120;i++){
   for(const r of racers)r.advance(1/60);
   resolveKartWaves(racers,[0,0]);
   if(!i)assert(a.k.rocket);
   if(!a.k.rocket)break;
  }
  assert.equal(a.k.rocket,null);assert.equal(b.k.shield,0);
  assert(shield?b.k.blocked>0:b.k.slow>0);assert.equal(a.k.slow,0);
 }
});
for(const cape of [false,true])test((cape?'Cape':'Bay')+' boost lines and ramps work on every lap and can be bypassed',()=>{
 const {SimpleRace,course,SPEED}=build(cape,true);
 for(let lap=0;lap<3;lap++)for(const zone of course.features.filter(z=>z.type==='boost')){
  for(const onLine of [true,false]){
   const race=new SimpleRace();race.phase='running';race.k.s=lap*course.lapLength+zone.start-4;
   race.k.lat=onLine?zone.lat:-zone.lat;race.k.v=SPEED.cruise;
   let peak=0,top=0;const events=[];
   for(let i=0;i<150;i++){race.advance(1/60);peak=Math.max(peak,race.k.lift);top=Math.max(top,race.k.v);events.push(...race.takeEvents());}
   assert.equal(events.filter(e=>e==='jump').length,onLine?1:0);assert.equal(events.includes('land'),onLine);
   assert.equal(race.k.grounded,true);assert.equal(race.k.lift,0);assert.equal(race.k.item,'turbo');
   if(onLine){assert(peak>2);assert(top>SPEED.cruise+10);}else{assert.equal(peak,0);assert.equal(top,SPEED.cruise);}
  }
 }
});
