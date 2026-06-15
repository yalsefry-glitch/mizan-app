var CACHE="mizan-v25";
self.addEventListener("install",function(e){self.skipWaiting();});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  // network-first دائماً: يجلب أحدث نسخة من الشبكة، الكاش احتياطي فقط عند انقطاع النت
  e.respondWith(
    fetch(e.request).then(function(res){
      return res;
    }).catch(function(){return caches.match(e.request);})
  );
});
