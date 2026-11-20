const test=require('node:test');
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/market.js');
const Thai=require('../netlify/functions/thai-feed.js');
const originalFetch=global.fetch;
const savedToken=process.env.GTA_API_TOKEN;
const today=new Date().toISOString();
const thaiNow=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}).replace(' ','T');
function fake(routes){
 global.fetch=async (url,options={})=>{
  const name=String(url),matched=routes.find(([part])=>name.includes(part));
  if(!matched)throw Error('blocked '+name);
  const result=typeof matched[1]==='function'?matched[1](url,options):matched[1];
  return {ok:!(result?._httpError),status:result?._httpError||200,json:async()=>result};
 };
}
function event(params={}){return {httpMethod:'GET',queryStringParameters:params};}
test.afterEach(()=>{global.fetch=originalFetch;if(savedToken===undefined)delete process.env.GTA_API_TOKEN;else process.env.GTA_API_TOKEN=savedToken;});
test('Thai relay returns validated quote with original announcement timestamp, not fetch timestamp',async()=>{
 delete process.env.GTA_API_TOKEN;
 fake([
  ['/gold/latest',{data:{source:'gta',bar_buy:'59,750',bar_sell:'59,950',orn_buy:'58547.92',orn_sell:'60750',as_time:'2026-11-19T16:16:00',seq:'33',chg_prev:'-50',spot:'3733',usdthb:'33.89'}}],
  ['/api/v1/spot',{spot_usd_oz:3725,updated_at:today}]
 ]);
 const r=await handler(event({mode:'quotes'})),d=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(d.thai.sellBar,59950);assert.equal(d.thai.buyBar,59750);
 assert.equal(d.thai.updatedAt,'2026-11-19T09:16:00.000Z');
 assert.equal(d.thai.sourceType,'public-relay');assert.equal(d.thai.round,33);assert.equal(d.thai.stale,true);
 assert.equal(d.world.price,3725);
});
test('falls back to ThaiGoldToday if Rakhagold is invalid',async()=>{
 delete process.env.GTA_API_TOKEN;
 fake([
  ['/gold/latest',{data:{source:'est',bar_buy:'9999',bar_sell:'10099',as_time:thaiNow}}],
  ['/api/gold-price',{current:{buyBar:59800,sellBar:60000,buyOrnament:58800,sellOrnament:60800,change:50,updateRound:14,updatedAt:today},world:{thbRate:33.9}}],
  ['/api/v1/spot',{spot_usd_oz:3700,updated_at:today}]
 ]);
 const d=JSON.parse((await handler(event({mode:'quotes'}))).body);
 assert.equal(d.thai.sellBar,60000);assert.equal(d.thai.source,'ThaiGoldToday · อ้างอิงสมาคมค้าทองคำ');
});
test('picks most recently announced Thai quote, not whichever provider replies first',async()=>{
 delete process.env.GTA_API_TOKEN;
 fake([
   ['/gold/latest',{data:{source:'gta',bar_buy:'59750',bar_sell:'59950',as_time:'2026-11-19T16:16:00',seq:'33'}}],
   ['/api/gold-price',{current:{buyBar:60000,sellBar:60200,updatedAt:today,updateRound:1}}]
 ]);
 const r=await handler(event({mode:'quotes'})),d=JSON.parse(r.body);
 assert.equal(d.thai.sellBar,60200);
 assert.equal(d.thai.sourceType,'public-relay');
 assert.equal(d.thai.source,'ThaiGoldToday · อ้างอิงสมาคมค้าทองคำ');
});
test('can use CHNWT as the third fallback; reject future or missing timestamps',async()=>{
 delete process.env.GTA_API_TOKEN;
 const nowTH=new Date().toLocaleString('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 const [day,month,year]=nowTH.slice(0,10).split('/');
 fake([['thai-gold-api/latest',{status:'success',response:{update_date:`${day}/${month}/${Number(year)+543}`,update_time:'เวลา 12:00 น. (ครั้งที่ 2)',price:{gold:{buy:'58,000',sell:'60,000'},gold_bar:{buy:'59,750',sell:'59,950'}}}}]]);
 const d=JSON.parse((await handler(event({mode:'quotes'}))).body);
 assert.equal(d.thai.sellBar,59950);assert.equal(d.thai.round,2);
});
test('official feed takes precedence when configured and no token leaks',async()=>{
 process.env.GTA_API_TOKEN='test-secret-key';
 fake([
  ['/api/v1/price/latest',(url,opts)=>{assert.equal(opts.headers.Authorization,'Bearer test-secret-key');return {gold_bar:{buy:70500,sell:70700},ornament:{buy:69000,sell:71500},announceNo:5,announcedAt:today};}],
  ['/api/v1/spot',{spot_usd_oz:4255,updated_at:today}]
 ]);
 const r=await handler(event({mode:'quotes'})),d=JSON.parse(r.body);
 assert.equal(d.thai.sourceType,'official');assert.equal(d.thai.round,5);assert.ok(!r.body.includes('test-secret-key'));
});
test('all feeds fail => never return an invented quote',async()=>{
 delete process.env.GTA_API_TOKEN;fake([]);
 const r=await handler(event({mode:'quotes'})),d=JSON.parse(r.body);
 assert.equal(r.statusCode,503);assert.equal(d.thai,null);assert.equal(d.world,null);
});
test('Thai daily history strips estimated rows, sorts chronologically, validates OHLC',async()=>{
 delete process.env.GTA_API_TOKEN;
 fake([['/gold/daily',{data:[
  {date:'2026-11-19',source:'gta',rounds:'24',open_sell:'60350',close_sell:'59950',close_buy:'59750',high:'60350',low:'59750'},
  {date:'2026-10-20',source:'est',rounds:'0',open_sell:'65000',close_sell:'65000',high:'65000',low:'65000'},
  {date:'2026-11-18',source:'gta',rounds:'9',open_sell:'61100',close_sell:'60750',close_buy:'60550',high:'61100',low:'60700'},
  {date:'2026-11-17',source:'gta',rounds:'14',open_sell:'62000',close_sell:'61850',close_buy:'61650',high:'61800',low:'62000'}
 ]}]]);
 const r=await handler(event({mode:'chart',market:'thai',period:'3M'})),d=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(d.quality,'reported-daily-ohlc');assert.equal(d.isDaily,true);
 assert.equal(d.points.length,2);assert.equal(d.points[0].c,60750);assert.equal(d.points[1].c,59950);
 assert.equal(d.points[1].t,'2026-11-19T05:00:00.000Z');
});
test('Thai 1D intraday announced series works without official token',async()=>{
 fake([['/gold/today',{data:[
  {source:'gta',as_time:'2026-11-19T09:05:00',bar_buy:'60150',bar_sell:'60350',seq:'1'},
  {source:'gta',as_time:'2026-11-19T10:05:00',bar_buy:'60050',bar_sell:'60250',seq:'3'}
 ]}]]);
 const r=await handler(event({mode:'chart',market:'thai',period:'1D'})),d=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(d.isDaily,false);assert.equal(d.points.length,2);
});
test('World real OHLC chart points still work',async()=>{
 fake([['/api/v1/chart',{points:[{t:1763600400,o:4100,h:4140,l:4080,c:4120},{t:1763590400,o:4080,h:4100,l:4050,c:4090}]}]]);
 const r=await handler(event({mode:'chart',market:'world',period:'1M'})),d=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(d.points.length,2);assert.equal(d.points[0].c,4090);
});
test('Bad HTTP method is rejected',async()=>{assert.equal((await handler({httpMethod:'POST'})).statusCode,405)});