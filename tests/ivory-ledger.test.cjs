const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const r=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=r('index.html'),css=r('ivory-ledger.css'),js=r('ivory-ledger.js');
test('Design 02 is the public visible cream homepage with FX at the top',()=>{
 assert.match(html,/class="ivory-ledger" id="ivory-ledger"/);
 assert.match(html,/class="il-header"/);
 assert.match(html,/class="il-fx"/);
 assert.match(html,/id="ilFX"/);
 assert.match(html,/GOLD MARKET JOURNAL/);
 assert.match(html,/ราคาทองคำ<br>ที่ดูแล้วเข้าใจทันที/);
 assert.match(css,/background:#faf7ee/);
 assert.match(css,/body>\.site-shell,body>#toast,body>#mobileCover\{display:none!important\}/);
 assert.match(html,/<div class="site-shell" inert aria-hidden="true">/);
 assert.match(html,/<body class="ivory-enabled">/);
 assert.match(html,/\/ivory-ledger\.css/);
 assert.match(html,/\/ivory-ledger\.js/);
});
test('Selected design has no old panels, fake prices or competing Sidebar in its live markup',()=>{
 const visible=html.slice(html.indexOf('<div class="ivory-ledger"'),html.indexOf('<div class="site-shell"'));
 assert.doesNotMatch(visible,/tradingview|lightweight-charts|priceChart|RSI|MACD|Pivot|DAILY GOLD PULSE|data-demo-value/i);
 assert.doesNotMatch(visible,/59,950|3,733\.40|33\.89|sidebar|scenario/i);
 assert.match(visible,/id="ilThaiSell"/);
 assert.match(visible,/id="ilWorldSpot"/);
 assert.match(visible,/id="ilOrnSell"/);
 assert.match(visible,/id="ilOrnBuy"/);
 assert.match(visible,/id="ilThaiBuy"/);
 assert.match(visible,/id="ilThaiBuyDelta"/);
 assert.match(visible,/id="ilThaiSellDelta"/);
 assert.match(visible,/id="ilOrnBuyDelta"/);
 assert.match(visible,/id="ilOrnSellDelta"/);
 assert.match(visible,/id="ilReferenceSource"/);
 assert.match(visible,/id="ilWorldGram"/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
});
test('Market gateway and original worker remain unchanged, new UI uses a single 60-second scheduler',()=>{
 assert.match(js,/fetch\('\/api\/market\?mode=quotes'/);
 assert.match(js,/setInterval\(/);
 assert.match(js,/60000/);
 assert.match(js,/document\.visibilityState==='hidden'/);
 assert.match(js,/document\.addEventListener\('visibilitychange'/);
 assert.match(js,/daily-reference/);
 assert.match(html,/if\(document\.getElementById\("ivory-ledger"\)\)return/);
 assert.match(r('goldx-pro.js'),/classList\?\.contains\('ivory-enabled'\)/);
 assert.match(r('goldx4.js'),/classList\?\.contains\('ivory-enabled'\)/);
 const assets=r('.assetsignore');
 for(const name of ['ivory-ledger.css','ivory-ledger.js'])assert.ok(assets.includes('!'+name));
 const sw=r('sw.js');
 assert.match(sw,/goldx4-static-v2/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.doesNotThrow(()=>new Function(js));
});
test('It prints sourced prices and warns about daily FX, stale quotes or failed requests',async()=>{
 const elements=new Map(),listeners=new Map(),intervals=[],calls=[];
 const node=()=>({textContent:'',value:'',hidden:true,disabled:false,dataset:{},handlers:{},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},addEventListener(k,fn){this.handlers[k]=fn}});
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const now=new Date().toISOString();
 const referenceDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const previousDay=new Date(referenceDay+'T00:00:00Z');previousDay.setUTCDate(previousDay.getUTCDate()-1);
 const priorDate=previousDay.toISOString().slice(0,10);
 const previous={date:priorDate,updatedAt:priorDate+'T09:15:00+07:00',buyBar:59650,sellBar:59750,buyOrnament:58500,sellOrnament:60550,source:'Verified previous GTA'};
 const data={
  fetchedAt:now,
  thai:{sellBar:59950,buyBar:59850,sellOrnament:60750,buyOrnament:58790,change:-50,updatedAt:now,source:'verified GTA',stale:false,announcedToday:true},
  world:{price:3733.4,perGram:120.03,updatedAt:now,source:'verified spot',stale:false},
  fx:{usdThb:33.89,rateType:'daily-reference',source:'Frankfurter',asOf:'2026-11-20'}
 };
 let offline=false;
 const document={visibilityState:'visible',getElementById:el,addEventListener(k,fn){listeners.set(k,fn)}};
 const context={
  document,Date,Intl,Number,navigator:{},location:{protocol:'http:'},
  fetch:async(url)=>{calls.push(url);if(offline)throw Error('Network down');return {ok:true,json:async()=>url.includes('mode=previous-thai')?{before:referenceDay,previous}:data}},
  setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return 1},
  AbortController,console
 };
 vm.runInNewContext(js,context);
 listeners.get('DOMContentLoaded')();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el('ilThaiSell').textContent,'฿59,950');
 assert.equal(el('ilThaiBuy').textContent,'฿59,850');
 assert.equal(el('ilWorldSpot').textContent,'$3,733.40');
 assert.equal(el('ilWorldGram').textContent,'$120.03');
 assert.equal(el('ilOrnSell').textContent,'฿60,750');
 assert.equal(el('ilOrnBuy').textContent,'฿58,790');
 assert.equal(el('ilFX').textContent,'33.890');
 assert.match(el('ilFXSource').textContent,/อ้างอิงรายวัน/);
 assert.match(el('ilThaiChange').textContent,/ราคาปิดวันที่/);
 assert.match(el('ilThaiBuyDelta').textContent,/↑ \+200 บาท/);
 assert.match(el('ilThaiSellDelta').textContent,/↑ \+200 บาท/);
 assert.match(el('ilOrnBuyDelta').textContent,/↑ \+290 บาท/);
 assert.match(el('ilOrnSellDelta').textContent,/↑ \+200 บาท/);
 assert.match(el('ilReferenceSource').textContent,/Verified previous GTA/);
 assert.equal(el('ilApi').dataset.state,'ok');
 assert.equal(intervals.length,1);
 assert.equal(calls.length,2);
 assert.match(calls[1],/mode=previous-thai/);
 offline=true;
 el('ilRefresh').handlers.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el('ilThaiSell').textContent,'฿59,950','Last quote retained but marked stale');
 assert.equal(el('ilApi').dataset.state,'bad');
 assert.match(el('ilNotice').textContent,/ข้อมูลที่ได้รับก่อนหน้า/);
});
