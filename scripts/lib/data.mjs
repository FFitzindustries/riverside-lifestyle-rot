import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILES = {
  holding: 'holding.json',
  brands: 'brands.json',
  countries: 'countries.json',
  locations: 'locations.json',
  companies: 'companies.json',
};

/**
 * Reads all data files and returns them as one object.
 * `lang` picks the content file.
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

/**
 * Picks a language from a value that may be a plain string or a {de, en} map.
 *
 * Most city names are identical in both languages, so writing them twice would
 * be noise that invites the two copies to drift apart. Only the ones that
 * actually differ (München/Munich) carry a map.
 */
export function localized(value, lang = 'de') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.de ?? '';
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

const LOCATION_STATUS = new Set(['open', 'planned']);
const BRAND_STATUS = new Set(['live', 'planned', 'draft']);

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

/**
 * Returns a list of problems. Empty means the data is safe to build from.
 *
 * The rules exist because a wrong reference here does not crash the build, it
 * produces a page that quietly lies: a location under the wrong brand, a
 * country that never renders, two cities that link to the same page.
 */
export function validate(data) {
  const errors = [];
  const brandSlugs = new Set((data.brands ?? []).map((b) => b.slug));
  const companyIds = new Set((data.companies ?? []).map((c) => c.id));
  const countryCodes = new Set((data.countries ?? []).map((c) => c.code));

  for (const dup of duplicates((data.locations ?? []).map((l) => l.slug))) {
    errors.push(`duplicate location slug "${dup}"`);
  }
  for (const dup of duplicates((data.countries ?? []).map((c) => c.code))) {
    errors.push(`duplicate country code "${dup}"`);
  }
  for (const dup of duplicates((data.companies ?? []).map((c) => c.id))) {
    errors.push(`duplicate company id "${dup}"`);
  }

  for (const b of data.brands ?? []) {
    if (!BRAND_STATUS.has(b.status)) {
      errors.push(`brand "${b.slug}" has unknown status "${b.status}"`);
    }
    for (const code of Object.keys(b.sites ?? {})) {
      if (!countryCodes.has(code)) {
        errors.push(`brand "${b.slug}" has a site for unknown country "${code}"`);
      }
    }
  }

  for (const c of data.companies ?? []) {
    if (c.country && !countryCodes.has(c.country)) {
      errors.push(`company "${c.id}" references unknown country "${c.country}"`);
    }
  }

  for (const loc of data.locations ?? []) {
    if (!LOCATION_STATUS.has(loc.status)) {
      errors.push(`location "${loc.slug}" has unknown status "${loc.status}"`);
    }
    if (!countryCodes.has(loc.country)) {
      errors.push(`location "${loc.slug}" references unknown country "${loc.country}"`);
    }
    if (loc.status === 'open' && !(loc.address ?? []).length) {
      errors.push(`open location "${loc.slug}" has no address`);
    }
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

/**
 * Problems that should not stop a build but must not go unnoticed either.
 *
 * The collision case is the one that matters today: two open locations of the
 * same brand resolving to the same URL make the third level of the picker
 * pointless, because the visitor chooses between two cities and lands on the
 * same page twice. It stays a warning because the fix lives on the brand's own
 * website, not in this repository.
 */
export function warnings(data) {
  const out = [];

  const byTarget = new Map();
  for (const loc of openLocations(data)) {
    for (const entry of loc.brands ?? []) {
      const href = locationHref(data, loc, entry.brand);
      if (!href) continue;
      const key = `${entry.brand} ${href}`;
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(loc.slug);
    }
  }
  for (const [key, slugs] of byTarget) {
    if (slugs.length > 1) {
      const [brand, href] = key.split(' ');
      out.push(
        `brand "${brand}": open locations ${slugs.join(', ')} all link to ${href}; they need their own location pages`,
      );
    }
  }

  for (const { slug, brand } of unlinkedOpenLocations(data)) {
    out.push(`open location "${slug}" has no target for brand "${brand}", so it renders without a link`);
  }

  const unconfirmed = unconfirmedLocations(data);
  if (unconfirmed.length) {
    out.push(
      `${unconfirmed.length} locations carry an inferred brand assignment: ${unconfirmed.map((l) => l.slug).join(', ')}`,
    );
  }

  return out;
}

/**
 * Locations whose brand assignment was inferred rather than confirmed.
 * Reported by the build so a guess never silently becomes the truth.
 */
export function unconfirmedLocations(data) {
  return (data.locations ?? []).filter((l) => l.brandsConfirmed === false);
}

/** Brands that are open for business, in display order. */
export function liveBrands(data) {
  return (data.brands ?? [])
    .filter((b) => b.status === 'live')
    .sort((a, b) => a.order - b.order);
}

/** Brands shown on the site at all — live ones plus the announced ones. */
export function visibleBrands(data) {
  return (data.brands ?? [])
    .filter((b) => b.status === 'live' || b.status === 'planned')
    .sort((a, b) => a.order - b.order);
}

export function openLocations(data) {
  return (data.locations ?? []).filter((l) => l.status === 'open');
}

export function companyById(data, id) {
  return (data.companies ?? []).find((c) => c.id === id);
}

export function brandBySlug(data, slug) {
  return (data.brands ?? []).find((b) => b.slug === slug);
}

export function countryByCode(data, code) {
  return (data.countries ?? []).find((c) => c.code === code);
}

/** Every location that carries the given brand, open and planned alike. */
export function locationsForBrand(data, brandSlug) {
  return (data.locations ?? []).filter((l) => (l.brands ?? []).some((e) => e.brand === brandSlug));
}

/**
 * Countries where a brand is present, in display order, each with its
 * locations. This is the shape the picker renders.
 */
export function countriesForBrand(data, brandSlug) {
  const locations = locationsForBrand(data, brandSlug);
  return (data.countries ?? [])
    .map((country) => ({
      country,
      locations: locations.filter((l) => l.country === country.code),
    }))
    .filter((group) => group.locations.length > 0)
    .sort((a, b) => a.country.order - b.country.order);
}

/**
 * Where a single brand at a single location points.
 *
 * The fallback chain matters: a location page is best, the brand's site for
 * that country is acceptable, and anything else is no link at all. Falling
 * back to some global brand URL would send a visitor looking for Vienna to
 * the Swiss site, which is worse than not linking.
 */
export function locationHref(data, location, brandSlug) {
  const entry = (location.brands ?? []).find((e) => e.brand === brandSlug);
  if (!entry) return '';
  if (entry.url) return entry.url;
  const brand = brandBySlug(data, brandSlug);
  return brand?.sites?.[location.country] ?? '';
}

/**
 * Open locations of a brand that have no target to link to.
 * Reported by the build: they show up in the picker but cannot be clicked.
 */
export function unlinkedOpenLocations(data) {
  const out = [];
  for (const loc of openLocations(data)) {
    for (const entry of loc.brands ?? []) {
      if (!locationHref(data, loc, entry.brand)) {
        out.push({ slug: loc.slug, brand: entry.brand });
      }
    }
  }
  return out;
}
