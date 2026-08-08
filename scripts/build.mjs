import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadData, validate, warnings, visibleBrands, locationsForBrand,
} from './lib/data.mjs';
import {
  renderTemplate, escapeHtml, attr,
} from './lib/render.mjs';
import {
  renderNavLinks, renderPanels, renderOpenLocations, renderBrandLocations,
  renderLocationsByPlace, panelsClass,
} from './lib/fragments.mjs';
import { buildJsonLd } from './lib/schema.mjs';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from './lib/legal.mjs';

const STATIC_DIRS = ['assets', 'css', 'js'];
const STATIC_FILES = ['robots.txt', 'llms.txt', 'favicon.svg', '.nojekyll'];

/**
 * German is the site root, English lives under /en/.
 *
 * The legal pages stay German-only on purpose: an impressum, terms and a
 * privacy statement are binding texts under Swiss law, and a translation that
 * nobody has legally reviewed would be worse than a German original that a
 * foreign visitor can machine-translate.
 */
const LANGUAGES = [
  { code: 'de', prefix: '', locationsSlug: 'standorte', legal: true },
  { code: 'en', prefix: 'en/', locationsSlug: 'locations', legal: false },
];

/**
 * Prefix for every internal link.
 *
 * The site is served both from its own domain (empty base) and from a GitHub
 * Pages project path (/repo-name). Hard-coded absolute paths break in the
 * second case, relative paths break as soon as a page moves into a
 * subdirectory. A single configurable base solves both.
 */
let BASE = '';

/** Read at build time, not at import time, so the setting is testable. */
function readBasePath() {
  return (process.env.BASE_PATH ?? '').replace(/\/$/, '');
}

// Every page written as .../index.html is served at its directory, so the
// sitemap should point there too — not at the literal file — to avoid two
// URL forms for the same page (bad for canonicalization).
function sitemapPath(page) {
  if (page === 'index.html') return '';
  return page.endsWith('/index.html') ? `${page.slice(0, -'index.html'.length)}` : page;
}

