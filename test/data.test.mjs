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

// The three brand states are a rule of the build, not a property of today's
// data: live is sold, planned is announced, draft is invisible. Pinned to a
// fixture so merging or launching a brand cannot quietly delete the coverage.
test('visibleBrands shows live and planned, liveBrands only live', () => {
  const data = { brands: [
    { slug: 'a', status: 'live', order: 1 },
    { slug: 'b', status: 'planned', order: 2 },
    { slug: 'c', status: 'draft', order: 3 },
  ] };
  assert.deepEqual(liveBrands(data).map((b) => b.slug), ['a']);
  assert.deepEqual(visibleBrands(data).map((b) => b.slug), ['a', 'b']);
});
