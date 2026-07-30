import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from '../scripts/lib/legal.mjs';
import { loadData } from '../scripts/lib/data.mjs';

const base = {
  holding: {
    name: 'Riverside Lifestyle Holding AG',
    legalForm: 'Aktiengesellschaft',
    address: ['Grenzstrasse 25', '9430 St. Margrethen', 'Schweiz'],
    uid: 'CHE-405.114.788',
    hrNumber: 'CH-320.3.091.625-0',
    register: 'Handelsregisteramt des Kantons St. Gallen',
    registeredSince: 'SHAB Nr. 108 vom 08.06.2021',
    shareCapital: "CHF 100'000",
    purpose: 'Beteiligungen.',
    board: [{ name: 'Janine Maria Fitz', role: 'Verwaltungsrätin', signature: 'Einzelunterschrift' }],
    vat: null,
    mail: 'info@riverside-lifestyle.ch',
    phone: '+41 79 901 81 81',
    url: 'https://riverside-lifestyle.com',
    social: {},
  },
  companies: [
    { id: 'c1', name: 'A GmbH', uid: 'CHE-111.111.111', hrNumber: 'CH-1',
      address: ['Weg 1', '9430 Ort', 'Schweiz'], register: 'HR SG', mail: 'a@test.ch', phone: '' },
    { id: 'c2', name: 'B GmbH', uid: 'CHE-222.222.222', hrNumber: '',
      address: ['Weg 2', '9000 Ort', 'Schweiz'], register: 'HR SG', mail: 'b@test.ch', phone: '' },
  ],
  brands: [
    { slug: 'ink', name: 'Riverside Ink', status: 'live', order: 1 },
    { slug: 'gastro', name: 'Riverside Gastro', status: 'live', order: 2 },
  ],
  locations: [
    { slug: 'l1', city: 'Ort', country: 'CH', countryName: 'Schweiz',
      address: ['Weg 1', '9430 Ort'], status: 'open',
      brands: [{ brand: 'ink', companyId: 'c1' }, { brand: 'gastro', companyId: 'c2' }] },
  ],
  content: {},
};

test('the holding block carries name, UID and register', () => {
  const html = renderHoldingBlock(base);
  assert.match(html, /Riverside Lifestyle Holding AG/);
  assert.match(html, /CHE-405\.114\.788/);
  assert.match(html, /Handelsregisteramt des Kantons St\. Gallen/);
});

test('the holding block lists the board with signature rights', () => {
  const html = renderHoldingBlock(base);
  assert.match(html, /Janine Maria Fitz/);
  assert.match(html, /Einzelunterschrift/);
});

test('the VAT line is omitted while vat is null', () => {
  assert.doesNotMatch(renderHoldingBlock(base), /Mehrwertsteuer|MWST/);
});

test('the VAT line appears once vat is set', () => {
  const withVat = { ...base, holding: { ...base.holding, vat: 'CHE-405.114.788 MWST' } };
  assert.match(renderHoldingBlock(withVat), /MWST/);
});

test('the mail link uses the working address', () => {
  assert.match(renderHoldingBlock(base), /mailto:info@riverside-lifestyle\.ch/);
  assert.doesNotMatch(renderHoldingBlock(base), /rlh\.ag/);
});

test('the company table has one row per company', () => {
  const html = renderCompanyTable(base);
  assert.equal(html.match(/<tr/g).length, 3); // header plus two companies
});

test('each row names the brands the company operates', () => {
  const html = renderCompanyTable(base);
  assert.match(html, /A GmbH[\s\S]*Riverside Ink/);
  assert.match(html, /B GmbH[\s\S]*Riverside Gastro/);
});

test('an empty HR number does not render an empty label', () => {
  const html = renderCompanyTable(base);
  assert.doesNotMatch(html, /CH-1[\s\S]{0,40}HR-Nr\.:\s*</);
});

test('the liability section names the holding and disclaims operations', () => {
  const html = renderLiabilitySection(base);
  assert.match(html, /Riverside Lifestyle Holding AG/);
  assert.match(html, /Betriebsgesellschaft/);
});

test('real data renders every company', async () => {
  const data = await loadData('data');
  const html = renderCompanyTable(data);
  for (const c of data.companies) {
    assert.match(html, new RegExp(c.uid.replace(/\./g, '\\.')));
  }
});
