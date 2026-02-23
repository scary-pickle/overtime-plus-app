// Coordinates for Queensland hospitals — used to set geofence centre point
// Coordinates are the main entrance / main building GPS position for each hospital

export interface HospitalCoordinates {
  latitude: number;
  longitude: number;
}

// Keyed by hospital name (matching Profile.location / QUEENSLAND_HOSPITALS[n].name)
const HOSPITAL_COORDINATES: Record<string, HospitalCoordinates> = {
  'Townsville University Hospital': { latitude: -19.3217, longitude: 146.7463 },
  'Royal Brisbane and Women\'s Hospital': { latitude: -27.4502, longitude: 153.0176 },
  'Princess Alexandra Hospital': { latitude: -27.4973, longitude: 153.0275 },
  'Mater Hospital Brisbane': { latitude: -27.4888, longitude: 153.0328 },
  'Gold Coast University Hospital': { latitude: -28.0005, longitude: 153.4004 },
  'Cairns Hospital': { latitude: -16.9254, longitude: 145.7558 },
  'Rockhampton Hospital': { latitude: -23.3832, longitude: 150.5018 },
  'Mackay Base Hospital': { latitude: -21.1533, longitude: 149.1633 },
  'Toowoomba Hospital': { latitude: -27.5571, longitude: 151.9556 },
  'Bundaberg Hospital': { latitude: -24.8636, longitude: 152.3540 },
};

/**
 * Get GPS coordinates for a hospital by its name.
 * Returns null if the hospital is not in the known list (e.g. custom hospital).
 */
export function getCoordinatesForHospital(hospitalName: string): HospitalCoordinates | null {
  return HOSPITAL_COORDINATES[hospitalName] ?? null;
}
