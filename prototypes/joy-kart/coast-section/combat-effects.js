// Soft camera-facing particles: fixed GPU instance pools, no bitmap downloads or per-frame objects.
function createKartCombatEffects(THREE,{scene,kit,course,cars,hazards,materials}){
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
  return {group,sparks,smoke,ring,halo,exhaust};
 });
 return (slot,k,reduced)=>{
  const pool=pools[slot];pool.group.visible=!!k&&k.phase==='running';if(!k)return;
  const fx=kartImpact(k),p=course.point(k.s,k.lat),t=k.time;
  pool.group.position.set(p.x,p.y+(k.lift||0),p.z);pool.group.rotation.y=p.angle;
  const active=fx.burst>0;
  pool.sparks.mesh.visible=active&&!reduced;pool.smoke.mesh.visible=k.slow>0&&!reduced;
  pool.sparks.material.uniforms.ink.value.setHex(fx.blocked?0x8eeeff:0xffcc65);
  if(pool.sparks.mesh.visible){
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
 };
}