function sitemap(holding, pages) {
  const base = holding.url.replace(/\/$/, '');
  const urls = pages
    .map((p) => `  <url><loc>${base}/${sitemapPath(p)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * Makes a JSON string safe to drop into a <script> block.
 *
 * The content of a <script> element is raw text: the parser does not decode
 * entities there, it only looks for the closing tag. JSON.stringify does not
 * escape "<", so a brand name containing "</script>" would close the block
 * early and everything after it would be parsed as HTML. Rewriting every "<"
 * as its JSON unicode escape keeps the document semantically identical while
 * making an early close impossible.
 */
export function escapeForScriptBlock(json) {
  return json.replaceAll('<', '\\u003C');
}

// Legal pages (AGB, Datenschutz) intentionally still carry a few open
// business decisions that only the client can supply. Every such gap is
// marked in the templates with class="todo". The bracket pattern below is a
// second, independent check.
const TODO_SPAN = /<span class="todo">[\s\S]*?<\/span>/g;
const BRACKET_PLACEHOLDER = /\[[^\]["{}:]*\p{L}[^\]["{}:]*\]/gu;

/** Counts unresolved legal placeholders left in a rendered page. */
export function countUnfinished(html) {
  const spans = html.match(TODO_SPAN) ?? [];
  const rest = html.replace(TODO_SPAN, '');
  const brackets = rest.match(BRACKET_PLACEHOLDER) ?? [];
  return spans.length + brackets.length;
}

/** The path a page is written to, relative to the output directory. */
function pagePath(lang, kind, slug) {
  if (kind === 'index') return `${lang.prefix}index.html`;
  if (kind === 'locations') return `${lang.prefix}${lang.locationsSlug}/index.html`;
  return `${lang.prefix}${slug}/index.html`;
}

/**
 * The path a page is reachable at from where it is deployed, base path
 * included. Use for internal links.
 */
function pageUrl(lang, kind, slug) {
  return `${BASE}/${pagePath(lang, kind, slug).replace(/index\.html$/, '')}`;
}

/**
 * The address the page is meant to live at, for canonical, hreflang and
 * og:url.
 *
 * Deliberately without the base path: that path says where the build
 * currently sits (a GitHub Pages project folder), while canonical says where
 * the page belongs. Concatenating both produced
 * riverside-lifestyle.com/riverside-lifestyle-rot/ink/, an address that does
 * not exist, and pointed every search engine at a 404.
 */
function canonicalUrl(siteBase, lang, kind, slug) {
  return `${siteBase}/${pagePath(lang, kind, slug).replace(/index\.html$/, '')}`;
}

/**
 * The <link rel="alternate"> block plus the visible language switch.
 *
 * Both languages describe the same page, so hreflang has to point at the
 * counterpart of *this* page, not at the other language's home page. Sending
 * an English visitor from a brand page to the German front door is the most
 * common way this goes wrong.
 */
function languageLinks(kind, slug, siteBase) {
  const alt = LANGUAGES
    .map((l) => `<link rel="alternate" hreflang="${l.code}" href="${canonicalUrl(siteBase, l, kind, slug)}">`)
    .join('\n');
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${canonicalUrl(siteBase, LANGUAGES[0], kind, slug)}">`;
  return `${alt}\n${xDefault}`;
}

function languageSwitch(current, kind, slug) {
  return LANGUAGES.map((l) => {
    const label = l.code.toUpperCase();
    if (l.code === current.code) {
      return `      <span class="lang-switch__current" aria-current="true">${label}</span>`;
    }
    return `      <a class="lang-switch__link" href="${attr(pageUrl(l, kind, slug))}">${label}</a>`;
  }).join('\n');
}

/** Reads data and templates, writes the finished site to outDir. */
export async function build({
  dataDir = 'data', srcDir = 'src', outDir = 'dist', copyStatic = true,
} = {}) {
  BASE = readBasePath();
  const baseData = await loadData(dataDir, 'de');
  const errors = validate(baseData);
  if (errors.length) {
    throw new Error(`data validation failed:\n  ${errors.join('\n  ')}`);
  }

  const siteBase = baseData.holding.url.replace(/\/$/, '');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const written = [];
  const unfinished = [];

  const write = async (target, html) => {
    const dir = target.includes('/') ? join(outDir, target.slice(0, target.lastIndexOf('/'))) : outDir;
    await mkdir(dir, { recursive: true });
    await writeFile(join(outDir, target), html, 'utf8');
    written.push(target);
    const count = countUnfinished(html);
    if (count > 0) unfinished.push({ page: target, count });
  };

  const templates = Object.fromEntries(await Promise.all(
    ['index', 'brand', 'locations', 'impressum', 'agb', 'datenschutz'].map(async (name) => [
      name, await readFile(join(srcDir, `${name}.tmpl.html`), 'utf8'),
    ]),
  ));

  for (const lang of LANGUAGES) {
    const data = await loadData(dataDir, lang.code);
    const { holding, content } = data;
    const siteName = escapeHtml(content.siteName);

    const common = {
      base: BASE,
      siteName,
      htmlLang: content.htmlLang,
      copyright: escapeHtml(content.footer.copyright),
      navLinks: renderNavLinks(data, `${BASE}/${lang.prefix}`.replace(/\/$/, '')),
      allLocationsLabel: escapeHtml(content.picker.allLocations),
      allLocationsHref: attr(pageUrl(lang, 'locations')),
    };

    await write(pagePath(lang, 'index'), renderTemplate(templates.index, {
      ...common,
      title: escapeHtml(content.title),
      metaDescription: attr(content.metaDescription),
      canonical: canonicalUrl(siteBase, lang, 'index'),
      ogImage: `${siteBase}/assets/poster/poster.jpg`,
      ogLocale: lang.code === 'de' ? 'de_CH' : 'en_US',
      hreflang: languageLinks('index', null, siteBase),
      langSwitch: languageSwitch(lang, 'index', null),
      panels: renderPanels(data, `${BASE}/${lang.prefix}`.replace(/\/$/, ''), BASE),
      panelsClass: panelsClass(data),
      heroKicker: escapeHtml(content.hero.kicker),
      // hero.headline and worldwide.title intentionally carry raw markup
      // (an <em> emphasis) and must not be escaped.
      heroHeadline: content.hero.headline,
      wwKicker: escapeHtml(content.worldwide.kicker),
      wwTitle: content.worldwide.title,
      wwSub: escapeHtml(content.worldwide.sub),
      locationsTitle: escapeHtml(content.worldwide.locationsTitle),
      locations: renderOpenLocations(data, lang.code),
      contactTitle: escapeHtml(content.contact.title),
      contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
      labelPhone: escapeHtml(content.contact.labelPhone),
      labelMail: escapeHtml(content.contact.labelMail),
      phone: escapeHtml(holding.phone),
      phoneHref: holding.phone.replace(/\s/g, ''),
      mail: escapeHtml(holding.mail),
      facebookUrl: holding.social.facebook,
      jsonLd: escapeForScriptBlock(buildJsonLd(data, lang.code)),
    }));

    // A brand only gets a page when it has somewhere to send people. Event has
    // no location yet, so its panel stays a tile rather than a dead link.
    for (const brand of visibleBrands(data)) {
      if (!locationsForBrand(data, brand.slug).length) continue;
      await write(pagePath(lang, 'brand', brand.slug), renderTemplate(templates.brand, {
        ...common,
        title: `${escapeHtml(brand.name)} — ${siteName}`,
        metaDescription: attr(brand.description),
        canonical: canonicalUrl(siteBase, lang, 'brand', brand.slug),
        hreflang: languageLinks('brand', brand.slug, siteBase),
        langSwitch: languageSwitch(lang, 'brand', brand.slug),
        brandName: escapeHtml(brand.name),
        brandSub: escapeHtml(brand.sub),
        brandDescription: escapeHtml(brand.description),
        locationsTitle: escapeHtml(content.worldwide.locationsTitle),
        locations: renderBrandLocations(data, brand.slug, lang.code),
        contactTitle: escapeHtml(content.contact.title),
        contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
        mail: escapeHtml(holding.mail),
        phone: escapeHtml(holding.phone),
        phoneHref: holding.phone.replace(/\s/g, ''),
      }));
    }

    await write(pagePath(lang, 'locations'), renderTemplate(templates.locations, {
      ...common,
      title: `${escapeHtml(content.picker.locationsTitle)} — ${siteName}`,
      metaDescription: attr(content.picker.locationsIntro),
      canonical: canonicalUrl(siteBase, lang, 'locations'),
      hreflang: languageLinks('locations', null, siteBase),
      langSwitch: languageSwitch(lang, 'locations', null),
      locationsTitle: escapeHtml(content.picker.locationsTitle),
      locationsIntro: escapeHtml(content.picker.locationsIntro),
      locations: renderLocationsByPlace(data, lang.code),
    }));

    if (!lang.legal) continue;

    await write('impressum.html', renderTemplate(templates.impressum, {
      ...common,
      title: `Impressum — ${siteName}`,
      holdingBlock: renderHoldingBlock(data),
      liabilitySection: renderLiabilitySection(data),
      companyTable: renderCompanyTable(data, lang.code),
    }));
    await write('agb.html', renderTemplate(templates.agb, {
      ...common, title: `AGB — ${siteName}`,
    }));
    await write('datenschutz.html', renderTemplate(templates.datenschutz, {
      ...common,
      title: `Datenschutz — ${siteName}`,
      mail: escapeHtml(holding.mail),
      holdingName: escapeHtml(holding.name),
      holdingAddress: holding.address.map((l) => escapeHtml(l)).join(', '),
    }));
  }

  await writeFile(join(outDir, 'sitemap.xml'), sitemap(baseData.holding, written), 'utf8');
  written.push('sitemap.xml');

  if (copyStatic) {
    for (const dir of STATIC_DIRS) {
      await cp(dir, join(outDir, dir), { recursive: true });
    }
    for (const file of STATIC_FILES) {
      await cp(file, join(outDir, file));
    }
  }

  return { written, unfinished, warnings: warnings(baseData) };
}

// Direct invocation: node scripts/build.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((r) => {
      console.log(`built ${r.written.length} pages into dist/`);
      // These do not fail the build: they are either business decisions only
      // the client can make, or gaps that live on someone else's website. But
      // they must stay visible, or an unattended deploy ships them silently.
      if (r.unfinished.length) {
        console.warn(`WARNING: ${r.unfinished.length} page(s) still have open legal placeholders:`);
        for (const { page, count } of r.unfinished) {
          console.warn(`  - ${page}: ${count} open item(s)`);
        }
      }
      if (r.warnings.length) {
        console.warn(`WARNING: ${r.warnings.length} data issue(s):`);
        for (const w of r.warnings) console.warn(`  - ${w}`);
      }
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
