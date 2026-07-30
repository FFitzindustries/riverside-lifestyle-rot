# Riverside Lifestyle Hub — Skalierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Hub-Seite aus JSON-Daten generieren, damit eine neue Marke oder ein neues Land ein JSON-Eintrag ist statt einer Änderung an fünf HTML-Stellen.

**Architecture:** Fünf JSON-Dateien unter `data/` sind die Wahrheitsquelle. Ein Node-Script `scripts/build.mjs` liest sie, füllt HTML-Templates aus `src/` und schreibt fertige Seiten nach `dist/`. Die Renderlogik liegt in vier kleinen Modulen unter `scripts/lib/`, jedes mit einer Verantwortung und eigenem Test.

**Tech Stack:** Node 24 (vorhanden: v24.18.0), eingebauter Test-Runner `node:test`, eingebautes `node:assert/strict`. Keine npm-Dependencies, kein `node_modules`, kein Lockfile.

## Global Constraints

- **Keine Dependencies.** Kein `npm install`. Nur Node-Standardbibliothek. Wenn eine Aufgabe nach einer Library verlangt, ist sie falsch geschnitten.
- **Node-ESM.** Alle Dateien `.mjs`, Imports mit `node:`-Prefix (`import { readFile } from 'node:fs/promises'`).
- **Sprache.** Code, Kommentare und Commit-Messages auf Englisch. Alle Inhalte der Website auf Deutsch.
- **Umlaute.** In Website-Inhalten korrekt: ä, ö, ü, ß. Nicht ae, oe, ue, ss. In `data/`-JSON direkt als UTF-8-Zeichen, nicht als HTML-Entity.
- **Commits.** Conventional Commits mit Scope, imperativ: `feat(build): …`, `fix(data): …`, `test(render): …`. **Keine** `Co-Authored-By`-Zeile.
- **`dist/` wird nie committet.** Steht in `.gitignore`.
- **Kein Tracking.** Kein Pixel, kein Analytics, kein Consent-Banner. Das ist ein Corporate-Portal.
- **Primärdomain** ist `https://riverside-lifestyle.com`. Alle canonical-, OG- und JSON-LD-URLs verwenden sie.
- **Tests laufen mit** `node --test`. Jede Task endet grün.

---

## File Structure

**Neu anzulegen:**

| Datei | Verantwortung |
|---|---|
| `data/holding.json` | Stammdaten der Holding |
| `data/brands.json` | Marken |
| `data/locations.json` | Standorte inkl. Marke-Gesellschaft-Zuordnung |
| `data/companies.json` | Betriebsgesellschaften |
| `data/content.de.json` | Fliesstexte der Seite |
| `scripts/lib/data.mjs` | Laden und Validieren der JSON-Dateien |
| `scripts/lib/render.mjs` | Platzhalter-Ersetzung und HTML-Escaping |
| `scripts/lib/fragments.mjs` | Nav-Links, Hero-Panels, Standortliste |
| `scripts/lib/legal.mjs` | Impressum-Blöcke |
| `scripts/lib/schema.mjs` | JSON-LD |
| `scripts/build.mjs` | Orchestrator, schreibt `dist/` |
| `src/index.tmpl.html` | Startseite als Template |
| `src/impressum.tmpl.html` | Impressum als Template |
| `src/agb.tmpl.html` | AGB als Template |
| `src/datenschutz.tmpl.html` | Datenschutz als Template |
| `src/brand.tmpl.html` | Fallback-Markenseite |
| `scripts/fetch-fonts.mjs` | einmaliger Helfer, lädt die Webfonts lokal |
| `css/fonts.css`, `assets/fonts/` | selbst gehostete Schriften |
| `test/*.test.mjs` | ein Test-File je lib-Modul plus End-to-End |
| `.github/workflows/deploy.yml` | Build und Deploy auf GitHub Pages |

**Zu ändern:**

| Datei | Änderung |
|---|---|
| `css/styles.css` | Raster-Layout ab fünf Marken |
| `.gitignore` | `dist/` ergänzen |
| `README.md` | Build-Anleitung statt Platzhalter-Liste |

**Zu löschen:** `index.html`, `impressum.html`, `agb.html`, `datenschutz.html` im Wurzelverzeichnis. Sie werden zu Templates unter `src/`. `assets/team/avatar-*.svg` fällt mit der Team-Sektion weg.

---

## Task 1: Datenquelle und Loader

Legt die fünf JSON-Dateien mit den recherchierten Echtdaten an und einen Loader, der sie lädt und auf Konsistenz prüft. Die Validierung ist der Kern: Sie verhindert, dass ein Standort ohne zuordenbare Gesellschaft oder ein Platzhalter-String in den Output gelangt.

**Files:**
- Create: `data/holding.json`, `data/brands.json`, `data/locations.json`, `data/companies.json`, `data/content.de.json`
- Create: `scripts/lib/data.mjs`
- Test: `test/data.test.mjs`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `loadData(dataDir = 'data', lang = 'de') → Promise<Data>` mit
    `Data = { holding, brands, locations, companies, content }`. Der `lang`-Parameter
    wählt `content.<lang>.json`. Er ist die Vorbereitung auf Mehrsprachigkeit: mehr
    braucht es nicht, solange nur Deutsch existiert.
  - `validate(data) → string[]` — Liste der Fehlermeldungen, leer bei Erfolg
  - `liveBrands(data) → Brand[]` — Marken mit `status === 'live'`, sortiert nach `order`
  - `companyById(data, id) → Company | undefined`

- [ ] **Step 1: Datendateien anlegen**

`data/holding.json`:

```json
{
  "name": "Riverside Lifestyle Holding AG",
  "legalForm": "Aktiengesellschaft",
  "address": ["Grenzstrasse 25", "9430 St. Margrethen", "Schweiz"],
  "uid": "CHE-405.114.788",
  "hrNumber": "CH-320.3.091.625-0",
  "register": "Handelsregisteramt des Kantons St. Gallen",
  "registeredSince": "SHAB Nr. 108 vom 08.06.2021",
  "shareCapital": "CHF 100'000, eingeteilt in 1'000 Namenaktien zu CHF 100",
  "purpose": "Erwerb, Halten, Verwalten und Veräussern von Beteiligungen an Unternehmen im In- und Ausland.",
  "board": [
    { "name": "Janine Maria Fitz", "role": "Verwaltungsrätin", "signature": "Einzelunterschrift" }
  ],
  "vat": null,
  "mail": "info@riverside-lifestyle.ch",
  "phone": "+41 79 901 81 81",
  "url": "https://riverside-lifestyle.com",
  "social": {
    "facebook": "https://www.facebook.com/profile.php?id=61592156620591"
  }
}
```

`vat` ist bewusst `null`. Der MWST-Status der Holding liess sich nicht öffentlich ermitteln. Der Impressum-Renderer gibt die Zeile nur aus, wenn ein Wert gesetzt ist. Sobald der Wert bekannt ist, wird hier `"CHE-405.114.788 MWST"` eingetragen, ohne Codeänderung.

`data/brands.json`:

```json
[
  {
    "slug": "ink",
    "name": "Riverside Ink",
    "short": "Ink",
    "sub": "Tattoo · Piercing · Body Modification",
    "url": "https://www.riverside-ink.ch",
    "status": "live",
    "schemaType": "TattooParlor",
    "description": "Tattoo-, Piercing- und Bodymodification-Studios in St. Margrethen und St. Gallen.",
    "media": { "video": "ink.mp4", "poster": "ink.jpg" },
    "order": 1
  },
  {
    "slug": "beauty",
    "name": "Riverside Beauty",
    "short": "Beauty",
    "sub": "Hyaluron · Botox · Peeling",
    "url": "https://riverside-beauty.ch",
    "status": "live",
    "schemaType": "BeautySalon",
    "description": "Medical-Beauty-Studio: Faltenbehandlung, Volumenaufbau und Hautverjüngung.",
    "media": { "video": "beauty.mp4", "poster": "beauty.jpg" },
    "order": 2
  },
  {
    "slug": "gastro",
    "name": "Riverside Gastro",
    "short": "Gastro",
    "sub": "Küche · Bar · Lounge",
    "url": "",
    "status": "live",
    "schemaType": "Restaurant",
    "description": "Küche, Bar und Lounge unter dem Dach von Riverside Lifestyle.",
    "media": { "video": "gastro.mp4", "poster": "gastro.jpg" },
    "order": 3
  },
  {
    "slug": "event",
    "name": "Riverside Event",
    "short": "Event",
    "sub": "Events · Locations · Booking",
    "url": "",
    "status": "draft",
    "schemaType": "Organization",
    "description": "Eventformate und Locations im Riverside-Verbund.",
    "media": { "video": "", "poster": "" },
    "order": 4
  }
]
```

Gastro hat `url: ""` und bekommt dadurch eine Fallback-Seite unter `/gastro/` (Task 7). Event steht auf `status: "draft"` und wird nirgends gerendert, bis jemand den Status auf `live` setzt.

`data/companies.json`:

```json
[
  {
    "id": "ink-stma",
    "name": "Riverside Ink St.Margrethen GmbH",
    "uid": "CHE-208.553.114",
    "hrNumber": "CH-320.4.095.533-8",
    "address": ["Grenzstrasse 25", "9430 St. Margrethen", "Schweiz"],
    "register": "Handelsregisteramt des Kantons St. Gallen",
    "mail": "info@riverside-ink.ch",
    "phone": "+41 76 612 21 22"
  },
  {
    "id": "ink-stg",
    "name": "Riverside Ink. St. Gallen GmbH",
    "uid": "CHE-294.845.141",
    "hrNumber": "",
    "address": ["Spisergasse 14", "9000 St. Gallen", "Schweiz"],
    "register": "Handelsregisteramt des Kantons St. Gallen",
    "mail": "info@riverside-ink.ch",
    "phone": ""
  },
  {
    "id": "ink-gastro",
    "name": "Riverside Ink. Gastro GmbH",
    "uid": "CHE-289.050.911",
    "hrNumber": "",
    "address": ["Grenzstrasse 25", "9430 St. Margrethen", "Schweiz"],
    "register": "Handelsregisteramt des Kantons St. Gallen",
    "mail": "info@riverside-ink.ch",
    "phone": ""
  }
]
```

