const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('index.html');
const css=read('goldx4.css');
const js=read('goldx4.js');
const pro=read('goldx-pro.js');
const main=html.slice(html.indexOf('<main>'),html.indexOf('</main>')+7);
function ids(s){return [...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);}
test('Main markup is balanced; every ID remains unique',()=>{
 const stack=[],voids=new Set(['br','hr','input','img','meta','link','source','area','embed','wbr','col']);
 for(const m of main.matchAll(/<\s*(\/?)\s*([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const tag=m[2].toLowerCase();
  if(voids.has(tag)||/\/\s*>$/.test(m[0]))continue;
  if(m[1])assert.equal(stack.pop(),tag,'Mismatched closing element '+tag+' at '+m.index);
  else stack.push(tag);
 }
 assert.deepEqual(stack,[]);
 const all=ids(html);
 assert.equal(all.length,new Set(all).size);
});
test('Old promotional hero, Gold Factors and duplicated headline are removed',()=>{
 assert.doesNotMatch(main,/ทุกจังหวะของทองคำ|ทุกจังหวะของ\s*<em>/);
 assert.doesNotMatch(main,/id="brand-section"|class="hero"|GOLD FACTORS|gx4-pair|gx4PairThai|gx4PairWorld|gx4PairFX/);
 assert.doesNotMatch(js,/gx4PairThai|gx4PairWorld|gx4PairFX|gx4HeadlineStatus/);
 assert.match(main,/class="gx4-masthead"/);
 assert.equal(ids(html).filter(x=>x==='heroLastSync').length,1);
 assert.doesNotMatch(main,/gxAutoSyncInfo|gx4HeadlineStatus/);
});
test('Data Health is a single compact topbar disclosure with complete source diagnostics',()=>{
 const top=html.slice(html.indexOf('<header class="topbar">'),html.indexOf('</header>')+9);
 assert.match(top,/<details class="gx4-health-popover" id="gx4-toolbox">/);
 assert.match(top,/<summary[^>]+>[\s\S]*id="gx4HealthBadge"/);
 for(const id of ['statusPill','statusText','gx4HealthThai','gx4HealthWorld','gx4HealthFX','gx4HealthSource'])assert.match(top,new RegExp('id="'+id+'"'),id);
 assert.match(css,/\.gx4-health-popover-body\{position:absolute/);
});
test('Daily gold displays three unique statistics and still updates original data references',()=>{
 assert.equal((main.match(/class="gx-pulse-card"/g)||[]).length,3);
 for(const id of ['gxTodayChange','gxTodayHigh','gxTodayLow','gxTodayStatus','gxDayCheckedAt','gxTodaySell','gxTodayPriceSub'])assert.ok(ids(html).includes(id),id);
 assert.match(main,/id="gxTodaySell" hidden/);
 assert.match(css,/\.gx-daily-grid\{grid-template-columns:repeat\(3/);
 assert.match(pro,/set\('gxTodaySell'/);
});
test('Market Brief is collapsed below chart visually and preserves calculations',()=>{
 assert.match(main,/<details class="gx4-brief-strip" id="gx4-brief-strip">/);
 assert.match(main,/<summary>[\s\S]*?id="gx4BriefTitle"/);
 for(const id of ['gx4BriefMarket','gx4BriefBody','gx4BriefOrigin'])assert.ok(ids(html).includes(id));
 assert.match(css,/main>\.analysis-layout\{order:4/);
 assert.match(css,/main>\.gx4-brief-strip\{order:5/);
 assert.match(css,/main>\.gx-daily\{order:6/);
 assert.match(js,/function brief\(/);
});
test('Settings, official economic links, Gold Silver ratio and ATR are moved into more disclosure',()=>{
 const more=main.slice(main.indexOf('<details class="gx4-more"'),main.indexOf('<footer class="footer"'));
 assert.match(more,/id="gx4DefaultMarket"/);
 for(const label of ['FOMC','CPI','NFP'])assert.ok(more.includes(label));
 assert.match(more,/id="silverRatio"/);
 assert.match(more,/<details class="gx4-atr-details">/);
 for(const id of ['scenarioDescription','bullScenario','baseScenario','bearScenario'])assert.ok(more.includes('id="'+id+'"'),id);
 assert.doesNotMatch(main.slice(0,main.indexOf('<details class="gx4-more"')),/id="silverRatio"|id="bullScenario"/);
 assert.match(main,/id="worldSilverRatio" hidden/);
});
test('History, calendar, calculator and alerts stay available via collapsible sections and menu',()=>{
 for(const [fold,child] of [['gx4-history-fold','goldx-history-section'],['gx4-tools-fold','calculator-section'],['gx4-tools-fold','alerts-section']]){
  assert.match(main,new RegExp('id="'+fold+'"'));
  assert.match(main,new RegExp('id="'+child+'"'));
 }
 assert.match(html,/data-nav="more"/);
 const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
 const start=script.indexOf('function activateNav(name){');
 const end=script.indexOf('function closeMenu(){',start);
 assert.ok(start>=0&&end>start);
 const nodes=new Map(),calls=[];
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{open:false,scrollIntoView:()=>calls.push(id)});
  return nodes.get(id);
 };
 const activate=new Function('$','$$','setMarket','closeMenu',script.slice(start,end)+';return activateNav;')($,()=>[],()=>{},()=>{});
 for(const [nav,fold,target] of [
  ['history','gx4-history-fold','goldx-history-section'],
  ['calculator','gx4-tools-fold','calculator-section'],
  ['alerts','gx4-tools-fold','alerts-section'],
  ['more','gx4-more','gx4-more']
 ]){
  $(fold).open=false;activate(nav);
  assert.equal($(fold).open,true,nav+' opens section');
  assert.ok(calls.includes(target),nav+' scrolls to target');
 }
 assert.match(pro,/IntersectionObserver/);
 assert.match(css,/main>\.gx4-history-fold\{order:7/);
 assert.match(css,/main>\.gx4-tools-fold\{order:8/);
});
test('Controls and free native chart stay intact',()=>{
 for(const id of ['priceChart','chartTooltip','historyCandles','historyCSV','gxShowEma20','gxShowEma50','gxShowEma200','goldWeight','alertForm','gxCalPrev','gxPageNext'])assert.ok(ids(html).includes(id),id);
 assert.doesNotMatch(html+css+js,/tradingview|lightweight-charts/i);
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 for(const id of ['gxShowEma20','gxShowEma50','gxShowEma200'])assert.match(html,new RegExp('id="'+id+'" type="checkbox" disabled'));
 assert.match(pro,/\$\(id\)\.checked=false/);
});
