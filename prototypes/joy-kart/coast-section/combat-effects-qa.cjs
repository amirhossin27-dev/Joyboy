// Exercise the shipped iframe API with real contacts, then inspect deterministic effect frames.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {PNG}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const webkit=process.argv.includes('--webkit'),out=path.join(__dirname,process.env.JOY_KART_QA_OUTPUT||'qa/combat',webkit?'webkit':'edge');
const built=fs.readFileSync(path.join(__dirname,'../dist/Joy-Kart-PC.html'));
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');
 if(req.url.startsWith('/kart'))return res.end(built);
 res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/kart#joyboy-robo-'+(req.url.includes('kap')?'kap':'bucht')+'"></iframe>');});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],checks=[];
 try{
  browser=webkit?await pw.webkit.launch():await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  fs.mkdirSync(out,{recursive:true});
  for(const variant of ['bucht','kap','kompakt']){
   const page=await browser.newPage({viewport:{width:852,height:283},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
   if(variant==='kompakt')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:get.call(this,t,...args);};});
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+variant);const frame=page.frames().find(f=>f.url().includes('/kart'));
   await frame.waitForFunction(()=>!!window.joyKartRace,null,{timeout:90000});
   const capture=async name=>{
    let bytes;
    if(webkit&&variant!=='kompakt'&&(process.argv.includes('--isolated-captures')||name.endsWith('-hochformat.png'))){
     // Windows WebKit can lose snapshot layers after changing viewport size.
     // Reproduce the exact authoritative state on a fresh page for each capture;
     // the original page still runs the full uninterrupted functional sequence.
     const state=await frame.evaluate(()=>document.querySelector('#joy-kart-simple').__duelSnapshot());
     const reducedMotion=await frame.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'reduce':'no-preference');
     const shot=await browser.newPage({viewport:page.viewportSize(),reducedMotion});shot.on('pageerror',e=>errors.push(e.message));
     try{
      await shot.goto(page.url());const target=shot.frames().find(f=>f.url().includes('/kart'));
      await target.waitForFunction(()=>!!window.joyKartRace,null,{timeout:90000});
      await target.evaluate(state=>{const grid=state.slot?[state.other,state.me]:[state.me,state.other];window.joyKartRace.restore(grid);window.joyKartRace.show(grid,state.slot);},state);
      await target.evaluate(()=>new Promise(resolve=>{let n=14;function tick(){if(--n)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}));
      bytes=await shot.screenshot({path:path.join(out,name)});
     }finally{await shot.close();}
    }else bytes=await page.screenshot({path:path.join(out,name)});
    if(variant==='kompakt')return;
    // Never accept a working HUD over an empty 3D scene.
    // Inspect actual pixels between the HUD and controls, not just DOM visibility.
    const png=PNG.sync.read(bytes),colors=new Set();
    for(let y=Math.floor(png.height*.45);y<png.height*.70;y+=3)for(let x=Math.floor(png.width*.25);x<png.width*.75;x+=3){
     const n=(y*png.width+x)*4;colors.add((png.data[n]>>3)+','+(png.data[n+1]>>3)+','+(png.data[n+2]>>3));
    }
    assert(colors.size>80,name+': scene missing behind HUD ('+colors.size+' colors)');
   };
   const settle=()=>frame.evaluate(()=>new Promise(resolve=>{let n=14;function tick(){if(--n)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}));
   await frame.evaluate(()=>{
    const api=window.joyKartRace;api.begin();let grid;for(let i=0;i<110;i++)grid=api.advance(1/30,[{steer:0,turbo:false},{steer:0,turbo:false}]);
    window.base=grid.map((k,i)=>({...k,s:160+i*16,lat:i?2:0,v:38,speedKmh:137,time:10,item:null,shield:0,slow:0,blocked:0,impact:null,banana:null,rocket:null}));
    window.scene=(kind)=>{
     const g=structuredClone(window.base);
     if(kind==='rocket'){g[0].item='shield';g[1].rocket={s:g[0].s+20,lat:.4};}
     if(kind==='banana')g[1].banana={s:g[0].s+12,lat:0};
     api.restore(g);api.show(g,0);return g;
    };
    window.contact=(item,shield=false)=>{
     const g=structuredClone(window.base);g[1][item]={s:g[0].s+(item==='banana'?.3:2),lat:0};g[0].shield=shield?12:0;
     api.restore(g);let hit=api.advance(.05,[{steer:0,turbo:false},{steer:0,turbo:false}]);api.show(hit,0);return hit;
    };
    window.scene('rocket');
   });
   await frame.waitForFunction(()=>document.querySelector('.js-combat').dataset.kind==='rocket');await settle();
   assert.match(await frame.locator('.js-combat').innerText(),/Schild einsetzen/);
   const badge=await frame.locator('.js-combat').boundingBox(),rank=await frame.locator('.js-race-info').boundingBox();assert(badge.x>rank.x+rank.width&&badge.y+badge.height<65);
   await capture(variant+'-rakete.png');
   await frame.evaluate(()=>window.scene('banana'));await settle();assert.match(await frame.locator('.js-combat').innerText(),/Spur wechseln/);
   await capture(variant+'-banane.png');
   for(const item of ['rocket','banana']){
    const hit=await frame.evaluate(item=>window.contact(item),item);assert(hit[0].slow>0&&hit[0].impact.item===item);
    // Advance a fraction of a second to show the spreading burst and actual deceleration.
    const after=await frame.evaluate(()=>{const a=window.joyKartRace,g=a.advance(.2,[{steer:0,turbo:false},{steer:0,turbo:false}]);a.show(g,0);return g;});
    assert(after[0].v<hit[0].v);await settle();assert.equal(await frame.locator('.js-combat').getAttribute('data-kind'),'slow');
    await capture(variant+'-treffer-'+item+'.png');
   }
   const blocked=await frame.evaluate(()=>window.contact('rocket',true));assert.equal(blocked[0].slow,0);assert(blocked[0].impact.blocked);await settle();
   assert.match(await frame.locator('.js-combat').innerText(),/abgewehrt/);await capture(variant+'-schild.png');
   await page.emulateMedia({reducedMotion:'reduce'});await frame.evaluate(()=>window.contact('banana'));await settle();
   assert.equal(await frame.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
   await capture(variant+'-ruhig.png');
   await frame.evaluate(()=>{const a=window.joyKartRace;let g;for(let i=0;i<16;i++)g=a.advance(.25,[{steer:0,turbo:false},{steer:0,turbo:false}]);a.show(g,0);});await settle();
   assert.equal(await frame.locator('.js-combat').isVisible(),false);
   // The guest sees the same authoritative hit, using the opposite seat.
   await frame.evaluate(()=>{const g=window.contact('rocket');window.joyKartRace.show([g[1],g[0]],1);});await settle();assert.match(await frame.locator('.js-combat').innerText(),/Raketentreffer/);
   await page.setViewportSize({width:390,height:844});await settle();const small=await frame.locator('.js-combat').boundingBox();assert(small.x>=0&&small.x+small.width<=390);
   await capture(variant+'-hochformat.png');
   checks.push(variant+': threats, contacts, slowdown, shield, recovery, guest, reduced motion, layouts, visible scene pixels');await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,visualCapture:webkit?(process.argv.includes('--isolated-captures')?'Fresh page per 3D snapshot':'Continuous landscape; fresh portrait snapshot after viewport change'):'Continuous page',sha256:require('node:crypto').createHash('sha256').update(built).digest('hex'),checks,errors},null,2));console.log(checks.join('\n'));
 }finally{await browser?.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