`data/locations.json`:

```json
[
  {
    "slug": "st-margrethen",
    "city": "St. Margrethen",
    "country": "CH",
    "countryName": "Schweiz",
    "address": ["Grenzstrasse 25", "9430 St. Margrethen"],
    "status": "open",
    "brands": [
      { "brand": "ink", "companyId": "ink-stma" },
      { "brand": "beauty", "companyId": "ink-stma" },
      { "brand": "gastro", "companyId": "ink-gastro" }
    ]
  },
  {
    "slug": "st-gallen",
    "city": "St. Gallen",
    "country": "CH",
    "countryName": "Schweiz",
    "address": ["Spisergasse 14", "9000 St. Gallen"],
    "status": "open",
    "brands": [
      { "brand": "ink", "companyId": "ink-stg" }
    ]
  }
]
```

`data/content.de.json`:

```json
{
  "lang": "de",
  "siteName": "Riverside Lifestyle",
  "title": "Riverside Lifestyle — Tattoo, Beauty & Gastro",
  "metaDescription": "Riverside Lifestyle ist die Dachmarke der Riverside Lifestyle Holding AG: Riverside Ink, Riverside Beauty und Riverside Gastro in der Ostschweiz.",
  "hero": {
    "kicker": "Riverside Worldwide",
    "headline": "Drei Welten. Ein <em>Lifestyle</em>."
  },
  "worldwide": {
    "kicker": "Riverside Worldwide",
    "title": "Von <em>St.&nbsp;Margrethen</em> in die Welt.",
    "sub": "Drei Welten, ein Lifestyle — weit über die Ostschweiz hinaus.",
    "locationsTitle": "Unsere Standorte"
  },
  "contact": {
    "title": "Hier findest du uns.",
    "labelPhone": "Telefon",
    "labelMail": "E-Mail"
  },
  "footer": {
    "copyright": "© 2026 Riverside Lifestyle"
  }
}
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`test/data.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, validate, liveBrands, companyById } from '../scripts/lib/data.mjs';

test('loadData reads all five files', async () => {
  const data = await loadData('data');
  assert.equal(data.holding.uid, 'CHE-405.114.788');
  assert.ok(Array.isArray(data.brands));
  assert.ok(Array.isArray(data.locations));
  assert.ok(Array.isArray(data.companies));
  assert.equal(data.content.lang, 'de');
});

test('real data passes validation', async () => {
  const data = await loadData('data');
  assert.deepEqual(validate(data), []);
});

test('validate rejects a brand-location entry with unknown companyId', () => {
  const data = {
    holding: { name: 'H' },
    brands: [{ slug: 'ink', status: 'live', order: 1 }],
    companies: [{ id: 'ink-stma' }],
    locations: [{
      slug: 'x', city: 'X', status: 'open',
      brands: [{ brand: 'ink', companyId: 'does-not-exist' }],
    }],
    content: {},
  };
  const errors = validate(data);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /does-not-exist/);
});

test('validate rejects a brand-location entry with unknown brand', () => {
  const data = {
    holding: { name: 'H' },
    brands: [{ slug: 'ink', status: 'live', order: 1 }],
    companies: [{ id: 'c1' }],
    locations: [{
      slug: 'x', city: 'X', status: 'open',
      brands: [{ brand: 'nope', companyId: 'c1' }],
    }],
    content: {},
  };
  const errors = validate(data);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /nope/);
});

test('validate rejects placeholder strings anywhere in the data', () => {
  const data = {
    holding: { name: 'H', phone: 'TODO: echte Nummer' },
    brands: [], companies: [], locations: [], content: {},
  };
  const errors = validate(data);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /holding\.phone/);
});

test('validate rejects bracket placeholders', () => {
  const data = {
    holding: { name: '[Platzhalter]' },
    brands: [], companies: [], locations: [], content: {},
  };
  assert.equal(validate(data).length, 1);
});

test('liveBrands drops drafts and sorts by order', () => {
  const data = { brands: [
    { slug: 'b', status: 'live', order: 2 },
    { slug: 'a', status: 'live', order: 1 },
    { slug: 'd', status: 'draft', order: 0 },
  ] };
  assert.deepEqual(liveBrands(data).map((b) => b.slug), ['a', 'b']);
});

test('companyById finds a company', () => {
  const data = { companies: [{ id: 'x', name: 'X GmbH' }] };
  assert.equal(companyById(data, 'x').name, 'X GmbH');
  assert.equal(companyById(data, 'nope'), undefined);
});

test('the real event brand is a draft and therefore not rendered', async () => {
  const data = await loadData('data');
  assert.ok(data.brands.some((b) => b.slug === 'event'));
  assert.ok(!liveBrands(data).some((b) => b.slug === 'event'));
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/data.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/lib/data.mjs'`

- [ ] **Step 4: Loader implementieren**

`scripts/lib/data.mjs`:

```javascript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILES = {
  holding: 'holding.json',
  brands: 'brands.json',
  locations: 'locations.json',
  companies: 'companies.json',
};

/**
 * Reads all data files and returns them as one object.
 * `lang` picks the content file; only 'de' exists today.
 */
export async function loadData(dataDir = 'data', lang = 'de') {
  const files = { ...FILES, content: `content.${lang}.json` };
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, file]) => {
      const raw = await readFile(join(dataDir, file), 'utf8');
      return [key, JSON.parse(raw)];
    }),
  );
  return Object.fromEntries(entries);
}

const PLACEHOLDER = /TODO|\[Platzhalter|\bTBD\b|CHE-123\.456\.789|Musterstrasse/i;

/** Walks any nested value and reports strings that still look like placeholders. */
function findPlaceholders(value, path, errors) {
  if (typeof value === 'string') {
    if (PLACEHOLDER.test(value)) {
      errors.push(`placeholder in ${path}: "${value}"`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findPlaceholders(v, `${path}[${i}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      findPlaceholders(v, `${path}.${k}`, errors);
    }
  }
}

/**
 * Returns a list of problems. Empty means the data is safe to build from.
 * Two rules matter: every brand-location entry must resolve to a real brand
 * and a real company, and no placeholder text may survive into the output.
 */
export function validate(data) {
  const errors = [];
  const brandSlugs = new Set((data.brands ?? []).map((b) => b.slug));
  const companyIds = new Set((data.companies ?? []).map((c) => c.id));

  for (const loc of data.locations ?? []) {
    for (const entry of loc.brands ?? []) {
      if (!brandSlugs.has(entry.brand)) {
        errors.push(`location "${loc.slug}" references unknown brand "${entry.brand}"`);
      }
      if (!companyIds.has(entry.companyId)) {
        errors.push(
          `location "${loc.slug}" brand "${entry.brand}" references unknown companyId "${entry.companyId}"`,
        );
      }
    }
  }

  for (const [key, value] of Object.entries(data)) {
    findPlaceholders(value, key, errors);
  }
  return errors;
}

/** Brands that should actually appear on the site, in display order. */
export function liveBrands(data) {
  return (data.brands ?? [])
    .filter((b) => b.status === 'live')
    .sort((a, b) => a.order - b.order);
}

export function companyById(data, id) {
  return (data.companies ?? []).find((c) => c.id === id);
}
```

- [ ] **Step 5: Tests laufen lassen, grün bestätigen**

Run: `node --test test/data.test.mjs`
Expected: PASS, 9 Tests

- [ ] **Step 6: Committen**

```bash
git add data scripts/lib/data.mjs test/data.test.mjs
git commit -m "feat(data): add JSON data source and validating loader"
```

---

## Task 2: Template-Engine

Ersetzt Platzhalter der Form `<!--{{key}}-->` in HTML-Templates. Bewusst minimal: keine Schleifen, keine Bedingungen. Alles Dynamische wird von den Fragment-Modulen als fertiges HTML geliefert.

**Files:**
- Create: `scripts/lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `escapeHtml(str) → string`
  - `attr(str) → string` — für Werte in Attributen, escapet zusätzlich Anführungszeichen
  - `renderTemplate(template, vars) → string` — `vars` ist `Record<string, string>`; wirft `Error`, wenn ein Platzhalter im Template keinen Wert hat

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/render.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, attr, renderTemplate } from '../scripts/lib/render.mjs';

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<script>&"x"'), '&lt;script&gt;&amp;&quot;x&quot;');
});

test('escapeHtml keeps umlauts intact', () => {
  assert.equal(escapeHtml('Küche & Bar'), 'Küche &amp; Bar');
});

test('attr escapes quotes for attribute context', () => {
  assert.equal(attr('a"b'), 'a&quot;b');
});

test('renderTemplate replaces a placeholder', () => {
  assert.equal(renderTemplate('<p><!--{{x}}--></p>', { x: 'hi' }), '<p>hi</p>');
});

test('renderTemplate replaces the same placeholder twice', () => {
  assert.equal(renderTemplate('<!--{{x}}--><!--{{x}}-->', { x: 'a' }), 'aa');
});

test('renderTemplate tolerates spaces inside the placeholder', () => {
  assert.equal(renderTemplate('<!--{{ x }}-->', { x: 'a' }), 'a');
});

test('renderTemplate throws when a placeholder has no value', () => {
  assert.throws(
    () => renderTemplate('<!--{{missing}}-->', {}),
    /missing/,
  );
});

