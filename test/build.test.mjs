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

test('content text is escaped but intentional markup fields still render as real elements', async () => {
  const { out } = await buildToTmp();
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.doesNotMatch(title, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'raw & in <title>');
  assert.match(html, /<em>Lifestyle<\/em>/, 'hero headline lost its real <em> element');
  await rm(out, { recursive: true, force: true });
});
