import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, countUnfinished, escapeForScriptBlock } from '../scripts/build.mjs';
import { loadData, liveBrands } from '../scripts/lib/data.mjs';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A throwaway copy of data/ with one file rewritten. Cheaper to keep honest
// than a fourth full fixture directory: it follows every structural change to
// the real data automatically.
async function patchedDataDir(file, patch) {
  const dir = await mkdtemp(join(tmpdir(), 'rl-data-'));
  await cp('data', dir, { recursive: true });
  const path = join(dir, file);
  const json = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify(patch(json), null, 2), 'utf8');
  return dir;
}

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

// Derived from the data, not pinned to a number: adding a fourth brand to
// data/brands.json must not force an edit here, or the test contradicts the
// point of the data-driven build.
test('the built index contains one hero tile per live brand', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const data = await loadData('data');
  // The hero ships in two shapes — the portal room and the panel row — and
  // which one renders depends on the data. Either way there is exactly one
  // tile per live brand, and that is what this guards.
  assert.equal(html.match(/class="(?:panel|zone)"/g).length, liveBrands(data).length);
  for (const brand of data.brands.filter((b) => b.status === 'draft')) {
    assert.doesNotMatch(html, new RegExp(`data-brand="${escapeRe(brand.slug)}"`),
      `draft brand ${brand.slug} got a tile`);
  }
  await rm(out, { recursive: true, force: true });
});