test('renderTemplate leaves ordinary comments alone', () => {
  const tmpl = '<!-- a normal comment --><!--{{x}}-->';
  assert.equal(renderTemplate(tmpl, { x: 'v' }), '<!-- a normal comment -->v');
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/render.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/lib/render.mjs'`

- [ ] **Step 3: Engine implementieren**

`scripts/lib/render.mjs`:

```javascript
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for use inside HTML element content. */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Escapes text for use inside a double-quoted HTML attribute. */
export function attr(str) {
  return escapeHtml(str);
}

const PLACEHOLDER = /<!--\{\{\s*([\w.-]+)\s*\}\}-->/g;

/**
 * Replaces every <!--{{key}}--> with vars[key].
 * A missing key is a build error, not a silently empty page.
 */
export function renderTemplate(template, vars) {
  return template.replace(PLACEHOLDER, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      throw new Error(`template placeholder "${key}" has no value`);
    }
    return vars[key];
  });
}
```

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node --test test/render.test.mjs`
Expected: PASS, 8 Tests

- [ ] **Step 5: Committen**

```bash
git add scripts/lib/render.mjs test/render.test.mjs
git commit -m "feat(render): add minimal HTML template engine"
```

---

## Task 3: Fragment-Renderer für Nav, Panels und Standortliste

Erzeugt die drei HTML-Blöcke der Startseite, die heute hart verdrahtet sind.

**Files:**
- Create: `scripts/lib/fragments.mjs`
- Test: `test/fragments.test.mjs`

**Interfaces:**
- Consumes: `liveBrands(data)` aus `scripts/lib/data.mjs`, `escapeHtml`/`attr` aus `scripts/lib/render.mjs`
- Produces:
  - `brandHref(brand) → string` — externe `url`, sonst `/<slug>/`
  - `renderNavLinks(data) → string`
  - `renderPanels(data) → string`
  - `renderLocationList(data) → string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/fragments.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandHref, renderNavLinks, renderPanels, renderLocationList } from '../scripts/lib/fragments.mjs';

const data = {
  brands: [
    {
      slug: 'ink', name: 'Riverside Ink', short: 'Ink',
      sub: 'Tattoo · Piercing', url: 'https://www.riverside-ink.ch',
      status: 'live', media: { video: 'ink.mp4', poster: 'ink.jpg' }, order: 1,
    },
    {
      slug: 'gastro', name: 'Riverside Gastro', short: 'Gastro',
      sub: 'Küche · Bar', url: '',
      status: 'live', media: { video: 'gastro.mp4', poster: 'gastro.jpg' }, order: 2,
    },
    {
      slug: 'event', name: 'Riverside Event', short: 'Event',
      sub: 'Events', url: '', status: 'draft',
      media: { video: '', poster: '' }, order: 3,
    },
  ],
  locations: [
    {
      slug: 'st-margrethen', city: 'St. Margrethen', country: 'CH', countryName: 'Schweiz',
      address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }, { brand: 'gastro', companyId: 'c2' }],
    },
    {
      slug: 'london', city: 'London', country: 'GB', countryName: 'Vereinigtes Königreich',
      address: ['Somewhere 1', 'London'], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3' }],
    },
  ],
};

test('brandHref uses the external url when present', () => {
  assert.equal(brandHref(data.brands[0]), 'https://www.riverside-ink.ch');
});

test('brandHref falls back to a local page when url is empty', () => {
  assert.equal(brandHref(data.brands[1]), '/gastro/');
});

test('renderNavLinks lists live brands only', () => {
  const html = renderNavLinks(data);
  assert.match(html, /Ink<\/a>/);
  assert.match(html, /Gastro<\/a>/);
  assert.doesNotMatch(html, /Event/);
});

test('renderNavLinks keeps Team and Kontakt out — those belong to the template', () => {
  assert.doesNotMatch(renderNavLinks(data), /Kontakt/);
});

test('renderPanels renders one panel per live brand', () => {
  const html = renderPanels(data);
  assert.equal(html.match(/class="panel"/g).length, 2);
});

test('renderPanels wires video, poster and brand marker', () => {
  const html = renderPanels(data);
  assert.match(html, /assets\/video\/ink\.mp4/);
  assert.match(html, /poster="assets\/poster\/ink\.jpg"/);
  assert.match(html, /data-brand="ink"/);
});

test('renderPanels escapes brand text', () => {
  const evil = { brands: [{
    slug: 'x', name: 'X', short: '<b>X</b>', sub: 'a & b', url: 'https://x.test',
    status: 'live', media: { video: 'x.mp4', poster: 'x.jpg' }, order: 1,
  }], locations: [] };
  const html = renderPanels(evil);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.match(html, /a &amp; b/);
});

test('renderLocationList shows open locations grouped by country', () => {
  const html = renderLocationList(data);
  assert.match(html, /Schweiz/);
  assert.match(html, /St\. Margrethen/);
});

test('renderLocationList hides planned locations', () => {
  const html = renderLocationList(data);
  assert.doesNotMatch(html, /London/);
});

test('renderLocationList names the brands present at a location', () => {
  const html = renderLocationList(data);
  assert.match(html, /Riverside Ink/);
  assert.match(html, /Riverside Gastro/);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/fragments.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/lib/fragments.mjs'`

- [ ] **Step 3: Fragment-Renderer implementieren**

`scripts/lib/fragments.mjs`:

```javascript
import { liveBrands } from './data.mjs';
import { escapeHtml, attr } from './render.mjs';

/** Where a brand panel points: its own domain, or a local fallback page. */
export function brandHref(brand) {
  return brand.url ? brand.url : `/${brand.slug}/`;
}

export function renderNavLinks(data) {
  return liveBrands(data)
    .map((b) => `      <a href="${attr(brandHref(b))}">${escapeHtml(b.short)}</a>`)
    .join('\n');
}

export function renderPanels(data) {
  return liveBrands(data).map((b) => `    <a class="panel" href="${attr(brandHref(b))}" data-brand="${attr(b.slug)}">
      <div class="panel-media">
        <video muted loop playsinline poster="assets/poster/${attr(b.media.poster)}">
          <source src="assets/video/${attr(b.media.video)}" type="video/mp4">
        </video>
      </div>
      <div class="panel-body">
        <h2>${escapeHtml(b.short)}</h2>
        <p class="panel-sub">${escapeHtml(b.sub)}</p>
        <span class="panel-more">Zur Website →</span>
      </div>
      <span class="panel-progress"><span></span></span>
    </a>`).join('\n\n');
}

/** Open locations, grouped by country, with the brands present at each. */
export function renderLocationList(data) {
  const brandName = new Map((data.brands ?? []).map((b) => [b.slug, b.name]));
  const open = (data.locations ?? []).filter((l) => l.status === 'open');

  const byCountry = new Map();
  for (const loc of open) {
    if (!byCountry.has(loc.countryName)) byCountry.set(loc.countryName, []);
    byCountry.get(loc.countryName).push(loc);
  }

  return [...byCountry.entries()].map(([country, locs]) => {
    const items = locs.map((loc) => {
      const brands = (loc.brands ?? [])
        .map((e) => brandName.get(e.brand))
        .filter(Boolean)
        .map((n) => escapeHtml(n))
        .join(' · ');
      const address = (loc.address ?? []).map((l) => escapeHtml(l)).join(', ');
      return `        <li class="loc">
          <strong class="loc__city">${escapeHtml(loc.city)}</strong>
          <span class="loc__addr">${address}</span>
          <span class="loc__brands">${brands}</span>
        </li>`;
    }).join('\n');
    return `      <div class="loc-group">
        <h3 class="loc-country">${escapeHtml(country)}</h3>
        <ul class="loc-list">
${items}
        </ul>
      </div>`;
  }).join('\n');
}
```

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node --test test/fragments.test.mjs`
Expected: PASS, 10 Tests

- [ ] **Step 5: Styles für die Standortliste ergänzen**

An `css/styles.css` anhängen:

```css
/* ===================== STANDORTLISTE ===================== */
.loc-groups{max-width:1280px;margin:56px auto 0;padding:0 44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:40px}
.loc-country{font-family:var(--serif);font-size:22px;font-weight:500;margin-bottom:16px}
.loc-list{list-style:none;display:grid;gap:18px}
.loc{display:grid;gap:3px}
.loc__city{font-size:15px;font-weight:600;letter-spacing:.02em}
.loc__addr,.loc__brands{font-size:13px;color:var(--muted)}
.loc__brands{letter-spacing:.06em;text-transform:uppercase;font-size:11px}
@media(max-width:560px){.loc-groups{padding:0 22px;gap:28px}}
```

- [ ] **Step 6: Committen**

```bash
git add scripts/lib/fragments.mjs test/fragments.test.mjs css/styles.css
git commit -m "feat(fragments): render nav, hero panels and location list from data"
```

---

## Task 4: JSON-LD-Generator

Ersetzt den hart verdrahteten `@graph` durch einen aus den Daten erzeugten. `areaServed` kommt aus den echten Ländern statt aus einer festen Liste.

**Files:**
- Create: `scripts/lib/schema.mjs`
- Test: `test/schema.test.mjs`

**Interfaces:**
- Consumes: `liveBrands`, `companyById` aus `scripts/lib/data.mjs`
- Produces: `buildJsonLd(data) → string` — fertiger, eingerückter JSON-String für den `<script type="application/ld+json">`-Block

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/schema.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonLd } from '../scripts/lib/schema.mjs';
import { loadData } from '../scripts/lib/data.mjs';

const data = {
  holding: {
    name: 'Riverside Lifestyle Holding AG',
    url: 'https://riverside-lifestyle.com',
    address: ['Grenzstrasse 25', '9430 St. Margrethen', 'Schweiz'],
    mail: 'info@riverside-lifestyle.ch',
    phone: '+41 79 901 81 81',
    social: { facebook: 'https://facebook.test/x' },
  },
  brands: [
    { slug: 'ink', name: 'Riverside Ink', url: 'https://www.riverside-ink.ch',
      status: 'live', schemaType: 'TattooParlor', description: 'Tattoo.', order: 1 },
    { slug: 'gastro', name: 'Riverside Gastro', url: '',
      status: 'live', schemaType: 'Restaurant', description: 'Küche.', order: 2 },
    { slug: 'event', name: 'Riverside Event', url: '',
      status: 'draft', schemaType: 'Organization', description: 'Events.', order: 3 },
  ],
  locations: [
    { slug: 'st-margrethen', city: 'St. Margrethen', country: 'CH', countryName: 'Schweiz',
      address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }, { brand: 'gastro', companyId: 'c2' }] },
    { slug: 'london', city: 'London', country: 'GB', countryName: 'Vereinigtes Königreich',
      address: ['X 1', 'London'], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3' }] },
  ],
  companies: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
  content: {},
};

test('buildJsonLd produces valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(buildJsonLd(data)));
});

test('the graph holds the organisation plus one node per live brand', () => {
  const graph = JSON.parse(buildJsonLd(data))['@graph'];
  assert.equal(graph.length, 3);
  assert.equal(graph[0]['@type'], 'Organization');
});

test('draft brands never reach the graph', () => {
  const json = buildJsonLd(data);
  assert.doesNotMatch(json, /Riverside Event/);
});

test('brands use their configured schema type', () => {
  const graph = JSON.parse(buildJsonLd(data))['@graph'];
  assert.equal(graph.find((n) => n.name === 'Riverside Ink')['@type'], 'TattooParlor');
  assert.equal(graph.find((n) => n.name === 'Riverside Gastro')['@type'], 'Restaurant');
});

test('subOrganization links every live brand to the organisation', () => {
  const org = JSON.parse(buildJsonLd(data))['@graph'][0];
  assert.deepEqual(org.subOrganization, [
    { '@id': 'https://riverside-lifestyle.com/#ink' },
    { '@id': 'https://riverside-lifestyle.com/#gastro' },
  ]);
});

test('areaServed comes from open locations, not from planned ones', () => {
  const org = JSON.parse(buildJsonLd(data))['@graph'][0];
  assert.deepEqual(org.areaServed, ['St. Margrethen']);
});

test('a brand without its own domain points at the hub page', () => {
  const graph = JSON.parse(buildJsonLd(data))['@graph'];
  const gastro = graph.find((n) => n.name === 'Riverside Gastro');
  assert.equal(gastro.url, 'https://riverside-lifestyle.com/gastro/');
});

test('a brand node carries the address of the location where it operates', () => {
  const graph = JSON.parse(buildJsonLd(data))['@graph'];
  const ink = graph.find((n) => n.name === 'Riverside Ink');
  assert.equal(ink.address.addressLocality, 'St. Margrethen');
  assert.equal(ink.address.addressCountry, 'CH');
});

test('the organisation exposes contact details and social profile', () => {
  const org = JSON.parse(buildJsonLd(data))['@graph'][0];
  assert.equal(org.email, 'info@riverside-lifestyle.ch');
  assert.equal(org.telephone, '+41 79 901 81 81');
  assert.deepEqual(org.sameAs, ['https://facebook.test/x']);
});

test('the real data produces a graph without draft entries', async () => {
  const real = await loadData('data');
  const graph = JSON.parse(buildJsonLd(real))['@graph'];
  assert.equal(graph.length, 4);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/schema.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/lib/schema.mjs'`

- [ ] **Step 3: Generator implementieren**

`scripts/lib/schema.mjs`:

```javascript
import { liveBrands } from './data.mjs';

/** All open locations where a given brand operates. */
function openLocationsFor(data, slug) {
  return (data.locations ?? []).filter(
    (l) => l.status === 'open' && (l.brands ?? []).some((e) => e.brand === slug),
  );
}

/**
 * Builds the schema.org graph: the holding as Organization plus one node per
 * live brand, linked in both directions.
 */
export function buildJsonLd(data) {
  const base = data.holding.url.replace(/\/$/, '');
  const brands = liveBrands(data);

  const openCities = [
    ...new Set(
      (data.locations ?? []).filter((l) => l.status === 'open').map((l) => l.city),
    ),
  ];

  const org = {
    '@type': 'Organization',
    '@id': `${base}/#org`,
    name: data.holding.name,
    url: `${base}/`,
    email: data.holding.mail,
    telephone: data.holding.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.holding.address[0],
      addressLocality: (data.holding.address[1] ?? '').replace(/^\d+\s*/, ''),
      postalCode: (data.holding.address[1] ?? '').match(/^\d+/)?.[0] ?? '',
      addressCountry: 'CH',
    },
    areaServed: openCities,
    subOrganization: brands.map((b) => ({ '@id': `${base}/#${b.slug}` })),
  };

  const social = Object.values(data.holding.social ?? {}).filter(Boolean);
  if (social.length) org.sameAs = social;

  const brandNodes = brands.map((b) => {
    const node = {
      '@type': b.schemaType,
      '@id': `${base}/#${b.slug}`,
      name: b.name,
      url: b.url || `${base}/${b.slug}/`,
      description: b.description,
      parentOrganization: { '@id': `${base}/#org` },
    };
    const [first] = openLocationsFor(data, b.slug);
    if (first) {
      node.address = {
        '@type': 'PostalAddress',
        addressLocality: first.city,
        addressCountry: first.country,
      };
    }
    return node;
  });

  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': [org, ...brandNodes] },
    null,
    2,
  );
}
```

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node --test test/schema.test.mjs`
Expected: PASS, 10 Tests

