/** Build a destination-only Maps URL; never read or send the user's location. */
export function googleMapsDirectionsUrl(address: unknown): string | null {
  if (typeof address !== "string") return null;
  const destination = address.trim();
  if (
    !/\p{L}/u.test(destination) ||
    /^(?:unknown|unknown address|address unknown|address unavailable|address not available|not available|n\/?a|tbd|desconocid[ao]|dirección desconocida|dirección no disponible)$/iu.test(
      destination,
    )
  )
    return null;
  try {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    return url.length <= 2048 ? url : null;
  } catch {
    return null;
  }
}
