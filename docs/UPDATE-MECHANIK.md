# Updates, die wirklich ankommen – die Mechanik aus Zettel zum Nachbauen

Geschrieben am 14.9.2026 für ein anderes Projekt desselben Auftraggebers. Beschreibt, wie Zettel
dafür sorgt, dass eine Web-App auf dem iPhone **kein Update verpasst** – und warum genau das ohne
diese vier Bausteine regelmäßig schiefgeht.

Gilt für: eine statisch ausgelieferte Web-App (GitHub Pages, Vercel, Netlify), die über
*Teilen → Zum Home-Bildschirm* installiert wird.

## Warum man Updates überhaupt verpasst

Drei Schichten halten jeweils eine alte Fassung fest. Jede muss einzeln entschärft werden:

1. **Der HTTP-Cache des Browsers.** Safari liefert `index.html` aus dem eigenen Speicher, ohne beim
   Server nachzufragen. Auf GitHub Pages kommt der CDN-Cache dazu.
2. **Der Service Worker.** Die übliche Anleitung im Netz baut *Cache-first*: erst der Speicher, Netz
   nur als Notnagel. Damit sieht die App eine neue Fassung **nie**.
3. **Die laufende Sitzung.** Eine Home-Bildschirm-App wird auf dem iPhone kaum je geschlossen – sie
   liegt im Hintergrund und wird wieder hervorgeholt. Ohne aktive Prüfung läuft die alte Fassung
   wochenlang weiter, selbst wenn Cache und Service Worker mitspielen würden.

Der vierte Punkt ist kein Cache, sondern Wahrnehmung: Selbst wenn das Update ankommt, **merkt es
niemand** – und dann hält man einen alten Fehler für ungelöst.

## Baustein 1: Service Worker – eigene Dateien „Netz zuerst"

Vollständige `sw.js` aus Zettel, das Wesentliche ist der `fetch`-Handler:

```js
const CACHE = 'meine-app';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();                    // (A)
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();                  // (B)
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const eigen = new URL(req.url).origin === self.location.origin;
  if (eigen) {
    // (C) 'no-cache' = beim Server nachfragen, ob sich etwas geändert hat.
    // Der Cache ist hier nur die Rückfallebene für den Offline-Fall.
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  } else {
    // Fremde Dateien (Schriften, Bibliotheken) ändern sich nicht – da ist Cache zuerst richtig.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
```

Die drei Stellen, an denen es sonst hakt:

- **(A) `skipWaiting()`** – ohne das bleibt ein neuer Service Worker im Zustand *waiting*, bis **alle**
  Fenster der App geschlossen sind. Bei einer Home-Bildschirm-App passiert das praktisch nie.
- **(B) `clients.claim()`** – ohne das bedient der **alte** Service Worker die schon offene Seite
  weiter, auch wenn der neue bereits aktiv ist.
- **(C) `cache: 'no-cache'`** – das ist der Punkt, an dem der HTTP-Cache umgangen wird. `no-cache`
  heißt *nachfragen*, nicht *nicht speichern*; bei unverändertem Inhalt antwortet der Server mit
  304 und es fließen kaum Daten.

## Baustein 2: eine Versionsmarke im HTML

```html
<script>
const APP_VERSION = '1.2';          // bei JEDER Änderung hochzählen
</script>
```

Sie muss als **Zeichenkette im ausgelieferten HTML** stehen, damit man sie von außen lesen kann,
ohne die App zu starten. In Zettel steht sie zusätzlich sichtbar im Kopf und im Menü.

Wichtig: Die Prüfung vergleicht nur Zeichenketten – `'1.10'` ist nicht größer als `'1.9'`, sondern
nur *anders*. Das reicht, solange man **immer hochzählt und nie zurück**. Eine kleinere Nummer wird
ebenfalls als Update erkannt, aber die Reihenfolge stimmt dann nicht mehr.

## Baustein 3: aktiv nachfragen, nicht auf den Browser hoffen

```js
let checking = false, announced = null;

async function checkForUpdate(manual = false) {
  if (checking) return;                                   // keine Doppelläufe
  if (!manual && document.visibilityState !== 'visible') return;   // im Hintergrund nicht
  if (!navigator.onLine) { if (manual) showInfo('Offline – Prüfung nicht möglich'); return; }
  checking = true;
  try {
    const res = await fetch('index.html', { cache: 'no-store' });   // (D)
    if (!res.ok) return;
    const m = (await res.text()).match(/APP_VERSION = '([^']+)'/);  // (E)
    if (m && m[1] !== APP_VERSION) announceUpdate(m[1], manual);
    else if (manual) showInfo('Version ' + APP_VERSION + ' ist aktuell', 4);
  } catch (_) { if (manual) showInfo('Prüfung fehlgeschlagen'); }
  finally { checking = false; }
}

function announceUpdate(v, manual) {
  if (announced === v && !manual) return;     // nicht bei jedem Durchlauf neu melden
  announced = v;
  speichereAlles();                           // (F) UNBEDINGT vor dem Neuladen
  zeigeBanner('Neue Version ' + v + ' ist da');
  const tippt = document.activeElement === textfeld;
  if (manual || !tippt) setTimeout(() => location.reload(), manual ? 1500 : 3000);   // (G)
}
```

