/** GOLDX — server-side market data gateway for Netlify Functions.
 * No simulated prices are ever returned. Missing data stays null.
 */
'use strict';
const thaiFeed = require('./thai-feed.js');
const TTL = { quotes: 65, chart: 280, thaiHistory: 300 };
const PERIODS = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' }
};
function response(data, code = 200, seconds = 55) {
  return { statusCode: code, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`,
    'X-Content-Type-Options': 'nosniff'
  }, body: JSON.stringify(data) };
}
const num = v => { const n = Number(typeof v === 'string' ? v.replace(/,/g, '') : v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };
function isPositive(v) { return typeof v === 'number' && Number.isFinite(v) && v > 0; }
function validTime(v) { const time = Date.parse(v); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
async function json(url, opts = {}) {
  const controller = new AbortController();
  const tm = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal,
      headers: { 'Accept':'application/json', 'User-Agent':'GOLDX/1.0 (market dashboard)', ...(opts.headers || {}) }
    });
    if (!r.ok) throw new Error(`Provider HTTP ${r.status}`);
    const d = await r.json();
    if (!d || typeof d !== 'object' || d.error) throw new Error('Provider error response');
    return d;
  } finally { clearTimeout(tm); }
}
async function thaiQuote() {
  const token = process.env.GTA_API_TOKEN;
  if (token) {
    try {
      const d = await json('https://announce.goldtraders.or.th/api/v1/price/latest', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const barBuy = num(d.gold_bar?.buy), barSell = num(d.gold_bar?.sell);
      if (!isPositive(barBuy) || !isPositive(barSell)) throw new Error('Official feed missing prices');
      return {
        buyBar:barBuy, sellBar:barSell,
        buyOrnament:num(d.ornament?.buy), sellOrnament:num(d.ornament?.sell),
        change:num(d.change), changePercent:null, round:num(d.announceNo),
        updatedAt:validTime(d.announcedAt),
        source:'สมาคมค้าทองคำ · API ทางการ', sourceUrl:'https://www.goldtraders.or.th/',
        sourceType:'official', freshness:'announcement',
        spot: num(d.spot?.usd), fx:num(d.fx?.usd_thb),
        marketOpen:typeof d.market?.open === 'boolean' ? d.market.open : null
      };
    } catch(e) { console.warn('GTA feed unavailable, trying public relay:', e.message); }
  }
  // Public price relay with attribution as requested in its usage terms.
  const d = await json('https://www.thaigoldtoday.com/api/gold-price');
  const c = d.current || {};
  const barBuy = num(c.buyBar), barSell = num(c.sellBar);
  if (!isPositive(barBuy) || !isPositive(barSell)) throw new Error('Thai public feed missing prices');
  return {
    buyBar: barBuy, sellBar:barSell, buyOrnament:num(c.buyOrnament), sellOrnament:num(c.sellOrnament),
    change:num(c.change), changePercent:num(c.changePercent), round:num(c.updateRound),
    updatedAt:validTime(c.updatedAt),
    source:'ราคาทอง.today · อ้างอิงสมาคมค้าทองคำ', sourceUrl:'https://www.thaigoldtoday.com',
    sourceType:'public-relay', freshness:'announcement',
    spot: num(d.world?.spotOz), fx:num(d.world?.thbRate), marketOpen:null
  };
}
async function worldQuote() {
  let lastError;
  try {
    const d = await json('https://xaus.com/api/v1/spot?compact=1');
    const price = num(d.spot_usd_oz);
    if (!isPositive(price)) throw new Error('XAUS invalid spot');
    const asOf = validTime(d.price_as_of || d.data_state?.as_of || d.updated_at);
    const stale = d.stale === true || d.data_state?.status === 'stale' ||
      (asOf ? Date.now() - Date.parse(asOf) > 180000 : true);
    return { price, updatedAt:asOf, stale, source:'XAUS · XAU/USD', sourceUrl:'https://xaus.com/api/',
      sourceType:'indicative', perGram:num(d.per_gram_usd), silver:num(d.silver_usd_oz),
      ratio:num(d.gold_silver_ratio), fxUsdThb:num(d.fx_rates?.THB) };
  } catch(e) { lastError=e; }
  try {
    const d = await json('https://api.gold-api.com/price/XAU');
    const price = num(d.price);
    if (!isPositive(price)) throw new Error('Gold-API invalid price');
    const asOf = validTime(d.updatedAt || d.updated_at);
    return { price, updatedAt:asOf, stale:!asOf || Date.now()-Date.parse(asOf)>180000,
      source:'Gold API · XAU/USD', sourceUrl:'https://gold-api.com/docs',
      sourceType:'indicative', perGram:price/31.1034768, silver:null, ratio:null, fxUsdThb:null };
  } catch(e) { throw new Error(`World providers unavailable: ${lastError?.message}; ${e.message}`); }
}
async function quotes() {
  const [thaiResult, worldResult] = await Promise.allSettled([thaiFeed.quote(json),worldQuote()]);
  const thai = thaiResult.status === 'fulfilled' ? thaiResult.value : null;
  const world = worldResult.status === 'fulfilled' ? worldResult.value : null;
  return response({ fetchedAt:new Date().toISOString(), thai, world,
    errors:{ thai:thai ? null : 'ไม่สามารถดึงราคาทองไทยจากแหล่งข้อมูลได้',
      world:world ? null : 'ไม่สามารถดึงราคาทองโลกจากแหล่งข้อมูลได้' }
  }, thai || world ? 200 : 503, TTL.quotes);
}
function pointDate(t) {
  if (typeof t === 'number' && Number.isFinite(t)) return new Date(t<1e12?t*1000:t).toISOString();
  if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t)) return validTime(t.length===10 ? `${t}T00:00:00Z` : t);
  return null;
}
function tidyPoints(a) {
  if (!Array.isArray(a)) return [];
  const pts = a.map(p => ({
    t:pointDate(p.t ?? p.d ?? p.datetime),
    o:num(p.o ?? p.open), h:num(p.h ?? p.high),
    l:num(p.l ?? p.low), c:num(p.c ?? p.close ?? p.p), v:num(p.v ?? p.volume)
  })).filter(p => p.t && isPositive(p.c)).sort((a,b) => Date.parse(a.t)-Date.parse(b.t));
  return pts.filter((p,i) => i===0 || p.t!==pts[i-1].t);
}
async function worldChart(period) {
  const {range,interval} = PERIODS[period];
  const url = `https://xaus.com/api/v1/chart?symbol=xau&range=${range}&interval=${interval}`;
  let points=[],source='XAUS chart (XAU/USD)', isDaily = ['1M','3M','1Y'].includes(period);
  try {
    const d=await json(url);
    points=tidyPoints(d.points || d.data?.points || d.candles);
    if (points.length<2) throw new Error('Insufficient chart points');
  } catch(e) {
    if (period==='1D' || period==='1W') {
      const d=await json('https://xaus.com/api/v1/intraday?symbol=xau&hours=48');
      points=tidyPoints(d.points);
      source='XAUS intraday (recorded quotes)'; isDaily=false;
    } else {
      const d=await json('https://xaus.com/api/v1/history');
      points=tidyPoints(d.points);
      const n=period==='1M'?32:period==='3M'?95:370;
      points=points.slice(-n);source='XAUS daily history';isDaily=true;
    }
  }
  if(points.length<2) throw new Error('No verified historical points');
  return response({ market:'world',period, source, isDaily, points, fetchedAt:new Date().toISOString() },200,TTL.chart);
}
async function thaiHistory(days) {
  if(!process.env.GTA_API_TOKEN) return response({
    error:'THAI_HISTORY_REQUIRES_TOKEN',message:'ประวัติราคาทองไทยต้องใช้ GTA_API_TOKEN ที่ได้รับอนุญาตจากสมาคมค้าทองคำ'
  },424,30);
  const d=await json(`https://announce.goldtraders.or.th/api/v1/price/history?days=${days}`, {
    headers:{Authorization:`Bearer ${process.env.GTA_API_TOKEN}`}
  });
  const points=(Array.isArray(d.items)?d.items:[]).map(p=>({
    t:validTime(p.announcedAt),c:num(p.gold_bar?.sell),buy:num(p.gold_bar?.buy),
    ornamentSell:num(p.ornament?.sell), change:num(p.change)
  })).filter(p=>p.t&&isPositive(p.c)).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  if (points.length < 2) return response({market:'thai',points,source:'สมาคมค้าทองคำ · ประวัติราคาประกาศ',message:'ประวัติที่มีอยู่ยังไม่เพียงพอ'},200,TTL.thaiHistory);
  return response({market:'thai',points,source:'สมาคมค้าทองคำ · ประวัติราคาประกาศ',fetchedAt:new Date().toISOString()},200,TTL.thaiHistory);
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return response({error:'Method not allowed'},405,0);
  const q = event.queryStringParameters || {};
  try {
    if(q.mode==='quotes' || !q.mode) return await quotes();
    if(q.mode==='chart') {
      if(q.market==='thai') return await thaiFeed.history(PERIODS[q.period] ? q.period : '1M',json,response);
      const period=PERIODS[q.period] ? q.period : '1M';
      return await worldChart(period);
    }
    return response({error:'Unknown mode'},400,0);
  } catch(e) {
    console.error('Market gateway:',e.message);
    return response({error:'UPSTREAM_UNAVAILABLE',message:'แหล่งข้อมูลภายนอกไม่พร้อมใช้งาน ลองใหม่ภายหลัง'},502,15);
  }
};