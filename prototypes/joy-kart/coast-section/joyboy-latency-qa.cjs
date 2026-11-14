// Zwei getrennte Joyboy-Apps fahren über eine künstlich langsame Verbindung gegeneinander.
// Start: gebaute App mit `npx vite preview --port 4173` bereitstellen, dann
//   node prototypes/joy-kart/coast-section/joyboy-latency-qa.cjs [Verzögerung in ms] [Schwankung in ms]
// Die Testdatenbank spricht wie Firebase (REST + Ereignis-Stream) und verzögert jede Nachricht.
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const LATENCY=Number(process.argv[2]??180),JITTER=Number(process.argv[3]??120),URL_APP=process.env.JOY_KART_QA_URL||'http://127.0.0.1:4173/';
const code='abc123',at=Date.now(),doc=uid=>({name:uid,avatar:uid==='host'?'fuchs':'panda',color:'#baceda',at});
const room={info:{host:'host',allowed:{guest:1},known:{guest:true},robos:0,status:'lobby',game:'joykart',level:0,round:0,at},seats:{host:doc('host'),guest:doc('guest')}};
const db={rooms:{[code]:room}},streams=new Set();let writes=0,bytes=0;
const get=keys=>keys.reduce((o,k)=>o?.[k],db)??null;
function put(keys,data){let o=db;for(const k of keys.slice(0,-1))o=o[k]??={};if(data===null)delete o[keys.at(-1)];else o[keys.at(-1)]=data;}
const wait=ms=>new Promise(r=>setTimeout(r,ms)),lag=()=>LATENCY/2+Math.random()*JITTER/2;
function send(s,type,path,data){const text='event: '+type+'\ndata: '+JSON.stringify({path,data})+'\n\n';bytes+=text.length;const due=Math.max(s.last+1,Date.now()+lag());s.last=due;setTimeout(()=>s.res.write(text),due-Date.now());}
const fixture=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,PATCH,DELETE,OPTIONS');
 if(req.method==='OPTIONS')return res.end();
 const keys=new URL(req.url,'http://localhost').pathname.replace(/\.json$/,'').split('/').filter(Boolean);
 if(req.headers.accept?.includes('text/event-stream')){
  res.writeHead(200,{'Content-Type':'text/event-stream'});const s={keys,res,last:0};streams.add(s);send(s,'put','/',get(keys));res.on('close',()=>streams.delete(s));return;
 }
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=raw?JSON.parse(raw,(k,v)=>v?.['.sv']==='timestamp'?Date.now():v):null;
 await wait(lag());
 if(req.method==='PUT'||req.method==='DELETE')put(keys,body);
 if(req.method==='PATCH')for(const [k,v] of Object.entries(body))put([...keys,...k.split('/')],v);
 if(req.method!=='GET'){
  writes++;
  // Wie Firebase: Hörer bekommen nur den geänderten Zweig, relativ zu ihrem Pfad.
  for(const s of streams){
   if(s.keys.length<=keys.length&&s.keys.every((k,i)=>k===keys[i]))send(s,req.method==='PATCH'?'patch':'put','/'+keys.slice(s.keys.length).join('/'),body);
   else if(keys.every((k,i)=>k===s.keys[i]))send(s,'put','/',get(s.keys));
  }
 }
 await wait(lag());
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?get(keys):body));
});
(async()=>{
 await new Promise(r=>fixture.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const pages=await Promise.all(['host','guest'].map(async uid=>{
  const context=await browser.newContext({viewport:{width:770,height:385},serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  await context.addInitScript(({uid,endpoint,code})=>{
   if(top!==window){
    // Ohne Grafikkarte misst nur die Kompaktansicht die Verbindung statt der Zeichenleistung.
    const real=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'||type==='webgl'?null:real.call(this,type,...args);};
    return;
   }
   const rewrite=u=>String(u).includes('firebasedatabase.app')?endpoint+new URL(u).pathname:String(u);
   const fetchReal=window.fetch;window.fetch=(u,options)=>fetchReal(rewrite(u),options);
   const Stream=window.EventSource;window.EventSource=class extends Stream{constructor(url){super(rewrite(url));}};
   localStorage.setItem('joyboy:data:v1',JSON.stringify({v:1,active:uid,profiles:[{id:uid,name:uid,avatar:'fuchs',age:2,color:'#baceda',stars:0}],settings:{online:true,arcadeAfter:0,sound:false}}));
   localStorage.setItem('joyboy:auth:v1',JSON.stringify({[uid]:{uid,token:uid,refresh:uid,exp:Date.now()+3600000}}));
   localStorage.setItem('joyboy:room:v1',JSON.stringify({code,profileId:uid}));
  },{uid,endpoint:'http://127.0.0.1:'+fixture.address().port,code});
  const p=await context.newPage();p.on('pageerror',e=>console.error(uid,e.message));await p.goto(URL_APP);
  return p;
 }));
 const [host,guest]=pages;
 await host.getByRole('button',{name:/Spielzimmer|Zusammen spielen/}).first().click({timeout:12000});
 await host.getByRole('button',{name:'Spiel starten',exact:true}).click({timeout:15000});
 const child=p=>p.frameLocator('iframe[title*="Joy-Kart"]');
 const snap=p=>p.frames().find(f=>f!==p.mainFrame()).evaluate(()=>document.getElementById('joy-kart-simple').__duelSnapshot?.());
 await Promise.all(pages.map(p=>child(p).locator('.js-count:not([hidden])').waitFor({timeout:65000})));
 // Blitzstart beim Gast: kurz vor „Los“ tippen.
 await guest.waitForFunction(()=>{const s=document.querySelector('iframe').contentDocument.getElementById('joy-kart-simple').__duelSnapshot?.();return s&&s.me.phase==='countdown'&&s.me.countdown<.4;},null,{polling:20,timeout:20000});
 await child(guest).locator('[data-action="turbo"]').click();
 await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('iframe').contentDocument.getElementById('joy-kart-simple').__duelSnapshot?.()?.me.phase==='running',null,{timeout:20000})));
 await host.waitForTimeout(2500);
 assert.equal((await snap(guest)).me.stats.startBoost,1,'Blitzstart beim Gast');
 // Jedes Bild mitschreiben: Wie gleichmäßig fährt das Kart des anderen Geräts?
 await Promise.all(pages.map(p=>p.evaluate(()=>{
  const root=document.querySelector('iframe').contentDocument.getElementById('joy-kart-simple');window.__log=[];
  const sample=()=>{const s=root.__duelSnapshot?.();if(s?.other&&s.me.phase==='running')window.__log.push([performance.now(),s.other.s,s.other.v,s.me.s,s.me.lat]);if(window.__log.length<1500)requestAnimationFrame(sample);};requestAnimationFrame(sample);
 })));
 // Lenken am Gast muss ohne Umweg über den Gastgeber wirken.
 await child(guest).locator('canvas').click({position:{x:8,y:8}});
 const before=(await snap(guest)).me.lat;await guest.keyboard.down('ArrowLeft');await guest.waitForTimeout(250);const after=(await snap(guest)).me.lat;await guest.waitForTimeout(350);await guest.keyboard.up('ArrowLeft');
 assert(after<before-.8,'Gast lenkt sofort: '+before.toFixed(2)+' → '+after.toFixed(2));
 await host.waitForTimeout(9000);
 const report={};
 for(const [i,p] of pages.entries()){
  const log=await p.evaluate(()=>window.__log);let back=0,stall=0,jump=0,worstGap=0;
  for(let n=1;n<log.length;n++){const dt=(log[n][0]-log[n-1][0])/1000,step=log[n][1]-log[n-1][1],expect=log[n][2]*dt;worstGap=Math.max(worstGap,dt);if(dt>.1)continue;if(step<-.02)back++;if(step<expect*.3)stall++;if(step>expect*2.5+.4)jump++;}
  report[i?'gast':'gastgeber']={bilder:log.length,rueckwaerts:back,stehen:stall,spruenge:jump,laengstesBildMs:Math.round(worstGap*1000)};
  assert(log.length>300,'genug Bilder');assert.equal(back,0,'Geist fährt nie rückwärts');assert(stall<log.length*.02,'Geist bleibt nicht stehen: '+stall);assert(jump<log.length*.02,'Geist springt nicht: '+jump);
 }
 // Beide Geräte sehen das jeweils andere Kart nah an dessen eigener Position.
 const [h,g]=await Promise.all(pages.map(snap));
 report.abweichungM={gastgeberSiehtGast:+(h.other.s-g.me.s).toFixed(1),gastSiehtGastgeber:+(g.other.s-h.me.s).toFixed(1)};
 assert(Math.abs(h.other.s-g.me.s)<25&&Math.abs(g.other.s-h.me.s)<25,'Positionen passen: '+JSON.stringify(report.abweichungM));
 // Item einsetzen (Start-Turbo) und Ankunft auf dem anderen Gerät.
 await child(host).locator('[data-action="turbo"]').click();
 await guest.waitForFunction(()=>document.querySelector('iframe').contentDocument.getElementById('joy-kart-simple').__duelSnapshot?.()?.other.stats.itemUses.turbo===1,null,{timeout:8000});
 const sent=writes,started=Date.now();await host.waitForTimeout(5000);
 report.schreibvorgaengeProSekunde=+((writes-sent)/((Date.now()-started)/1000)).toFixed(1);
 // Neuladen mitten im Rennen: erst der Gast, dann der Gastgeber. Jedes Kart fährt dort weiter, wo es wäre.
 for(const [name,p,other] of [['gast',guest,host],['gastgeber',host,guest]]){
  const old=(await snap(p)).me;await p.reload();
  await p.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.getElementById('joy-kart-simple')?.__duelSnapshot?.()?.me.phase==='running',null,{timeout:65000});
  await p.waitForTimeout(1500);
  const [now,seen]=await Promise.all([snap(p),snap(other)]);
  assert(now.me.s>old.s+20,name+' fährt nach dem Neuladen weiter: '+old.s.toFixed(0)+' → '+now.me.s.toFixed(0));
  assert.equal(now.me.stats.boxes>=old.stats.boxes,true);assert(now.other&&Math.abs(seen.other.s-now.me.s)<40,name+': das andere Gerät sieht das Kart an derselben Stelle');
  assert(Math.abs(now.me.time-seen.me.time)<2.5,name+': Rennuhren passen wieder ('+now.me.time.toFixed(1)+' / '+seen.me.time.toFixed(1)+')');
  (report.neuladen??={})[name]={vorher:Math.round(old.s),nachher:Math.round(now.me.s),uhrDifferenzS:+(now.me.time-seen.me.time).toFixed(2)};
 }
 await host.getByRole('button',{name:/Nochmal spielen/}).waitFor({timeout:300000});await guest.getByText(/Warte, bis/).waitFor({timeout:20000});
 const times=await Promise.all(pages.map(p=>p.locator('.game-screen').innerText()));
 const seconds=times.map(t=>[...t.matchAll(/(\d+\.\d\d) s/g)].map(m=>m[1]).slice(0,2).sort());
 assert.deepEqual(seconds[0],seconds[1],'beide Geräte zeigen dieselben Zeiten');report.zeiten=seconds[0];
 await host.getByRole('button',{name:/Nochmal spielen/}).click();await Promise.all(pages.map(p=>child(p).locator('.js-count:not([hidden])').waitFor({timeout:65000})));assert.equal(room.state.round,1);
 report.verbindung={verzoegerungMs:LATENCY,schwankungMs:JITTER,kilobyteGesamt:Math.round(bytes/1024)};
 console.log(JSON.stringify(report,null,1));
 console.log('Zwei Joyboy-Apps über verzögerte Testdatenbank: Blitzstart, sofortige Lenkung, ruhiger Gegner, Item, gleiche Zielzeiten und Revanche bestanden.');
 }catch(e){console.error(JSON.stringify(room.info),room.state?.seq,Object.fromEntries(Object.entries(room.seats).map(([k,v])=>[k,(v.live||'').slice(0,260)])),(await Promise.all((browser?.contexts()??[]).flatMap(c=>c.pages()).map(p=>p.locator('body').innerText().then(x=>x.slice(-400)).catch(()=>'')))));throw e;}
 finally{await browser?.close();fixture.closeAllConnections();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
