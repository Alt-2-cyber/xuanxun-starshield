import { describe, it, expect } from '@ohos/hypium';
import { AlertEvent } from '../main/ets/models/EdgeModels';
import { filterEvents, mergeEvents } from '../main/ets/services/edge/EventHistory';

export default function eventHistoryTest() {
  describe('EventHistory', () => {
    it('combines severity, acknowledgement and keyword filters', 0, () => {
      const events: AlertEvent[] = [
        { event_id: 'SMOKE-A', level: 'P1', acked: false, source_id: 'sensor-1' },
        { event_id: 'SMOKE-B', level: 'P1', acked: true, source_id: 'sensor-1' },
        { event_id: 'SMOKE-C', level: 'P2', acked: false, source_id: 'sensor-2' }
      ];
      const result: AlertEvent[] = filterEvents(events, 'P1', 'PENDING', '  smoke  ');
      expect(result.length).assertEqual(1);
      expect(result[0].event_id).assertEqual('SMOKE-A');
      expect(filterEvents(events, 'ALL', 'ACKED', 'sensor-1')[0].event_id).assertEqual('SMOKE-B');
    });

    it('retains a persisted ack when an older unacked snapshot arrives', 0, () => {
      const saved: AlertEvent = { event_id: 'event-1', level: 'P1', acked: true, status: 'ACKED' };
      const stale: AlertEvent = { event_id: 'event-1', level: 'P1', acked: false, status: 'ACTIVE' };
      const merged: AlertEvent[] = mergeEvents([saved], [stale]);
      expect(merged.length).assertEqual(1);
      expect(merged[0].acked).assertTrue();
      expect(merged[0].status).assertEqual('ACKED');
    });

    it('deduplicates pages and orders the most recent archived event first', 0, () => {
      const older: AlertEvent = { event_id: 'older', level: 'P2', created_at: '2026-10-18T08:00:00Z' };
      const recent: AlertEvent = { event_id: 'recent', level: 'P1', created_at: '2026-10-19T08:00:00Z' };
      const merged: AlertEvent[] = mergeEvents([older], [recent, older]);
      expect(merged.length).assertEqual(2);
      expect(merged[0].event_id).assertEqual('recent');
    });
  });
}
