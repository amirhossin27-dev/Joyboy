// The two renderers share one HUD and read the authoritative race packet.
function createRaceHud(){
 const field=name=>find('.js-'+name);
 const place=field('place'),lap=field('lap'),gap=field('time'),track=field('location'),
  progress=field('progress-fill'),speed=find('.js-speed strong'),line=field('line'),
  item=find('[data-action="turbo"]'),name=field('item-name'),hint=field('item-hint'),icon=field('item-icon path');
 const icons={
  turbo:'M14 2 4 14h7l-1 8 10-13h-7z',
  shield:'M12 2 3 6v6c0 5 5 9 9 11 4-2 9-6 9-11V6z',
  rocket:'M7 14c2-6 7-10 14-11 0 7-4 13-11 15l-3-4z M8 10l-4 1-2 4 5-1 M14 17l-1 5 4-2 1-5 M5 18l-2 3',
  banana:'M12 4c2 8-4 14-10 12 2 5 9 5 12-1 2 4 5 5 8 4-5-3-7-7-7-13l-3-2z',
  empty:'M12 3 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10'
 };
 const put=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 const combat=field('combat'),combatTitle=combat.querySelector('b'),combatHint=combat.querySelector('small'),combatBar=combat.querySelector('i');
 let previous=null,announced='';
 return (packet,now,view)=>{
  if(!packet)return;
  const k=packet.me,other=packet.other,delta=other?k.s-other.s:0,tied=Math.abs(delta)<.5;
  put(track,course.name+(compact?' · Kompakt':''));put(lap,'Runde '+k.lap+' / '+course.laps);
  const bothFinished=k.phase==='finished'&&other?.phase==='finished';
  const lead=bothFinished?other.time-k.time:delta;
  const equal=bothFinished?Math.abs(lead)<.0001:tied;
  put(place,!other?'Solo':equal?'=':lead>0?'1.':'2.');
  put(gap,bothFinished?'Im Ziel':!other?'Einzelfahrt':tied?'Gleichauf':Math.round(Math.abs(delta))+' m '+(delta>0?'vorn':'zurück'));
  progress.style.transform='scaleX('+Math.min(1,k.s/course.length)+')';
  put(speed,view?.me.speedKmh??k.speedKmh);stage.style.setProperty('--js-steer',input());
  const threat=kartThreat(k,other,course);
  let kind='',title='',detail='',remaining=0;
  if(k.phase==='running'){
   if(k.blocked>0){kind='blocked';title='Schild: abgewehrt!';detail='Du fährst ungebremst weiter';remaining=k.blocked/1.2;}
   else if(k.slow>0){kind='slow';title=k.lastHit==='banana'?'Bananenschale · Schleudern!':'Raketentreffer!';detail='Gebremst · noch '+k.slow.toFixed(1).replace('.',',')+' s';remaining=k.slow/Math.max(k.slow,k.impact?.duration||2.5);}
   else if(threat){kind=threat.kind;title=kind==='rocket'?'Rakete '+(threat.behind?'von hinten!':'von vorn!'):'Bananenschale voraus!';detail=(kind==='banana'?'Spur wechseln':k.item==='shield'?'Jetzt Schild einsetzen':k.shield>0?'Dein Schild ist bereit':'Zielrakete nähert sich')+' · '+Math.ceil(threat.distance)+' m';remaining=1;}
   else if(k.shield>0){kind='shield';title='Schild aktiv';detail='Fängt einen Treffer ab';remaining=k.shield/12;}
  }
  combat.hidden=!kind;combat.dataset.kind=kind;stage.dataset.combat=kind;
  if(kind){put(combatTitle,title);put(combatHint,detail);combatBar.style.transform='scaleX('+Math.min(1,remaining)+')';}
  const announcement=kind+':'+title;
  if(kind&&announcement!==announced)put(field('live'),title);
  announced=announcement;
  if(previous && previous.round===packet.round && k.time>=previous.time && other?.impact && other.impact.time!==previous.otherImpact){
   toast(other.impact.blocked?'Gegner hat abgewehrt!':'Treffer beim Gegner!');
  }
  const key=k.item||'empty';
  if(item.dataset.item!==key){
   item.dataset.item=key;put(name,KART_ITEMS[key]||'Item');
   icon.setAttribute('d',icons[key]||icons.empty);
  }
  item.disabled=!k.item||k.phase!=='running';
  put(hint,k.item?'Einsetzen':k.shield>0?'Geschützt':k.slow>0?'Gebremst':'Box sammeln');
  const position=course.wrap(k.s),next=course.gates.find(g=>g.s>position);
  const show=next && next.s-position<92 && (next.index===0 || k.gateChain===next.index);
  line.hidden=lookingBack()||!show||k.phase!=='running';
  if(!line.hidden){
   const direction=next.lat<0?'links':'rechts';
   put(line,'Tor '+(next.index+1)+'/3 · '+direction+' · '+(Math.ceil((next.s-position)/5)*5)+' m');
  }
  if(previous && previous.round===packet.round && k.time>=previous.time){
   if(k.stats.lines>previous.lines)toast('Bonuslinie! Extraschub');
   else if(k.lap>previous.lap){
    const end=k.stats.lapEnds?.[previous.lap],start=previous.lap===1?0:k.stats.lapEnds?.[previous.lap-1];
    toast('Runde '+previous.lap+(Number.isFinite(end-start)?' · '+(end-start).toFixed(2).replace('.',',')+' s':' geschafft'));
   }else if(k.gateChain>previous.chain)toast(k.gateChain+' von 3 Toren');
  }
  previous={time:k.time,lap:k.lap,chain:k.gateChain,lines:k.stats.lines,round:packet.round,otherImpact:other?.impact?.time};
  updateMap(view||packet);
  if(now>toastUntil)put(field('toast'),'');
 };
}
