# Follow-up: Hub-Skalierung

Stand: 30. Juli 2026. Offene Punkte aus dem Abschluss-Review des Branches
`feat/data-driven-hub`. Sie wurden bewusst **nicht** in diesem Durchgang
behoben, weil sie entweder eine Entscheidung des Auftraggebers brauchen oder
weil sie eigene, grössere Umbauten sind. Der Branch ist ohne sie mergefähig.

Der rote Faden: Der Branch hat die Website datengetrieben gemacht: Marken,
Standorte, Gesellschaften und Texte liegen als JSON unter `data/`, die
Renderlogik unter `scripts/lib/`, der Build schreibt nach `dist/`. Fast alle
Punkte hier sind Stellen, an denen dieses Versprechen noch nicht eingelöst
ist: Eine neue Marke oder ein neues Land wird dort nicht automatisch richtig,
sondern stumm falsch.

---

## 1. Marken- und Standortfakten leben noch ausserhalb von `data/`

**Fundstellen**

- `llms.txt` (Repo-Wurzel), statische Datei, wird von `scripts/build.mjs`
  über `STATIC_FILES` unverändert nach `dist/` kopiert. Sie zählt alle drei
  Marken mit Beschreibung und URL auf und listet die beiden Standorte.
- `src/index.tmpl.html`, Zeilen 8 und 13 bis 19: `<link rel="canonical">`, alle
  Open-Graph-Tags und `twitter:card` sind hart geschrieben, inklusive
  Domain, Marken-Aufzählung und „St. Gallen & St. Margrethen".
- `src/impressum.tmpl.html:17`, `src/agb.tmpl.html:17`,
  `src/datenschutz.tmpl.html:17`, jeweils `<span class="nav-meta">Lifestyle House ·
  St. Gallen / St. Margrethen</span>`, dreimal wortgleich.

**Warum das relevant wird**

Eine vierte Marke oder ein Standort in einem zweiten Land erscheint in
Panels, Nav, Standortliste, Impressum und JSON-LD automatisch, an diesen
vier Stellen aber nicht. Das Ergebnis ist kein Fehler, den jemand bemerkt,
sondern eine Seite, die sich selbst widerspricht: Die Standortliste zeigt
Wien, die OG-Beschreibung und die Nav-Meta behaupten weiter Ostschweiz.
`llms.txt` ist dabei der unangenehmste Fall, weil die Datei genau dafür
existiert, von Sprachmodellen als Faktenquelle gelesen zu werden.

**Richtung**

`llms.txt` aus `data/` rendern (eigenes Template, analog zu `sitemap.xml`).
OG-Tags, canonical und `nav-meta` zu Template-Platzhaltern machen, gespeist
aus `holding.json` und einer aus den offenen Standorten abgeleiteten
Städte-/Länderliste.

---

## 2. JSON-LD führt pro Marke nur den ersten offenen Standort

**Fundstelle:** `scripts/lib/schema.mjs`, `buildJsonLd`, Zeile `const [first] =
openLocationsFor(data, b.slug);` und der `node.address`-Block darunter.

**Warum das relevant wird**

Riverside Ink ist real an zwei Standorten tätig, St. Margrethen und
St. Gallen. Im Graph erscheint genau einer, nämlich der, der in
`data/locations.json` zufällig zuerst steht. Für lokale Suche und für
Maschinen, die den Graph auswerten, existiert der zweite Standort nicht.
Der Effekt wächst mit jedem weiteren Standort einer Marke.

**Richtung**

Pro Marke und offenem Standort einen eigenen `LocalBusiness`-Knoten mit
eigener `@id` erzeugen und über `location` bzw. `branchOf` an den
Markenknoten hängen, statt eine Adresse direkt am Markenknoten zu führen.
Das ist eine Strukturänderung am Graph, deshalb nicht als Beifang in einem
Fix-Durchgang.

---

## 3. Hosting-Angabe im Datenschutz offen, inklusive Drittlandübermittlung

**Fundstelle:** `src/datenschutz.tmpl.html`, Abschnitt „2. Bearbeitung beim
Besuch der Website (Server-Logs)", der `<span class="todo">`.

**Warum das relevant wird**

Die Datenschutzerklärung sagt derzeit, dass der Hosting-Provider Logfiles
schreibt, benennt ihn aber nicht und nennt keine Speicherdauer. Beides gehört
hinein. Der Deploy-Workflow (`.github/workflows/deploy.yml`) deutet auf
GitHub Pages hin, aber ob dort produktiv gehostet wird, ist eine Entscheidung
des Auftraggebers und wurde hier bewusst nicht vorweggenommen. Kommt ein
US-Anbieter zum Zug, ist zusätzlich eine Aussage zur Übermittlung in ein
Drittland nötig, auch das eine Aussage, die dem Auftraggeber gehört und
nicht geraten werden darf.

