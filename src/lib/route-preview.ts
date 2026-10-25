import type { Provider } from "./model";
import { distanceKm } from "./matching";
export type Point = { lat: number; lng: number };
export const exampleOrigin: Point = { lat: 40.867, lng: -73.897 };
export function validPoint(p: Point) {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 85.0511 &&
    Math.abs(p.lng) <= 180
  );
}
export function approximateRoute(provider: Provider, location?: Point) {
  const origin = provider.demo ? exampleOrigin : location;
  if (
    !origin ||
    (!provider.demo && !provider.coordinatesVerified) ||
    !validPoint(origin) ||
    !validPoint(provider.coordinates)
  )
    return null;
  const directKm = distanceKm(origin, provider.coordinates);
  // Planning range only: 4.8 km/h, with 20–60% allowance for street detours.
  // It deliberately does not populate Provider.travel or assert route compatibility.
  const baseline = (directKm / 4.8) * 60;
  return {
    origin,
    destination: provider.coordinates,
    directKm,
    minMinutes: Math.max(1, Math.floor((baseline * 1.2) / 5) * 5),
    maxMinutes: Math.max(5, Math.ceil((baseline * 1.6) / 5) * 5),
    example: provider.demo,
  };
}
export function project(point: Point, zoom: number) {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin(
    (Math.max(-85.0511, Math.min(85.0511, point.lat)) * Math.PI) / 180,
  );
  return {
    x: ((point.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}
export function mapViewport(points: Point[], zoomDelta = 0) {
  const positions = points.filter(validPoint);
  if (!positions.length) positions.push(exampleOrigin);
  let zoom = 15;
  const bounds = (z: number) => {
    const p = positions.map((v) => project(v, z));
    return {
      left: Math.min(...p.map((v) => v.x)),
      right: Math.max(...p.map((v) => v.x)),
      top: Math.min(...p.map((v) => v.y)),
      bottom: Math.max(...p.map((v) => v.y)),
    };
  };
  while (zoom > 2) {
    const b = bounds(zoom);
    if (b.right - b.left < 500 && b.bottom - b.top < 240) break;
    zoom--;
  }
  zoom = Math.max(2, Math.min(18, zoom + zoomDelta));
  const b = bounds(zoom);
  return {
    zoom,
    left: (b.left + b.right) / 2 - 320,
    top: (b.top + b.bottom) / 2 - 180,
  };
}
