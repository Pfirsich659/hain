// Sammelt täglich aktuelle gute Nachrichten aus RSS-Feeds und schreibt news.json.
// Keine Abhängigkeiten. Feeds, die nicht erreichbar sind, werden übersprungen.
import fs from 'node:fs';

const FEEDS = [
  { url: 'https://goodnews.eu/feed/', source: 'goodnews.eu', lang: 'de' },
  { url: 'https://www.goodnewsnetwork.org/feed/', source: 'Good News Network', lang: 'en' },
  { url: 'https://www.positive.news/feed/', source: 'Positive News', lang: 'en' },
];
const MAX_AGE_DAYS = 10;

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };
const shorten = (s, n = 260) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)) + ' …';

const items = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, { headers: { 'User-Agent': 'Hain-NewsBot/1.0 (+personal app)' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    let n = 0;
    for (const b of blocks) {
      const title = tag(b, 'title'); if (!title) continue;
      const date = new Date(tag(b, 'pubDate') || tag(b, 'dc:date') || Date.now());
      if (Date.now() - date > MAX_AGE_DAYS * 864e5) continue;
      const text = shorten(tag(b, 'description') || tag(b, 'content:encoded'));
      items.push({ title, text, url: tag(b, 'link'), date: date.toISOString().slice(0, 10), source: f.source, lang: f.lang }); n++;
    }
    console.log(`${f.source}: ${n} Meldungen`);
  } catch (e) { console.log(`${f.source}: übersprungen (${e.message})`); }
}
// Deutsch zuerst, dann neueste zuerst
items.sort((a, b) => (a.lang === 'de' ? 0 : 1) - (b.lang === 'de' ? 0 : 1) || b.date.localeCompare(a.date));
const out = { updated: new Date().toISOString(), items: items.slice(0, 60) };
if (!out.items.length) { console.log('Keine neuen Meldungen – news.json bleibt unverändert.'); process.exit(0); }
fs.writeFileSync('news.json', JSON.stringify(out, null, 1));
console.log(`news.json: ${out.items.length} Meldungen`);
