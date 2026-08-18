const test = require('node:test');
const assert = require('node:assert/strict');
const {
  billingMode,
  billingRecordId,
  normalizedBillingStatus,
  parseReceiptId,
  receiptAvailable,
  transactionReference,
} = require('../utils/clientBilling');
const { generateReceiptPdf } = require('../services/clientReceiptPdf');

const decodeUtf16Hex = (hex) => hex.match(/.{4}/g).map((part) => String.fromCodePoint(Number.parseInt(part, 16))).join('');

const parseCMap = (stream) => {
  const chars = new Map();
  for (const block of stream.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const line of block[1].matchAll(/<([0-9a-f]+)>\s+<([0-9a-f]+)>\s+\[([^\]]+)\]/gi)) {
      let cid = Number.parseInt(line[1], 16);
      for (const unicode of line[3].matchAll(/<([0-9a-f]+)>/gi)) {
        chars.set(cid, decodeUtf16Hex(unicode[1]));
        cid += 1;
      }
    }
  }
  for (const block of stream.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const line of block[1].matchAll(/<([0-9a-f]+)>\s+<([0-9a-f]+)>/gi)) {
      chars.set(Number.parseInt(line[1], 16), decodeUtf16Hex(line[2]));
    }
  }
  return chars;
};

const extractPdfText = (pdf) => {
  const source = pdf.toString('latin1');
  const objects = new Map([...source.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)].map((match) => [match[1], match[2]]));
  const fonts = new Map();
  for (const match of source.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
    const fontObject = objects.get(match[2]) || '';
    const unicodeRef = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(fontObject)?.[1];
    if (unicodeRef) fonts.set(match[1], parseCMap(objects.get(unicodeRef) || ''));
  }
  const decode = (font, hex) => {
    const cmap = fonts.get(font);
    if (!cmap) return '';
    return hex.match(/.{4}/g).map((cid) => cmap.get(Number.parseInt(cid, 16)) || '').join('');
  };
  let currentFont = '';
  let text = '';
  for (const stream of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    if (!/\sT[fjJ]/.test(stream[1])) continue;
    for (const token of stream[1].matchAll(/\/(F\d+)\s+\d+(?:\.\d+)?\s+Tf|\[((?:.|\n)*?)\]\s*TJ|<([0-9a-f]+)>\s*Tj/gi)) {
      if (token[1]) currentFont = token[1];
      if (token[2]) text += [...token[2].matchAll(/<([0-9a-f]+)>/gi)].map((part) => decode(currentFont, part[1])).join('');
      if (token[3]) text += decode(currentFont, token[3]);
      text += '\n';
    }
  }
  return text;
};

test('selects paid, covered, free, and disabled billing modes', () => {
  assert.equal(billingMode({ billingEnabled: false, paymentEnabled: true, sessionsCovered: false }), 'disabled');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: true, sessionsCovered: true }), 'covered');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: false, sessionsCovered: false }), 'free');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: true, sessionsCovered: false }), 'paid');
});

test('keeps payment and refund states distinct', () => {
  assert.equal(normalizedBillingStatus({ status: 'completed' }), 'paid');
  assert.equal(normalizedBillingStatus({ status: 'failed' }), 'failed');
  assert.equal(normalizedBillingStatus({ status: 'completed', refundStatus: 'pending' }), 'refund_pending');
  assert.equal(normalizedBillingStatus({ status: 'completed', refundStatus: 'failed' }), 'refund_failed');
  assert.equal(normalizedBillingStatus({ status: 'conflict', refundStatus: 'required' }), 'refund_required');
  assert.equal(normalizedBillingStatus({ status: 'refunded' }), 'refunded');
});

test('uses stable typed receipt ids and references', () => {
  assert.deepEqual(parseReceiptId('payment-42'), { source: 'payment', id: 42 });
  assert.deepEqual(parseReceiptId('intent-7'), { source: 'intent', id: 7 });
  assert.deepEqual(parseReceiptId('payment-2147483647'), { source: 'payment', id: 2147483647 });
  assert.equal(parseReceiptId('payment-0'), null);
  assert.equal(parseReceiptId('payment-2147483648'), null);
  assert.equal(parseReceiptId('payment-999999999999999999999999999999999999999999999999999999999'), null);
  assert.equal(parseReceiptId('../payment-42'), null);
  assert.equal(billingRecordId('payment', 42), 'payment-42');
  assert.equal(transactionReference('payment', 42), 'SHURA-PAY-000042');
});

test('only offers receipts for captured payment records', () => {
  assert.equal(receiptAvailable({ source: 'payment', status: 'paid' }), true);
  assert.equal(receiptAvailable({ source: 'payment', status: 'pending' }), false);
  assert.equal(receiptAvailable({ source: 'intent', status: 'refund_required', providerPaymentPresent: true }), true);
  assert.equal(receiptAvailable({ source: 'intent', status: 'refund_required', providerPaymentPresent: false }), false);
});

test('generates a branded PDF from payment and appointment metadata', async () => {
  const pdf = await generateReceiptPdf({
    reference: 'SHURA-PAY-000042',
    amountMinor: 125000,
    currency: 'INR',
    statusLabel: 'Paid',
    transactionDate: '2026-08-18T12:00:00.000Z',
    refundStatusLabel: 'Pending',
    refundAmountMinor: 25000,
    therapistName: 'Dr Āmina Žižek',
    scheduledAt: '2026-08-20T12:00:00.000Z',
    clientTimezone: 'Asia/Dubai',
    sessionTypeLabel: 'Video session',
    durationMinutes: 50,
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1_000);
  const text = extractPdfText(pdf);
  assert.match(text, /₹1,250\.00/);
  assert.match(text, /Refund amount/);
  assert.match(text, /₹250\.00/);
  assert.match(text, /Dr Āmina Žižek/);
});