- [ ] **Step 5: Committen**

```bash
git add scripts/lib/schema.mjs test/schema.test.mjs
git commit -m "feat(schema): generate JSON-LD graph from brand and location data"
```

---

## Task 5: Impressum-Blöcke

Erzeugt den Holding-Block und die Tabelle der Betriebsgesellschaften. Die MWST-Zeile erscheint nur, wenn `holding.vat` gesetzt ist.

**Files:**
- Create: `scripts/lib/legal.mjs`
- Test: `test/legal.test.mjs`

**Interfaces:**
- Consumes: `companyById` aus `scripts/lib/data.mjs`, `escapeHtml`/`attr` aus `scripts/lib/render.mjs`
- Produces:
  - `renderHoldingBlock(data) → string`
  - `renderCompanyTable(data) → string`
  - `renderLiabilitySection(data) → string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/legal.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from '../scripts/lib/legal.mjs';
import { loadData } from '../scripts/lib/data.mjs';

const base = {
  holding: {
    name: 'Riverside Lifestyle Holding AG',
    legalForm: 'Aktiengesellschaft',
    address: ['Grenzstrasse 25', '9430 St. Margrethen', 'Schweiz'],
    uid: 'CHE-405.114.788',
    hrNumber: 'CH-320.3.091.625-0',
    register: 'Handelsregisteramt des Kantons St. Gallen',
    registeredSince: 'SHAB Nr. 108 vom 08.06.2021',
    shareCapital: "CHF 100'000",
    purpose: 'Beteiligungen.',
    board: [{ name: 'Janine Maria Fitz', role: 'Verwaltungsrätin', signature: 'Einzelunterschrift' }],
    vat: null,
    mail: 'info@riverside-lifestyle.ch',
    phone: '+41 79 901 81 81',
    url: 'https://riverside-lifestyle.com',
    social: {},
  },
  companies: [
    { id: 'c1', name: 'A GmbH', uid: 'CHE-111.111.111', hrNumber: 'CH-1',
      address: ['Weg 1', '9430 Ort', 'Schweiz'], register: 'HR SG', mail: 'a@test.ch', phone: '' },
    { id: 'c2', name: 'B GmbH', uid: 'CHE-222.222.222', hrNumber: '',
      address: ['Weg 2', '9000 Ort', 'Schweiz'], register: 'HR SG', mail: 'b@test.ch', phone: '' },
  ],
  brands: [
    { slug: 'ink', name: 'Riverside Ink', status: 'live', order: 1 },
    { slug: 'gastro', name: 'Riverside Gastro', status: 'live', order: 2 },
  ],
  locations: [
    { slug: 'l1', city: 'Ort', country: 'CH', countryName: 'Schweiz',
      address: ['Weg 1', '9430 Ort'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }, { brand: 'gastro', companyId: 'c2' }] },
  ],
  content: {},
};

test('the holding block carries name, UID and register', () => {
  const html = renderHoldingBlock(base);
  assert.match(html, /Riverside Lifestyle Holding AG/);
  assert.match(html, /CHE-405\.114\.788/);
  assert.match(html, /Handelsregisteramt des Kantons St\. Gallen/);
});

test('the holding block lists the board with signature rights', () => {
  const html = renderHoldingBlock(base);
  assert.match(html, /Janine Maria Fitz/);
  assert.match(html, /Einzelunterschrift/);
});

test('the VAT line is omitted while vat is null', () => {
  assert.doesNotMatch(renderHoldingBlock(base), /Mehrwertsteuer|MWST/);
});

test('the VAT line appears once vat is set', () => {
  const withVat = { ...base, holding: { ...base.holding, vat: 'CHE-405.114.788 MWST' } };
  assert.match(renderHoldingBlock(withVat), /MWST/);
});

test('the mail link uses the working address', () => {
  assert.match(renderHoldingBlock(base), /mailto:info@riverside-lifestyle\.ch/);
  assert.doesNotMatch(renderHoldingBlock(base), /rlh\.ag/);
});

test('the company table has one row per company', () => {
  const html = renderCompanyTable(base);
  assert.equal(html.match(/<tr/g).length, 3); // header plus two companies
});

test('each row names the brands the company operates', () => {
  const html = renderCompanyTable(base);
  assert.match(html, /A GmbH[\s\S]*Riverside Ink/);
  assert.match(html, /B GmbH[\s\S]*Riverside Gastro/);
});

test('an empty HR number does not render an empty label', () => {
  const html = renderCompanyTable(base);
  assert.doesNotMatch(html, /CH-1[\s\S]{0,40}HR-Nr\.:\s*</);
});

test('the liability section names the holding and disclaims operations', () => {
  const html = renderLiabilitySection(base);
  assert.match(html, /Riverside Lifestyle Holding AG/);
  assert.match(html, /Betriebsgesellschaft/);
});

test('real data renders every company', async () => {
  const data = await loadData('data');
  const html = renderCompanyTable(data);
  for (const c of data.companies) {
    assert.match(html, new RegExp(c.uid.replace(/\./g, '\\.')));
  }
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/legal.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/lib/legal.mjs'`

