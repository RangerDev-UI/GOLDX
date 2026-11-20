/* GOLDX indicators — pure calculations on observed prices, no synthetic market data. */
(function(root){
  'use strict';
  function valid(x){return typeof x==='number'&&Number.isFinite(x);}
  function ema(values,period){
    if(!Number.isInteger(period)||period<1)throw new RangeError('Invalid EMA period');
    const result=Array(values.length).fill(null),alpha=2/(period+1);
    let seed=[],previous=null;
    for(let i=0;i<values.length;i++){
      const v=values[i];
      if(!valid(v)){seed=[];previous=null;continue;}
      if(previous===null){
        seed.push(v);
        if(seed.length===period){
          previous=seed.reduce((a,b)=>a+b,0)/period;
          result[i]=previous;
        }
      }else{
        previous=alpha*v+(1-alpha)*previous;
        result[i]=previous;
      }
    }
    return result;
  }
  function rsi(values,period=14){
    if(!Number.isInteger(period)||period<2)throw new RangeError('Invalid RSI period');
    const result=Array(values.length).fill(null);
    let gains=0,losses=0,count=0,avgGain=0,avgLoss=0;
    for(let i=1;i<values.length;i++){
      const previous=values[i-1],current=values[i];
      if(!valid(current)||!valid(previous)){
        gains=0;losses=0;count=0;avgGain=0;avgLoss=0;continue;
      }
      const diff=current-previous,up=Math.max(0,diff),down=Math.max(0,-diff);
      if(count<period){
        gains+=up;losses+=down;count++;
        if(count===period){avgGain=gains/period;avgLoss=losses/period;}
      }else{
        avgGain=(avgGain*(period-1)+up)/period;
        avgLoss=(avgLoss*(period-1)+down)/period;
      }
      if(count>=period){
        result[i]=avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);
      }
    }
    return result;
  }
  function macd(values,fast=12,slow=26,signalPeriod=9){
    if(!(fast>0&&slow>fast&&signalPeriod>0))throw new RangeError('Invalid MACD periods');
    const fastEma=ema(values,fast),slowEma=ema(values,slow);
    const line=values.map((_,i)=>valid(fastEma[i])&&valid(slowEma[i])?fastEma[i]-slowEma[i]:null);
    const signal=Array(values.length).fill(null);
    let seed=[],prev=null,alpha=2/(signalPeriod+1);
    for(let i=0;i<line.length;i++){
      if(!valid(line[i])){seed=[];prev=null;continue;}
      if(prev===null){
        seed.push(line[i]);
        if(seed.length===signalPeriod){
          prev=seed.reduce((a,b)=>a+b,0)/signalPeriod;
          signal[i]=prev;
        }
      }else{
        prev=alpha*line[i]+(1-alpha)*prev;
        signal[i]=prev;
      }
    }
    const histogram=line.map((v,i)=>valid(v)&&valid(signal[i])?v-signal[i]:null);
    return {line,signal,histogram};
  }
  function fromPoints(points){
    const closes=points.map(p=>p&&valid(p.c)?p.c:null);
    const result={ema20:ema(closes,20),ema50:ema(closes,50),ema200:ema(closes,200),rsi14:rsi(closes,14),macd:macd(closes)};
    return result;
  }
  const api=Object.freeze({ema,rsi,macd,fromPoints,valid});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GOLDXIndicators=api;
})(typeof window!=='undefined'?window:undefined);
