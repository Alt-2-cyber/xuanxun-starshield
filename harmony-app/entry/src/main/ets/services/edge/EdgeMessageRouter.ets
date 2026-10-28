import {
  AlertEvent,
  ControlSnapshot,
  EdgeEnvelope,
  SystemSnapshot,
  TwinSnapshot,
  VisionDetection
} from '../../models/EdgeModels';

export type RoutedEdgeMessageKind = 'snapshot' | 'alert' | 'vision' | 'twin' | 'control';

export interface RoutedEdgeMessage {
  kind: RoutedEdgeMessageKind;
  snapshot?: SystemSnapshot;
  event?: AlertEvent;
  alertUpdated?: boolean;
  vision?: VisionDetection;
  twin?: TwinSnapshot;
  control?: ControlSnapshot;
}

export function routeEdgeMessage(rawMessage: string): RoutedEdgeMessage | undefined {
  try {
    const envelope: EdgeEnvelope = JSON.parse(rawMessage) as EdgeEnvelope;
    if (envelope === null || typeof envelope.type !== 'string'
      || envelope.data === undefined || envelope.data === null) {
      return undefined;
    }
    switch (envelope.type) {
      case 'system.snapshot':
      case 'safety.changed':
        return {
          kind: 'snapshot',
          snapshot: envelope.data as SystemSnapshot
        };
      case 'alert.created':
      case 'alert.updated':
        return {
          kind: 'alert',
          event: envelope.data as AlertEvent,
          alertUpdated: envelope.type === 'alert.updated'
        };
      case 'vision.detection':
        return {
          kind: 'vision',
          vision: envelope.data as VisionDetection
        };
      case 'twin.snapshot':
        return {
          kind: 'twin',
          twin: envelope.data as TwinSnapshot
        };
      case 'control.state':
        return {
          kind: 'control',
          control: envelope.data as ControlSnapshot
        };
      default:
        return undefined;
    }
  } catch (_) {
    return undefined;
  }
}
