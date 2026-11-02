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
 const materials=['rocket','shield','banana','turbo','rocket','banana','turbo','shield','banana','turbo'];
 return {cape:second,name:second?'Kap der Winde':'Sonnenbucht',lapLength,laps,length:laps*lapLength,features,frame,point,height,boxes,lanes,halfWidth:6,centreBound:4.5,wrap,
  pickupType:(row,lap)=>materials[(row+lap+(second?1:0))%materials.length]};
}
const KART_ITEMS={turbo:'Turbo',shield:'Schild',magnet:'Magnet',wave:'Welle',banana:'Bananenschale',rocket:'Zielrakete'};
function roboPace(gap){
 // Give a leading player a close chase and leave a passing opportunity when Robo leads.
 return .91+.075*Math.max(0,Math.min(1,gap/45));
}
function resolveKartWaves(racers,previous){
 function hit(target,item,seconds){
  if(target.shield>0){target.shield=0;target.blocked=1.2;return;}
  target.lastHit=item;target.slow=Math.max(target.slow,seconds);
 }
 for(let i=0;i<2;i++){
  const source=racers[i],opponent=racers[1-i],owner=source.k,target=opponent.k;
  if(opponent.phase!=='running')continue;
  const length=source.courseLength;
  if((source.stats.itemUses.wave||0)>previous[i]){
   const gap=Math.abs(owner.s-target.s)%length;
   if(Math.min(gap,length-gap)<=85)hit(target,'wave',2.2);
  }
  if(owner.banana){
   const peel=owner.banana,start=opponent.stepStart??target.s;
   const crossing=peel.s+Math.ceil((start-peel.s)/length)*length;
   if((target.lift||0)<.6 && target.s>=crossing && Math.abs(target.lat-peel.lat)<1.25){
    hit(target,'banana',2.5);owner.banana=null;
   }else if(owner.s-peel.s>length)owner.banana=null;
  }
  if(owner.rocket){
   const rocket=owner.rocket,dt=opponent.time-(opponent.stepTime??opponent.time);
   // Home along the shortest road arc, including across the start line.
   const delta=((target.s-rocket.s)%length+1.5*length)%length-length*.5;
   const reach=92*dt;
   if(Math.abs(delta)<=reach+1){hit(target,'rocket',1.8);owner.rocket=null;}
   else owner.rocket={s:rocket.s+Math.sign(delta)*reach,lat:rocket.lat+(target.lat-rocket.lat)*(1-Math.exp(-5*dt))};
  }
 }
}
