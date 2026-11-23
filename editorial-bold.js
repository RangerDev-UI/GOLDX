/* Bold Editorial — data from GOLDX existing API only. No demo prices or fabricated news. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const fmt=(x,d=0)=>Number.isFinite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const baht=x=>num(x)?fmt(x,Number.isInteger(x)?0:2)+' บาท':'—';
const dateTH=x=>{const d=new Date(x);return Number.isFinite(+d)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' น.':'ไม่ระบุวันเวลา'};
const set=(id,text)=>{const node=$(id);if(node)node.textContent=text};
let quote=null,prior=null,period='1W',requestSeq=0,lastChartCheck=0;
const trend=(current,previous)=>{
 if(!num(current)||!num(previous))return {tone:'missing',label:'ยังไม่มีราคาวันก่อนหน้าที่ตรวจสอบได้'};
 const delta=current-previous,pct=delta/previous*100,tone=delta>0?'up':delta<0?'down':'flat';
 return {tone,label:delta===0?'ไม่เปลี่ยนแปลงจากวันก่อนหน้า':(delta>0?'▲ +':'▼ −')+fmt(Math.abs(delta),Number.isInteger(delta)?0:2)+' บาท ('+(delta>0?'+':'−')+fmt(Math.abs(pct),2)+'%)'};
};
function updateSummary(){
 const thai=quote?.thai;if(!thai)return;
 for(const [type,buy,sell] of [['Bar',thai.buyBar,thai.sellBar],['Orn',thai.buyOrnament,thai.sellOrnament]]){
  set('ed'+type+'Spread',num(sell)&&num(buy)&&sell>=buy?baht(sell-buy):'—');
  const result=trend(sell,prior?.[type==='Bar'?'sellBar':'sellOrnament']);
  const delta=$('ed'+type+'Daily');if(delta){delta.textContent=result.label;delta.dataset.tone=result.tone}
 }
 const direction=trend(thai.sellBar,prior?.sellBar),hero=$('edHeadlineMove'),arrow=document.querySelector('.ed-up-arrow');
 const label=direction.tone==='up'?'ปรับขึ้น':direction.tone==='down'?'ปรับลง':direction.tone==='flat'?'ทรงตัว':'ติดตามราคา';
 if(hero){hero.textContent=label;hero.dataset.tone=direction.tone}
 if(arrow)arrow.textContent=direction.tone==='up'?'↗':direction.tone==='down'?'↘':'→';
 if(direction.tone==='missing'){
  set('edStoryHeading','ราคาทองคำไทยอ้างอิงล่าสุด');
  set('edStoryBody','ขายออก '+baht(thai.sellBar)+' · ประกาศ '+dateTH(thai.updatedAt)+' · ยังไม่มีข้อมูลวันก่อนหน้า');
 }else{
  set('edStoryHeading',direction.tone==='up'?'ทองคำแท่งปรับขึ้นจากวันประกาศก่อน':direction.tone==='down'?'ทองคำแท่งปรับลงจากวันประกาศก่อน':'ทองคำแท่งทรงตัวจากวันประกาศก่อน');
  set('edStoryBody','ขายออก '+baht(thai.sellBar)+' · '+direction.label+' · เทียบ '+dateTH(prior.updatedAt));
 }
}
function svgChart(points){
 const NS='http://www.w3.org/2000/svg',W=790,H=270,L=65,R=12,T=18,B=36;
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);
 svg.setAttribute('role','img');svg.setAttribute('aria-label','กราฟราคาขายออกทองคำแท่งจากบันทึกที่ตรวจสอบได้');
 const add=(parent,name,attrs,label)=>{
  const e=document.createElementNS(NS,name);
  for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
  if(label!==undefined)e.textContent=label;
  parent.appendChild(e);return e;
 };
 const val=points.map(x=>x.c),lo=Math.min(...val),hi=Math.max(...val);
 const span=hi-lo||Math.max(hi*.001,1),min=lo-span*.16,max=hi+span*.16;
 const x=i=>L+i/(points.length-1)*(W-L-R),y=v=>T+(max-v)/(max-min)*(H-T-B);
 const defs=add(svg,'defs',{}),grad=add(defs,'linearGradient',{id:'edHistoryRed',x1:0,y1:0,x2:0,y2:1});
 add(grad,'stop',{offset:'0%','stop-color':'#df0612','stop-opacity':'.26'});
 add(grad,'stop',{offset:'100%','stop-color':'#df0612','stop-opacity':'.01'});
 for(let i=0;i<=4;i++){
  const value=min+(max-min)*i/4,Y=y(value);
  add(svg,'line',{x1:L,y1:Y,x2:W-R,y2:Y,stroke:'#e7dfd8'});
  add(svg,'text',{x:L-9,y:Y+4,fill:'#615a55','font-size':12,'text-anchor':'end'},fmt(value,0));
 }
 const pointsAsText=points.map((p,i)=>x(i)+','+y(p.c)).join(' ');
 const area='M '+x(0)+' '+(H-B)+' L '+points.map((p,i)=>x(i)+' '+y(p.c)).join(' L ')+' L '+x(points.length-1)+' '+(H-B)+' Z';
 add(svg,'path',{d:area,fill:'url(#edHistoryRed)'});
 add(svg,'polyline',{points:pointsAsText,fill:'none',stroke:'#d80815','stroke-width':3.7,'stroke-linejoin':'round','stroke-linecap':'round'});
 const last=points.at(-1);add(svg,'circle',{cx:x(points.length-1),cy:y(last.c),r:5.8,fill:'#d30915',stroke:'#fff','stroke-width':2});
 const step=Math.max(1,Math.floor((points.length-1)/5));
 for(let i=0;i<points.length;i+=step){
  const label=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}).format(new Date(points[i].t));
  add(svg,'text',{x:x(i),y:H-12,fill:'#75665e','font-size':11,'text-anchor':i===0?'start':'middle'},label);
 }
 return svg;
}
async function loadChart(){
 const display=$('edChartDisplay');if(!display)return;
 const run=++requestSeq;display.replaceChildren();
 const status=document.createElement('p');status.textContent='กำลังโหลดข้อมูลราคาทองจริง...';display.appendChild(status);
 set('edChartSource','กำลังตรวจข้อมูลจาก GOLDX');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch('/api/market?mode=chart&market=thai&period='+period,{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!res.ok)throw Error('History API unavailable');
  const data=await res.json();
  if(data?.market!=='thai'||!Array.isArray(data.points))throw Error('No verified history');
  const points=data.points.filter(p=>p&&p.observed!==false&&num(p.c)&&p.c<300000&&Number.isFinite(Date.parse(p.t)))
   .map(p=>({t:p.t,c:p.c})).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t))
   .filter((p,i,a)=>i===0||p.t!==a[i-1].t).slice(-400);
  if(points.length<2)throw Error('Not enough historical observations');
  if(run!==requestSeq)return;
  display.replaceChildren(svgChart(points));
  set('edChartLatest',baht(points.at(-1).c));
  set('edChartSource',(data.source||'แหล่งข้อมูลประวัติ GOLDX')+' · '+points.length+' จุดข้อมูล · ล่าสุด '+dateTH(points.at(-1).t));
  lastChartCheck=Date.now();
 }catch(_){
  if(run!==requestSeq)return;
  display.replaceChildren();const msg=document.createElement('p');
  msg.textContent='ข้อมูลราคาย้อนหลังช่วงนี้ไม่พร้อม · ไม่แสดงกราฟตัวเลขสมมติ';
  display.appendChild(msg);set('edChartLatest','—');
  set('edChartSource','กรุณาตรวจสอบใหม่เมื่อแหล่งข้อมูลพร้อม');
  lastChartCheck=Date.now();
 }finally{clearTimeout(timeout)}
}
for(const b of document.querySelectorAll('[data-ed-period]'))b.addEventListener('click',()=>{
 if(period===b.dataset.edPeriod)return;
 period=b.dataset.edPeriod;
 for(const button of document.querySelectorAll('[data-ed-period]')){
  button.classList.toggle('ed-selected',button===b);
  button.setAttribute('aria-pressed',String(button===b));
 }
 void loadChart();
});
document.addEventListener('goldx:quotes',event=>{quote=event.detail;updateSummary()});
document.addEventListener('goldx:previous',event=>{prior=event.detail?.previous||null;updateSummary()});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&Date.now()-lastChartCheck>300000)void loadChart();
});
void loadChart();
})();