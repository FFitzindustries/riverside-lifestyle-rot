import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadData, validate, warnings, liveBrands, visibleBrands, companyById,
  localized, countriesForBrand, locationHref, unconfirmedLocations,
} from '../scripts/lib/data.mjs';

test('loadData reads every data file', async () => {
  const data = await loadData('data');
  assert.equal(data.holding.uid, 'CHE-405.114.788');
  assert.ok(Array.isArray(data.brands));
  assert.ok(Array.isArray(data.locations));
  assert.ok(Array.isArray(data.companies));
  assert.ok(Array.isArray(data.countries));
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
    countries: [{ code: 'ch', name: 'CH', order: 1 }],
    companies: [{ id: 'ink-stma' }],
    locations: [{
      slug: 'x', city: 'X', country: 'ch', status: 'open', address: ['a'],
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
    countries: [{ code: 'ch', name: 'CH', order: 1 }],
    companies: [{ id: 'c1' }],
    locations: [{
      slug: 'x', city: 'X', country: 'ch', status: 'open', address: ['a'],
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

test('the real event brand is planned: announced but not sold', async () => {
  const data = await loadData('data');
  assert.ok(!liveBrands(data).some((b) => b.slug === 'event'));
  assert.ok(visibleBrands(data).some((b) => b.slug === 'event'));
});
