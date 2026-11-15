/**
 * Ausstattung der Rundstrecke: Fahrbahnmarkierungen, Steinbrüstung mit Pfeilern, blühende Hecken, Rasen,
 * Laternen mit Bannern, Wimpelketten und Starttor. Alles ist feste Geometrie in `root` und wird danach
 * je Material zu wenigen Zeichenaufrufen zusammengefasst. Die Fahrphysik bleibt unberührt.
 */
function dressKartTrack(THREE,c){
 const {course,kit,root,at,strip,texture,stone,road,bridgeAt,end}=c,{geometry:geo,material:mat}=kit;
 const cape=course.cape,offBridge=s=>!bridgeAt(s),noise=n=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
 const smooth=s=>{const i=Math.floor(s),f=s-i,u=f*f*(3-2*f);return noise(i)*(1-u)+noise(i+1)*u;};
 const tile=t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
 const unit=geo(new THREE.BoxGeometry(1,1,1)),ball=geo(new THREE.SphereGeometry(1,12,8));
 const box=(w,h,d,m,x,y,z,angle=0)=>{const o=kit.add(unit,m,root,x,y,z);o.scale.set(w,h,d);o.rotation.y=angle;return o;};

 /** Ein Querschnitt [[Abstand zur Mitte, Höhe], …] wird der Strecke entlang gezogen. */
 function sweep(profile,material,{side=1,step=2,keep=()=>true,shape=null,along=4}={}){
  const positions=[],uv=[],indices=[],count=Math.round(end/step),rows=profile.length;
  let length=0;const across=profile.map((p,j)=>j?length+=Math.hypot(p[0]-profile[j-1][0],p[1]-profile[j-1][1]):0);
  const centre=profile.reduce((a,p)=>[a[0]+p[0]/rows,a[1]+p[1]/rows],[0,0]);
  for(let n=0;n<=count;n++){
   const s=n*step;
   profile.forEach((point,j)=>{
    const [l,y]=shape?shape(s%end,j,point):point,p=at(s,side*l,y);
    positions.push(p.x,p.y,p.z);uv.push(across[j]/length,s/along);
   });
  }
  const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),normal=new THREE.Vector3(),out=new THREE.Vector3();
  for(let n=0;n<count;n++){
   const s=n*step;if(!keep(s)||!keep(s+step))continue;
   for(let j=0;j<rows-1;j++){
    const i=n*rows+j,k=i+rows;
    // Die Außenseite zeigt vom Querschnittsmittelpunkt weg – unabhängig von der Streckenseite.
    a.fromArray(positions,i*3);b.fromArray(positions,(i+1)*3);d.fromArray(positions,k*3);
    normal.copy(b).sub(a).cross(d.clone().sub(a));
    const mid=at(s,side*centre[0],centre[1]);out.copy(a).add(b).multiplyScalar(.5).sub(mid);
    if(normal.dot(out)>=0)indices.push(i,i+1,k,i+1,k+1,k);else indices.push(i,k,i+1,i+1,k,k+1);
   }
  }
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return kit.add(g,material,root);
 }

 // ── Fahrbahn: leichter Glanz für die tiefe Sonne, Randlinien, Spurstriche und Bremsspuren ──
 road.roughness=cape?.6:.52;road.envMapIntensity=1.35;road.metalness=.02;
 const paint=mat(0xf3ead2,{roughness:.55});
 for(const side of [-1,1])strip(side*5.62-.1,side*5.62+.1,paint,.033);
 const dashes=tile(texture(8,64,(ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.fillStyle='#f3ead2';ctx.fillRect(0,0,w,h*.36);}));dashes.repeat.set(1,.5);
 const dashPaint=mat(0xffffff,{map:dashes,alphaTest:.5,roughness:.55});
 for(const lane of [-1.95,1.95])strip(lane-.07,lane+.07,dashPaint,.033);
 const skids=tile(texture(256,512,(ctx,w,h)=>{
  ctx.clearRect(0,0,w,h);ctx.lineCap='round';
  for(let n=0;n<26;n++){
   const x=w*(.08+.84*noise(n*3.1)),y=h*noise(n*5.7),len=h*(.12+.3*noise(n*7.3)),bend=w*(noise(n*9.1)-.5)*.3;
   ctx.strokeStyle='rgba(18,20,24,'+(.1+.2*noise(n*11.9)).toFixed(2)+')';ctx.lineWidth=2.4+3*noise(n*13.7);
   for(const shift of [-h,0,h])for(const twin of [0,13]){ctx.beginPath();ctx.moveTo(x+twin,y+shift);ctx.quadraticCurveTo(x+twin+bend,y+shift+len/2,x+twin+bend*.4,y+shift+len);ctx.stroke();}
  }
 }));skids.repeat.set(.4,.125);
 const skidMat=mat(0xffffff,{map:skids,transparent:true,depthWrite:false,roughness:.85,polygonOffset:true,polygonOffsetFactor:-2});
 strip(-5.4,5.4,skidMat,.03);

 // ── Steinbrüstung mit Pfeilern statt dünner Geländer ──
 const coping=[[-.17,0],[-.17,.74],[-.25,.74],[-.25,.9],[.25,.9],[.25,.74],[.17,.74],[.17,0]].map(([l,y])=>[7.2+l,y]);
 const capStone=mat(0xe9dcc1,{map:stone.map,bumpMap:stone.bumpMap,bumpScale:.03,roughness:.8});
 for(const side of [-1,1])sweep(coping,stone,{side,along:3});
 const lampEvery=8,pillarStep=6.5,lamps=[];let index=0;
 for(let s=0;s<end-1;s+=pillarStep,index++)for(const side of [-1,1]){
  const p=at(s,side*7.2),angle=course.frame(s).angle;
  box(.56,1.12,.56,stone,p.x,p.y+.56,p.z,angle);box(.68,.1,.68,capStone,p.x,p.y+1.17,p.z,angle);
  const lamp=index%lampEvery===(side>0?2:6)&&offBridge(s);
  if(lamp)lamps.push({s,side});else kit.add(ball,capStone,root,p.x,p.y+1.36,p.z).scale.setScalar(.17);
 }

 // ── Blühende Hecke hinter der Brüstung, dahinter Rasen ──
 const flowers=(petals,leaf)=>tile(texture(512,256,(ctx,w,h)=>{
  ctx.fillStyle=leaf[0];ctx.fillRect(0,0,w,h);
  const dab=(x,y,r,color)=>{for(const dx of [-w,0,w])for(const dy of [-h,0,h]){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x+dx,y+dy,r,r*.8,0,0,Math.PI*2);ctx.fill();}};
  for(let n=0;n<900;n++)dab(w*noise(n*1.3),h*noise(n*2.9),3+5*noise(n*4.1),leaf[1+n%3]);
  // Blüten in Büscheln, mit hellem Kern.
  for(let n=0;n<70;n++){
   const cx=w*noise(n*17.3),cy=h*(.1+.75*noise(n*19.1)),color=petals[n%petals.length];
   for(let k=0;k<11;k++){const x=cx+34*(noise(n*23+k)-.5),y=cy+26*(noise(n*29+k*3)-.5),r=3.4+2.6*noise(n*31+k);dab(x,y,r,color);dab(x-r*.25,y-r*.25,r*.42,'rgba(255,250,225,.75)');}
  }
 }));
 const leaves=cape?['#27432f','#31553a','#3d6a45','#1f3828']:['#2f5a2c','#3b6f33','#4f8a3e','#274a26'];
 const hedges=(cape?[['#7d6ad6','#b8a6ff','#f4f1ff'],['#f2f4ff','#5c8fe0','#c9a1ff']]:[['#e23d58','#ff7a3d','#ffc23d'],['#a45be0','#ff6fa8','#fff3d6']])
  .map(petals=>{const map=flowers(petals,leaves);map.repeat.set(1,1);return mat(0xffffff,{map,bumpMap:map,bumpScale:.06,roughness:.86});});
 const bush=[[-.42,.5],[-.4,1.05],[-.1,1.5],[.32,1.4],[.62,.85],[.72,0]].map(([l,y])=>[7.95+l,y]);
 const lumpy=(seed)=>(s,j,[l,y])=>{const swell=smooth(s*.45+seed)-.5,fine=smooth(s*1.7+seed*3+j)-.5;return [l+(j>0&&j<5?fine*.14:0),y*(1+swell*.34)+(j>0&&j<5?fine*.16:0)];};
 for(const side of [-1,1])hedges.forEach((material,n)=>sweep(bush,material,{side,step:1,along:5,shape:lumpy(side*9+n),keep:s=>offBridge(s)&&Math.floor((s+(side>0?13:0))/26)%2===n}));
 const turf=tile(texture(128,128,(ctx,w,h)=>{
  ctx.fillStyle=cape?'#4b7044':'#5f8f3f';ctx.fillRect(0,0,w,h);
  for(let n=0;n<1400;n++){ctx.strokeStyle=['#6fa348','#4f7f37','#86b757','#456f31'][n%4];ctx.lineWidth=1;const x=w*noise(n*1.9),y=h*noise(n*3.7);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1.5*(noise(n)-.5),y-2.5);ctx.stroke();}
 }));turf.repeat.set(1.5,1.5);
 const grass=mat(0xffffff,{map:turf,roughness:.95});
 for(const side of [-1,1]){
  const mesh=strip(side>0?8.5:-11.9,side>0?11.9:-8.5,grass,.035);
  // Auf der Brücke gibt es keinen Rasen: diese Dreiecke entfallen.
  const kept=[],indexArray=mesh.geometry.index.array;
  for(let i=0;i<indexArray.length;i+=6){const s=Math.floor(i/6)*2;if(offBridge(s)&&offBridge(s+2))kept.push(...indexArray.slice(i,i+6));}
  mesh.geometry.setIndex(kept);
 }

 // ── Laternen mit Bannern ──
 const iron=mat(0x27323a,{metalness:.55,roughness:.45}),glass=mat(0xffe2ad,{emissive:0xffb45a,emissiveIntensity:2.6,roughness:.4});
 const emblem=texture(128,256,(ctx,w,h)=>{
  ctx.fillStyle=cape?'#1d4f7c':'#a7262b';ctx.fillRect(0,0,w,h);
  const shade=ctx.createLinearGradient(0,0,w,0);shade.addColorStop(0,'rgba(0,0,0,.22)');shade.addColorStop(.5,'rgba(255,255,255,.08)');shade.addColorStop(1,'rgba(0,0,0,.2)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=cape?'#e8f1f7':'#f3c96a';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=5;ctx.strokeRect(9,9,w-18,h-18);
  // Wappen: stilisierte Sonne über Wellen.
  ctx.beginPath();ctx.arc(w/2,h*.4,24,0,Math.PI*2);ctx.fill();
  for(let n=0;n<12;n++){const a=n*Math.PI/6;ctx.beginPath();ctx.moveTo(w/2+Math.cos(a)*30,h*.4+Math.sin(a)*30);ctx.lineTo(w/2+Math.cos(a)*42,h*.4+Math.sin(a)*42);ctx.stroke();}
  ctx.lineWidth=6;for(const y of [.66,.75]){ctx.beginPath();for(let x=22;x<=w-22;x+=4)ctx.lineTo(x,h*y+6*Math.sin(x*.16));ctx.stroke();}
 });
 const cloth=mat(0xffffff,{map:emblem,side:THREE.DoubleSide,roughness:.8});
 const bannerGeo=geo(new THREE.PlaneGeometry(.95,2.25,4,6));
 {const pos=bannerGeo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setZ(i,.09*Math.sin(pos.getX(i)*5+y*1.4)*(1.1-y/2.25));if(y<-1.05)pos.setY(i,y-.16*(1-Math.abs(pos.getX(i))/.475));}bannerGeo.computeVertexNormals();}
 for(const {s,side} of lamps){
  const base=at(s,side*7.2),angle=course.frame(s).angle,arm=at(s,side*6.55,4.62),top=at(s,side*7.2,4.62);
  kit.rod([base.x,base.y+1.1,base.z],[top.x,top.y+.25,top.z],.075,iron,root,8);
  kit.rod(top.toArray(),arm.toArray(),.045,iron,root,6);
  box(.3,.4,.3,glass,top.x,top.y+.55,top.z,angle);box(.4,.07,.4,iron,top.x,top.y+.8,top.z,angle);box(.36,.06,.36,iron,top.x,top.y+.32,top.z,angle);
  const hang=at(s,side*6.72,3.42),banner=kit.add(bannerGeo,cloth,root,hang.x,hang.y,hang.z);banner.rotation.y=angle;
 }

 // ── Wimpelketten quer über die Strecke ──
 const pennants=mat(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:.75}),flagColors=(cape?[0x2f7fc2,0xf4f7fb,0x2bb39a,0xf2c14e]:[0xd8343c,0xf7e9c6,0xf2a52c,0x2f9c8f]).map(v=>new THREE.Color(v));
 const clear=s=>offBridge(s-12)&&offBridge(s+12)&&course.gates.every(g=>Math.abs(g.s-s)>26)&&course.features.every(z=>s<z.start-30||s>z.start+z.length+34)&&s>60;
 for(let s=110;s<end-40;s+=150){
  if(!clear(s))continue;
  const positions=[],colors=[],left=at(s,-7.2,6.6),right=at(s,7.2,6.6);
  for(const side of [-1,1]){const foot=at(s,side*7.2,1.1),tip=side<0?left:right;kit.rod(foot.toArray(),tip.toArray(),.07,iron,root,8);kit.add(ball,capStone,root,tip.x,tip.y+.1,tip.z).scale.setScalar(.14);}
  const point=t=>left.clone().lerp(right,t).setY(left.y+(right.y-left.y)*t-1.25*4*t*(1-t));
  for(let n=0;n<20;n++){
   const a=point(n/20),b=point((n+1)/20),tip=a.clone().lerp(b,.5);tip.y-=.72;
   positions.push(a.x,a.y,a.z,b.x,b.y,b.z,tip.x,tip.y,tip.z);const color=flagColors[n%4];for(let k=0;k<3;k++)colors.push(color.r,color.g,color.b);
  }
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();kit.add(g,pennants,root);
  for(let n=0;n<10;n++)kit.rod(point(n/10).toArray(),point((n+1)/10).toArray(),.018,iron,root,4);
 }

 // ── Starttor: Steinpfeiler mit Laternen tragen die Zielflagge ──
 const gate=at(0),heading=course.frame(0).angle;
 for(const side of [-1,1]){
  const p=at(0,side*7.2);
  box(1.05,6.3,1.05,stone,p.x,p.y+3.15,p.z,heading);box(1.3,.28,1.3,capStone,p.x,p.y+6.42,p.z,heading);box(1.25,.5,1.25,capStone,p.x,p.y+.25,p.z,heading);
  box(.42,.55,.42,glass,p.x,p.y+6.95,p.z,heading);box(.56,.08,.56,iron,p.x,p.y+7.26,p.z,heading);
 }
 box(15.4,.5,.6,capStone,gate.x,gate.y+6.05,gate.z,heading);
}
