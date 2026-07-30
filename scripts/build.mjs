import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadData, validate, liveBrands } from './lib/data.mjs';
import {
  renderTemplate, escapeHtml, attr,
} from './lib/render.mjs';
import { renderNavLinks, renderPanels, renderLocationList, panelsClass } from './lib/fragments.mjs';
import { buildJsonLd } from './lib/schema.mjs';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from './lib/legal.mjs';

const STATIC_DIRS = ['assets', 'css', 'js'];
const STATIC_FILES = ['robots.txt', 'llms.txt', 'favicon.svg', '.nojekyll'];

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

// Legal pages (AGB, Datenschutz) intentionally still carry a few open
// business decisions that only the client can supply — a guessed deposit
// amount or court of jurisdiction would be worse than an honest gap. Every
// such gap is marked in the templates with class="todo". The bracket
// pattern below is a second, independent check: it catches a future
// placeholder that uses the same "[free text]" convention but forgets the
// class, without depending on a literal list of known-bad strings.
const TODO_SPAN = /<span class="todo">[\s\S]*?<\/span>/g;
const BRACKET_PLACEHOLDER = /\[[^\]["{}:]*\p{L}[^\]["{}:]*\]/gu;

/** Counts unresolved legal placeholders left in a rendered page. */
export function countUnfinished(html) {
  const spans = html.match(TODO_SPAN) ?? [];
  const rest = html.replace(TODO_SPAN, '');
  const brackets = rest.match(BRACKET_PLACEHOLDER) ?? [];
  return spans.length + brackets.length;
}

/** Reads data and templates, writes the finished site to outDir. */
export async function build({
  dataDir = 'data', srcDir = 'src', outDir = 'dist', copyStatic = true,
} = {}) {
  const data = await loadData(dataDir);
  const errors = validate(data);
  if (errors.length) {
    throw new Error(`data validation failed:\n  ${errors.join('\n  ')}`);
  }

  const { holding, content } = data;
  // Escaped once here so every page title below can interpolate it without
  // re-escaping (and without double-escaping) the site name.
  const siteName = escapeHtml(content.siteName);
  const common = {
    siteName,
    copyright: escapeHtml(content.footer.copyright),
  };

  const indexVars = {
    ...common,
    title: escapeHtml(content.title),
    metaDescription: attr(content.metaDescription),
    navLinks: renderNavLinks(data),
    panels: renderPanels(data),
    panelsClass: panelsClass(data),
    heroKicker: escapeHtml(content.hero.kicker),
    // hero.headline and worldwide.title intentionally carry raw markup
    // (an <em> emphasis) and must not be escaped, or the tag would show
    // up as visible text instead of rendering.
    heroHeadline: content.hero.headline,
    wwKicker: escapeHtml(content.worldwide.kicker),
    wwTitle: content.worldwide.title,
    wwSub: escapeHtml(content.worldwide.sub),
    locationsTitle: escapeHtml(content.worldwide.locationsTitle),
    locations: renderLocationList(data),
    contactTitle: escapeHtml(content.contact.title),
    contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
    labelPhone: escapeHtml(content.contact.labelPhone),
    labelMail: escapeHtml(content.contact.labelMail),
    phone: escapeHtml(holding.phone),
    phoneHref: holding.phone.replace(/\s/g, ''),
    mail: escapeHtml(holding.mail),
    facebookUrl: holding.social.facebook,
    jsonLd: buildJsonLd(data),
  };

  const pages = [
    ['index.html', 'index.tmpl.html', indexVars],
    ['impressum.html', 'impressum.tmpl.html', {
      ...common,
      title: `Impressum — ${siteName}`,
      holdingBlock: renderHoldingBlock(data),
      liabilitySection: renderLiabilitySection(data),
      companyTable: renderCompanyTable(data),
    }],
    ['agb.html', 'agb.tmpl.html', { ...common, title: `AGB — ${siteName}` }],
    ['datenschutz.html', 'datenschutz.tmpl.html', {
      ...common,
      title: `Datenschutz — ${siteName}`,
      mail: escapeHtml(holding.mail),
      // The controller named in the privacy statement is the same legal
      // entity the impressum renders from holding.json. Keeping it a literal
      // in the template would let the two drift apart after a move.
      holdingName: escapeHtml(holding.name),
      holdingAddress: holding.address.map((l) => escapeHtml(l)).join(', '),
    }],
  ];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const written = [];
  const unfinished = [];
  for (const [target, tmpl, vars] of pages) {
    const template = await readFile(join(srcDir, tmpl), 'utf8');
    const html = renderTemplate(template, vars);
    await writeFile(join(outDir, target), html, 'utf8');
    written.push(target);
    const count = countUnfinished(html);
    if (count > 0) unfinished.push({ page: target, count });
  }

  const brandTemplate = await readFile(join(srcDir, 'brand.tmpl.html'), 'utf8');
  for (const brand of liveBrands(data).filter((b) => !b.url)) {
    const dir = join(outDir, brand.slug);
    await mkdir(dir, { recursive: true });
    const locationsForBrand = {
      ...data,
      locations: data.locations.filter((l) => (l.brands ?? []).some((e) => e.brand === brand.slug)),
    };
    const html = renderTemplate(brandTemplate, {
      ...common,
      title: `${escapeHtml(brand.name)} — ${siteName}`,
      metaDescription: attr(brand.description),
      navLinks: renderNavLinks(data),
      brandName: escapeHtml(brand.name),
      brandSub: escapeHtml(brand.sub),
      brandDescription: escapeHtml(brand.description),
      locationsTitle: escapeHtml(content.worldwide.locationsTitle),
      locations: renderLocationList(locationsForBrand),
      contactTitle: escapeHtml(content.contact.title),
      contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
      mail: escapeHtml(holding.mail),
      phone: escapeHtml(holding.phone),
      phoneHref: holding.phone.replace(/\s/g, ''),
    });
    await writeFile(join(dir, 'index.html'), html, 'utf8');
    written.push(`${brand.slug}/index.html`);
    const count = countUnfinished(html);
    if (count > 0) unfinished.push({ page: `${brand.slug}/index.html`, count });
  }

  await writeFile(join(outDir, 'sitemap.xml'), sitemap(holding, written), 'utf8');
  written.push('sitemap.xml');

  if (copyStatic) {
    for (const dir of STATIC_DIRS) {
      await cp(dir, join(outDir, dir), { recursive: true });
    }
    for (const file of STATIC_FILES) {
      await cp(file, join(outDir, file));
    }
  }

  return { written, unfinished };
}

// Direct invocation: node scripts/build.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((r) => {
      console.log(`built ${r.written.length} pages into dist/`);
      // The build succeeds regardless — these are business decisions only
      // the client can make, not bugs to fail the build over. But they must
      // stay visible, or they end up shipped by an unattended deploy.
      if (r.unfinished.length) {
        console.warn(`WARNING: ${r.unfinished.length} page(s) still have open legal placeholders:`);
        for (const { page, count } of r.unfinished) {
          console.warn(`  - ${page}: ${count} open item(s)`);
        }
      }
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
