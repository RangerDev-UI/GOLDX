const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html'),css=read('goldx4.css'),js=read('goldx4.js'),sw=read('sw.js');
test('GOLDX 4 keeps native price chart and never loads external chart libraries',()=>{
 assert.doesNotMatch(html+css+js,/tradingview|lightweight-charts/i);
 assert.match(html,/id="priceChart"/);
 assert.match(html,/id="historyCandles"/);
 assert.match(html,/id="historyCSV"/);
 assert.match(html,/id="gxShowEma20" type="checkbox" disabled/);
 assert.doesNotMatch(html,/id="gxShowEma20" type="checkbox" checked/);
 assert.doesNotThrow(()=>new Function(js));
 assert.doesNotThrow(()=>new Function(sw));
});
test('Aurum layout retains original market and analysis elements, new IDs are unique',()=>{
 for(const id of ['overview-section','thai-card','world-card','analysis-section','gx4-toolbox','gx4HealthThai','gx4HealthFX','gx4BriefBody','gx4PairWorld','gx4DefaultMarket','goldx-history-section','alerts-section'])assert.ok(html.includes('id="'+id+'"'),id);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.match(css,/main>\.analysis-layout\{order:4/);
 assert.match(css,/main>\.hero\{order:8/);
 assert.match(html,/goldx4\.js" defer/);
 assert.match(html,/goldx4\.css/);
 assert.match(html,/goldx4:set-market/);
});
test('PWA never intercepts or caches live quote API calls',()=>{
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/if\(url\.origin!==self\.location\.origin/);
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/');
 assert.ok(manifest.icons.some(x=>x.src==='/favicon.svg'));
 for(const p of ['goldx4.js','goldx4.css','sw.js','manifest.webmanifest'])assert.ok(read('.assetsignore').includes('!'+p),p);
});
test('No new paid API calls: Data Health and market brief consume existing browser events',()=>{
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 assert.match(js,/goldx:quotes-ready/);
 assert.match(js,/goldx:quotes-error/);
 assert.match(js,/goldx:reference-data/);
 assert.match(js,/localStorage\.setItem/);
 assert.match(html,/https:\/\/www\.bls\.gov\/schedule\/news_release\/cpi\.htm/);
});
test('UI identifies source freshness, summarizes crossed Pivot and saves preferred market',()=>{
 const elements=new Map(),windows=new Map(),docs=new Map(),dispatched=[];
 const node=()=>({
  textContent:'',dataset:{},value:'',style:{},events:{},
  addEventListener(type,fn){this.events[type]=fn},
  append(){},setAttribute(){},getBoundingClientRect(){return {width:800,left:0}}
 });
 const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const window={
  addEventListener:(type,fn)=>windows.set(type,fn),
  dispatchEvent:e=>{dispatched.push(e);windows.get(e.type)?.(e)}
 };
 const document={getElementById:get,createElement:node,addEventListener:(type,fn)=>docs.set(type,fn)};
 const stored=new Map();
 const context={
  document,window,Date,Intl,Number,console,
  location:{protocol:'https:'},navigator:{},
  localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
  queueMicrotask:fn=>fn(),
  CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}}
 };
 vm.runInNewContext(js,context);
 docs.get('DOMContentLoaded')();
 const now=new Date().toISOString();
 get('rsiValue').textContent='26.9';
 get('s1').textContent='59,650';
 get('s2').textContent='59,400';
 get('r1').textContent='60,250';
 get('r2').textContent='60,600';
 get('emaValue').textContent='EMA20 < EMA50';
 get('levelBasis').textContent='Pivot ทองไทย · วันก่อน';
 windows.get('goldx:quotes-ready')({detail:{
  fetchedAt:now,
  thai:{sellBar:57500,updatedAt:now,stale:false,announcedToday:true,source:'test GTA'},
  world:{price:3700,updatedAt:now,stale:false,source:'test spot'},
  fx:{usdThb:34.52,rateType:'daily-reference',source:'test rate',asOf:'2026-11-20'}
 }});
 assert.match(get('gx4HealthThai').textContent,/ประกาศวันนี้/);
 assert.match(get('gx4HealthFX').textContent,/อัตราอ้างอิงรายวัน/);
 assert.equal(get('gx4PairThai').textContent,'฿57,500');
 assert.equal(get('gx4PairWorld').textContent,'$3,700.00');
 windows.get('goldx:market-changed')({detail:{market:'thai'}});
 assert.match(get('gx4BriefTitle').textContent,/ต่ำกว่า Pivot S2/);
 assert.match(get('gx4BriefBody').textContent,/1,900/);
 const selector=get('gx4DefaultMarket');selector.value='thai';selector.events.change();
 assert.equal(stored.get('goldx4-default-market'),'thai');
 assert.ok(dispatched.some(e=>e.type==='goldx4:set-market'&&e.detail.market==='thai'));
 windows.get('goldx:quotes-error')();
 assert.match(get('gx4BriefTitle').textContent,/ยังไม่พร้อม/);
 assert.match(get('gx4HealthBadge').textContent,/ยังไม่มีข้อมูล/);
});
