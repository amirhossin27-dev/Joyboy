/** One continuous supported coastal road. No branching or elevated crossing decks. */
async function createSimpleCoastWorld(THREE,c){
 const {scene,course,kit,artMaps,materials,texture,lighting,yieldTask}=c,{geometry:geo,material:mat}=kit;
 const root=new THREE.Group();scene.add(root);
 const boxGeo=geo(new THREE.BoxGeometry(1,1,1)),box=(w,h,d,m,p,x=0,y=0,z=0)=>{const o=kit.add(boxGeo,m,p,x,y,z);o.scale.set(w,h,d);return o;};
 const softBox=(w,h,d,m,p,x=0,y=0,z=0)=>kit.add(kit.rounded(w-.05,h-.05,d-.05,Math.min(.12,w/4,h/4)),m,p,x,y,z);
 const at=(s,lat=0,extra=0)=>{const p=course.point(s,lat);return new THREE.Vector3(p.x,p.y+extra,p.z);};
 const stone=mat(0xd8c7a8,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.035}),road=mat(0x8c918c,{map:artMaps.asphalt,bumpMap:artMaps.asphalt,bumpScale:.012}),curb=mat(0xffffff,{vertexColors:true}),wall=mat(0xc4b293,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.04,side:THREE.DoubleSide}),wood=mat(0x75513a),dark=mat(0x263b3d),roofMat=mat(0x9b4b33),gold=mat(0xe6c584,{metalness:.5,roughness:.3});
 // Small headlands carry the seaward houses; between them the wall hugs the road.
 const shoreWidth=s=>11+8*Math.exp(-Math.pow(((s-52)-60*Math.round((s-52)/60))/11,2));
 const circuit=!!course.lapLength,start=circuit?0:-20,end=course.lapLength||320,step=circuit?2:1;
 const bridgeAt=s=>circuit&&s>end*.42&&s<end*.57;
 const width=(s,l)=>Math.abs(l)!==19?l:bridgeAt(s)?Math.sign(l)*8:l<0?-19:circuit?17+2*Math.cos(s/30):shoreWidth(s);
 function strip(inner,outer,material,extra=0,colored=false){
  const positions=[],uv=[],colors=[],indices=[];
  const count=Math.ceil((end-start)/step),ds=(end-start)/count;
  function vertex(d,l){const p=at(d,width(d,l),extra);positions.push(p.x,p.y,p.z);uv.push((l-inner)/4,d/6);}
  if(colored){
   // The kerb changes colour at a segment boundary, so it deliberately keeps split vertices.
   for(let n=0;n<count;n++){
    const d=start+n*ds,j=positions.length/3,col=new THREE.Color(Math.floor(d/2)%2?0xe6dbc0:0xa84632);
    for(const [t,l] of [[d,inner],[d,outer],[d+ds,inner],[d+ds,outer]]){vertex(t,l);colors.push(col.r,col.g,col.b);}
    indices.push(j,j+1,j+2,j+1,j+3,j+2);
   }
  }else{
   // Shared cross-sections give the same normal on both sides of every road seam.
   for(let n=0;n<=count;n++){const d=start+n*ds;vertex(d,inner);vertex(d,outer);if(n<count){const j=n*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  }
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(colored)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  if(circuit&&!colored){const normal=g.attributes.normal;for(let lane=0;lane<2;lane++){const last=count*2+lane,v=new THREE.Vector3().fromBufferAttribute(normal,lane).add(new THREE.Vector3().fromBufferAttribute(normal,last)).normalize();normal.setXYZ(lane,v.x,v.y,v.z);normal.setXYZ(last,v.x,v.y,v.z);}}
  return kit.add(g,material,root);
 }
 if(circuit){
  // Keep the grain in the atlas, compress its contrast for the racing camera.
  const aggregate=texture(256,256,(ctx,w,h)=>{
   ctx.fillStyle=course.cape?'#6f7477':'#756e67';ctx.fillRect(0,0,w,h);
   ctx.globalAlpha=.36;ctx.drawImage(artMaps.asphalt.image,0,0,w,h);
  });
  aggregate.wrapS=aggregate.wrapT=THREE.RepeatWrapping;aggregate.repeat.set(1.6,1.6);
  aggregate.anisotropy=artMaps.asphalt.anisotropy;
  road.map=aggregate;road.bumpMap=aggregate;road.bumpScale=.006;
  // Dry wheel paths vary in roughness without reading as bright lane markings.
  const wear=texture(256,16,(ctx,w,h)=>{
   const gradient=ctx.createLinearGradient(0,0,w,0);
   for(const [x,value] of [[0,251],[.18,248],[.28,227],[.36,244],[.5,250],[.64,244],[.72,227],[.82,248],[1,251]])
    gradient.addColorStop(x,'rgb('+[value,value,value].join(',')+')');
   ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  });
  wear.colorSpace=THREE.NoColorSpace;wear.repeat.x=1/3;road.roughness=.95;road.roughnessMap=wear;
  scene.fog.color.setHex(course.cape?0x97b5c7:0x9daeb9);scene.fog.density=course.cape?.003:.0023;
 }
 strip(-19,19,stone);strip(-6,6,road,.025);strip(-6.4,-6,curb,.065,true);strip(6,6.4,curb,.065,true);
 // Retaining sides and end caps extend below water: the promenade cannot float.
 for(const side of[-1,1]){
  const pos=[],uv=[],idx=[];
  for(let s=start;s<end;s+=step){const p=at(s,width(s,side*19)),q=at(s+step,width(s+step,side*19)),i=pos.length/3,bottom=bridgeAt(s)?p.y-1:-3;pos.push(p.x,p.y,p.z,q.x,q.y,q.z,p.x,bottom,p.z,q.x,bottom,q.z);uv.push(s/5,0,(s+1)/5,0,s/5,2,(s+1)/5,2);idx.push(i,i+1,i+2,i+1,i+3,i+2);}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();kit.add(g,wall,root);
 }
 for(const s of(circuit?[]:[-20,320])){const w=shoreWidth(s),p=at(s,(w-19)/2);box(w+19,p.y+3,.35,wall,root,p.x,(p.y-3)/2,p.z);}
 if(circuit){
  for(let s=Math.ceil(end*.42);s<end*.57;s+=18){
   for(const sign of [-1,1]){const p=at(s,sign*5.8);box(1.15,p.y+3,2.1,wall,root,p.x,(p.y-3)/2,p.z).rotation.y=course.frame(s).angle;}
   const p=at(s);box(14,.85,2.2,stone,root,p.x,p.y-.8,p.z).rotation.y=course.frame(s).angle;
  }
 }
 if(circuit){
  const enamel=mat(course.cape?0xa34932:0x327273,{roughness:.58,metalness:.25});
  const pale=mat(course.cape?0xdbe3df:0xe5c894,{roughness:.72});
  const cable=mat(0x405663,{metalness:.45,roughness:.52});
  const towers=[end*.45,end*.54],span=towers[1]-towers[0],sideOffset=7.65;
  const rod=(a,b,r,m)=>kit.rod(a.toArray(),b.toArray(),r,m,root,6);
  for(const s of towers){
   const tower=new THREE.Group(),p=at(s);
   tower.position.copy(p);tower.rotation.y=course.frame(s).angle;root.add(tower);
   for(const side of [-1,1]){
    box(1.3,1.2,2.4,stone,tower,side*sideOffset,.6,0);
    box(.64,10,1.15,enamel,tower,side*sideOffset,5.9,0);
    box(.86,.38,1.48,pale,tower,side*sideOffset,10.95,0);
   }
   box(2*sideOffset,.48,.92,enamel,tower,0,9.9,0);
   for(const side of [-1,1])rod(at(s,side*sideOffset,7.2),at(s,side*(sideOffset-2.6),9.75),.21,enamel);
  }
  // Follow the curved deck with both cables. All hangers stay beyond the kerbs.
  for(const side of [-1,1]){
   let last;
   for(let i=-5;i<=21;i++){
    const u=i/16,s=towers[0]+span*u;
    const y=u<0?10.8+u*26:u>1?10.8-(u-1)*26:4.1+6.7*(2*u-1)**2;
    const tip=at(s,side*sideOffset,y);
    if(last)rod(last,tip,.115,cable);
    if(i%2===0 && i!==0 && i!==16)rod(at(s,side*sideOffset,.5),tip,.055,pale);
    last=tip;
   }
  }
  const banner=texture(512,96,(ctx,w,h)=>{
   ctx.fillStyle=course.cape?'#873d30':'#155153';ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#f4dca2';ctx.fillRect(0,h-7,w,7);
   ctx.fillStyle='#fff6df';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 51px sans-serif';
   ctx.fillText(course.cape?'FJORDPASS':'HAFENBRÜCKE',w/2,h*.49);
  });
  const sign=kit.add(geo(new THREE.PlaneGeometry(8.7,1.6)),mat(0xffffff,{map:banner,side:THREE.DoubleSide}),root);
  sign.position.copy(at(towers[0],0,9.3));sign.rotation.y=course.frame(towers[0]).angle+Math.PI;
 }
 const spacing=circuit?6.5:2.5;
 const railGeo=geo(new THREE.LatheGeometry([new THREE.Vector2(.14,0),new THREE.Vector2(.14,.1),new THREE.Vector2(.07,.2),new THREE.Vector2(.12,.5),new THREE.Vector2(.075,.9),new THREE.Vector2(.15,1)],12)),posts=new THREE.InstancedMesh(railGeo,stone,2*(Math.ceil((end-start)/spacing)+1)),dummy=new THREE.Object3D();let i=0;
 for(let s=start;s<=end;s+=spacing)for(const side of[-1,1]){dummy.position.copy(at(s,side*7.2));dummy.updateMatrix();posts.setMatrixAt(i++,dummy.matrix);}
 posts.count=i;posts.castShadow=true;posts.receiveShadow=true;posts.computeBoundingSphere();scene.add(posts);
 for(let s=start;s<end;s+=spacing)for(const side of[-1,1])kit.rod(at(s,side*7.2,1.05).toArray(),at(Math.min(s+spacing,end),side*7.2,1.05).toArray(),.10,stone,root,10);
 const plaster=[0xd8bf91,0xc99e7d,0xe0d0a9].map(c=>mat(c,{bumpMap:artMaps.stone,bumpScale:.018,roughness:.92})),windowMat=mat(0x293c42,{metalness:.2}),leaf=mat(0x345039),treeGeo=geo(new THREE.SphereGeometry(1,18,12));
 const roofTiles=texture(128,128,(ctx,w,h)=>{
  ctx.fillStyle='#c6a08b';ctx.fillRect(0,0,w,h);
  for(let row=0;row<8;row++)for(let col=-1;col<8;col++){
   const x=col*18+(row%2)*9,y=row*16;
   const glaze=ctx.createLinearGradient(x,0,x+18,0);glaze.addColorStop(0,'#805844');glaze.addColorStop(.45,'#e8baa0');glaze.addColorStop(1,'#b08467');ctx.fillStyle=glaze;ctx.fillRect(x,y,17,15);
  }
 });roofTiles.wrapS=roofTiles.wrapT=THREE.RepeatWrapping;roofTiles.repeat.set(3,2);roofMat.map=roofTiles;roofMat.bumpMap=roofTiles;roofMat.bumpScale=.025;
 const roofGeo=geo(new THREE.BufferGeometry()),roofVertices=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-.55,1,0],[.55,1,0]],roofPositions=[],roofUvs=[];
 for(const id of [0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]){const [x,y,z]=roofVertices[id];roofPositions.push(x,y,z);roofUvs.push((x+1)/2,(z+1)/2);}
 roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roofGeo.setAttribute('uv',new THREE.Float32BufferAttribute(roofUvs,2));roofGeo.computeVertexNormals();
 // Bake the soft contact shade into a shared decal. All eaves and shutters use one batch.
 const facadeShade=texture(64,32,(ctx,w,h)=>{
  const fade=ctx.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,edge=Math.min(1,x/5,(w-1-x)/5);
   fade.data.set([63,43,39,Math.round(90*edge*(1-y/(h-1))**2)],i);
  }
  ctx.putImageData(fade,0,0);
 });
 const shadeMaterial=new THREE.MeshBasicMaterial({map:facadeShade,transparent:true,depthWrite:false});
 materials.add(shadeMaterial);
 const facadePlane=geo(new THREE.PlaneGeometry(1,1));
 function contactShade(parent,x,y,z,w,h){
  const patch=kit.add(facadePlane,shadeMaterial,parent,x,y,z);patch.scale.set(w,h,1);
 }
 const shutters=[mat(0x426967),mat(0x496078),mat(0x64764d)],awning=mat(0xb84937),linen=mat(0xf1ddab);
 for(let n=0;n<(course.cape?0:28);n++){
  if(n%6===0||n%6===2)continue;
  const s=circuit?(n<14?end*.025+n*13:end*.69+(n-14)*12):12+n*10,side=n%2?-1:1,p=at(s,side*(12.5+1.3*Math.sin(n*2))),g=new THREE.Group();g.position.copy(p);g.rotation.y=course.frame(s).angle+side*Math.PI/2;root.add(g);const h=5+n%3;
  softBox(4,h,3,plaster[n%3],g,0,h/2,0);
  softBox(4.15,.36,3.15,stone,g,0,.18,0);softBox(4.18,.22,3.18,stone,g,0,h-.12,0);
  const roof=kit.add(roofGeo,roofMat,g,0,h+.04,0);roof.scale.set(2.24,1.15,1.74);
  kit.rod([-1.24,h+1.20,0],[1.24,h+1.20,0],.075,roofMat,g,12);
  for(const sign of [-1,1]){
   const face=new THREE.Group();face.rotation.y=sign===1?0:Math.PI;face.position.z=sign*1.5;g.add(face);
   contactShade(face,0,h-.44,.052,3.92,.59);
  }
  // Side elevations are the main view when driving past; give them recessed panes and cornices too.
  for(const side of [-1,1]){
   const facade=new THREE.Group();facade.position.x=side*2;facade.rotation.y=side*Math.PI/2;g.add(facade);
   contactShade(facade,0,h-.44,.05,2.96,.59);
   for(const y of [1.6,h-1.26])for(const x of [-.72,.72]){
    box(.88,1.16,.11,stone,facade,x,y,.025);box(.65,.91,.055,windowMat,facade,x,y,.09);
    box(.035,.92,.035,linen,facade,x,y,.13);box(.65,.035,.035,linen,facade,x,y-.08,.13);
    box(1,.12,.30,stone,facade,x,y-.64,.12);
   }
   for(const x of [-1.38,1.38])for(let level=0;level<h-.4;level+=.65)box(.24,.28,.12,stone,facade,x,level+.35,.025);
  }
  for(const y of[1.5,h-1.26])for(const x of[-1,1]){box(.8,1,.05,stone,g,x,y,1.52);box(.6,.8,.06,windowMat,g,x,y,1.56);box(.8,.08,.3,stone,g,x,y-.55,1.63);}
  box(.8,1.8,.06,dark,g,0,.9,1.55);
  for(const x of [-1,1])for(const sign of [-1,1]){
   const sx=x+sign*.49,y=h-1.26;
   contactShade(g,sx+.04,y-.51,1.55,.31,.23);
   box(.24,.88,.12,shutters[n%3],g,sx,y,1.61);
  }
  if(n%3){
   for(let stripe=0;stripe<9;stripe++){
    const shade=box(.32,.09,1.04,stripe%2?linen:awning,g,(stripe-4)*.32,2.6,1.97);
    shade.rotation.x=.17;box(.32,.19,.06,stripe%2?linen:awning,g,(stripe-4)*.32,2.44,2.46);
   }
  }else{
   box(3.6,.17,.86,stone,g,0,2.96,1.87);
   box(3.45,.08,.08,dark,g,0,3.63,2.25);
   for(let bar=-4;bar<=4;bar++)box(.045,.64,.045,dark,g,bar*.40,3.31,2.25);
  }
  box(.48,1.35,.52,plaster[n%3],g,1.08,h+.86,-.4);box(.64,.12,.68,roofMat,g,1.08,h+1.53,-.4);
 }
 // Two crossed foliage cards keep branch detail visible as the player passes a tree.
 let treeCard,foliage;
 if(artMaps.foliage){
  treeCard=geo(new THREE.PlaneGeometry(1,1));
  foliage=new THREE.MeshBasicMaterial({map:artMaps.foliage,alphaTest:.40,alphaToCoverage:true,side:THREE.DoubleSide,color:0xf0f3ee});
  materials.add(foliage);
 }
 for(let s=4;s<(circuit?end:310);s+=circuit?17:9)for(const side of [-1,1]){
  if(bridgeAt(s)||(side===1&&s%45<27))continue;
  const p=at(s,side*(9.4+Math.sin(s)*.6));
  if(treeCard){
   const height=(course.cape?5.9:4.9)+1.1*Math.cos(s*.3+side);
   const image=artMaps.foliage.image,width=height*image.width/image.height;
   const heading=course.frame(s).angle+.30*Math.sin(s*side);
   for(const angle of [heading,heading+Math.PI/2]){
    const card=kit.add(treeCard,foliage,root,p.x,p.y+height/2,p.z);
    card.scale.set(width,height,1);card.rotation.y=angle;
   }
   continue;
  }
  box(.17,3,.17,wood,root,p.x,p.y+1.5,p.z);
  for(let tier=0;tier<3;tier++){
   const crown=kit.add(treeGeo,leaf,root,p.x+.11*Math.sin(s+tier),p.y+1.72+tier*1.12,p.z+.07*Math.cos(tier+s));
   crown.scale.set(.76-tier*.18,1.36-tier*.13,.68-tier*.14);
  }}
 // Low flower beds frame intermittent views over the water; the seaward cliffs
 // overlap the retaining wall and taper down beneath the waterline.
 const crag=geo(new THREE.IcosahedronGeometry(1,2)),lichen=mat(0xa99679,{map:artMaps.stone,roughness:1});
 if(course.cape){
  const basalt=mat(0x52636b,{map:artMaps.stone,roughness:.96});
  for(let n=0;n<74;n++){
   const s=end*n/74,side=n%3===0?-1:1,p=at(s,side*(31+8*Math.sin(n*1.7)));
   if(s>=85&&s<=265&&side===1)continue;
   const stack=kit.add(crag,basalt,root,p.x,-2,p.z);
   stack.scale.set(4+2*Math.cos(n),9+5*Math.sin(n*2.3),5+2*Math.sin(n));
   stack.rotation.y=n*1.1;
  }
  // One connected headland, sampled in course coordinates so its inner edge stays
  // under the promenade. Stepped strata, a dark wet toe and broken surf share the shoreline.
  const rockPos=[],rockColors=[],surfPos=[],surfColors=[];
  const strata=[0x777d73,0x8b938a,0x545f66,0x747e80,0x49565b,0x34464a,0x293e44];
  function quad(pos,colors,a,b,c,d,tint){
   const color=new THREE.Color(tint);
   for(const v of [a,b,c,c,b,d]){pos.push(v.x,v.y,v.z);colors.push(color.r,color.g,color.b);}
  }
  let prev;
  for(let i=0;i<=56;i++){
   const s=85+i*3.2,t=i/56,envelope=Math.sin(Math.PI*t)**1.2;
   const shelf=envelope*(7+11*Math.sin(2*Math.PI*t)**2),edge=18+shelf;
   const crest=-2.9+envelope*(7+2*Math.cos(s*.11)),ledge=.65*Math.sin(s*.46);
   const point=(l,y)=>{const p=at(s,l);p.y=y;return p;};
   const row=[point(15,crest-.7),point(edge-3.8,crest+.3),point(edge-3,crest-.5),
    point(edge-2.7,crest-1.2),point(edge-1.8+ledge,(crest-3)/2),point(edge-.35,-1.24),point(edge,-1.98),point(edge+.36,-3.2)];
   const surf=point(edge+.22+envelope*(.55+.35*Math.cos(s*.6)),-1.94);
   if(prev){
    for(let j=0;j<row.length-1;j++)quad(rockPos,rockColors,prev.row[j],prev.row[j+1],row[j],row[j+1],strata[j]);
    if(envelope>.26 && (i%9)<7)quad(surfPos,surfColors,prev.row[6],prev.surf,row[6],surf,i%3===0?0x9ebbb9:0xabc8c5);
   }
   prev={row,surf};
  }
  // The high road hides the foot of the attached shelf. Detached stacks beyond
  // it show their shaded, landward faces and their waterline from the driver's seat.
  function rockStack(s,offset,rx,rz,height,phase){
   const centre=at(s,offset),angle=course.frame(s).angle+.35,segments=11;
   const rings=[[-.7,1.06],[.06,1],[.8,.95],[height*.37,.86],[height*.44,.88],
    [height*.52,.73],[height*.81,.72],[height,.48]];
   const tints=[0x324c52,0x42595d,0x697979,0x58686b,0x87918b,0x606e70,0x9b9d8f];
   const lip=[];
   function rim(j,level){
    const [rise,radius]=rings[level],a=j*2*Math.PI/segments;
    const irregular=1+.12*Math.sin(3*a+phase)+.07*Math.sin(5*a-phase);
    const x=rx*(radius*irregular*Math.cos(a)+rise/height*.21),z=rz*radius*irregular*Math.sin(a);
    return new THREE.Vector3(centre.x+x*Math.cos(angle)+z*Math.sin(angle),
     -2+rise*(1+.13*Math.cos(a+phase)+.065*Math.sin(3*a+phase+level*.46)),centre.z-x*Math.sin(angle)+z*Math.cos(angle));
   }
   for(let j=0;j<segments;j++){
    for(let k=0;k<rings.length-1;k++)
     quad(rockPos,rockColors,rim(j,k),rim(j,k+1),rim(j+1,k),rim(j+1,k+1),tints[k]);
    const peak=new THREE.Vector3(centre.x+rx*.18,-2+height,centre.z);
    const top=rings.length-1;const tint=new THREE.Color(0x929783);
    for(const v of [peak,rim(j+1,top),rim(j,top)]){rockPos.push(v.x,v.y,v.z);rockColors.push(tint.r,tint.g,tint.b);}
    lip.push(rim(j,1));
   }
   for(let j=0;j<segments;j++){
    if((j+Math.floor(phase))%4===0)continue;
    const a=lip[j],b=lip[(j+1)%segments];
    const outer=v=>new THREE.Vector3(centre.x+(v.x-centre.x)*1.09,-1.91,centre.z+(v.z-centre.z)*1.09);
    quad(surfPos,surfColors,a,b,outer(a),outer(b),0xb5ceca);
   }
  }
  rockStack(137,34,5.4,8.2,10.4,.7);
  rockStack(150,42,8.5,12.5,16.5,2.2);
  rockStack(162,38,6.4,9.8,12.8,1.1);
  rockStack(199,49,9,15,10.3,2.7);
  function shoreMesh(pos,colors,material){
   const g=geo(new THREE.BufferGeometry());
   g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   if(material.map){
    const uv=[];
    for(let i=0;i<pos.length;i+=3){
     const [x,y,z]=[pos[i],pos[i+1],pos[i+2]];
     uv.push((x*.86+z*.5)/7,(y+z*.21-x*.13)/7);
    }
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   }
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
   kit.add(g,material,root);
  }
  // Tileable weathered basalt: coarse mineral variation, narrow vertical joints
  // and a lighter broken edge. Baked once, it costs no per-frame noise shader.
  const basaltSkin=texture(256,256,(ctx,w,h)=>{
   const pixels=ctx.createImageData(w,h);
   function makeNoise(cells){
    const values=new Float32Array(cells*cells);let seed=cells;
    for(let i=0;i<values.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[i]=seed/4294967296;}
    const mask=cells-1;
    return (x,y)=>{
     const ix=Math.floor(x*cells),iy=Math.floor(y*cells),next=(ix+1)&mask;
     let u=x*cells-ix,v=y*cells-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
     const a=iy*cells,b=((iy+1)&mask)*cells;
     return (1-v)*(values[a+ix]*(1-u)+values[a+next]*u)+v*(values[b+ix]*(1-u)+values[b+next]*u);
    };
   }
   const coarse=makeNoise(8),veins=makeNoise(16),detail=makeNoise(64),grit=makeNoise(128);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h,n=coarse(u,v),fine=detail(u,v),grain=grit(u,v);
    const fracture=Math.abs(Math.sin(Math.PI*(8*u+.58*n+.22*veins(u,v))));
    const joint=1-Math.min(1,fracture*8),edge=Math.max(0,1-Math.abs(fracture-.17)*9);
    const value=168+51*(n-.45)+44*(fine-.5)+26*(grain-.5)-51*joint+18*edge;
    const pale=Math.max(0,(n+fine-1.22)*42),i=(y*w+x)*4;
    pixels.data[i]=value+pale;pixels.data[i+1]=value+pale*.82;pixels.data[i+2]=value+4;pixels.data[i+3]=255;
   }
   ctx.putImageData(pixels,0,0);
  });
  basaltSkin.wrapS=basaltSkin.wrapT=THREE.RepeatWrapping;basaltSkin.anisotropy=artMaps.stone.anisotropy;
  shoreMesh(rockPos,rockColors,mat(0xffffff,{vertexColors:true,map:basaltSkin,bumpMap:basaltSkin,bumpScale:.095,roughness:.92}));
  shoreMesh(surfPos,surfColors,mat(0xffffff,{vertexColors:true,roughness:.68}));
 }
 const blooms=[0xba3656,0xb55782,0xebad52].map(color=>mat(color));
 for(let j=0;j<33;j++){
  const s=circuit?end*(j+.4)/33:j*10-10;if(bridgeAt(s))continue;const side=j%5===0?-1:1,p=at(s,side*((side===1?shoreWidth(s):19)+2*Math.sin(j)));
  const o=kit.add(crag,lichen,root,p.x,-1.5,p.z);
  o.scale.set(5+2*Math.sin(j*.6),4+.6*Math.sin(j),7);o.rotation.y=j*.71;
  if(course.cape||j%3===0)continue;
  const bed=at(s,side*8.6);
  box(1.2,.38,3.3,stone,root,bed.x,bed.y+.18,bed.z);
  const foliage=kit.add(treeGeo,leaf,root,bed.x,bed.y+.47,bed.z);foliage.scale.set(.62,.38,1.65);
  for(let k=0;k<9;k++){const bloom=kit.add(crag,blooms[(j+k)%3],root,bed.x+.36*Math.sin(k*4),bed.y+.7+.09*Math.cos(k),bed.z+(k-4)*.30);bloom.scale.set(.16,.14,.19);}
 }
 // Lateen sails sit in the coves below the raceway.
 const sailShape=new THREE.Shape();sailShape.moveTo(0,.3);sailShape.lineTo(0,3.4);sailShape.lineTo(2,.3);sailShape.closePath();
 const sailGeo=geo(new THREE.ShapeGeometry(sailShape)),canvasMat=mat(0xffedc5,{side:THREE.DoubleSide});
 for(const distance of (course.cape?[]:[37,118,202,262])){
  const shore=at(circuit?distance*end/300:distance,32+4*Math.sin(distance)),boat=new THREE.Group();root.add(boat);
  boat.position.set(shore.x,-1.88,shore.z);boat.rotation.y=distance*.63;
  kit.add(treeGeo,wood,boat,0,0,0).scale.set(2.2,.35,.65);
  box(.09,3.7,.09,wood,boat,0,1.81,0);kit.add(sailGeo,canvasMat,boat,0,.14,0);
 }
 if(circuit){
  for(const fraction of (course.cape?[.055,.48,.81]:[.31,.81])){
   const s=end*fraction,sign=course.cape?-1:1,landmark=at(s,sign*28),g=new THREE.Group();
   g.position.set(landmark.x,-2.2,landmark.z);g.rotation.y=course.frame(s).angle;root.add(g);
   if(course.cape){
    const reef=kit.add(crag,lichen,g);reef.scale.set(9,4.5,8);
    for(let level=0;level<4;level++){
     const radius=2.3-level*.23;
     const tower=geo(new THREE.CylinderGeometry(radius-.23,radius,3.15,28));
     kit.add(tower,level%2?awning:linen,g,0,5.15+3.15*level,0);
    }
    kit.add(geo(new THREE.CylinderGeometry(2.0,2.0,.4,28)),dark,g,0,16.2,0);
    kit.add(geo(new THREE.CylinderGeometry(1.14,1.14,1.9,24)),gold,g,0,17.25,0);
    for(const x of [-.95,.95])for(const z of [-.7,.7])box(.12,2,.12,dark,g,x,17.25,z);
    kit.add(geo(new THREE.ConeGeometry(1.95,1.3,28)),roofMat,g,0,18.7,0);
   }else{
    box(3.6,.5,15,wood,g,0,1.6,0);
    for(const z of [-6,-2,2,6])for(const x of [-1.55,1.55])box(.3,3.4,.3,wood,g,x,1,z);
    for(const z of [-4,3]){
     kit.add(treeGeo,roofMat,g,3.6,.45,z).scale.set(.95,.48,2.8);
     box(.10,4.1,.10,wood,g,3.6,2.55,z);const sail=kit.add(sailGeo,canvasMat,g,3.6,.8,z);sail.rotation.y=Math.PI/2;
    }
   }
  }
 }
 // The finish is visible above the racers as well as painted on the road.
 const finish=at(circuit?0:299),flagGeo=geo(new THREE.PlaneGeometry(13,1,26,2)),flagPos=flagGeo.getAttribute('position');
 const flagMap=texture(256,32,(ctx,w,h)=>{for(let x=0;x<16;x++)for(let y=0;y<2;y++){ctx.fillStyle=(x+y)%2?'#293b40':'#ffefd1';ctx.fillRect(x*w/16,y*h/2,w/16,h/2);}});
 const flagMat=mat(0xffffff,{map:flagMap,side:THREE.DoubleSide});
 for(let i=0;i<flagPos.count;i++){const x=flagPos.getX(i);flagPos.setY(i,flagPos.getY(i)-.5*(1-(x/6.5)**2));flagPos.setZ(i,.12*Math.sin(x*1.5));}
 flagGeo.computeVertexNormals();kit.add(flagGeo,flagMat,root,finish.x,finish.y+5.4,finish.z);
 for(const sign of [-1,1])box(.18,6,.18,wood,root,finish.x+sign*6.5,finish.y+3,finish.z);
 // Transverse start/finish markings sit above asphalt rather than intersecting it.
 for(const s of(circuit?[0]:[1,299]))for(let x=-5.5;x<6;x++)for(let z=0;z<2;z++){const p=at(s+z*.5,x);box(1,.025,.5,(Math.round(x+.5)+z)%2?stone:dark,root,p.x,p.y+.05,p.z);}
 if(circuit){
  // UVs follow distance along the centre line, so arrows point into the bend.
  const makeDeck=(ramp)=>{
   const ink=texture(256,512,(ctx,w,h)=>{
    ctx.fillStyle=ramp?'#4b3d35':'#125364';ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=24){ctx.fillStyle=ramp?'#786456':'#217183';ctx.fillRect(0,y,w,3);}
    ctx.fillStyle=ramp?'#ffb858':'#83ffed';
    for(const x of [6,w-14])ctx.fillRect(x,0,8,h);
    ctx.lineWidth=11;ctx.strokeStyle=ramp?'#ffd08a':'#abfff1';
    for(const y of [112,258,404]){ctx.beginPath();ctx.moveTo(42,y+38);ctx.lineTo(128,y-25);ctx.lineTo(214,y+38);ctx.stroke();}
   });
   return mat(0xffffff,{map:ink,roughness:.69,side:THREE.DoubleSide});
  };
  // Open illuminated arches share a single static material batch on the phone.
  const archInk=mat(0x70ffe0,{emissive:0x098e80,roughness:.38,side:THREE.DoubleSide});
  const archGeo=geo(new THREE.TorusGeometry(1,.065,8,48,Math.PI));
  for(const mark of course.gateMarks){
   const p=at(mark.s,mark.lat,.069);
   const dash=box(.23,.018,1.6,archInk,root,p.x,p.y,p.z);
   dash.rotation.y=course.frame(mark.s).angle;
  }
  for(const gate of course.gates){
   const center=at(gate.s,gate.lat,.08),arch=kit.add(archGeo,archInk,root);
   arch.position.copy(center);arch.rotation.y=course.frame(gate.s).angle;
   arch.scale.set(gate.halfWidth,2.9,1);
   for(const side of [-1,1]){
    const foot=at(gate.s,gate.lat+side*gate.halfWidth,.13);
    box(.38,.22,.65,dark,root,foot.x,foot.y,foot.z).rotation.y=arch.rotation.y;
   }
  }
  const decks={ramp:makeDeck(true),boost:makeDeck(false)};
  for(const zone of course.features){
   const positions=[],uv=[],indices=[],half=zone.width/2;
   for(let i=0;i<=8;i++){
    const t=i/8,s=zone.start+t*zone.length;
    for(const side of [-1,1]){
     const p=at(s,zone.lat+side*half,.055+t*zone.height);positions.push(p.x,p.y,p.z);
     uv.push((side+1)/2,t);
    }
    if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
   }
   const mesh=geo(new THREE.BufferGeometry());mesh.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.setIndex(indices);mesh.computeVertexNormals();kit.add(mesh,decks[zone.type],root);
   if(zone.height){
    const a=zone.start,b=a+zone.length;
    for(const side of [-1,1]){
     const l=zone.lat+side*half,pts=[at(a,l,.045),at(b,l,.045),at(b,l,zone.height+.055)];
     const g=geo(new THREE.BufferGeometry().setFromPoints(pts));g.setIndex(side<0?[2,1,0]:[0,1,2]);g.computeVertexNormals();kit.add(g,wall,root);
    }
    const p=at(b,zone.lat,zone.height/2);box(zone.width,zone.height,.12,dark,root,p.x,p.y,p.z).rotation.y=course.frame(b).angle;
   }
  }
 }
 kit.mergeStatic(root);await yieldTask();
 // The reused city rotates internally by PI. Cancel that rotation before translating it.
 const backdrop=new THREE.Group();backdrop.rotation.y=Math.PI;backdrop.position.z=circuit?45:-210;if(circuit)backdrop.scale.setScalar(.59);scene.add(backdrop);
 const seeded=n=>()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 const coast=course.cape?null:await createProductionCoast(THREE,{scene:backdrop,P:{seeded,WALL:8,trackPoint:()=>({x:640,y:640}),locate:()=>({lat:0})},track:{len:0},scale:1,at:()=>new THREE.Vector3(),models:kit,artMaps,materials,texture,yieldTask});
 // Explicit QA only: do not put the full transformed-triangle audit on the phone's startup path.
 function inspectGeometry(){
  scene.updateMatrixWorld(true);let backdropCorridorIntrusions=0,backdropTrianglesChecked=0;const v=new THREE.Vector3();
  const corridors=[];
  if(circuit){
   for(let s=0;s<end;s+=4){
    const box=new THREE.Box3();for(const d of [s,s+2,s+4])for(const side of [-7,7])box.expandByPoint(at(d,side));
    box.min.y-=.25;box.max.y+=4;corridors.push(box);
   }
  }else corridors.push(new THREE.Box3(new THREE.Vector3(-27,2.5,-265),new THREE.Vector3(27,10,75)));
  const bounds=new THREE.Box3(),triangle=new THREE.Box3();
  backdrop.traverse(obj=>{
   if(!obj.isMesh||obj.isInstancedMesh)return;
   const geo=obj.geometry,positions=geo.getAttribute('position'),indices=geo.index,count=indices?.count||positions.count;
   backdropTrianglesChecked+=count/3;
   geo.computeBoundingBox();bounds.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
   const nearby=corridors.filter(box=>bounds.intersectsBox(box));if(!nearby.length)return;
   for(let i=0;i<count;i+=3){
    triangle.makeEmpty();for(let j=0;j<3;j++)triangle.expandByPoint(v.fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(obj.matrixWorld));
    if(nearby.some(box=>triangle.intersectsBox(box)))backdropCorridorIntrusions++;
   }
  });
  return{backdropTrianglesChecked,backdropCorridorIntrusions,corridorSections:corridors.length};
 }
 const waterMat=new THREE.MeshPhysicalMaterial();materials.add(waterMat);lighting.tuneWater(waterMat);if(course.cape)waterMat.color.setHex(0x345668);const water=kit.add(geo(new THREE.PlaneGeometry(circuit?1400:700,circuit?1400:700)),waterMat,scene,0,-2,-100);water.rotation.x=-Math.PI/2;water.castShadow=false;
 if(circuit){
  const ripples=texture(128,128,(ctx,w,h)=>{
   const pixels=ctx.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const a=x*2*Math.PI/w,b=y*2*Math.PI/h,i=(y*w+x)*4;
    const grey=128+44*Math.sin(5*b+1.7*Math.sin(2*a))+24*Math.cos(9*b-3*a);
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=grey;pixels.data[i+3]=255;
   }
   ctx.putImageData(pixels,0,0);
  });
  ripples.colorSpace=THREE.NoColorSpace;ripples.wrapS=ripples.wrapT=THREE.RepeatWrapping;ripples.repeat.set(105,105);
  waterMat.bumpMap=ripples;waterMat.bumpScale=.09;
 }
 const pickupMat=mat(0xd6bd7d,{metalness:.65,roughness:.26,emissive:0x876423,emissiveIntensity:.3}),pickupGeo=geo(new THREE.OctahedronGeometry(.48));
 const colors={turbo:0xe9ae39,shield:0x3ec9ed,magnet:0xb379ef,banana:0xffdc32,rocket:0xfc503c,wave:0xf07361};
 const itemMats=circuit?Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,mat(color,{metalness:.3,roughness:.26,emissive:color,emissiveIntensity:.35})])):{};
 const pickups=course.boxes.flatMap((s,row)=>(circuit?course.lanes(row):[-3.5,0,3.5]).map(lat=>{const object=kit.add(pickupGeo,pickupMat,scene);object.position.copy(at(s,lat,1));return{object,s,row};}));
 return{inspectGeometry,update(time,taken,lap=1){coast?.update(time);if(waterMat.bumpMap)waterMat.bumpMap.offset.y=time*.055;for(const q of pickups){q.object.visible=!taken.has((lap-1)*course.boxes.length+q.row);q.object.rotation.y=time*1.7;if(circuit)q.object.material=itemMats[course.pickupType(q.row,lap-1)];}}, geometry:{roadStart:start,roadEnd:end,halfWidth:6,supportHalfWidth:19,supportBottom:-3,waterY:-2,backdropOffsetZ:backdrop.position.z,backdropRotationY:Math.PI}};
}