- [ ] **Step 3: Legal-Renderer implementieren**

`scripts/lib/legal.mjs`:

```javascript
import { escapeHtml, attr } from './render.mjs';

const lines = (arr) => (arr ?? []).map((l) => escapeHtml(l)).join('<br>');

export function renderHoldingBlock(data) {
  const h = data.holding;
  const board = (h.board ?? [])
    .map((p) => `${escapeHtml(p.name)}, ${escapeHtml(p.role)}, ${escapeHtml(p.signature)}`)
    .join('<br>');
  const vatLine = h.vat ? `\n      MWST-Nr.: ${escapeHtml(h.vat)}<br>` : '';

  return `    <h2>Angaben zum Betreiber</h2>
    <p>
      <strong>${escapeHtml(h.name)}</strong><br>
      ${lines(h.address)}
    </p>

    <h2>Kontakt</h2>
    <p>
      E-Mail: <a href="mailto:${attr(h.mail)}">${escapeHtml(h.mail)}</a><br>
      Telefon: <a href="tel:${attr(h.phone.replace(/\s/g, ''))}">${escapeHtml(h.phone)}</a>
    </p>

    <h2>Handelsregister</h2>
    <p>
      Rechtsform: ${escapeHtml(h.legalForm)}<br>
      UID: ${escapeHtml(h.uid)}<br>
      Handelsregister-Nr.: ${escapeHtml(h.hrNumber)}<br>
      Register: ${escapeHtml(h.register)}<br>
      Eingetragen: ${escapeHtml(h.registeredSince)}<br>
      Aktienkapital: ${escapeHtml(h.shareCapital)}<br>${vatLine}
      Zweck: ${escapeHtml(h.purpose)}
    </p>

    <h2>Verwaltungsrat</h2>
    <p>${board}</p>`;
}

export function renderCompanyTable(data) {
  const brandName = new Map((data.brands ?? []).map((b) => [b.slug, b.name]));

  // Which brands does each company actually operate, and where.
  const operated = new Map();
  for (const loc of data.locations ?? []) {
    for (const entry of loc.brands ?? []) {
      if (!operated.has(entry.companyId)) operated.set(entry.companyId, []);
      const label = `${brandName.get(entry.brand) ?? entry.brand} ${loc.city}`;
      operated.get(entry.companyId).push(label);
    }
  }

  const rows = (data.companies ?? []).map((c) => {
    const hr = c.hrNumber ? `<br>HR-Nr.: ${escapeHtml(c.hrNumber)}` : '';
    const brands = (operated.get(c.id) ?? []).map((b) => escapeHtml(b)).join('<br>');
    return `        <tr>
          <td><strong>${escapeHtml(c.name)}</strong><br>${lines(c.address)}</td>
          <td>UID: ${escapeHtml(c.uid)}${hr}<br>${escapeHtml(c.register)}</td>
          <td>${brands}</td>
        </tr>`;
  }).join('\n');

  return `    <table class="legal-table">
      <thead>
        <tr><th>Gesellschaft</th><th>Register</th><th>Betreibt</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}

export function renderLiabilitySection(data) {
  const name = escapeHtml(data.holding.name);
  return `    <h2>Haftung und Zuständigkeit</h2>
    <p>Riverside Lifestyle ist die Dachmarke der ${name}. Die Holding hält die Marken und betreibt diese Website. Sie führt selbst keinen operativen Betrieb und erbringt keine Tattoo-, Piercing-, Bodymodification-, Beauty-, Laser- oder Gastronomieleistungen.</p>
    <p>Jeder Standort wird von einer rechtlich eigenständigen Betriebsgesellschaft geführt. Ansprüche aus einer Behandlung oder Leistung richten sich gegen die jeweilige Betriebsgesellschaft und, soweit die Leistung von selbstständigen Auftragnehmerinnen und Auftragnehmern erbracht wird, gegen diese persönlich.</p>
    <p>Eine Haftung der ${name} für Leistungen der Betriebsgesellschaften ist im gesetzlich zulässigen Rahmen ausgeschlossen. Zwingende gesetzliche Haftungsbestimmungen bleiben vorbehalten.</p>`;
}
```

- [ ] **Step 4: Tests laufen lassen, grün bestätigen**

Run: `node --test test/legal.test.mjs`
Expected: PASS, 10 Tests

- [ ] **Step 5: Tabellen-Styles ergänzen**

An `css/styles.css` anhängen:

```css
/* ===================== RECHTSSEITEN ===================== */
.legal-table{width:100%;border-collapse:collapse;margin:22px 0;font-size:14px}
.legal-table th,.legal-table td{text-align:left;vertical-align:top;padding:14px 16px;border-bottom:1px solid var(--line)}
.legal-table th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.legal-table td{color:var(--muted)}
.legal-table td strong{color:var(--ink);font-weight:600}
@media(max-width:640px){
  .legal-table,.legal-table tbody,.legal-table tr,.legal-table td{display:block;width:100%}
  .legal-table thead{display:none}
  .legal-table tr{border-bottom:1px solid var(--line);padding:12px 0}
  .legal-table td{border:0;padding:4px 0}
}
```

- [ ] **Step 6: Committen**

```bash
git add scripts/lib/legal.mjs test/legal.test.mjs css/styles.css
git commit -m "feat(legal): render impressum blocks from company data"
```

---

## Task 6: Templates und Build-Orchestrator

Wandelt die bestehenden HTML-Dateien in Templates um, entfernt dabei Team-Sektion, Tracking-Disclaimer und WhatsApp-Float, und baut alles zusammen.

**Files:**
- Create: `src/index.tmpl.html` (aus `index.html`), `src/impressum.tmpl.html`, `src/agb.tmpl.html`, `src/datenschutz.tmpl.html`
- Create: `scripts/build.mjs`
- Modify: `js/main.js` — Team-Modal-Block entfernen
- Modify: `.gitignore`
- Delete: `index.html`, `impressum.html`, `agb.html`, `datenschutz.html`, `assets/team/`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `loadData`, `validate` aus `data.mjs`; `renderTemplate` aus `render.mjs`; `renderNavLinks`, `renderPanels`, `renderLocationList` aus `fragments.mjs`; `buildJsonLd` aus `schema.mjs`; `renderHoldingBlock`, `renderCompanyTable`, `renderLiabilitySection` aus `legal.mjs`
- Produces: `build({ dataDir = 'data', srcDir = 'src', outDir = 'dist', copyStatic = true }) → Promise<{ written: string[] }>`. `copyStatic: false` überspringt das Kopieren von `assets/`, `css/` und `js/`; die Tests nutzen das, um nicht bei jedem Testfall 2,6 MB Video zu kopieren.

- [ ] **Step 1: Templates aus dem bestehenden HTML erzeugen**

`git mv index.html src/index.tmpl.html`, dann bearbeiten:

1. `<title>` durch `<!--{{title}}-->` ersetzen, `<meta name="description" content="...">` durch `content="<!--{{metaDescription}}-->"`.
2. Im Nav den Block der `.nav-links` so ersetzen, dass die Marken davor stehen:

```html
    <div class="nav-links" id="nav-links">
<!--{{navLinks}}-->
      <a href="#kontakt">Kontakt</a>
    </div>
```

Der Link `<a href="#about">Team</a>` fällt weg, weil die Sektion entfällt.

3. Den gesamten Inhalt von `<div class="panels">` durch `<!--{{panels}}-->` ersetzen.
4. In der Worldwide-Sektion nach `</div>` von `.ww-map` einfügen:

```html
  <h3 class="loc-title"><!--{{locationsTitle}}--></h3>
  <div class="loc-groups">
<!--{{locations}}-->
  </div>
```

5. **Ersatzlos löschen:** die komplette `<section class="cta-wa">`, die komplette `<section id="about" class="about">` inklusive `team-modal`, die komplette `<section class="disclaimer">` und den `<a class="wa-float">`.
6. In der Kontakt-Sektion die Platzhalter ersetzen:

```html
        <h3><!--{{siteName}}--></h3>
        <p class="contact-addr"><!--{{contactAddress}}--></p>

        <ul class="contact-list">
          <li>
            <span class="ci"><!--{{labelPhone}}--></span>
            <a href="tel:<!--{{phoneHref}}-->"><!--{{phone}}--></a>
          </li>
          <li>
            <span class="ci"><!--{{labelMail}}--></span>
            <a href="mailto:<!--{{mail}}-->"><!--{{mail}}--></a>
          </li>
        </ul>

        <div class="contact-social">
<!--{{socialLinks}}-->
        </div>
```

Der WhatsApp-Listeneintrag entfällt. Die Maps-URL wird zu:

```html
          src="https://www.google.com/maps?q=Grenzstrasse+25,+9430+St.+Margrethen,+Schweiz&output=embed"
```

7. Den JSON-LD-Block ersetzen:

```html
<script type="application/ld+json">
<!--{{jsonLd}}-->
</script>
```

8. Hero-Overlay und Worldwide-Kopf an die Content-Daten hängen: `<span class="kicker"><!--{{heroKicker}}--></span>`, `<h1><!--{{heroHeadline}}--></h1>`, analog `<!--{{wwKicker}}-->`, `<!--{{wwTitle}}-->`, `<!--{{wwSub}}-->`, `<h2 class="contact-title"><!--{{contactTitle}}--></h2>` und im Footer `<span><!--{{copyright}}--></span>`.

Für `impressum.tmpl.html` den Inhaltsbereich ersetzen durch:

```html
    <h1>Impressum</h1>
<!--{{holdingBlock}}-->
<!--{{liabilitySection}}-->
    <h2>Betriebsgesellschaften</h2>
    <p>Jeder Standort wird von einer eigenständigen Gesellschaft betrieben. Massgeblich für Ansprüche ist die hier genannte Gesellschaft.</p>
