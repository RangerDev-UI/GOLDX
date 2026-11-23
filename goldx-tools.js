/* GOLDX Ivory tools — real API, no invented prices and no paid libraries. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const nf=(n,d=0)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const ok=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const thb=(n,d=0)=>ok(n)?'฿'+nf(n,d):'—';
const dollar=n=>ok(n)?'$'+nf(n,2):'—';
const dateTH=x=>{const d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(d):'ไม่ระบุวันที่'};
const stampTH=x=>{const d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' น.':'เวลาไม่ระบุ'};
const dayKey=x=>{const d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null};
const set=(id,x)=>{const e=$(id);if(e)e.textContent=x};
const validQty=n=>Number.isFinite(n)&&n>0&&n<=100000;
const validFee=n=>Number.isFinite(n)&&n>=0&&n<=100000000;
const typeText=t=>t==='orn'?'ทองรูปพรรณ 96.5%':'ทองคำแท่ง 96.5%';
function verifiedPair(data,type){
 const q=data?.thai;
 const buy=type==='orn'?q?.buyOrnament:q?.buyBar;
 const sell=type==='orn'?q?.sellOrnament:q?.sellBar;
 if(!ok(buy)||!ok(sell)||buy>sell||sell>300000)return null;
 return {buy,sell,source:q.source||'แหล่งทองไทย',updatedAt:q.updatedAt,stale:q.stale===true||q.announcedToday===false||dayKey(q.updatedAt)!==dayKey(Date.now())};
}
function quoteLabel(x){
 return x?x.source+' · ประกาศ '+stampTH(x.updatedAt)+(x.stale?' · เป็นราคาประกาศก่อนหน้า':''):'ไม่พบราคาทองจากแหล่งที่ตรวจสอบได้';
}
async function fetchJSON(url){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),14000);
 try{
  const r=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();if(!d||typeof d!=='object')throw Error('Invalid JSON');return d;
 }finally{clearTimeout(timeout);}
}
async function fetchQuotes(){return fetchJSON('/api/market?mode=quotes')}

/* Gold calculator: multiply source prices per baht-weight of 96.5% Thai gold.
   Thai bar 15.244g, ornament 15.16g per baht-weight. Never call 96.5% prices 99.99%. */
function calculator(){
 let type='bar',unit='baht',data=null,busy=false;
 function weights(){
  const qty=Number($('calc-qty')?.value),gramBaht=type==='bar'?15.244:15.16;
  if(!validQty(qty))return null;
  const bahtUnits=unit==='baht'?qty:unit==='salung'?qty/4:qty/gramBaht;
  return validQty(bahtUnits)?{bahtUnits,grams:bahtUnits*gramBaht}:null;
 }
 function paint(){
  const price=verifiedPair(data,type),w=weights(),fee=Number($('calc-fee')?.value);
  set('calc-quote-buy',price?thb(price.buy):'—');
  set('calc-quote-sell',price?thb(price.sell):'—');
  set('calc-source',quoteLabel(price));
  set('calc-summary-type',typeText(type));
  set('calc-unit-note','1 บาท'+(type==='bar'?'ทองคำแท่ง = 15.244':'ทองรูปพรรณ = 15.16')+' กรัม');
  set('calc-summary-weight',w?nf(w.bahtUnits,4)+' บาททองคำ ≈ '+nf(w.grams,3)+' กรัม':'กรุณาระบุน้ำหนักให้ถูกต้อง');
  set('calc-summary-fee',validFee(fee)?thb(fee):'กรุณาระบุค่ากำเหน็จตั้งแต่ 0 บาท');
  const ready=price&&w&&validFee(fee);
  set('calc-result-buy',ready?thb(price.buy*w.bahtUnits,2):'—');
  set('calc-result-sell',ready?thb(price.sell*w.bahtUnits+fee,2):'—');
  set('calc-summary-spread',ready?thb((price.sell-price.buy)*w.bahtUnits+fee,2):'—');
 }
 for(const btn of document.querySelectorAll('[data-type]'))btn.addEventListener('click',()=>{
  type=btn.dataset.type;for(const b of document.querySelectorAll('[data-type]'))b.setAttribute('aria-pressed',String(b===btn));paint();
 });
 for(const btn of document.querySelectorAll('[data-unit]'))btn.addEventListener('click',()=>{
  unit=btn.dataset.unit;for(const b of document.querySelectorAll('[data-unit]'))b.setAttribute('aria-pressed',String(b===btn));paint();
 });
 for(const btn of document.querySelectorAll('[data-quick]'))btn.addEventListener('click',()=>{
  const gram=btn.dataset.quick==='gram';
  unit=gram?'gram':'baht';
  $('calc-qty').value=gram?'1':btn.dataset.quick;
  for(const b of document.querySelectorAll('[data-unit]'))b.setAttribute('aria-pressed',String(b.dataset.unit===unit));
  paint();
 });
 for(const id of ['calc-qty','calc-fee'])$(id)?.addEventListener('input',paint);
 async function load(){
  if(busy)return;busy=true;set('calc-source','กำลังตรวจสอบราคาจาก API...');
  try{data=await fetchQuotes()}catch(_){data=null}
  finally{busy=false;paint()}
 }
 $('calc-refresh')?.addEventListener('click',load);paint();load();
}

