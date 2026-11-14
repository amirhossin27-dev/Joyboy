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
  magnet:'M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3z M6 7h4 M14 7h4',
  wave:'M2 9c3-4 6-4 9 0s6 4 11 0 M2 15c3-4 6-4 9 0s6 4 11 0',
  gulls:'M2 9c3-3 6-2 8 2 2-4 5-5 8-2 M9 17c2-2 4-1 5 1 1-2 3-3 5-1',
  gust:'M3 8h10a3 3 0 1 0-3-3 M3 12h15a3 3 0 1 1-3 3 M3 16h7',
  crab:'M6 13a6 4 0 1 0 12 0a6 4 0 1 0-12 0z M6 11 3 8l1-4 3 3 M18 11l3-3-1-4-3 3 M7 17l-3 3 M17 17l3 3 M10 9V7 M14 9V7',
  spring:'M6 3h12 M6 3l12 4-12 4 12 4-12 4h12',
  ice:'M12 2v20 M3.4 7l17.2 10 M3.4 17 20.6 7 M12 6l-2-2m2 2 2-2 M12 18l-2 2m2-2 2 2',
  sun:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1',
  empty:'M12 3 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10'
 };
 const put=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 const combat=field('combat'),combatTitle=combat.querySelector('b'),combatHint=combat.querySelector('small'),combatBar=combat.querySelector('i');
 const rollOrder=Object.keys(KART_ITEMS),slowTitle={banana:'Bananenschale · Schleudern!',crab:'Krabbe · Schleudern!',wave:'Welle erwischt dich!',rocket:'Raketentreffer!'};
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
   const seconds=value=>value.toFixed(1).replace('.',',')+' s';
   if(k.blocked>0){kind='blocked';title=k.sun>0?'Sonnenkraft: abgeprallt!':'Schild: abgewehrt!';detail='Du fährst ungebremst weiter';remaining=k.blocked/1.2;}
   else if(k.slow>0){kind='slow';title=slowTitle[k.lastHit]||'Getroffen!';detail='Gebremst · noch '+seconds(k.slow);remaining=k.slow/Math.max(k.slow,k.impact?.duration||2.5);}
   else if(k.gust>0){kind='gust';title='Windstoß!';detail='Gegenlenken nach '+(k.gustDir>0?'links':'rechts');remaining=k.gust/1.2;}
   else if(threat){
    kind=threat.kind;remaining=1;
    if(kind==='crab'){title='Krabbe voraus!';detail=(Math.abs(threat.lat-k.lat)<1.6?'Ausweichen':'Spur halten')+' oder springen · '+Math.ceil(threat.distance)+' m';}
    else{title=kind==='rocket'?'Rakete '+(threat.behind?'von hinten!':'von vorn!'):'Bananenschale voraus!';detail=(kind==='banana'?(k.item==='spring'?'Spur wechseln oder springen':'Spur wechseln'):k.sun>0?'Sonnenkraft schützt dich':k.item==='shield'?'Jetzt Schild einsetzen':k.shield>0?'Dein Schild ist bereit':'Zielrakete nähert sich')+' · '+Math.ceil(threat.distance)+' m';}
   }
   else if(k.ice>0){kind='ice';title='Glatteis!';detail='Sanft lenken · noch '+seconds(k.ice);remaining=k.ice/5;}
   else if(k.gulls>0){kind='gulls';title='Möwenschwarm!';detail='Spur halten · noch '+seconds(k.gulls);remaining=k.gulls/4.5;}
   else if(k.sun>0){kind='sun';title='Sonnenkraft';detail='Schneller und unverwundbar';remaining=k.sun/6;}
   else if(k.shield>0){kind='shield';title='Schild aktiv';detail='Fängt einen Treffer ab';remaining=k.shield/12;}
   else if(k.magnet>0){kind='magnet';title='Magnet aktiv';detail='Sammelt Kisten aus allen Spuren';remaining=k.magnet/12;}
   else if(k.draft>.15){kind='draft';title='Windschatten';detail=k.draft>=1?'Jetzt ausscheren für Extraschub':'Dranbleiben …';remaining=k.draft;}
  }
  combat.hidden=!kind;combat.dataset.kind=kind;stage.dataset.combat=kind;
  if(kind){put(combatTitle,title);put(combatHint,detail);combatBar.style.transform='scaleX('+Math.min(1,remaining)+')';}
  const announcement=kind+':'+title;
  if(kind&&announcement!==announced)put(field('live'),title);
  announced=announcement;
  if(previous && previous.round===packet.round && k.time>=previous.time && other?.impact && other.impact.time!==previous.otherImpact){
   toast(other.impact.blocked?'Gegner hat abgewehrt!':'Treffer beim Gegner!');
  }
  // Roulette: nach einer Kiste laufen die Symbole durch, erst danach steht das Item fest.
  const rolling=k.roll>0&&k.phase==='running',starting=k.phase==='countdown';
  const key=rolling?rollOrder[Math.floor(now/70)%rollOrder.length]:k.item||'empty';
  if(item.dataset.item!==key){item.dataset.item=key;icon.setAttribute('d',icons[key]||icons.empty);}
  const rollState=rolling?'1':'';if(item.dataset.roll!==rollState)item.dataset.roll=rollState;
  put(name,starting?'Blitzstart':rolling?'? ? ?':KART_ITEMS[key]||'Item');
  item.disabled=starting?false:!k.item||rolling||k.phase!=='running'||(k.item==='spring'&&k.grounded===false);
  put(hint,starting?'Kurz vor LOS tippen':rolling?'wird gewürfelt':k.item?'Einsetzen':k.sun>0?'Sonnenkraft':k.shield>0?'Geschützt':k.slow>0?'Gebremst':'Box sammeln');
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
