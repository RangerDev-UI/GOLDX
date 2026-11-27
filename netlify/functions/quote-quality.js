/** Shared quote validation and health states. Never replace unknown prices with estimates. */
'use strict';
const number = v => typeof v === 'number' && Number.isFinite(v);
const positive = v => number(v) && v > 0;
const timestamp = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};
const validTimestamp = (value, now=Date.now()) => {
  const ms=timestamp(value);
  return ms !== null && ms >= Date.parse('2020-01-01T00:00:00Z') && ms <= now+300000;
};
const bounds = (value,min,max) => positive(value) && value>=min && value<=max;
function validateThai(q,now=Date.now()){
  if(!q || !bounds(q.buyBar,5000,300000) || !bounds(q.sellBar,5000,300000) ||
     q.buyBar>q.sellBar || !validTimestamp(q.updatedAt,now)) return false;
  if(q.buyOrnament!=null && !bounds(q.buyOrnament,5000,350000))return false;
  if(q.sellOrnament!=null && !bounds(q.sellOrnament,5000,350000))return false;
  if(positive(q.buyOrnament)&&positive(q.sellOrnament)&&q.buyOrnament>q.sellOrnament)return false;
  return true;
}
function validateWorld(q,now=Date.now()){
  if(!q || !bounds(q.price,100,20000) || !validTimestamp(q.updatedAt,now))return false;
  if(q.perGram!=null && (!positive(q.perGram)||Math.abs(q.perGram-q.price/31.1034768)/(q.price/31.1034768)>0.03))return false;
  return true;
}
function validateFx(fx,now=Date.now()){
  if(!fx || !bounds(fx.usdThb,10,100))return false;
  if(fx.rateType==='daily-reference'){
    if(typeof fx.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fx.asOf))return false;
    const ms=Date.parse(fx.asOf+'T00:00:00Z');
    return Number.isFinite(ms)&&ms<=now+86400000&&now-ms<=10*86400000;
  }
  return validTimestamp(fx.asOf,now);
}
const bangkokDay = t => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
function health(thai,world,fx,now=Date.now()){
  const thaiValid=validateThai(thai,now), worldValid=validateWorld(world,now), fxValid=validateFx(fx,now);
  const today=thaiValid&&bangkokDay(new Date(thai.updatedAt))===bangkokDay(new Date(now));
  const thaiState=!thaiValid?'unavailable':(!today||thai.stale===true||thai.announcedToday===false)?'stale':'ok';
  const worldAge=worldValid?now-Date.parse(world.updatedAt):Infinity;
  const worldState=!worldValid?'unavailable':(world.stale===true||worldAge>180000)?'stale':'ok';
  const fxAge=fxValid && fx.rateType!=='daily-reference'?now-Date.parse(fx.asOf):Infinity;
  const fxState=!fxValid?'unavailable':fx.rateType==='daily-reference'?'reference':fxAge>180000?'stale':'ok';
  const fields={thai:thaiState,world:worldState,fx:fxState};
  const states=Object.values(fields);
  const status=states.every(s=>s==='unavailable')?'unavailable':states.includes('unavailable')?'partial':states.some(s=>s!=='ok')?'stale':'ok';
  return {status,fields,checkedAt:new Date(now).toISOString(),sourceTimes:{
    thai:thaiValid?thai.updatedAt:null,world:worldValid?world.updatedAt:null,fx:fxValid?fx.asOf:null
  }};
}
module.exports={validateThai,validateWorld,validateFx,health};
