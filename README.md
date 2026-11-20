# GOLDX — Gold Market Intelligence

เว็บไซต์เช็กราคาทองคำไทย 96.5% และทองคำโลก XAU/USD สไตล์ Luxury Black & Gold พร้อมกราฟ วิเคราะห์เทคนิค และเครื่องคำนวณทองคำ

## โครงสร้างโปรเจกต์
- `index.html` — หน้าเว็บหลักแบบไฟล์เดียว รวม CSS/JavaScript สำหรับการแสดงผล (ไม่ต้องรัน build)
- `favicon.svg` — ไอคอน GOLDX
- `netlify.toml` — กำหนด Netlify Functions และ route `/api/market`
- `netlify/functions/market.js` — ตัวกลางสำหรับดึงข้อมูลราคาจากผู้ให้บริการ (API ฝั่งเซิร์ฟเวอร์)

## Deploy บน Netlify
1. Netlify > Add new project > Import an existing project > GitHub
2. เลือก `RangerDev-UI/GOLDX`
3. Build command: เว้นว่าง
4. Publish directory: `.`
5. Deploy แล้วตรวจ `https://<YOUR-SITE>/.netlify/functions/market?mode=quotes` ว่าดึงข้อมูลจากต้นทางได้หรือไม่

## ข้อมูลราคา
- ทองคำไทย: แหล่งสาธารณะ ThaiGoldToday; รองรับ API ทางการของสมาคมค้าทองคำเมื่อมี `GTA_API_TOKEN`
- ทองคำโลก: XAUS; สำรอง Gold API
- กราฟย้อนหลังทองโลก: XAUS chart/history (ขึ้นกับ API ต้นทาง)
- กราฟย้อนหลังทองไทย: ต้องมีโทเคนที่ได้รับอนุญาตจากสมาคมค้าทองคำ
- ไม่แสดงราคาสมมติ เมื่อไม่มีข้อมูล หรือ API ไม่ตอบกลับ

การรีเฟรชหน้าเว็บทุก 60 วินาทีคือความถี่ในการตรวจสอบข้อมูล ไม่ใช่การรับประกันว่า API ต้นทางจะออกประกาศราคาใหม่ทุกนาที

> ข้อมูลและแนวรับ–แนวต้านเป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
