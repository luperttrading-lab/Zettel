# Updates, die wirklich ankommen – die Mechanik aus Zettel zum Nachbauen

Geschrieben am 14.9.2026 für ein anderes Projekt desselben Auftraggebers. Beschreibt, wie Zettel
dafür sorgt, dass eine Web-App auf dem iPhone **kein Update verpasst** – und warum genau das ohne
diese vier Bausteine regelmäßig schiefgeht.

Gilt für: eine statisch ausgelieferte Web-App (GitHub Pages, Vercel, Netlify), die über
*Teilen → Zum Home-Bildschirm* installiert wird.

Änderungen 15.9.2026 (nach dem Nachbau in der Standort-Uhr): Abschnitt „Die Meldung steht immer am
Kopf" korrigiert – der Auslöser bleibt, wo das Design ihn hat, das Banner antwortet an seiner Kante.
Überblendung als Anforderung ergänzt. Prüfliste 9 und der Takt-Hinweis angepasst.

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

## Baustein 0: das Banner, über das alles gemeldet wird

Ohne diesen Teil sind die Bausteine 3 und 4 nicht lauffähig – sie rufen `showInfo()` und
`zeigeBanner()` auf. Deshalb hier zuerst, vollständig. Ein Element, zwei Zustände: **grün** für „neue
Version da" (mit Knopf), **grau** für eine bloße Auskunft wie „ist geladen".

```html
<div class="update" id="update" hidden>
  <span id="update-text"></span>
  <button class="btn" id="update-go">Jetzt laden</button>
</div>
```

```css
.update {
  position: fixed; left: 12px; right: 12px; top: max(env(safe-area-inset-top), 12px); z-index: 30;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: #34c759; color: #06240e;            /* grün = Handlungsaufforderung */
  padding: 12px 14px; border-radius: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  opacity: 0; transition: opacity .35s ease; pointer-events: none;   /* Überblendung, siehe unten */
}
.update.an { opacity: 1; pointer-events: auto; }
.update[hidden] { display: none; }
.update.info { background: #2d2d33; color: #f2f2f7; font-weight: 500; }   /* grau = nur Auskunft */
.update .btn { width: auto; padding: 8px 14px; font-size: 15px; background: #06240e; color: #fff; }
```

### Das Banner muss **überlagern**, nicht schieben

Zwei Zeilen im CSS sind dafür verantwortlich, und beide werden beim Nachbau gern verändert:

- **`position: fixed`** – das Banner liegt *über* der Seite und nimmt im Textfluss keinen Platz ein.
  Steht es stattdessen im Fluss (`static`, der Vorgabewert) oder auf `sticky`, **schiebt es beim
  Erscheinen den ganzen Inhalt nach unten** und beim Verschwinden wieder hoch. Genau das darf nicht
  passieren: Man tippt auf die Versionsnummer, um etwas nachzusehen – und die Seite springt unter dem
  Finger weg. Aus demselben Grund gehört das Element **direkt in den `<body>`**, nicht in den
  `<header>` oder eine andere Box mit eigenem Fluss.
- **`.update[hidden] { display: none; }`** – ohne diese Zeile ist das Banner **immer sichtbar**. Das
  eingebaute `hidden`-Attribut setzt nur `display: none` mit sehr geringer Spezifität, und das
  `display: flex` der Klasse gewinnt. Ein Klassiker, der beim Testen sofort auffällt – aber nur, wenn
  man daran denkt, dass er existiert.

Nachgemessen an Zettel (15.9.2026, iPhone-Maße 393 × 852): Position des Kopfes, des Zettels und der
Farbreihe sowie die gesamte Scrollhöhe sind **ohne Banner, mit grauer Auskunft und mit grünem
Banner identisch** – 856 px Scrollhöhe in allen drei Fällen, keine Koordinate weicht um einen Pixel
ab.

`top: max(env(safe-area-inset-top), 12px)` ist kein Schmuck: Ohne das liegt das Banner auf einem
iPhone unter der Dynamic Island.

### Es blendet ein, es springt nicht

