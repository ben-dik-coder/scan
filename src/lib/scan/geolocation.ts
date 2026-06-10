export type UserPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type GeolocationFailureReason =
  | "unsupported"
  | "insecure"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export class GeolocationError extends Error {
  reason: GeolocationFailureReason;

  constructor(reason: GeolocationFailureReason, message: string) {
    super(message);
    this.name = "GeolocationError";
    this.reason = reason;
  }
}

/** Kort forklaring før vi ber om GPS (personvern). */
export const GPS_PRIVACY_HINT =
  "Vi bruker posisjonen din bare nå for å finne kommune — den lagres ikke.";

function failureReason(code?: number): GeolocationFailureReason {
  if (code === 1) return "denied";
  if (code === 2) return "unavailable";
  if (code === 3) return "timeout";
  return "unknown";
}

/** Venlig norsk feilmelding for vanlige GPS-feil. */
export function describeGeolocationFailure(reason: GeolocationFailureReason): string {
  switch (reason) {
    case "unsupported":
      return "Enheten din støtter ikke GPS her.";
    case "insecure":
      return "GPS krever sikker tilkobling (HTTPS).";
    case "denied":
      return "Du sa nei til posisjon. Velg kommune manuelt under.";
    case "unavailable":
      return "Kunne ikke finne posisjonen din akkurat nå.";
    case "timeout":
      return "GPS tok for lang tid. Prøv igjen eller velg kommune manuelt.";
    default:
      return "Kunne ikke hente posisjon. Velg kommune manuelt under.";
  }
}

function getCurrentPosition(
  options?: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** Én GPS-forespørsel — kun når brukeren velger «Bransje i mitt område». */
export async function requestUserPosition(
  options?: PositionOptions
): Promise<UserPosition> {
  if (typeof window === "undefined") {
    throw new GeolocationError("unsupported", describeGeolocationFailure("unsupported"));
  }
  if (!window.isSecureContext) {
    throw new GeolocationError("insecure", describeGeolocationFailure("insecure"));
  }
  if (!navigator.geolocation) {
    throw new GeolocationError("unsupported", describeGeolocationFailure("unsupported"));
  }

  const opts: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 12_000,
    maximumAge: 60_000,
    ...options,
  };

  try {
    const pos = await getCurrentPosition(opts);
    const { latitude, longitude, accuracy } = pos.coords;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new GeolocationError("unavailable", describeGeolocationFailure("unavailable"));
    }
    return {
      lat: latitude,
      lng: longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
    };
  } catch (err) {
    if (err instanceof GeolocationError) throw err;
    const geoErr = err as GeolocationPositionError;
    const reason = failureReason(geoErr?.code);
    throw new GeolocationError(reason, describeGeolocationFailure(reason));
  }
}
