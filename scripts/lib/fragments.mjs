import {
  visibleBrands, liveBrands, localized, countriesForBrand, locationHref,
  locationsForBrand, brandBySlug, countryByCode,
} from './data.mjs';
import { escapeHtml, attr } from './render.mjs';

/**
 * The hub page for a brand. Panels and nav point here, not at the brand's own
 * site — unless the brand sets `redirect`.
 *
 * The prefix carries both the deployment base path and the language segment,
 * so an English page links to English pages. Building the href from the slug
 * alone sent every English visitor back into the German tree.
 */
export function brandHref(brand, prefix = '') {
  // A brand with `redirect` skips its hub page and sends visitors straight on.
  if (brand.redirect) return brand.redirect;
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
      : `<span class="panel-more">${escapeHtml(b.redirect ? data.content.picker.visitSite : data.content.picker.choose)}</span>`;
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
 * the data — Gastro stands second in the room but is third by `order`.
 * The geometry is measured against assets/hero/venue.jpg so the real brand
 * mark lands exactly on the blank sign painted into the scene; the matching
 * coordinates live in css/styles.css next to the zone classes.
 */
const PORTAL_ZONES = ['ink', 'gastro', 'beauty', 'event'];

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
        <span class="zone__cta">${escapeHtml(b.redirect ? data.content.picker.visitSite : data.content.picker.choose)}</span>
      </span>
    </a>`;
  }).join('\n\n');

  return `${room}\n\n${zones}`;
}

/** One city: a link when it is open and has a target, a construction note otherwise. */
function renderCity(data, loc, brandSlug, lang) {
  const city = escapeHtml(localized(loc.city, lang));
  if (loc.status !== 'open') {
    return `          <li class="loc-city loc-city--planned"><span>${city}</span><em>${escapeHtml(data.content.picker.planned)}</em></li>`;
  }
  const href = locationHref(data, loc, brandSlug);
  if (!href) {
    return `          <li class="loc-city loc-city--planned"><span>${city}</span><em>${escapeHtml(data.content.picker.siteInProgress)}</em></li>`;
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
        // A draft brand has no name in the map and must stay invisible.
        const brands = (loc.brands ?? []).filter((entry) => brandName.has(entry.brand)).map((entry) => {
          const name = escapeHtml(brandName.get(entry.brand));
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

/**
 * Social networks in their original brand colours. Each icon is a complete
 * 24×24 badge, so the colours live in the SVG and not in the stylesheet. `svg`
 * takes an id so that gradients stay unique when one network appears twice.
 */
const TIKTOK_NOTE = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';

const SOCIAL_NETWORKS = {
  facebook: {
    label: 'Facebook',
    svg: () => '<circle cx="12" cy="12" r="10.5" fill="#fff"/><path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>',
  },
  instagram: {
    label: 'Instagram',
    svg: (id) => `<defs><radialGradient id="${id}" cx="0.3" cy="1.07" r="1.2"><stop offset="0" stop-color="#FFDD55"/><stop offset=".1" stop-color="#FFDD55"/><stop offset=".5" stop-color="#FF543E"/><stop offset="1" stop-color="#C837AB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#${id})"/><rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.4" cy="7.6" r="1.05" fill="#fff"/>`,
  },
  tiktok: {
    label: 'TikTok',
    svg: () => `<rect width="24" height="24" rx="6" fill="#000"/><g transform="translate(5.2 4.6) scale(.58)"><path fill="#25F4EE" transform="translate(-.9 -.9)" d="${TIKTOK_NOTE}"/><path fill="#FE2C55" transform="translate(.9 .9)" d="${TIKTOK_NOTE}"/><path fill="#fff" d="${TIKTOK_NOTE}"/></g>`,
  },
  pinterest: {
    label: 'Pinterest',
    svg: () => '<circle cx="12" cy="12" r="10.5" fill="#fff"/><path fill="#E60023" d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>',
  },
  x: {
    label: 'X',
    svg: () => '<rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" transform="translate(5.5 5.5) scale(.54)" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>',
  },
};

/**
 * Every social channel of the group, one row per account owner: the holding
 * first, then each live brand that has channels of its own.
 */
export function renderSocial(data) {
  let n = 0;
  const owners = [
    { name: data.content.siteName, short: 'Lifestyle', social: data.holding?.social ?? {} },
    ...liveBrands(data).map((b) => ({ name: b.name, short: b.short ?? b.name, social: b.social ?? {} })),
  ].filter((o) => Object.keys(o.social).some((k) => SOCIAL_NETWORKS[k] && o.social[k]));

  return owners.map((o) => {
    const links = Object.entries(o.social)
      .filter(([k, url]) => SOCIAL_NETWORKS[k] && url)
      .map(([k, url]) => {
        const net = SOCIAL_NETWORKS[k];
        const label = `${o.name} · ${net.label}`;
        return `            <a class="social social--${k}" href="${attr(url)}" target="_blank" rel="noopener" aria-label="${attr(label)}" title="${attr(label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${net.svg(`social-${k}-${++n}`)}</svg></a>`;
      }).join('\n');
    return `          <div class="social-row">
            <span class="social-row__name">${escapeHtml(o.short)}</span>
            <div class="social-row__icons">
${links}
            </div>
          </div>`;
  }).join('\n');
}

/** Column layout stops working once the panels get too narrow. */
export function panelsClass(data) {
  return visibleBrands(data).length >= 5 ? 'panels panels--grid' : 'panels';
}

export { brandBySlug, countryByCode };