Ausgelöst wird an vier Stellen:

```js
window.addEventListener('pageshow', () => setTimeout(checkForUpdate, 800));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();     // (H) der wichtigste
});
setInterval(checkForUpdate, 60000);
titelElement.addEventListener('click', () => checkForUpdate(true)); // (I)
```

- **(D) `cache: 'no-store'`** – diese eine Anfrage darf aus keinem Speicher beantwortet werden.
- **(E) Regex auf den Quelltext** – die Anfrage holt die neue `index.html` als Text und liest die
  Versionsmarke heraus, ohne die Seite zu laden. Der Ausdruck muss **exakt** zur Schreibweise im
  HTML passen (`APP_VERSION = '…'` mit Leerzeichen um das `=`, einfache Anführungszeichen).
- **(F) Vor dem Neuladen speichern.** Der häufigste selbstgemachte Schaden: Die App lädt neu und
  nimmt ungesicherte Eingaben mit ins Grab. In Zettel heißt die Funktion `flush()` und schreibt den
  Zustand sofort statt verzögert.
- **(G) Nicht neu laden, während jemand tippt.** Sonst springt die Tastatur weg und der halbe Satz
  ist fort. Zettel prüft `document.activeElement`.
- **(H) `visibilitychange`** ist der Auslöser, der am meisten bringt: Er greift genau dann, wenn man
  die App aus dem Hintergrund zurückholt – der übliche Weg auf dem iPhone.
- **(I) Ein Tipp auf den Titel** prüft von Hand und meldet auch, wenn **kein** Update da ist. Das
  ist wichtiger, als es klingt: Ohne diese Rückmeldung weiß man nie, ob die Prüfung funktioniert
  oder nur schweigt.

## Baustein 4: nach dem Update einmal sagen, was jetzt läuft

Ohne das merkt niemand, dass das Update angekommen ist – und hält einen behobenen Fehler für offen.

```js
{
  const GESEHEN = 'app.gesehen';
  let vorher = null;
  try { vorher = localStorage.getItem(GESEHEN); } catch (_) {}
  if (vorher !== APP_VERSION) {
    try { localStorage.setItem(GESEHEN, APP_VERSION); } catch (_) {}
    if (vorher) setTimeout(() => showInfo('Version ' + APP_VERSION + ' ist geladen', 4), 400);
  }
}
```

Zwei Feinheiten: Beim **allerersten** Start bleibt es still (`if (vorher)`), sonst begrüßt die App
einen neuen Nutzer mit einer Versionsmeldung. Und `localStorage` steht in Klammern von `try`, weil
es in privaten Fenstern und in manchen Vorschau-Zusammenhängen fehlt.

## Prüfliste: hat man es richtig gemacht?

Der Reihe nach am Gerät durchgehen, nicht am Schreibtisch annehmen:

1. Version hochzählen, ausliefern, **warten bis der Server sie hat** (bei Vercel/Pages: den Bauvorgang
   abwarten, sonst prüft man gegen die alte Datei und hält den Mechanismus für kaputt).
2. App aus dem Hintergrund zurückholen → Banner muss binnen Sekunden erscheinen.
3. Nach dem Neuladen muss die neue Nummer im Kopf stehen **und** die Meldung einmal aufblitzen.
4. Tipp auf den Titel bei aktueller Fassung → muss „ist aktuell" melden, nicht schweigen.
5. Flugmodus an, App öffnen → muss weiterlaufen (Cache greift) und beim Tipp auf den Titel
   „Offline" melden.
6. Etwas eintippen, währenddessen ein Update ausliefern → es darf **nicht** mitten im Tippen neu
   laden, und die Eingabe darf nicht verloren gehen.

## Was nicht hilft

- **Query-Strings wie `index.html?v=2`.** Man kann den Einstiegspunkt einer Home-Bildschirm-App
  nicht nachträglich ändern; das Symbol zeigt weiter auf die alte Adresse.
- **Den Service Worker einfach weglassen.** Dann greift Punkt 1 der Problemliste (HTTP-Cache), und
  offline läuft gar nichts mehr. Ein *Netz-zuerst*-Worker ist besser als keiner.
- **`Cache-Control`-Header allein.** Sie helfen, ersetzen aber Baustein 3 nicht: Eine App, die im
  Hintergrund liegt, lädt von sich aus überhaupt nichts nach.

## Herkunft

Alles Beschriebene läuft in `luperttrading-lab/Zettel` (`index.html`, `sw.js`) und ist dort durch
Prüfungen in `tests/app_leiste.mjs` abgesichert. Baustein 4 kam am 12.9.2026 dazu, nachdem der
Auftraggeber die klein gesetzte Versionsnummer im Kopf nicht wahrgenommen hatte.
