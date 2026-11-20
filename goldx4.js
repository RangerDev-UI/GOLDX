/* GOLDX Aurum: no paid APIs, no third-party chart libraries. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),ok=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const fmt=(n,d=0)=>ok(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const bkkDay=x=>{let d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null};
const bkkTime=x=>{let d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' น.':'ไม่ระบุเวลา'};
const state={market:'world',quotes:null},storageKey='goldx4-default-market';
const set=(id,value,tone)=>{const e=$(id);if(!e)return;e.textContent=value;if(tone)e.dataset.tone=tone;else delete e.dataset.tone};
const thaiFresh=q=>!!(ok(q?.sellBar)&&q.stale!==true&&q.announcedToday!==false&&bkkDay(q.updatedAt)===bkkDay(Date.now()));
const worldFresh=q=>{const age=Date.now()-Date.parse(q?.updatedAt);return !!(ok(q?.price)&&q.stale!==true&&Number.isFinite(age)&&age>=-300000&&age<=900000)};
function getFX(d){
 const f=d?.fx;
 if(ok(f?.usdThb))return {rate:f.usdThb,label:f.rateType==='daily-reference'?'อัตราอ้างอิงรายวัน':'จากผู้ให้บริการ',source:f.source||'ไม่ระบุแหล่ง',asOf:f.asOf};
 const r=d?.thai?.fx??d?.world?.fxUsdThb;
 return ok(r)?{rate:r,label:'จากผู้ให้บริการ',source:'ราคาทอง',asOf:null}:null;
}
function health(){
 const d=state.quotes,t=d?.thai,w=d?.world,fx=getFX(d),hasT=ok(t?.sellBar),hasW=ok(w?.price),ft=thaiFresh(t),fw=worldFresh(w);
 set('gx4HealthThai',!hasT?'ไม่มีข้อมูล':ft?'ประกาศวันนี้ · '+bkkTime(t.updatedAt):'ประกาศก่อนหน้า / อาจล่าช้า',!hasT?'bad':ft?'ok':'warning');
 set('gx4HealthWorld',!hasW?'ไม่มีข้อมูล':fw?'เช็กได้ · '+bkkTime(w.updatedAt):'ราคาอาจล่าช้า',!hasW?'bad':fw?'ok':'warning');
 set('gx4HealthFX',!fx?'ไม่มีข้อมูล':fx.label+(fx.asOf?' · '+String(fx.asOf).slice(0,10):''),!fx?'bad':fx.label==='อัตราอ้างอิงรายวัน'?'warning':'ok');
 const count=Number(hasT)+Number(hasW)+Number(!!fx);
 const tone=count===0?'bad':count===3&&ft&&fw?'ok':'warning';
 set('gx4HealthBadge',count===0?'ยังไม่มีข้อมูล':count===3?'ข้อมูลครบ 3 กลุ่ม':'ข้อมูล '+count+'/3 กลุ่ม',tone);
 const sources=[t?.source?'ไทย: '+t.source:null,w?.source?'โลก: '+w.source:null,fx?.source?'FX: '+fx.source:null].filter(Boolean).join(' • ');
 set('gx4HealthSource',(sources||'รอแหล่งข้อมูล')+' · ตรวจเช็ก '+(d?.fetchedAt?bkkTime(d.fetchedAt):'—')+' · ไม่ใช่ Streaming');
}
const priceAt=id=>{const x=Number(($(id)?.textContent||'').replace(/,/g,'').replace(/[^0-9.-]/g,''));return ok(x)?x:null};
function brief(){
 const thai=state.market==='thai',q=state.quotes?.[state.market],price=thai?q?.sellBar:q?.price;
 set('gx4BriefMarket',thai?'ทองไทย':'XAU/USD');
 if(!ok(price)||!(thai?thaiFresh(q):worldFresh(q))){
  set('gx4BriefTitle','ราคาล่าสุดยังไม่พร้อม');
  set('gx4BriefBody','เมื่อราคาล่าช้าจะไม่อ้างระดับเทคนิคว่าเป็นสัญญาณปัจจุบัน ตรวจสถานะและเวลาต้นทางใน Data Health');
  set('gx4BriefOrigin','ใช้กฎวิเคราะห์เท่านั้น ไม่ใช้บริการ AI แบบเสียเงิน');return;
 }
 const rsi=priceAt('rsiValue'),s1=priceAt('s1'),s2=priceAt('s2'),r1=priceAt('r1'),r2=priceAt('r2');
 let title='ราคาอยู่ในกรอบ Pivot วันก่อน',details=[];
 if(s2&&price<s2){title='ราคาต่ำกว่า Pivot S2';details.push('ต่ำกว่า S2 '+fmt(s2-price,thai?0:2)+(thai?' บาท':' USD'))}
 else if(s1&&price<s1){title='ราคาต่ำกว่า Pivot S1';details.push('ต่ำกว่า S1 '+fmt(s1-price,thai?0:2))}
 else if(r2&&price>r2){title='ราคาสูงกว่า Pivot R2'}
 else if(r1&&price>r1){title='ราคาสูงกว่า Pivot R1'}
 if(rsi){details.push('RSI '+fmt(rsi,1)+(rsi<30?' อยู่โซนขายมาก':rsi>70?' อยู่โซนซื้อมาก':rsi<45?' เอนเอียงลง':rsi>55?' เอนเอียงขึ้น':' อยู่โซนกลาง'))}
 const ema=$('emaValue')?.textContent||'';
 if(ema.includes('EMA20 ≥ EMA50'))details.push('EMA20 ≥ EMA50');
 else if(ema.includes('EMA20 < EMA50'))details.push('EMA20 < EMA50');
 if(!details.length){title='ข้อมูลเทคนิคยังไม่เพียงพอ';details.push('ใช้ข้อมูลจริงเท่านั้น ไม่มีสัญญาณจำลอง')}
 set('gx4BriefTitle',title);set('gx4BriefBody',details.join(' · ')+' · ไม่รับประกันการเคลื่อนไหวในอนาคต');
 set('gx4BriefOrigin',($('levelBasis')?.textContent||'OHLC วันก่อน')+' · สรุปตามกฎ ไม่ใช่คำแนะนำซื้อขาย');
}
function render(){health();brief()}
function saved(){try{return localStorage.getItem(storageKey)==='thai'?'thai':'world'}catch{return 'world'}}
function save(v){try{localStorage.setItem(storageKey,v)}catch{/* storage disabled */}}
function crosshair(){
 const host=$('chartContainer'),svg=$('priceChart');
 if(!host||!svg)return;
 const line=document.createElement('div');line.className='gx4-crosshair';line.setAttribute('aria-hidden','true');host.append(line);
 svg.addEventListener('pointermove',e=>{const rect=host.getBoundingClientRect();if(rect.width<=0||e.pointerType==='touch')return;line.style.left=Math.max(0,Math.min(rect.width,e.clientX-rect.left))+'px';line.style.display='block'});
 svg.addEventListener('pointerleave',()=>line.style.display='none');
}
document.addEventListener('DOMContentLoaded',()=>{
 if(document.body?.classList?.contains('ivory-enabled'))return; // Preserve old widgets for rollback without initializing them.
 const control=$('gx4DefaultMarket'),initial=saved();
 control.value=initial;
 control.addEventListener('change',()=>{if(!['thai','world'].includes(control.value))return;save(control.value);window.dispatchEvent(new CustomEvent('goldx4:set-market',{detail:{market:control.value}}))});
 window.addEventListener('goldx:market-changed',e=>{state.market=e.detail?.market==='thai'?'thai':'world';queueMicrotask(brief)});
 window.addEventListener('goldx:quotes-ready',e=>{state.quotes=e.detail;queueMicrotask(render)});
 window.addEventListener('goldx:quotes-error',()=>{state.quotes=null;render()});
 window.addEventListener('goldx:history-ready',()=>queueMicrotask(brief));
 window.addEventListener('goldx:reference-data',()=>queueMicrotask(brief));
 crosshair();render();
 if(initial==='thai')queueMicrotask(()=>window.dispatchEvent(new CustomEvent('goldx4:set-market',{detail:{market:'thai'}})));
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
});
})();