Ein Banner, das hart erscheint und hart verschwindet, wirkt wie ein Fehler. Deshalb `opacity` mit
Übergang und `hidden` nur als **Endzustand**: `display: none` lässt sich nicht animieren, also erst
`hidden` entfernen, einen Reflow erzwingen, dann die Klasse `an` setzen – und beim Ausblenden
umgekehrt, `hidden` erst nach Ablauf des Übergangs.

```js
let ausTimer = null;
function einblenden() {
  clearTimeout(ausTimer);
  updateEl.hidden = false; void updateEl.offsetWidth;   // Reflow, sonst läuft der Übergang nicht an
  updateEl.classList.add('an');
}
function ausblenden() {
  updateEl.classList.remove('an'); clearTimeout(ausTimer);
  ausTimer = setTimeout(() => { if (!updateEl.classList.contains('an')) updateEl.hidden = true; }, 380);
}
```

Gemessen (Standort-Uhr 15.9.2026): Deckkraft 0,09 nach 60 ms, 1,00 nach 560 ms; beim Ausblenden
zurück auf 0, danach `hidden`.

### Die Meldung der App steht oben – die Antwort auf einen Tipp beim Auslöser

**Zwei verschiedene Fälle, zwei Orte.** Das ist die Entscheidung des Auftraggebers (15.9.2026,
nach dem Nachbau in der Standort-Uhr):

- Eine Meldung, die **die App selbst** auslöst („neue Version ist da", „ist geladen"), hat keinen
  Finger, an dem sie sich orientieren könnte – sie braucht einen Platz, den man kennt: **oben**. iOS
  setzt seine eigenen Banner ebenfalls an den oberen Rand, die Stelle ist gelernt.
- Die Antwort auf einen **Tipp** („ist aktuell", „Offline") erscheint **dort, wo getippt wurde** –
  an der Kante, an der der Auslöser sitzt. Sonst tippt man unten und die Antwort kommt am anderen
  Ende des Bildschirms; auf einem großen Telefon übersieht man sie.

Daraus folgt **nicht**, dass der Auslöser nach oben muss. Der erste Entwurf dieses Abschnitts hatte
das verlangt; in der Standort-Uhr führte das zu einer zweiten Versionsnummer im Kopf, und die hat das
Bild der App zerstört. **Der Auslöser bleibt, wo das Design ihn hat** – in Zettel oben in der
Überschrift, in der Standort-Uhr unten am Fuß. Das Banner dreht sich nach ihm:

```css
.update.unten { top: auto; bottom: max(env(safe-area-inset-bottom), 12px); }
```

```js
// Vor jedem Einblenden aufrufen: null = Meldung der App selbst (immer oben),
// sonst das Element, das getippt wurde.
function bannerAnKante(ausloeser) {
  if (!ausloeser) { updateEl.classList.remove('unten'); return; }
  const r = ausloeser.getBoundingClientRect();
  updateEl.classList.toggle('unten', r.top + r.height / 2 > window.innerHeight / 2);
}
```

In Zettel greift die Klasse nie, weil der Auslöser oben sitzt. In der Standort-Uhr greift sie bei
jedem Tipp auf die Versionszeile am Fuß.

```js
const updateEl = document.getElementById('update');
let infoTimer = null;

// Graue Auskunft, verschwindet nach `sekunden` von selbst (0 = bleibt stehen)
function showInfo(text, sekunden = 2, ausloeser = null) {
  bannerAnKante(ausloeser);
  updateEl.className = 'update info';
  document.getElementById('update-text').textContent = text;
  document.getElementById('update-go').hidden = true;
  einblenden();
  clearTimeout(infoTimer);
  if (sekunden) infoTimer = setTimeout(() => {
    if (updateEl.classList.contains('info')) ausblenden();
  }, sekunden * 1000);
}

// Grünes Banner mit Knopf – immer oben, es kommt von der App
function zeigeBanner(text) {
  bannerAnKante(null);
  updateEl.className = 'update';
  document.getElementById('update-text').textContent = text;
  document.getElementById('update-go').hidden = false;
  einblenden();
}

// Antippen schließt eine Auskunft; der Knopf lädt sofort neu
updateEl.addEventListener('click', () => { if (updateEl.classList.contains('info')) ausblenden(); });
document.getElementById('update-go').addEventListener('click', () => { speichereAlles(); location.reload(); });
```