// A planned brand is announced, not sold. It appears so the expansion is
// visible, but as a tile rather than a link, because there is no page behind
// it yet and a dead link reads as a broken site.
//
// Driven by a patched copy of the real data: whether a planned brand happens
// to exist today is a business decision, while the rule it exercises is not.
test('a planned brand appears as a tile without a link', async () => {
  const dataDir = await patchedDataDir('brands.json', (brands) => [
    ...brands,
    {
      slug: 'event', name: 'Riverside Event', short: 'Event', sub: 'Events',
      url: '', sites: {}, status: 'planned', schemaType: 'Organization',
      description: 'Eventformate im Riverside-Verbund.',
      media: { video: '', poster: '' }, order: 9,
    },
  ]);
  const { out } = await buildToTmp({ dataDir });
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /data-brand="event"/, 'the planned brand is missing entirely');
  assert.match(html, /panel--planned/);
  assert.doesNotMatch(html, /<a class="panel[^"]*" href="\/event\/"/, 'the planned brand became a link');
  await rm(out, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

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
  // Relative, not root-absolute: under a GitHub Pages project path a root
  // path resolves to the account root and the fonts 404 without any visible
  // error beyond a fallback typeface.
  assert.match(css, /url\(\.\.\/assets\/fonts\//);
  assert.doesNotMatch(css, /url\(\/assets\/fonts\//);
  await rm(out, { recursive: true, force: true });
});

// countUnfinished has two independent branches. Every placeholder in the
// templates today is a class="todo" span, so the bracket branch — which was
// itself the fix for an earlier gap, a placeholder that forgot the class —
// was covered by nothing and could be deleted without a test noticing.
test('countUnfinished counts class="todo" spans', () => {
  assert.equal(countUnfinished('<p>Frist: <span class="todo">wird ergänzt</span></p>'), 1);
});

test('countUnfinished also counts a bracket placeholder that forgot the class', () => {
  assert.equal(countUnfinished('<p>Gerichtsstand ist [Ort noch offen].</p>'), 1);
});

test('countUnfinished counts both kinds in the same page exactly once each', () => {
  const html = '<p><span class="todo">[offen]</span> und [noch ein offener Punkt].</p>';
  assert.equal(countUnfinished(html), 2);
});

test('countUnfinished leaves finished markup alone', () => {
  assert.equal(countUnfinished('<p>Gerichtsstand ist St. Gallen.</p>'), 0);
});

// Generic, not a literal string list: catches class="todo" markers and any
// "[free text]" bracket placeholder, so a forgotten class does not slip
// through. These three pages must always be fully resolved.
test('index, impressum and the gastro hub page carry no open legal placeholders', async () => {
  const { out } = await buildToTmp();
  for (const f of ['index.html', 'impressum.html', 'gastro/index.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.equal(countUnfinished(html), 0, `${f} still has an unresolved legal placeholder`);
  }
  await rm(out, { recursive: true, force: true });
});

// AGB and Datenschutz still contain real open business decisions that only
// the client can supply (deposit amount, court of jurisdiction, hosting
// provider and retention period, ...) — see task-9-report.md for the full
// list. This pins the exact, currently known count instead of tolerating an
// unbounded number of them: it turns red the moment someone adds a new
// unresolved placeholder, and it turns red the moment someone resolves one,
// which forces a deliberate update of the number below rather than a silent
// drift in either direction.
test('agb and datenschutz document exactly their known open legal placeholders', async () => {
  const { out } = await buildToTmp();
  const agb = await readFile(join(out, 'agb.html'), 'utf8');
  const datenschutz = await readFile(join(out, 'datenschutz.html'), 'utf8');
  assert.equal(countUnfinished(agb), 6, 'agb.html open-placeholder count changed — update this test deliberately');
  // Datenschutz went from two to one: the "add Google Analytics here later"
  // note was an instruction to the operator, not an open business decision,
  // and was dropped rather than resolved. What remains is the hosting
  // provider plus its log retention period.
  assert.equal(
    countUnfinished(datenschutz),
    1,
    'datenschutz.html open-placeholder count changed — update this test deliberately',
  );
  await rm(out, { recursive: true, force: true });
});

// The controller section used to repeat the holding address as a literal,
// so a move would have updated the impressum and left the privacy statement
// naming the old seat. Both must now come from holding.json.
test('the privacy statement names the controller from holding.json', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'datenschutz.html'), 'utf8');
  const holding = JSON.parse(await readFile('data/holding.json', 'utf8'));
  const controller = html.match(/<h2>1\. Verantwortliche Stelle<\/h2>\s*<p>([\s\S]*?)<\/p>/)[1];
  assert.match(controller, new RegExp(escapeRe(holding.name)));
  for (const line of holding.address) {
    assert.match(controller, new RegExp(escapeRe(line)), `address line "${line}" missing`);
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
  const data = await loadData('data');
  const xml = await readFile(join(out, 'sitemap.xml'), 'utf8');
  // Taken from the data, not hardcoded: moving the site to another domain is
  // a one-line data change and must not turn this test red for the wrong
  // reason.
  assert.match(xml, new RegExp(escapeRe(`${data.holding.url.replace(/\/$/, '')}/`)));
  assert.match(xml, /impressum\.html/);
  await rm(out, { recursive: true, force: true });
});

test('sitemap shortens every index.html page to its directory URL', async () => {
  const { out } = await buildToTmp();
  const xml = await readFile(join(out, 'sitemap.xml'), 'utf8');
  const base = (await loadData('data')).holding.url.replace(/\/$/, '');
  assert.match(xml, new RegExp(escapeRe(`<loc>${base}/gastro/</loc>`)));
  assert.doesNotMatch(xml, /gastro\/index\.html/);
  await rm(out, { recursive: true, force: true });
});

test('content text is escaped but intentional markup fields still render as real elements', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.doesNotMatch(title, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'raw & in <title>');
  assert.match(html, /<h1>[^<]*<em>[^<]+<\/em>/, 'hero headline lost its real <em> element');
  await rm(out, { recursive: true, force: true });
});

test('a brand without its own domain gets a hub page', async () => {
  const { out, result } = await buildToTmp();
  assert.ok(result.written.includes('gastro/index.html'));
  const html = await readFile(join(out, 'gastro/index.html'), 'utf8');
  assert.match(html, /Riverside Gastro/);
  assert.match(html, /Grenzstrasse 25/);
  await rm(out, { recursive: true, force: true });
});

// Every brand with locations gets a hub page now, including the ones that own
// a domain. The hub page is the only place that lists all countries; the
// brand's own site only ever covers one of them.
test('a brand with its own domain still gets a hub page', async () => {
  const { result } = await buildToTmp();
  assert.ok(result.written.includes('ink/index.html'));
  assert.ok(result.written.includes('beauty/index.html'));
});

test('every panel points at a hub page, never straight at a brand domain', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /href="\/gastro\/" data-brand="gastro"/);
  assert.match(html, /href="\/ink\/" data-brand="ink"/);
  assert.doesNotMatch(html, /<a class="panel[^"]*" href="https:/,
    'a panel skipped the country choice and linked straight to a brand site');
  await rm(out, { recursive: true, force: true });
});

