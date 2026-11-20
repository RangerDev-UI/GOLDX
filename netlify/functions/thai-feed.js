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

// Public GTA homepage is an optional read-only fallback, not the members-only API.
// Refuse to parse a price unless its official announcement timestamp is present.
function officialWebQuote(html){
 if(typeof html!=='string'||html.length<100)throw new Error('Official webpage missing HTML');
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
   .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 const stamp=/ประจำวันที่\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*เวลา\s*(\d{1,2}):(\d{2})(?:\s*น\.)?(?:\s*\(ครั้งที่\s*(\d+)\))?/i.exec(text);
 if(!stamp)throw new Error('Official webpage missing announcement date');
 const [_,day,month,rawYear,hour,min,seq]=stamp;
 const year=Number(rawYear)>2400?Number(rawYear)-543:Number(rawYear);
 const announcedAt=thaiTime(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hour.padStart(2,'0')}:${min}:00`);
 // Limit extraction to the gold price area, never prices in unrelated news.
 const start=text.search(/ทองคำแท่ง\s*96\.5%/i);
 const ornamentStart=text.search(/ทองรูปพรรณ\s*96\.5%/i);
 if(start<0||ornamentStart<=start||ornamentStart-start>900)throw new Error('Official gold quote panel missing');
 const bar=text.slice(start,ornamentStart);
 const goldOrn=text.slice(ornamentStart,ornamentStart+380);
 const buy=/รับซื้อ\s*([\d,]+(?:\.\d{1,2})?)/.exec(bar);
 const sell=/ขายออก\s*([\d,]+(?:\.\d{1,2})?)/.exec(bar);
 if(!buy||!sell)throw new Error('Official webpage price markers missing');
 const ornBuy=/รับซื้อ\s*([\d,]+(?:\.\d{1,2})?)/.exec(goldOrn);
 const ornSell=/ขายออก\s*([\d,]+(?:\.\d{1,2})?)/.exec(goldOrn);
 return markQuote({buyBar:n(buy[1]),sellBar:n(sell[1]),buyOrnament:n(ornBuy?.[1]),sellOrnament:n(ornSell?.[1]),
   change:null,changePercent:null,round:n(seq),updatedAt:announcedAt,
   source:'หน้าเว็บสมาคมค้าทองคำ · ประกาศสาธารณะ',sourceUrl:'https://www.goldtraders.or.th/',
   sourceType:'official-public-page',spot:null,fx:null,marketOpen:null});
}

// A public announcement-history table can be parsed without member credentials.
// Only rows with a *date, time, round and coherent bar/ornament prices* are accepted.
function officialTableQuote(html, pageUrl='https://classic.goldtraders.or.th/UpdatePriceList.aspx'){
 if(typeof html!=='string'||html.length<200)throw new Error('Official table missing HTML');
 const clean=(s)=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
   .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const candidates=[];
 for(const row of rows){
   const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1]));
   if(cells.length<8)continue;
   const joined=cells.join(' ').replace(/\s+/g,' ').trim();
   // Explicit date, time, sequence number and at least four price fields.
   const m=/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})(?:\s*น\.)?\s+(\d{1,4})\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?:\s+([\d,]+(?:\.\d+)?))?(?:\s+([\d,]+(?:\.\d+)?))?(?:\s+([+-]?[\d,]+(?:\.\d+)?))?/i.exec(joined);
   if(!m)continue;
   const dm=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(m[1]);
   const y=Number(dm[3])>2400?Number(dm[3])-543:Number(dm[3]);
   const t=thaiTime(`${y}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}T${m[2].padStart(5,'0')}:00`);
   const buyBar=n(m[4]),sellBar=n(m[5]),buyOrnament=n(m[6]),sellOrnament=n(m[7]);
   if(!positive(buyBar)||!positive(sellBar)||!positive(buyOrnament)||!positive(sellOrnament))continue;
   if(sellBar-buyBar>1000||sellBar<buyBar||sellOrnament<sellBar||sellOrnament-sellBar>3000||buyOrnament>buyBar||buyBar-buyOrnament>3000)continue;
   try{candidates.push(markQuote({buyBar,sellBar,buyOrnament,sellOrnament,
     round:n(m[3]),change:n(m[10]),changePercent:null,updatedAt:t,
     source:'สมาคมค้าทองคำ · ตารางประกาศสาธารณะ',sourceUrl:pageUrl,
     sourceType:'official-public-page',spot:n(m[8]),fx:n(m[9]),marketOpen:null}));}
   catch(_e){/* invalid official record is not displayed */}
 }
 if(!candidates.length)throw new Error('Official table has no verifiable announcement rows');
 candidates.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||b.round-a.round);
 return candidates[0];
}
async function fetchOfficialPage(url, type){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),4500);
 try{
  const r=await fetch(url,{signal:controller.signal,
    headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'GOLDX/1.1 (public market reference)'}});
  if(!r.ok)throw new Error(`Official website HTTP ${r.status}`);
  const html=await r.text();
  return type==='table'?officialTableQuote(html,url):officialWebQuote(html);
 } finally{clearTimeout(timeout);}
}
async function quote(json){
 const providers=[];
 const add=(name,run)=>providers.push({name,run});
 if(process.env.GTA_API_TOKEN)add('GTA API',async()=>{
   const d=await json('https://announce.goldtraders.or.th/api/v1/price/latest',{headers:{Authorization:`Bearer ${process.env.GTA_API_TOKEN}`}});
   return markQuote({buyBar:n(d.gold_bar?.buy),sellBar:n(d.gold_bar?.sell),buyOrnament:n(d.ornament?.buy),sellOrnament:n(d.ornament?.sell),change:n(d.change),changePercent:null,round:n(d.announceNo),updatedAt:iso(d.announcedAt),source:'สมาคมค้าทองคำ · API ทางการ',sourceUrl:'https://www.goldtraders.or.th/',sourceType:'official',spot:n(d.spot?.usd),fx:n(d.fx?.usd_thb),marketOpen:d.market?.open??null});
 });
 add('Rakhagold',async()=>{
   const d=await json(`${RAKHA}/latest`),c=d.data;
   if(!c||c.source!=='gta')throw new Error('Relay not sourced from GTA announcement');
   return markQuote({buyBar:n(c.bar_buy),sellBar:n(c.bar_sell),buyOrnament:n(c.orn_buy),sellOrnament:n(c.orn_sell),change:n(c.chg_prev),changePercent:null,round:n(c.seq),updatedAt:thaiTime(c.as_time),source:'Rakhagold · อ้างอิงประกาศสมาคมค้าทองคำ',sourceUrl:'https://rakhagold.com/api-docs/',sourceType:'public-relay',spot:n(c.spot),fx:n(c.usdthb),marketOpen:null});
 });
 add('ThaiGoldToday',async()=>{
   const d=await json('https://www.thaigoldtoday.com/api/gold-price'),c=d.current||{};
   return markQuote({buyBar:n(c.buyBar),sellBar:n(c.sellBar),buyOrnament:n(c.buyOrnament),sellOrnament:n(c.sellOrnament),change:n(c.change),changePercent:n(c.changePercent),round:n(c.updateRound),updatedAt:iso(c.updatedAt),source:'ThaiGoldToday · อ้างอิงสมาคมค้าทองคำ',sourceUrl:'https://www.thaigoldtoday.com',sourceType:'public-relay',spot:n(d.world?.spotOz),fx:n(d.world?.thbRate),marketOpen:null});
 });
 add('CHNWT',async()=>{
   const d=await json('https://api.chnwt.dev/thai-gold-api/latest'),c=d.response;
   if(d.status!=='success'||!c)throw new Error('Invalid relay response');
   return markQuote({buyBar:n(c.price?.gold_bar?.buy),sellBar:n(c.price?.gold_bar?.sell),buyOrnament:n(c.price?.gold?.buy),sellOrnament:n(c.price?.gold?.sell),change:null,changePercent:null,round:n(/ครั้งที่\s*(\d+)/.exec(c.update_time||'')?.[1]),updatedAt:parseChnwtDate(c.update_date,c.update_time),source:'CHNWT · ข้อมูลประกาศราคาทองคำไทย',sourceUrl:'https://github.com/max180643/thai-gold-api',sourceType:'public-relay',spot:null,fx:null,marketOpen:null});
 });
 add('GTA home',()=>fetchOfficialPage('https://www.goldtraders.or.th/','home'));
 add('GTA classic table',()=>fetchOfficialPage('https://classic.goldtraders.or.th/UpdatePriceList.aspx','table'));
 add('GTA sideb table',()=>fetchOfficialPage('https://sideb.goldtraders.or.th/UpdatePriceList.aspx','table'));
 const results=await Promise.allSettled(providers.map(p=>p.run()));
 const candidates=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(!candidates.length){console.warn('All Thai quote providers unavailable',results.map((r,i)=>`${providers[i].name}: ${r.status==='rejected'?r.reason?.message:'unexpected'}`).join('; '));throw new Error('Thai quote providers unavailable');}
 // Include read-only provider diagnostics to distinguish a stale relay from blocked sources.
 const checks=results.map((r,i)=>r.status==='fulfilled'?
   {name:providers[i].name,ok:true,updatedAt:r.value.updatedAt,stale:r.value.stale}:
   {name:providers[i].name,ok:false,reason:String(r.reason?.message||'Unavailable').slice(0,140)});
 candidates.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||
  ((a.sourceType==='official'?2:a.sourceType==='official-public-page'?1:0) - (b.sourceType==='official'?2:b.sourceType==='official-public-page'?1:0))*-1);
 const chosen=candidates[0];chosen.feedChecks=checks;
 return chosen;
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
module.exports={quote,history,verifiedDaily,verifiedToday,thaiTime,markQuote,officialWebQuote,officialTableQuote};