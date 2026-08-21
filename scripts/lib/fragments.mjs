import {
  visibleBrands, liveBrands, localized, countriesForBrand, locationHref,
  locationsForBrand, brandBySlug, countryByCode,
} from './data.mjs';
import { escapeHtml, attr } from './render.mjs';

/**
 * The hub page for a brand. Panels and nav point here, not at the brand's own
 * site.
 *
 * The prefix carries both the deployment base path and the language segment,
 * so an English page links to English pages. Building the href from the slug
 * alone sent every English visitor back into the German tree.
 */
export function brandHref(brand, prefix = '') {
  return `${prefix}/${brand.slug}/`;
}

/** Brands that actually have a page: a brand without locations has nothing to show. */
function linkableBrands(data) {
  return visibleBrands(data).filter((b) => locationsForBrand(data, b.slug).length > 0);
}

export function renderNavLinks(data, prefix = '') {
  return linkableBrands(data)
    .map((b) => `      <a href="${attr(brandHref(b, prefix))}">${escapeHtml(b.short)}</a>`)
    .join('\n');
}

/**
 * @param prefix    language- and base-aware path for the brand pages
 * @param assetBase deployment base only, without the language segment
 *
 * Media paths used to be relative, which resolved against the current
 * directory and turned into /en/assets/... on the English home page.
 */
export function renderPanels(data, prefix = '', assetBase = '') {
  return visibleBrands(data).map((b) => {
    // A brand with no locations has no page, so it never becomes a link even
    // if its status says live.
    const planned = b.status === 'planned' || locationsForBrand(data, b.slug).length === 0;
    const cls = planned ? 'panel panel--planned' : 'panel';
    // A planned brand has no media and nowhere to go, so it renders as a
    // non-interactive tile rather than a link that leads nowhere.
    const media = planned ? '' : `
      <div class="panel-media">
        <video muted loop playsinline poster="${attr(assetBase)}/assets/poster/${attr(b.media.poster)}">
          <source src="${attr(assetBase)}/assets/video/${attr(b.media.video)}" type="video/mp4">
        </video>
      </div>`;
    const more = planned
      ? `<span class="panel-more panel-more--planned">${escapeHtml(data.content.picker.planned)}</span>`
      : `<span class="panel-more">${escapeHtml(data.content.picker.choose)}</span>`;
    const body = `
      <div class="panel-body">
        <h2>${escapeHtml(b.short)}</h2>
        <p class="panel-sub">${escapeHtml(b.sub)}</p>
        ${more}
      </div>
      <span class="panel-progress"><span></span></span>`;

    return planned
      ? `    <div class="${cls}" data-brand="${attr(b.slug)}">${media}${body}
    </div>`
      : `    <a class="${cls}" href="${attr(brandHref(b, prefix))}" data-brand="${attr(b.slug)}">${media}${body}
    </a>`;
  }).join('\n\n');
}

/**
 * The portal hero: one room, three zones.
 *
 * Left to right in the photograph, which is not the order the brands carry in
 * the data — Gastro sits in the middle of the room but is third by `order`.
 * The geometry is measured against assets/hero/venue.jpg so the real brand
 * mark lands exactly on the blank sign painted into the scene; the matching
 * coordinates live in css/styles.css next to the zone classes.
 */
const PORTAL_ZONES = ['ink', 'gastro', 'beauty'];

/**
 * Returns null when the picture no longer matches the brands. Adding a fourth
 * brand or retiring one leaves the painted signs wrong, and a portal with a
 * homeless brand is worse than the panel row, so the caller falls back to it.
 */
export function renderPortal(data, prefix = '', assetBase = '') {
  const shown = visibleBrands(data);
  if (shown.length !== PORTAL_ZONES.length) return null;

  const bySlug = new Map(shown.map((b) => [b.slug, b]));
  const usable = PORTAL_ZONES.every(
    (slug) => bySlug.has(slug) && locationsForBrand(data, slug).length > 0,
  );
  if (!usable) return null;

  const room = `    <img class="portal__room" src="${attr(assetBase)}/assets/hero/venue.jpg" alt="${attr(data.content.picker.roomAlt)}">
    <span class="portal__veil"></span>`;

  const zones = PORTAL_ZONES.map((slug) => {
    const b = bySlug.get(slug);
    // href before data-brand: the build test reads the pair as one string.
    return `    <a class="zone" href="${attr(brandHref(b, prefix))}" data-brand="${attr(slug)}">
      <img class="zone__shot" src="${attr(assetBase)}/assets/hero/zone-${attr(slug)}.jpg" alt="" loading="lazy">
      <span class="zone__signwrap"><span class="zone__sign"><span class="zone__mark"></span></span></span>
      <span class="zone__body">
        <span class="zone__name">${escapeHtml(b.short)}</span>
        <span class="zone__sub">${escapeHtml(b.sub)}</span>
        <span class="zone__cta">${escapeHtml(data.content.picker.choose)}</span>
      </span>
    </a>`;
  }).join('\n\n');

  return `${room}\n\n${zones}`;
}

