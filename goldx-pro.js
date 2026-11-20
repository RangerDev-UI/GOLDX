/* GOLDX 3.0: real-data dashboard, advanced indicators and Thai historical calendar. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),ind=window.GOLDXIndicators;
const isNum=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=(n,d=0)=>isNum(n)?n.toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const money=(n,m)=>isNum(n)?(m==='thai'?'฿':'$')+fmt(n,m==='thai'?0:2):'—';
const set=(id,v)=>{const x=$(id);if(x)x.textContent=v};
const day=t=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const today=()=>day(Date.now());
const dateText=t=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(new Date(t));
const S={quote:null,ticks:[],tickSource:'',dayBar:null,previousClose:null,dailySource:'',chart:null,indicator:null,history:[],source:'',status:'idle',month:null,selected:null,page:0};
const PAGE=12;
async function getJSON(url){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
 try{
  const r=await fetch(url,{signal:c.signal,cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer);}
}
function fresh(q){return !!(q&&q.updatedAt&&!q.stale&&q.announcedToday!==false&&day(q.updatedAt)===today())}
function renderToday(){
 const q=S.quote&&S.quote.thai,valid=!!(q&&isNum(q.sellBar)&&q.sellBar>0),current=S.ticks.filter(p=>day(p.t)===today()),measured=current.length>=2;
 const bar=S.dayBar,freshToday=fresh(q);
 set('gxTodaySell',valid?'฿'+fmt(q.sellBar):'—');
 set('gxTodayPriceSub',freshToday?'ทองแท่งขายออก · ประกาศวันนี้':'ราคาประกาศล่าสุด · อาจเป็นวันก่อนหน้า');
 set('gxTodayRound',freshToday&&isNum(q.round)?'ครั้งที่ '+fmt(q.round):'—');
 set('gxQuoteUpdated',valid?dateText(q.updatedAt):'ยังไม่มีข้อมูล');
 set('gxDailySource',q&&q.source?q.source:'ไม่พบแหล่งข้อมูลราคาทองไทย');
 const status=$('gxTodayStatus');status.textContent=!valid?'ยังไม่มีข้อมูล':freshToday?'ประกาศวันนี้':'ประกาศก่อนหน้า';status.classList.toggle('is-warning',!freshToday);
 const fromDaily=bar&&[bar.o,bar.h,bar.l,bar.c].every(v=>isNum(v)&&v>0);
 const displayHigh=measured?Math.max(...current.map(p=>p.c)):fromDaily?bar.h:null;
 const displayLow=measured?Math.min(...current.map(p=>p.c)):fromDaily?bar.l:null;
 set('gxTodayHigh',isNum(displayHigh)?'฿'+fmt(displayHigh):'—');
 set('gxTodayLow',isNum(displayLow)?'฿'+fmt(displayLow):'—');
 set('gxTodayRangeSub',measured?'ช่วงราคาจากประกาศรายรอบที่เข้าถึงได้':fromDaily?'สูง–ต่ำจากชุดข้อมูล OHLC รายวัน':'ยังไม่มีข้อมูลช่วงราคาที่ตรวจสอบได้');
 let delta=null,source='';
 if(measured){delta=current.at(-1).c-current[0].c;source='เทียบประกาศแรกกับล่าสุดในชุดข้อมูล';}
 else if(fromDaily){delta=bar.c-bar.o;source='เทียบเปิดกับปิดในชุดข้อมูล OHLC รายวัน';}
 else if(freshToday&&isNum(S.previousClose)){delta=q.sellBar-S.previousClose;source='เทียบราคาล่าสุดกับราคาปิดวันทำการก่อน';}
 set('gxTodayChange',isNum(delta)?(delta>0?'+':delta<0?'−':'')+'฿'+fmt(Math.abs(delta)):'—');
 $('gxTodayChange').classList.toggle('gx-up',isNum(delta)&&delta>0);
 $('gxTodayChange').classList.toggle('gx-down',isNum(delta)&&delta<0);
 set('gxTodayChangeSub',source||'ไม่มีราคาฐานเปรียบเทียบที่ยืนยันได้');
 set('gxDayDataNote',measured?'อ้างอิงประกาศรายรอบวันนี้ '+current.length+' ครั้ง · '+S.tickSource:
  fromDaily?'อ้างอิงข้อมูลรายวัน · '+S.dailySource+' · ไม่ใช่กราฟรายรอบ':
  'ไม่มีประกาศรายรอบหรือข้อมูล OHLC วันนี้เพียงพอ · ไม่แสดงตัวเลขประมาณการ');
}
async function loadToday(){
 const outcomes=await Promise.allSettled([
  getJSON('/api/market?mode=chart&market=thai&period=1D'),
  getJSON('/api/market?mode=chart&market=thai&period=1W')
 ]);
 S.ticks=[];S.tickSource='';S.dayBar=null;S.previousClose=null;S.dailySource='';
 if(outcomes[0].status==='fulfilled'){
  const d=outcomes[0].value;
  if(d.market==='thai'&&d.quality==='reported-announcements'&&d.isDaily===false&&Array.isArray(d.points)){
   S.ticks=d.points.map(p=>({t:p.t,c:Number(p.c)})).filter(p=>p.t&&isNum(p.c)&&p.c>0&&day(p.t)===today())
    .sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
   S.tickSource=d.source||'ประวัติประกาศวันนี้';
  }
 }
 if(outcomes[1].status==='fulfilled'){
  const d=outcomes[1].value,rows=Array.isArray(d.points)?d.points:[];
  if(d.market==='thai'&&d.isDaily===true&&d.quality==='reported-daily-ohlc'){
   const valid=rows.map(p=>({day:p.t?day(p.t):'',o:p.o,h:p.h,l:p.l,c:p.c}))
    .filter(p=>[p.o,p.h,p.l,p.c].every(v=>isNum(v)&&v>0)&&p.h>=Math.max(p.o,p.c,p.l)&&p.l<=Math.min(p.o,p.c))
    .sort((a,b)=>a.day.localeCompare(b.day));
   S.dayBar=valid.find(p=>p.day===today())||null;
   S.previousClose=valid.filter(p=>p.day<today()).at(-1)?.c??null;
   S.dailySource=d.source||'ข้อมูลรายวัน';
  }else if(d.market==='thai'&&d.isDaily===false&&d.quality==='official-announcements'){
   const valid=rows.filter(p=>p.t&&isNum(p.c)&&p.c>0).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
   S.previousClose=valid.filter(p=>day(p.t)<today()).at(-1)?.c??null;
   S.dailySource=d.source||'บันทึกประกาศย้อนหลัง';
  }
 }
 renderToday();
}
/* ===== Indicator panels and EMA overlays aligned to the existing chart ===== */
const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n};
function poly(series,x,y){
 let d='',active=false;
 for(let i=0;i<series.length;i++){
  if(!isNum(series[i])){active=false;continue;}
  d+=(active?'L':'M')+x(i).toFixed(2)+' '+y(series[i]).toFixed(2)+' ';active=true;
 }
 return d.trim();
}
function drawEMA(){
 const group=$('gxEmaOverlay');group.replaceChildren();
 if(!S.chart||!S.indicator)return;
 const points=S.chart.points,W=920,H=310,L=8,R=78,T=15,B=20;
 const values=points.flatMap(p=>[p.c,...(isNum(p.h)?[p.h]:[]),...(isNum(p.l)?[p.l]:[])]);
 let low=Math.min(...values),high=Math.max(...values),pad=(high-low||high*.003||1)*.18;low-=pad;high+=pad;
 const x=i=>L+i/(points.length-1)*(W-L-R),y=v=>T+(high-v)/(high-low)*(H-T-B);
 for(const [id,key,color]of [['gxShowEma20','ema20','#f2ca86'],['gxShowEma50','ema50','#79c5df'],['gxShowEma200','ema200','#baa1ef']]){
  if(!$(id).checked)continue;
  const d=poly(S.indicator[key],x,y);
  if(d)group.append(svg('path',{d,fill:'none',stroke:color,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round'}));
 }
}
function drawRSI(values){
 const host=$('gxRSIChart');host.replaceChildren();
 const n=values.length;if(!n||!values.some(isNum))return;
 const W=680,H=115,L=14,R=10,T=11,B=10,x=i=>L+(i/Math.max(1,n-1))*(W-L-R),y=v=>T+(100-v)/100*(H-T-B);
 for(const level of [30,50,70])host.append(svg('line',{x1:L,x2:W-R,y1:y(level),y2:y(level),stroke:level===50?'#5c6570':'#95805f','stroke-width':.8,'stroke-dasharray':'5 5'}));
 host.append(svg('path',{d:poly(values,x,y),fill:'none',stroke:'#e9c281','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'}));
}
function drawMACD(m){
 const host=$('gxMACDChart');host.replaceChildren();
 const count=m.line.length,nums=[...m.line,...m.signal,...m.histogram].filter(isNum);
 if(!nums.length)return;
 const W=680,H=115,L=14,R=10,T=11,B=10;let min=Math.min(0,...nums),max=Math.max(0,...nums),pad=(max-min||1)*.12;min-=pad;max+=pad;
 const x=i=>L+i/Math.max(1,count-1)*(W-L-R),y=v=>T+(max-v)/(max-min)*(H-T-B),zero=y(0),w=Math.max(1.2,Math.min(8,(W-L-R)/Math.max(1,count)*.72));
 host.append(svg('line',{x1:L,x2:W-R,y1:zero,y2:zero,stroke:'#61707b','stroke-width':.8,'stroke-dasharray':'5 5'}));
 for(let i=0;i<count;i++){
  const v=m.histogram[i];if(!isNum(v))continue;
  const yy=y(v);
  host.append(svg('rect',{x:x(i)-w/2,y:Math.min(yy,zero),width:w,height:Math.max(1,Math.abs(yy-zero)),fill:v>=0?'#73b89a':'#c07d78',opacity:.85}));
 }
 host.append(svg('path',{d:poly(m.line,x,y),stroke:'#e9c281',fill:'none','stroke-width':2,'stroke-linejoin':'round'}));
 host.append(svg('path',{d:poly(m.signal,x,y),stroke:'#82c3d9',fill:'none','stroke-width':2,'stroke-linejoin':'round'}));
}
function renderIndicators(){
 if(!S.chart||!S.indicator){
  for(const id of ['gxEma20Num','gxEma50Num','gxEma200Num','gxRSINum','gxMACDNum'])set(id,'—');
  for(const id of ['gxShowEma20','gxShowEma50','gxShowEma200'])$(id).disabled=true;
  $('gxEmaOverlay').replaceChildren();$('gxRSIChart').replaceChildren();$('gxMACDChart').replaceChildren();
  set('gxRSIStatus','ข้อมูลไม่พร้อม');set('gxMACDStatus','ข้อมูลไม่พร้อม');set('gxAdvDataNote','ตัวชี้วัดใช้ข้อมูลราคาย้อนหลังที่มีจริงเท่านั้น');
  return;
 }
 const p=S.chart.points,a=S.indicator,last=p.length-1;
 for(const [node,key,toggle]of [['gxEma20Num','ema20','gxShowEma20'],['gxEma50Num','ema50','gxShowEma50'],['gxEma200Num','ema200','gxShowEma200']]){
  const value=a[key][last];set(node,isNum(value)?money(value,S.chart.market):'—');$(toggle).disabled=!isNum(value);
 }
 const r=a.rsi14[last],h=a.macd.histogram[last];
 set('gxRSINum',isNum(r)?fmt(r,1):'—');
 set('gxMACDNum',isNum(h)?(h>=0?'+':'')+fmt(h,2):'—');
 set('gxRSIStatus',isNum(r)?r>=70?'RSI ≥ 70':r<=30?'RSI ≤ 30':'RSI อยู่ระหว่าง 30–70':'รอข้อมูลอย่างน้อย 15 จุด');
 set('gxMACDStatus',isNum(h)?h>=0?'Histogram เหนือศูนย์':'Histogram ต่ำกว่าศูนย์':'รอข้อมูลอย่างน้อย 34 จุด');
 drawEMA();drawRSI(a.rsi14);drawMACD(a.macd);
 set('gxAdvDataNote',(S.chart.market==='thai'?'ทองไทย':'ทองโลก')+' · '+S.chart.period+' · '+p.length+' จุดข้อมูล · EMA(20/50/200), RSI(14), MACD(12,26,9) จากราคาปิดจริง ไม่ใช่คำแนะนำลงทุน');
}
function onChart(e){
 if(!e.detail||!Array.isArray(e.detail.points)||e.detail.points.length<2)return clearChart();
 S.chart={points:e.detail.points,market:e.detail.market,period:e.detail.period};
 S.indicator=ind.fromPoints(e.detail.points);renderIndicators();
}
function clearChart(){S.chart=null;S.indicator=null;renderIndicators();}
/* ===== Verified Thai OHLC history: 1Y from existing /api/market ===== */
function monthKey(d){return d.slice(0,7);}
function moveMonth(key,amount){
 const [yy,mm]=key.split('-').map(Number),date=new Date(Date.UTC(yy,mm-1+amount,1));
 return date.toISOString().slice(0,7);
}
function monthLabel(key){
 const [yy,mm]=key.split('-').map(Number);
 return new Intl.DateTimeFormat('th-TH',{timeZone:'UTC',year:'numeric',month:'long'}).format(new Date(Date.UTC(yy,mm-1,1)));
}
function dayLabel(key){return dateText(key+'T05:00:00Z');}
function renderCalendar(){
 const host=$('gxCalendarDays');host.replaceChildren();
 if(!S.month){
  set('gxMonthLabel','ไม่มีข้อมูล');$('gxCalPrev').disabled=true;$('gxCalNext').disabled=true;
  set('gxCalCoverage','ยังไม่มีประวัติราคาที่ตรวจสอบได้');set('gxCalDetail','เลือกวันที่ที่มีข้อมูลสีทองเพื่อดูรายละเอียด');return;
 }
 set('gxMonthLabel',monthLabel(S.month));
 const months=S.history.map(p=>monthKey(p.day)),first=months[0],last=months.at(-1);
 $('gxCalPrev').disabled=S.month<=first;$('gxCalNext').disabled=S.month>=last;
 const entries=new Map(S.history.map(p=>[p.day,p])),[yy,mm]=S.month.split('-').map(Number);
 const weekday=(new Date(Date.UTC(yy,mm-1,1)).getUTCDay()+6)%7;
 for(let i=0;i<weekday;i++){const placeholder=document.createElement('span');placeholder.setAttribute('aria-hidden','true');host.append(placeholder);}
 const length=new Date(Date.UTC(yy,mm,0)).getUTCDate();
 for(let i=1;i<=length;i++){
  const key=S.month+'-'+String(i).padStart(2,'0'),present=entries.has(key);
  const b=document.createElement('button');b.type='button';b.textContent=String(i);
  b.className='gx-day'+(present?' has-data':'')+(S.selected===key?' is-selected':'')+(key===today()?' is-today':'');
  b.disabled=!present;b.setAttribute('aria-label',dayLabel(key)+(present?' มีข้อมูลราคา':' ไม่มีบันทึกราคา'));
  if(S.selected===key)b.setAttribute('aria-pressed','true');
  if(present)b.addEventListener('click',()=>{S.selected=key;S.page=0;renderCalendar();renderTable();});
  host.append(b);
 }
 set('gxCalCoverage',S.history.length+' วันมีข้อมูลที่ตรวจสอบได้');
 const item=S.selected?entries.get(S.selected):null;
 set('gxCalDetail',item?'วันที่ '+dayLabel(item.day)+' · ราคาขายออกล่าสุดที่บันทึก ฿'+fmt(item.c)+(isNum(item.h)?' · สูงสุด ฿'+fmt(item.h)+' · ต่ำสุด ฿'+fmt(item.l):' · ไม่มีค่า OHLC รายวัน'):'แตะวันที่สีทองเพื่อดูราคาที่บันทึกไว้ในวันนั้น');
}
function renderTable(){
 const tbody=$('gxHistoryRows');tbody.replaceChildren();
 const filtered=S.history.filter(p=>monthKey(p.day)===S.month&&(!S.selected||S.selected===p.day)).reverse();
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE));S.page=Math.min(S.page,pages-1);
 const records=filtered.slice(S.page*PAGE,(S.page+1)*PAGE);
 const cell=(tr,value,klass)=>{const td=document.createElement('td');td.textContent=value;if(klass)td.className=klass;tr.append(td);};
 if(!records.length){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='gx-table-empty';
  td.textContent=S.status==='loading'?'กำลังโหลดข้อมูลย้อนหลัง…':S.status==='error'?'ยังไม่สามารถโหลดประวัติราคาที่ตรวจสอบได้':'เดือนนี้ไม่มีวันราคาที่ตรวจสอบได้';tr.append(td);tbody.append(tr);
 }else for(const p of records){
  const tr=document.createElement('tr'),delta=isNum(p.o)?p.c-p.o:null;
  cell(tr,dayLabel(p.day));cell(tr,fmt(p.o));cell(tr,fmt(p.h));cell(tr,fmt(p.l));cell(tr,fmt(p.c));cell(tr,isNum(p.buy)?fmt(p.buy):'—');
  cell(tr,isNum(delta)?(delta>0?'+':delta<0?'−':'')+fmt(Math.abs(delta)):'—',isNum(delta)&&delta>0?'gx-num-up':isNum(delta)&&delta<0?'gx-num-down':'');tbody.append(tr);
 }
 set('gxHistoryCount',S.status==='ready'?filtered.length+' วันในเดือนนี้ · รวม '+S.history.length+' วัน':'สถานะ: '+(S.status==='error'?'โหลดข้อมูลไม่ได้':'กำลังตรวจสอบ'));
 set('gxTablePage',(S.page+1)+' / '+pages);
 $('gxPagePrev').disabled=S.page===0||!records.length;$('gxPageNext').disabled=S.page>=pages-1||!records.length;
 $('gxClearDay').disabled=!S.selected;
 set('gxTableAttribution',S.source||'ข้อมูลราคาจริงเท่านั้น ไม่มีข้อมูลประมาณการ');
}
function redrawHistory(){renderCalendar();renderTable();}
async function loadHistory(){
 S.status='loading';renderTable();
 try{
  const d=await getJSON('/api/market?mode=chart&market=thai&period=1Y');
  if(d.market!=='thai'||!Array.isArray(d.points)||!['reported-daily-ohlc','official-announcements'].includes(d.quality))
   throw new Error('ไม่มีชุดข้อมูลประวัติราคาที่ยืนยันได้');
  const found=new Map();
  if(d.quality==='reported-daily-ohlc'&&d.isDaily===true){
   for(const p of d.points){
    if(!p.t||Number.isNaN(Date.parse(p.t)))continue;
    const o=p.o,h=p.h,l=p.l,c=p.c;
    if(![o,h,l,c].every(v=>isNum(v)&&v>0)||h<Math.max(o,c,l)||l>Math.min(o,c))continue;
    const key=day(p.t);found.set(key,{day:key,o,h,l,c,buy:isNum(p.buy)?p.buy:null});
   }
  }else if(d.quality==='official-announcements'&&d.isDaily===false){
   const records=d.points.filter(p=>p.t&&!Number.isNaN(Date.parse(p.t))&&isNum(p.c)&&p.c>0)
     .sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
   // Official announcement snapshots contain closing observations, not verified daily OHLC.
   for(const p of records){
    const key=day(p.t);found.set(key,{day:key,o:null,h:null,l:null,c:p.c,buy:isNum(p.buy)?p.buy:null});
   }
  }
  S.history=[...found.values()].sort((a,b)=>a.day.localeCompare(b.day));
  if(!S.history.length)throw new Error('ยังไม่มีรายการประวัติที่ตรวจสอบได้');
  S.source=(d.source||'ประวัติราคาทองไทย')+
    (d.quality==='official-announcements'?' · ข้อมูลประกาศรายรอบ แสดงราคาล่าสุดที่พบในแต่ละวัน; ไม่มี OHLC รายวัน':
     ' · OHLC รายวันที่ตรวจสอบได้จากแหล่งข้อมูล');
  S.month=monthKey(S.history.at(-1).day);S.selected=null;S.page=0;S.status='ready';redrawHistory();
 }catch(error){
  S.history=[];S.month=null;S.selected=null;S.status='error';
  S.source='ยังไม่มีข้อมูลประวัติราคาที่ตรวจสอบได้: '+String(error.message||'ไม่ทราบสาเหตุ');
  redrawHistory();
 }
}
function init(){
 // Start with all EMA lines hidden; users can explicitly enable available lines.
 for(const id of ['gxShowEma20','gxShowEma50','gxShowEma200'])$(id).checked=false;
 $('gxShowEma20').addEventListener('change',drawEMA);$('gxShowEma50').addEventListener('change',drawEMA);$('gxShowEma200').addEventListener('change',drawEMA);
 $('gxCalPrev').addEventListener('click',()=>{S.month=moveMonth(S.month,-1);S.selected=null;S.page=0;redrawHistory();});
 $('gxCalNext').addEventListener('click',()=>{S.month=moveMonth(S.month,1);S.selected=null;S.page=0;redrawHistory();});
 $('gxClearDay').addEventListener('click',()=>{S.selected=null;S.page=0;redrawHistory();});
 $('gxPagePrev').addEventListener('click',()=>{S.page=Math.max(0,S.page-1);renderTable();});
 $('gxPageNext').addEventListener('click',()=>{S.page++;renderTable();});
 window.addEventListener('goldx:history-ready',onChart);
 window.addEventListener('goldx:history-error',clearChart);
 window.addEventListener('goldx:quotes-ready',event=>{S.quote=event.detail;renderToday();});
 window.addEventListener('goldx:quotes-error',()=>{S.quote=null;renderToday();});
 loadToday();
 const historySection=$('goldx-history-section');
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();loadHistory();}},{rootMargin:'300px'});
  observer.observe(historySection);
 }else loadHistory();
 setInterval(()=>{if(document.visibilityState==='visible')loadToday();},300000);
}
document.addEventListener('DOMContentLoaded',init);
})();
