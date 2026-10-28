import { describe, it, expect } from '@ohos/hypium';
import { routeEdgeMessage } from '../main/ets/services/edge/EdgeMessageRouter';

export default function edgeMessageRouterTest() {
  describe('EdgeMessageRouter', () => {
    it('routes an alert.created envelope to an alert event', 0, () => {
      const result = routeEdgeMessage(
        '{"type":"alert.created","data":{"event_id":"demo-0001","level":"P2","trigger_bits":["SMOKE"]}}'
      );
      expect(result?.kind).assertEqual('alert');
      expect(result?.event?.event_id).assertEqual('demo-0001');
    });

    it('routes safety.changed and ignores unknown envelopes', 0, () => {
      const safety = routeEdgeMessage(
        '{"type":"safety.changed","data":{"safety":{"state":"PAUSED"}}}'
      );
      expect(safety?.kind).assertEqual('snapshot');
      expect(safety?.snapshot?.safety.state).assertEqual('PAUSED');
      expect(routeEdgeMessage('{"type":"unknown","data":{}}')).assertUndefined();
    });

    it('routes a persisted acknowledgement broadcast as an alert update', 0, () => {
      const update = routeEdgeMessage(
        '{"type":"alert.updated","data":{"event_id":"demo-0001","level":"P2","acked":true}}'
      );
      expect(update?.kind).assertEqual('alert');
      expect(update?.event?.acked).assertTrue();
    });

    it('routes control state without treating it as a safety snapshot', 0, () => {
      const control = routeEdgeMessage(
        '{"type":"control.state","data":{"mode":"LOBSTER_AI","safety_state":"PATROLLING","ros_connected":true}}'
      );
      expect(control?.kind).assertEqual('control');
      expect(control?.control?.mode).assertEqual('LOBSTER_AI');
      expect(control?.control?.ros_connected).assertTrue();
    });

    it('returns undefined for malformed WebSocket text', 0, () => {
      expect(routeEdgeMessage('not-json')).assertUndefined();
    });
  });
}
