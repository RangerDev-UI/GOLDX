/* GOLDX observed historical levels UI. Pivot values remain unchanged. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const fmt=(n,market)=>n.toLocaleString('en-US',{minimumFractionDigits:market==='thai'?0:2,maximumFractionDigits:market==='thai'?0:2});
  const formatDate=(date,market)=>new Intl.DateTimeFormat('th-TH',{timeZone:market==='thai'?'Asia/Bangkok':'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(date));
  const state={market:'world',quotes:null,refs:{world:null,thai:null}};
  const cols=[
    ['gxNearSupport1','gxNearSupport1Meta','supports',0,'ต่ำกว่า'],
    ['gxNearSupport2','gxNearSupport2Meta','supports',1,'ต่ำกว่า'],
    ['gxNearResistance1','gxNearResistance1Meta','resistances',0,'สูงกว่า'],
    ['gxNearResistance2','gxNearResistance2Meta','resistances',1,'สูงกว่า']
  ];
  function today(market){
    return window.GOLDXLevels.dayKey(Date.now(),market);
  }
  function quoteStatus(quote,market){
    if(!quote||quote.stale===true)return false;
    const value=market==='thai'?quote.sellBar:quote.price;
    if(!valid(value)||!quote.updatedAt||!Number.isFinite(Date.parse(quote.updatedAt)))return false;
    if(market==='thai')return quote.announcedToday!==false&&window.GOLDXLevels.dayKey(quote.updatedAt,'thai')===today('thai');
    const age=Date.now()-Date.parse(quote.updatedAt);
    return age>=-300000&&age<=600000;
  }
  function clear(label){
    for(const [priceId,metaId]of cols){
      byId(priceId).textContent='—';
      byId(metaId).textContent=label;
    }
  }
  function renderPivot(price,fresh){
    const s1=Number(byId('s1').textContent.replace(/[^0-9.-]/g,'')),s2=Number(byId('s2').textContent.replace(/[^0-9.-]/g,''));
    const a=fresh&&valid(s1)&&price<s1,b=fresh&&valid(s2)&&price<s2;
    byId('s1').closest('.level-row').classList.toggle('gx-pivot-crossed',a);
    byId('s2').closest('.level-row').classList.toggle('gx-pivot-crossed',b);
    byId('pivotS1Label').textContent=a?'S1 · หลุดแล้ว':'แนวรับ S1';
    byId('pivotS2Label').textContent=b?'S2 · หลุดแล้ว':'แนวรับ S2';
  }
  function render(){
    const market=state.market,quote=state.quotes?.[market],fresh=quoteStatus(quote,market),price=market==='thai'?quote?.sellBar:quote?.price;
    const badge=byId('gxNearBadge');
    renderPivot(price,fresh);
    if(!fresh){
      badge.textContent='รอราคาล่าสุด';badge.className='gx-near-badge gx-near-warning';
      clear('รอข้อมูลราคาใหม่');
      byId('gxNearContext').textContent='จำเป็นต้องมีราคาประกาศล่าสุดก่อนเทียบกับประวัติ';
      byId('gxNearFoot').textContent='ไม่ใช้ราคาประกาศเก่ามาระบุแนวรับปัจจุบัน';
      return;
    }
    const reference=state.refs[market],levels=window.GOLDXLevels.findNearLevels(reference?.points,price,{
      market,lookbackDays:180,maxCandles:120,maxAgeDays:14,minCandles:5
    });
    if(levels.status!=='ok'){
      badge.textContent='ข้อมูลย้อนหลังไม่พอ';badge.className='gx-near-badge gx-near-warning';
      clear('ไม่มีจุดราคาอ้างอิง');
      byId('gxNearContext').textContent=levels.status==='stale-history'?'ข้อมูลรายวันเก่ากว่า 14 วัน จึงยังไม่ใช้เป็นระดับอ้างอิง':'ไม่มีข้อมูลแท่งรายวันที่ผ่านการตรวจสอบเพียงพอ';
      byId('gxNearFoot').textContent='Classic Pivot ด้านล่างแสดงแยกต่างหาก · ไม่มีระดับราคาจำลอง';
      return;
    }
    badge.textContent='อิงราคาจริง';badge.className='gx-near-badge';
    const unit=market==='thai'?'บาท':'USD',prefix=market==='thai'?'฿':'$';
    byId('gxNearContext').textContent='เทียบราคาล่าสุด '+prefix+fmt(price,market)+' กับข้อมูล '+levels.count+' วัน ('+formatDate(levels.first,market)+' – '+formatDate(levels.last,market)+')';
    for(const [priceId,metaId,key,index,direction]of cols){
      const level=levels[key][index];
      if(!level){
        byId(priceId).textContent='—';
        byId(metaId).textContent=key==='supports'?'ไม่พบจุดต่ำกว่านี้ในช่วงข้อมูล':'ไม่พบจุดสูงกว่านี้ในช่วงข้อมูล';
      }else{
        byId(priceId).textContent=prefix+fmt(level.price,market);
        byId(metaId).textContent=direction+' '+fmt(level.distance,market)+' '+unit+' · '+formatDate(level.t,market);
      }
    }
    byId('gxNearFoot').textContent=(levels.supports.length===0?'ไม่พบระดับต่ำกว่าราคาจากข้อมูลที่มี · ':'ระดับอ้างอิงไม่ใช่แนวรับที่รับประกัน · ')+(reference?.source||'ข้อมูล OHLC ที่บันทึกจริง');
  }
  function refresh(){queueMicrotask(render);}
  document.addEventListener('DOMContentLoaded',()=>{
    window.addEventListener('goldx:quotes-ready',e=>{state.quotes=e.detail;refresh();});
    window.addEventListener('goldx:quotes-error',()=>{state.quotes=null;refresh();});
    window.addEventListener('goldx:reference-data',e=>{
      const d=e.detail||{};
      if(!['thai','world'].includes(d.market))return;
      state.refs[d.market]=Array.isArray(d.points)?{points:d.points,source:d.source||''}:null;
      refresh();
    });
    window.addEventListener('goldx:market-changed',e=>{
      state.market=e.detail?.market==='thai'?'thai':'world';refresh();
    });
    render();
  });
})();
