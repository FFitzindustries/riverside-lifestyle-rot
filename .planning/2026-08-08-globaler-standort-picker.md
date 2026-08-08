# Globaler Standort-Picker für riverside-lifestyle.com

Stand: 8. August 2026. Branch `feat/global-location-picker`, abgezweigt von
`feat/data-driven-hub`. Die Live-Seite (`main`) bleibt unangetastet, bis der
Stand abgenommen ist.

## Ziel

Der Hub wird zum globalen Verteiler über alle Riverside-Betriebe. Ein Besucher
wählt eine Marke, dann ein Land, dann einen Standort und landet auf der
Website, die diesen Standort betreibt. Neue Länder sind danach ein Datensatz,
kein Umbau.

## Entschieden

| Thema | Entscheidung |
|---|---|
| Rolle des Hubs | Reiner Verteiler. Kein Marken-Content, nur Struktur und Links. |
| Marken-Websites | Pro Land eine eigene Site als eigenes Projekt (`riverside-ink.ch` trägt alle Schweizer Ink-Betriebe). Nicht Teil dieses Branches. |
| Navigation | Marke → Land → Standort → externe URL. |
| Ebenen-Skip | Jede Ebene mit nur einer Option wird übersprungen. Ein Land mit einem Standort leitet direkt weiter. |
| Zweitansicht | Eigene Seite `/standorte/` mit der Ortsansicht statt eines JS-Umschalters: sie ist ohne JavaScript nutzbar, für Google sichtbar und einzeln verlinkbar. |
| Marken-Seiten | Eigene Seite pro Marke am Hub (`/ink/`), nicht Aufklappen auf der Startseite. Grund: 25 Standorte unter einem Drittel-Panel sind auf Mobile unbedienbar, und eine Seite ist rankbar. |
| Umfang der Daten | Alles aus dem Organigramm, auch Geplantes. |
| Geplante Standorte | Sichtbar, ausgegraut, mit Zusatz „in Vorbereitung", **nicht klickbar**. Kein toter Link, keine irreführende Angabe nach UWG Art. 3. |
| Sprache | Hub zweisprachig DE/EN. Marken-Länder-Sites bleiben in ihrer Landessprache. |
| Datenhaltung | JSON unter `data/`, versioniert, vom Build validiert. Kein CMS. |

## Datenmodell

Kernpunkt: Die Ziel-URL hängt an der **Kombination Marke + Standort**, nicht am
Standort. St. Margrethen führt für Ink auf `riverside-ink.ch`, für Beauty auf
`riverside-beauty.ch`. Ein URL-Feld am Standort wäre in dem Moment falsch, in
dem ein Standort zwei Marken trägt — und das ist heute schon der Fall.

### `data/countries.json` (neu)

```json
{ "code": "ch", "name": { "de": "Schweiz", "en": "Switzerland" }, "order": 1 }
```

### `data/locations.json` (umgebaut)

```json
{
  "slug": "st-margrethen",
  "city": { "de": "St. Margrethen", "en": "St. Margrethen" },
  "country": "ch",
  "status": "open",
  "address": ["Grenzstrasse 25", "9430 St. Margrethen"],
  "brandsConfirmed": true,
  "brands": [
    { "brand": "ink", "companyId": "ink-stma", "url": "https://www.riverside-ink.ch/standorte/st-margrethen/" },
    { "brand": "beauty", "companyId": "ink-stma", "url": "https://riverside-beauty.ch/" },
    { "brand": "gastro", "companyId": "ink-gastro", "url": "" }
  ]
}
```

- `status`: `open` oder `planned`. Nur `open` ist klickbar.
- `brandsConfirmed`: `false` markiert eine geratene Markenzuordnung. Der Build
  gibt diese Standorte als Liste aus, damit sie nicht stillschweigend zur
  Wahrheit werden.
- `url` leer: fällt auf die Marken-Site zurück (`brands.json` → `url`).

### `data/companies.json` (erweitert)

Neu pro Gesellschaft: `country` und `exists` (`true`/`false`). **Nur
Gesellschaften mit `exists: true` erscheinen im Impressum.** Eine geplante
GmbH im Impressum wäre eine Falschangabe.

Real existierend (Handelsregister): Riverside Lifestyle Holding AG,
Riverside Ink St. Margrethen GmbH, Riverside Ink. St. Gallen GmbH,
Riverside Ink. Gastro GmbH. Alles andere `exists: false`.

## Standorte aus dem Organigramm

Quelle: `Dropbox-FitzIndustries/Grafiker/FITZ Industries/Übersicht Firmen/FITZ INDUSTRIES_Struktur_Organigram.docx`,
Block RLH.AG. Das Dokument nutzt Textboxen, keine Tabellen; spaltenweise
gelesen ergibt sich:

| Land | Standorte | Status |
|---|---|---|
| Schweiz | St. Margrethen, St. Gallen | open |
| Schweiz | Zürich, Basel, Luzern, Bern | planned |
| England | London | planned |
| USA | New York, Miami, Los Angeles | planned |
| Spanien | Mallorca, Ibiza, Malaga | planned |
| Liechtenstein | Vaduz | planned |
| Österreich | Wien, Salzburg | planned |
| UAE | Dubai, Abu Dhabi | planned |
| Deutschland | München, Berlin, Stuttgart, Ulm, Lindau | planned |
| Italien | Mailand, Rom | planned |
| Frankreich | Paris, St. Tropez, Strassburg | planned |
| Holland | Amsterdam | planned |
| Irland | Dublin | planned |

Korrekturen gegenüber dem Dokument, vom Auftraggeber bestätigt:

- **St. Tropez** stand unter Monaco, liegt in Frankreich.
- **Strassburg** stand unter Luxemburg, liegt in Frankreich.
- Damit haben **Monaco** und **Luxemburg** keinen Standort mehr. Sie werden
  nicht als Land angelegt, bis ein Standort benannt ist.

