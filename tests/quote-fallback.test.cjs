const test=require('node:test');
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/market.js');
const originalFetch=global.fetch;
const now=new Date();
const old=new Date(now.getTime()-600000).toISOString();
const recent=now.toISOString();
function fake(routes){
 global.fetch=async url=>{
   const match=routes.find(([fragment])=>String(url).includes(fragment));
   if(!match)throw Error('blocked '+String(url));
   const body=match[1];
   return {ok:true,status:200,json:async()=>body,text:async()=>JSON.stringify(body)};
 };
}
test.afterEach(()=>{global.fetch=originalFetch;});
test('stale primary XAU data gives way to fresher validated backup',async()=>{
 fake([
   ['/api/v1/spot',{spot_usd_oz:4200,updated_at:old}],
   ['gold-api.com/price/XAU',{price:4210,updatedAt:recent}],
 ]);
 const r=await handler({httpMethod:'GET',queryStringParameters:{mode:'quotes'}});
 const d=JSON.parse(r.body);
 assert.equal(r.statusCode,200);
 assert.equal(d.world.price,4210);
 assert.equal(d.world.source,'Gold API · XAU/USD');
 assert.equal(d.health.fields.world,'ok');
 assert.equal(d.checkedAt,d.fetchedAt);
 assert.equal(d.health.sourceTimes.world,recent);
});
test('invalid primary spot returns no invented price when all alternatives fail',async()=>{
 fake([
   ['/api/v1/spot',{spot_usd_oz:-1,updated_at:recent}]
 ]);
 const d=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:{mode:'quotes'}})).body);
 assert.equal(d.world,null);
 assert.equal(d.health.fields.world,'unavailable');
});
test('incorrect FX from fresh XAU feed is rejected; valid daily reference is selected',async()=>{
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 fake([
   ['/api/v1/spot',{spot_usd_oz:4200,updated_at:recent,fx_rates:{THB:900}}],
   ['/v2/rate/usd/thb',{rate:33.5,date}]
 ]);
 const d=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:{mode:'quotes'}})).body);
 assert.equal(d.fx?.usdThb,33.5);
 assert.equal(d.fx?.rateType,'daily-reference');
 assert.equal(d.health.fields.fx,'reference');
});
