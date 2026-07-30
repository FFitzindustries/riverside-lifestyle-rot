import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadData, validate } from './lib/data.mjs';
import { renderTemplate, escapeHtml } from './lib/render.mjs';
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
  const common = {
    siteName: content.siteName,
    copyright: content.footer.copyright,
  };

  const indexVars = {
    ...common,
    title: content.title,
    metaDescription: content.metaDescription,
    navLinks: renderNavLinks(data),
    panels: renderPanels(data),
    heroKicker: content.hero.kicker,
    heroHeadline: content.hero.headline,
    wwKicker: content.worldwide.kicker,
    wwTitle: content.worldwide.title,
    wwSub: content.worldwide.sub,
    locationsTitle: content.worldwide.locationsTitle,
    locations: renderLocationList(data),
    contactTitle: content.contact.title,
    contactAddress: holding.address.map((l) => escapeHtml(l)).join('<br>'),
    labelPhone: content.contact.labelPhone,
    labelMail: content.contact.labelMail,
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
      title: `Impressum — ${content.siteName}`,
      holdingBlock: renderHoldingBlock(data),
      liabilitySection: renderLiabilitySection(data),
      companyTable: renderCompanyTable(data),
    }],
    ['agb.html', 'agb.tmpl.html', { ...common, title: `AGB — ${content.siteName}` }],
    ['datenschutz.html', 'datenschutz.tmpl.html', { ...common, title: `Datenschutz — ${content.siteName}` }],
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
