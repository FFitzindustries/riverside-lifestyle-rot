import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadData, validate } from './lib/data.mjs';
import {
  renderTemplate, escapeHtml, attr,
} from './lib/render.mjs';
import { renderNavLinks, renderPanels, renderLocationList } from './lib/fragments.mjs';
import { buildJsonLd } from './lib/schema.mjs';
import { renderHoldingBlock, renderCompanyTable, renderLiabilitySection } from './lib/legal.mjs';

const STATIC_DIRS = ['assets', 'css', 'js'];
const STATIC_FILES = ['robots.txt', 'llms.txt', 'favicon.svg', '.nojekyll'];

function sitemap(holding, pages) {
  const base = holding.url.replace(/\/$/, '');
  const urls = pages
    .map((p) => `  <url><loc>${base}/${p === 'index.html' ? '' : p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
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
    ['datenschutz.html', 'datenschutz.tmpl.html', { ...common, title: `Datenschutz — ${siteName}` }],
  ];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const written = [];
  for (const [target, tmpl, vars] of pages) {
    const template = await readFile(join(srcDir, tmpl), 'utf8');
    await writeFile(join(outDir, target), renderTemplate(template, vars), 'utf8');
    written.push(target);
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

  return { written };
}

// Direct invocation: node scripts/build.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((r) => console.log(`built ${r.written.length} pages into dist/`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
