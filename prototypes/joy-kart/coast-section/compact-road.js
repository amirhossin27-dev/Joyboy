// Canvas fallback with a long sight line. All road objects use the same track metres as WebGL.
function drawCompactRoad(canvas,ctx,packet,course,rear=false){
 const direction=rear?-1:1;
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
 const me=packet?.me,s=me?.s||0,base=course.frame(s),height=course.height(s),horizon=h*.33;
 const focal=Math.min(w*.85,h*1.3),cameraLat=(me?.lat||0)*.48,far=135,near=-5;
 function project(distance,lat=0){
  const p=course.point(s+direction*distance,lat),unit=focal/Math.max(2,distance+10);
  return {x:w*.5+direction*unit*((p.x-base.x)*base.nx+(p.z-base.z)*base.nz-cameraLat),
   y:horizon+unit*(3.7+height-p.y),unit};
 }
 const sky=ctx.createLinearGradient(0,0,0,h);
 const cape=course.cape;
 sky.addColorStop(0,cape?'#7295b1':'#f8b483');sky.addColorStop(.32,cape?'#deedef':'#ffe4ad');
 sky.addColorStop(.35,cape?'#88a7b2':'#8bcbcd');sky.addColorStop(1,cape?'#416e82':'#408fa0');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 for(const layer of [0,1]){
  ctx.beginPath();ctx.moveTo(0,horizon+3);
  for(let x=0;x<=w+8;x+=8){
   const a=base.angle+(rear?Math.PI:0)+(x/w-.5)*1.9+layer*.6;
   const ridge=.034+.056*Math.abs(Math.sin(a*5)*Math.cos(a*3))+.021*Math.abs(Math.sin(17*a));
   ctx.lineTo(x,horizon-h*ridge*(layer?.57:1));
  }
  ctx.lineTo(w,horizon+3);ctx.closePath();ctx.fillStyle=cape?(layer?'#839ca6':'#aabec5'):(layer?'#ab9897':'#d1b2aa');ctx.fill();
 }
 function strip(a,b,left,right,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.x+a.unit*left,a.y);
  ctx.lineTo(a.x+a.unit*right,a.y);ctx.lineTo(b.x+b.unit*right,b.y);ctx.lineTo(b.x+b.unit*left,b.y);ctx.closePath();ctx.fill();
 }
 // Anchor the alternating strips to the road so they move towards the player.
 let distant=project(far);
 for(let d=Math.floor((direction*s+far)/3)*3-direction*s;d>=near-3;d-=3){
  const close=project(d),band=Math.round((s+direction*d)/3)%2===0;
  strip(close,distant,-7.6,7.6,cape?'#899994':'#c6af86');
  strip(close,distant,-6.35,6.35,band?'#f3e6c8':'#bb6253');
  strip(close,distant,-6,6,band?'#4b5861':'#4d5b63');
  distant=close;
 }
 const gap=mark=>direction*(course.wrap(mark-s+course.lapLength/2)-course.lapLength/2);
 function patch(d,len,lat,width,color){
  if(rear)d-=len;
  if(d>far||d+len<near)return;
  strip(project(Math.max(near,d),lat),project(Math.min(far,d+len),lat),-width/2,width/2,color);
 }
 for(const zone of course.features){
  const d=gap(zone.start);
  patch(d,zone.length,zone.lat,zone.width,zone.height?'#b58253':'#247f8d');
  for(const t of [.25,.5,.75])patch(d+direction*t*zone.length,.65,zone.lat,zone.width*.80,zone.height?'#ffe6a6':'#a9fff1');
 }
 for(const mark of course.gateMarks)patch(gap(mark.s),1.6,mark.lat,.28,'#a1ffde');
 const finish=gap(0);
 for(let i=0;i<12;i++)for(let j=0;j<2;j++)patch(finish+direction*j*.6,.6,i-5.5,1,(i+j)%2?'#263842':'#ffefcf');
 const objects=[];
 function add(d,kind,data){if(d>=near && d<=far)objects.push({d,kind,data});}
 for(const gate of course.gates)add(gap(gate.s),'gate',gate);
 for(const [row,mark] of course.boxes.entries()){
  const d=gap(mark),lap=Math.floor((s+direction*d+.01)/course.lapLength);
  if(lap<0||lap>=course.laps||me?.taken?.includes(lap*course.boxes.length+row))continue;
  for(const [lane,lat] of course.lanes(row).entries())add(d,'box',{lat,hue:((me?.time||0)*80+(row+lane)*120)%360});
 }
 for(const driver of [me,packet?.other]){
  for(const key of ['banana','rocket']){
   const item=driver?.[key],target=driver===me?packet?.other:me;
   if(item)add(gap(item.s),key,{...item,heading:direction*Math.sign(course.wrap((target?.s??item.s)-item.s+course.lapLength/2)-course.lapLength/2)});
  }
  if(driver?.phase==='running'&&driver.crab)add(gap(driver.crab.s),'crab',{lat:driver.crab.lat||0,time:driver.time});
 }
 function car(racer,slot,p){
  const u=p.unit,fox=slot===0,lift=racer?.lift||0;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
  ctx.fillStyle='#13232c66';ctx.beginPath();ctx.ellipse(0,0,1.15,.20,0,0,Math.PI*2);ctx.fill();
  const fx=kartImpact(racer),reduced=effectMotion.matches,time=racer?.time||0;
  if(racer?.slow>0&&!reduced){
   ctx.fillStyle='#bac6c080';for(let i=0;i<6;i++){const a=(time*1.5+i/6)%1;ctx.beginPath();ctx.ellipse((i%2?1:-1)*(.9+a*.2),a*.6,.15+a*.22,.10+a*.13,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.translate(0,-lift);ctx.rotate((racer?.steer||0)*.045+(!reduced&&fx.slip?Math.sin(fx.age*11)*.15*Math.min(1,racer.slow):0));
  if(racer?.boost>0){ctx.fillStyle='#ffcc62';for(const x of [-.58,.58]){ctx.beginPath();ctx.moveTo(x-.13,-.22);ctx.lineTo(x,.39);ctx.lineTo(x+.13,-.22);ctx.fill();}}
  ctx.fillStyle='#1b2631';for(const x of [-1.12,.65])ctx.fillRect(x,-.79,.47,.79);
  ctx.fillStyle=fox?'#b94336':'#28755f';ctx.fillRect(-.83,-.82,1.66,.64);
  ctx.fillStyle=fox?'#ff8761':'#8ae1b2';ctx.fillRect(-.89,-.78,1.78,.15);
  ctx.fillStyle='#e8dfbb';ctx.fillRect(-.31,-.48,.62,.20);
  ctx.fillStyle=fox?'#b95224':'#232d33';
  for(const side of [-1,1]){
   ctx.beginPath();
   if(fox){ctx.moveTo(side*.48,-1.18);ctx.lineTo(side*.54,-1.96);ctx.lineTo(side*.08,-1.63);}
   else ctx.arc(side*.43,-1.59,.23,0,Math.PI*2);
   ctx.fill();
  }
  ctx.fillStyle=fox?'#e38844':'#ebe9d9';ctx.beginPath();ctx.ellipse(0,-1.28,.52,.46,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#43464b';ctx.fillRect(-.5,-1.36,1,.08);
  if(rear){ctx.fillStyle='#fff6da';for(const x of [-.28,.10])ctx.fillRect(x,-1.4,.18,.13);ctx.fillStyle='#25333d';ctx.fillRect(-.1,-1.12,.20,.1);}
  if(racer?.shield>0){ctx.strokeStyle='#a7f4ff';ctx.lineWidth=.05;ctx.beginPath();ctx.ellipse(0,-.85,1.21,1.29,0,0,Math.PI*2);ctx.stroke();}
  if(racer?.sun>0){ctx.fillStyle='#ffd95e55';ctx.strokeStyle='#ffe27a';ctx.lineWidth=.07;ctx.beginPath();ctx.ellipse(0,-.85,1.3+(reduced?0:.08*Math.sin(time*9)),1.38,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(racer?.ice>0){ctx.strokeStyle='#d6f6ff';ctx.fillStyle='#c8f3ff44';ctx.lineWidth=.05;ctx.beginPath();ctx.ellipse(0,lift,1.7,.34,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(racer?.gust>0&&!reduced){ctx.strokeStyle='#eafcff';ctx.lineWidth=.05;for(let i=0;i<4;i++){const a=(time*2.6+i/4)%1,x=(-2+a*4)*racer.gustDir;ctx.beginPath();ctx.moveTo(x-.5,-.3-i*.35);ctx.lineTo(x+.5,-.3-i*.35);ctx.stroke();}}
  if(racer?.gulls>0&&racer!==me){ctx.strokeStyle='#f6f4ec';ctx.lineWidth=.06;for(let i=0;i<4;i++){const a=time*2.3+i*1.6,x=Math.sin(a)*1.3,y=-2.2+.25*Math.sin(time*4+i);ctx.beginPath();ctx.moveTo(x-.3,y-.12);ctx.lineTo(x,y);ctx.lineTo(x+.3,y-.12);ctx.stroke();}}
  if(racer?.phase==='running'&&(fx.burst>0||racer.blocked>0)){
   ctx.strokeStyle=fx.blocked?'#a7f4ff':'#ffe298';ctx.lineWidth=.07;ctx.beginPath();ctx.ellipse(0,-.6,1.25+(reduced?0:1-fx.burst),.5,0,0,Math.PI*2);ctx.stroke();
   if(!reduced){ctx.fillStyle=ctx.strokeStyle;for(let i=0;i<8;i++){const a=i*Math.PI/4+time*2,r=1.1+(1-fx.burst)*.8;ctx.save();ctx.translate(Math.sin(a)*r,-1+Math.cos(a)*r*.7);ctx.rotate(a);ctx.fillRect(-.04,-.13,.08,.26);ctx.fillRect(-.13,-.04,.26,.08);ctx.restore();}}
  }
  ctx.restore();
 }
 if(packet?.other)add(gap(packet.other.s),'car',{racer:packet.other,slot:1-packet.slot,lat:packet.other.lat});
 const swarm=me?.phase==='running'&&me.gulls>0?Math.min(1,me.gulls/.5,(4.5-me.gulls)/.35+.2):0;
 if(!rear)add(0,'car',{racer:me,slot:packet?.slot||0,lat:me?.lat||0});
 for(const obj of objects.sort((a,b)=>b.d-a.d)){
  const {kind,data}=obj,p=project(obj.d,data.lat),u=p.unit;
  if(kind==='car'){car(data.racer,data.slot,p);continue;}
  if(kind==='gate'){
   ctx.beginPath();ctx.ellipse(p.x,p.y,data.halfWidth*u,2.9*u,0,Math.PI,2*Math.PI);
   ctx.lineWidth=Math.max(1,.14*u);ctx.strokeStyle='#176d68';ctx.stroke();
   ctx.lineWidth=Math.max(1,.08*u);ctx.strokeStyle='#a2ffe0';ctx.stroke();continue;
  }
  if(kind==='box'){
   ctx.save();ctx.translate(p.x,p.y-u);ctx.rotate(Math.PI/4);ctx.fillStyle='hsl('+data.hue+' 85% 62%)';
   ctx.fillRect(-u*.38,-u*.38,u*.76,u*.76);ctx.strokeStyle='#fff4d5';ctx.lineWidth=Math.max(1,.06*u);ctx.strokeRect(-u*.38,-u*.38,u*.76,u*.76);ctx.restore();
   if(u>9){ctx.fillStyle='#fffbe6';ctx.font='700 '+Math.round(u*.62)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',p.x,p.y-u);}
  }else if(kind==='crab'){
   const t=data.time||0,still=effectMotion.matches,hop=still?0:Math.abs(Math.sin(t*11))*.12;
   ctx.save();ctx.translate(p.x,p.y);ctx.scale(u*1.5,u*1.5);
   ctx.strokeStyle='#ff9d7e';ctx.lineWidth=.05;ctx.beginPath();ctx.ellipse(0,0,1.3,.26,0,0,Math.PI*2);ctx.stroke();
   ctx.translate(0,-hop);ctx.strokeStyle='#b5382a';ctx.lineWidth=.09;
   for(const side of [-1,1]){for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(side*.5,-.3);ctx.lineTo(side*(.85+n*.12),-.02-n*.05);ctx.stroke();}
    const lift=still?.2:.2+.14*Math.sin(t*7+side);ctx.beginPath();ctx.moveTo(side*.5,-.5);ctx.lineTo(side*.9,-.75-lift);ctx.stroke();
    ctx.fillStyle='#e5533b';ctx.beginPath();ctx.ellipse(side*.95,-.92-lift,.22,.18,0,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle='#e5533b';ctx.beginPath();ctx.ellipse(0,-.42,.72,.36,0,0,Math.PI*2);ctx.fill();
   for(const side of [-1,1]){ctx.fillStyle='#fffbea';ctx.beginPath();ctx.arc(side*.24,-.88,.12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1c2228';ctx.beginPath();ctx.arc(side*.24,-.86,.06,0,Math.PI*2);ctx.fill();}
   ctx.restore();
  }else{
   ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
   if(kind==='banana'){
    ctx.strokeStyle='#ffe377';ctx.lineWidth=.06;ctx.beginPath();ctx.ellipse(0,0,.95,.23,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ffcf38';ctx.strokeStyle='#724b21';ctx.lineWidth=.035;
    ctx.beginPath();ctx.moveTo(0,-.8);ctx.quadraticCurveTo(-.2,-.1,-.85,-.16);ctx.quadraticCurveTo(-.6,.3,0,-.1);ctx.quadraticCurveTo(.6,.3,.85,-.16);ctx.quadraticCurveTo(.2,-.1,.1,-.8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff3a4';ctx.fillRect(-.035,-.82,.12,.26);
   }else{
    ctx.translate(0,-1.05);ctx.rotate(data.heading<0?Math.PI:0);
    ctx.fillStyle='#ffd27c';ctx.beginPath();ctx.moveTo(-.15,.28);ctx.lineTo(0,effectMotion.matches?1.2:1.25+.15*Math.sin((me?.time||0)*30));ctx.lineTo(.15,.28);ctx.fill();
    ctx.fillStyle='#ff7158';ctx.strokeStyle='#fff3cf';ctx.lineWidth=.04;
    ctx.beginPath();ctx.moveTo(0,-.65);ctx.quadraticCurveTo(.35,-.25,.22,.35);ctx.lineTo(-.22,.35);ctx.quadraticCurveTo(-.35,-.25,0,-.65);ctx.fill();ctx.stroke();
    ctx.fillStyle='#d94c3f';ctx.beginPath();ctx.moveTo(-.2,0);ctx.lineTo(-.47,.42);ctx.lineTo(.47,.42);ctx.lineTo(.2,0);ctx.fill();
    ctx.fillStyle='#fff0c1';ctx.fillRect(-.16,-.19,.32,.11);
   }
   ctx.restore();
  }
 }
 // Möwenschwarm: fliegt quer durchs Bild und verdeckt die Sicht.
 if(swarm){
  const t=effectMotion.matches?me.time*.4:me.time,noise=n=>{const x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
  for(let n=0;n<16;n++){
   const dir=n%2?1:-1,x=w*(.5+dir*(((t*(.34+noise(n)*.3)+noise(n+9))%1)-.5)*1.3),y=h*(.12+noise(n+3)*.72)+6*Math.sin(t*3+n),size=h*(.07+noise(n+7)*.07)*swarm,flap=Math.sin(t*13+n*2)*.5;
   ctx.fillStyle='#f6f4ec';ctx.strokeStyle='#8fa2ab';ctx.lineWidth=Math.max(1,size*.08);
   ctx.beginPath();ctx.moveTo(x-size,y-size*flap);ctx.quadraticCurveTo(x-size*.4,y-size*(.35+flap*.4),x,y);ctx.quadraticCurveTo(x+size*.4,y-size*(.35+flap*.4),x+size,y-size*flap);
   ctx.quadraticCurveTo(x+size*.3,y+size*.12,x,y+size*.22);ctx.quadraticCurveTo(x-size*.3,y+size*.12,x-size,y-size*flap);ctx.fill();ctx.stroke();
  }
 }
}
