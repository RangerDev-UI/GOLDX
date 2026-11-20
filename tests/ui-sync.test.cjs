const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pro=fs.readFileSync(path.join(root,'goldx-pro.js'),'utf8');
const marketApi=fs.readFileSync(path.join(root,'netlify/functions/market.js'),'utf8');
const thaiApi=fs.readFileSync(path.join(root,'netlify/functions/thai-feed.js'),'utf8');
const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'Main inline JS found');

test('GOLDX frontend modules and main inline JavaScript compile',()=>{
 assert.doesNotThrow(()=>new Function(inline));
 assert.doesNotThrow(()=>new Function(pro));
});
test('Market tabs actually switch using querySelectorAll, not getElementById(selector)',()=>{
 const start=inline.indexOf('function setMarket(market){');
 const end=inline.indexOf('function activateNav(name){',start);
 assert.ok(start>=0&&end>start);
 const code=inline.slice(start,end);
 const rows=['thai','world'].map(market=>({
  dataset:{market},selected:false,
  classList:{toggle(k,v){if(k==='is-selected')this.owner.selected=!!v;}},
  setAttribute(k,v){this[k]=v}
 }));
 for(const row of rows)row.classList.owner=row;
 const state={market:'world'},events=[],calls=[];
 const listener=new Function('state','$$','loadChart','renderTechnicals','window','CustomEvent',code+';return setMarket;')(
  state,selector=>{assert.equal(selector,'[data-market]');return rows},
  ()=>calls.push('chart'),()=>calls.push('technicals'),
  {dispatchEvent:e=>events.push(e)},
  class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}}
 );
 listener('thai');
 assert.equal(state.market,'thai');
 assert.equal(rows[0].selected,true);
 assert.equal(rows[1].selected,false);
 assert.equal(rows[0]['aria-selected'],'true');
 assert.equal(events[0].detail.market,'thai');
 assert.deepEqual(calls,['chart','technicals']);
 listener('thai');
 assert.equal(calls.length,2,'reselecting same market should not fetch again');
 listener('world');
 assert.equal(rows[1].selected,true);
});
test('Chart refresh does not reload page or touch saved alerts',()=>{
 assert.ok(inline.includes("goldx:refresh-chart"));
 assert.ok(inline.includes("refreshActiveChart(true)"));
 assert.ok(!inline.includes('window.location.reload()'));
 assert.ok(html.includes('id="historyRefresh"'));
});
test('Refresh cadences match visible-page API usage policy',()=>{
 const start=inline.indexOf('function chartCadence(period){');
 const end=inline.indexOf('function refreshActiveChart(',start);
 assert.ok(start>=0&&end>start);
 const cadence=new Function(inline.slice(start,end)+';return chartCadence;')();
 assert.equal(cadence('1D'),60000);
 assert.equal(cadence('1W'),120000);
 assert.equal(cadence('1M'),300000);
 assert.equal(cadence('3M'),300000);
 assert.equal(cadence('1Y'),300000);
 assert.ok(inline.includes("document.visibilityState!=='visible'"));
 assert.ok(inline.includes("goldx:sync-tick"));
 assert.equal((inline.match(/setInterval\(/g)||[]).length,1,'central scheduler should use one timer');
 assert.equal((pro.match(/setInterval\(/g)||[]).length,0,'daily/calendar should use central event rather than own timer');
});
test('Calendar has refresh action, keeps selected month and prior verified data',()=>{
 assert.ok(html.includes('id="gxHistoryRefresh"'));
 assert.ok(html.includes('id="gxHistoryCheckedAt"'));
 assert.ok(html.includes('id="gxDayCheckedAt"'));
 assert.ok(html.includes('id="gxChartCheckedAt"'));
 assert.match(pro,/goldx:sync-tick/);
 assert.match(pro,/lastHistoryCheck>=1800000/);
 assert.match(pro,/lastDailyCheck>=300000/);
 assert.match(pro,/previous\.month&&previous\.month>=first/);
 assert.match(pro,/if\(S\.history\.length\)\{/);
 assert.match(pro,/if\(!S\.historyLoaded\)loadHistory\(\)/);
});
test('API intraday cache is aligned to 60-second automatic chart checks',()=>{
 assert.match(marketApi,/period==='1D'\?60:period==='1W'\?120:TTL\.chart/);
 assert.equal((thaiApi.match(/quality:'reported-announcements',points,fetchedAt:new Date\(\)\.toISOString\(\)\},200,60/g)||[]).length,2);
});
test('EMA overlays remain opt-in even after repeated automatic refreshes',()=>{
 for(const id of ['gxShowEma20','gxShowEma50','gxShowEma200']){
  assert.match(html,new RegExp('id="'+id+'" type="checkbox" disabled'));
  assert.ok(!html.includes('id="'+id+'" type="checkbox" checked'));
 }
 assert.match(pro,/\$\(id\)\.checked=false/);
 assert.match(pro,/window\.addEventListener\('goldx:history-ready',onChart\)/);
});
