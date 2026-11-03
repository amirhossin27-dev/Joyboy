// Use the shipped offline file and Joyboy's regular iframe API to reproduce exact track views.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const os=require('node:os'),path=require('node:path');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const built=fs.readFileSync(path.join(__dirname,'../dist/Joy-Kart-PC.html'));
const webkit=process.argv.includes('--webkit');
const out=path.join(__dirname,'qa/joyboy',webkit?'webkit':'');
const server=http.createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 if(req.url.startsWith('/kart.html'))return res.end(built);
 const course=req.url.includes('kap')?'kap':'bucht';
 res.end('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*{margin:0}iframe{width:100vw;height:100vh;border:0;display:block}</style><iframe src="/kart.html#joyboy-robo-'+course+'"></iframe>');
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=webkit?await pw.webkit.launch():await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  fs.mkdirSync(out,{recursive:true});const errors=[];
  for(const variant of ['bucht','kap','kompakt']){
   const compact=variant==='kompakt',cape=variant==='kap';
   const page=await browser.newPage({...(webkit?pw.devices['iPhone 15 landscape']:{}),viewport:{width:852,height:283},hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   if(compact)await page.addInitScript(()=>{
    const real=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:real.call(this,type,...args);};
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+variant);
   const frame=page.frames().find(f=>f.url().includes('/kart.html'));
   // The fixture jumps between distant track positions. Let the chase camera settle
   // in rendered frames even when a software WebKit renderer is slow.
   const settle=()=>frame.evaluate(()=>new Promise(resolve=>{
    let left=14;const step=()=>{if(--left===0)resolve();else requestAnimationFrame(step);};requestAnimationFrame(step);
   }));
   await frame.waitForFunction(()=>!!window.joyKartRace,null,{timeout:90000});
   if(!compact)assert(await frame.evaluate(()=>typeof document.querySelector('#joy-kart-simple').__duelGeometry==='function'));
   await frame.evaluate(()=>{
    const race=window.joyKartRace;race.begin();
    window.driveTo=(distance)=>{
     let grid;
     do{grid=race.advance(1/30,[{steer:0,turbo:false},null]);}while(grid[0].s<distance);
     race.show(grid,0);return grid;
    };
   });
   await frame.evaluate(s=>window.driveTo(s),cape?220:180);
   await frame.locator('.js-line:not([hidden])').waitFor();
   await settle();
   await page.screenshot({path:path.join(out,variant+'-tor.png')});
   const pad=await frame.locator('.js-pad').boundingBox(),item=await frame.locator('.js-turbo').boundingBox();
   assert(pad.width>=44 && item.width>=44 && pad.y+pad.height<=283 && item.y+item.height<=283 && pad.x+pad.width<item.x,JSON.stringify({pad,item}));
   assert.match(await frame.locator('.js-line').textContent(),cape?/rechts/:/links/);
   if(!compact){
    await frame.evaluate(s=>window.driveTo(s),Math.round((cape?1728:1664)*.45)-31);
    await settle();
    await page.screenshot({path:path.join(out,variant+'-bruecke.png')});
   }
   // A pursuer on the opposite lane should be visible in the rear-facing camera.
   await frame.evaluate(()=>{
    const race=window.joyKartRace,grid=race.advance(1/30,[{steer:0,turbo:false},null]);
    race.show([grid[0],{...grid[1],s:grid[0].s-12,lat:grid[0].lat+2}],0);
   });
   const mirror=frame.locator('[data-action="rear"]');
   const button=await mirror.boundingBox();
   assert(button.width>=44 && button.height>=44 && button.y+button.height<=item.y);
   await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();
   assert.equal(await mirror.getAttribute('aria-pressed'),'true');
   await page.waitForTimeout(120);await page.screenshot({path:path.join(out,variant+'-rueckblick.png')});
   await page.mouse.up();assert.equal(await mirror.getAttribute('aria-pressed'),'false');
   await page.keyboard.down('KeyR');assert.equal(await mirror.getAttribute('aria-pressed'),'true');
   await page.keyboard.up('KeyR');assert.equal(await mirror.getAttribute('aria-pressed'),'false');
   // Present a real finish snapshot while the opponent still has a few metres to go.
   const finish=await frame.evaluate(()=>{
    const grid=window.driveTo(window.joyKartRace.advance(1/30,[{steer:0,turbo:false},null])[0].lapLength*3);
    const winner=grid[0];window.finishGrid=[winner,{...grid[1],phase:'running',s:winner.s-14,time:winner.time}];
    window.joyKartRace.show(window.finishGrid,0);
    return {s:winner.s,time:winner.time,v:winner.v};
   });
   const note=frame.locator('.js-finish-note');
   await note.waitFor({state:'visible'});
   await page.waitForTimeout(750);
   const speed=Number(await frame.locator('.js-speed strong').innerText());
   assert(speed>0 && speed<Math.round(finish.v*3.6));
   assert.equal(await frame.evaluate(()=>window.finishGrid[0].time),finish.time);
   assert.equal(await frame.evaluate(()=>window.finishGrid[0].s),finish.s);
   await page.screenshot({path:path.join(out,variant+'-ausrollen.png')});
   await page.close();
  }
  // Start using the offline solo controls with WebGL unavailable.
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
  await page.goto('http://127.0.0.1:'+server.address().port+'/kart.html');
  await page.getByRole('button',{name:'Gegen Computer starten'}).click();
  await page.locator('.js-turbo:enabled').waitFor();await page.locator('.js-turbo').click();
  await page.waitForFunction(()=>Number(document.querySelector('.js-speed strong').textContent)>155);
  assert.deepEqual(errors,[]);console.log('Beide Kurse mit Toren und Brücken, Touchflächen bei 852 × 283 sowie Rückblick, Loslassen, bewegte Zielfahrt und kompakte PC-Fahrt bestanden.');
 }finally{await browser?.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