/* Price history: use only observed points returned by the existing gateway. */
function history(){
 const marketNames=['thai','world'];let period='1M',seq=0;
 const dataByMarket={thai:[],world:[]},errors={thai:'',world:''};
 function normalise(data){
  if(!Array.isArray(data?.points))return [];
  const arr=data.points.filter(p=>p?.observed!==false).map(p=>({t:p.t,c:Number(p.c)}))
   .filter(p=>dayKey(p.t)&&Number.isFinite(p.c)&&p.c>0&&p.c<300000)
   .sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  return arr.filter((p,i)=>i===0||p.t!==arr[i-1].t);
 }
 function createSvg(points,world){
  const svgNS='http://www.w3.org/2000/svg',W=590,H=238,L=55,R=12,T=18,B=38;
  const yvals=points.map(p=>p.c),min=Math.min(...yvals),max=Math.max(...yvals);
  const span=(max-min)||Math.max(max*.001,1),bottom=min-span*.17,top=max+span*.17;
  const x=i=>L+(i/(points.length-1))*(W-L-R);
  const y=v=>T+(top-v)/(top-bottom)*(H-T-B);
  const svg=document.createElementNS(svgNS,'svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'กราฟราคาจริง '+(world?'ทองโลก':'ทองคำแท่ง')}))svg.setAttribute(k,v);
  function node(name,attrs,textValue){
   const e=document.createElementNS(svgNS,name);
   for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
   if(textValue!==undefined)e.textContent=textValue;
   svg.appendChild(e);return e;
  }
  for(let i=0;i<4;i++){
   const value=bottom+(top-bottom)*i/3,Y=y(value);
   node('line',{x1:L,x2:W-R,y1:Y,y2:Y,stroke:'#e5dfd5','stroke-dasharray':'3 5'});
   node('text',{x:L-9,y:Y+4,'text-anchor':'end','font-size':11,fill:'#958a79'},nf(value,world?2:0));
  }
  const line=points.map((p,i)=>x(i)+','+y(p.c)).join(' ');
  const fill='M '+x(0)+','+(H-B)+' L '+points.map((p,i)=>x(i)+','+y(p.c)).join(' L ')+' L '+x(points.length-1)+','+(H-B)+' Z';
  node('path',{d:fill,fill:world?'#dce9f0':'#f4e6c7',opacity:.85});
  node('polyline',{points:line,fill:'none',stroke:world?'#52758d':'#b98b3e','stroke-width':2.8,'stroke-linecap':'round','stroke-linejoin':'round'});
  const last=points.at(-1);node('circle',{cx:x(points.length-1),cy:y(last.c),r:4.5,fill:world?'#52758d':'#b98b3e'});
  for(let i=0;i<4;i++){
   const ix=Math.round((points.length-1)*i/3),p=points[ix];
   node('text',{x:x(ix),y:H-13,'font-size':10,'text-anchor':i===0?'start':i===3?'end':'middle',fill:'#92897d'},dateTH(p.t).replace(/ \d{4}$/,''));
  }
  svg.classList.add('chart-svg');
  return svg;
 }
 function renderMarket(market){
  const pts=dataByMarket[market],world=market==='world',el=$('history-'+market+'-chart');
  if(el)el.replaceChildren();
  const latest=pts.at(-1);
  set('history-'+market+'-latest',latest?(world?dollar(latest.c):thb(latest.c)):'—');
  if(!pts.length){
   if(el){const p=document.createElement('p');p.className='chart-info';p.textContent=errors[market]||'ไม่มีข้อมูลราคาย้อนหลังจากแหล่งที่ตรวจสอบได้';el.appendChild(p)}
   for(const k of ['high','low','avg'])set('history-'+market+'-'+k,'—');
   set('history-'+market+'-count','ไม่มีข้อมูลอ้างอิงในช่วงนี้');return;
  }
  const v=pts.map(p=>p.c),hi=Math.max(...v),lo=Math.min(...v),avg=v.reduce((a,b)=>a+b,0)/v.length;
  for(const [key,num] of [['high',hi],['low',lo],['avg',avg]])set('history-'+market+'-'+key,world?dollar(num):thb(num,2));
  set('history-'+market+'-count',pts.length+' จุดข้อมูล · '+dateTH(pts[0].t)+' – '+dateTH(latest.t));
  if(el){
   if(pts.length>=2)el.appendChild(createSvg(pts,world));
   else{const p=document.createElement('p');p.className='chart-info';p.textContent='ข้อมูลไม่เพียงพอสำหรับแสดงกราฟ';el.appendChild(p)}
  }
 }
 function renderTable(){
  const rows=$('history-rows');if(!rows)return;rows.replaceChildren();
  const days=new Map();
  for(const m of marketNames)for(const p of dataByMarket[m]){
   const day=dayKey(p.t),v=days.get(day)||{thai:null,world:null};
   v[m]=p;days.set(day,v);
  }
  const dates=[...days.keys()].sort().reverse().slice(0,10);
  if(!dates.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent='ยังไม่มีข้อมูลราคาย้อนหลังจาก API';tr.appendChild(td);rows.appendChild(tr);return}
  for(const day of dates){
   const row=days.get(day),tr=document.createElement('tr'),str=[dateTH(day+'T12:00:00+07:00'),row.thai?thb(row.thai.c):'—',row.world?dollar(row.world.c):'—'];
   str.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i)td.className='num';tr.appendChild(td)});rows.appendChild(tr);
  }
 }
 function redraw(){marketNames.forEach(renderMarket);renderTable()}
 async function load(){
  const run=++seq;
  for(const m of marketNames){set('history-'+m+'-source','กำลังโหลดข้อมูลต้นทาง...');errors[m]='';}
  const results=await Promise.all(marketNames.map(async m=>{
   try{
    const d=await fetchJSON('/api/market?mode=chart&market='+m+'&period='+period);
    return {m,data:d,points:normalise(d)};
   }catch(e){return {m,error:'ข้อมูลช่วงนี้ไม่พร้อมใช้งานจากแหล่งต้นทาง'};}
  }));
  if(run!==seq)return;
  for(const res of results){
   dataByMarket[res.m]=res.points||[];errors[res.m]=res.error||'';
   set('history-'+res.m+'-source',res.error||res.data?.source+' · '+(res.data?.quality||'ข้อมูลที่ได้รับจาก API'));
  }
  redraw();
 }
 for(const b of document.querySelectorAll('[data-period]'))b.addEventListener('click',()=>{
  period=b.dataset.period;
  for(const x of document.querySelectorAll('[data-period]'))x.setAttribute('aria-pressed',String(x===b));
  set('history-range-label',({'1W':'7 วัน','1M':'30 วัน','3M':'3 เดือน','1Y':'1 ปี'})[period]+' · ข้อมูลตามต้นทาง');
  load();
 });
 set('history-range-label','30 วัน · ข้อมูลตามต้นทาง');
 load();
}

