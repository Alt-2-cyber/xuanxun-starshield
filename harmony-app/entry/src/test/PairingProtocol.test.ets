import { describe, it, expect } from '@ohos/hypium';
import { isTokenUsable, normalizeServiceUrl, parsePairingPayload } from '../main/ets/services/pairing/PairingParser';

export default function pairingProtocolTest() {
  describe('PairingProtocol', () => {
    it('parses a JSON QR payload with an expiring token', 0, () => {
      const result = parsePairingPayload(
        '{"service_url":"http://192.168.1.8:8787","token":"short-lived","expires_at_ms":2000000}',
        1000000
      );
      expect(result.serviceUrl).assertEqual('http://192.168.1.8:8787');
      expect(result.token).assertEqual('short-lived');
      expect(result.expiresAtMs).assertEqual(2000000);
    });

    it('accepts a raw local HTTP service URL without credentials', 0, () => {
      const result = parsePairingPayload('http://10.0.0.12:8787/', 1000000);
      expect(result.serviceUrl).assertEqual('http://10.0.0.12:8787');
      expect(result.token).assertUndefined();
    });

    it('rejects non HTTP service URLs', 0, () => {
      expect(normalizeServiceUrl('file:///private/data')).assertUndefined();
      expect(normalizeServiceUrl('')).assertUndefined();
    });

    it('does not use an expired token', 0, () => {
      expect(isTokenUsable('token', 999, 1000)).assertFalse();
      expect(isTokenUsable('token', 1001, 1000)).assertTrue();
      expect(isTokenUsable(undefined, 1001, 1000)).assertFalse();
    });
  });
}
