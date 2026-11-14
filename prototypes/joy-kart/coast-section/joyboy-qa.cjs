// Vollständige App-Fahrt gegen Robo: Katalog → Kap der Winde → Blitzstart, Lenkung, gewürfeltes Item → Ergebnis → Revanche.
// Gebaute App bereitstellen (`npx vite preview --port 4173`) und optional JOY_KART_QA_URL setzen.
// JOY_KART_QA_BROWSER nennt einen anderen Chromium-Browser (z. B. Edge); `--compact` prüft die Ansicht ohne WebGL.
const path=require('node:path'),os=require('node:os'),fs=require('node:fs'),assert=require('node:assert/strict');
const pw=(()=>{try{return require('playwright');}catch{return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}})();
const compact=process.argv.includes('--compact');
(async()=>{
 const browser=await pw.chromium.launch({executablePath:process.env.JOY_KART_QA_BROWSER||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
 const page=await browser.newPage({viewport:{width:852,height:393}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(compact=>{
  if(window.top!==window){if(compact){const real=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...a){return type==='webgl2'||type==='webgl'?null:real.call(this,type,...a);};}return;}
  if(!localStorage.getItem('joyboy:data:v1'))localStorage.setItem('joyboy:data:v1',JSON.stringify({v:1,active:'qa',profiles:[{id:'qa',age:2,avatar:'fuchs',name:'Testfuchs',color:'#fea',stars:0,createdAt:Date.now()}],settings:{sound:false,arcadeAfter:0}}));
 },compact);
 await page.goto(process.env.JOY_KART_QA_URL||'http://127.0.0.1:4173/');await page.getByRole('button',{name:/Joy-Kart/}).first().click();
 await page.getByRole('button',{name:'Kap der Winde',exact:true}).click();
 await page.getByRole('button',{name:/Gegen Robo/}).click();
 const child=page.frameLocator('iframe[title*="Joy-Kart"]'),root=child.locator('#joy-kart-simple'),snap=()=>root.evaluate(el=>el.__duelSnapshot());
 const item=child.locator('[data-action="turbo"]');
 await child.locator('.js-count:not([hidden])').waitFor({timeout:120000});
 assert.match(await item.innerText(),/Blitzstart/);
 // Blitzstart: im letzten halben Countdown-Sekündchen tippen.
 await root.evaluate(el=>new Promise(done=>{const wait=()=>{const s=el.__duelSnapshot?.();s&&s.me.phase==='countdown'&&s.me.countdown<.4?done():setTimeout(wait,15);};wait();}));
 await item.click();
 await root.evaluate(el=>new Promise(done=>{const wait=()=>el.__duelSnapshot?.()?.me.phase==='running'?done():setTimeout(wait,30);wait();}));
 await child.locator('canvas').click({position:{x:10,y:10}});
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(450);await page.keyboard.up('ArrowLeft');
 let k=(await snap()).me;assert.equal(k.stats.startBoost,1);assert.equal(k.lapLength,1728);assert(k.lat<-2.3,'Lenkung: '+k.lat);
 await page.keyboard.press('KeyE');await page.waitForTimeout(300);assert.equal((await snap()).me.stats.turboUses,1);
 // Die nächste Kiste würfelt: Roulette abwarten, das gezogene Item einsetzen.
 const names={turbo:'Turbo',shield:'Schild',magnet:'Magnet',wave:'Welle',banana:'Bananenschale',rocket:'Zielrakete',gulls:'Möwenschwarm',gust:'Windstoß',crab:'Krabbe',spring:'Sprungfeder',ice:'Glatteis',sun:'Sonnenkraft'};
 const drawn=await root.evaluate(el=>new Promise(done=>{let rolled=false;const wait=()=>{const m=el.__duelSnapshot().me;if(m.roll>0)rolled=true;m.item&&!(m.roll>0)&&m.stats.boxes>0?done({item:m.item,rolled}):setTimeout(wait,30);};wait();}));
 assert(drawn.item in names);assert.equal(drawn.rolled,true,'Roulette lief');
 await item.filter({hasText:names[drawn.item]}).waitFor({timeout:5000});
 const folder=path.join(__dirname,'qa/joyboy');fs.mkdirSync(folder,{recursive:true});
 await page.screenshot({path:path.join(folder,(compact?'kompakt':'kap')+'-zufallsitem.png')});
 await page.keyboard.press('KeyE');await page.waitForTimeout(400);
 k=(await snap()).me;assert.equal(k.stats.itemUses[drawn.item],drawn.item==='turbo'?2:1,'eingesetzt: '+drawn.item);
 await page.getByRole('button',{name:/Nochmal spielen/}).waitFor({timeout:compact?300000:1800000});
 await page.getByText(/Beste Runde/).first().waitFor();
 const stats=await page.evaluate(()=>JSON.parse(localStorage.getItem('joyboy:data:v1')).profiles[0].games.joykart);
 assert(stats.kartLaps.kap>0 && stats.kartLaps.kap<60);await page.getByRole('button',{name:/Nochmal spielen/}).click();
 await child.locator('.js-count:not([hidden])').waitFor({timeout:120000});assert.deepEqual(errors,[]);
 console.log('App-Katalog → Robo → Blitzstart, Lenkung, Turbo → gewürfeltes Item ('+names[drawn.item]+') → Ergebnis und Profil → Revanche bestanden.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
