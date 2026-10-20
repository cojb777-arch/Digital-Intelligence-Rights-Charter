import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {createQr} from '../scripts/qr.mjs';
import {publicUrl} from '../site/sharing.mjs';

test('QR image decodes to the exact public HTTPS URL',async()=>{
  const image=PNG.sync.read(await createQr());
  const decoded=jsQR(new Uint8ClampedArray(image.data),image.width,image.height);
  assert.ok(decoded,'QR image must be readable');
  assert.equal(decoded.data,publicUrl);
  assert.equal(decoded.data,'https://digital-intelligence-rights-charter.dreamion.workers.dev/');
});
