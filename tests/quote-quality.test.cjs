const test=require('node:test');
const assert=require('node:assert/strict');
const {validateThai,validateWorld,validateFx,health}=require('../netlify/functions/quote-quality.js');
const now=Date.parse('2026-11-27T08:00:00Z');
const thai={buyBar:60000,sellBar:60200,buyOrnament:59000,sellOrnament:61200,updatedAt:'2026-11-27T07:50:00Z',announcedToday:true,source:'Sample relay'};
const world={price:4300,perGram:4300/31.1034768,updatedAt:'2026-11-27T07:59:00Z',source:'Sample spot'};
const fx={usdThb:33.5,asOf:'2026-11-27T07:59:00Z',rateType:'provider-quote'};
test('valid prices retain original source timestamp; checking time is separate',()=>{
 assert.equal(validateThai(thai,now),true);
 assert.equal(validateWorld(world,now),true);
 const state=health(thai,world,fx,now);
 assert.equal(state.status,'ok');
 assert.equal(state.checkedAt,'2026-11-27T08:00:00.000Z');
 assert.equal(state.sourceTimes.thai,thai.updatedAt);
 assert.equal(state.sourceTimes.world,world.updatedAt);
});
test('invalid bid/ask, ornament quotes, missing or future time are rejected',()=>{
 assert.equal(validateThai({...thai,buyBar:65000},now),false);
 assert.equal(validateThai({...thai,buyOrnament:65000},now),false);
 assert.equal(validateThai({...thai,updatedAt:null},now),false);
 assert.equal(validateThai({...thai,updatedAt:'2026-11-27T09:00:00Z'},now),false);
});
test('world spot and per-gram inconsistencies cannot pass through',()=>{
 assert.equal(validateWorld({...world,price:-1},now),false);
 assert.equal(validateWorld({...world,price:90000},now),false);
 assert.equal(validateWorld({...world,perGram:12},now),false);
 assert.equal(validateWorld({...world,updatedAt:null},now),false);
});
test('freshness and no-data are distinct from API check time',()=>{
 const outdated={...world,updatedAt:'2026-11-27T07:00:00Z'};
 assert.equal(health(thai,outdated,fx,now).fields.world,'stale');
 assert.equal(health(null,null,null,now).status,'unavailable');
 assert.equal(health(thai,null,null,now).status,'partial');
 assert.equal(health({...thai,updatedAt:'2026-11-26T08:00:00Z'},world,fx,now).fields.thai,'stale');
});
test('FX rejects extreme rates and preserves daily reference category',()=>{
 assert.equal(validateFx({...fx,usdThb:5},now),false);
 assert.equal(validateFx({...fx,asOf:null},now),false);
 const daily={usdThb:33.4,asOf:'2026-11-26',rateType:'daily-reference'};
 assert.equal(validateFx(daily,now),true);
 assert.equal(health(thai,world,daily,now).fields.fx,'reference');
});
