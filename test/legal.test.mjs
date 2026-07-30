import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from '../scripts/lib/legal.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { escapeHtml } from '../scripts/lib/render.mjs';

// Helper function to extract table rows, ensuring we cut at row boundaries
function extractTableRows(html) {
  const rows = html.split('</tr>').filter(r => r.trim());
  return rows.map(r => r.substring(r.indexOf('<tr'))).filter(r => r.length > 0);
}

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
  const rows = extractTableRows(html);
  // Row 0 is header; row 1 is c1 (A GmbH), row 2 is c2 (B GmbH)
  assert.match(rows[1], /A GmbH/);
  assert.match(rows[1], /Riverside Ink/);
  assert.match(rows[2], /B GmbH/);
  assert.match(rows[2], /Riverside Gastro/);
  // Verify no cross-contamination
  assert.doesNotMatch(rows[1], /Riverside Gastro/);
  assert.doesNotMatch(rows[2], /Riverside Ink/);
});

test('an empty HR number does not render an empty label', () => {
  const html = renderCompanyTable(base);
  const rows = extractTableRows(html);
  // Row 1 is c1 (A GmbH with hrNumber 'CH-1') → must contain "HR-Nr."
  assert.match(rows[1], /HR-Nr\./);
  // Row 2 is c2 (B GmbH with empty hrNumber) → must not contain "HR-Nr."
  assert.doesNotMatch(rows[2], /HR-Nr\./);
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

test('real data maps brands correctly to companies', async () => {
  const data = await loadData('data');
  const html = renderCompanyTable(data);
  const rows = extractTableRows(html);

  // Hardcoded oracle: which brands each company should operate
  // This is based on the actual business structure (Handelsregister), not derived from data/locations.json
  // If this changes, it indicates a data error that must be corrected in the source
  const brandOracle = {
    'ink-stma': ['Riverside Ink', 'Riverside Beauty'],    // ink + beauty at St. Margrethen
    'ink-stg': ['Riverside Ink'],                          // ink at St. Gallen only
    'ink-gastro': ['Riverside Gastro'],                    // gastro at St. Margrethen (separate company)
  };

  // Verify each company's brands against the oracle
  for (const [companyId, expectedBrands] of Object.entries(brandOracle)) {
    const company = data.companies.find(c => c.id === companyId);
    assert.ok(company, `Company ${companyId} should exist in data`);

    // Find the row for this company (identify by company name)
    const companyNameEscaped = escapeHtml(company.name);
    const companyRow = rows.find(row => row.includes(companyNameEscaped));
    assert.ok(companyRow, `Row for company ${company.name} should exist in table`);

    // Extract the third <td> which contains "Betreibt" (brands and cities)
    const tdMatches = companyRow.match(/<td>[\s\S]*?<\/td>/g);
    const brandCell = tdMatches && tdMatches[2] ? tdMatches[2] : '';

    // Verify the brand cell contains all expected brands
    for (const brand of expectedBrands) {
      const brandEscaped = escapeHtml(brand);
      assert.match(brandCell, new RegExp(brandEscaped),
        `Company ${company.name} (${companyId}) must operate brand ${brand}`);
    }

    // Verify no brands NOT in the oracle appear in this company's brand cell
    for (const brand of data.brands || []) {
      const isExpectedForThisCompany = expectedBrands.includes(brand.name);
      if (!isExpectedForThisCompany) {
        const brandEscaped = escapeHtml(brand.name);
        assert.doesNotMatch(brandCell, new RegExp(brandEscaped),
          `Company ${company.name} (${companyId}) must not operate brand ${brand.name}`);
      }
    }
  }
});
