import QRCode from 'qrcode';
import {publicUrl} from '../site/sharing.mjs';

export async function createQr() {
  // Four white modules provide the quiet zone required for reliable scanning.
  return QRCode.toBuffer(publicUrl, {type:'png',errorCorrectionLevel:'M',margin:4,scale:8});
}
