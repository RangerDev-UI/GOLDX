const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../goldx-indicators.js');

test('EMA seeds at SMA and follows the recursive exponential average', () => {
 assert.deepEqual(a.ema([1,2,3,4,5],3),[null,null,2,3,4]);
 assert.equal(a.ema([10,11,12],4).at(-1),null);
});
test('EMA resets for missing price gaps instead of inventing values', () => {
 assert.deepEqual(a.ema([1,2,null,4,5,6],3),[null,null,null,null,null,5]);
});
test('RSI Wilder: rising, falling and flat prices', () => {
 const rising=Array.from({length:22},(_,i)=>100+i);
 const falling=Array.from({length:22},(_,i)=>100-i);
 assert.equal(a.rsi(rising,14)[14],100);
 assert.equal(a.rsi(falling,14)[14],0);
 assert.equal(a.rsi(Array(22).fill(100),14)[14],50);
 assert.equal(a.rsi([1,2,3],14).at(-1),null);
});
test('MACD 12/26/9 warms up only when enough actual prices exist', () => {
 const prices=Array.from({length:45},(_,i)=>120+i*0.5);
 const m=a.macd(prices);
 assert.equal(m.line[24],null);
 assert.notEqual(m.line[25],null);
 assert.equal(m.signal[32],null);
 assert.notEqual(m.signal[33],null);
 assert.equal(m.histogram[32],null);
 assert.ok(Number.isFinite(m.histogram[33]));
});
test('A short history does not create EMA200, MACD signal or imaginary points', () => {
 const rows=Array.from({length:25},(_,i)=>({t:'2026-01-01',c:100+i}));
 const z=a.fromPoints(rows);
 assert.ok(z.ema200.every(v=>v===null));
 assert.ok(z.macd.histogram.every(v=>v===null));
 assert.equal(z.rsi14.length,rows.length);
});
test('Invalid periods raise errors',()=>{
 assert.throws(()=>a.ema([1,2],0),RangeError);
 assert.throws(()=>a.rsi([1,2,3],1),RangeError);
 assert.throws(()=>a.macd([1,2,3],26,12),RangeError);
});
