# GOLDX — Gold Market Intelligence (Cloudflare Workers)

เว็บติดตาม **ทองคำแท่งไทย 96.5%** และทองคำโลก XAU/USD ในรูปแบบ Dark Gold Dashboard ใช้เฉพาะข้อมูลที่ได้รับจากแหล่งข้อมูลภายนอกจริง ไม่สร้างราคาหรือประวัติสมมติ

## Cloudflare deployment
- Website: https://goldx.rangerth.workers.dev/
- GitHub branch: `main` (Cloudflare Workers Builds เชื่อมกับ GitHub เพื่อ Deploy อัตโนมัติ)
- `wrangler.jsonc`: ชื่อ Worker `goldx`, โค้ดหลัก `worker.js`, assets แบบ allowlist โดย `.assetsignore`
- `worker.js` รองรับ `/api/market` และคงรูปแบบตอบกลับของ `netlify/functions/market.js` เพื่อรักษาความเข้ากันได้
- `GTA_API_TOKEN` เป็นตัวเลือกสำหรับผู้ได้รับอนุญาตเท่านั้น; ห้ามบันทึก token ลงในโค้ด/รีโป
- `netlify.toml` เป็นไฟล์ของระบบเดิม เก็บไว้เพื่ออ้างอิง ไม่ใช่ค่าตั้งค่าที่ใช้ Deploy บน Cloudflare

## GOLDX 3.0
1. **ราคาและ Daily Gold Pulse:** ราคาขายออกล่าสุดและรอบประกาศ; ถ้าข้อมูลประกาศรายรอบของ *วันเดียวกันตามเขตเวลาไทย* มีอย่างน้อย 2 จุด จะคำนวณการเปลี่ยนจากประกาศแรก สูงสุดและต่ำสุดที่แหล่งข้อมูลส่งมา ไม่อ้างว่าเป็น high/low ครบทั้งตลาด
2. **กราฟราคาไทยและโลก:** กราฟเส้น/แท่งเทียน (เมื่อ OHLC ครบ) ช่วงเวลา 1D, 1W, 1M, 3M, 1Y พร้อมการส่งออก CSV
3. **อินดิเคเตอร์:** เส้น EMA 20/50/200 บนกราฟราคา, RSI(14) และ MACD(12,26,9) แบบกราฟย่อย; แสดง — เมื่อข้อมูลไม่ครบจำนวนแท่งที่คำนวณได้
4. **ปฏิทินและตารางทองไทย:** ดึง `/api/market?mode=chart&market=thai&period=1Y` เมื่อเลื่อนมาถึงส่วนนี้ แสดงวันในเดือนและ OHLC ของรายการ `quality=reported-daily-ohlc` เท่านั้น เลือกวันและเปลี่ยนหน้าในตารางได้
5. **ฟีเจอร์เดิม:** กราฟแนวรับ–แนวต้าน Pivot, RSI/EMA/ATR พื้นฐาน, เครื่องคำนวณทอง และแจ้งเตือนเมื่อ *เปิดหน้านี้อยู่* ยังทำงานเหมือนเดิม

## โครงสร้าง
- `index.html`: layout และโค้ดฟีเจอร์เดิม (ไม่มีขั้นตอน build frontend)
- `goldx-pro.css`: สไตล์ใหม่ responsive สำหรับ Daily Pulse, indicator, calendar และ history table
- `goldx-pro.js`: การแสดงผลฟีเจอร์ใหม่และการเชื่อม API เดิม
- `goldx-indicators.js`: ฟังก์ชันคำนวณ EMA, RSI แบบ Wilder, MACD บนราคาจริง
- `worker.js`: Cloudflare Worker, ใช้ logic เดิมใน `netlify/functions/`
- `tests/market.test.cjs`, `tests/indicators.test.cjs`: ชุดทดสอบ API และสูตรอินดิเคเตอร์

## ทดสอบ
```bash
node --test tests/*.test.cjs
npx wrangler deploy
```

ทดสอบ endpoint:
- `/api/market?mode=quotes`
- `/api/market?mode=chart&market=thai&period=1D`
- `/api/market?mode=chart&market=thai&period=1Y`
- `/api/market?mode=chart&market=world&period=3M`

**คำเตือน:** ทองคำไทยอาจมีประกาศก่อนหน้า, แหล่งข้อมูลสาธารณะอาจล่าช้า/ไม่ตอบกลับ และทองคำโลกเป็นข้อมูล Spot อ้างอิง ไม่ใช่ราคาซื้อขายที่รับประกันได้ อินดิเคเตอร์เป็นการวิเคราะห์ทางสถิติ ไม่ใช่คำแนะนำลงทุน
