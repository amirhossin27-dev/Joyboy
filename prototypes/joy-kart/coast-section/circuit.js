// Periodic, arc-length sampled centre lines. One unit of race progress is one road metre.
function createKartCircuit(second=false){
 const lapLength=second?1728:1664, laps=3, tau=2*Math.PI, samples=2048;
 const path=[], distances=[0];
 for(let i=0;i<=samples;i++){
  const t=tau*i/samples;
  const radius=second?1+.18*Math.cos(3*t)+.09*Math.cos(5*t):1+.12*Math.cos(2*t)-.08*Math.cos(3*t);
  const x=-Math.cos(t)*radius, z=-Math.sin(t)*radius*(second?.86:.75);
  if(i)distances.push(distances[i-1]+Math.hypot(x-path[i-1].x,z-path[i-1].z));
  path.push({x,z});
 }
 const scale=lapLength/distances[samples], frames=[];let edge=1;
 for(let m=0;m<lapLength;m++){
  const d=m/scale;while(distances[edge]<d)edge++;
  const a=path[edge-1],b=path[edge],u=(d-distances[edge-1])/(distances[edge]-distances[edge-1]);
  frames.push({x:(a.x+(b.x-a.x)*u)*scale,z:(a.z+(b.z-a.z)*u)*scale});
 }
 const wrap=s=>((s%lapLength)+lapLength)%lapLength;
 function frame(s){
  const m=wrap(s),i=Math.floor(m),f=m-i,a=frames[i],b=frames[(i+1)%lapLength],prev=frames[(i+lapLength-1)%lapLength],next=frames[(i+2)%lapLength];
  const dx=(1-f)*(b.x-prev.x)+f*(next.x-a.x),dz=(1-f)*(b.z-prev.z)+f*(next.z-a.z),len=Math.hypot(dx,dz);
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,nx:-dz/len,nz:dx/len,angle:Math.atan2(dx,dz),scale:1};
 }
 const height=s=>6+(second?4:2.4)*Math.sin(tau*s/lapLength)**2+1.7*Math.sin(2*tau*s/lapLength);
 function point(s,lat=0){const f=frame(s);return{x:f.x+lat*f.nx,y:height(s),z:f.z+lat*f.nz,angle:f.angle};}
 const boxes=Array.from({length:10},(_,i)=>Math.round((i+.40)*lapLength/10));
 const lanes=i=>i%3===0?[-3.4,3.4]:i%3===1?[-2,1]:[0,3.4];
 // A boost and a ramp form a line; the rest of the road stays open.
 const features=[];
 const lines=second?[[100,-2.4],[610,2.6],[1230,-2.6]]:[[90,-2.4],[540,2.6],[1100,-2.6]];
 for(const [start,lat] of lines){
  features.push({type:'boost',start,lat,length:15,width:3.2,height:0},
                {type:'ramp',start:start+38,lat,length:13,width:3.2,height:1.8});
 }
 // Two slaloms alternate lanes. At top speed each change allows over a second.
 const gates=(second?[[245,1],[865,-1]]:[[205,-1],[805,1]]).flatMap(([start,side])=>
  [side,-side,side].map((direction,index)=>({s:start+index*60,lat:direction*2.55,halfWidth:1.75,index})));
 // Painted dashes trace the approach to the opening, including the lane change.
 const gateMarks=gates.flatMap((gate,i)=>[32,24,16,8].map(distance=>{
  const from=gate.index?gates[i-1].lat:gate.lat;
  return {s:gate.s-distance,lat:gate.lat+(from-gate.lat)*distance/60};
 }));
 // Jede Kiste würfelt. Wer zurückliegt, zieht eher Aufholhilfen; dasselbe Item kommt selten zweimal.
 function rollItem(gap=0,rng=Math.random,last=null){
  const trailing=Math.max(0,Math.min(1,.5+(Number.isFinite(gap)?gap:0)/120));
  const odds=Object.entries(KART_ITEM_ODDS).map(([item,[lead,chase]])=>[item,(lead+(chase-lead)*trailing)*(item===last?.15:1)]);
  let pick=rng()*odds.reduce((sum,[,weight])=>sum+weight,0);
  for(const [item,weight] of odds){pick-=weight;if(pick<0)return item;}
  return odds[0][0];
 }
 return {cape:second,name:second?'Kap der Winde':'Sonnenbucht',lapLength,laps,length:laps*lapLength,features,gates,gateMarks,frame,point,height,boxes,lanes,halfWidth:6,centreBound:4.5,wrap,rollItem};
}
const KART_ITEMS={turbo:'Turbo',shield:'Schild',magnet:'Magnet',wave:'Welle',banana:'Bananenschale',rocket:'Zielrakete',gulls:'Möwenschwarm',gust:'Windstoß',crab:'Krabbe',spring:'Sprungfeder',ice:'Glatteis',sun:'Sonnenkraft'};
// Gewichte je Item: [in Führung, im Rückstand]. Dazwischen wird nach Abstand gemischt.
const KART_ITEM_ODDS={turbo:[3,3],shield:[3,1.5],banana:[3,1],magnet:[2,1.5],spring:[2,2],crab:[1.5,2.5],wave:[1,2],gust:[1.5,2.5],ice:[1.2,2.5],gulls:[1.5,2.5],rocket:[.5,3],sun:[.3,2.5]};
const KART_HIT_NAMES={banana:'Bananenschale',rocket:'Zielrakete',wave:'Welle',crab:'Krabbe',gulls:'Möwenschwarm',gust:'Windstoß',ice:'Glatteis'};
function roboPace(gap){
 // Give a leading player a close chase and leave a passing opportunity when Robo leads.
 return .91+.075*Math.max(0,Math.min(1,gap/45));
}
/**
 * Auswertung auf dem Gerät des getroffenen Karts: `victim` ist ein eigenes SimpleRace, `rival` der
 * letzte bekannte Stand des anderen Karts (lokal oder aus dem Netz). Jede Angriffsnummer wirkt einmal.
 */