test('both languages are built, legal pages only in German', async () => {
  const { result } = await buildToTmp();
  for (const page of ['index.html', 'ink/index.html', 'standorte/index.html',
    'en/index.html', 'en/ink/index.html', 'en/locations/index.html']) {
    assert.ok(result.written.includes(page), `${page} was not built`);
  }
  // Terms, impressum and privacy are binding texts under Swiss law. An
  // unreviewed translation would be worse than a German original.
  assert.ok(!result.written.some((p) => p.startsWith('en/') && p.endsWith('.html') && !p.endsWith('index.html')));
});

test('each page points hreflang at its own counterpart, not at the home page', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'ink/index.html'), 'utf8');
  assert.match(html, /hreflang="en" href="[^"]*\/en\/ink\/"/);
  assert.match(html, /hreflang="de" href="[^"]*\/ink\/"/);
  await rm(out, { recursive: true, force: true });
});

test('draft brands get no page at all', async () => {
  const { result } = await buildToTmp();
  assert.ok(!result.written.includes('event/index.html'));
});

// Regression test for a review finding: the hub-page loop once passed brand
// name, description and shared content titles into the template unescaped.
// This fixture brand carries an "&" in its name and a quote in its
// description, both of which break HTML (an unescaped quote inside the
// content="..." attribute) if escaping regresses.
test('a hub page escapes brand text, including inside the meta description attribute', async () => {
  const { out, result } = await buildToTmp({ dataDir: 'test/fixtures/special-chars' });
  assert.ok(result.written.includes('gastro/index.html'));
  const html = await readFile(join(out, 'gastro/index.html'), 'utf8');

  assert.match(html, /Riverside Gastro &amp; Bar/, 'brand name lost its escaped ampersand');
  assert.doesNotMatch(html, /Riverside Gastro & Bar/, 'raw & leaked into the page');

  const metaTag = html.match(/<meta name="description" content="([\s\S]*?)">/)[1];
  assert.doesNotMatch(metaTag, /"/, 'unescaped quote broke out of the content attribute');
  assert.match(metaTag, /&quot;Hausgemacht&quot;/, 'description quotes were not escaped');

  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.doesNotMatch(title, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'raw & in brand page <title>');

  await rm(out, { recursive: true, force: true });
});

// Regression test for a review finding: JSON.stringify does not escape "<",
// and the content of a <script> block is raw text the parser scans only for
// a closing tag. A brand name carrying "</script>" therefore used to close
// the JSON-LD block early and turn the rest of the JSON into HTML. The data
// comes from this repository, but it was the last unescaped injection point.
test('a "</script>" in a brand name cannot break out of the JSON-LD block', async () => {
  const marker = '</script><img src=x onerror=alert(1)>';
  const dataDir = await patchedDataDir('brands.json', (brands) =>
    brands.map((b) => (b.slug === 'gastro' ? { ...b, name: `Riverside Gastro ${marker}` } : b)));
  const { out } = await buildToTmp({ dataDir });
  const html = await readFile(join(out, 'index.html'), 'utf8');

  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'the JSON-LD block lost its closing tag');

  // The block must still parse as one whole JSON document, and the name must
  // survive round-trip unchanged — an HTML entity would corrupt it instead.
  const graph = JSON.parse(block[1])['@graph'];
  const gastro = graph.find((n) => n.name.startsWith('Riverside Gastro'));
  assert.equal(gastro.name, `Riverside Gastro ${marker}`);

  // Nothing from the payload may reach the document as real markup.
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/, 'the payload became live markup');
  assert.equal(html.match(/<script type="application\/ld\+json">/g).length, 1);

  await rm(out, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

// The special-chars fixture used to be driven against the brand page only,
// so the start page's own meta description — a different code path, fed from
// content.de.json instead of the brand record — was never checked. An
// unescaped quote there breaks out of the content="..." attribute.
test('the start page escapes its meta description inside the content attribute', async () => {
  const { out } = await buildToTmp({ dataDir: 'test/fixtures/special-chars' });
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const content = html.match(/<meta name="description" content="([\s\S]*?)">/)[1];

  assert.doesNotMatch(content, /"/, 'an unescaped quote broke out of the content attribute');
  assert.match(content, /&quot;Lifestyle House&quot;/, 'quotes in the description were not escaped');
  assert.match(content, /Beauty &amp; Gastro/, 'the ampersand was not escaped');
  assert.doesNotMatch(content, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'a raw & survived into the attribute');

  await rm(out, { recursive: true, force: true });
});

test('escapeForScriptBlock leaves the parsed value untouched', () => {
  const json = JSON.stringify({ name: 'a < b </script>' });
  const escaped = escapeForScriptBlock(json);
  assert.doesNotMatch(escaped, /</, 'a raw < survived');
  assert.equal(JSON.parse(escaped).name, 'a < b </script>');
});

// Relative media paths resolved against the current directory, so the English
// home page asked for /en/assets/video/ink.mp4 and got a 404 while the German
// one worked. Nothing in the markup looked wrong, the videos just never played.
test('hero media is addressed from the site root, not relative to the page', async () => {
  const { out } = await buildToTmp();
  for (const page of ['index.html', 'en/index.html']) {
    const html = await readFile(join(out, page), 'utf8');
    assert.doesNotMatch(html, /src="assets\//, `relative media path in ${page}`);
    assert.doesNotMatch(html, /poster="assets\//, `relative poster path in ${page}`);
    // Panel row serves video, portal serves stills; both must be root-relative.
    assert.match(html, /src="\/assets\/(?:video|hero)\//, `no root-relative media path in ${page}`);
  }
  await rm(out, { recursive: true, force: true });
});

test('the english nav stays in the english tree', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'en/index.html'), 'utf8');
  assert.match(html, /href="\/en\/ink\/"/);
  assert.doesNotMatch(html, /<a href="\/ink\/"/, 'an english page linked into the german tree');
  await rm(out, { recursive: true, force: true });
});

// A brand with no locations gets no page, so linking it would produce a 404
// that only shows up when someone clicks it.
test('a brand without locations is never linked in the nav', async () => {
  const dataDir = await patchedDataDir('brands.json', (brands) => [
    ...brands,
    {
      slug: 'orphan', name: 'Riverside Orphan', short: 'Orphan', sub: 'x',
      url: '', sites: {}, status: 'live', schemaType: 'Organization',
      description: 'Marke ohne Standort.',
      media: { video: 'v.mp4', poster: 'p.jpg' }, order: 9,
    },
  ]);
  const { out, result } = await buildToTmp({ dataDir });
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.ok(!result.written.includes('orphan/index.html'), 'a brand without locations got a page');
  assert.doesNotMatch(html, /<a href="\/orphan\/"/, 'a brand without a page is linked in the nav');
  await rm(out, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

// Die Portal-Ansicht klebt am Raumbild: drei gemalte Tafeln, drei Marken. Für
// eine vierte gäbe es kein Schild, und eine Marke ohne Platz im Bild wäre
// schlimmer als der Verzicht auf den Effekt. Also fällt der Hero dann auf die
// Panel-Reihe zurück, die mit jeder Markenzahl umgeht.
test('the portal hero renders for the real data', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /class="hero hero--portal"/, 'hero did not switch to the portal');
  assert.match(html, /class="portal__scene"/);
  assert.equal(html.match(/class="zone"/g).length, 3);
  assert.doesNotMatch(html, /class="panel"/, 'both hero shapes rendered at once');
  await rm(out, { recursive: true, force: true });
});

test('a brand the room picture has no sign for sends the hero back to the panel row', async () => {
  const dataDir = await patchedDataDir('brands.json', (brands) => [
    ...brands,
    {
      slug: 'event', name: 'Riverside Event', short: 'Event', sub: 'Events',
      url: '', sites: {}, status: 'planned', schemaType: 'Organization',
      description: 'Eventformate im Riverside-Verbund.',
      media: { video: '', poster: '' }, order: 9,
    },
  ]);
  const { out } = await buildToTmp({ dataDir });
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.match(html, /class="hero hero--panels"/, 'the portal kept rendering without a sign for every brand');
  assert.match(html, /class="panel"/);
  assert.doesNotMatch(html, /class="zone"/);
  assert.match(html, /data-brand="event"/, 'the fourth brand vanished instead of getting a panel');
  await rm(out, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});
