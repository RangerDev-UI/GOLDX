/* GOLDX nearby historical price references — actual completed daily OHLC only.
 * These are observed lows/highs, not predicted supports or guaranteed trade levels.
 */
(function(root) {
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function dayKey(value,market){
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return null;
    return new Intl.DateTimeFormat('sv-SE',{
      timeZone:market==='thai'?'Asia/Bangkok':'UTC',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(date);
  }
  function verifiedCandle(row){
    if(!row||row.observed===false||!row.t)return false;
    const {o,h,l,c}=row;
    return [o,h,l,c].every(x=>finite(x)&&x>0)&&h>=Math.max(o,l,c)&&l<=Math.min(o,h,c)&&Number.isFinite(Date.parse(row.t));
  }
  function findNearLevels(points,price,options={}){
    const market=options.market==='thai'?'thai':'world';
    const now=options.now===undefined?Date.now():new Date(options.now).getTime();
    if(!finite(now)||!finite(price)||price<=0||!Array.isArray(points))
      return {status:'invalid-input',supports:[],resistances:[],count:0};
    const today=dayKey(now,market);
    const lookbackMs=(options.lookbackDays||180)*86400000;
    const maxAgeMs=(options.maxAgeDays||14)*86400000;
    const sessions=points.filter(verifiedCandle).filter(p=>{
      const stamp=Date.parse(p.t);
      return stamp<=now&&stamp>=now-lookbackMs&&dayKey(p.t,market)<today;
    }).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
    const seen=new Map();
    for(const session of sessions)seen.set(dayKey(session.t,market),session);
    const rows=[...seen.values()].slice(-(options.maxCandles||120));
    const count=rows.length;
    if(count<(options.minCandles||5))
      return {status:'insufficient-history',supports:[],resistances:[],count};
    const last=rows.at(-1);
    if(now-Date.parse(last.t)>maxAgeMs)
      return {status:'stale-history',supports:[],resistances:[],count,last:last.t};
    const minSeparation=Math.max(market==='thai'?50:3,price*.002);
    function choose(kind){
      const field=kind==='support'?'l':'h';
      const candidates=rows.map(p=>({price:p[field],t:p.t}))
        .filter(p=>kind==='support'?p.price<price:p.price>price)
        .sort((a,b)=>kind==='support'?b.price-a.price||Date.parse(b.t)-Date.parse(a.t):
          a.price-b.price||Date.parse(b.t)-Date.parse(a.t));
      const selected=[];
      for(const p of candidates){
        if(selected.some(prev=>Math.abs(prev.price-p.price)<minSeparation))continue;
        selected.push({price:p.price,t:p.t,distance:Math.abs(price-p.price),percent:Math.abs(price-p.price)/price*100});
        if(selected.length===2)break;
      }
      return selected;
    }
    return {
      status:'ok',supports:choose('support'),resistances:choose('resistance'),
      count,first:rows[0].t,last:last.t,market,price,lookbackDays:options.lookbackDays||180
    };
  }
  const api=Object.freeze({findNearLevels,verifiedCandle,dayKey});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GOLDXLevels=api;
})(typeof window!=='undefined'?window:undefined);
