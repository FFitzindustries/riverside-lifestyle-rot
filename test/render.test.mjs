import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, attr, renderTemplate } from '../scripts/lib/render.mjs';

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<script>&"x"'), '&lt;script&gt;&amp;&quot;x&quot;');
});

test('escapeHtml keeps umlauts intact', () => {
  assert.equal(escapeHtml('Küche & Bar'), 'Küche &amp; Bar');
});

test('attr escapes quotes for attribute context', () => {
  assert.equal(attr('a"b'), 'a&quot;b');
});

test('renderTemplate replaces a placeholder', () => {
  assert.equal(renderTemplate('<p><!--{{x}}--></p>', { x: 'hi' }), '<p>hi</p>');
});

test('renderTemplate replaces the same placeholder twice', () => {
  assert.equal(renderTemplate('<!--{{x}}--><!--{{x}}-->', { x: 'a' }), 'aa');
});

test('renderTemplate tolerates spaces inside the placeholder', () => {
  assert.equal(renderTemplate('<!--{{ x }}-->', { x: 'a' }), 'a');
});

test('renderTemplate throws when a placeholder has no value', () => {
  assert.throws(
    () => renderTemplate('<!--{{missing}}-->', {}),
    /missing/,
  );
});

test('renderTemplate leaves ordinary comments alone', () => {
  const tmpl = '<!-- a normal comment --><!--{{x}}-->';
  assert.equal(renderTemplate(tmpl, { x: 'v' }), '<!-- a normal comment -->v');
});
