const test=require('node:test');
const assert=require('node:assert/strict');
const Thai=require('../netlify/functions/thai-feed.js');
function html(date, buy='56,550.00', sell='56,750.00'){
return `<!doctype html><html lang="th"><body><h1>ราคาทองตามประกาศสมาคมค้าทองคำ</h1><div>ประจำวันที่ ${date} เวลา 12:31 (ครั้งที่ 40)</div>
<section><h2>ทองคำแท่ง96.5%</h2><div>รับซื้อ${buy}</div><div>ขายออก${sell}</div></section>
<section><h2>ทองรูปพรรณ96.5%</h2><div>รับซื้อ55,424.96</div><div>ขายออก57,550.00</div></section></body></html>`;
}
function thaiDate(epoch){const f=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'});return f.format(epoch).replace(/(\d{4})$/,y=>String(Number(y)+543));}
test('public GTA webpage parses buy/sell and Bangkok announcement date',()=>{
 const q=Thai.officialWebQuote(html(thaiDate(new Date())));
 assert.equal(q.buyBar,56550);assert.equal(q.sellBar,56750);assert.equal(q.buyOrnament,55424.96);assert.equal(q.sellOrnament,57550);
 assert.equal(q.round,40);assert.equal(q.announcedToday,true);assert.equal(q.stale,false);
 assert.equal(q.sourceType,'official-public-page');
});
test('older official page retains stale true and never becomes live',()=>{
 const q=Thai.officialWebQuote(html('19/11/2569'));
 assert.equal(q.stale,true);assert.equal(q.announcedToday,false);
 assert.equal(q.updatedAt,'2026-11-19T05:31:00.000Z');
});
test('never manufacture prices from an unrecognized official page',()=>{
 assert.throws(()=>Thai.officialWebQuote('<html>hello</html>'));
 assert.throws(()=>Thai.officialWebQuote(html(thaiDate(new Date()),'100,000.00','50,000.00')));
 assert.throws(()=>Thai.officialWebQuote(html(thaiDate(new Date())).replace('ประจำวันที่','วันที่')));
});
test('official webpage can supersede yesterday public relay',async()=>{
 const oldFetch=global.fetch;
 const qold={data:{source:'gta',bar_buy:'59,750',bar_sell:'59,950',as_time:'2026-11-19T16:16:00',seq:'33'}};
 try {
  global.fetch=async(url)=>{
   if(String(url).includes('goldtraders.or.th/'))return {ok:true,status:200,text:async()=>html(thaiDate(new Date()))};
   throw Error('unavailable');
  };
  const q=await Thai.quote(async()=>qold);
  assert.equal(q.sellBar,56750);assert.equal(q.sourceType,'official-public-page');
 }finally{global.fetch=oldFetch;}
});