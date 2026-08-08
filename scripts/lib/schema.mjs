import { liveBrands, localized, locationHref } from './data.mjs';

/** All open locations where a given brand operates. */
function openLocationsFor(data, slug) {
  return (data.locations ?? []).filter(
    (l) => l.status === 'open' && (l.brands ?? []).some((e) => e.brand === slug),
  );
}

/**
 * Builds the schema.org graph: the holding as Organization, one node per live
 * brand, and one LocalBusiness per brand and open location.
 *
 * Only open locations appear. A planned company has no address, no opening
 * hours and no legal existence, so putting it in the graph would be a claim
 * to search engines that the site itself does not make.
 */
export function buildJsonLd(data, lang = 'de') {
  const base = data.holding.url.replace(/\/$/, '');
  const brands = liveBrands(data);

  const openCities = [
    ...new Set(
      (data.locations ?? [])
        .filter((l) => l.status === 'open')
        .map((l) => localized(l.city, lang)),
    ),
  ];

  const org = {
    '@type': 'Organization',
    '@id': `${base}/#org`,
    name: data.holding.name,
    url: `${base}/`,
    email: data.holding.mail,
    telephone: data.holding.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.holding.address[0],
      addressLocality: (data.holding.address[1] ?? '').replace(/^\d+\s*/, ''),
      postalCode: (data.holding.address[1] ?? '').match(/^\d+/)?.[0] ?? '',
      addressCountry: 'CH',
    },
    areaServed: openCities,
    subOrganization: brands.map((b) => ({ '@id': `${base}/#${b.slug}` })),
  };

  const social = Object.values(data.holding.social ?? {}).filter(Boolean);
  if (social.length) org.sameAs = social;

  const brandNodes = [];
  const placeNodes = [];

  for (const b of brands) {
    const locations = openLocationsFor(data, b.slug);
    brandNodes.push({
      '@type': b.schemaType,
      '@id': `${base}/#${b.slug}`,
      name: b.name,
      url: `${base}/${b.slug}/`,
      description: b.description,
      parentOrganization: { '@id': `${base}/#org` },
      ...(b.url ? { sameAs: [b.url] } : {}),
      ...(locations.length
        ? { location: locations.map((l) => ({ '@id': `${base}/#${b.slug}-${l.slug}` })) }
        : {}),
    });

    // One node per place, so a brand present in two cities is findable in
    // both. Hanging a single address off the brand node, as before, made the
    // second city invisible to anything reading the graph.
    for (const loc of locations) {
      const postal = (loc.address[1] ?? '');
      const href = locationHref(data, loc, b.slug);
      placeNodes.push({
        '@type': 'LocalBusiness',
        '@id': `${base}/#${b.slug}-${loc.slug}`,
        name: `${b.name} ${localized(loc.city, lang)}`,
        branchOf: { '@id': `${base}/#${b.slug}` },
        parentOrganization: { '@id': `${base}/#org` },
        ...(href ? { url: href } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: loc.address[0] ?? '',
          addressLocality: postal.replace(/^\d+\s*/, ''),
          postalCode: postal.match(/^\d+/)?.[0] ?? '',
          addressCountry: loc.country.toUpperCase(),
        },
      });
    }
  }

  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': [org, ...brandNodes, ...placeNodes] },
    null,
    2,
  );
}
