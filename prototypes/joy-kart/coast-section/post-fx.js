/**
 * Nachbearbeitung des Fahrbilds: Die Szene wird mit vollem Helligkeitsumfang gezeichnet, helle Stellen
 * (Sonne, Lack, Funken, Lampen) überstrahlen weich, danach folgen Tonwerte, Farbstimmung, Randabdunklung
 * und eine Tempo-Unschärfe am Bildrand. Ohne passende Grafikfunktionen liefert die Funktion null.
 */
function createKartPostFx(THREE,renderer){
 if(!renderer.capabilities.isWebGL2||!(renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float')))return null;
 const stage=new THREE.Scene(),eye=new THREE.OrthographicCamera(-1,1,1,-1,0,1),size=new THREE.Vector2();
 const triangle=new THREE.BufferGeometry();
 triangle.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 triangle.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
 const screen=new THREE.Mesh(triangle,null);screen.frustumCulled=false;stage.add(screen);
 const buffer=(samples,depthBuffer)=>new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples,depthBuffer,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false});
 const main=buffer(4,true),half=[buffer(0,false),buffer(0,false)],wide=[buffer(0,false),buffer(0,false)];
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 const pass=(uniforms,fragmentShader)=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});
 // Nur was deutlich über Weiß liegt, strahlt über: vier Abgriffe verkleinern das Bild dabei weich.
 const bright=pass({map:{value:null},texel:{value:new THREE.Vector2()},threshold:{value:1.7}},`
  uniform sampler2D map;uniform vec2 texel;uniform float threshold;varying vec2 vUv;
  vec3 pick(vec2 o){vec3 c=min(texture2D(map,vUv+o*texel).rgb,vec3(24.0));float l=max(c.r,max(c.g,c.b));return c*smoothstep(threshold,threshold*2.2,l);}
  void main(){gl_FragColor=vec4((pick(vec2(-1.0,-1.0))+pick(vec2(1.0,-1.0))+pick(vec2(-1.0,1.0))+pick(vec2(1.0,1.0)))*0.25,1.0);}`);
 const blur=pass({map:{value:null},step:{value:new THREE.Vector2()}},`
  uniform sampler2D map;uniform vec2 step;varying vec2 vUv;
  void main(){vec3 c=texture2D(map,vUv).rgb*0.227027;
   c+=(texture2D(map,vUv+step*1.384615).rgb+texture2D(map,vUv-step*1.384615).rgb)*0.316216;
   c+=(texture2D(map,vUv+step*3.230769).rgb+texture2D(map,vUv-step*3.230769).rgb)*0.070270;
   gl_FragColor=vec4(c,1.0);}`);
 const copy=pass({map:{value:null}},'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(map,vUv).rgb,1.0);}');
 const final=pass({map:{value:null},glow:{value:null},haze:{value:null},strength:{value:.42},exposure:{value:1},speed:{value:0},flash:{value:0}},`
  uniform sampler2D map,glow,haze;uniform float strength,exposure,speed,flash;varying vec2 vUv;
  vec3 film(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  void main(){
   vec2 d=vUv-vec2(0.5,0.46);float edge=length(d*vec2(1.0,0.8));
   vec3 c=texture2D(map,vUv).rgb;
   // Tempo: nur der Bildrand verwischt in Fahrtrichtung, die Mitte mit Kart und Strecke bleibt scharf.
   float streak=speed*smoothstep(0.2,0.62,edge);
   if(streak>0.002){
    // Versetzte Abgriffe je Bildpunkt: aus Stufen wird feines Korn statt sichtbarer Doppelbilder.
    float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
    for(int i=0;i<6;i++)c+=texture2D(map,vUv-d*streak*0.026*(float(i)+jitter)).rgb;c/=7.0;
   }
   c+=strength*(texture2D(glow,vUv).rgb*0.6+texture2D(haze,vUv).rgb*0.45);
   c=film(c*exposure);
   float l=dot(c,vec3(0.2126,0.7152,0.0722));
   c=mix(vec3(l),c,1.07);
   // Goldene Lichter, kühle Schatten wie in der Abendsonne.
   c*=mix(vec3(0.95,0.99,1.07),vec3(1.06,1.0,0.93),smoothstep(0.12,0.78,l));
   c=mix(c,c*c*(3.0-2.0*c),0.13);
   c*=mix(0.8,1.0,smoothstep(0.92,0.34,edge));
   c+=flash*vec3(1.0,0.93,0.78);
   gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
   #include <colorspace_fragment>
  }`);
 function draw(material,target){screen.material=material;renderer.setRenderTarget(target);renderer.render(stage,eye);}
 function fit(){
  renderer.getDrawingBufferSize(size);
  if(main.width===size.x&&main.height===size.y)return;
  main.setSize(size.x,size.y);
  const w=Math.max(2,size.x>>2),h=Math.max(2,size.y>>2);
  for(const t of half)t.setSize(w,h);for(const t of wide)t.setSize(Math.max(2,w>>1),Math.max(2,h>>1));
 }
 return {
  target:main,
  /** look: {speed 0..1, flash 0..1, exposure} */
  render(scene,camera,look){
   fit();
   renderer.setRenderTarget(main);renderer.render(scene,camera);
   bright.uniforms.map.value=main.texture;bright.uniforms.texel.value.set(1/main.width,1/main.height);draw(bright,half[0]);
   blur.uniforms.map.value=half[0].texture;blur.uniforms.step.value.set(1/half[0].width,0);draw(blur,half[1]);
   blur.uniforms.map.value=half[1].texture;blur.uniforms.step.value.set(0,1/half[0].height);draw(blur,half[0]);
   copy.uniforms.map.value=half[0].texture;draw(copy,wide[0]);
   blur.uniforms.map.value=wide[0].texture;blur.uniforms.step.value.set(1.6/wide[0].width,0);draw(blur,wide[1]);
   blur.uniforms.map.value=wide[1].texture;blur.uniforms.step.value.set(0,1.6/wide[0].height);draw(blur,wide[0]);
   final.uniforms.map.value=main.texture;final.uniforms.glow.value=half[0].texture;final.uniforms.haze.value=wide[0].texture;
   final.uniforms.speed.value=look.speed||0;final.uniforms.flash.value=look.flash||0;final.uniforms.exposure.value=look.exposure||1;
   draw(final,null);
  },
  dispose(){for(const t of [main,...half,...wide])t.dispose();for(const m of [bright,blur,copy,final])m.dispose();triangle.dispose();}
 };
}
