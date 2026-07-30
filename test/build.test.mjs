import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, countUnfinished } from '../scripts/build.mjs';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const xml = await readFile(join(out, 'sitemap.xml'), 'utf8');
  assert.match(xml, /https:\/\/riverside-lifestyle\.com\//);
  assert.match(xml, /impressum\.html/);
  await rm(out, { recursive: true, force: true });
});

test('sitemap shortens every index.html page to its directory URL', async () => {
  const { out } = await buildToTmp();
  const xml = await readFile(join(out, 'sitemap.xml'), 'utf8');
  assert.match(xml, /<loc>https:\/\/riverside-lifestyle\.com\/gastro\/<\/loc>/);
  assert.doesNotMatch(xml, /gastro\/index\.html/);
  await rm(out, { recursive: true, force: true });
});

test('content text is escaped but intentional markup fields still render as real elements', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.doesNotMatch(title, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'raw & in <title>');
  assert.match(html, /<em>Lifestyle<\/em>/, 'hero headline lost its real <em> element');
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
