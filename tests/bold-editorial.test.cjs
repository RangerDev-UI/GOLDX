const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=read('editorial-bold.js'),css=read('editorial-bold.css'),html=read('index.html');
test('Approved bold editorial keeps official data and new red/black responsive design',()=>{
 const visible=html.slice(html.indexOf('<div class="ivory-ledger ed"'),html.indexOf('<div class="site-shell"'));
 assert.match(visible,/ed-price-card ed-black/);
 assert.match(visible,/ed-price-card ed-red/);
 assert.match(visible,/ราคาทองวันนี้/);
 assert.match(visible,/Spot Gold/);
 assert.match(visible,/USD\/THB/);
 assert.match(visible,/ed-hero-gold/);
 assert.match(visible,/edChartDisplay/);
 assert.match(visible,/ราคาขายออก/);
 assert.match(css,/#d80815|#bf000b|#bd000b|#b7040b/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(src,/fetch\('\/api\/market\?mode=chart&market=thai&period='/);
 assert.match(read('ivory-ledger.js'),/fetch\('\/api\/market\?mode=quotes'/);
 assert.match(read('ivory-ledger.js'),/mode=previous-thai/);
 assert.doesNotMatch(visible,/53,450|54,250|2,045\.30|34\.62/,'reference mockup numbers may not appear');
 assert.doesNotThrow(()=>new Function(src));
});
test('Both GOLDX navigation bars show Home and Price History only',()=>{
 const history=read('history.html');
 const homeNav=html.match(/<nav class="ed-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
 const historyNav=history.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
 for(const nav of [homeNav,historyNav]){
  assert.equal((nav.match(/<a\b/g)||[]).length,2);
  assert.match(nav,/หน้าแรก/);
  assert.match(nav,/ราคาย้อนหลัง/);
  assert.doesNotMatch(nav,/รายละเอียดราคา|แหล่งข้อมูล|#ed-market|#ed-sources/);
 }
 const visible=html.slice(html.indexOf('<div class="ivory-ledger ed"'),html.indexOf('<div class="site-shell"'));
 assert.match(visible,/id="ed-market"/);
 assert.match(visible,/id="ed-sources"/);
});
function fixture(success){
 const nodes=new Map(),events=new Map(),calls=[];
 const make=()=>({textContent:'',value:'',hidden:false,attrs:{},dataset:{},children:[],style:{},
  classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},
  appendChild(el){this.children.push(el);return el},replaceChildren(...kids){this.children=kids},
  addEventListener(k,fn){this['on'+k]=fn}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id)};
 const buttons=['1W','1M','3M','1Y'].map(p=>({...make(),dataset:{edPeriod:p}}));
 const document={
  getElementById:get,querySelector:()=>make(),
  querySelectorAll:selector=>selector==='[data-ed-period]'?buttons:[],
  createElement:make,createElementNS:make,
  addEventListener:(name,fn)=>events.set(name,fn),visibilityState:'visible'
 };
 const fetch=async url=>{
  calls.push(url);
  if(!success)return {ok:false,status:503};
  return {ok:true,json:async()=>({market:'thai',source:'Thai GOLD historical verified',points:[
   {t:'2026-11-18T09:00:00+07:00',c:53000,observed:true},
   {t:'2026-11-19T09:00:00+07:00',c:53200,observed:true},
   {t:'2026-11-20T09:00:00+07:00',c:99999,observed:false}
  ]})};
 };
 vm.runInNewContext(src,{document,fetch,console,Date,Intl,Math,AbortController,setTimeout,clearTimeout});
 return {get,events,calls};
}
async function tick(){await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));}
test('Verified prior-day quote controls real direction, spread and story; no market causation is invented',async()=>{
 const t=fixture(true);await tick();
 assert.equal(t.get('edChartLatest').textContent,'53,200 บาท');
 assert.match(t.get('edChartSource').textContent,/2 จุดข้อมูล/);
 assert.equal(t.get('edChartDisplay').children.length,1);
 t.events.get('goldx:quotes')({detail:{thai:{
  buyBar:53400,sellBar:53500,buyOrnament:51800,sellOrnament:54000,
  source:'Thai Gold official reference',updatedAt:'2026-11-23T10:30:00+07:00'
 }}});
 assert.equal(t.get('edHeadlineMove').textContent,'ติดตามราคา');
 assert.equal(t.get('edBarSpread').textContent,'100 บาท');
 assert.equal(t.get('edOrnSpread').textContent,'2,200 บาท');
 t.events.get('goldx:previous')({detail:{previous:{
  sellBar:53000,buyBar:52900,sellOrnament:53500,buyOrnament:51500,updatedAt:'2026-11-22T15:00:00+07:00'
 }}});
 assert.equal(t.get('edHeadlineMove').textContent,'ปรับขึ้น');
 assert.match(t.get('edBarDaily').textContent,/\+500 บาท/);
 assert.match(t.get('edStoryBody').textContent,/53,500 บาท/);
 assert.match(t.get('edOrnDaily').textContent,/\+500 บาท/);
});
test('Missing historical API renders a clearly labeled no-data state rather than a fake chart',async()=>{
 const t=fixture(false);await tick();
 assert.equal(t.get('edChartLatest').textContent,'—');
 assert.equal(t.get('edChartDisplay').children.length,1);
 assert.match(t.get('edChartDisplay').children[0].textContent,/ไม่แสดงกราฟตัวเลขสมมติ/);
 assert.match(t.calls[0],/mode=chart&market=thai&period=1W/);
});
