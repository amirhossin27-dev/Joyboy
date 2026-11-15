// Fahrbilder an festen Streckenstellen (eingefrorene Rennstände) für Vorher/Nachher-Vergleiche der Grafik.
// Aufruf nach `npm run kart`:
//   node prototypes/joy-kart/coast-section/track-tour-qa.cjs <Zielordner> [bucht|kap] [Streckenmeter,…] [Breite x Höhe] [JS für den Stand g]
// Ohne Grafikkarte zeichnet Chromium per Software (etwa ein Bild pro Sekunde): gut zum Ansehen, keine Aussage zur Bildrate.
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path');
const dist=path.join(__dirname,'../dist'),out=process.argv[2],course=process.argv[3]||'bucht',spots=(process.argv[4]||'40,300,760,1150,1500').split(',').map(Number);
const size=(process.argv[5]||'852x393').split('x').map(Number),extra=process.argv[6]||'';
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://x');
 if(url.pathname==='/w.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><body style="margin:0;background:#000"><iframe id="f" src="/Joy-Kart-PC.html#joyboy-robo-'+course+'" style="width:100vw;height:100vh;border:0;display:block"></iframe>');}
 const file=path.join(dist,path.basename(url.pathname));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type','text/html');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const errors=[],info={};
 const context=await browser.newContext({viewport:{width:size[0],height:size[1]}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.type()+': '+m.text().slice(0,300));});
 await page.goto('http://127.0.0.1:'+server.address().port+'/w.html');
 await page.waitForFunction(()=>document.getElementById('f').contentWindow.joyKartRace,null,{timeout:240000});
 for(const spot of spots){
  await page.evaluate(({spot,extra})=>{
   const api=document.getElementById('f').contentWindow.joyKartRace,H={steer:0,turbo:false};
   clearInterval(window.__tick);
   api.begin();let g;for(let i=0;i<16;i++)g=api.advance(.25,[H,H]);
   g[0].s=spot;g[0].lat=-1.2;g[1].s=spot+13;g[1].lat=1.8;g[0].v=g[1].v=38;g[0].item=null;g[1].item=null;g[0].taken=[];
   if(extra)new Function('g',extra)(g);
   api.restore(g);
   window.__tick=setInterval(()=>{const now=api.advance(1/600,[H,H]);api.show(now,0);},60);
  },{spot,extra});
  await page.waitForTimeout(7000);
  await page.screenshot({path:path.join(out,course+'-'+spot+'.png')});
  info[spot]=await page.evaluate(()=>document.getElementById('f').contentDocument.getElementById('joy-kart-simple').__duelRenderInfo?.());
 }
 console.log(JSON.stringify(info));console.log('errors',errors.slice(0,6));await browser.close();server.close();
})();
