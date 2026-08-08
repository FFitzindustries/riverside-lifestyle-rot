import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brandHref, renderNavLinks, renderPanels, renderOpenLocations,
  renderBrandLocations, renderLocationsByPlace, panelsClass,
} from '../scripts/lib/fragments.mjs';

const content = {
  picker: {
    planned: 'in Vorbereitung', choose: 'Standort wählen →', allLocations: 'Alle Standorte',
    byPlace: 'Nach Ort', byBrand: 'Nach Marke', locationsTitle: 'Standorte',
    locationsIntro: 'Alle Standorte.', backToOverview: 'Zur Übersicht',
  },
};

const countries = [
  { code: 'ch', name: { de: 'Schweiz', en: 'Switzerland' }, order: 1 },
  { code: 'gb', name: { de: 'Vereinigtes Königreich', en: 'United Kingdom' }, order: 2 },
];

const data = {
  content,
  countries,
  brands: [
    {
      slug: 'ink', name: 'Riverside Ink', short: 'Ink',
      sub: 'Tattoo · Piercing', url: 'https://www.riverside-ink.ch',
      sites: { ch: 'https://www.riverside-ink.ch' },
      status: 'live', media: { video: 'ink.mp4', poster: 'ink.jpg' }, order: 1,
    },
    {
      slug: 'gastro', name: 'Riverside Gastro', short: 'Gastro',
      sub: 'Küche · Bar', url: '', sites: {},
      status: 'live', media: { video: 'gastro.mp4', poster: 'gastro.jpg' }, order: 2,
    },
    {
      slug: 'event', name: 'Riverside Event', short: 'Event',
      sub: 'Events', url: '', sites: {}, status: 'draft',
      media: { video: '', poster: '' }, order: 3,
    },
  ],
  locations: [
    {
      slug: 'st-margrethen', city: 'St. Margrethen', country: 'ch',
      address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1', url: '' }, { brand: 'gastro', companyId: 'c2', url: '' }],
    },
    {
      slug: 'london', city: 'London', country: 'gb',
      address: [], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3', url: '' }],
    },
  ],
};

test('brandHref points at the hub page, not at the brand site', () => {
  // The panel opens the picker now. Sending it straight to riverside-ink.ch
  // would skip the country choice, which is the whole point of the hub.
  assert.equal(brandHref(data.brands[0]), '/ink/');
  assert.equal(brandHref(data.brands[1]), '/gastro/');
});

test('renderNavLinks lists visible brands only', () => {
  const html = renderNavLinks(data);
  assert.match(html, /Ink<\/a>/);
  assert.match(html, /Gastro<\/a>/);
  assert.doesNotMatch(html, /Event/);
});

test('renderNavLinks keeps Kontakt out, that belongs to the template', () => {
  assert.doesNotMatch(renderNavLinks(data), /Kontakt/);
});

test('renderPanels renders one panel per visible brand', () => {
  const html = renderPanels(data);
  assert.equal(html.match(/class="panel"/g).length, 2);
});

test('renderPanels wires video, poster and brand marker', () => {
  const html = renderPanels(data);
  assert.match(html, /src="\/assets\/video\/ink\.mp4"/);
  assert.match(html, /poster="\/assets\/poster\/ink\.jpg"/);
  assert.match(html, /data-brand="ink"/);
});

test('renderPanels honours the language prefix and the asset base separately', () => {
  // The brand link follows the language, the media does not: there is one
  // copy of the assets, shared by both language trees.
  const html = renderPanels(data, '/base/en', '/base');
  assert.match(html, /href="\/base\/en\/ink\/"/);
  assert.match(html, /src="\/base\/assets\/video\/ink\.mp4"/);
});

