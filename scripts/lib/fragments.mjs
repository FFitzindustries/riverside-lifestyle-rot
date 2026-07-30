import { liveBrands } from './data.mjs';
import { escapeHtml, attr } from './render.mjs';

/** Where a brand panel points: its own domain, or a local fallback page. */
export function brandHref(brand) {
  return brand.url ? brand.url : `/${brand.slug}/`;
}

export function renderNavLinks(data) {
  return liveBrands(data)
    .map((b) => `      <a href="${attr(brandHref(b))}">${escapeHtml(b.short)}</a>`)
    .join('\n');
}

export function renderPanels(data) {
  return liveBrands(data).map((b) => `    <a class="panel" href="${attr(brandHref(b))}" data-brand="${attr(b.slug)}">
      <div class="panel-media">
        <video muted loop playsinline poster="assets/poster/${attr(b.media.poster)}">
          <source src="assets/video/${attr(b.media.video)}" type="video/mp4">
        </video>
      </div>
      <div class="panel-body">
        <h2>${escapeHtml(b.short)}</h2>
        <p class="panel-sub">${escapeHtml(b.sub)}</p>
        <span class="panel-more">Zur Website →</span>
      </div>
      <span class="panel-progress"><span></span></span>
    </a>`).join('\n\n');
}

/** Open locations, grouped by country, with the brands present at each. */
export function renderLocationList(data) {
  // Only live brands: this list is public. A draft brand assigned to an open
  // location would otherwise announce itself here before anyone decided to
  // launch it — and "event" already sits in brands.json as a draft, so that
  // is one data edit away. Slugs with no live brand fall out at the
  // .filter(Boolean) below.
  const brandName = new Map(liveBrands(data).map((b) => [b.slug, b.name]));
  const open = (data.locations ?? []).filter((l) => l.status === 'open');

  const byCountry = new Map();
  for (const loc of open) {
    if (!byCountry.has(loc.countryName)) byCountry.set(loc.countryName, []);
    byCountry.get(loc.countryName).push(loc);
  }

  return [...byCountry.entries()].map(([country, locs]) => {
    const items = locs.map((loc) => {
      const brands = (loc.brands ?? [])
        .map((e) => brandName.get(e.brand))
        .filter(Boolean)
        .map((n) => escapeHtml(n))
        .join(' · ');
      const address = (loc.address ?? []).map((l) => escapeHtml(l)).join(', ');
      return `        <li class="loc">
          <strong class="loc__city">${escapeHtml(loc.city)}</strong>
          <span class="loc__addr">${address}</span>
          <span class="loc__brands">${brands}</span>
        </li>`;
    }).join('\n');
    return `      <div class="loc-group">
        <h3 class="loc-country">${escapeHtml(country)}</h3>
        <ul class="loc-list">
${items}
        </ul>
      </div>`;
  }).join('\n');
}

/** Column layout stops working once the panels get too narrow. */
export function panelsClass(data) {
  return liveBrands(data).length >= 5 ? 'panels panels--grid' : 'panels';
}
