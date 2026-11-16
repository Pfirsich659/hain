# Hain – persönliche Gesundheits-App

Eine installierbare Web-App (PWA): Schlaf, Bewegung, Ernährung und Rauchfrei als Garten, der mitwächst.
Alle Gesundheitsdaten bleiben ausschließlich auf dem Handy (IndexedDB). In diesem Repository liegt nur der App-Code.

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App |
| `sw.js` | Service Worker: offline, Push-Texte aus lokalen Daten |
| `schedule.json` | Uhrzeiten der Push-Benachrichtigungen (Zeitzone Europe/Berlin) |
| `push-config.json` | öffentlicher Push-Schlüssel |
| `news.json` | gute Nachrichten, täglich von einer Action aktualisiert |
| `.github/workflows/push.yml` | sendet alle 15 Min fällige Benachrichtigungen |
| `.github/workflows/news.yml` | sammelt täglich gute Nachrichten |

## Secrets (Settings → Secrets and variables → Actions)

- `VAPID_PRIVATE_KEY` – privater Push-Schlüssel
- `PUSH_SUBSCRIPTION` – Code aus der App (Mehr → Push-Dienst verbinden)

## Datenformat

`SCHEMA_VERSION` und `MIGRATIONS` in `index.html` regeln Änderungen am Datenmodell.
Neue Felder werden beim Laden automatisch ergänzt, bestehende Einträge bleiben erhalten.
