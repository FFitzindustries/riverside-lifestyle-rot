const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for use inside HTML element content. */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Escapes text for use inside a double-quoted HTML attribute. */
export function attr(str) {
  return escapeHtml(str);
}

const PLACEHOLDER = /<!--\{\{\s*([\w.-]+)\s*\}\}-->/g;

/**
 * Replaces every <!--{{key}}--> with vars[key].
 * A missing key is a build error, not a silently empty page.
 */
export function renderTemplate(template, vars) {
  return template.replace(PLACEHOLDER, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      throw new Error(`template placeholder "${key}" has no value`);
    }
    return vars[key];
  });
}