Markenzuordnung:

- Gesellschaften mit „Ink" im Namen → Marke `ink`, `brandsConfirmed: true`.
- Gesellschaften mit „Lifestyle" im Namen (Dubai, Abu Dhabi) → alle Marken,
  `brandsConfirmed: false`.
- Gesellschaften ohne Markenzusatz (Luzern, Bern, München, Berlin, Stuttgart,
  Ulm, Lindau, Mailand, Rom, St. Tropez, Paris, Amsterdam, Strassburg, Dublin,
  Ibiza, Malaga) → Default `ink`, `brandsConfirmed: false`.

Nicht aufgenommen: **Riverside Lifestyle Co.Ltd. (Thailand)**. Sie hängt im
Organigramm unter Fitz Corp / Asia Swiss Group, nicht unter der Riverside
Lifestyle Holding AG, und es ist keine Stadt genannt. Braucht eine
Entscheidung, bevor sie in die Standortliste kommt.

## Seiten

```
/                     Portal, Marken-Panels
/ink/ /beauty/ /gastro/ /event/   Länderliste je Marke, mit Ortsmodus
/standorte/           alle Standorte nach Ort gruppiert
/en/…                 englischer Spiegel aller Seiten
/impressum/ /agb/ /datenschutz/
```

## Umsetzungsschritte

1. **Datenmodell** — `countries.json` neu, `locations.json` mit 30 Standorten,
   `companies.json` um `country` und `exists` erweitert.
2. **Validierung** in `scripts/lib/data.mjs` — unbekannter Ländercode,
   unbekannte Marken-ID, unbekannte `companyId`, doppelte Slugs, `open` ohne
   Adresse, zwei offene Standorte derselben Marke mit identischer URL. Report
   über alle `brandsConfirmed: false`.
3. **Rendering** — Marken-Seiten mit Länderliste, Ebenen-Skip, Ortsmodus,
   `planned` ausgegraut und nicht klickbar.
4. **i18n** — `content.de.json` und `content.en.json`, Sprachumschalter,
   `hreflang`.
5. **Impressum** — nur `exists: true`.
6. **JSON-LD** — pro Marke und offenem Standort ein eigener `LocalBusiness`,
   statt heute nur der erste Standort (siehe
   `docs/superpowers/follow-up-hub-skalierung.md`, Punkt 2). Geplante
   Standorte gehören **nicht** in den Graph.
7. **Tests** — Ebenen-Skip, `planned` nie klickbar, Fallback-URL, Ortsmodus,
   Impressum ohne geplante Gesellschaften.
8. **Vorschau** lokal bauen und abnehmen lassen. Erst danach Merge nach `main`
   und Umstellung von GitHub Pages auf Actions.

## Offene Punkte, die den Bau nicht blockieren

1. Markenzuordnung von 16 Standorten geraten (`brandsConfirmed: false`).
2. Standort-URLs auf `riverside-ink.ch` existieren noch nicht. Ohne sie führt
   die dritte Ebene in der Schweiz auf eine gemeinsame Seite. Arbeit auf der
   WordPress-Seite, nicht am Hub.
3. Beauty existiert doppelt im Netz: `riverside-ink.ch/beauty/` und
   `riverside-beauty.ch`. Die beiden konkurrieren bei Google gegeneinander.
4. `riverside-ink.com`, `.at`, `.de` sind registriert, zeigen auf den Server,
   liefern aber nichts aus (kein gültiges HTTPS).
5. `riverside-lifestyle.ch` hat keinen A-Record, obwohl `info@riverside-lifestyle.ch`
   darüber läuft.
6. Thailand-Gesellschaft, siehe oben.
7. `llms.txt`, OG-Tags, canonical und `nav-meta` sind noch hart geschrieben und
   behaupten weiter Ostschweiz (Follow-up-Dokument, Punkt 1). Muss mit den
   Ländern mitwachsen, sonst widerspricht sich die Seite selbst.


## Umgesetzt am 8. August 2026

Alle acht Schritte sind gebaut, 106 Tests grün, Build erzeugt 14 Seiten.

Abweichungen vom Plan oben, jeweils mit Grund:

- **Ortsansicht als eigene Seite** statt JS-Umschalter, siehe Tabelle.
- **Englische Rechtstexte entfallen.** Impressum, AGB und Datenschutz sind
  bindende Texte nach Schweizer Recht. Eine juristisch ungeprüfte Übersetzung
  wäre schlechter als ein deutsches Original, das sich maschinell übersetzen
  lässt. `/en/` enthält daher nur die Verteilerseiten und verlinkt die
  deutschen Rechtstexte.
- **Basispfad `BASE_PATH`** neu eingeführt. Die Templates hatten teils relative,
  teils absolute Pfade. Unter dem GitHub-Pages-Projektpfad brechen absolute
  Pfade, in Unterverzeichnissen brechen relative. Beides ist jetzt eine
  Konfiguration.
- **Marke ohne Standort bekommt keine Seite und keinen Nav-Link.** Betrifft
  heute Riverside Event: die Kachel bleibt sichtbar, ist aber kein Link.

Drei Fehler, die beim visuellen Prüfen auffielen und Regressionstests bekommen
haben:

1. Die Navigation der englischen Seiten zeigte in den deutschen Baum.
2. Die Panel-Videos hatten relative Pfade und liefen unter `/en/` ins Leere.
3. Der Hinweis „in Vorbereitung" auf der Event-Kachel war unsichtbar, weil
   `.panel-more` per `max-height:0` geschlossen ist und nur beim aktiven Panel
   aufgeht. Eine Kachel ohne Link wird nie aktiv.