/* Portfolio: private, same-origin localStorage only. Nothing is sent to a server. */
function portfolio(){
 const key='goldx.ivory.my-gold.v1';let entries=[],data=null,canStore=true;
 try{
  const raw=JSON.parse(localStorage.getItem(key)||'[]');
  if(Array.isArray(raw))entries=raw.filter(item=>item&&typeof item.id==='string'&&['bar','orn'].includes(item.type)&&
   validQty(item.qty)&&ok(item.paid)&&item.paid<=10000000000&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)).slice(0,500);
 }catch(e){canStore=false;entries=[]}
 const today=dayKey(Date.now());if($('port-date')){$('port-date').value=today;$('port-date').max=today}
 function store(){try{localStorage.setItem(key,JSON.stringify(entries));return true}catch(e){canStore=false;set('port-feedback','ไม่สามารถบันทึกลงเบราว์เซอร์ได้ โปรดตรวจโหมดส่วนตัวหรือพื้นที่จัดเก็บ');return false}}
 function paint(){
  const buyBar=verifiedPair(data,'bar'),buyOrn=verifiedPair(data,'orn');
  const weight=entries.reduce((s,e)=>s+e.qty,0),cost=entries.reduce((s,e)=>s+e.paid,0);
  const currentComplete=entries.every(e=>(e.type==='bar'?buyBar:buyOrn)!==null);
  const value=entries.length&&currentComplete?entries.reduce((s,e)=>s+(e.type==='bar'?buyBar.buy:buyOrn.buy)*e.qty,0):null;
  const profit=value===null?null:value-cost;
  set('port-weight',nf(weight,4)+' บาททองคำ');
  set('port-cost',thb(cost,2));set('port-count',entries.length+' รายการ');
  set('port-value',value===null?'—':thb(value,2));
  set('port-profit',profit===null?'—':(profit>=0?'+':'−')+'฿'+nf(Math.abs(profit),2));
  const profitEl=$('port-profit');if(profitEl)profitEl.className='kpi-num '+(profit===null?'':profit>=0?'pos':'neg');
  set('port-profit-percent',profit===null?'ข้อมูลราคารับซื้อไม่ครบ':(profit>=0?'+':'−')+nf(Math.abs(profit/cost*100),2)+'% ของต้นทุน');
  const barWeight=entries.filter(e=>e.type==='bar').reduce((s,e)=>s+e.qty,0),ornWeight=weight-barWeight,pct=weight?barWeight/weight*100:0;
  if($('port-bar-meter'))$('port-bar-meter').style.width=pct+'%';
  set('port-bar-percent',weight?nf(barWeight,4)+' บาท ('+nf(pct,1)+'%)':'—');
  set('port-orn-percent',weight?nf(ornWeight,4)+' บาท ('+nf(100-pct,1)+'%)':'—');
  set('port-source',[buyBar?quoteLabel(buyBar):'ทองแท่ง: ไม่พบราคา',buyOrn?quoteLabel(buyOrn):'รูปพรรณ: ไม่พบราคา'].join(' · '));
  const tbody=$('port-rows');if(!tbody)return;tbody.replaceChildren();
  if(!entries.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='empty';td.textContent='ยังไม่มีรายการทองคำ · เพิ่มรายการแรกทางขวามือ';tr.appendChild(td);tbody.appendChild(tr);return}
  for(const item of entries){
   const rate=item.type==='bar'?buyBar:buyOrn,worth=rate?rate.buy*item.qty:null,diff=worth===null?null:worth-item.paid;
   const tr=document.createElement('tr');
   const values=[typeText(item.type),dateTH(item.date+'T12:00:00+07:00'),nf(item.qty,4),thb(item.paid,2),worth===null?'—':thb(worth,2),diff===null?'—':(diff>=0?'+':'−')+'฿'+nf(Math.abs(diff),2)];
   values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i>=2)td.className='num';if(i===5&&diff!==null)td.classList.add(diff>=0?'pos':'neg');tr.appendChild(td)});
   const cell=document.createElement('td'),button=document.createElement('button');button.className='del';button.textContent='ลบ';button.type='button';button.setAttribute('aria-label','ลบรายการทองคำ');
   button.addEventListener('click',()=>{if(!confirm('ลบรายการทองคำนี้ออกจากพอร์ต?'))return;entries=entries.filter(e=>e.id!==item.id);store();paint()});
   cell.appendChild(button);tr.appendChild(cell);tbody.appendChild(tr);
  }
 }
 $('port-form')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!canStore){set('port-feedback','เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้อมูลถาวร');return}
  const type=$('port-type').value,qty=Number($('port-quantity').value),paid=Number($('port-paid').value),date=$('port-date').value;
  if(!['bar','orn'].includes(type)||!validQty(qty)||!ok(paid)||paid>10000000000||!(/^\d{4}-\d{2}-\d{2}$/.test(date))||date>today||entries.length>=500){
   set('port-feedback','ตรวจสอบประเภททอง น้ำหนัก ต้นทุน วันที่ซื้อ และจำนวนรายการ (สูงสุด 500 รายการ)');return;
  }
  const rec={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),type,qty,paid,date};
  entries.push(rec);
  if(!store()){entries.pop();return}
  set('port-feedback','บันทึกรายการในเบราว์เซอร์เรียบร้อย');
  $('port-paid').value='';paint();
 });
 paint();
 fetchQuotes().then(d=>{data=d;paint()}).catch(()=>{set('port-source','เชื่อมต่อ API ไม่สำเร็จ · ยังแสดงต้นทุนที่บันทึกไว้ แต่ไม่คำนวณราคาปัจจุบัน');paint()});
}

