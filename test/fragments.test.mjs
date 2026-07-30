import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandHref, renderNavLinks, renderPanels, renderLocationList, panelsClass } from '../scripts/lib/fragments.mjs';

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

// Regression test for a review finding: the name map was built from all
// brands, so a draft brand assigned to an open location became publicly
// visible in the location list even though it appears in no nav link, no
// panel and no JSON-LD node.
test('renderLocationList hides a draft brand sitting at an open location', () => {
  const withDraft = {
    ...data,
    locations: [{
      ...data.locations[0],
      brands: [
        { brand: 'ink', companyId: 'c1' },
        { brand: 'event', companyId: 'c4' },
      ],
    }],
  };
  const html = renderLocationList(withDraft);
  assert.match(html, /Riverside Ink/, 'the live brand disappeared too');
  assert.doesNotMatch(html, /Riverside Event/, 'a draft brand reached the public location list');
});

// Escaping used to be covered for brand names only, so removing it from the
// city and the address lines stayed green. Location data is edited by hand
// for every new opening, which makes it exactly as likely to carry an
// ampersand as anything else.
test('renderLocationList escapes city, address and country name', () => {
  const evil = {
    brands: [{
      slug: 'ink', name: 'Riverside Ink', short: 'Ink', sub: 's', url: 'https://x.test',
      status: 'live', media: { video: 'v.mp4', poster: 'p.jpg' }, order: 1,
    }],
    locations: [{
      slug: 'x', city: '<b>Chur</b>', country: 'CH', countryName: 'Schweiz & Liechtenstein',
      address: ['Weg 1 & 2', '<i>7000</i> Chur'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }],
    }],
  };
  const html = renderLocationList(evil);

  assert.match(html, /&lt;b&gt;Chur&lt;\/b&gt;/, 'city was not escaped');
  assert.match(html, /Weg 1 &amp; 2/, 'address ampersand was not escaped');
  assert.match(html, /&lt;i&gt;7000&lt;\/i&gt; Chur/, 'address markup was not escaped');
  assert.match(html, /Schweiz &amp; Liechtenstein/, 'country name was not escaped');

  assert.doesNotMatch(html, /<b>|<i>/, 'raw markup from the data became real elements');
});

// Both sides of the threshold, so moving it from 5 to 4 cannot stay green.
// The four-brand case carries a draft brand on top, which also pins that the
// threshold counts live brands rather than all of them.
const brandsFor = (live, draft = 0) => ({
  brands: [
    ...Array.from({ length: live }, (_, i) => ({
      slug: `b${i}`, name: `B${i}`, short: `B${i}`, sub: 's', url: 'https://x.test',
      status: 'live', media: { video: 'v.mp4', poster: 'p.jpg' }, order: i,
    })),
    ...Array.from({ length: draft }, (_, i) => ({
      slug: `d${i}`, name: `D${i}`, short: `D${i}`, sub: 's', url: '',
      status: 'draft', media: { video: '', poster: '' }, order: 100 + i,
    })),
  ],
  locations: [],
});

test('two live brands keep the column layout', () => {
  assert.equal(panelsClass(data), 'panels');
});

test('four live brands still keep the column layout', () => {
  assert.equal(panelsClass(brandsFor(4)), 'panels');
});

test('a draft brand does not push the layout over the threshold', () => {
  assert.equal(panelsClass(brandsFor(4, 1)), 'panels');
});

test('five live brands switch to the grid layout', () => {
  assert.equal(panelsClass(brandsFor(5)), 'panels panels--grid');
});
