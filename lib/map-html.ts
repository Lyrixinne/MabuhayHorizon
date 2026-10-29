import type { Hotel } from "./types";

// A small Leaflet map (free OpenStreetMap tiles, no key). Tapping a pin tells the app which hotel.
export function buildMapHtml(hotels: Hotel[]): string {
  const pins = JSON.stringify(
    hotels.map((h) => ({ id: h.id, name: h.name, lat: h.latitude, lng: h.longitude })),
  ).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}.leaflet-container{font-family:sans-serif}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var pins = ${pins};
function send(id){
  var msg = JSON.stringify({type:'hotel', id:id});
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
  else if (window.parent) { window.parent.postMessage(msg, '*'); }
}
if (typeof L === 'undefined') {
  // The map library could not load (no internet): still let people pick a hotel.
  var box = document.getElementById('map');
  box.style.cssText = 'padding:16px;font-family:sans-serif;overflow:auto';
  var note = document.createElement('p');
  note.textContent = 'The map could not load. Check your internet connection. You can still choose a hotel:';
  box.appendChild(note);
  pins.forEach(function(p){
    var b = document.createElement('button');
    b.textContent = p.name;
    b.style.cssText = 'display:block;width:100%;margin:6px 0;padding:12px;font-size:16px;border:1px solid #cbd5e1;border-radius:10px;background:#fff';
    b.onclick = function(){ send(p.id); };
    box.appendChild(b);
  });
} else {
var map = L.map('map', {zoomControl:true}).setView([12.5, 122.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 18, attribution: '&copy; OpenStreetMap'}).addTo(map);
var bounds = [];
pins.forEach(function(p){
  var m = L.marker([p.lat, p.lng]).addTo(map);
  m.bindTooltip(p.name);
  m.on('click', function(){ send(p.id); });
  bounds.push([p.lat, p.lng]);
});
if (bounds.length) { map.fitBounds(bounds, {padding:[30,30]}); }
}
</script></body></html>`;
}
