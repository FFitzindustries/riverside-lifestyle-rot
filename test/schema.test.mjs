import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonLd } from '../scripts/lib/schema.mjs';
import { loadData, liveBrands } from '../scripts/lib/data.mjs';

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
  assert.equal(graph.length, liveBrands(data).length + 1);
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

// Derived, not a magic number: adding a fourth brand to data/brands.json
// must not require editing this test — that would contradict the whole point
// of the data-driven build.
test('the real data produces a graph without draft entries', async () => {
  const real = await loadData('data');
  const graph = JSON.parse(buildJsonLd(real))['@graph'];
  assert.equal(graph.length, liveBrands(real).length + 1);
  for (const brand of real.brands.filter((b) => b.status !== 'live')) {
    assert.ok(
      !graph.some((n) => n.name === brand.name),
      `draft brand ${brand.name} reached the graph`,
    );
  }
});

// The site is planned for 13 countries. The brand address used to be the only
// place where the country came out of the data at all, and a mutation that
// hardcoded 'CH' there stayed green because every fixture location was Swiss.
test('a brand address takes its country from the location, not a fixed CH', () => {
  const abroad = {
    ...data,
    locations: [{
      slug: 'wien', city: 'Wien', country: 'AT', countryName: 'Österreich',
      address: ['Kärntner Strasse 1', '1010 Wien'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }],
    }],
  };
  const ink = JSON.parse(buildJsonLd(abroad))['@graph'].find((n) => n.name === 'Riverside Ink');
  assert.equal(ink.address.addressCountry, 'AT');
  assert.equal(ink.address.addressLocality, 'Wien');
});

// Dropping the status filter on the brand address stayed green because the
// open location happened to come first in the fixture. Here the planned one
// comes first, so the filter is the only thing that can produce the right
// answer.
test('a planned location never becomes the brand address', () => {
  const plannedFirst = {
    ...data,
    locations: [
      {
        slug: 'london', city: 'London', country: 'GB', countryName: 'Vereinigtes Königreich',
        address: ['X 1', 'London'], status: 'planned',
        brands: [{ brand: 'ink', companyId: 'c3' }],
      },
      {
        slug: 'st-margrethen', city: 'St. Margrethen', country: 'CH', countryName: 'Schweiz',
        address: ['Grenzstrasse 25', '9430 St. Margrethen'], status: 'open',
        brands: [{ brand: 'ink', companyId: 'c1' }],
      },
    ],
  };
  const json = buildJsonLd(plannedFirst);
  const ink = JSON.parse(json)['@graph'].find((n) => n.name === 'Riverside Ink');
  assert.equal(ink.address.addressLocality, 'St. Margrethen');
  assert.equal(ink.address.addressCountry, 'CH');
  assert.doesNotMatch(json, /London/, 'a planned location leaked into the graph');
});

// A brand whose only location is still planned must carry no address at all
// rather than advertising a place that does not exist yet.
test('a brand with only planned locations gets no address', () => {
  const onlyPlanned = {
    ...data,
    locations: [{
      slug: 'london', city: 'London', country: 'GB', countryName: 'Vereinigtes Königreich',
      address: ['X 1', 'London'], status: 'planned',
      brands: [{ brand: 'ink', companyId: 'c3' }],
    }],
  };
  const ink = JSON.parse(buildJsonLd(onlyPlanned))['@graph'].find((n) => n.name === 'Riverside Ink');
  assert.equal(ink.address, undefined);
});
