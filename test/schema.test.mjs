import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonLd } from '../scripts/lib/schema.mjs';
import { loadData, liveBrands, openLocations } from '../scripts/lib/data.mjs';

const data = {
  holding: {
    name: 'Riverside Lifestyle Holding AG',
    url: 'https://riverside-lifestyle.com',
    address: ['Grenzstrasse 25', '9430 St. Margrethen', 'Schweiz'],
    mail: 'info@riverside-lifestyle.ch',
    phone: '+41 79 901 81 81',
    social: { facebook: 'https://facebook.test/x' },
  },
  countries: [
    { code: 'ch', name: 'Schweiz', order: 1 },
    { code: 'gb', name: 'Vereinigtes Königreich', order: 2 },
    { code: 'at', name: 'Österreich', order: 3 },
  ],
  brands: [
    { slug: 'ink', name: 'Riverside Ink', url: 'https://www.riverside-ink.ch',
      sites: { ch: 'https://www.riverside-ink.ch' },
      status: 'live', schemaType: 'TattooParlor', description: 'Tattoo.', order: 1 },
    { slug: 'gastro', name: 'Riverside Gastro', url: '', sites: {},
      status: 'live', schemaType: 'Restaurant', description: 'Küche.', order: 2 },
    { slug: 'event', name: 'Riverside Event', url: '', sites: {},
      status: 'draft', schemaType: 'Organization', description: 'Events.', order: 3 },
  ],
  locations: [
    { slug: 'st-margrethen', city: 'St. Margrethen', country: 'ch',
      address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1', url: '' }, { brand: 'gastro', companyId: 'c2', url: '' }] },
    { slug: 'london', city: 'London', country: 'gb',
      address: [], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3', url: '' }] },
  ],
  companies: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
  content: {},
};

const graphOf = (d) => JSON.parse(buildJsonLd(d))['@graph'];
const nodeNamed = (d, name) => graphOf(d).find((n) => n.name === name);

test('buildJsonLd produces valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(buildJsonLd(data)));
});

test('the graph holds the organisation, the brands and one node per open place', () => {
  // Derived from the data, so adding a brand or a location cannot leave this
  // test asserting a stale number.
  const places = openLocations(data)
    .flatMap((l) => l.brands.filter((e) => liveBrands(data).some((b) => b.slug === e.brand)));
  assert.equal(graphOf(data).length, 1 + liveBrands(data).length + places.length);
  assert.equal(graphOf(data)[0]['@type'], 'Organization');
});

test('draft brands never reach the graph', () => {
  assert.doesNotMatch(buildJsonLd(data), /Riverside Event/);
});

test('brands use their configured schema type', () => {
  assert.equal(nodeNamed(data, 'Riverside Ink')['@type'], 'TattooParlor');
  assert.equal(nodeNamed(data, 'Riverside Gastro')['@type'], 'Restaurant');
});

test('subOrganization links every live brand to the organisation', () => {
  assert.deepEqual(graphOf(data)[0].subOrganization, [
    { '@id': 'https://riverside-lifestyle.com/#ink' },
    { '@id': 'https://riverside-lifestyle.com/#gastro' },
  ]);
});

test('areaServed comes from open locations, not from planned ones', () => {
  assert.deepEqual(graphOf(data)[0].areaServed, ['St. Margrethen']);
});

test('every brand node points at its hub page', () => {
  // The hub page is the canonical entry for a brand now: it is the only page
  // that lists all countries. The brand's own site stays in sameAs.
  assert.equal(nodeNamed(data, 'Riverside Ink').url, 'https://riverside-lifestyle.com/ink/');
  assert.deepEqual(nodeNamed(data, 'Riverside Ink').sameAs, ['https://www.riverside-ink.ch']);
  assert.equal(nodeNamed(data, 'Riverside Gastro').url, 'https://riverside-lifestyle.com/gastro/');
});

// Regression test for the follow-up finding: the brand node used to carry the
// address of whichever open location happened to come first, so a brand
// running in two cities existed in only one of them for anything reading the
// graph.
test('each open location of a brand becomes its own LocalBusiness node', () => {
  const twoCities = {
    ...data,
    locations: [
      data.locations[0],
      { slug: 'st-gallen', city: 'St. Gallen', country: 'ch',
        address: ['Spisergasse 14', '9000 St. Gallen'], status: 'open',
        brands: [{ brand: 'ink', companyId: 'c1', url: '' }] },
    ],
  };
  const graph = graphOf(twoCities);
  const places = graph.filter((n) => n['@type'] === 'LocalBusiness' && n.name.startsWith('Riverside Ink'));
  assert.deepEqual(places.map((p) => p.address.addressLocality).sort(), ['St. Gallen', 'St. Margrethen']);

  const ink = graph.find((n) => n['@id'].endsWith('#ink'));
  assert.equal(ink.location.length, 2, 'the brand node does not reference both places');
  assert.equal(ink.address, undefined, 'the brand node still carries a single address');
});

test('the organisation exposes contact details and social profile', () => {
  const org = graphOf(data)[0];
  assert.equal(org.email, 'info@riverside-lifestyle.ch');
  assert.equal(org.telephone, '+41 79 901 81 81');
  assert.deepEqual(org.sameAs, ['https://facebook.test/x']);
});

test('the real data produces a graph without draft entries', async () => {
  const real = await loadData('data');
  const graph = JSON.parse(buildJsonLd(real))['@graph'];
  for (const brand of real.brands.filter((b) => b.status !== 'live')) {
    assert.ok(
      !graph.some((n) => n.name === brand.name),
      `brand ${brand.name} reached the graph although it is not live`,
    );
  }
});

// The site is planned for twelve countries. The address country used to be the
// only place where it came out of the data at all, and a mutation that
// hardcoded 'CH' stayed green because every fixture location was Swiss.
test('a location node takes its country from the data, not a fixed CH', () => {
  const abroad = {
    ...data,
    locations: [{
      slug: 'wien', city: 'Wien', country: 'at',
      address: ['Kärntner Strasse 1', '1010 Wien'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1', url: '' }],
    }],
  };
  const place = graphOf(abroad).find((n) => n['@type'] === 'LocalBusiness');
  assert.equal(place.address.addressCountry, 'AT');
  assert.equal(place.address.addressLocality, 'Wien');
});

// Dropping the status filter stayed green when the open location happened to
// come first. Here the planned one comes first, so the filter is the only
// thing that can produce the right answer.
test('a planned location never reaches the graph', () => {
  const plannedFirst = {
    ...data,
    locations: [
      { slug: 'london', city: 'London', country: 'gb', address: [], status: 'planned',
        brands: [{ brand: 'ink', companyId: 'c3', url: '' }] },
      { slug: 'st-margrethen', city: 'St. Margrethen', country: 'ch',
        address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
        brands: [{ brand: 'ink', companyId: 'c1', url: '' }] },
    ],
  };
  const json = buildJsonLd(plannedFirst);
  const place = JSON.parse(json)['@graph'].find((n) => n['@type'] === 'LocalBusiness');
  assert.equal(place.address.addressLocality, 'St. Margrethen');
  assert.doesNotMatch(json, /London/, 'a planned location leaked into the graph');
});

// A brand whose only location is planned must claim no address at all rather
// than advertising a place that does not exist yet.
test('a brand with only planned locations gets no place node and no location link', () => {
  const onlyPlanned = {
    ...data,
    locations: [{
      slug: 'london', city: 'London', country: 'gb', address: [], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3', url: '' }],
    }],
  };
  const graph = graphOf(onlyPlanned);
  const ink = graph.find((n) => n['@id'].endsWith('#ink'));
  assert.equal(ink.address, undefined);
  assert.equal(ink.location, undefined);
  assert.ok(!graph.some((n) => n['@type'] === 'LocalBusiness'));
});
