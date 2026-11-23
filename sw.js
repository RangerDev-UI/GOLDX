/* GOLDX PWA: cache only the static application shell, never live market/API data. */
const CACHE='goldx4-static-v5';
const STATIC=['/','/index.html','/favicon.svg','/goldx-pro.css','/goldx4.css','/goldx4.js','/ivory-ledger.css','/ivory-ledger.js','/goldx-pro.js','/goldx-indicators.js','/goldx-levels.js','/goldx-near-ui.js','/calculator.html','/history.html','/my-gold.html','/compare.html','/goldx-tools.css','/goldx-tools.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.allSettled(STATIC.map(path=>cache.add(path)));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('goldx4-static-')&&name!==CACHE).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname==='/'?'/index.html':url.pathname,response.clone());}
    return response;
   }catch{
    return await caches.match(url.pathname==='/'?'/index.html':url.pathname)||new Response('GOLDX ออฟไลน์: ไม่สามารถเปิดหน้านี้ได้',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
   }
  })());
  return;
 }
 if(STATIC.includes(url.pathname)){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname,response.clone());}
    return response;
   }catch{return await caches.match(url.pathname)||Response.error();}
  })());
 }
});
