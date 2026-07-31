const test = require('node:test');
const assert = require('node:assert/strict');
const { createBlobName } = require('../services/azureBlobStorage');

test('creates tenant-scoped image blob names without path traversal', () => {
  const name = createBlobName('../Client Profiles/42', 'image/jpeg');
  assert.match(name, /^client-profiles\/42\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.jpg$/);
  assert.equal(name.includes('..'), false);
});

test('uses an extension that matches the validated image content type', () => {
  assert.match(createBlobName('uploads/client/1', 'image/png'), /\.png$/);
  assert.match(createBlobName('uploads/client/1', 'image/webp'), /\.webp$/);
});
