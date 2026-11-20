/** GOLDX Thai feed: independently attributed public relays, validated GTA observations.
 * No simulated prices, no official attribution unless official token was used.
 */
'use strict';
const RAKHA='https://rakhagold.com/wp-json/priceradar/v1/gold';
const n=(v)=>{if(v===null||v===undefined||v==='')return null;const q=Number(typeof v==='string'?v.replace(/,/g,''):v);return Number.isFinite(q)?q:null;};
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const iso=v=>{if(!v)return null;const d=new Date(v);return Number.isFinite(+d)?d.toISOString():null;};
// Rakhagold's as_time is local wall time in Asia/Bangkok; NEVER parse it as UTC.
function thaiTime(value){
 if(typeof value!=='string')return null;
 const s=value.trim();
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(s))return iso(s+'+07:00');
 return iso(s);
}
function dateTH(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function validQuote(q){
 if(!q||!positive(q.sellBar)||!positive(q.buyBar)||q.buyBar>q.sellBar||q.sellBar>300000||q.buyBar<5000)return false;
 if(!q.updatedAt||Date.parse(q.updatedAt)>Date.now()+300000||Date.parse(q.updatedAt)<Date.parse('2020-01-01'))return false;
 return true;
}
function markQuote(q){
 if(!validQuote(q))throw new Error('Invalid Thai quote or missing announcement timestamp');
 q.announcedToday=dateTH(q.updatedAt)===dateTH(Date.now());
 q.stale=!q.announcedToday;
 return q;
}
function parseChnwtDate(d,t){
 const m=/^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(String(d||''));
 const h=/(\d\d?):(\d\d)/.exec(String(t||''));
 if(!m||!h)return null;
 const year=Number(m[3])>2400?Number(m[3])-543:Number(m[3]);
 return thaiTime(`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${h[1].padStart(2,'0')}:${h[2]}:00`);
}
async function quote(json){
 const providers=[];
 if(process.env.GTA_API_TOKEN)providers.push(async()=>{
   const d=await json('https://announce.goldtraders.or.th/api/v1/price/latest',{headers:{Authorization:`Bearer ${process.env.GTA_API_TOKEN}`}});
   return markQuote({buyBar:n(d.gold_bar?.buy),sellBar:n(d.gold_bar?.sell),buyOrnament:n(d.ornament?.buy),sellOrnament:n(d.ornament?.sell),change:n(d.change),changePercent:null,round:n(d.announceNo),updatedAt:iso(d.announcedAt),source:'สมาคมค้าทองคำ · API ทางการ',sourceUrl:'https://www.goldtraders.or.th/',sourceType:'official',spot:n(d.spot?.usd),fx:n(d.fx?.usd_thb),marketOpen:d.market?.open??null});
 });
 providers.push(async()=>{
   const d=await json(`${RAKHA}/latest`),c=d.data;
   if(!c||c.source!=='gta')throw new Error('Rakhagold is not sourced from published GTA announcements');
   return markQuote({buyBar:n(c.bar_buy),sellBar:n(c.bar_sell),buyOrnament:n(c.orn_buy),sellOrnament:n(c.orn_sell),change:n(c.chg_prev),changePercent:null,round:n(c.seq),updatedAt:thaiTime(c.as_time),source:'Rakhagold · อ้างอิงประกาศสมาคมค้าทองคำ',sourceUrl:'https://rakhagold.com/api-docs/',sourceType:'public-relay',spot:n(c.spot),fx:n(c.usdthb),marketOpen:null});
 });
 providers.push(async()=>{
   const d=await json('https://www.thaigoldtoday.com/api/gold-price'),c=d.current||{};
   return markQuote({buyBar:n(c.buyBar),sellBar:n(c.sellBar),buyOrnament:n(c.buyOrnament),sellOrnament:n(c.sellOrnament),change:n(c.change),changePercent:n(c.changePercent),round:n(c.updateRound),updatedAt:iso(c.updatedAt),source:'ThaiGoldToday · อ้างอิงสมาคมค้าทองคำ',sourceUrl:'https://www.thaigoldtoday.com',sourceType:'public-relay',spot:n(d.world?.spotOz),fx:n(d.world?.thbRate),marketOpen:null});
 });
 providers.push(async()=>{
   const d=await json('https://api.chnwt.dev/thai-gold-api/latest'),c=d.response;
   if(d.status!=='success'||!c)throw new Error('CHNWT invalid response');
   return markQuote({buyBar:n(c.price?.gold_bar?.buy),sellBar:n(c.price?.gold_bar?.sell),buyOrnament:n(c.price?.gold?.buy),sellOrnament:n(c.price?.gold?.sell),change:null,changePercent:null,round:n(/ครั้งที่\s*(\d+)/.exec(c.update_time||'')?.[1]),updatedAt:parseChnwtDate(c.update_date,c.update_time),source:'CHNWT · ข้อมูลประกาศราคาทองคำไทย',sourceUrl:'https://github.com/max180643/thai-gold-api',sourceType:'public-relay',spot:null,fx:null,marketOpen:null});
 });
 // Compare validated announcements: prefer newest genuine timestamp over quickest upstream.
 // Requests run concurrently; a slow or broken provider never makes up a replacement price.
 const results=await Promise.allSettled(providers.map(p=>p()));
 const candidates=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(!candidates.length){console.warn('Thai public/official quote providers all unavailable');throw new Error('Thai quote providers unavailable');}
 candidates.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt) || (a.sourceType==='official'?-1:b.sourceType==='official'?1:0));
 return candidates[0];
}
function verifiedDaily(rows){
 if(!Array.isArray(rows))return [];
 const points=rows.filter(r=>r?.source==='gta'&&n(r.rounds)>0).map(r=>{
   const o=n(r.open_sell),h=n(r.high),l=n(r.low),c=n(r.close_sell),buy=n(r.close_buy);
   const t=thaiTime(`${r.date}T12:00:00`);
   return {t,o,h,l,c,buy,rounds:n(r.rounds),observed:true};
 }).filter(p=>p.t&&[p.o,p.h,p.l,p.c].every(positive)&&p.h>=Math.max(p.l,p.o,p.c)&&p.l<=Math.min(p.h,p.o,p.c)&&p.c<300000&&p.l>5000)
   .sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 return points.filter((p,i)=>i===0||p.t!==points[i-1].t);
}
function verifiedToday(rows){
 if(!Array.isArray(rows))return [];
 const points=rows.filter(r=>r?.source==='gta').map(r=>({t:thaiTime(r.as_time),c:n(r.bar_sell),buy:n(r.bar_buy),round:n(r.seq),observed:true})).filter(p=>p.t&&positive(p.c)&&positive(p.buy)&&p.c>=p.buy&&p.c<300000).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 if(!points.length)return [];
 const lastDay=dateTH(points.at(-1).t);
 return points.filter((p,i)=>dateTH(p.t)===lastDay&&(i===0||p.t!==points[i-1].t));
}
async function history(period,json,response){
 const days=period==='1W'?7:period==='1M'?30:period==='3M'?90:period==='1Y'?365:7;
 const source='Rakhagold · ราคาอ้างอิงประกาศสมาคมฯ (เฉพาะรายการ gta)';
 if(period==='1D'){
   try{
     const d=await json(`${RAKHA}/today`),points=verifiedToday(d.data);
     if(points.length>=2)return response({market:'thai',period,source,isDaily:false,quality:'reported-announcements',points,fetchedAt:new Date().toISOString()},200,300);
   }catch(e){console.warn('Thai announcement intraday unavailable:',e.message);}
 }
 try{
   const d=await json(`${RAKHA}/daily?days=${period==='1D'?7:days}`),points=verifiedDaily(d.data);
   if(points.length<2)throw new Error('Insufficient recorded GTA daily prices');
   const first=dateTH(points[0].t),last=dateTH(points.at(-1).t);
   return response({market:'thai',period,source,isDaily:true,quality:'reported-daily-ohlc',points,coverage:{first,last,count:points.length},fetchedAt:new Date().toISOString()},200,300);
 }catch(e){
   // Authorized official history is an optional alternate, never exposed as a free feed.
   if(!process.env.GTA_API_TOKEN)throw e;
   const d=await json(`https://announce.goldtraders.or.th/api/v1/price/history?days=${Math.min(days,90)}`,{headers:{Authorization:`Bearer ${process.env.GTA_API_TOKEN}`}});
   const points=(Array.isArray(d.items)?d.items:[]).map(p=>({t:iso(p.announcedAt),c:n(p.gold_bar?.sell),buy:n(p.gold_bar?.buy),observed:true})).filter(p=>p.t&&positive(p.c)&&positive(p.buy)&&p.buy<=p.c).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
   if(points.length<2)throw new Error('Official history insufficient');
   return response({market:'thai',period,source:'สมาคมค้าทองคำ · API ประกาศย้อนหลัง',isDaily:false,quality:'official-announcements',points,fetchedAt:new Date().toISOString()},200,300);
 }
}
module.exports={quote,history,verifiedDaily,verifiedToday,thaiTime,markQuote};