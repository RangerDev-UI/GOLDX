/* Ivory Ledger 2: zero paid integrations, native client-side view of existing /api/market gateway. */
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>finite(n)&&n>0;
const fmt=(n,d=0)=>positive(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const timeTH=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' น.':'ไม่ระบุเวลา';
};
const dateTH=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(date):'ไม่ระบุวันที่';
};
const dayKey=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):null;
};
const write=(id,value)=>{const node=el(id);if(node)node.textContent=value};
const state={busy:false,lastChecked:0,last:null,previous:null,previousDay:null,previousBusy:false,previousChecked:0,previousError:null};
const THIRTY_MINUTES=1800000;
const priceTH=n=>positive(n)?'฿'+fmt(n,Number.isInteger(n)?0:2):'—';
function staleThai(q){
 return !q||!positive(q.sellBar)||q.stale===true||q.announcedToday===false||dayKey(q.updatedAt)!==dayKey(Date.now());
}
function staleWorld(q){
 if(!q||!positive(q.price)||q.stale===true)return true;
 const age=Date.now()-Date.parse(q.updatedAt);
 return !Number.isFinite(age)||age < -300000||age > 900000;
}
function fxQuote(d){
 const raw=d?.fx;
 if(positive(raw?.usdThb))return {value:raw.usdThb,source:raw.source||'แหล่งข้อมูลอัตราแลกเปลี่ยน',asOf:raw.asOf||null,daily:raw.rateType==='daily-reference'};
 if(positive(d?.thai?.fx))return {value:d.thai.fx,source:d.thai.source||'ผู้ให้บริการทองไทย',asOf:d.thai.updatedAt,daily:false};
 if(positive(d?.world?.fxUsdThb))return {value:d.world.fxUsdThb,source:d.world.source||'ผู้ให้บริการทองโลก',asOf:d.world.updatedAt,daily:false};
 return null;
}
function sourceLabel(q){
 const text=q?.source||'ไม่พบแหล่งข้อมูล';
 const stamp=q?.updatedAt?' · '+dateTH(q.updatedAt)+' '+timeTH(q.updatedAt):' · ไม่ระบุเวลาประกาศ';
 return text+stamp;
}
function setStatus(label,tone){
 const node=el('ilStatus');if(node)node.textContent=label;
 const holder=el('ilApi');if(holder)holder.dataset.state=tone;
}
function setDelta(id,current,prior){
 const node=el(id);if(!node)return;
 if(!positive(current)||!positive(prior)){
  node.textContent='เทียบวันก่อนหน้า —';node.dataset.tone='missing';return;
 }
 const diff=Math.round((current-prior)*100)/100;
 const amount=fmt(Math.abs(diff),Number.isInteger(diff)?0:2);
 node.textContent='วันก่อน '+priceTH(prior)+' · '+(diff===0?'ไม่เปลี่ยนแปลง':(diff>0?'↑ +':'↓ −')+amount+' บาท');
 node.dataset.tone=diff===0?'flat':diff>0?'up':'down';
}
function renderPrevious(){
 const t=state.last?.thai,prev=state.previous;
 const fields=[
  ['ilThaiBuyDelta',t?.buyBar,prev?.buyBar],
  ['ilThaiSellDelta',t?.sellBar,prev?.sellBar],
  ['ilOrnBuyDelta',t?.buyOrnament,prev?.buyOrnament],
  ['ilOrnSellDelta',t?.sellOrnament,prev?.sellOrnament]
 ];
 fields.forEach(([id,current,prior])=>setDelta(id,current,prior));
 if(prev){
  write('ilThaiChange','เปรียบเทียบกับราคาปิดวันที่ '+dateTH(prev.updatedAt)+' ('+prev.date+')');
  write('ilReferenceSource',prev.source+' · '+timeTH(prev.updatedAt)+' · ข้อมูลย้อนหลังที่ตรวจสอบได้');
 }else if(state.previousBusy){
  write('ilThaiChange','กำลังตรวจสอบราคาวันก่อนหน้า');
  write('ilReferenceSource','เปรียบเทียบกับประกาศของวันที่ก่อนหน้าราคาปัจจุบัน');
 }else{
  write('ilThaiChange','เทียบกับวันก่อนหน้า: ไม่มีข้อมูลอ้างอิง');
  write('ilReferenceSource',state.previousError||'ไม่มีบันทึกครบทั้ง 4 ราคาสำหรับวันก่อนหน้า');
 }
 if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function'){
  document.dispatchEvent(new CustomEvent('goldx:previous',{detail:{previous:prev,thai:t}}));
 }
}
async function loadPrevious(quote){
 const before=dayKey(quote?.updatedAt);
 if(!before||!positive(quote?.sellBar)){
  state.previous=null;state.previousDay=null;state.previousError='ไม่มีวันที่ประกาศทองไทยที่ตรวจสอบได้';
  renderPrevious();return;
 }
 if(state.previousDay!==before){
  state.previous=null;state.previousDay=before;state.previousChecked=0;
  state.previousError=null;renderPrevious();
 }
 if(state.previousBusy||state.previousChecked&&Date.now()-state.previousChecked<THIRTY_MINUTES)return;
 state.previousBusy=true;state.previousError=null;renderPrevious();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('/api/market?mode=previous-thai&before='+encodeURIComponent(before),
   {signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Historical HTTP '+response.status);
  const data=await response.json();
  if(!data||data.before!==before)throw new Error('Comparison period mismatch');
  const record=data.previous;
  if(record&&(!['buyBar','sellBar','buyOrnament','sellOrnament'].every(k=>positive(record[k]))||
    record.date>=before||dayKey(record.updatedAt)!==record.date))throw new Error('Unverified prior announcement');
  if(state.previousDay===before){
   state.previous=record||null;
   state.previousError=record?null:(data.message||'ไม่พบราคาของวันก่อนหน้าในแหล่งที่ตรวจสอบได้');
  }
 }catch(_err){
  if(state.previousDay===before){
   state.previous=null;
   state.previousError='ดึงข้อมูลเปรียบเทียบย้อนหลังไม่ได้ จึงไม่แสดงส่วนต่าง';
  }
 }finally{
  clearTimeout(timeout);
  state.previousBusy=false;
  state.previousChecked=Date.now();
  renderPrevious();
 }
}
function paint(d){
 const thai=d?.thai,world=d?.world,fx=fxQuote(d);
 write('ilThaiSell',priceTH(thai?.sellBar));
 write('ilThaiBuy',priceTH(thai?.buyBar));
 write('ilWorldSpot',positive(world?.price)?'$'+fmt(world.price,2):'—');
 write('ilWorldGram',positive(world?.perGram)?'$'+fmt(world.perGram,2):positive(world?.price)?'$'+fmt(world.price/31.1034768,2):'—');
 write('ilOrnSell',priceTH(thai?.sellOrnament));
 write('ilOrnBuy',priceTH(thai?.buyOrnament));
 write('ilThaiOrigin',sourceLabel(thai));
 write('ilWorldOrigin',sourceLabel(world));
 write('ilFX',fx?fmt(fx.value,3):'—');
 write('ilFXSource',fx?((fx.daily?'อ้างอิงรายวัน':'จากผู้ให้บริการ')+' · '+(fx.asOf?(String(fx.asOf).length===10?dateTH(fx.asOf+'T12:00:00+07:00'):dateTH(fx.asOf)+' '+timeTH(fx.asOf)):'ไม่ระบุเวลา')):'ยังไม่มีข้อมูลค่าเงิน');
 el('ilFX')?.setAttribute('title',fx?fx.source:'ยังไม่มีแหล่งข้อมูล');

 write('ilWorldChange','Spot Gold · ราคาอ้างอิง ไม่ใช่ราคาซื้อขายจริง');
 const thValid=positive(thai?.sellBar),worldValid=positive(world?.price);
 if(!thValid&&!worldValid){
  setStatus('ยังไม่พบข้อมูลราคา','bad');
  write('ilNotice','ยังไม่พบราคาทองคำจากแหล่งที่ตรวจสอบได้ กรุณาลองตรวจใหม่');
  el('ilNotice').hidden=false;
 }else{
  const warnings=[];
  if(thValid&&staleThai(thai))warnings.push('ทองไทยเป็นประกาศก่อนหน้า');
  if(worldValid&&staleWorld(world))warnings.push('ทองโลกอาจล่าช้า');
  if(!thValid)warnings.push('ราคาทองไทยไม่พร้อม');
  if(!worldValid)warnings.push('ราคาทองโลกไม่พร้อม');
  setStatus(warnings.length?'ข้อมูลบางส่วนอาจล่าช้า':'ข้อมูลพร้อมใช้งาน',warnings.length?'warning':'ok');
  const notice=el('ilNotice');
  if(notice){notice.hidden=!warnings.length;if(warnings.length)notice.textContent=warnings.join(' · ')+' · ตรวจสอบเวลาและแหล่งข้อมูลก่อนนำไปใช้';}
 }
 state.last=d;
 renderPrevious();
 if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function'){
  document.dispatchEvent(new CustomEvent('goldx:quotes',{detail:d}));
 }
}
async function refresh(manual=false){
 if(state.busy||(!manual&&document.visibilityState==='hidden'))return;
 state.busy=true;
 const button=el('ilRefresh');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 if(!state.last)setStatus('กำลังตรวจสอบข้อมูล','warning');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('/api/market?mode=quotes',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(!data||typeof data!=='object')throw new Error('Invalid quote data');
  paint(data);
  void loadPrevious(data.thai);
 }catch(error){
  setStatus(state.last?'เชื่อมต่อไม่ได้ · ข้อมูลเก่า':'เชื่อมต่อไม่ได้','bad');
  const warning=el('ilNotice');
  if(warning){warning.hidden=false;warning.textContent=state.last?'ไม่สามารถตรวจข้อมูลใหม่ได้ ตัวเลขที่แสดงเป็นข้อมูลที่ได้รับก่อนหน้า ไม่ใช่ราคาปัจจุบัน':'ไม่สามารถดึงราคาทองได้ในขณะนี้ โปรดตรวจการเชื่อมต่อและลองอีกครั้ง';}
 }finally{
  clearTimeout(timeout);
  state.busy=false;
  state.lastChecked=Date.now();
  write('ilLastChecked','ตรวจระบบล่าสุด '+dateTH(state.lastChecked)+' '+timeTH(state.lastChecked));
   write('ilDate','ตรวจระบบ '+timeTH(state.lastChecked));
  if(button){button.disabled=false;button.removeAttribute('aria-busy');}
 }
}
function bootstrap(){
 if(!el('ivory-ledger'))return;
 const dateNode=el('ilDate');
 if(dateNode)dateNode.textContent=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(new Date());
 el('ilRefresh')?.addEventListener('click',()=>refresh(true));
 refresh();
 setInterval(()=>{if(Date.now()-state.lastChecked>=60000)refresh()},60000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-state.lastChecked>=60000)refresh()});
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',bootstrap);
})();