/** One city: a link when it is open and has a target, plain text otherwise. */
function renderCity(data, loc, brandSlug, lang) {
  const city = escapeHtml(localized(loc.city, lang));
  if (loc.status !== 'open') {
    return `          <li class="loc-city loc-city--planned"><span>${city}</span><em>${escapeHtml(data.content.picker.planned)}</em></li>`;
  }
  const href = locationHref(data, loc, brandSlug);
  if (!href) {
    return `          <li class="loc-city"><span>${city}</span></li>`;
  }
  return `          <li class="loc-city"><a href="${attr(href)}">${city}</a></li>`;
}

/**
 * The country/city list for one brand.
 *
 * Level skipping: a brand present in a single country renders without country
 * headings, because a heading that never has a sibling is decoration, not
 * navigation. The same idea applies downwards, where a country with one city
 * simply shows that city as the target.
 */
export function renderBrandLocations(data, brandSlug, lang = 'de') {
  const groups = countriesForBrand(data, brandSlug);
  if (!groups.length) return '';

  const cities = (group) => group.locations
    .map((loc) => renderCity(data, loc, brandSlug, lang))
    .join('\n');

  if (groups.length === 1) {
    return `      <ul class="loc-cities">
${cities(groups[0])}
      </ul>`;
  }

  return groups.map((group) => `      <div class="loc-group">
        <h3 class="loc-country">${escapeHtml(localized(group.country.name, lang))}</h3>
        <ul class="loc-cities">
${cities(group)}
        </ul>
      </div>`).join('\n');
}

/**
 * All locations grouped by country and city, listing the brands present at
 * each. This is the "by place" view: a visitor in Dubai sees everything the
 * group runs there without opening each brand in turn.
 */
export function renderLocationsByPlace(data, lang = 'de') {
  const brandName = new Map(visibleBrands(data).map((b) => [b.slug, b.name]));
  const byCountry = new Map();
  for (const loc of data.locations ?? []) {
    if (!byCountry.has(loc.country)) byCountry.set(loc.country, []);
    byCountry.get(loc.country).push(loc);
  }

  return (data.countries ?? [])
    .filter((c) => byCountry.has(c.code))
    .sort((a, b) => a.order - b.order)
    .map((country) => {
      const items = byCountry.get(country.code).map((loc) => {
        const planned = loc.status !== 'open';
        const city = escapeHtml(localized(loc.city, lang));
        const address = (loc.address ?? []).map((l) => escapeHtml(l)).join(', ');
        const brands = (loc.brands ?? []).map((entry) => {
          const name = escapeHtml(brandName.get(entry.brand) ?? entry.brand);
          const href = planned ? '' : locationHref(data, loc, entry.brand);
          return href ? `<a href="${attr(href)}">${name}</a>` : `<span>${name}</span>`;
        }).join(' · ');
        const note = planned
          ? `<span class="loc__planned">${escapeHtml(data.content.picker.planned)}</span>`
          : '';
        return `        <li class="loc${planned ? ' loc--planned' : ''}">
          <strong class="loc__city">${city}</strong>
          <span class="loc__addr">${address}</span>
          <span class="loc__brands">${brands}</span>
          ${note}
        </li>`;
      }).join('\n');

      return `      <div class="loc-group">
        <h3 class="loc-country">${escapeHtml(localized(country.name, lang))}</h3>
        <ul class="loc-list">
${items}
        </ul>
      </div>`;
    }).join('\n');
}

/**
 * The short list on the home page: open locations only.
 *
 * The home page is the one surface where a planned location would read as a
 * claim rather than an announcement, so the announcement lives on the
 * dedicated locations page instead.
 */
export function renderOpenLocations(data, lang = 'de') {
  const brandName = new Map(liveBrands(data).map((b) => [b.slug, b.name]));
  const open = (data.locations ?? []).filter((l) => l.status === 'open');

  const byCountry = new Map();
  for (const loc of open) {
    if (!byCountry.has(loc.country)) byCountry.set(loc.country, []);
    byCountry.get(loc.country).push(loc);
  }

  return (data.countries ?? [])
    .filter((c) => byCountry.has(c.code))
    .sort((a, b) => a.order - b.order)
    .map((country) => {
      const items = byCountry.get(country.code).map((loc) => {
        const brands = (loc.brands ?? [])
          .map((e) => brandName.get(e.brand))
          .filter(Boolean)
          .map((n) => escapeHtml(n))
          .join(' · ');
        const address = (loc.address ?? []).map((l) => escapeHtml(l)).join(', ');
        return `        <li class="loc">
          <strong class="loc__city">${escapeHtml(localized(loc.city, lang))}</strong>
          <span class="loc__addr">${address}</span>
          <span class="loc__brands">${brands}</span>
        </li>`;
      }).join('\n');
      return `      <div class="loc-group">
        <h3 class="loc-country">${escapeHtml(localized(country.name, lang))}</h3>
        <ul class="loc-list">
${items}
        </ul>
      </div>`;
    }).join('\n');
}

/** Column layout stops working once the panels get too narrow. */
export function panelsClass(data) {
  return visibleBrands(data).length >= 5 ? 'panels panels--grid' : 'panels';
}

export { brandBySlug, countryByCode };
