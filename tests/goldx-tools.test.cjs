const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const script=read('goldx-tools.js'),html=read('history.html');
test('History is the sole remaining gold tool route: price data real, removed pages not deployed',()=>{
 const allow=read('.assetsignore'),sw=read('sw.js'),home=read('index.html');
 assert.match(html,/data-page="history"/);
 assert.match(html,/goldx-tools.js/);
 assert.match(html,/goldx-tools.css/);
 assert.match(home,/href="\/history.html"/);
 assert.match(allow,/!history.html/);
 for(const removed of ['calculator','my-gold','compare']){
  assert.ok(!fs.existsSync(path.join(__dirname,'..',removed+'.html')),'Deleted '+removed+'.html');
  assert.ok(!allow.includes('!'+removed+'.html'));
  assert.ok(!home.includes('href="/'+removed+'.html"'));
  assert.ok(!html.includes('href="/'+removed+'.html"'));
 }
 assert.match(sw,/goldx4-static-v7/);
 assert.ok(sw.includes('editorial-bold.js'));
 assert.doesNotThrow(()=>new Function(script));
});
test('History chart uses only real observed points and displays empty state for absent provider',async()=>{
 const el=new Map(),listeners=new Map();
 const make=()=>({textContent:'',value:'',dataset:{},children:[],attrs:{},style:{},
  classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v},appendChild(child){this.children.push(child);return child},replaceChildren(...children){this.children=children},
  addEventListener(k,fn){this['on'+k]=fn}});
 const node=id=>{if(!el.has(id))el.set(id,make());return el.get(id)};
 const document={body:{dataset:{page:'history'}},getElementById:node,querySelectorAll:()=>[],createElement:make,createElementNS:make};
 const history=[
  {t:'2026-11-18T09:00:00+07:00',c:52000,observed:true},
  {t:'2026-11-19T09:00:00+07:00',c:52100,observed:true},
  {t:'2026-11-20T09:00:00+07:00',c:59000,observed:false}
 ];
 const fetch=async url=>{
  if(url.includes('market=thai'))return {ok:true,json:async()=>({market:'thai',source:'Recorded GTA',quality:'reported-daily-ohlc',points:history})};
  throw Error('World provider unavailable');
 };
 vm.runInNewContext(script,{document,fetch,console,Date,Intl,AbortController,setTimeout,clearTimeout,Math});
 await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 assert.equal(node('history-thai-latest').textContent,'฿52,100');
 assert.equal(node('history-thai-high').textContent,'฿52,100.00');
 assert.equal(node('history-world-latest').textContent,'—');
 assert.equal(node('history-rows').children.length,2);
 assert.ok(node('history-thai-chart').children.length>0);
});
