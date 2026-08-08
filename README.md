# Riverside Lifestyle — Hub-Portal

Corporate-Portal der **Riverside Lifestyle Holding AG**. Statische Seite, aus JSON-Daten
generiert. Marken und Standorte werden über `data/` gepflegt, nicht im HTML.

## Bauen und lokal ansehen

```bash
node scripts/build.mjs
cd dist && python3 -m http.server 8078
# http://localhost:8078
```

## Tests

```bash
node --test
```

Keine Dependencies. Node 24 genügt.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `data/` | Wahrheitsquelle: Holding, Marken, Standorte, Gesellschaften, Texte |
| `src/` | HTML-Templates mit `<!--{{platzhalter}}-->` |
| `scripts/lib/` | Renderlogik, je Modul eine Verantwortung |
| `scripts/build.mjs` | erzeugt `dist/` |
| `dist/` | Build-Ergebnis, nicht im Repo |

## Schriften

Die Webfonts liegen selbst gehostet im Repo, kein Laden von Google Fonts zur Laufzeit.
Bei Bedarf (neue Schnitte, Aktualisierung) einmalig `node scripts/fetch-fonts.mjs`
ausführen, um die Font-Dateien neu herunterzuladen.

## Neue Marke hinzufügen

Einen Eintrag in `data/brands.json` ergänzen. Bei eigener Domain `url` setzen, sonst
leer lassen — dann entsteht automatisch eine Seite unter `/<slug>/`. Mit
`"status": "draft"` bleibt die Marke unsichtbar, bis sie fertig ist.

## Neuen Standort hinzufügen

Die Betriebsgesellschaft in `data/companies.json` eintragen, dann den Standort in
`data/locations.json`. Jede Marke am Standort verweist auf die Gesellschaft, die sie dort
betreibt — an einem Ort können das verschiedene sein.

## Der Build bricht ab, wenn

- eine Marke oder `companyId` in `data/locations.json` nicht existiert
- irgendwo noch `TODO` oder `[Platzhalter]` steht
- ein Template-Platzhalter keinen Wert hat

Das ist Absicht: lieber kein Deployment als ein falsches Impressum.

Am Ende des Builds meldet das Skript zusätzlich, welche Seiten noch offene
Rechtstext-Platzhalter enthalten (z. B. in AGB oder Datenschutz). Diese Warnung führt
bewusst nicht zum Abbruch, weil die fehlenden Angaben Geschäftsentscheidungen sind, keine
technischen Fehler.