function kartReceive(victim,rival){
 if(!rival||victim.phase!=='running')return;
 const k=victim.k,length=victim.courseLength,seen=id=>k.done.includes(id),mark=id=>{k.done=[...k.done.slice(-9),id];};
 const arc=(a,b)=>((a-b)%length+1.5*length)%length-length*.5;
 const peel=rival.banana;
 if(peel&&!seen(peel.id)){
  const start=victim.stepStart??k.s,crossing=peel.s+Math.ceil((start-peel.s)/length)*length;
  if((k.lift||0)<.6&&k.s>=crossing&&Math.abs(k.lat-peel.lat)<1.25){victim.hit('banana',2.5);mark(peel.id);}
 }
 if(rival.rocket&&!seen(rival.rocket.id)&&k.incoming?.id!==rival.rocket.id)k.incoming={id:rival.rocket.id,s:rival.rocket.s,lat:rival.rocket.lat};
 if(k.incoming){
  // Die Rakete folgt dem kürzeren Weg, auch über die Ziellinie.
  const rocket=k.incoming,dt=Math.max(0,victim.time-(victim.stepTime??victim.time)),delta=arc(k.s,rocket.s),reach=92*dt;
  if(Math.abs(delta)<=reach+1){victim.hit('rocket',1.8);mark(rocket.id);k.incoming=null;}
  else k.incoming={id:rocket.id,s:rocket.s+Math.sign(delta)*reach,lat:rocket.lat+(k.lat-rocket.lat)*(1-Math.exp(-5*dt))};
 }
 const cast=rival.cast;
 if(cast&&!seen(cast.id)){
  mark(cast.id);
  const gap=Math.abs(arc(k.s,rival.s??k.s));
  if(cast.type==='wave'){if(gap<=85)victim.hit('wave',2.2);}
  else if(cast.type==='gulls')victim.hit('gulls',0,q=>{q.gulls=4.5;});
  else if(cast.type==='ice')victim.hit('ice',0,q=>{q.ice=5;});
  else if(cast.type==='gust')victim.hit('gust',0,q=>{q.gust=1.2;q.gustDir=q.lat>(rival.lat??0)?1:q.lat<(rival.lat??0)?-1:q.lat>=0?-1:1;});
  // Die Krabbe kriecht ein Stück voraus auf die Straße; Ausweichen ist möglich.
  else if(cast.type==='crab'&&k.s+60<victim.totalLength)k.crab={id:cast.id,s:k.s+60,time:victim.time,lat:0};
 }
}
/** Eigene Bananenschale und Rakete räumen, sobald der Gegner sie gemeldet hat. Die Rakete fliegt sichtbar mit. */
function kartOwnHazards(owner,rival,dt){
 const k=owner.k,length=owner.courseLength,taken=id=>!!rival?.done?.includes(id);
 if(k.banana&&(taken(k.banana.id)||k.s-k.banana.s>length))k.banana=null;
 if(k.rocket){
  const rocket=k.rocket;
  if(!rival||rival.phase!=='running'||taken(rocket.id)||(rocket.wait||0)>1.5)k.rocket=null;
  else{
   const delta=((rival.s-rocket.s)%length+1.5*length)%length-length*.5,reach=92*dt;
   k.rocket=Math.abs(delta)<=reach+1?{...rocket,s:rival.s,lat:rival.lat,wait:(rocket.wait||0)+dt}
    :{...rocket,s:rocket.s+Math.sign(delta)*reach,lat:rocket.lat+(rival.lat-rocket.lat)*(1-Math.exp(-5*dt))};
  }
 }
}
const kartRivalState=r=>({...r.k,phase:r.phase,time:r.time});
/** Zwei Karts auf demselben Gerät (gegen Robo, LAN-Server): beide Richtungen in einem Schritt. */
function resolveKartWaves(racers){
 const states=racers.map(kartRivalState);
 for(let i=0;i<2;i++)kartReceive(racers[i],states[1-i]);
 for(let i=0;i<2;i++)kartOwnHazards(racers[i],kartRivalState(racers[1-i]),Math.max(0,racers[i].time-(racers[i].stepTime??racers[i].time)));
}

