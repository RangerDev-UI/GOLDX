const test=require('node:test');
const assert=require('node:assert/strict');
const {findNearLevels,verifiedCandle,dayKey}=require('../goldx-levels.js');
const now='2026-11-20T09:30:00Z';
const point=(date,o,h,l,c)=>({t:date+'T05:00:00.000Z',o,h,l,c,observed:true});
const rows=[
 point('2026-11-14',57500,59200,56000,57400),
 point('2026-11-16',57400,58900,55700,57000),
 point('2026-11-17',57000,58500,55900,57500),
 point('2026-11-18',57500,58100,56700,57550),
 point('2026-11-19',57550,58000,57200,57500),
 point('2026-11-20',57500,60100,54000,56000)
];
const select=(points,price,options={})=>findNearLevels(points,price,{market:'thai',now,...options});
test('uses observed lower lows and upper highs closest to price',()=>{
 const result=select(rows,57500);
 assert.equal(result.status,'ok');
 assert.deepEqual(result.supports.map(v=>v.price),[57200,56700]);
 assert.deepEqual(result.resistances.map(v=>v.price),[58000,58500]);
 assert.equal(result.count,5);
});
test('excludes the current-day bar even if it has a more dramatic low',()=>{
 const result=select(rows,57500);
 assert.ok(!result.supports.some(v=>v.price===54000));
 assert.ok(!result.resistances.some(v=>v.price===60100));
});
test('never invents a support below all verified observed lows',()=>{
 const result=select(rows,54000);
 assert.equal(result.status,'ok');assert.deepEqual(result.supports,[]);
 assert.ok(result.resistances.length>0);
});
test('never invents a resistance above all verified observed highs',()=>{
 const result=select(rows,70000);
 assert.equal(result.status,'ok');assert.deepEqual(result.resistances,[]);
 assert.ok(result.supports.length>0);
});
test('does not use invalid unverified or non-OHLC observations',()=>{
 const errors=[
  point('2026-11-15',55000,50000,54000,58000),
  {...point('2026-11-15',55000,58000,54000,56000),observed:false},
  {t:'2026-11-15T05:00:00Z',o:0,h:60000,l:44000,c:55000}
 ];
 const result=select([...rows,...errors],57500);
 assert.equal(result.count,5);
 assert.equal(verifiedCandle(errors[0]),false);
 assert.equal(verifiedCandle(errors[1]),false);
});
test('does not reuse duplicate recorded days as separate observations',()=>{
 const result=select([...rows,point('2026-11-19',57500,60200,50000,59000)],57500);
 assert.equal(result.count,5);
});
test('does not promote stale history into current reference levels',()=>{
 const result=select(rows,57500,{now:'2026-12-10T09:30:00Z',maxAgeDays:14});
 assert.equal(result.status,'stale-history');
 assert.equal(result.supports.length,0);
});
test('needs a minimum of actual completed candles',()=>{
 const result=select(rows.slice(0,3),57500);
 assert.equal(result.status,'insufficient-history');
});
test('Thai date boundaries respect Asia/Bangkok rather than UTC',()=>{
 assert.equal(dayKey('2026-11-19T18:00:00Z','thai'),'2026-11-20');
 assert.equal(dayKey('2026-11-19T18:00:00Z','world'),'2026-11-19');
});
test('rejects malformed prices',()=>{
 assert.equal(select(rows,-1).status,'invalid-input');
 assert.equal(select(null,57500).status,'invalid-input');
});
