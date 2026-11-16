// Sendet fällige Push-Benachrichtigungen laut schedule.json.
// Läuft alle 15 Minuten als GitHub Action. Bereits gesendete Termine
// werden in .state/sent.json gemerkt (per Actions-Cache), damit nichts doppelt kommt.
import fs from 'node:fs';
import webpush from 'web-push';

const { vapidPublicKey } = JSON.parse(fs.readFileSync('push-config.json', 'utf8'));
const schedule = JSON.parse(fs.readFileSync('schedule.json', 'utf8'));
const priv = process.env.VAPID_PRIVATE_KEY;
const subRaw = process.env.PUSH_SUBSCRIPTION;
if (!priv || !subRaw) { console.log('Secrets VAPID_PRIVATE_KEY / PUSH_SUBSCRIPTION fehlen – nichts zu tun.'); process.exit(0); }
let subs = JSON.parse(subRaw); if (!Array.isArray(subs)) subs = [subs];
webpush.setVapidDetails('mailto:hain@example.invalid', vapidPublicKey, priv);

// Lokale Zeit in der Zeitzone des Nutzers
const parts = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: schedule.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${parts.year}-${parts.month}-${parts.day}`;
const nowMin = (Number(parts.hour) % 24) * 60 + Number(parts.minute);

fs.mkdirSync('.state', { recursive: true });
let sent = {}; try { sent = JSON.parse(fs.readFileSync('.state/sent.json', 'utf8')); } catch { }
for (const k of Object.keys(sent)) if (!k.startsWith(today)) delete sent[k]; // nur heute merken

if (process.env.PUSH_TEST === 'true') {
  for (const s of subs) {
    try { await webpush.sendNotification(s, JSON.stringify({ type: 'progress', ts: Date.now() }), { TTL: 600 }); console.log('Test-Benachrichtigung gesendet.'); }
    catch (e) { console.error('Test fehlgeschlagen:', e.statusCode || '', e.body || e.message); process.exitCode = 1; }
  }
  process.exit();
}
const MAX_LATE = 90; // Minuten: so spät darf ein Termin noch nachgeholt werden
let count = 0;
for (const n of schedule.notifications) {
  const [h, m] = n.time.split(':').map(Number); const t = h * 60 + m;
  const key = `${today}-${n.type}`;
  if (nowMin >= t && nowMin - t <= MAX_LATE && !sent[key]) {
    for (const s of subs) {
      try { await webpush.sendNotification(s, JSON.stringify({ type: n.type, ts: Date.now() }), { TTL: 3600, urgency: 'normal' }); count++; }
      catch (e) { console.error(`Fehler bei ${n.type}:`, e.statusCode || '', e.body || e.message); }
    }
    sent[key] = new Date().toISOString();
  }
}
fs.writeFileSync('.state/sent.json', JSON.stringify(sent));
console.log(`${today} ${parts.hour}:${parts.minute} – ${count} Benachrichtigung(en) gesendet.`);
