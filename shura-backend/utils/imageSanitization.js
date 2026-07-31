const stripJpegMetadata = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return buffer;
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(buffer.subarray(offset));
      return Buffer.concat(parts);
    }
    // Restart and standalone markers contain no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const end = offset + 2 + segmentLength;
    if (segmentLength < 2 || end > buffer.length) return buffer;
    // APP1 contains EXIF/XMP, APP13 commonly contains IPTC, and COM is a
    // free-form comment. Remove all three while preserving image data.
    if (![0xe1, 0xed, 0xfe].includes(marker)) parts.push(buffer.subarray(offset, end));
    offset = end;
  }
  return buffer;
};

const stripPngMetadata = (buffer) => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(signature)) return buffer;
  const parts = [buffer.subarray(0, 8)];
  const removable = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const dataLength = buffer.readUInt32BE(offset);
    const end = offset + 12 + dataLength;
    if (end > buffer.length) return buffer;
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (!removable.has(type)) parts.push(buffer.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return buffer;
};

const sanitizeImageMetadata = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') return stripJpegMetadata(buffer);
  if (mimeType === 'image/png') return stripPngMetadata(buffer);
  return buffer;
};

module.exports = { sanitizeImageMetadata, stripJpegMetadata, stripPngMetadata };
