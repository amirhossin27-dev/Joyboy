const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const pw=require(path.join(runtime,'playwright')),{PNG}=require(path.join(runtime,'pngjs'));
const phase=process.argv.includes('--before')?'before':'after',webkit=process.argv.includes('--webkit');
const out=path.join(__dirname,process.env.JOY_KART_QA_OUTPUT||'qa/graphics-softening',phase,webkit?'webkit':'edge');fs.mkdirSync(out,{recursive:true});
const raw=fs.readFileSync(process.env.JOY_KART_QA_HTML||path.join(__dirname,'../dist/Joy-Kart-PC.html'),'utf8');
// Record the normal camera and render cost. On compositor failure, capture the same scene directly from WebGL.
const html=raw.replace('root.__duelGeometry=world.inspectGeometry;',`root.__duelGeometry=world.inspectGeometry;
 root.__captureWebGL=()=>{renderer.render(scene,camera);return canvas.toDataURL('image/png');};
 root.__cameraSettled=()=>camera.position.distanceTo(cameraDesired)<.0001 && look.distanceTo(lookDesired)<.0001;
 root.__graphics=()=>({camera:camera.position.toArray(),look:look.toArray(),fov:camera.fov,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,ratio:renderer.getPixelRatio(),samples:renderer.getContext().getParameter(renderer.getContext().SAMPLES)});`);
assert.notEqual(raw,html);
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');if(req.url.startsWith('/kart'))return res.end(html);res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/kart#joyboy-robo-'+(req.url.includes('kap')?'kap':'bucht')+'"></iframe>');});
function sceneColors(bytes){
 const png=PNG.sync.read(bytes),colors=new Set();
 for(let y=Math.floor(png.height*.45);y<png.height*.70;y+=3)for(let x=Math.floor(png.width*.25);x<png.width*.75;x+=3){
  const i=(y*png.width+x)*4;colors.add((png.data[i]>>3)+','+(png.data[i+1]>>3)+','+(png.data[i+2]>>3));
 }
 return colors.size;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],results=[];
 try{
  browser=webkit?await pw.webkit.launch():await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const emptyCaptures=[];
  const cases=[['bucht-town',160,1280,720],['bucht-phone',160,852,283],['bucht-bridge',718,852,393],['kap-coast',96,1280,720],['kap-shore',112,852,283],['kap-bridge',748,852,393],['bucht-hit',160,852,283],['kap-close',160,390,844]];
  for(const [name,distance,width,height] of cases){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+name);const frame=page.frames().find(f=>f.url().includes('/kart'));
   await frame.waitForFunction(()=>!!window.joyKartRace,null,{timeout:90000});
   await frame.evaluate(({distance,name})=>{
    const a=window.joyKartRace;a.begin();let grid;for(let i=0;i<110;i++)grid=a.advance(1/30,[{steer:0,turbo:false},{steer:0,turbo:false}]);
    grid=grid.map((k,i)=>({...k,s:distance+i*16,lat:i?1.7:0,v:38,speedKmh:137,time:10,shield:0,boost:0,slow:0,blocked:0,impact:null,item:null,banana:null,rocket:null,grounded:true,lift:0}));
    if(name.endsWith('hit')){grid[1].banana={s:distance+.3,lat:0};a.restore(grid);grid=a.advance(.05,[{steer:0,turbo:false},{steer:0,turbo:false}]);grid=a.advance(.2,[{steer:0,turbo:false},{steer:0,turbo:false}]);}
    a.restore(grid);a.show(grid,name.endsWith('close')?1:0);
   },{distance,name});
   await frame.evaluate(()=>new Promise(resolve=>{let n=24;function f(){if(--n)requestAnimationFrame(f);else resolve();}requestAnimationFrame(f);}));
   await frame.waitForFunction(()=>document.querySelector('#joy-kart-simple').__cameraSettled(),null,{timeout:20000});
   const stats=await frame.evaluate(()=>document.querySelector('#joy-kart-simple').__graphics());
   assert(stats.calls>10&&stats.triangles>10000,'3D did not render');
   const bytes=await page.screenshot({path:path.join(out,name+'.png')});
   stats.compositeColors=sceneColors(bytes);
   if(stats.compositeColors<=80){
    emptyCaptures.push(name);
    const url=await frame.evaluate(()=>document.querySelector('#joy-kart-simple').__captureWebGL());
    const gpu=Buffer.from(url.slice(url.indexOf(',')+1),'base64');
    fs.writeFileSync(path.join(out,name+'-webgl.png'),gpu);stats.framebufferColors=sceneColors(gpu);
   }
   if(name==='bucht-town'||name==='kap-coast'){const audit=await frame.evaluate(()=>document.querySelector('#joy-kart-simple').__duelGeometry());assert.equal(audit.backdropCorridorIntrusions,0);stats.audit=audit;}
   if(process.env.JOY_KART_FRAME_TIMES && ['bucht-phone','kap-bridge'].includes(name)){
    stats.driveTiming=await frame.evaluate(async()=>{
     const times=[],api=window.joyKartRace,inputs=[{steer:0,turbo:false},null];
     let previous;
     for(let i=0;i<72;i++){
      const now=await new Promise(requestAnimationFrame);
      if(i>=12)times.push(now-previous);
      api.show(api.advance(1/30,inputs),0);previous=now;
     }
     times.sort((a,b)=>a-b);
     return {frames:times.length,medianMs:times[29],p95Ms:times[56],endRatio:document.querySelector('#joy-kart-simple').__graphics().ratio};
    });
   }
   results.push({name,...stats});await page.close();
  }
  const scenePassed=errors.length===0 && results.length===cases.length &&
   results.every(r=>r.compositeColors>80 || r.framebufferColors>80);
  const passed=scenePassed && emptyCaptures.length===0;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed,phase,sha256:require('node:crypto').createHash('sha256').update(raw).digest('hex'),results,errors,scenePassed,emptyCaptures},null,2));console.log(JSON.stringify({passed,scenePassed,emptyCaptures,errors}));assert(passed,'Incomplete graphics run');
 }finally{await browser?.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
