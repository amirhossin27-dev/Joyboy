/**
 * Zwei Karts in einem Rennen. Jedes Gerät rechnet nur die Karts, die es selbst fährt (das eigene,
 * dazu Robo). Ein Kart von einem anderen Gerät ist ein „Geist“: Sein letzter gemeldeter Stand wird
 * auf die eigene Rennuhr vorgerechnet und weich nachgeführt, damit es ohne Ruckeln mitfährt.
 */
function createKartDuel(M,course,rng=Math.random){
 const racers=[new M.SimpleRace(),new M.SimpleRace()],ghosts=[null,null],plans=[{},{}],remote=[false,false];
 const TIMERS=['boost','shield','magnet','slow','blocked','waveFlash','roll','ice','gulls','sun','gust'];
 let clock=0;
 const lapGap=d=>course.wrap(d+course.lapLength/2)-course.lapLength/2;
 const state=i=>remote[i]?ghosts[i]?.view||null:kartRivalState(racers[i]);
 function begin(countdown){
  racers.forEach((r,i)=>{r.begin();r.k.lat=i?2:-2;if(Number.isFinite(countdown))r.countdown=M.clamp(countdown,.05,3.5);plans[i]={start:rng()<.35};});
  ghosts.fill(null);remote.fill(false);clock=0;
 }
 /** Einen gemeldeten oder gespeicherten Stand als eigenes Kart übernehmen. */
 function restore(i,saved){
  const r=racers[i];r.reset();
  for(const key of Object.keys(r.k))if(saved[key]!==undefined)r.k[key]=saved[key];
  r.phase=saved.phase;r.time=saved.time;r.countdown=saved.countdown??0;
  r.stats={...r.stats,...structuredClone(saved.stats||{})};r.taken=new Set(saved.taken||[]);
  r.k.s=Math.min(course.length,r.k.s);r.k.y=course.height(r.k.s)+(r.k.lift||0);
  ghosts[i]=null;plans[i]={};
 }
 function track(i,raw,dt){
  if(!raw){ghosts[i]=null;return;}
  const running=raw.phase==='running',ahead=running?M.clamp(clock-raw.time,-.25,600):0;
  // Tempo wie in der Fahrphysik vorrechnen (Anfahren, laufender Turbo, Bremsung); wer länger stumm ist, rollt mit Reisetempo weiter.
  let targetS=raw.s,speed=raw.v||0;
  if(running&&ahead<0)targetS+=speed*ahead;
  else if(running){
   let boost=raw.boost||0,slow=raw.slow||0;const near=Math.min(ahead,1.5);
   for(let t=0;t<near;){
    const h=Math.min(1/30,near-t),top=(boost>0?M.SPEED.turbo:M.SPEED.cruise)*(slow>0?.65:1)*(raw.sun>0?1.12:1);
    speed+=(top-speed)*(1-Math.exp(-h*(boost>0?M.SPEED.turboAcceleration:M.SPEED.acceleration)));targetS+=speed*h;boost-=h;slow-=h;t+=h;
   }
   if(ahead>near){speed=M.SPEED.cruise;targetS+=speed*(ahead-near);}
   targetS=Math.min(course.length,targetS);
  }
  const targetLat=M.clamp(raw.lat+(raw.latV||0)*M.clamp(ahead,-.1,.2),-course.centreBound,course.centreBound);
  let g=ghosts[i];
  if(!g||g.phase!==raw.phase||Math.abs(targetS-g.s)>30)g=ghosts[i]={s:targetS,lat:targetLat,phase:raw.phase};
  else if(running){
   g.s=Math.min(course.length,g.s+speed*dt);g.s+=(targetS-g.s)*(1-Math.exp(-dt*5));
   g.lat+=(targetLat-g.lat)*(1-Math.exp(-dt*9));
  }else{g.s=targetS;g.lat=targetLat;}
  const view={...raw,s:g.s,lat:g.lat,time:raw.time+ahead,lap:Math.min(course.laps,Math.floor(g.s/course.lapLength)+1),
   lapLength:course.lapLength,totalLaps:course.laps,v:speed,speedKmh:Math.round(speed*3.6),stats:raw.stats||{itemUses:{}},done:raw.done||[]};
  for(const key of TIMERS)if(raw[key]>0)view[key]=Math.max(0,raw[key]-ahead);
  g.view=view;
 }
 function plan(i,r){
  const k=r.k,p=plans[i],key=k.item+':'+r.stats.boxes;
  if(p.key!==key){p.key=key;p.at=r.time+(r.stats.boxes?.8:3)+rng()*3.5;}
  return p;
 }
 /** Robo: fährt die Kisten und die zweite Torfolge an, weicht aus und setzt Items mit etwas Bedenkzeit ein. */
 function drive(i,dt,rival){
  const r=racers[i],k=r.k;
  if(r.phase==='countdown'&&plans[i].start&&r.countdown<=.3)r.queueTurbo();
  const distance=course.wrap(k.s),row=course.boxes.findIndex(mark=>mark>distance),lanes=course.lanes(Math.max(0,row));
  const gate=course.gates.find(g=>g.s>=course.gates[3].s&&g.s>distance);
  let target=gate&&gate.s-distance<55?gate.lat:lanes[lanes.length-1];
  const peel=rival?.banana&&!k.done.includes(rival.banana.id)?rival.banana:null,peelGap=peel?lapGap(peel.s-k.s):Infinity;
  if(peelGap>0&&peelGap<26&&Math.abs(peel.lat-target)<1.7)target=peel.lat>0?peel.lat-3.2:peel.lat+3.2;
  if(k.crab&&k.crab.s-k.s<34)target=k.crab.lat>0?-3.4:3.4;
  let steer=M.clamp((target-k.lat)*.75,-1,1);
  if(k.gulls>0)steer=M.clamp(steer+.8*Math.sin(r.time*5),-1,1);
  if(r.phase==='running'&&k.item&&!(k.roll>0)){
   const p=plan(i,r),late=r.time-p.at,gap=rival&&rival.phase==='running'?rival.s-k.s:Infinity;
   const ready=late>=0&&(
    k.item==='shield'?!!k.incoming||k.slow>0||late>6:
    k.item==='wave'?Math.abs(gap)<=80||late>8:
    k.item==='banana'?(gap<0&&gap>-80)||late>6:
    k.item==='spring'?(peelGap>0&&peelGap<12)||(k.crab&&k.crab.s-k.s<12)||late>4:true);
   if(ready)r.queueTurbo();
  }
  r.advance(dt,steer,roboPace(rival?rival.s-k.s:0)*(k.gulls>0?.95:1));
 }
 /**
  * Einen Schritt rechnen. Je Platz: {steer,turbo} = hier gelenkt, null = Robo, {ghost:Stand|null} = anderes Gerät.
  * Liefert je Platz den Stand zum Anzeigen (null, solange von einem anderen Gerät noch nichts da ist).
  */
 function step(dt,inputs){
  for(let i=0;i<2;i++){remote[i]=!!inputs[i]&&'ghost' in inputs[i];if(remote[i])track(i,inputs[i].ghost,dt);else ghosts[i]=null;}
  for(let i=0;i<2;i++){
   if(remote[i])continue;
   const r=racers[i],rival=state(1-i),racing=rival&&rival.phase==='running';
   r.rivalGap=racing?rival.s-r.k.s:0;
   if(r.phase==='running'){
    const before=r.k.draft,draft=kartDraft(r.k,rival,r.courseLength,dt,before);
    // Aus vollem Windschatten ausscheren gibt einen kurzen Schub.
    if(before>=1&&draft<1){r.k.boost=Math.max(r.k.boost,.7);r.stats.drafts++;r.k.draft=0;r.events.push('draft');}else r.k.draft=draft;
   }
   if(inputs[i]===null)drive(i,dt,rival);
   else{if(inputs[i].turbo)r.queueTurbo();r.advance(dt,inputs[i].steer);}
  }
  for(let i=0;i<2;i++)if(!remote[i])kartReceive(racers[i],state(1-i));
  for(let i=0;i<2;i++)if(!remote[i]){const r=racers[i];kartOwnHazards(r,state(1-i),Math.max(0,r.time-(r.stepTime??r.time)));}
  const own=racers[remote[0]?1:0];
  if(own.phase==='running')clock=own.time;else if(own.phase==='finished')clock+=Math.min(dt,.25);
  return [0,1].map(i=>{
   const rival=remote[1-i]?null:racers[1-i].k;
   let shown;
   if(remote[i]){
    if(!ghosts[i])return null;
    shown={...ghosts[i].view};
    // Raketen des anderen Geräts zeigt dieses Gerät dort, wo es sie selbst auswertet.
    if(rival&&shown.rocket)shown.rocket=rival.incoming?.id===shown.rocket.id?rival.incoming:null;
   }else{
    shown={...racers[i].snapshot(),taken:[...racers[i].taken]};
    if(rival&&shown.rocket&&rival.incoming?.id===shown.rocket.id)shown.rocket=rival.incoming;
   }
   return shown;
  });
 }
 return {racers,begin,restore,step,state,get clock(){return clock;}};
}
/** Kart-Stand fürs Netz: nur was das andere Gerät braucht, Zahlen gekürzt. */
function kartWire(k){
 const skip=new Set(['position','progress','speedKmh','lapLength','totalLaps','assistedSteering','y','route','routeProof','lap']);
 return JSON.parse(JSON.stringify(k,(key,value)=>skip.has(key)?undefined:typeof value==='number'?Math.round(value*1e4)/1e4:value));
}
