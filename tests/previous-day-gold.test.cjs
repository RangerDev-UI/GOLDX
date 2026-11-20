const test=require('node:test');
const assert=require('node:assert/strict');
const feed=require('../netlify/functions/thai-feed.js');
const gateway=require('../netlify/functions/market.js');

const day=ts=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));
const today=()=>day(Date.now());
const prior=()=>{
 const d=new Date(today()+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
};
const record=(timestamp,overrides={})=>({
 source:'gta',date:prior(),as_time:prior()+'T'+timestamp+':00',
 bar_buy:'59900',bar_sell:'60100',orn_buy:'58699.52',orn_sell:'60900',...overrides
});

test('Previous-day quote chooses final GTA record, uses all four raw prices',async()=>{
 const urls=[];
 const result=await feed.previousQuote(today(),async url=>{
  urls.push(url);
  return {data:[
   record('09:10',{bar_buy:'59500',bar_sell:'59700',orn_buy:'58123.44',orn_sell:'60500'}),
   record('16:10'),
   record('17:40',{source:'est',bar_sell:'70000'}),
   record('18:30',{date:today(),bar_sell:'80000'})
  ]};
 });
 assert.equal(urls.length,1,'one public historical call, not repeated per quote');
 assert.match(urls[0],/\/today\?date=/);
 assert.equal(result.before,today());
 assert.equal(result.previous.date,prior());
 assert.equal(result.previous.sellBar,60100);
 assert.equal(result.previous.buyBar,59900);
 assert.equal(result.previous.buyOrnament,58699.52);
 assert.equal(result.previous.sellOrnament,60900);
 assert.match(result.previous.source,/Rakhagold/);
 assert.equal(result.referenceType,'previous-calendar-day');
});

test('Missing or unverified historical prices become null, never estimated',async()=>{
 const result=await feed.previousQuote(today(),async()=>({data:[
  record('10:20',{source:'est'}),
  record('11:30',{orn_buy:null}),
  record('12:00',{bar_buy:'63000',bar_sell:'60100'})
 ]}));
 assert.equal(result.previous,null);
 assert.match(result.message,/ไม่พบราคาครบ/);
});

test('Reject invalid/future/ancient previous-day requests before any fetch',async()=>{
 let calls=0;
 for(const before of ['bad','2026-02-31','1990-01-01','2032-12-31']){
  await assert.rejects(feed.previousQuote(before,async()=>{calls++;return {data:[]}}));
 }
 assert.equal(calls,0);
});

test('Authorized GTA history can select prior announced day with confirmed ornament prices',async()=>{
 const old=process.env.GTA_API_TOKEN;process.env.GTA_API_TOKEN='GTA-TEST-ONLY';
 const d=new Date(today()+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-2);
 const earlier=d.toISOString().slice(0,10);
 let calls=0;
 try{
  const result=await feed.previousQuote(today(),async(url,options)=>{
   calls++;
   assert.match(url,/announce\.goldtraders\.or\.th\/api\/v1\/price\/history\?days=8/);
   assert.equal(options.headers.Authorization,'Bearer GTA-TEST-ONLY');
   return {items:[{
    announcedAt:earlier+'T10:20:00+07:00',gold_bar:{buy:59000,sell:59200},
    ornament:{buy:57981.56,sell:60000}
   }]};
  });
  assert.equal(calls,1);
  assert.equal(result.previous.date,earlier);
  assert.equal(result.previous.buyOrnament,57981.56);
  assert.equal(result.referenceType,'previous-announcement-day');
 }finally{
  if(old===undefined)delete process.env.GTA_API_TOKEN;
  else process.env.GTA_API_TOKEN=old;
 }
});

test('Existing market gateway exposes previous-thai via cached JSON route',async()=>{
 const real=feed.previousQuote;
 feed.previousQuote=async before=>({before,previous:null,message:'no history'});
 try{
  const res=await gateway.handler({httpMethod:'GET',queryStringParameters:{mode:'previous-thai',before:today()}});
  assert.equal(res.statusCode,200);
  assert.match(res.headers['Cache-Control'],/s-maxage=1800/);
  assert.deepEqual(JSON.parse(res.body),{before:today(),previous:null,message:'no history'});
 }finally{feed.previousQuote=real;}
});
