const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeImageMetadata } = require('../utils/imageSanitization');

test('removes JPEG EXIF APP1 segments before Azure upload', () => {
  const jpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66,
    0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
  ]);
  const result = sanitizeImageMetadata(jpeg, 'image/jpeg');
  assert.equal(result.includes(Buffer.from('Exif')), false);
  assert.deepEqual([...result.subarray(0, 2)], [0xff, 0xd8]);
});

test('leaves non-metadata image bytes unchanged', () => {
  const webp = Buffer.from('RIFFxxxxWEBPdata');
  assert.equal(sanitizeImageMetadata(webp, 'image/webp'), webp);
});
