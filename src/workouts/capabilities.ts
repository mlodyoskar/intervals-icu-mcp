import type { AthleteSummary } from "../coaching/model.js";
import { PlanSportSchema } from "./model.js";
import type { z } from "zod";

export interface SportZoneCapabilities {
  heartRate: boolean;
  pace: boolean;
  power: boolean;
}

type PlanSport = z.infer<typeof PlanSportSchema>;
export type ZoneCapabilities = Partial<Record<PlanSport, SportZoneCapabilities>>;

export function zoneCapabilitiesFromAthlete(athlete: AthleteSummary): ZoneCapabilities {
  const capabilities: ZoneCapabilities = {};
  for (const profile of athlete.zonesAndThresholds.sports) {
    const sport = PlanSportSchema.safeParse(profile.sport);
    if (!sport.success) continue;

    const existing = capabilities[sport.data];
    capabilities[sport.data] = {
      heartRate: (existing?.heartRate ?? false) || profile.zones.heartRate !== null,
      pace: (existing?.pace ?? false) || profile.zones.pace !== null,
      power: (existing?.power ?? false) || profile.zones.power !== null,
    };
  }
  return capabilities;
}
