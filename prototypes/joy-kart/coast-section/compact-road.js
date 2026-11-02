function drawCompactRoad(canvas,ctx,packet,course){
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const me=packet?.me,s=me?.s||0,unit=Math.min(w/23,h/20),base=course.frame(s);
 const middle=y=>{
  const ahead=course.point(s+(h*.72-y)/unit);
  return w*.5+unit*((ahead.x-base.x)*base.nx+(ahead.z-base.z)*base.nz);
 };
 ctx.fillStyle=course.cape?'#567889':'#50afb1';ctx.fillRect(0,0,w,h);
 for(let y=0;y<h;y+=4){const x=middle(y);ctx.fillStyle=course.cape?'#829294':'#d4ba85';ctx.fillRect(x-7*unit,y,14*unit,4);ctx.fillStyle='#665e5d';ctx.fillRect(x-6*unit,y,12*unit,4);
 ctx.fillStyle=Math.floor((s+(h*.72-y)/unit)/2)%2?'#fff1cb':'#c55643';for(const side of [-1,1])ctx.fillRect(x+side*6*unit-unit*.16,y,unit*.32,4);}
 for(const zone of course.features){
  const delta=course.wrap(zone.start-s+course.lapLength/2)-course.lapLength/2;
  const bottom=h*.72-delta*unit,top=bottom-zone.length*unit;
  if(top>h||bottom<0)continue;
  for(let y=Math.max(0,top);y<Math.min(bottom,h);y+=3){
   ctx.fillStyle=zone.height?'#a8703a':'#208e98';ctx.fillRect(middle(y)+(zone.lat-zone.width/2)*unit,y,zone.width*unit,3);
  }
  ctx.strokeStyle=zone.height?'#ffcf82':'#b4fff5';ctx.lineWidth=2;
  for(const t of [.25,.5,.75]){const y=bottom-(bottom-top)*t,x=middle(y)+zone.lat*unit;ctx.beginPath();ctx.moveTo(x-unit,y+unit*.4);ctx.lineTo(x,y-unit*.4);ctx.lineTo(x+unit,y+unit*.4);ctx.stroke();}
 }
 const lap=Math.floor(s/course.lapLength),tints={turbo:'#ffc653',banana:'#ffde37',rocket:'#fe5242',wave:'#ff806f',shield:'#76e8ff',magnet:'#dd94ff'};
 for(const index of [lap,lap+1]){
  for(const [row,mark] of [0,...course.boxes].entries()){
   const y=h*.72-(index*course.lapLength+mark-s)*unit;if(y<0||y>h)continue;
   ctx.fillStyle=row?tints[course.pickupType(row-1,index)]:'white';
   for(const l of (row?course.lanes(row-1):[-4,-2,0,2,4]))ctx.fillRect(middle(y)+l*unit-unit*.4,y,unit*.8,unit*.55);
  }
 }
 for(const racer of [me,packet?.other])for(const [key,glyph] of [['banana','🍌'],['rocket','🚀']]){
  const item=racer?.[key];if(!item)continue;
  const gap=course.wrap(item.s-s+course.lapLength/2)-course.lapLength/2,y=h*.72-gap*unit;
  if(y<0||y>h)continue;
  ctx.font=unit*1.5+'px system-ui';ctx.textAlign='center';ctx.fillText(glyph,middle(y)+item.lat*unit,y);
 }
 function car(k,slot){const y=h*.72-(k.s-s)*unit,x=middle(y)+k.lat*unit;ctx.save();ctx.translate(x,y);ctx.scale(1+(k.lift||0)*.09,1+(k.lift||0)*.09);ctx.translate(-x,-y);ctx.fillStyle='#24282b';ctx.fillRect(x-unit,y-unit,2*unit,unit*2);ctx.fillStyle=slot?'#24745b':'#c44233';ctx.fillRect(x-unit*.7,y-unit*1.4,unit*1.4,unit*2.8);ctx.font=unit*1.2+'px system-ui';ctx.textAlign='center';ctx.fillText(slot?'🐼':'🦊',x,y+unit*.3);ctx.restore();}
 if(packet?.other)car(packet.other,1-packet.slot);car(me||{s:0,lat:0},packet?.slot||0);
}
