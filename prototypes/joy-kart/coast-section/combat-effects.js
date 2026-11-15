// Soft camera-facing particles: fixed GPU instance pools, no bitmap downloads or per-frame objects.
function createKartCombatEffects(THREE,{scene,kit,course,cars,hazards,materials,camera}){
 // Möwen: drei gebündelte Zeichenaufrufe je Schwarm, Flügelschlag über die Instanzmatrizen.
 const gullWhite=kit.material(0xfbf9f1,{roughness:.8,emissive:0x8a8a84,emissiveIntensity:.35}),gullGrey=kit.material(0xdfe6e8,{roughness:.8,side:THREE.DoubleSide,emissive:0x6f787c,emissiveIntensity:.35});
 const gullBody=kit.geometry(new THREE.SphereGeometry(1,10,8)),gullWing=kit.geometry(new THREE.BufferGeometry());
 gullWing.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.2,0,0,.22,.8,.1,-.1,.8,.1,-.1,0,0,.22,.85,.1,.2,.8,.1,-.1,.85,.1,.2,1.55,-.06,.12],3));gullWing.computeVertexNormals();
 function flock(parent,count){
  const group=new THREE.Group(),dummy=new THREE.Object3D(),parts=[gullBody,gullWing,gullWing].map((g,i)=>{
   const mesh=new THREE.InstancedMesh(g,i?gullGrey:gullWhite,count);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);return mesh;});
  group.visible=false;parent.add(group);
  return {group,place(i,x,y,z,heading,size,flap){
   dummy.position.set(x,y,z);dummy.rotation.set(0,heading,0);dummy.scale.set(size*.17,size*.15,size*.5);dummy.updateMatrix();parts[0].setMatrixAt(i,dummy.matrix);
   dummy.scale.setScalar(size);
   for(const side of [1,-1]){dummy.rotation.set(0,heading+(side<0?Math.PI:0),flap,'YXZ');dummy.updateMatrix();parts[side>0?1:2].setMatrixAt(i,dummy.matrix);}
  },flush(){for(const part of parts)part.instanceMatrix.needsUpdate=true;}};
 }
 // Vor der eigenen Kamera versperrt der Schwarm die Sicht; über dem anderen Kart zeigt er nur den Treffer an.
 const screenFlock=flock(camera,16),kartFlocks=cars.map(()=>flock(scene,6));
 const noise=n=>{const x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
 const basic=(color,opacity=1)=>kit.material(color,{transparent:true,opacity,depthWrite:false,emissive:color,emissiveIntensity:.6,roughness:1});
 const ringGeo=kit.geometry(new THREE.TorusGeometry(1,.035,8,64));
 function particles(count,color,glow=false){
  const quad=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();
  g.setIndex(quad.index.clone());g.setAttribute('position',quad.attributes.position.clone());g.setAttribute('uv',quad.attributes.uv.clone());quad.dispose();
  const offsets=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3),shapes=new THREE.InstancedBufferAttribute(new Float32Array(count*4),4);
  offsets.setUsage(THREE.DynamicDrawUsage);shapes.setUsage(THREE.DynamicDrawUsage);g.setAttribute('offset',offsets);g.setAttribute('shape',shapes);g.instanceCount=count;kit.geometry(g);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:glow?THREE.AdditiveBlending:THREE.NormalBlending,
   uniforms:{ink:{value:new THREE.Color(color)},glow:{value:glow?1:0}},
   vertexShader:`attribute vec3 offset;attribute vec4 shape;varying vec2 vUv;varying float vFade;
    void main(){vUv=uv;vec4 centre=modelViewMatrix*vec4(offset,1.0);vec2 p=position.xy*shape.xy;
     float c=cos(shape.z),s=sin(shape.z);centre.xy+=mat2(c,s,-s,c)*p;
     vFade=shape.w*(1.0-smoothstep(65.0,135.0,-centre.z));gl_Position=projectionMatrix*centre;}`,
   fragmentShader:`uniform vec3 ink;uniform float glow;varying vec2 vUv;varying float vFade;
    void main(){vec2 p=vUv*2.0-1.0;float r=length(p);
     float edge=1.0-smoothstep(.45,1.0,r);float soft=exp(-dot(p,p)*2.8)*edge;
     float wisps=.86+.14*sin(p.x*9.0+p.y*4.0)*sin(p.y*11.0-p.x*3.0);
     float alpha=soft*mix(wisps,1.0,glow)*vFade;if(alpha<.004)discard;
     gl_FragColor=vec4(mix(ink,vec3(1.0),glow*soft*.45),alpha);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  // Register with the same material lifetime as the rest of the scene.
  materials.add(material);
  const mesh=new THREE.Mesh(g,material);mesh.frustumCulled=false;
  return {mesh,material,set(i,x,y,z,w,h,spin,alpha){offsets.setXYZ(i,x,y,z);shapes.setXYZW(i,w,h,spin,alpha);},flush(){offsets.needsUpdate=true;shapes.needsUpdate=true;}};
 }
 const pools=cars.map((car,i)=>{
  const group=new THREE.Group();scene.add(group);
  const sparks=particles(16,0xffd18a,true),smoke=particles(8,0xc0cac8);group.add(sparks.mesh,smoke.mesh);
  const ring=kit.add(ringGeo,basic(0x9bf1ff),group,0,.12,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
  const halo=kit.add(ringGeo,basic(0xffdf65,.65),hazards[i].banana,0,.02,0);halo.rotation.x=-Math.PI/2;halo.scale.setScalar(.95);halo.castShadow=false;
  const marker=kit.add(kit.geometry(new THREE.SphereGeometry(.14,16,10)),basic(0xffdd55),hazards[i].banana,0,1.05,0);marker.castShadow=false;
  const seeker=kit.add(kit.geometry(new THREE.TorusGeometry(.5,.022,8,48)),basic(0xff9472,.65),hazards[i].rocket,0,0,.45);seeker.castShadow=false;
  const band=kit.add(kit.geometry(new THREE.CylinderGeometry(.21,.21,.14,24)),basic(0xfff0cf),hazards[i].rocket,0,0,.12);band.rotation.x=Math.PI/2;band.castShadow=false;
  const exhaust=particles(5,0xffad56,true);hazards[i].rocket.add(exhaust.mesh);
  // Specials: Sonnenkraft-Schein, Eisfläche, Windfahnen und Staub beim scharfen Lenken.
  const sun=kit.add(kit.geometry(new THREE.SphereGeometry(1,28,18)),basic(0xff8a00,.5),group,0,1,0);sun.material.blending=THREE.AdditiveBlending;sun.castShadow=false;
  const frost=kit.add(kit.geometry(new THREE.CircleGeometry(1,40)),basic(0x7fd4ff,.5),group,0,.07,0);frost.rotation.x=-Math.PI/2;frost.castShadow=false;
  const ice=kit.add(kit.geometry(new THREE.IcosahedronGeometry(1,1)),kit.material(0x86d6ff,{transparent:true,opacity:.34,roughness:.08,metalness:.3,flatShading:true,depthWrite:false,emissive:0x2a86c8,emissiveIntensity:.6}),group,0,1,0);ice.scale.set(1.5,1.35,1.9);ice.castShadow=false;
  const wind=particles(8,0xeafcff),dust=particles(6,0xd9c8a4),grind=particles(10,0xffb347,true);group.add(wind.mesh,dust.mesh,grind.mesh);
  const crabRing=kit.add(ringGeo,basic(0xff8a6a,.7),hazards[i].crab,0,.03,0);crabRing.rotation.x=-Math.PI/2;crabRing.scale.setScalar(1.5);crabRing.castShadow=false;
  return {group,sparks,smoke,ring,halo,exhaust,sun,frost,ice,wind,dust,grind,crabRing};
 });
 return (slot,k,reduced,viewer=false)=>{
  const pool=pools[slot],birds=kartFlocks[slot],blinded=!!k&&k.phase==='running'&&k.gulls>0;pool.group.visible=!!k&&k.phase==='running';
  birds.group.visible=blinded&&!viewer;if(viewer)screenFlock.group.visible=blinded;
  if(!k)return;
  if(blinded){
   const fade=Math.min(1,k.gulls/.5,(4.5-k.gulls)/.35+.2),clock=reduced?k.time*.4:k.time;
   if(viewer){
    for(let n=0;n<16;n++){
     const dir=n%2?1:-1,x=dir*(((clock*(.2+noise(n)*.2)+noise(n+9))%1)*8-4);
     screenFlock.place(n,x,-.85+noise(n+3)*1.9+.16*Math.sin(clock*3+n),-2.2-noise(n+5)*2.8,dir*.5,(.42+noise(n+7)*.34)*fade,.15+Math.sin(clock*11+n*2)*.6);
    }screenFlock.flush();
   }else{
    const p=course.point(k.s,k.lat);
    for(let n=0;n<6;n++){const a=clock*2.3+n*Math.PI/3;birds.place(n,p.x+Math.sin(a)*1.7,p.y+2.3+(k.lift||0)+.35*Math.sin(clock*4+n),p.z+Math.cos(a)*1.7,a+Math.PI/2,.62*fade,.15+Math.sin(clock*11+n*2)*.6);}
    birds.flush();
   }
  }
  const fx=kartImpact(k),p=course.point(k.s,k.lat),t=k.time;
  pool.group.position.set(p.x,p.y+(k.lift||0),p.z);pool.group.rotation.y=p.angle;
  const active=fx.burst>0;
  // Kiste eingesammelt: bunte Funken steigen auf, solange das Roulette läuft.
  const shining=!active&&k.sun>0,picked=!active&&!shining&&k.roll>.2;
  pool.sparks.mesh.visible=(active||shining||picked)&&!reduced;pool.smoke.mesh.visible=k.slow>0&&!reduced;
  if(picked)pool.sparks.material.uniforms.ink.value.setHSL((t*1.6)%1,.9,.66);
  else pool.sparks.material.uniforms.ink.value.setHex(fx.blocked?0x8eeeff:0xffcc65);
  if(pool.sparks.mesh.visible&&picked){
   const rise=1-(k.roll-.2)/.6;
   for(let n=0;n<16;n++){const a=n*2.399;pool.sparks.set(n,Math.sin(a)*(.5+rise*1.1),.9+rise*(1.3+n%4*.3),Math.cos(a)*(.5+rise*1.1),.15,.3,a,(1-rise)*.95);}
   pool.sparks.flush();
  }else if(pool.sparks.mesh.visible&&shining){
   for(let n=0;n<16;n++){const a=n*2.399+t*3.2,rise=(t*.9+n/16)%1;pool.sparks.set(n,Math.sin(a)*1.5,.3+rise*2.1,Math.cos(a)*1.8,.16,.3,a,.9*Math.sin(rise*Math.PI));}
   pool.sparks.flush();
  }else if(pool.sparks.mesh.visible){
   for(let n=0;n<16;n++){
    const a=n*2.399,r=.6+(1-fx.burst)*(2.6+n%3*.3);
    pool.sparks.set(n,Math.sin(a)*r,1.1+Math.sin(n*4)*.4+(1-fx.burst)*1.3,Math.cos(a)*r,.12,.28,a,fx.burst*.9);
   }pool.sparks.flush();
  }
  if(pool.smoke.mesh.visible){
   for(let n=0;n<8;n++){
    const age=(t*1.7+n/8)%1,size=.35+age*1.15;
    pool.smoke.set(n,(n%2?1:-1)*(.94+age*.13),.2+age*.5,-.7-age*2.9,size,size*.8,n*.8+age*.4,.6*Math.sin(age*Math.PI));
   }pool.smoke.flush();
  }
  pool.ring.visible=k.blocked>0||active;
  pool.ring.material.color.setHex(fx.blocked?0x95f4ff:0xffbd5b);pool.ring.material.emissive.copy(pool.ring.material.color);
  pool.ring.scale.setScalar(reduced?1.8:1.1+(1-fx.burst)*2);pool.ring.material.opacity=k.blocked>0?Math.min(.65,k.blocked):fx.burst*.55;
  pool.halo.scale.setScalar(reduced?.95:.95+Math.sin(t*5)*.06);
  for(let n=0;n<5;n++){const size=.38+n*.1;pool.exhaust.set(n,0,0,-.8-n*.5,size,size,reduced?0:t+n,(1-n/5)*.65);}
  pool.exhaust.flush();
  cars[slot].shieldEffect.material.opacity=reduced?.20:.20+.035*Math.sin(t*4);
  pool.sun.visible=k.sun>0;
  if(pool.sun.visible){const pulse=reduced?0:Math.sin(t*9)*.07,fade=Math.min(1,k.sun/.6);pool.sun.scale.set((1.75+pulse)*fade,(1.55+pulse)*fade,(2.2+pulse)*fade);pool.sun.material.opacity=.42+.08*Math.sin(t*5);}
  pool.frost.visible=pool.ice.visible=k.ice>0;
  if(k.ice>0){const fade=Math.min(1,k.ice/.5);pool.frost.scale.setScalar(2.3*fade);pool.frost.material.opacity=.42*fade;pool.ice.material.opacity=.3*fade;pool.ice.rotation.y=reduced?0:t*.6;}
  // Windfahnen: quer beim Windstoß, längs im Windschatten.
  const gust=k.gust>0,draft=!gust&&k.draft>.15&&k.grounded!==false;
  pool.wind.mesh.visible=(gust||draft)&&!reduced;
  if(pool.wind.mesh.visible){
   for(let n=0;n<8;n++){
    const age=(t*(gust?2.6:3.4)+n/8)%1,alpha=Math.sin(age*Math.PI)*(gust?.75:.5*k.draft);
    if(gust)pool.wind.set(n,(-2.6+age*5.2)*k.gustDir,.5+(n%4)*.38,-1.4+(n%3)*1.3,1.5,.07,0,alpha);
    else pool.wind.set(n,(n%2?1:-1)*(.55+(n%4)*.22),.55+(n%3)*.42,5-age*7,.06,1.6,0,alpha);
   }pool.wind.flush();
  }
  const sliding=k.grounded!==false&&k.v>12&&(Math.abs(k.latV||0)>4.2||k.ice>0);
  pool.dust.mesh.visible=sliding&&!reduced&&!(k.slow>0);
  if(pool.dust.mesh.visible){
   for(let n=0;n<6;n++){const age=(t*2.4+n/6)%1,size=.25+age*.7;pool.dust.set(n,(n%2?1:-1)*.85-Math.sign(k.latV||0)*age*.5,.16+age*.3,-.9-age*2.2,size,size*.7,n+age,.38*Math.sin(age*Math.PI));}
   pool.dust.flush();
  }
  // Beim scharfen Lenken sprühen Funken vom kurvenäußeren Hinterrad.
  const hard=k.grounded!==false&&k.v>16&&Math.abs(k.latV||0)>5&&!(k.ice>0);
  pool.grind.mesh.visible=hard&&!reduced;
  if(pool.grind.mesh.visible){
   const out=Math.sign(k.latV);
   for(let n=0;n<10;n++){const age=(t*5.5+n/10+noise(n)*.3)%1,fly=age*age;pool.grind.set(n,-out*(.92+fly*.9*noise(n+4)),.14+age*(.5+noise(n+2)*.5)-fly*.5,-.75-age*(1.4+noise(n+6)),.07,.22+age*.2,n*1.3,(1-age)*.95);}
   pool.grind.flush();
  }
  pool.crabRing.scale.setScalar(reduced?1.5:1.5+Math.sin(t*6)*.12);
 };
}
