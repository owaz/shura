const test = require('node:test');
const assert = require('node:assert/strict');
const { isPlaceholderFullName, normalizeSignupFullName } = require('../utils/signupProfile');

test('normalizes a signup full name without silently truncating it', () => {
  assert.equal(normalizeSignupFullName('  E2E   Client 1  '), 'E2E Client 1');
  assert.equal(normalizeSignupFullName('A'), null);
  assert.equal(normalizeSignupFullName('x'.repeat(201)), null);
  assert.equal(normalizeSignupFullName({}), null);
});

test('only treats known Auth0 fallback names as replaceable', () => {
  assert.equal(isPlaceholderFullName('', 'person@example.com'), true);
  assert.equal(isPlaceholderFullName('Shura', 'person@example.com'), true);
  assert.equal(isPlaceholderFullName('Shura User', 'person@example.com'), true);
  assert.equal(isPlaceholderFullName('person', 'person@example.com'), true);
  assert.equal(isPlaceholderFullName('Amina Rahman', 'person@example.com'), false);
});