test('a planned brand renders as a tile, never as a link', () => {
  const planned = {
    ...data,
    brands: [{
      slug: 'event', name: 'Riverside Event', short: 'Event', sub: 'Events',
      url: '', sites: {}, status: 'planned', media: { video: '', poster: '' }, order: 1,
    }],
  };
  const html = renderPanels(planned);
  assert.match(html, /panel--planned/);
  assert.doesNotMatch(html, /<a class="panel/, 'a brand with nowhere to go became a link');
  assert.match(html, /in Vorbereitung/);
});

test('renderPanels escapes brand text', () => {
  const evil = {
    content,
    countries,
    brands: [{
      slug: 'x', name: 'X', short: '<b>X</b>', sub: 'a & b', url: 'https://x.test',
      sites: {}, status: 'live', media: { video: 'x.mp4', poster: 'x.jpg' }, order: 1,
    }],
    locations: [],
  };
  const html = renderPanels(evil);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.match(html, /a &amp; b/);
});

test('renderOpenLocations shows open locations grouped by country', () => {
  const html = renderOpenLocations(data);
  assert.match(html, /Schweiz/);
  assert.match(html, /St\. Margrethen/);
});

test('renderOpenLocations hides planned locations', () => {
  assert.doesNotMatch(renderOpenLocations(data), /London/);
});

// Regression test for a review finding: the name map was built from all
// brands, so a draft brand assigned to an open location became publicly
// visible in the location list.
test('renderOpenLocations hides a draft brand sitting at an open location', () => {
  const withDraft = {
    ...data,
    locations: [{
      ...data.locations[0],
      brands: [
        { brand: 'ink', companyId: 'c1', url: '' },
        { brand: 'event', companyId: 'c4', url: '' },
      ],
    }],
  };
  const html = renderOpenLocations(withDraft);
  assert.match(html, /Riverside Ink/, 'the live brand disappeared too');
  assert.doesNotMatch(html, /Riverside Event/, 'a draft brand reached the public location list');
});

test('renderOpenLocations escapes city and address', () => {
  const evil = {
    content,
    countries: [{ code: 'ch', name: 'Schweiz & Liechtenstein', order: 1 }],
    brands: [{
      slug: 'ink', name: 'Riverside Ink', short: 'Ink', sub: 's', url: 'https://x.test',
      sites: {}, status: 'live', media: { video: 'v.mp4', poster: 'p.jpg' }, order: 1,
    }],
    locations: [{
      slug: 'x', city: '<b>Chur</b>', country: 'ch',
      address: ['Weg 1 & 2', '<i>7000</i> Chur'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1', url: '' }],
    }],
  };
  const html = renderOpenLocations(evil);

  assert.match(html, /&lt;b&gt;Chur&lt;\/b&gt;/, 'city was not escaped');
  assert.match(html, /Weg 1 &amp; 2/, 'address ampersand was not escaped');
  assert.match(html, /Schweiz &amp; Liechtenstein/, 'country name was not escaped');
  assert.doesNotMatch(html, /<b>|<i>/, 'raw markup from the data became real elements');
});

test('a planned city is never a link', () => {
  const html = renderBrandLocations(data, 'ink');
  assert.match(html, /London/);
  assert.doesNotMatch(html, /<a[^>]*>London/, 'a location that has not opened became clickable');
  assert.match(html, /loc-city--planned/);
});

test('an open city links to the brand site of its country', () => {
  const html = renderBrandLocations(data, 'ink');
  assert.match(html, /<a href="https:\/\/www\.riverside-ink\.ch">St\. Margrethen<\/a>/);
});

test('a location url wins over the country fallback', () => {
  const withUrl = {
    ...data,
    locations: [{
      ...data.locations[0],
      brands: [{ brand: 'ink', companyId: 'c1', url: 'https://www.riverside-ink.ch/standorte/stm/' }],
    }],
  };
  const html = renderBrandLocations(withUrl, 'ink');
  assert.match(html, /standorte\/stm/);
});

test('an open city without any target renders as text, not as an empty link', () => {
  // Gastro has no site for Switzerland, so there is nothing to link to. An
  // <a> with an empty href would reload the current page and look broken.
  const html = renderBrandLocations(data, 'gastro');
  assert.match(html, /St\. Margrethen/);
  assert.doesNotMatch(html, /href=""/);
});

test('a brand in a single country renders without country headings', () => {
  // Level skipping: a heading that never has a sibling is decoration.
  const html = renderBrandLocations(data, 'gastro');
  assert.doesNotMatch(html, /loc-country/);
  assert.match(html, /loc-cities/);
});

test('a brand in several countries keeps the country headings', () => {
  const html = renderBrandLocations(data, 'ink');
  assert.match(html, /loc-country/);
  assert.match(html, /Schweiz/);
  assert.match(html, /Vereinigtes Königreich/);
});

test('renderBrandLocations follows the requested language', () => {
  const html = renderBrandLocations(data, 'ink', 'en');
  assert.match(html, /United Kingdom/);
  assert.doesNotMatch(html, /Vereinigtes/);
});

test('the by-place view lists every location, planned ones marked', () => {
  const html = renderLocationsByPlace(data);
  assert.match(html, /St\. Margrethen/);
  assert.match(html, /London/);
  assert.match(html, /loc--planned/);
});

test('the by-place view never links a planned location', () => {
  // Checked inside the planned entry itself: asserting over the whole page
  // would pass on the open location's links and prove nothing.
  const html = renderLocationsByPlace(data);
  const entry = html.match(/<li class="loc loc--planned">[\s\S]*?<\/li>/)?.[0];
  assert.ok(entry, 'no planned entry rendered');
  assert.doesNotMatch(entry, /<a /, 'a location that has not opened became clickable');
  assert.match(entry, /in Vorbereitung/);
});

test('the by-place view names every brand at a location', () => {
  const html = renderLocationsByPlace(data);
  assert.match(html, /Riverside Ink/);
  assert.match(html, /Riverside Gastro/);
});

// Both sides of the threshold, so moving it from 5 to 4 cannot stay green.
const brandsFor = (live, draft = 0) => ({
  content,
  countries,
  brands: [
    ...Array.from({ length: live }, (_, i) => ({
      slug: `b${i}`, name: `B${i}`, short: `B${i}`, sub: 's', url: 'https://x.test',
      sites: {}, status: 'live', media: { video: 'v.mp4', poster: 'p.jpg' }, order: i,
    })),
    ...Array.from({ length: draft }, (_, i) => ({
      slug: `d${i}`, name: `D${i}`, short: `D${i}`, sub: 's', url: '',
      sites: {}, status: 'draft', media: { video: '', poster: '' }, order: 100 + i,
    })),
  ],
  locations: [],
});

test('two visible brands keep the column layout', () => {
  assert.equal(panelsClass(data), 'panels');
});

test('four visible brands still keep the column layout', () => {
  assert.equal(panelsClass(brandsFor(4)), 'panels');
});

test('a draft brand does not push the layout over the threshold', () => {
  assert.equal(panelsClass(brandsFor(4, 1)), 'panels');
});

test('five visible brands switch to the grid layout', () => {
  assert.equal(panelsClass(brandsFor(5)), 'panels panels--grid');
});