// Presentation only: never change the authoritative speed, lane or item timers.
function kartImpact(k){
 const age=k?.impact?k.time-k.impact.time:Infinity;
 return {age,burst:k?.phase==='running'&&age>=0&&age<.7?1-age/.7:0,
  blocked:!!k?.impact?.blocked,slip:Number.isFinite(age)&&age>=0&&k?.phase==='running'&&k.slow>0&&(k.lastHit==='banana'||k.lastHit==='crab')};
}
function kartThreat(k,other,course){
 if(k?.phase!=='running')return null;
 const gap=s=>course.wrap(s-k.s+course.lapLength/2)-course.lapLength/2;
 const rocket=k.incoming||(other?.rocket&&!k.done?.includes(other.rocket.id)?other.rocket:null);
 if(rocket){const d=gap(rocket.s);if(Math.abs(d)<100)return {kind:'rocket',distance:Math.abs(d),behind:d<0};}
 if(k.crab){const d=k.crab.s-k.s;if(d>=0&&d<70)return {kind:'crab',distance:d,lat:k.crab.lat};}
 if(other?.banana&&!k.done?.includes(other.banana.id)){const d=gap(other.banana.s);if(d>=0&&d<34&&Math.abs(k.lat-other.banana.lat)<1.8&&(k.lift||0)<.6)return {kind:'banana',distance:d};}
 return null;
}
/** Windschatten: dicht hinter dem anderen Kart in derselben Spur baut sich ein Tempobonus auf. */
function kartDraft(k,rival,length,dt,draft=0){
 if(!rival||rival.phase!=='running')return 0;
 const gap=((rival.s-k.s)%length+1.5*length)%length-length*.5;
 const inside=gap>3&&gap<24&&Math.abs(rival.lat-k.lat)<1.5&&(k.lift||0)<.3;
 return Math.max(0,Math.min(1,draft+(inside?dt/1.2:-dt/.5)));
}
