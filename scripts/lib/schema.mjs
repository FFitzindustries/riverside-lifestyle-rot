import { liveBrands } from './data.mjs';

/** All open locations where a given brand operates. */
function openLocationsFor(data, slug) {
  return (data.locations ?? []).filter(
    (l) => l.status === 'open' && (l.brands ?? []).some((e) => e.brand === slug),
  );
}

/**
 * Builds the schema.org graph: the holding as Organization plus one node per
 * live brand, linked in both directions.
 */
export function buildJsonLd(data) {
  const base = data.holding.url.replace(/\/$/, '');
  const brands = liveBrands(data);

  const openCities = [
    ...new Set(
      (data.locations ?? []).filter((l) => l.status === 'open').map((l) => l.city),
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

  const brandNodes = brands.map((b) => {
    const node = {
      '@type': b.schemaType,
      '@id': `${base}/#${b.slug}`,
      name: b.name,
      url: b.url || `${base}/${b.slug}/`,
      description: b.description,
      parentOrganization: { '@id': `${base}/#org` },
    };
    const [first] = openLocationsFor(data, b.slug);
    if (first) {
      node.address = {
        '@type': 'PostalAddress',
        addressLocality: first.city,
        addressCountry: first.country,
      };
    }
    return node;
  });

  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': [org, ...brandNodes] },
    null,
    2,
  );
}