<!--{{companyTable}}-->
```

Titel und Footer-Copyright in allen vier Templates ebenfalls auf Platzhalter umstellen. In `agb.tmpl.html` und `datenschutz.tmpl.html` bleiben die Fliesstexte vorerst wie sie sind; sie brauchen nur `<!--{{title}}-->` und `<!--{{copyright}}-->`.

Der Datenschutz enthält in Zeile 30 eine `<p class="legal-note">` und in Zeile 45 einen `<span class="todo">[Empfehlung: …]</span>` zu Google Fonts. Beide bleiben in diesem Task noch stehen. Der Platzhalter-Test in Step 3 prüft deshalb `datenschutz.html` noch nicht mit; Task 9 räumt den Absatz auf und schaltet die Prüfung scharf.

- [ ] **Step 2: Team-Modal aus main.js entfernen**

In `js/main.js` den letzten IIFE-Block ab `// ---- Team-Popup (Modal) ----` bis zum Dateiende löschen. Der Rest bleibt unverändert.

- [ ] **Step 3: Den fehlschlagenden Test schreiben**

`test/build.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';

// copyStatic bleibt aus, damit nicht jeder Testfall 2,6 MB Video kopiert.
async function buildToTmp(opts = {}) {
  const out = await mkdtemp(join(tmpdir(), 'rl-build-'));
  const result = await build({ outDir: out, copyStatic: false, ...opts });
  return { out, result };
}

test('build writes the expected pages', async () => {
  const { out, result } = await buildToTmp();
  for (const f of ['index.html', 'impressum.html', 'agb.html', 'datenschutz.html', 'sitemap.xml']) {
    assert.ok(result.written.includes(f), `${f} missing`);
  }
  await rm(out, { recursive: true, force: true });
});

test('the built index contains one panel per live brand', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.equal(html.match(/class="panel"/g).length, 3);
  await rm(out, { recursive: true, force: true });
});

// datenschutz.html kommt in Task 9 dazu, sobald der Google-Fonts-Absatz aufgeräumt ist.
test('no placeholder survives into the output', async () => {
  const { out } = await buildToTmp();
  for (const f of ['index.html', 'impressum.html', 'agb.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.doesNotMatch(html, /TODO/, `TODO in ${f}`);
    assert.doesNotMatch(html, /\[Platzhalter/, `Platzhalter in ${f}`);
    assert.doesNotMatch(html, /CHE-123\.456\.789/, `fake UID in ${f}`);
    assert.doesNotMatch(html, /Musterstrasse/, `fake address in ${f}`);
    assert.doesNotMatch(html, /<!--\{\{/, `unfilled placeholder in ${f}`);
  }
  await rm(out, { recursive: true, force: true });
});

test('the dead rlh.ag address appears nowhere', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'impressum.html'), 'utf8');
  assert.doesNotMatch(html, /rlh\.ag/);
  assert.match(html, /info@riverside-lifestyle\.ch/);
  await rm(out, { recursive: true, force: true });
});

test('team section, tracking disclaimer and whatsapp float are gone', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /Lorem ipsum/);
  assert.doesNotMatch(html, /team-card/);
  assert.doesNotMatch(html, /Remarketing/);
  assert.doesNotMatch(html, /wa-float/);
  await rm(out, { recursive: true, force: true });
});

test('the impressum lists every company', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'impressum.html'), 'utf8');
  assert.match(html, /CHE-208\.553\.114/);
  assert.match(html, /CHE-294\.845\.141/);
  assert.match(html, /CHE-289\.050\.911/);
  await rm(out, { recursive: true, force: true });
});

test('assets, css and js are copied when copyStatic is on', async () => {
  const { out } = await buildToTmp({ copyStatic: true });
  await readFile(join(out, 'css/styles.css'), 'utf8');
  await readFile(join(out, 'js/main.js'), 'utf8');
  await readFile(join(out, 'assets/video/ink.mp4'));
  await rm(out, { recursive: true, force: true });
});

test('build refuses to run on invalid data', async () => {
  const out = await mkdtemp(join(tmpdir(), 'rl-bad-'));
  await assert.rejects(
    () => build({ dataDir: 'test/fixtures/broken', outDir: out, copyStatic: false }),
    /unknown companyId/,
  );
  await rm(out, { recursive: true, force: true });
});

test('sitemap lists the built pages', async () => {
  const { out } = await buildToTmp();
  const xml = await readFile(join(out, 'sitemap.xml'), 'utf8');
  assert.match(xml, /https:\/\/riverside-lifestyle\.com\//);
  assert.match(xml, /impressum\.html/);
  await rm(out, { recursive: true, force: true });
});
```

Dazu die Fixture für den Fehlerfall. `test/fixtures/broken/` bekommt Kopien der fünf Datendateien, wobei in `locations.json` genau eine `companyId` auf `"does-not-exist"` geändert wird:

```json
[
  {
    "slug": "st-margrethen",
    "city": "St. Margrethen",
    "country": "CH",
    "countryName": "Schweiz",
    "address": ["Grenzstrasse 25", "9430 St. Margrethen"],
    "status": "open",
    "brands": [{ "brand": "ink", "companyId": "does-not-exist" }]
  }
]
```

Die übrigen vier Dateien im Fixture-Ordner sind unveränderte Kopien aus `data/`.

- [ ] **Step 4: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/build.test.mjs`
Expected: FAIL mit `Cannot find module '../scripts/build.mjs'`

- [ ] **Step 5: Orchestrator implementieren**

`scripts/build.mjs`:

```javascript
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadData, validate } from './lib/data.mjs';
import { renderTemplate, escapeHtml, attr } from './lib/render.mjs';
import { renderNavLinks, renderPanels, renderLocationList } from './lib/fragments.mjs';
import { buildJsonLd } from './lib/schema.mjs';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from './lib/legal.mjs';

const STATIC_DIRS = ['assets', 'css', 'js'];
const STATIC_FILES = ['robots.txt', 'llms.txt', 'favicon.svg', '.nojekyll'];

const SOCIAL_LABEL = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };

function renderSocialLinks(holding) {
  return Object.entries(holding.social ?? {})
    .filter(([, url]) => url)
    .map(([key, url]) => {
      const label = SOCIAL_LABEL[key] ?? key;
      return `          <a href="${attr(url)}" target="_blank" rel="noopener" aria-label="${attr(label)}">${escapeHtml(label)}</a>`;
    })
    .join('\n');
}

function sitemap(holding, pages) {
  const base = holding.url.replace(/\/$/, '');
  const urls = pages
    .map((p) => `  <url><loc>${base}/${p === 'index.html' ? '' : p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Reads data and templates, writes the finished site to outDir. */
export async function build({
  dataDir = 'data', srcDir = 'src', outDir = 'dist', copyStatic = true,
} = {}) {
  const data = await loadData(dataDir);
  const errors = validate(data);
  if (errors.length) {
    throw new Error(`data validation failed:\n  ${errors.join('\n  ')}`);
  }

  const { holding, content } = data;
  const common = {
    siteName: content.siteName,
    copyright: content.footer.copyright,
  };

  const indexVars = {
    ...common,
    title: content.title,
    metaDescription: content.metaDescription,
    navLinks: renderNavLinks(data),
    panels: renderPanels(data),
    heroKicker: content.hero.kicker,
    heroHeadline: content.hero.headline,
    wwKicker: content.worldwide.kicker,
    wwTitle: content.worldwide.title,
    wwSub: content.worldwide.sub,
    locationsTitle: content.worldwide.locationsTitle,
    locations: renderLocationList(data),
    contactTitle: content.contact.title,
    contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
    labelPhone: content.contact.labelPhone,
    labelMail: content.contact.labelMail,
    phone: escapeHtml(holding.phone),
    phoneHref: holding.phone.replace(/\s/g, ''),
    mail: escapeHtml(holding.mail),
    socialLinks: renderSocialLinks(holding),
    jsonLd: buildJsonLd(data),
  };

  const pages = [
    ['index.html', 'index.tmpl.html', indexVars],
    ['impressum.html', 'impressum.tmpl.html', {
      ...common,
      title: `Impressum — ${content.siteName}`,
      holdingBlock: renderHoldingBlock(data),
      liabilitySection: renderLiabilitySection(data),
      companyTable: renderCompanyTable(data),
    }],
    ['agb.html', 'agb.tmpl.html', { ...common, title: `AGB — ${content.siteName}` }],
    ['datenschutz.html', 'datenschutz.tmpl.html', { ...common, title: `Datenschutz — ${content.siteName}` }],
  ];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const written = [];
  for (const [target, tmpl, vars] of pages) {
    const template = await readFile(join(srcDir, tmpl), 'utf8');
    await writeFile(join(outDir, target), renderTemplate(template, vars), 'utf8');
    written.push(target);
  }

  await writeFile(join(outDir, 'sitemap.xml'), sitemap(holding, written), 'utf8');
  written.push('sitemap.xml');

  if (copyStatic) {
    for (const dir of STATIC_DIRS) {
      await cp(dir, join(outDir, dir), { recursive: true });
    }
    for (const file of STATIC_FILES) {
      await cp(file, join(outDir, file));
    }
  }

  return { written };
}

// Direct invocation: node scripts/build.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((r) => console.log(`built ${r.written.length} pages into dist/`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 6: Tests laufen lassen, grün bestätigen**

Run: `node --test`
Expected: PASS, alle Tests aus Task 1 bis 6

- [ ] **Step 7: Aufräumen und .gitignore**

```bash
git rm -r --cached assets/team 2>/dev/null; rm -rf assets/team
printf 'dist/\n' >> .gitignore
```

- [ ] **Step 8: Manuell prüfen**

```bash
node scripts/build.mjs
cd dist && python3 -m http.server 8078
```

Im Browser auf http://localhost:8078 prüfen: drei Panels, Nav mit Ink, Beauty, Gastro und Kontakt, Standortliste unter der Karte, keine Team-Sektion, kein WhatsApp-Button, Kontaktkarte mit Grenzstrasse 25. Danach http://localhost:8078/impressum.html: Holding-Block, Haftungsabschnitt, Tabelle mit drei Gesellschaften.

- [ ] **Step 9: Committen**

```bash
git add -A
git commit -m "feat(build): generate site from data, drop team section and tracking disclaimer"
```

---

## Task 7: Fallback-Markenseiten

Marken ohne eigene Domain bekommen eine Seite auf dem Hub. Aktuell betrifft das Gastro.

**Files:**
- Create: `src/brand.tmpl.html`
- Modify: `scripts/build.mjs`
- Test: `test/build.test.mjs` (ergänzen)

**Interfaces:**
- Consumes: `brandHref`, `liveBrands`
- Produces: `build()` schreibt zusätzlich `<slug>/index.html` je Marke ohne `url`; `written` enthält diese Pfade

- [ ] **Step 1: Den fehlschlagenden Test ergänzen**

An `test/build.test.mjs` anhängen:

```javascript
test('a brand without its own domain gets a hub page', async () => {
  const { out, result } = await buildToTmp();
  assert.ok(result.written.includes('gastro/index.html'));
  const html = await readFile(join(out, 'gastro/index.html'), 'utf8');
  assert.match(html, /Riverside Gastro/);
  assert.match(html, /Grenzstrasse 25/);
  await rm(out, { recursive: true, force: true });
});

test('a brand with its own domain gets no hub page', async () => {
  const { result } = await buildToTmp();
  assert.ok(!result.written.includes('ink/index.html'));
  assert.ok(!result.written.includes('beauty/index.html'));
});

test('the panel of a domainless brand points at its hub page', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /href="\/gastro\/" data-brand="gastro"/);
  await rm(out, { recursive: true, force: true });
});