### Was du durch Eigenes ersetzen musst

| Platzhalter in dieser Anleitung | Was dort hingehört |
|---|---|
| `speichereAlles()` | deine Funktion, die den Zustand **sofort** sichert (in Zettel: `flush()`) |
| `textfeld` | das Eingabefeld, in dem jemand gerade tippen könnte (mehrere: alle prüfen) |
| `titelElement` | das Element, das die Prüfung von Hand auslöst (in Zettel die Überschrift, in der Standort-Uhr die Versionszeile am Fuß) |
| `'app.gesehen'` | ein eigener Schlüssel im localStorage, pro App verschieden |
| `'meine-app'` | der Cache-Name im Service Worker, pro App verschieden |

Hat die App kein Textfeld, fällt die Tipp-Prüfung weg und `announceUpdate` lädt immer nach drei
Sekunden neu.

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

**Vorsicht bei fremden Adressen, über die Daten laufen.** Der Zweig „Cache zuerst" ist für
Schriften und Bibliotheken richtig. Spricht die App über fremde Adressen mit einer Datenbank
(Firebase, ein API), darf der Worker die **nicht** anfassen – ein gecachter Datenbank-Abruf friert
die App auf einem alten Stand ein. Die Standort-Uhr lässt deshalb alles Fremde unberührt durch.

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
titelElement.addEventListener('click', () => checkForUpdate(true)); // (I)
```

**Takt nur, wenn die Prüfung billig ist.** Naheliegend wäre `setInterval(checkForUpdate, 60000)` –
Zettel hatte das bis 3.36 und hat es wieder ausgebaut. Der Grund ist gemessen: Jede Prüfung holt
dort die **ganze** `index.html` – 275 KB roh, über die Leitung rund 87 KB –, um daraus sechs Zeichen
zu lesen. Das sind **etwa 5 MB je Stunde offener App**, für einen Fall, den kaum jemand braucht:
Wer eine App benutzt, legt sie zwischendurch weg und holt sie zurück, und genau dann greift (H).
Anders liegt es, wenn die Prüfung eine kleine `version.json` liest (rund 20 Byte, in der
Standort-Uhr): Dann kostet ein Minutentakt etwa 18 KB je Stunde, und ein Update erreicht auch eine
App, die offen liegen bleibt. Die Standort-Uhr behält den Takt deshalb, Zettel nicht.

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
- **(I) Ein Tipp auf den Auslöser** prüft von Hand und meldet auch, wenn **kein** Update da ist. Das
  ist wichtiger, als es klingt: Ohne diese Rückmeldung weiß man nie, ob die Prüfung funktioniert
  oder nur schweigt. **Und er muss sichtbar sein** – in Zettel war er über hundert Fassungen lang
  nur ein `title`-Attribut, das auf dem iPhone niemand sieht; der Auftraggeber kannte den Weg nicht.
  Seit 3.37 ist die Versionsnummer gepunktet unterstrichen. **Er bleibt, wo das Design ihn hat** –
  keine zweite Versionsnummer an anderer Stelle nur für den Tipp (siehe Baustein 0).

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

Folge beim Nachrüsten: Die **erste** Fassung, die diesen Baustein trägt, meldet sich nach dem Update
noch nicht – keine ältere Fassung hat je `app.gesehen` gesetzt, für die App ist es ein Erststart.
Erst der Sprung danach zeigt die Meldung. Das ist kein Fehler, verwirrt aber, wenn man es nicht weiß.

## Prüfliste: hat man es richtig gemacht?

Der Reihe nach am Gerät durchgehen, nicht am Schreibtisch annehmen:

1. Version hochzählen, ausliefern, **warten bis der Server sie hat** (bei Vercel/Pages: den Bauvorgang
   abwarten, sonst prüft man gegen die alte Datei und hält den Mechanismus für kaputt).
2. App aus dem Hintergrund zurückholen → Banner muss binnen Sekunden erscheinen.
3. Nach dem Neuladen muss die neue Nummer im Kopf stehen **und** die Meldung einmal aufblitzen.
4. Tipp auf den Auslöser bei aktueller Fassung → muss „ist aktuell" melden, nicht schweigen.
5. Flugmodus an, App öffnen → muss weiterlaufen (Cache greift) und beim Tipp auf den Auslöser
   „Offline" melden.
6. Etwas eintippen, währenddessen ein Update ausliefern → es darf **nicht** mitten im Tippen neu
   laden, und die Eingabe darf nicht verloren gehen.
7. App im Vordergrund liegen lassen und den Netzverkehr mitschreiben → ohne Takt darf **nichts**
   fließen; mit Takt nur die kleine Versionsdatei, nie die ganze Seite.
8. Auf den Auslöser tippen und dabei auf den Inhalt darunter schauen → er darf sich **nicht
   bewegen**. Messbar: die Position eines Elements und `document.documentElement.scrollHeight` vor
   und während der Einblendung vergleichen; beides muss gleich bleiben.
9. Sitzt der Auslöser unten, muss die Antwort auf den Tipp **unten** erscheinen (`.unten`); die
   Meldungen der App selbst stehen trotzdem oben. Beides mit Überblendung, nichts springt.

## Was nicht hilft

- **Query-Strings wie `index.html?v=2`.** Man kann den Einstiegspunkt einer Home-Bildschirm-App
  nicht nachträglich ändern; das Symbol zeigt weiter auf die alte Adresse.
- **Den Service Worker einfach weglassen.** Dann greift Punkt 1 der Problemliste (HTTP-Cache), und
  offline läuft gar nichts mehr. Ein *Netz-zuerst*-Worker ist besser als keiner.
- **`Cache-Control`-Header allein.** Sie helfen, ersetzen aber Baustein 3 nicht: Eine App, die im
  Hintergrund liegt, lädt von sich aus überhaupt nichts nach.
- **Eine zweite Versionsnummer nur für den Tipp.** Sie löst das Ortsproblem der Antwort, aber auf
  Kosten des Bildes – die Antwort gehört zum Auslöser, nicht der Auslöser zur Antwort.

## Am Gerät beobachtet (15.9.2026)

Der Auftraggeber hat in Zettel 3.35 → 3.36 mitgemacht, **während die App offen war** – also über
den damaligen 60-Sekunden-Takt, nicht über `visibilitychange`. Beide Meldungen kamen in der
erwarteten Reihenfolge:

1. grünes Banner **„Neue Version 3.36 ist da"** mit Knopf *Jetzt laden*,
2. nach dem Neuladen graue Auskunft **„Version 3.36 ist geladen"**, dazu `v3.36` im Kopf.

In der Standort-Uhr (v0.53 → v0.60 am selben Tag) dasselbe Bild, dazu zwei Lehren: Ein Banner im
Textfluss schob die ganze Uhr nach unten (behoben mit `position: fixed`), und eine zusätzliche
Versionsnummer im Kopf – eingebaut, um die Antwort auf den Tipp oben zu haben – wurde als Störung
des Bildes sofort wieder entfernt. Seitdem antwortet das Banner an der Kante des Auslösers.

Das ist der Beleg, dass die Kette in beiden Richtungen greift: Die App findet das Update von selbst,
**und** sie sagt hinterher, was jetzt läuft. Genau dieses zweite Stück fehlt in den meisten
Anleitungen – und ohne es hält man ein angekommenes Update für ausgeblieben.

## Herkunft

Alles Beschriebene läuft in `luperttrading-lab/Zettel` (`index.html`, `sw.js`) und ist dort durch
Prüfungen in `tests/app_leiste.mjs` abgesichert; der Nachbau mit Versionsdatei, Takt und
`.unten`-Banner in `luperttrading-lab/weasley` (Standort-Uhr, ab v0.56). Baustein 4 kam am
12.9.2026 dazu, nachdem der Auftraggeber die klein gesetzte Versionsnummer im Kopf nicht
wahrgenommen hatte.