**Zu klären:** Wer hostet produktiv, wie lange werden Logs aufbewahrt, und
liegt der Anbieter ausserhalb der Schweiz/EU?

Solange das offen ist, zählt der Build die Stelle als offenen Platzhalter und
warnt beim Deploy. Der Test
`agb and datenschutz document exactly their known open legal placeholders`
in `test/build.test.mjs` pinnt die Zahl auf 1. Beim Schliessen des Punkts
muss sie bewusst auf 0 gezogen werden.

---

## 4. Land ist kein Konzept, sondern ein wiederholter String

**Fundstellen:** `data/locations.json`, wo jeder Standort `countryName` als
freien Text trägt. Gruppiert wird danach in `scripts/lib/fragments.mjs`,
`renderLocationList`, über `byCountry.set(loc.countryName, ...)`.

**Warum das relevant wird**

Der ISO-Code `country` liegt an jedem Standort bereits vor und wird im
JSON-LD auch benutzt, der Anzeigename daneben aber pro Standort neu getippt.
Ein Tippfehler oder eine abweichende Schreibweise („Österreich" vs.
„Oesterreich") erzeugt stumm zwei Ländergruppen mit je einer Stadt. Nichts
schlägt fehl, die Seite sieht nur falsch aus. Bei 13 geplanten Ländern ist
das keine Randwahrscheinlichkeit.

**Richtung**

Länder als eigene Liste (`data/countries.json`: ISO-Code → Anzeigename, ggf.
Sortierung), Standorte referenzieren nur noch den Code. `validate()` in
`scripts/lib/data.mjs` lehnt unbekannte Codes ab, so wie sie das heute schon
für unbekannte Marken- und Gesellschafts-IDs tut.

---

## 5. Registerangaben sind schweizspezifisch

**Fundstelle:** `scripts/lib/legal.mjs`, `renderHoldingBlock` (`UID:`,
`Handelsregister-Nr.:`) und `renderCompanyTable` (`UID:`, `HR-Nr.:`).

**Warum das relevant wird**

Die Feldbeschriftungen sind fest verdrahtet. In Österreich heisst das
Gegenstück Firmenbuchnummer, in Deutschland HRB, dazu kommt dort eine
Umsatzsteuer-Identifikationsnummer statt einer MWST-Nummer. Eine
Betriebsgesellschaft im Ausland würde also mit einer sachlich falschen
Beschriftung im Impressum stehen, in einem Dokument, dessen einziger Zweck
korrekte Registerangaben sind.

**Richtung**

Das Label an die Gesellschaft hängen statt an den Renderer, zum Beispiel über
ein Feld `registerLabels` oder abgeleitet aus dem Land der Gesellschaft.

---

## 6. Die Texte in `content.de.json` sind an drei Marken gekoppelt

**Fundstellen:** `data/content.de.json`, Felder `hero.headline` („Drei Welten. Ein
`<em>`Lifestyle`</em>`."), `worldwide.sub` („Drei Welten, ein Lifestyle …")
und `title` („Riverside Lifestyle — Tattoo, Beauty & Gastro").

**Warum das relevant wird**

Die Zahl im Text ist die Zahl der Live-Marken. Eine vierte Marke macht die
Headline zur Falschaussage, und zwar an der prominentesten Stelle der Seite.
Der Rest des Builds skaliert an dieser Stelle korrekt mit, der Text nicht.

**Richtung**

Entweder die Zahl aus `liveBrands(data).length` als ausgeschriebenes Wort
einsetzen, oder die Headline bewusst zahlfrei formulieren. Ersteres ist
sprachlich heikel (Deklination), Letzteres ist eine Textentscheidung des
Auftraggebers.

---

## 7. Die drei Rechtsseiten-Templates duplizieren Head, Nav und Footer

**Fundstellen:** `src/impressum.tmpl.html`, `src/agb.tmpl.html`,
`src/datenschutz.tmpl.html`, Zeilen 1 bis 22 (Head plus Nav) und der
Footer-Block am Ende sind in allen drei Dateien wortgleich.

**Warum das relevant wird**

Rund 60 Zeilen dreifach. Jede Änderung an Nav, Favicon, Stylesheet-Pfad oder
Footer-Links muss dreimal nachgezogen werden, und die Fehlerklasse ist nicht
„es kracht", sondern „zwei Seiten sind aktualisiert, eine nicht". Punkt 1
oben ist genau so ein Fall: `nav-meta` steht dreimal da.

**Richtung**

Ein `src/layout.tmpl.html` mit einem Content-Slot, die drei Seiten liefern
nur noch ihren Rumpf. `renderTemplate` in `scripts/lib/render.mjs` kann das
heute schon, es braucht nur einen zweiten Renderdurchlauf im Build.

---

## 8. Test-Fixtures sind vollständige Kopien von `data/`

**Fundstellen:** `test/fixtures/broken/` und `test/fixtures/special-chars/`,
je fünf JSON-Dateien, weitgehend identisch mit `data/`.

**Warum das relevant wird**

Eine Strukturänderung am Datenmodell, etwa ein neues Pflichtfeld an der Marke oder
ein umbenanntes Feld am Standort, muss an drei Stellen nachgezogen werden.
Wird eine vergessen, testet die Suite gegen ein Datenmodell, das es nicht
mehr gibt, und bleibt dabei grün.

**Richtung**

Fixtures als Patch auf `data/` erzeugen statt als Kopie. Der B1-Test in
`test/build.test.mjs` macht das bereits vor: `patchedDataDir(file, patch)`
kopiert `data/` in ein Temp-Verzeichnis und schreibt genau eine Datei um. Die
beiden bestehenden Fixture-Verzeichnisse liessen sich darauf umstellen.

---

## 9. Fehlende Validierung im Datenmodell

**Fundstelle:** `scripts/lib/data.mjs`, `validate()`. Geprüft werden heute
nur zwei Dinge: dass jeder Marken-Standort-Eintrag auf eine existierende
Marke und eine existierende Gesellschaft zeigt, und dass kein
Platzhaltertext überlebt hat.

**Was fehlt**

- **Medien:** Niemand prüft, ob `brand.media.video` und `brand.media.poster`
  gesetzt sind und ob die Dateien unter `assets/video/` bzw.
  `assets/poster/` existieren. Eine Live-Marke ohne Video baut durch und
  liefert ein Panel mit totem `<source>`.
- **Eindeutigkeit:** Keine Prüfung auf doppelte `brand.slug`, `company.id`
  oder `location.slug`. Zwei Marken mit demselben Slug erzeugen zwei
  Hub-Seiten in dasselbe Verzeichnis, die zweite überschreibt die erste.
- **Kollision mit statischen Pfaden:** Ein Slug wie `css`, `js` oder
  `assets` erzeugt `dist/css/index.html` und wird beim anschliessenden
  Kopieren der statischen Verzeichnisse in `scripts/build.mjs` (`STATIC_DIRS`)
  überschrieben oder überschreibt selbst. Der Build meldet nichts.

**Richtung**

Alle drei Prüfungen in `validate()` ergänzen. Das ist die Stelle, an der
Datenfehler heute schon zum Buildabbruch führen, und genau der richtige Ort
dafür.

---

## 10. Markenseiten sind SEO-seitig nackt

**Fundstellen:** `src/brand.tmpl.html` (Head, Zeilen 3 bis 12) und
`scripts/build.mjs`, die Hub-Page-Schleife.

**Warum das relevant wird**

Die Hub-Seiten für Marken ohne eigene Domain, heute `/gastro/`, haben kein
JSON-LD, kein `canonical` und keine Open-Graph-Tags. Die Startseite hat alle
drei. Geteilt wird eine Markenseite damit ohne Vorschaubild und ohne Titel.
Sie stehen in der `sitemap.xml`, sind also ausdrücklich zur Indexierung
angemeldet.

Dazu kommt ein inhaltlicher Fehler: Die Standortliste der Markenseite
filtert zwar die Standorte auf die der Marke, zeigt pro Standort aber
weiterhin **alle** dort vertretenen Marken (`renderLocationList` kennt die
Marke nicht, für die gerendert wird). Auf `/gastro/` steht damit unter
St. Margrethen „Riverside Ink · Riverside Beauty · Riverside Gastro".

**Richtung**

Den Markenknoten aus `buildJsonLd` auch auf der Markenseite ausgeben,
canonical und OG-Tags ergänzen, und `renderLocationList` einen optionalen
Marken-Filter geben.

---

## 11. Keine `CNAME`-Datei

**Fundstellen:** Repo-Wurzel (keine `CNAME`), `.github/workflows/deploy.yml`
(Deploy nach GitHub Pages), `src/brand.tmpl.html` (root-absolute Pfade wie
`/css/styles.css`, `/assets/brand/logo.png`).

**Warum das relevant wird**

Ohne `CNAME` deployt GitHub Pages auf eine Projekt-URL der Form
`https://<user>.github.io/<repo>/`. Die Markenseite verlinkt ihre Assets
root-absolut, also auf `https://<user>.github.io/css/styles.css`. Die
Seite lädt ohne Styles, ohne Logo und ohne Schriften. Auf einer eigenen
Domain unter der Wurzel stimmt alles. Der Unterschied fällt lokal nicht auf
und beim ersten echten Deploy sofort.

**Zu klären:** Läuft der produktive Deploy auf `riverside-lifestyle.com`
(dann `CNAME` anlegen) oder auf einer Projekt-Subpath-URL (dann brauchen die
Templates einen konfigurierbaren Base-Path)? Hängt an derselben Entscheidung
wie Punkt 3.

---

## 12. `data/companies.json` führt `mail` und `phone`, die nirgends gerendert werden

**Fundstellen:** `data/companies.json` (Felder `mail`, `phone` an jeder
Gesellschaft), `scripts/lib/legal.mjs` `renderCompanyTable` (nutzt sie nicht).

**Warum das relevant wird**

Toter Datenbestand ist kein akutes Problem, aber er verrottet: Niemand pflegt
Felder, die nirgends sichtbar sind, und irgendwann rendert sie doch jemand,
dann mit veralteten Werten. Bei `ink-stg` und `ink-gastro` ist `phone` heute
schon leer.

**Zu klären:** Sollen Kontaktdaten der Betriebsgesellschaften im Impressum
stehen? Wenn ja, rendern und pflegen. Wenn nein, aus dem Datenmodell
entfernen.

---

## 13. Der Datenschutz spricht von einer „Kontaktseite"

**Fundstelle:** `src/datenschutz.tmpl.html:28`, die `legal-note` ganz oben:
„… eine Google-Maps-Karte auf der Kontaktseite …".

**Warum das relevant wird**

Eine Kontaktseite gibt es nicht. Die Karte sitzt im Kontaktabschnitt der
Startseite (`src/index.tmpl.html`, `<section id="kontakt">`). Wer die Angabe
prüfen will, sucht eine Seite, die nicht existiert, und die Aussage darüber,
wo genau eine Verbindung zu Google aufgebaut wird, ist damit ungenau, und zwar in
genau dem Dokument, das das präzise beantworten soll.

**Richtung**

Formulierung auf „im Kontaktbereich der Startseite" ändern. Kleiner Fix,
hier nur nicht mit aufgenommen, weil er zu keiner der Review-Auflagen gehört.

---

## 14. Gehören die AGB überhaupt auf diese Seite?

**Fundstellen:** `src/agb.tmpl.html` mit sechs offenen Angaben
(`[Firmenname / Rechtsträger]`, Anzahlungshöhe, Gutschein-Gültigkeit,
Zahlungsmittel, Gerichtsstand, Datum), alle als `class="todo"` markiert.
Verlinkt aus dem Footer jeder einzelnen Seite (`index`, `impressum`, `agb`,
`datenschutz`, `brand`).

**Warum das relevant wird**

Zwei Fragen, in dieser Reihenfolge:

1. **Grundsätzlich:** Die Riverside Lifestyle Holding AG ist eine
   Beteiligungsholding. Sie verkauft selbst keine Leistungen. Das steht so
   im Haftungsabschnitt des Impressums und ergibt sich aus dem Zweck in
   `data/holding.json`. AGB regeln Vertragsverhältnisse mit Kundinnen und
   Kunden. Solche Verhältnisse entstehen mit den Betriebsgesellschaften, und
   deren AGB gehören auf deren Seiten. Der Platzhalter
   `[Firmenname / Rechtsträger]` ist genau dieser ungeklärte Punkt: Es ist
   nicht entschieden, wer hier eigentlich Vertragspartner ist.
2. **Falls sie bleiben:** Sechs offene Angaben in einem aus jedem Footer
   verlinkten Dokument. Anzahlungshöhe und Gerichtsstand sind
   Geschäftsentscheidungen, die nur der Auftraggeber treffen kann; geraten
   wären sie schlimmer als sichtbar offen.

**Zu klären:** Erst 1, dann 2. Wird die Seite gestrichen, erledigen sich die
sechs Platzhalter und der Test
`agb and datenschutz document exactly their known open legal placeholders`
in `test/build.test.mjs` ist entsprechend anzupassen.
