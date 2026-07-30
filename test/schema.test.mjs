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
