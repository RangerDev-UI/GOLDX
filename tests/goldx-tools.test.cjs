const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const home=read('index.html'),script=read('goldx-tools.js'),styles=read('goldx-tools.css');
const pages=['calculator','history','my-gold','compare'];
test('Four genuine navigable Ivory pages and Cloudflare asset allowlist',()=>{
 const allow=read('.assetsignore'),sw=read('sw.js');
 assert.match(home,/href="\/calculator.html"/);
 for(const p of pages){
  const html=read(p+'.html');
  assert.match(html,new RegExp('data-page="'+p+'"'));
  assert.match(html,/goldx-tools\.js/);
  assert.match(html,/goldx-tools\.css/);
  assert.match(html,/GOLDX/);
  assert.doesNotMatch(html,/value="33,750"|2,748\.50|99\.99%|ราคาสมมติ/,'no demo prices or 99.99% quotes');
  for(const f of [p+'.html'])assert.match(allow,new RegExp('!'+f.replace('.','\\.')+'\\b'));
  assert.ok(sw.includes("'"+'/'+p+'.html'+"'"));
 }
 assert.ok(allow.includes('!goldx-tools.js')&&allow.includes('!goldx-tools.css'));
 assert.match(sw,/goldx4-static-v5/);
 assert.match(sw,/cache\.put\(url\.pathname===/,'PWA caches each page under its own path');
 assert.match(styles,/max-width:560px/);
 assert.doesNotThrow(()=>new Function(script));
});
function dom(page){
 const items=new Map(),arrays=new Map();
 const make=(attrs={})=>({
  dataset:attrs.dataset||{},value:attrs.value??'',textContent:'',attrs:{},children:[],className:'',style:{},
  setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},
  addEventListener(k,fn){this['on'+k]=fn},
  replaceChildren(...kids){this.children=kids},appendChild(k){this.children.push(k);return k}
 });
 const get=id=>{if(!items.has(id))items.set(id,make());return items.get(id)};
 const document={body:{dataset:{page}},getElementById:get,querySelectorAll(selector){return arrays.get(selector)||[]},createElement:()=>make(),createElementNS:()=>make()};
 return {document,get,make,arrays};
}
async function settle(){await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));}
function run(page,doc,fetchImpl,extra={}){
 const context={document:doc,fetch:fetchImpl,Date,Intl,Number,console,AbortController,setTimeout,clearTimeout,Math,JSON,...extra};
 vm.runInNewContext(script,context);return context;
}
const current=new Date().toISOString();
const quotes={thai:{buyBar:50000,sellBar:50200,buyOrnament:48800,sellOrnament:50700,updatedAt:current,source:'Verified GTA',stale:false,announcedToday:true},world:{price:4200,updatedAt:current,source:'Verified spot'}};
test('Calculator multiplies verified 96.5% buy/sell prices, includes user making fee',async()=>{
 const d=dom('calculator');
 d.get('calc-qty').value='0.5';d.get('calc-fee').value='250';
 const buttons={
  '[data-type]':[d.make({dataset:{type:'bar'}}),d.make({dataset:{type:'orn'}})],
  '[data-unit]':[d.make({dataset:{unit:'baht'}}),d.make({dataset:{unit:'salung'}}),d.make({dataset:{unit:'gram'}})],
  '[data-quick]':[d.make({dataset:{quick:'1'}})]
 };
 for(const [key,val] of Object.entries(buttons))d.arrays.set(key,val);
 run('calculator',d.document,async()=>({ok:true,json:async()=>quotes}));
 await settle();
 assert.equal(d.get('calc-result-buy').textContent,'฿25,000.00');
 assert.equal(d.get('calc-result-sell').textContent,'฿25,350.00');
 assert.equal(d.get('calc-summary-spread').textContent,'฿350.00');
 buttons['[data-type]'][1].onclick();
 assert.equal(d.get('calc-result-buy').textContent,'฿24,400.00');
 assert.equal(d.get('calc-result-sell').textContent,'฿25,600.00');
 d.get('calc-qty').value='-5';d.get('calc-qty').oninput();
 assert.equal(d.get('calc-result-buy').textContent,'—','invalid quantities cannot be estimated');
});
test('Compare uses verified 96.5% bars and ornaments, with no default invented making fee',async()=>{
 const d=dom('compare');d.get('cmp-qty').value='1';d.get('cmp-fee').value='400';
 run('compare',d.document,async()=>({ok:true,json:async()=>quotes}));await settle();
 assert.equal(d.get('cmp-bar-sell').textContent,'฿50,200');
 assert.equal(d.get('cmp-bar-spread').textContent,'฿200');
 assert.equal(d.get('cmp-orn-spread').textContent,'฿1,900');
 assert.equal(d.get('cmp-bar-cost').textContent,'฿50,200.00');
 assert.equal(d.get('cmp-orn-cost').textContent,'฿51,100.00');
 assert.equal(d.get('cmp-cost-diff').textContent,'+฿900.00');
});
test('No provider quote causes clear missing-data states, never emits fake numbers',async()=>{
 for(const page of ['calculator','compare']){
  const d=dom(page);
  if(page==='calculator'){d.get('calc-qty').value='1';d.get('calc-fee').value='0';
   d.arrays.set('[data-type]',[]);d.arrays.set('[data-unit]',[]);d.arrays.set('[data-quick]',[]);
  }else{d.get('cmp-qty').value='1';d.get('cmp-fee').value='0';}
  run(page,d.document,async()=>{throw Error('upstream unavailable')});await settle();
  assert.equal(d.get(page==='calculator'?'calc-result-buy':'cmp-bar-cost').textContent,'—');
 }
});
test('History renders only source-provided observed records, and tolerates missing providers',async()=>{
 const d=dom('history'),p=[{t:'2026-11-20T08:00:00+07:00',c:55000,observed:true},{t:'2026-11-21T08:00:00+07:00',c:55200,observed:true},{t:'2026-11-22T08:00:00+07:00',c:55100,observed:true},{t:'2026-11-23T08:00:00+07:00',c:70000,observed:false}];
 d.arrays.set('[data-period]',[]);
 run('history',d.document,async url=>{
  if(url.includes('market=thai'))return {ok:true,json:async()=>({source:'Reported GTA',quality:'reported-daily-ohlc',points:p})};
  throw Error('No world data');
 });await settle();
 assert.equal(d.get('history-thai-latest').textContent,'฿55,100');
 assert.equal(d.get('history-thai-high').textContent,'฿55,200.00');
 assert.equal(d.get('history-world-latest').textContent,'—');
 assert.ok(d.get('history-thai-chart').children.length>0);
 assert.equal(d.get('history-rows').children.length,3);
});
test('Portfolio starts empty and never uploads personal holdings',async()=>{
 const d=dom('my-gold'),store=new Map();
 d.get('port-date').value='';
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>{store.set(k,v)}};
 run('my-gold',d.document,async()=>({ok:true,json:async()=>quotes}),{localStorage,confirm:()=>true});await settle();
 assert.equal(d.get('port-count').textContent,'0 รายการ');
 assert.equal(d.get('port-value').textContent,'—');
 d.get('port-type').value='bar';d.get('port-quantity').value='1';d.get('port-paid').value='48000';d.get('port-date').value='2026-11-20';
 d.get('port-form').onsubmit({preventDefault(){}});
 assert.equal(d.get('port-count').textContent,'1 รายการ');
 assert.equal(d.get('port-profit').textContent,'+฿2,000.00');
 assert.ok(store.has('goldx.ivory.my-gold.v1'));
 assert.doesNotMatch(script,/fetch\([^)]*method:\s*'POST'/);
});
