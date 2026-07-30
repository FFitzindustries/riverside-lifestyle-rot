import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILES = {
  holding: 'holding.json',
  brands: 'brands.json',
  locations: 'locations.json',
  companies: 'companies.json',
};

/**
 * Reads all data files and returns them as one object.
 * `lang` picks the content file; only 'de' exists today.
 */
export async function loadData(dataDir = 'data', lang = 'de') {
  const files = { ...FILES, content: `content.${lang}.json` };
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, file]) => {
      const raw = await readFile(join(dataDir, file), 'utf8');
      return [key, JSON.parse(raw)];
    }),
  );
  return Object.fromEntries(entries);
}

const PLACEHOLDER = /TODO|\[Platzhalter|\bTBD\b|CHE-123\.456\.789|Musterstrasse/i;

/** Walks any nested value and reports strings that still look like placeholders. */
function findPlaceholders(value, path, errors) {
  if (typeof value === 'string') {
    if (PLACEHOLDER.test(value)) {
      errors.push(`placeholder in ${path}: "${value}"`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findPlaceholders(v, `${path}[${i}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      findPlaceholders(v, `${path}.${k}`, errors);
    }
  }
}

/**
 * Returns a list of problems. Empty means the data is safe to build from.
 * Two rules matter: every brand-location entry must resolve to a real brand
 * and a real company, and no placeholder text may survive into the output.
 */
export function validate(data) {
  const errors = [];
  const brandSlugs = new Set((data.brands ?? []).map((b) => b.slug));
  const companyIds = new Set((data.companies ?? []).map((c) => c.id));

  for (const loc of data.locations ?? []) {
    for (const entry of loc.brands ?? []) {
      if (!brandSlugs.has(entry.brand)) {
        errors.push(`location "${loc.slug}" references unknown brand "${entry.brand}"`);
      }
      if (!companyIds.has(entry.companyId)) {
        errors.push(
          `location "${loc.slug}" brand "${entry.brand}" references unknown companyId "${entry.companyId}"`,
        );
      }
    }
  }

  for (const [key, value] of Object.entries(data)) {
    findPlaceholders(value, key, errors);
  }
  return errors;
}

/** Brands that should actually appear on the site, in display order. */
export function liveBrands(data) {
  return (data.brands ?? [])
    .filter((b) => b.status === 'live')
    .sort((a, b) => a.order - b.order);
}

export function companyById(data, id) {
  return (data.companies ?? []).find((c) => c.id === id);
}
