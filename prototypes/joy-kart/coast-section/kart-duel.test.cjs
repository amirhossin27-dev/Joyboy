const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=['circuit.js','simple-engine.js','kart-duel.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
const build=new Function('rng','cape','fast',source+';const course=createKartCircuit(cape),M=createCoastSimpleModule(course,fast,{rng});return {M,course,duel:createKartDuel(M,course,rng),kartWire,kartThreat,kartDraft};');
const random=seed=>()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
const make=(seed=1,cape=false,fast=true)=>build(random(seed),cape,fast);
const HUMAN={steer:0,turbo:false};
function running(seed){const game=make(seed);game.duel.begin();for(let i=0;i<200;i++)game.duel.step(1/60,[HUMAN,HUMAN]);for(const r of game.duel.racers){assert.equal(r.phase,'running');r.k.item=null;}return game;}
function use(game,seat,item){const r=game.duel.racers[seat];r.k.item=item;r.k.roll=0;assert.equal(r.queueTurbo(),true);return game.duel.step(1/60,[HUMAN,HUMAN]);}
function run(game,seconds,inputs=[HUMAN,HUMAN]){let grid;for(let i=0;i<Math.round(seconds*60);i++)grid=game.duel.step(1/60,inputs);return grid;}

test('Robo gegen Robo fährt mit allen Zufallsitems zu Ende und beide Zeiten bleiben im Rahmen',()=>{
 const used=new Set();
 for(let seed=1;seed<=6;seed++){
  const {duel}=make(seed,seed%2===1);duel.begin();let grid,t=0;
  while(t<260){grid=duel.step(1/30,[null,null]);t+=1/30;if(grid.every(k=>k.phase==='finished'))break;}
  assert(grid.every(k=>k.phase==='finished'),'Rennen '+seed+' endet');
  for(const k of grid){assert(k.time>110&&k.time<175,'Zeit '+k.time);Object.keys(k.stats.itemUses).filter(i=>k.stats.itemUses[i]).forEach(i=>used.add(i));}
 }
 assert(used.size>=10,'viele verschiedene Items: '+[...used]);
});
test('Item-Roulette sperrt den Einsatz kurz und gibt danach ein gewürfeltes Item frei',()=>{
 const game=running(3),r=game.duel.racers[0],mark=game.course.boxes[0];
 r.k.s=mark-1;r.k.lat=game.course.lanes(0)[0];run(game,.1);
 assert(r.k.item&&r.k.roll>0);assert.equal(r.queueTurbo(),false);
 run(game,.9);assert.equal(r.k.roll,0);assert.equal(r.queueTurbo(),true);
});
test('Blitzstart belohnt nur den Druck kurz vor dem Start',()=>{
 for(const [press,boost] of [[.3,true],[1.8,false],[null,false]]){
  const {duel}=make(4);duel.begin();const r=duel.racers[0];
  while(r.phase==='countdown'){if(press!==null&&r.countdown<=press)r.queueTurbo();duel.step(1/60,[HUMAN,HUMAN]);}
  assert.equal(r.k.boost>1,boost);assert.equal(r.stats.startBoost,boost?1:0);assert.equal(r.k.item,'turbo');
 }
});
test('Möwenschwarm, Glatteis und Windstoß treffen genau einmal; Schild und Sonnenkraft wehren ab',()=>{
 let game=running(5),[a,b]=game.duel.racers;
 use(game,0,'gulls');assert(b.k.gulls>4);assert.equal(b.k.lastHit,'gulls');assert.equal(b.k.slow,0);
 run(game,5);assert.equal(b.k.gulls,0);assert.equal(b.stats.hits,1);
 use(game,0,'ice');assert(b.k.ice>4.5);
 // Auf Glatteis reagiert die Spur träge und rutscht nach dem Loslassen weiter.
 const free=running(5).duel.racers[1];
 for(let i=0;i<30;i++){b.advance(1/60,1);free.advance(1/60,1);}
 assert(b.k.lat-2<(free.k.lat-2)*.6,'träges Einlenken');
 const lat=b.k.lat;for(let i=0;i<20;i++)b.advance(1/60,0);assert(b.k.lat>lat+.25,'rutscht nach');
 game=running(6);[a,b]=game.duel.racers;
 use(game,0,'gust');assert(b.k.gust>1);assert.equal(b.k.gustDir,1);
 run(game,1.3);assert(b.k.lat>4,'an den Rand gedrückt: '+b.k.lat);assert.equal(b.k.gust,0);
 game=running(7);[a,b]=game.duel.racers;
 use(game,1,'shield');use(game,0,'ice');assert.equal(b.k.ice,0);assert.equal(b.k.shield,0);assert(b.k.blocked>0);
 use(game,1,'sun');assert(b.k.sun>5);use(game,0,'gulls');use(game,0,'rocket');run(game,1);
 assert.equal(b.k.gulls,0);assert.equal(b.k.slow,0);assert(b.k.sun>0,'Sonnenkraft bleibt nach Treffern');assert.equal(b.stats.hits,0);
 const plain=running(7).duel.racers[1];run(game,.5);assert(b.k.v>plain.k.v*1.08,'Sonnenkraft macht schneller');
});
test('Krabbe erscheint voraus, läuft quer und lässt sich ausweichen oder überspringen',()=>{
 const outcomes=[];
 for(const mode of ['hit','dodge','jump']){
  const game=running(8),[a,b]=game.duel.racers;
  use(game,0,'crab');assert(b.k.crab);assert(b.k.crab.s>b.k.s+55);
  const events=[];let jumped=false;
  while(b.k.crab){
   const crab=b.k.crab,gap=crab.s-b.k.s;
   const steer=mode==='hit'?Math.max(-1,Math.min(1,(crab.lat-b.k.lat)*1.5)):mode==='dodge'?(crab.lat>0?-1:1):0;
   if(mode==='jump'&&!jumped&&gap<14){b.k.item='spring';b.k.roll=0;b.queueTurbo();jumped=true;}
   game.duel.step(1/60,[HUMAN,{steer,turbo:false}]);events.push(...b.takeEvents());
  }
  outcomes.push(b.k.lastHit==='crab');
  assert.equal(events.includes('dodge'),mode!=='hit');
  if(mode==='jump'){run(game,1.2);assert(b.k.grounded);}
 }
 assert.deepEqual(outcomes,[true,false,false]);
});
test('Sprungfeder hebt über eine Bananenschale und gibt beim Landen Schub',()=>{
 const game=running(9),[a,b]=game.duel.racers;
 a.k.s=b.k.s+30;a.k.lat=b.k.lat;use(game,0,'banana');const peel=a.k.banana;assert(peel);
 while(peel.s-b.k.s>8)game.duel.step(1/60,[HUMAN,HUMAN]);
 b.k.item='spring';b.k.roll=0;assert.equal(b.queueTurbo(),true);
 const events=[];for(let i=0;i<70;i++){game.duel.step(1/60,[HUMAN,HUMAN]);events.push(...b.takeEvents());if(!b.k.grounded)assert.equal(b.queueTurbo(),false);}
 assert(events.includes('jump')&&events.includes('land'));assert.equal(b.k.slow,0);assert(b.k.boost>0);assert(a.k.banana,'Schale liegt noch');
});
test('Windschatten baut sich hinter dem Gegner auf und gibt beim Ausscheren Schub',()=>{
 const game=running(10),[a,b]=game.duel.racers;
 a.k.s=b.k.s+10;a.k.lat=b.k.lat;run(game,.6);assert(b.k.draft>.3&&b.k.draft<1);assert.equal(a.k.draft,0);
 run(game,1.2);assert(b.k.v>a.k.v+.5,'schneller im Windschatten');
 b.k.draft=1;a.k.s=b.k.s+10;run(game,.5,[HUMAN,{steer:1,turbo:false}]);
 assert.equal(b.stats.drafts,1);assert(b.k.boost>0);
});
test('Robo weicht der Krabbe aus und hebt den Schild für die Rakete auf',()=>{
 const game=running(11),[a,b]=game.duel.racers;
 use(game,0,'crab');
 while(b.k.crab)game.duel.step(1/60,[HUMAN,null]);
 assert.notEqual(b.k.lastHit,'crab');
 b.k.item='shield';b.k.roll=0;run(game,1,[HUMAN,null]);assert.equal(b.k.item,'shield');
 a.k.s=b.k.s-40;a.k.item='rocket';a.k.roll=0;a.queueTurbo();run(game,6,[HUMAN,null]);
 assert.equal(b.stats.itemUses.shield,1);
});

// ───── Zwei Geräte über eine langsame, ungleichmäßige Verbindung ─────
function online({seed=1,latency=.25,jitter=.15,sendEvery=.12,frames=[60,50],script=()=>null,until=()=>false,maxSeconds=200,startDelay=[0,.3]}){
 const sides=[0,1].map(i=>({...make(seed+i*17),me:i,inbox:[],peer:null,busy:0,next:0,grid:null,started:false,log:[]}));
 const noise=random(seed*31+5);let wall=0;const dt=1/600,accum=[0,0];
 while(wall<maxSeconds){
  wall+=dt;
  for(const side of sides){
   const i=side.me;
   for(const m of side.inbox.filter(m=>m.at<=wall)){if(!side.peer||m.n>side.peer.n)side.peer=m;}
   side.inbox=side.inbox.filter(m=>m.at>wall);
   accum[i]+=dt;const frame=1/frames[i];if(accum[i]<frame)continue;accum[i]-=frame;
   if(!side.started){if(wall<startDelay[i])continue;side.duel.begin();side.started=true;}
   const act=script(side,wall)||HUMAN,inputs=[null,null];
   inputs[i]=act;inputs[1-i]={ghost:side.peer?.kart||null};
   side.grid=side.duel.step(frame,inputs);
   side.log.push({wall,mine:side.grid[i],ghost:side.grid[1-i]});
   // Wie in der App: ein Schreibvorgang nach dem anderen, immer nur der neueste Stand.
   if(wall>=side.next&&wall>=side.busy){
    const delay=latency+noise()*jitter;side.busy=wall+delay*.5;side.next=wall+sendEvery;
    sides[1-i].inbox.push({at:wall+delay,n:(side.n=(side.n||0)+1),kart:kartWireOf(side.grid[i])});
   }
  }
  if(sides.every(s=>s.grid)&&until(sides,wall))break;
 }
 return {sides,wall};
}
const kartWireOf=k=>make().kartWire(k);

test('zu zweit: das eigene Kart reagiert sofort, das andere fährt ruckelfrei und nah an der Wahrheit mit',()=>{
 const steerAt=(side,wall)=>({steer:Math.sin(wall*1.3+side.me*2)*.8,turbo:false});
 const {sides}=online({seed:21,script:steerAt,maxSeconds:40});
 for(const side of sides){
  const other=sides[1-side.me];let worst=0,backwards=0,stall=0,surge=0,samples=0,previous=null,sum=0;
  for(const entry of side.log){
   if(!entry.ghost||entry.ghost.phase!=='running'||entry.mine.phase!=='running')continue;
   // Wahrheit: wo das andere Gerät sein Kart zu derselben Rennzeit hatte.
   const truth=other.log.find(e=>e.mine.time>=entry.mine.time);if(!truth)break;
   const error=Math.abs(entry.ghost.s-truth.mine.s);worst=Math.max(worst,error);sum+=error;samples++;
   if(previous){
    const step=entry.ghost.s-previous.ghost.s,expected=entry.ghost.v*(entry.wall-previous.wall);
    if(step<-.01)backwards++;if(step<expected*.35)stall++;if(step>expected*2.2+.3)surge++;
   }
   previous=entry;
  }
  assert(samples>1200,'genug Messpunkte: '+samples);
  assert.equal(backwards,0,'fährt nie rückwärts');
  assert(stall<samples*.01,'bleibt nicht stehen: '+stall+' von '+samples);
  assert(surge<samples*.01,'springt nicht: '+surge+' von '+samples);
  assert(sum/samples<2.5,'mittlere Abweichung '+(sum/samples).toFixed(2)+' m');assert(worst<12,'größte Abweichung '+worst.toFixed(2)+' m');
  // Eigene Lenkung wirkt im selben Bild: nach 0,3 s Volleinschlag ist das Kart deutlich versetzt.
 }
 const probe=make(22);probe.duel.begin();for(let i=0;i<240;i++)probe.duel.step(1/60,[HUMAN,{ghost:null}]);
 const lat=probe.duel.racers[0].k.lat;for(let i=0;i<18;i++)probe.duel.step(1/60,[{steer:1,turbo:false},{ghost:null}]);
 assert(probe.duel.racers[0].k.lat>lat+1.2);
});
test('zu zweit: jeder Angriff wirkt genau einmal und beide Geräte sehen dasselbe Ergebnis',()=>{
 for(const item of ['rocket','banana','wave','gulls','ice','gust','crab']){
  let fired=false;
  const script=(side,wall)=>{
   const r=side.duel.racers[side.me];
   if(r.phase!=='running')return null;
   if(side.me===0&&!side.setup){side.setup=true;r.k.s+=item==='banana'?25:-20;if(item==='banana')r.k.lat=2;}
   // Erst nach der Rampe bei 128 m: in der Luft fliegt man über Krabbe und Schale hinweg.
   if(side.me===0&&!fired&&wall>10){fired=true;r.k.item=item;r.k.roll=0;r.queueTurbo();}
   if(side.me===1&&item==='crab'&&r.k.crab)return {steer:Math.max(-1,Math.min(1,(r.k.crab.lat-r.k.lat)*1.5)),turbo:false};
   return null;
  };
  const {sides}=online({seed:30,script,maxSeconds:18});
  const [attacker,victim]=sides,v=victim.duel.racers[1],seen=attacker.grid[1];
  assert.equal(v.stats.hits,1,item+' trifft einmal');assert.equal(v.k.lastHit,item);
  assert.equal(seen.lastHit,item,item+': der Angreifer sieht den Treffer');assert.equal(seen.stats.hits,1);
  assert.equal(attacker.duel.racers[0].k.banana,null,item+': Schale geräumt');assert.equal(attacker.duel.racers[0].k.rocket,null,item+': Rakete geräumt');
  assert.equal(attacker.duel.racers[0].stats.hits,0);
 }
});
test('zu zweit: Rakete gegen Schild wird auf beiden Geräten als abgewehrt gezeigt',()=>{
 let fired=false;
 const script=(side,wall)=>{
  const r=side.duel.racers[side.me];if(r.phase!=='running')return null;
  if(side.me===1&&!side.setup){side.setup=true;r.k.shield=30;}
  if(side.me===0&&!fired&&wall>6){fired=true;r.k.item='rocket';r.k.roll=0;r.queueTurbo();}
  return null;
 };
 const {sides}=online({seed:33,script,maxSeconds:12});
 const v=sides[1].duel.racers[1];assert.equal(v.stats.hits,0);assert.equal(v.k.shield,0);assert.equal(v.k.impact.blocked,true);
 assert.equal(sides[0].grid[1].impact.blocked,true);assert.equal(sides[0].duel.racers[0].k.rocket,null);
});
test('zu zweit: beide Geräte kommen auf dieselben Zielzeiten, auch bei ungleichem Start und Bildrate',()=>{
 const {sides,wall}=online({seed:40,frames:[60,30],startDelay:[0,.45],maxSeconds:260,
  script:(side,w)=>({steer:Math.sin(w*.7+side.me)*.5,turbo:Math.floor(w*2)%7===0}),
  until:s=>s.every(side=>side.grid.every(k=>k&&k.phase==='finished'))});
 assert(wall<200,'Rennen endet');
 const times=sides.map(side=>side.grid.map(k=>Math.round(k.time*1e4)/1e4));
 assert.deepEqual(times[0],times[1]);assert(times[0].every(t=>t>100&&t<180));
});
test('zu zweit: ein verstummtes Gerät fährt als Geist weiter, Robo übernimmt nahtlos und gibt wieder ab',()=>{
 const a=make(50),b=make(51);a.duel.begin();b.duel.begin();
 let wire=null,gridA,gridB;
 for(let i=0;i<600;i++){gridB=b.duel.step(1/60,[{ghost:null},HUMAN]);wire=kartWireOf(gridB[1]);gridA=a.duel.step(1/60,[HUMAN,{ghost:wire}]);}
 const before=gridA[1].s;
 // 4 s Funkstille: der Geist rollt mit Reisetempo weiter.
 for(let i=0;i<240;i++)gridA=a.duel.step(1/60,[HUMAN,{ghost:wire}]);
 assert(gridA[1].s>before+4*30&&gridA[1].s<before+4*40);
 // Robo übernimmt genau dort, wo der Geist gerade ist.
 const shown=gridA[1];a.duel.restore(1,shown);gridA=a.duel.step(1/60,[HUMAN,null]);
 assert(Math.abs(gridA[1].s-shown.s)<1.5);assert.equal(gridA[1].phase,'running');
 for(let i=0;i<300;i++)gridA=a.duel.step(1/60,[HUMAN,null]);
 // Das zurückgekehrte Gerät übernimmt Robos Stand und fährt selbst weiter.
 b.duel.restore(1,kartWireOf(gridA[1]));gridB=b.duel.step(1/60,[{ghost:kartWireOf(gridA[0])},HUMAN]);
 assert(Math.abs(gridB[1].s-gridA[1].s)<1.5);assert.equal(gridB[1].stats.boxes,gridA[1].stats.boxes);
});
