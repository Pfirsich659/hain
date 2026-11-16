// Hain Service Worker – offline-fähig, Daten bleiben in IndexedDB (werden hier nie gelöscht)
const CACHE = 'hain-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './push-config.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hain-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (url.origin !== location.origin && !isFont) return;
  // App-Dateien: erst Netz (für Updates), dann Cache. Schriften: erst Cache.
  if (isFont) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
// ---------- Push: Text wird aus deinen lokalen Daten zusammengestellt ----------
function readState() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('hain', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
function dur(ms) { const m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d >= 1 ? `${d} ${d === 1 ? 'Tag' : 'Tagen'} und ${h} Std` : `${h} Std ${m % 60} Min`; }
const TIPS = [
  'Ein Verlangen nach einer Zigarette dauert meist nur wenige Minuten. Atme es weg.',
  'Helles Licht am Morgen stellt deine innere Uhr – abends wirst du leichter müde.',
  'Schon 11 Minuten zügige Bewegung am Tag machen einen messbaren Unterschied.',
  'Ein Glas Wasser jetzt hilft Konzentration und Stimmung.',
  'Ein kurzer Spaziergang nach dem Essen mildert den Blutzuckeranstieg.',
  'Langsames Ausatmen schaltet deinen Körper auf Ruhe.',
];
function compose(type, S) {
  const now = new Date(); const today = S && S.days ? (S.days[dk(now)] || {}) : {};
  let smoke = '';
  if (S && S.smoke && S.smoke.quitAt) {
    const quit = new Date(S.smoke.quitAt); const slips = (S.smoke.slips || []).map(x => new Date(x.at)).filter(d => d >= quit).sort((a, b) => a - b);
    const start = slips.length ? slips[slips.length - 1] : quit; const days = Math.max(0, (now - quit) / 864e5 - new Set(slips.map(dk)).size);
    smoke = { run: dur(now - start), saved: fmt(days * (S.smoke.pricePerWeek || 0) / 7, 2), cigs: fmt(days * (S.smoke.perDay || 0)) };
  }
  const st = S && S.settings ? S.settings : { bed: '21:00', wake: '04:30', goals: { walk: 30 } };
  const name = st.name ? `, ${st.name}` : '';
  switch (type) {
    case 'morning': return ['Guten Morgen' + name, `${smoke ? `Seit ${smoke.run} rauchfrei. ` : ''}Glas Wasser, 5 Minuten dehnen – und dann wartet die gute Nachricht des Tages.`];
    case 'tip': return ['Wusstest du?', TIPS[now.getDate() % TIPS.length]];
    case 'walk': { const w = today.walk || 0, g = (st.goals && st.goals.walk) || 30; return ['Zeit für frische Luft', w >= g ? `Schon ${w} Minuten unterwegs – jede Minute mehr zählt extra.` : `Ein Spaziergang tut jetzt gut. Bisher heute: ${w} von ${g} Minuten.`]; }
    case 'progress': return ['Dein Fortschritt', smoke ? `${smoke.saved} € gespart und ${smoke.cigs} Zigaretten nicht geraucht. Dein Farn wächst.` : 'Dein Garten wächst mit jeder gesunden Entscheidung.'];
    case 'winddown': return ['Zeit zum Runterfahren', 'Bildschirm dimmen, Licht runter, kurz den Tag eintragen. Dein Schlafbeet freut sich.'];
    case 'bed': return ['Gleich Licht aus', `Licht aus um ${st.bed} – morgen um ${st.wake} startest du ausgeschlafen.`];
    default: return ['Hain', 'Schau kurz in deinen Garten.'];
  }
}
self.addEventListener('push', e => {
  let data = {}; try { data = e.data ? e.data.json() : {}; } catch (_) { data = { title: 'Hain', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const S = await readState();
    const n = S && S.settings && S.settings.notify;
    const off = n && ((data.type === 'morning' && n.morning === false) || (['tip', 'walk', 'progress'].includes(data.type) && n.day === false) || (['winddown', 'bed'].includes(data.type) && n.evening === false));
    const [title, body] = data.type ? compose(data.type, S) : [data.title || 'Hain', data.body || ''];
    // Abgeschaltete Kategorien kommen leise und ohne Ton
    await self.registration.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: data.type || 'hain', silent: !!off });
  })());
});
