import { describe, it, expect } from '@ohos/hypium';
import { buildAuthHeaders, buildWebSocketUrl } from '../main/ets/services/edge/EdgeClient';
import { PairingConfig } from '../main/ets/models/EdgeModels';

export default function edgeClientContractTest() {
  describe('EdgeClientContract', () => {
    it('builds a local WebSocket URL from the paired service URL', 0, () => {
      expect(buildWebSocketUrl('http://192.168.1.8:8787/')).assertEqual('ws://192.168.1.8:8787/ws');
      expect(buildWebSocketUrl('https://edge.local:8787')).assertEqual('wss://edge.local:8787/ws');
    });

    it('sends only a valid short-lived bearer token', 0, () => {
      const valid: PairingConfig = {
        serviceUrl: 'http://edge.local:8787',
        token: 'short-lived',
        expiresAtMs: 2000
      };
      const expired: PairingConfig = {
        serviceUrl: 'http://edge.local:8787',
        token: 'expired',
        expiresAtMs: 999
      };
      expect(buildAuthHeaders(valid, 1000)['Authorization']).assertEqual('Bearer short-lived');
      expect(buildAuthHeaders(expired, 1000)['Authorization']).assertEqual(undefined);
    });
  });
}
