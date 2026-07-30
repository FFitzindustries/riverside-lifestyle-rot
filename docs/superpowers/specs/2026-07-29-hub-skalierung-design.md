# Riverside Lifestyle Hub — skalierbare Marken- und Länderstruktur

Datum: 2026-07-29
Status: Design, freigegeben
Repo: `riverside-lifestyle-rot` (aktueller Stand, löst `riverside.lifestyle` ab)

## Problem

Die Hub-Seite ist eine statische Einzelseite mit drei hart verdrahteten Marken-Panels.
Jede Information steht mehrfach im HTML: Marken in Nav, Panels und JSON-LD, Firmendaten
in Impressum, AGB, Datenschutz und Kontaktkarte. Genau deshalb steht im Impressum seit
Wochen `CHE-123.456.789` und in der Kontaktkarte `Musterstrasse 1`.

Laut `Übersicht Socialmedia Profile aller Firmen.xlsx` sind 38 Riverside-Gesellschaften
über 13 Länder geplant. Bei dieser Struktur ist jede weitere Marke und jedes weitere Land
ein manueller Eingriff an fünf HTML-Stellen. Das skaliert nicht.

## Ziel

Eine Wahrheitsquelle in JSON, aus der ein Build-Script alle Seiten erzeugt. Neue Marke
gleich ein JSON-Eintrag. Neues Land gleich ein JSON-Eintrag. Kein HTML anfassen.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Navigation | Marke zuerst, Land danach. Der Hub zeigt Marken, die Markensite zeigt Standorte |
| Technik | JSON-Daten plus Node-Build-Script, null Dependencies, statisches Deploy |
| Zweck der Seite | Corporate-Portal der Holding. Kein Ads-Tracking, kein Pixel, kein Consent-Banner |
| Weltkarte | bleibt Deko ohne Ortsbezug. Standortliste darunter kommt aus den Daten |
| Sprachen | Datenmodell und Build sind mehrsprachig vorbereitet, ausgeliefert wird nur Deutsch |
| Domain | `riverside-lifestyle.com` primär, `.ch` per 301 darauf. E-Mail bleibt auf `.ch` |
| Team-Sektion | entfällt bis echte Texte und Fotos vorliegen |

## Datenmodell

```
data/
  holding.json      Firmendaten der Holding
  brands.json       Marken
  locations.json    Standorte
  companies.json    Betriebsgesellschaften
  content.de.json   Fliesstexte
```

Vier Entitäten statt einer, weil eine Gesellschaft mehrere Marken und Standorte tragen
kann. Riverside Beauty hat keine eigene Gesellschaft, sondern läuft unter der
Riverside Ink St.Margrethen GmbH. Genau diese Beziehung muss das Modell abbilden können.

### brands.json

```json
{
  "slug": "ink",
  "name": "Riverside Ink",
  "short": "Ink",
  "sub": "Tattoo · Piercing · Body Modification",
  "url": "https://www.riverside-ink.ch",
  "status": "live",
  "schemaType": "TattooParlor",
  "media": { "video": "ink.mp4", "poster": "ink.jpg" },
  "order": 1
}
```

`url` gesetzt bedeutet, das Panel verlinkt nach aussen. `url` leer bedeutet, der Build
erzeugt eine Fallback-Unterseite unter `/<slug>/` und das Panel zeigt dorthin. Sobald
eine Domain nachgetragen wird, verschwindet die Fallback-Seite automatisch.

### locations.json

```json
{
  "slug": "st-margrethen",
  "city": "St. Margrethen",
  "country": "CH",
  "address": ["Grenzstrasse 25", "9430 St. Margrethen"],
  "status": "open",
  "brands": [
    { "brand": "ink",    "companyId": "ink-stma" },
    { "brand": "beauty", "companyId": "ink-stma" },
    { "brand": "gastro", "companyId": "ink-gastro" }
  ]
}
```

Die Gesellschaft hängt an der Kombination aus Marke und Standort, nicht am Standort
allein. An der Grenzstrasse 25 laufen Ink und Beauty unter der Riverside Ink
St.Margrethen GmbH, die Gastronomie aber unter der Riverside Ink. Gastro GmbH. Ein
einzelnes `companyId` pro Standort würde das falsch abbilden und ein falsches Impressum
erzeugen.

