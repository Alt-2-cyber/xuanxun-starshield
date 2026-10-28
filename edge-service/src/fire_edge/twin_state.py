from __future__ import annotations

import math
from datetime import datetime, timezone

from .models import AlertEvent, AlertLevel, HeatPoint, LinkSnapshot, PoseSnapshot, RiskZone, TwinSnapshot


LEVEL_WEIGHT = {
    AlertLevel.P1: 0.35,
    AlertLevel.P2: 0.65,
    AlertLevel.P3: 1.0,
}
ZONE_WEIGHT = {"low": 0.2, "medium": 0.5, "high": 0.8}


class HeatmapEngine:
    def __init__(self, spatial_radius_m: float = 1.5, half_life_s: float = 300.0) -> None:
        self.spatial_radius_m = spatial_radius_m
        self.half_life_s = half_life_s

    def build(
        self,
        events: list[AlertEvent],
        zones: list[RiskZone],
        at: datetime | None = None,
    ) -> list[HeatPoint]:
        current = at or datetime.now(timezone.utc)
        points: list[HeatPoint] = []
        for zone in zones:
            points.append(HeatPoint(
                x=zone.x,
                y=zone.y,
                intensity=ZONE_WEIGHT.get(zone.level, ZONE_WEIGHT["medium"]),
                radius_m=zone.radius_m,
                label=f"zone:{zone.name}",
            ))
        for event in events:
            if event.level not in LEVEL_WEIGHT or event.status == "CLEARED":
                continue
            age_s = max(0.0, (current - event.created_at).total_seconds())
            temporal = math.pow(0.5, age_s / self.half_life_s)
            vision_confidence = 1.0 if "VISION" not in event.trigger_bits else 0.75
            intensity = min(1.0, LEVEL_WEIGHT[event.level] * vision_confidence * temporal)
            points.append(HeatPoint(
                x=event.pose.x,
                y=event.pose.y,
                intensity=intensity,
                radius_m=self.spatial_radius_m,
                source_event_id=event.event_id,
                label=event.level.value,
            ))
        return points


class TwinState:
    def __init__(self) -> None:
        self.map_version = "demo-map-v1"
        self.robot_pose = PoseSnapshot()
        self.trail: list[PoseSnapshot] = [self.robot_pose]
        self.risk_zones: list[RiskZone] = [
            RiskZone(zone_id="zone-b", name="B 区设备通道", level="medium", x=12.4, y=5.2, radius_m=2.4)
        ]
        self.events: dict[str, AlertEvent] = {}
        self.links: list[LinkSnapshot] = []
        self.heatmap = HeatmapEngine()

    def add_event(self, event: AlertEvent) -> None:
        self.events[event.event_id] = event

    def update_pose(self, pose: PoseSnapshot) -> None:
        self.robot_pose = pose
        self.trail.append(pose)
        if len(self.trail) > 200:
            self.trail = self.trail[-200:]

    def add_risk_zone(self, zone: RiskZone) -> RiskZone:
        self.risk_zones = [item for item in self.risk_zones if item.zone_id != zone.zone_id]
        self.risk_zones.append(zone)
        return zone

    def snapshot(self, at: datetime | None = None) -> TwinSnapshot:
        active = [event for event in self.events.values() if event.status != "CLEARED"]
        return TwinSnapshot(
            map_version=self.map_version,
            robot_pose=self.robot_pose,
            trail=self.trail[-200:],
            risk_zones=self.risk_zones,
            heat_points=self.heatmap.build(list(self.events.values()), self.risk_zones, at),
            active_alerts=active,
            link_status=self.links,
        )