test('draft brands get no page at all', async () => {
  const { result } = await buildToTmp();
  assert.ok(!result.written.includes('event/index.html'));
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/build.test.mjs`
Expected: FAIL, `gastro/index.html` fehlt in `written`

- [ ] **Step 3: Template anlegen**

`src/brand.tmpl.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><!--{{title}}--></title>
<meta name="description" content="<!--{{metaDescription}}-->">
<meta name="theme-color" content="#07080c">
<link rel="icon" href="/assets/brand/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
</head>
<body>

<nav class="nav">
  <div class="nav-in">
    <a class="brandmark" href="/"><img class="brandmark__logo" src="/assets/brand/logo.png" alt="Riverside Lifestyle"></a>
    <div class="nav-links" id="nav-links">
<!--{{navLinks}}-->
      <a href="/#kontakt">Kontakt</a>
    </div>
    <button class="nav-toggle" aria-label="Menü öffnen" aria-expanded="false" aria-controls="nav-links">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<header class="brand-hero">
  <div class="wrap">
    <span class="kicker">Riverside Lifestyle</span>
    <h1><!--{{brandName}}--></h1>
    <p class="brand-sub"><!--{{brandSub}}--></p>
    <p class="brand-desc"><!--{{brandDescription}}--></p>
  </div>
</header>

<section class="brand-locations">
  <div class="wrap">
    <h2><!--{{locationsTitle}}--></h2>
    <div class="loc-groups">
<!--{{locations}}-->
    </div>
  </div>
</section>

<section class="brand-contact">
  <div class="wrap">
    <h2><!--{{contactTitle}}--></h2>
    <p><!--{{contactAddress}}--></p>
    <p>
      <a href="mailto:<!--{{mail}}-->"><!--{{mail}}--></a><br>
      <a href="tel:<!--{{phoneHref}}-->"><!--{{phone}}--></a>
    </p>
  </div>
</section>

<footer class="legal-bar">
  <div class="legal-in">
    <span><!--{{copyright}}--></span>
    <nav class="legal-links">
      <a href="/impressum.html">Impressum</a>
      <a href="/agb.html">AGB</a>
      <a href="/datenschutz.html">Datenschutz</a>
    </nav>
  </div>
</footer>

<script src="/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Build erweitern**

In `scripts/build.mjs` die bestehende Import-Zeile für `data.mjs` um `liveBrands` erweitern:

```javascript
import { loadData, validate, liveBrands } from './lib/data.mjs';
```

Und nach dem Schreiben der Sitemap, vor dem Kopieren der statischen Dateien, einfügen:

```javascript
  const brandTemplate = await readFile(join(srcDir, 'brand.tmpl.html'), 'utf8');
  for (const brand of liveBrands(data).filter((b) => !b.url)) {
    const dir = join(outDir, brand.slug);
    await mkdir(dir, { recursive: true });
    const locationsForBrand = {
      ...data,
      locations: data.locations.filter((l) => (l.brands ?? []).some((e) => e.brand === brand.slug)),
    };
    const html = renderTemplate(brandTemplate, {
      ...common,
      title: `${brand.name} — ${content.siteName}`,
      metaDescription: brand.description,
      navLinks: renderNavLinks(data),
      brandName: escapeHtml(brand.name),
      brandSub: escapeHtml(brand.sub),
      brandDescription: escapeHtml(brand.description),
      locationsTitle: content.worldwide.locationsTitle,
      locations: renderLocationList(locationsForBrand),
      contactTitle: content.contact.title,
      contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
      mail: escapeHtml(holding.mail),
      phone: escapeHtml(holding.phone),
      phoneHref: holding.phone.replace(/\s/g, ''),
    });
    await writeFile(join(dir, 'index.html'), html, 'utf8');
    written.push(`${brand.slug}/index.html`);
  }
```

Die Sitemap-Zeile verschiebt sich hinter diese Schleife, damit die Markenseiten enthalten sind. Dazu in `sitemap()` den Sonderfall `index.html` beibehalten.

- [ ] **Step 5: Styles ergänzen**

An `css/styles.css` anhängen:

```css
/* ===================== MARKENSEITE ===================== */
.brand-hero{padding:180px 0 80px;border-bottom:1px solid var(--line)}
.brand-hero h1{font-family:var(--serif);font-size:clamp(38px,5vw,72px);font-weight:500;line-height:1.05;margin:10px 0 14px}
.brand-sub{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.brand-desc{margin-top:22px;max-width:640px;font-size:18px;color:var(--muted)}
.brand-locations,.brand-contact{padding:70px 0;border-bottom:1px solid var(--line)}
.brand-locations h2,.brand-contact h2{font-family:var(--serif);font-size:clamp(26px,3vw,38px);font-weight:500;margin-bottom:26px}
.brand-locations .loc-groups{margin-top:0;padding:0}
```

- [ ] **Step 6: Tests laufen lassen, grün bestätigen**

Run: `node --test`
Expected: PASS, alle Tests

- [ ] **Step 7: Manuell prüfen**

```bash
node scripts/build.mjs && cd dist && python3 -m http.server 8078
```

http://localhost:8078/gastro/ aufrufen: Markenkopf, Standort St. Margrethen, Kontaktblock, Footer mit Rechtslinks. Auf der Startseite muss das Gastro-Panel dorthin führen, Ink und Beauty nach aussen.

- [ ] **Step 8: Committen**

```bash
git add -A
git commit -m "feat(build): add fallback pages for brands without their own domain"
```

---

## Task 8: Layout für mehr als vier Marken

Die Hero-Panels liegen in einem Flex-Container. Bei fünf oder mehr Marken werden die Spalten unlesbar schmal. Ab fünf Panels wechselt das Layout auf ein Raster.

**Files:**
- Modify: `css/styles.css`
- Modify: `scripts/lib/fragments.mjs` — Marker-Klasse am Container
- Test: `test/fragments.test.mjs` (ergänzen)

**Interfaces:**
- Consumes: `liveBrands`
- Produces: `panelsClass(data) → string` — `'panels'` oder `'panels panels--grid'`

- [ ] **Step 1: Den fehlschlagenden Test ergänzen**

An `test/fragments.test.mjs` anhängen:

```javascript
import { panelsClass } from '../scripts/lib/fragments.mjs';

test('four or fewer brands keep the column layout', () => {
  assert.equal(panelsClass(data), 'panels');
});

test('five or more brands switch to the grid layout', () => {
  const many = { brands: Array.from({ length: 5 }, (_, i) => ({
    slug: `b${i}`, name: `B${i}`, short: `B${i}`, sub: 's', url: 'https://x.test',
    status: 'live', media: { video: 'v.mp4', poster: 'p.jpg' }, order: i,
  })), locations: [] };
  assert.equal(panelsClass(many), 'panels panels--grid');
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/fragments.test.mjs`
Expected: FAIL mit `panelsClass is not a function`

- [ ] **Step 3: Funktion implementieren**

An `scripts/lib/fragments.mjs` anhängen:

```javascript
/** Column layout stops working once the panels get too narrow. */
export function panelsClass(data) {
  return liveBrands(data).length >= 5 ? 'panels panels--grid' : 'panels';
}
```

In `scripts/build.mjs` den Import und die Variable ergänzen:

```javascript
import { renderNavLinks, renderPanels, renderLocationList, brandHref, panelsClass } from './lib/fragments.mjs';
```

sowie in `indexVars` die Zeile `panelsClass: panelsClass(data),`.

In `src/index.tmpl.html` den Container anpassen:

```html
  <div class="<!--{{panelsClass}}-->">
```

- [ ] **Step 4: Raster-Styles ergänzen**

An `css/styles.css` anhängen:

```css
/* Ab fünf Marken: Raster statt Spalten, sonst werden die Panels unlesbar schmal. */
.panels--grid{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr}
.panels--grid .panel{flex:none;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:30px 26px}
.panels--grid .panel.is-active{flex:none}
.panels--grid .panel h2{font-size:clamp(22px,2vw,34px)}
@media(max-width:920px){.panels--grid{grid-template-columns:1fr}}
```

- [ ] **Step 5: Tests laufen lassen, grün bestätigen**

Run: `node --test`
Expected: PASS, alle Tests

- [ ] **Step 6: Mit fünf Marken manuell prüfen**

Vorübergehend in `data/brands.json` den Status von Event auf `"live"` setzen und zwei Testmarken ergänzen, sodass fünf live sind. Dann:

```bash
node scripts/build.mjs && cd dist && python3 -m http.server 8078
```

Prüfen, dass die Startseite ein Raster zeigt und lesbar bleibt, auf Desktop und Mobil. Danach `git checkout data/brands.json`, um den Testzustand zu verwerfen.

- [ ] **Step 7: Committen**

```bash
git add css/styles.css scripts/lib/fragments.mjs scripts/build.mjs src/index.tmpl.html test/fragments.test.mjs
git commit -m "feat(layout): switch hero panels to a grid from five brands on"
```

---

## Task 9: Schriften lokal hosten und Datenschutz bereinigen

Die Seite lädt Cormorant Garamond und Inter von `fonts.googleapis.com`. Dabei geht die
IP-Adresse jeder Besucherin an Google. Der Datenschutz erklärt das mit einem
`[Empfehlung: …]`-Platzhalter, statt einen Zustand zu beschreiben. Lokales Hosten löst
beides: die Übertragung entfällt, und der Absatz beschreibt danach die Wahrheit.

**Files:**
- Create: `scripts/fetch-fonts.mjs`, `css/fonts.css`, `assets/fonts/*.woff2`
- Modify: `src/index.tmpl.html`, `src/impressum.tmpl.html`, `src/agb.tmpl.html`, `src/datenschutz.tmpl.html`, `src/brand.tmpl.html`
- Modify: `test/build.test.mjs` — Prüfung auf `datenschutz.html` ausweiten
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: nichts
- Produces: keine neuen Exporte. `scripts/build.mjs` bleibt unverändert: `css/` und `assets/` werden bereits als Ganzes kopiert, `fonts.css` und `assets/fonts/` kommen dadurch automatisch mit.

- [ ] **Step 1: Fonts einmalig herunterladen**

`scripts/fetch-fonts.mjs`:

```javascript
/**
 * One-off helper: downloads the webfonts from Google and rewrites the CSS to
 * local paths. Run once, commit the result. The site itself never talks to Google.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const CSS_URL = 'https://fonts.googleapis.com/css2'
  + '?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500'
  + '&family=Inter:wght@400;500;600&display=swap';

// Google serves woff2 only to browsers that claim to support it.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const OUT_DIR = 'assets/fonts';

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g) ?? [])];
if (!urls.length) throw new Error('no font URLs found in the Google CSS');

await mkdir(OUT_DIR, { recursive: true });
let local = css;
for (const url of urls) {
  const name = basename(new URL(url).pathname);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(join(OUT_DIR, name), bytes);
  local = local.replaceAll(url, `/assets/fonts/${name}`);
}

await writeFile(
  'css/fonts.css',
  `/* Generated by scripts/fetch-fonts.mjs. Do not edit by hand. */\n${local}`,
  'utf8',
);
console.log(`downloaded ${urls.length} font files`);
```

Run: `node scripts/fetch-fonts.mjs`
Expected: `downloaded 17 font files`, danach existieren `css/fonts.css` und `assets/fonts/`.

- [ ] **Step 2: Templates auf lokale Schriften umstellen**

In allen fünf Templates die drei Google-Zeilen

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

ersetzen durch

```html
<link rel="stylesheet" href="/css/fonts.css">
```

In `src/brand.tmpl.html` steht bereits `/css/styles.css` mit führendem Schrägstrich; in den vier Wurzel-Templates bleibt `css/styles.css` relativ, `fonts.css` wird dort ebenfalls relativ eingebunden: `<link rel="stylesheet" href="css/fonts.css">`.

- [ ] **Step 3: Datenschutz-Absatz korrigieren**

In `src/datenschutz.tmpl.html` den Google-Fonts-Abschnitt ersetzen:

```html
    <h2>4. Schriftarten</h2>
    <p>Diese Website bindet alle Schriftarten lokal von unserem eigenen Server ein. Es werden keine Schriften von Google Fonts oder anderen externen Anbietern nachgeladen. Beim Besuch dieser Seite wird deine IP-Adresse dadurch an keinen Schriftanbieter übertragen.</p>
```

Ausserdem die `<p class="legal-note">` in Zeile 30 ersetzen durch:

```html
    <p class="legal-note">Diese Website setzt keine Cookies zu Analyse- oder Werbezwecken ein und bindet keine Tracking-Dienste ein. Eingebunden sind ausschliesslich selbst gehostete Schriften, selbst gehostete Videos und eine Google-Maps-Karte auf der Kontaktseite, die erst beim Laden der Seite eine Verbindung zu Google herstellt.</p>
```

- [ ] **Step 4: Den fehlschlagenden Test schreiben**

In `test/build.test.mjs` den Platzhalter-Test wieder auf alle vier Seiten ausweiten und zwei Prüfungen ergänzen:

```javascript
test('no placeholder survives into the output', async () => {
  const { out } = await buildToTmp();
  for (const f of ['index.html', 'impressum.html', 'agb.html', 'datenschutz.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.doesNotMatch(html, /TODO/, `TODO in ${f}`);
    assert.doesNotMatch(html, /\[Platzhalter/, `Platzhalter in ${f}`);
    assert.doesNotMatch(html, /\[Empfehlung/, `Empfehlung in ${f}`);
    assert.doesNotMatch(html, /CHE-123\.456\.789/, `fake UID in ${f}`);
    assert.doesNotMatch(html, /Musterstrasse/, `fake address in ${f}`);
    assert.doesNotMatch(html, /<!--\{\{/, `unfilled placeholder in ${f}`);
  }
  await rm(out, { recursive: true, force: true });
});

test('no page loads fonts from Google', async () => {
  const { out } = await buildToTmp();
  for (const f of ['index.html', 'impressum.html', 'agb.html', 'datenschutz.html', 'gastro/index.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.doesNotMatch(html, /fonts\.googleapis\.com/, `google fonts in ${f}`);
    assert.doesNotMatch(html, /fonts\.gstatic\.com/, `gstatic in ${f}`);
  }
  await rm(out, { recursive: true, force: true });
});

test('the local font stylesheet is shipped', async () => {
  const { out } = await buildToTmp({ copyStatic: true });
  const css = await readFile(join(out, 'css/fonts.css'), 'utf8');
  assert.match(css, /@font-face/);
  assert.match(css, /\/assets\/fonts\//);
  await rm(out, { recursive: true, force: true });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test test/build.test.mjs`
Expected: FAIL beim Google-Fonts-Test, solange die Templates noch `fonts.googleapis.com` enthalten

- [ ] **Step 6: Tests laufen lassen, grün bestätigen**

Nach den Änderungen aus Step 2 und 3:

Run: `node --test`
Expected: PASS, alle Tests

- [ ] **Step 7: Manuell prüfen**

```bash
node scripts/build.mjs && cd dist && python3 -m http.server 8078
```

Im Browser die Netzwerk-Registerkarte öffnen und die Startseite laden. Es darf keine
Anfrage an `fonts.googleapis.com` oder `fonts.gstatic.com` auftauchen. Die Schriften
müssen trotzdem korrekt aussehen: Überschriften in Cormorant Garamond, Fliesstext in Inter.

- [ ] **Step 8: Committen**

```bash
git add scripts/fetch-fonts.mjs css/fonts.css assets/fonts src test/build.test.mjs
git commit -m "feat(fonts): self-host webfonts and correct the privacy statement"
```

---

## Task 10: Deploy und Dokumentation

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `node scripts/build.mjs`
- Produces: nichts für andere Tasks

- [ ] **Step 1: Workflow anlegen**

`.github/workflows/deploy.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Run tests
        run: node --test
      - name: Build
        run: node scripts/build.mjs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Der Build läuft erst nach grünen Tests. Ungültige Daten stoppen das Deployment, statt eine kaputte Seite zu veröffentlichen.

- [ ] **Step 2: Workflow-Syntax prüfen**

Run: `node -e "const s=require('node:fs').readFileSync('.github/workflows/deploy.yml','utf8'); if(!/deploy-pages/.test(s)) process.exit(1); console.log('ok')"`
Expected: `ok`

Falls `gh` verfügbar ist, zusätzlich: `gh workflow list` nach dem Push.

- [ ] **Step 3: README ersetzen**

`README.md`:

```markdown
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
```

- [ ] **Step 4: Alles prüfen**

Run: `node --test && node scripts/build.mjs`
Expected: alle Tests grün, `built N pages into dist/`

- [ ] **Step 5: Committen**

```bash
git add .github README.md
git commit -m "ci: build and deploy to GitHub Pages, rewrite README"
```

---

## Nach dem Plan zu erledigen (nicht Teil der Tasks)

Diese Punkte brauchen Entscheidungen oder Zugänge ausserhalb des Codes:

1. **DNS für `riverside-lifestyle.com` setzen.** Die Domain ist bei INWX registriert, hat
   aber keinen A-Record. Ohne diesen Schritt ist die Seite nicht erreichbar. `.ch` per 301
   auf `.com` leiten.
2. **MWST-Status klären** und gegebenenfalls `holding.vat` setzen.
3. **`info@rlh.ag` auf den Live-Sites korrigieren.** Die Adresse steht im Impressum von
   riverside-beauty.ch und in `riverside-ink-redesign/lib/legal.ts`. Die Domain existiert
   nicht, Post kommt nirgends an. Eigener Task in den betroffenen Repos.
4. **Rolle der Riverside Ink. GmbH (CHE-485.564.193)** im Verbund klären und
   gegebenenfalls in `data/companies.json` ergänzen.
5. **AGB und Datenschutz** inhaltlich prüfen lassen. Der Build erzwingt nur, dass keine
   Platzhalter stehen bleiben, nicht dass die Texte juristisch tragen.
6. **Repo umbenennen.** `riverside-lifestyle-rot` heisst nach dem Farbwechsel irreführend.