`status` ist `open` oder `planned`. Geplante Standorte erscheinen nicht in der
Standortliste, bis sie eröffnet sind.

### companies.json

```json
{
  "id": "ink-stma",
  "name": "Riverside Ink St.Margrethen GmbH",
  "uid": "CHE-208.553.114",
  "hrNumber": "CH-320.4.095.533-8",
  "address": ["Grenzstrasse 25", "9430 St. Margrethen", "Schweiz"],
  "register": "Handelsregisteramt des Kantons St. Gallen",
  "mail": "info@riverside-ink.ch"
}
```

## Recherchierte Stammdaten

Diese Daten gehen in `holding.json` und `companies.json`. Quellen: Handelsregister
Kanton St. Gallen, Impressum riverside-beauty.ch, DNS-Prüfung, interne Übersicht.

### Riverside Lifestyle Holding AG

| Feld | Wert |
|---|---|
| Sitz | Grenzstrasse 25, 9430 St. Margrethen, Schweiz |
| UID | CHE-405.114.788 |
| HR-Nummer | CH-320.3.091.625-0 |
| Rechtsform | Aktiengesellschaft |
| Register | Handelsregisteramt des Kantons St. Gallen |
| Eintragung | SHAB Nr. 108 vom 08.06.2021, Statuten 27.05.2021 |
| Aktienkapital | CHF 100'000, 1'000 Namenaktien à CHF 100 |
| Zweck | Erwerb, Halten, Verwalten und Veräussern von Beteiligungen im In- und Ausland |
| Verwaltungsrat | Janine Maria Fitz, Einzelunterschrift, seit Mutation 18.10.2024 |
| E-Mail | info@riverside-lifestyle.ch |
| Telefon | +41 79 901 81 81 |
| Facebook | facebook.com/profile.php?id=61592156620591 |
| MWST | offen, siehe Offene Punkte |

### Betriebsgesellschaften

| Gesellschaft | UID | Adresse | Trägt |
|---|---|---|---|
| Riverside Ink St.Margrethen GmbH | CHE-208.553.114 | Grenzstrasse 25, 9430 St. Margrethen | Ink St. Margrethen, Beauty |
| Riverside Ink. St. Gallen GmbH | CHE-294.845.141 | Spisergasse 14, 9000 St. Gallen | Ink St. Gallen |
| Riverside Ink. Gastro GmbH | CHE-289.050.911 | Grenzstrasse 25, 9430 St. Margrethen | Gastro |
| Riverside Ink. GmbH | CHE-485.564.193 | St. Margrethen | Alteintrag, Rolle klären |

### Marken und Domains

| Marke | Domain | Zustand |
|---|---|---|
| Ink | riverside-ink.ch | live |
| Beauty | riverside-beauty.ch | live |
| Gastro | riversidegastro.ch, riverside-gastro.com | registriert, leerer Platzhalter |
| Event | keine | Gesellschaft geplant, kein Inhalt |

Social der Marken: Ink facebook.com/riversideink.lifestyle und
instagram.com/riverside_ink.ch. Beauty jeweils `riverside.beauty.ch` auf Facebook,
Instagram und TikTok, Telefon +41 76 612 21 22.

## Build-Pipeline

```
data/*.json     ──┐
                  ├──►  node scripts/build.mjs  ──►  dist/
src/*.tmpl.html ──┘
```

Ein Script, keine Dependencies, kein node_modules. Templates sind valides HTML mit
Platzhaltern der Form `<!--{{panels}}-->`.

Erzeugt werden:

- `index.html` mit generierten Panels, Nav-Marken-Links, Standortliste und JSON-LD
- `impressum.html` mit Holding-Block und Tabelle aller Betriebsgesellschaften
- `agb.html` und `datenschutz.html` aus `content.de.json`
- `<slug>/index.html` je Marke ohne eigene Domain
- `sitemap.xml`
- Kopie von `assets/`, `css/`, `js/`

Zwei Validierungen brechen den Build, statt still falsch zu deployen:

1. Jeder Marke-Standort-Eintrag verweist auf eine existierende `companyId` und einen
   existierenden `brand`. Eine Marke an einem Standort ohne zuordenbare Gesellschaft ist
   ein Impressumsfehler.
2. Kein `TODO` und kein `[Platzhalter]` in den Daten.

