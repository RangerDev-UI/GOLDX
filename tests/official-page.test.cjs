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

function listing(rows){
 const table=rows.map(row=>'<tr>'+row.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('');
 return '<!DOCTYPE html><html><body><h3>การปรับเปลี่ยนระหว่างวัน</h3><table><thead><tr><th>วันที่</th><th>เวลา</th><th>ครั้งที่</th></tr></thead><tbody>'+table+'</tbody></table></body></html>';
}
test('official daily change table parses dated rows and chooses newest timestamp',()=>{
 const doc=listing([
  ['20/11/2569','11:28','30','56,750.00','56,950.00','55,622.04','57,750.00','3,538.00','33.97','-50'],
  ['20/11/2569','12:31','40','56,550.00','56,750.00','55,424.96','57,550.00','3,524.00','33.98','-100'],
  ['19/11/2569','16:16','33','59,750.00','59,950.00','58,547.92','60,750.00','3,733.00','33.89','-50']
 ]);
 const q=Thai.officialTableQuote(doc);
 assert.equal(q.sellBar,56750);assert.equal(q.buyBar,56550);
 assert.equal(q.round,40);assert.equal(q.stale,false);
 assert.equal(q.updatedAt,'2026-11-20T05:31:00.000Z');
 assert.equal(q.sourceType,'official-public-page');
});
test('public table source takes precedence over stale relay and adds source diagnostics',async()=>{
 const old=global.fetch;
 const doc=listing([['20/11/2569','12:31','40','56,550.00','56,750.00','55,424.96','57,550.00','3,524.00','33.98','-100']]);
 try{
  global.fetch=async(url)=>String(url).includes('UpdatePriceList.aspx')?{ok:true,text:async()=>doc}:Promise.reject(new Error('blocked'));
  const q=await Thai.quote(async (url)=>{
   if(String(url).includes('rakhagold'))return {data:{source:'gta',bar_buy:59750,bar_sell:59950,as_time:'2026-11-19T16:16:00'}};
   throw new Error('provider unavailable');
  });
  assert.equal(q.sellBar,56750);assert.equal(q.stale,false);
  assert.equal(q.feedChecks.some(x=>x.name==='GTA classic table'&&x.ok),true);
  assert.equal(q.feedChecks.some(x=>x.name==='Rakhagold'&&x.ok&&x.stale),true);
 }finally{global.fetch=old;}
});
test('malformed table, prices reversed, and unrelated dates are rejected',()=>{
 assert.throws(()=>Thai.officialTableQuote(listing([
  ['20/11/2569','12:31','40','58,750','56,750','55,424.96','57,550.00','3,524','33.98','-100']
 ])));
 assert.throws(()=>Thai.officialTableQuote('<html><body><table><tr><td>sports</td></tr></table></body></html>'));
});
test('GTA public SSE page handles ornament tax-base label and retains exact source URL', async()=>{
 const oldFetch=global.fetch;
 const d=html(thaiDate(new Date()), '56,950.00', '57,150.00')
   .replace('รับซื้อ55,424.96','ฐานภาษี55,803.96').replace('ขายออก57,550.00','ขายออก57,950.00');
 try {
  global.fetch=async(url)=>String(url).startsWith('https://sse.goldtraders.or.th/')
    ? {ok:true,status:200,text:async()=>d}:Promise.reject(new Error('HTTP 403'));
  const q=await Thai.quote(async (url)=>{
   if(String(url).includes('rakhagold'))return {data:{source:'gta',bar_buy:59750,bar_sell:59950,as_time:'2026-11-19T16:16:00'}};
   throw new Error('Provider HTTP 402');
  });
  assert.equal(q.sellBar,57150);assert.equal(q.buyBar,56950);assert.equal(q.sellOrnament,57950);
  assert.equal(q.buyOrnament,55803.96);
  assert.equal(q.sourceUrl,'https://sse.goldtraders.or.th/');
  assert.equal(q.stale,false);
  assert.equal(q.feedChecks.some(x=>x.name==='GTA public SSE page'&&x.ok),true);
 } finally {global.fetch=oldFetch;}
});
