const labels=['Fuchs','Panda'];
let packet=null, received=0, token=sessionStorage.getItem(new URL('.',location.href).pathname)||'', pendingBoost=false, pendingReady=false, offline='', joined=false;
const startButton=find('[data-action="start"]');
const solo=typeof computerMode!=='undefined' && computerMode;
const rearButton=find('[data-action="rear"]'),finishNote=find('.js-finish-note'),lobbyOverlay=find('.js-overlay');
let rearPointer=null,rearKey=false,rearToggle=false,presentationRound,resultsAt=null;
const finishStarts=[null,null];
function lookingBack(){return rearPointer!==null || rearKey || rearToggle;}
function syncRear(){rearButton.setAttribute('aria-pressed',String(lookingBack()));}
function releaseRear(){rearPointer=null;rearKey=false;rearToggle=false;syncRear();}
function renderPacket(now){
 if(!packet){
  if(!rearButton.hidden)rearButton.hidden=true;
  if(!finishNote.hidden)finishNote.hidden=true;
  if(lookingBack())releaseRear();
  return null;
 }
 const {me,other,round,slot}=packet;
 if(round!==presentationRound){presentationRound=round;finishStarts.fill(null);resultsAt=null;releaseRear();}
 const finished=me.phase==='finished',both=finished&&other?.phase==='finished';
 const available=(me.phase==='running'||finished)&&!offline&&!both;
 const hideRear=!available;
 if(rearButton.hidden!==hideRear)rearButton.hidden=hideRear;
 if(!available&&lookingBack())releaseRear();
 const hideFinish=!finished||!lobbyOverlay.hidden;
 if(finishNote.hidden!==hideFinish)finishNote.hidden=hideFinish;
 if(!finishNote.hidden){
  const label='Im Ziel · '+me.time.toFixed(2).replace('.',',')+' s · '+(both?'Ausrollen':'Zweiter Fahrer unterwegs');
  if(finishNote.textContent!==label)finishNote.textContent=label;
 }
 function coast(k,i,opponent){
  if(k?.phase!=='finished'){finishStarts[i]=null;return k;}
  // Only the renderer travels past the timing line. A restored race can join mid-roll.
  finishStarts[i]??=now-1000*Math.max(0,(opponent?.time??k.time)-k.time);
  const t=Math.max(0,(Math.min(now,resultsAt??Infinity)-finishStarts[i])/1000);
  const cruise=8,decay=Math.exp(-t/1.45),v=cruise+(k.v-cruise)*decay;
  return {...k,s:k.s+cruise*t+(k.v-cruise)*1.45*(1-decay),v,speedKmh:Math.round(v*3.6),
   time:k.time+t,latV:0,steer:0,boost:0,slow:0,lift:0,grounded:true};
 }
 return {...packet,me:coast(me,slot,other),other:coast(other,1-slot,me)};
}
function requestBoost(){if(solo){race.queueTurbo();return;}if(packet?.me.phase==='running'&&packet.me.item)pendingBoost=true;}
function refreshLobby(){
 const phase=packet?.me.phase||'ready',finished=phase==='finished',both=finished&&packet.other?.phase==='finished';
 if(!both)resultsAt=null;
 else if(resultsAt===null){resultsAt=performance.now()+1200;setTimeout(refreshLobby,1210);}
 const overlay=!!offline||phase==='ready'||(both&&performance.now()>=resultsAt);
 find('.js-overlay').hidden=!overlay;
 find('.js-controls').hidden=overlay||phase!=='running';find('.js-speed').hidden=overlay;
 find('.js-count').hidden=phase!=='countdown';find('.js-count').textContent=Math.max(1,Math.ceil(packet?.me.countdown||0));
 let title='Sonnenküsten-Duell',copy='Dasselbe Spiel auf beiden Geräten öffnen. Beide tippen auf Bereit.';
 if(packet){title=labels[packet.slot]+' · Startplatz '+(packet.slot+1);copy=packet.other?'Beide Fahrer sind da. Bereit für den Start?':'Öffnet diesen Link auch auf dem zweiten Gerät im selben WLAN.';}
 if(packet?.ready)copy='Du bist bereit. Warte auf den zweiten Fahrer …';
 if(finished){
  const other=packet.other;
  title='Im Ziel';
  copy='Deine Zeit '+packet.me.time.toFixed(2)+' s · Warte auf den Zieleinlauf.';
  if(other?.phase==='finished'){
   const delta=packet.me.time-other.time;
   title=Math.abs(delta)<.001?'Zeitgleich!':delta<0?'Du gewinnst!':labels[1-packet.slot]+' gewinnt!';
   copy=labels[packet.slot]+' '+packet.me.time.toFixed(2)+' s · '+labels[1-packet.slot]+' '+other.time.toFixed(2)+' s';
   if(packet.me.stats.lapEnds?.[3]){
    const ends=packet.me.stats.lapEnds,laps=[1,2,3].map(n=>ends[n]-(n===1?0:ends[n-1])).filter(t=>Number.isFinite(t)&&t>0);
    if(laps.length)copy+=' · Beste Runde '+Math.min(...laps).toFixed(2).replace('.',',')+' s · '+(packet.me.stats.lines||0)+'/6 Bonuslinien';
   }
   if(packet.ready)copy+=' · Revanche angefragt';
  }
 }
 if(solo&&!finished){title=course.name+' · 3 Runden';copy='Links ziehen oder A/D drücken. Rechts tippen oder E für dein Item. Drei mintgrüne Tore hintereinander geben Extraschub.';}
 if(offline){title='Verbindung';copy=offline;}
 find('h2').textContent=title;find('p').textContent=copy;
 startButton.textContent=!joined?'Beitreten':finished?'Revanche':'Bereit';
 if(solo){startButton.textContent=finished?'Revanche':'Gegen Computer starten';startButton.disabled=finished&&packet.other.phase!=='finished';return;}
 startButton.disabled=joined&&(!packet||!!offline||packet.ready||(finished&&packet.other?.phase!=='finished'));
}
async function poll(){
 if(!joined||!root.isConnected)return;
 const turbo=pendingBoost;pendingBoost=false;
 try{
  const res=await fetch(new URL('state',location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:token,ready:pendingReady,steer:input(),turbo}),signal:AbortSignal.timeout(4000)});
  const data=await res.json();
  if(!res.ok){
   if(res.status===410||res.status===409){joined=false;token='';packet=null;sessionStorage.removeItem(new URL('.',location.href).pathname);}
   throw Error(data.error||'Spielserver nicht erreichbar.');
  }
  if(!packet||packet.round!==data.round||packet.me.phase!==data.me.phase)clear();
  if(packet?.me.phase==='countdown'&&data.me.phase==='running')toast('LOS!');
  if(packet&&data.round===packet.round&&data.me.stats.turboUses>packet.me.stats.turboUses)toast('Turbo!');
  if(packet&&data.me.phase==='running'&&data.me.item&&!packet.me.item)toast(KART_ITEMS[data.me.item]+' bereit');
  packet=data;received=performance.now();token=data.key;sessionStorage.setItem(new URL('.',location.href).pathname,token);pendingReady=false;offline='';
 }catch(e){offline=e.message;clear();}
 refreshLobby();if(joined)setTimeout(poll,50);
}
function bindDuel(){
 refreshLobby();startButton.onclick=()=>{if(solo){startComputerRace();return;}if(!joined){joined=true;pendingReady=false;offline='';poll();}else pendingReady=true;};
 rearButton.onpointerdown=e=>{
  if(rearPointer!==null||rearButton.hidden)return;
  e.preventDefault();rearButton.focus({preventScroll:true});rearButton.setPointerCapture(e.pointerId);rearPointer=e.pointerId;syncRear();
 };
 for(const name of ['pointerup','pointercancel','lostpointercapture'])rearButton.addEventListener(name,e=>{
  if(rearPointer===e.pointerId){rearPointer=null;syncRear();}
 });
 rearButton.onclick=e=>{if(e.detail===0){rearToggle=!rearToggle;syncRear();}};
 window.addEventListener('keydown',e=>{if(e.code==='KeyR'&&!rearButton.hidden){e.preventDefault();rearKey=true;syncRear();}});
 window.addEventListener('keyup',e=>{if(e.code==='KeyR'){rearKey=false;syncRear();}});
 window.addEventListener('blur',releaseRear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseRear();});
 const pad=find('[data-control="pad"]');
 pad.onpointerdown=e=>{if(held.size)return;e.preventDefault();pad.setPointerCapture(e.pointerId);held.set(e.pointerId,{x:e.clientX,value:0});};
 pad.onpointermove=e=>{const p=held.get(e.pointerId);if(p)p.value=clamp((e.clientX-p.x)/(pad.clientWidth*.4),-1,1);};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>held.delete(e.pointerId));
 const turbo=find('[data-action="turbo"]');turbo.onpointerdown=e=>{e.preventDefault();requestBoost();};turbo.onclick=e=>{if(!e.detail)requestBoost();};
 window.addEventListener('keydown',e=>{if(packet?.me.phase!=='running')return;if(['ArrowRight','ArrowLeft','KeyA','KeyD','KeyE'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)requestBoost();}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
}
function moveKart(model,k,time,dt){
 const p=course.point(k.s,k.lat),f=course.frame(k.s);
 model.group.position.set(p.x,p.y+.06+(k.lift||0),p.z);
 model.group.rotation.y=f.angle-Math.atan2(k.latV,Math.max(3,k.v));
 model.body.rotation.x=k.grounded?(k.lift>0?-.13:0):-Math.atan2(k.verticalSpeed||0,Math.max(12,k.v));
 model.body.rotation.z=-k.steer*.055;
 model.shieldEffect.visible=k.shield>0;
 model.itemRing.visible=k.magnet>0||k.waveFlash>0;
 if(model.itemRing.visible)model.itemRing.scale.setScalar(k.waveFlash>0?1+6*(1-k.waveFlash):1.65+.15*Math.sin(time*7));
 model.animate(k.v/M.SPEED.turbo,k.steer,k.boost>0,time);
 for(const w of model.wheels){w.spin.rotation.x+=k.v*dt/.47;if(w.front)w.pivot.rotation.y=-k.steer*.25;}
 model.shadow.position.set(p.x,p.y+.04,p.z);model.shadow.rotation.z=-model.group.rotation.y;
}
function visualState(k,dt,previous){
 const age=k.phase==='running'?Math.min(.12,(performance.now()-received)/1000):0;
 const s=k.phase==='finished'?k.s:Math.min(course.length,k.s+k.v*age),lat=clamp(k.lat+k.latV*age,-course.centreBound,course.centreBound);
 const alpha=1-Math.exp(-dt*26),snap=!previous||k.phase!=='running'||Math.abs(previous.s-s)>8;
 return {...k,s:snap?s:previous.s+(s-previous.s)*alpha,lat:snap?lat:previous.lat+(lat-previous.lat)*alpha};
}