Deploy über GitHub Actions bei Push auf `main`. `dist/` wird nicht committet.

## Seitenstruktur

| Sektion | Änderung |
|---|---|
| Nav | Marken-Links kehren zurück, generiert aus `brands.json` |
| Hero-Panels | generiert. Ab fünf Marken wechselt das Layout von Vollhöhe-Spalten auf ein Raster |
| Worldwide | Karte unverändert als Deko, darunter generierte Standortliste nach Ländern |
| About/Team | entfällt vorerst. Lorem ipsum und vier erfundene Personen fliegen raus |
| Kontakt | echte Holding-Daten, Maps-Embed auf Grenzstrasse 25 |
| Disclaimer | Facebook- und Remarketing-Absatz entfällt, da Corporate-Portal ohne Tracking |
| WhatsApp-Float | entfällt, gehört zur Ads-Landingpage |

Das Impressum übernimmt die Haftungsabgrenzung aus `riverside-ink-redesign/lib/legal.ts`:
Die Holding hält die Marken und betreibt die Website, führt selbst keinen operativen
Betrieb und haftet nicht für Behandlungen in den Studios.

## Gefundene Fehler im Bestand

Diese Punkte sind unabhängig vom Umbau zu korrigieren.

1. **`info@rlh.ag` ist eine tote Adresse.** Die Domain `rlh.ag` hat weder Nameserver noch
   MX-Eintrag. Post kommt nirgends an. Die Adresse steht im Live-Impressum von
   riverside-beauty.ch und in `riverside-ink-redesign/lib/legal.ts`. Ein Impressum
   braucht eine erreichbare Kontaktmöglichkeit. Ersetzen durch
   `info@riverside-lifestyle.ch`.
2. **Der Disclaimer behauptet Google-Remarketing-Pixel und Cookies**, im Code läuft kein
   Tracking. Entweder Falschangabe oder fehlender Consent-Banner. Mit der Entscheidung
   für das Corporate-Portal entfällt der Absatz.
3. **Vier erfundene Teammitglieder** mit Lorem-ipsum-Biografien auf der Site einer AG.
4. **`riverside-lifestyle.com` und `.ch` haben keinen A-Record.** Die Domains sind bei
   INWX registriert, Mail läuft, die Website war nie aufgeschaltet. Vor dem Deploy zu
   setzen.

## Offene Punkte

| Punkt | Blockiert |
|---|---|
| MWST-Nummer der Holding, oder Bestätigung dass nicht MWST-pflichtig | Impressum |
| Rolle der Riverside Ink. GmbH, CHE-485.564.193 im Verbund | Impressum |
| Soll Riverside Event als vierte Marke auf den Hub? | nein, `status: draft` |
| Team-Texte und Fotos | nein, Sektion entfällt bis dahin |
| Instagram der Dachmarke | nein, Feld bleibt leer |

Der MWST-Status ist die einzige Angabe, die sich nicht öffentlich ermitteln liess. Das
UID-Register gibt sie nur nach Login preis. Bei einer reinen Beteiligungsholding ist
Nicht-Registrierung der Normalfall, dann entfällt die Zeile im Impressum ersatzlos.

## Abnahmekriterien

- `node scripts/build.mjs` läuft ohne Fehler durch
- Beide Validierungen greifen nachweislich, geprüft mit absichtlich kaputten Daten
- Kein `TODO`, kein `[Platzhalter]`, kein `CHE-123.456.789` im Output
- Eine testweise vierte Marke in `brands.json` erscheint nach dem Build in Nav, Panels,
  JSON-LD und Sitemap, ohne dass HTML angefasst wurde
- Lokal auf Port 8078 geprüft, Desktop und Mobil, mit Screenshot
- JSON-LD gegen den Schema.org-Validator geprüft

## Bewusst nicht Teil dieser Arbeit

- CMS. Bei fünf JSON-Dateien nicht gerechtfertigt.
- Cookie-Banner und Tracking. Kommt gemeinsam mit einem Pixel, nicht auf Vorrat.
- Englische Übersetzung. Struktur ist vorbereitet, Inhalte folgen später.
- Kampagnen-Landingpages. Falls nötig, getrennt unter `/lp/`.
- Migration der Marken-Websites auf den Hub. Ink und Beauty bleiben eigenständig.
