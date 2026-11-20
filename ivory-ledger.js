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
const state={busy:false,lastChecked:0,last:null};
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
function paint(d){
 const thai=d?.thai,world=d?.world,fx=fxQuote(d);
 write('ilThaiSell',positive(thai?.sellBar)?'฿'+fmt(thai.sellBar):'—');
 write('ilThaiBuy',positive(thai?.buyBar)?fmt(thai.buyBar):'—');
 write('ilWorldSpot',positive(world?.price)?'$'+fmt(world.price,2):'—');
 write('ilWorldGram',positive(world?.perGram)?'$'+fmt(world.perGram,2):positive(world?.price)?'$'+fmt(world.price/31.1034768,2):'—');
 write('ilOrnSell',positive(thai?.sellOrnament)?fmt(thai.sellOrnament):'—');
 write('ilOrnBuy',positive(thai?.buyOrnament)?fmt(thai.buyOrnament):'—');
 write('ilThaiOrigin',sourceLabel(thai));
 write('ilWorldOrigin',sourceLabel(world));
 write('ilFX',fx?fmt(fx.value,3):'—');
 write('ilFXSource',fx?((fx.daily?'อ้างอิงรายวัน':'จากผู้ให้บริการ')+' · '+(fx.asOf?(String(fx.asOf).length===10?dateTH(fx.asOf+'T12:00:00+07:00'):dateTH(fx.asOf)+' '+timeTH(fx.asOf)):'ไม่ระบุเวลา')):'ยังไม่มีข้อมูลค่าเงิน');
 el('ilFX')?.setAttribute('title',fx?fx.source:'ยังไม่มีแหล่งข้อมูล');
 const changed=thai?.change;
 write('ilThaiChange',finite(changed)?(changed===0?'ไม่เปลี่ยนแปลงจากรอบก่อน':(changed>0?'+':'−')+fmt(Math.abs(changed))+' บาท · เปลี่ยนแปลงตามต้นทาง'):'ไม่มีข้อมูลการเปลี่ยนแปลง');
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
 }catch(error){
  setStatus(state.last?'เชื่อมต่อไม่ได้ · ข้อมูลเก่า':'เชื่อมต่อไม่ได้','bad');
  const warning=el('ilNotice');
  if(warning){warning.hidden=false;warning.textContent=state.last?'ไม่สามารถตรวจข้อมูลใหม่ได้ ตัวเลขที่แสดงเป็นข้อมูลที่ได้รับก่อนหน้า ไม่ใช่ราคาปัจจุบัน':'ไม่สามารถดึงราคาทองได้ในขณะนี้ โปรดตรวจการเชื่อมต่อและลองอีกครั้ง';}
 }finally{
  clearTimeout(timeout);
  state.busy=false;
  state.lastChecked=Date.now();
  write('ilLastChecked','ตรวจล่าสุด '+timeTH(state.lastChecked));
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