/* Compare actual Thai 96.5% bid/ask data, and user's own making fee. */
function compare(){
 let data=null;
 function paint(){
  const bar=verifiedPair(data,'bar'),orn=verifiedPair(data,'orn'),qty=Number($('cmp-qty').value),fee=Number($('cmp-fee').value);
  set('cmp-bar-buy',bar?thb(bar.buy):'—');set('cmp-bar-sell',bar?thb(bar.sell):'—');
  set('cmp-orn-buy',orn?thb(orn.buy):'—');set('cmp-orn-sell',orn?thb(orn.sell):'—');
  set('cmp-bar-spread',bar?thb(bar.sell-bar.buy):'—');
  set('cmp-orn-spread',orn?thb(orn.sell-orn.buy):'—');
  set('cmp-source',[quoteLabel(bar),quoteLabel(orn)].join(' · '));
  const ready=bar&&orn&&validQty(qty)&&validFee(fee);
  set('cmp-bar-cost',ready?thb(bar.sell*qty,2):'—');
  set('cmp-orn-cost',ready?thb(orn.sell*qty+fee,2):'—');
  set('cmp-bar-resale',ready?thb(bar.buy*qty,2):'—');
  set('cmp-orn-resale',ready?thb(orn.buy*qty,2):'—');
  if(ready){
   const diff=(orn.sell-bar.sell)*qty+fee;
   set('cmp-cost-diff',(diff>=0?'+':'−')+'฿'+nf(Math.abs(diff),2));
  }else set('cmp-cost-diff','—');
 }
 for(const id of ['cmp-qty','cmp-fee'])$(id)?.addEventListener('input',paint);
 paint();fetchQuotes().then(d=>{data=d;paint()}).catch(()=>{data=null;paint()});
}
const page=document.body?.dataset?.page;
if(page==='calculator')calculator();
else if(page==='history')history();
else if(page==='my-gold')portfolio();
else if(page==='compare')compare();
})();