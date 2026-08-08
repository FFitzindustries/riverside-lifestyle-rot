import { escapeHtml, attr } from './render.mjs';
import { localized } from './data.mjs';

const lines = (arr) => (arr ?? []).map((l) => escapeHtml(l)).join('<br>');

export function renderHoldingBlock(data) {
  const h = data.holding;
  const board = (h.board ?? [])
    .map((p) => `${escapeHtml(p.name)}, ${escapeHtml(p.role)}, ${escapeHtml(p.signature)}`)
    .join('<br>');
  const vatLine = h.vat ? `\n      MWST-Nr.: ${escapeHtml(h.vat)}<br>` : '';

  return `    <h2>Angaben zum Betreiber</h2>
    <p>
      <strong>${escapeHtml(h.name)}</strong><br>
      ${lines(h.address)}
    </p>

    <h2>Kontakt</h2>
    <p>
      E-Mail: <a href="mailto:${attr(h.mail)}">${escapeHtml(h.mail)}</a><br>
      Telefon: <a href="tel:${attr(h.phone.replace(/\s/g, ''))}">${escapeHtml(h.phone)}</a>
    </p>

    <h2>Handelsregister</h2>
    <p>
      Rechtsform: ${escapeHtml(h.legalForm)}<br>
      UID: ${escapeHtml(h.uid)}<br>
      Handelsregister-Nr.: ${escapeHtml(h.hrNumber)}<br>
      Register: ${escapeHtml(h.register)}<br>
      Eingetragen: ${escapeHtml(h.registeredSince)}<br>
      Aktienkapital: ${escapeHtml(h.shareCapital)}<br>${vatLine}
      Zweck: ${escapeHtml(h.purpose)}
    </p>

    <h2>Verwaltungsrat</h2>
    <p>${board}</p>`;
}

export function renderCompanyTable(data, lang = 'de') {
  const brandName = new Map((data.brands ?? []).map((b) => [b.slug, b.name]));

  // Which brands does each company actually operate, and where. Only open
  // locations count: a company that has not opened anywhere operates nothing.
  const operated = new Map();
  for (const loc of (data.locations ?? []).filter((l) => l.status === 'open')) {
    for (const entry of loc.brands ?? []) {
      if (!operated.has(entry.companyId)) operated.set(entry.companyId, []);
      const label = `${brandName.get(entry.brand) ?? entry.brand} ${localized(loc.city, lang)}`;
      operated.get(entry.companyId).push(label);
    }
  }

  // Only companies that exist in a commercial register belong here. Listing a
  // planned GmbH in an impressum would be a false statement about who runs
  // the business, not an announcement.
  const rows = (data.companies ?? []).filter((c) => c.exists !== false).map((c) => {
    const hr = c.hrNumber ? `<br>HR-Nr.: ${escapeHtml(c.hrNumber)}` : '';
    const brands = (operated.get(c.id) ?? []).map((b) => escapeHtml(b)).join('<br>');
    return `        <tr>
          <td><strong>${escapeHtml(c.name)}</strong><br>${lines(c.address)}</td>
          <td>UID: ${escapeHtml(c.uid)}${hr}<br>${escapeHtml(c.register)}</td>
          <td>${brands}</td>
        </tr>`;
  }).join('\n');

  return `    <table class="legal-table">
      <thead>
        <tr><th>Gesellschaft</th><th>Register</th><th>Betreibt</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}

export function renderLiabilitySection(data) {
  const name = escapeHtml(data.holding.name);
  return `    <h2>Haftung und Zuständigkeit</h2>
    <p>Riverside Lifestyle ist die Dachmarke der ${name}. Die Holding hält die Marken und betreibt diese Website. Sie führt selbst keinen operativen Betrieb und erbringt keine Tattoo-, Piercing-, Bodymodification-, Beauty-, Laser- oder Gastronomieleistungen.</p>
    <p>Jede Marke wird an jedem Standort von einer rechtlich eigenständigen Betriebsgesellschaft geführt; an einem Standort können mehrere Gesellschaften tätig sein. Welche Gesellschaft eine Marke an einem Standort betreibt, zeigt die Tabelle der Betriebsgesellschaften weiter unten. Ansprüche aus einer Behandlung oder Leistung richten sich gegen die dort genannte Betriebsgesellschaft und, soweit die Leistung von selbstständigen Auftragnehmerinnen und Auftragnehmern erbracht wird, gegen diese persönlich.</p>
    <p>Eine Haftung der ${name} für Leistungen der Betriebsgesellschaften ist im gesetzlich zulässigen Rahmen ausgeschlossen. Zwingende gesetzliche Haftungsbestimmungen bleiben vorbehalten.</p>`;
}
