import { AlertEvent } from '../../models/EdgeModels';

export function eventTime(event: AlertEvent): number {
  const parsed: number = event.created_at === undefined ? NaN : Date.parse(event.created_at);
  return Number.isFinite(parsed) ? parsed : event.device_time_ms ?? 0;
}

// Acknowledgement is monotonic: a delayed snapshot cannot undo a saved ack.
export function mergeEvents(current: AlertEvent[], incoming: AlertEvent[]): AlertEvent[] {
  const merged: AlertEvent[] = current.slice();
  incoming.forEach((event: AlertEvent): void => {
    const index: number = merged.findIndex((item: AlertEvent): boolean => item.event_id === event.event_id);
    if (index < 0) {
      merged.push(event);
    } else if (merged[index].acked !== true || event.acked === true) {
      merged[index] = event;
    }
  });
  return merged.sort((left: AlertEvent, right: AlertEvent): number => eventTime(right) - eventTime(left));
}

export function filterEvents(events: AlertEvent[], level: string, acknowledgement: string, keyword: string): AlertEvent[] {
  const query: string = keyword.trim().toLowerCase();
  return events.filter((event: AlertEvent): boolean => {
    if (level !== 'ALL' && event.level !== level) {
      return false;
    }
    if (acknowledgement === 'PENDING' && event.acked === true) {
      return false;
    }
    if (acknowledgement === 'ACKED' && event.acked !== true) {
      return false;
    }
    const text: string = `${event.event_id} ${event.robot_id ?? ''} ${event.source_id ?? ''} ${(event.trigger_bits ?? []).join(' ')} ${event.status ?? ''}`;
    return query.length === 0 || text.toLowerCase().includes(query);
  });
}
