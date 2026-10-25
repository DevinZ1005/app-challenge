"use client";
import { useState } from "react";
import {
  MapPin,
  Footprints,
  ArrowRight,
  Map,
  Plus,
  Minus,
  LocateFixed,
} from "lucide-react";
import type { Provider } from "@/lib/model";
import {
  approximateRoute,
  mapViewport,
  project,
  validPoint,
} from "@/lib/route-preview";
import { useApp } from "./context";

function TileMap({
  providers,
  selected,
  onSelect,
}: {
  providers: Provider[];
  selected: Provider;
  onSelect: (id: string) => void;
}) {
  const { locale, preferences } = useApp();
  const en = locale === "en";
  const [zoom, setZoom] = useState(0);
  const [failed, setFailed] = useState(false);
  const route = approximateRoute(selected, preferences.location);
  const visible = providers.filter(
    (p) => (p.demo || p.coordinatesVerified) && validPoint(p.coordinates),
  );
  const viewport = mapViewport(
    [...visible.map((p) => p.coordinates), ...(route ? [route.origin] : [])],
    zoom,
  );
  const position = (p: { lat: number; lng: number }) => {
    const v = project(p, viewport.zoom);
    return { x: v.x - viewport.left, y: v.y - viewport.top };
  };
  const start = route && position(route.origin);
  const end = position(selected.coordinates);
  const tiles = [];
  for (
    let x = Math.floor(viewport.left / 256);
    x <= Math.floor((viewport.left + 640) / 256);
    x++
  ) {
    for (
      let y = Math.floor(viewport.top / 256);
      y <= Math.floor((viewport.top + 360) / 256);
      y++
    ) {
      if (y < 0 || y >= 2 ** viewport.zoom) continue;
      tiles.push({
        x,
        y,
        tileX:
          ((x % 2 ** viewport.zoom) + 2 ** viewport.zoom) % 2 ** viewport.zoom,
      });
    }
  }
  return (
    <div className="map-frame">
      <div className="map-controls">
        <span>{en ? "Select a numbered pin" : "Elige un marcador"}</span>
        <div>
          <button
            type="button"
            aria-label={en ? "Zoom in" : "Acercar"}
            disabled={viewport.zoom === 18}
            onClick={() => setZoom(zoom + 1)}
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            aria-label={en ? "Zoom out" : "Alejar"}
            disabled={viewport.zoom === 2}
            onClick={() => setZoom(zoom - 1)}
          >
            <Minus size={17} />
          </button>
          <button
            type="button"
            aria-label={en ? "Fit all locations" : "Mostrar ubicaciones"}
            onClick={() => setZoom(0)}
          >
            <LocateFixed size={17} />
          </button>
        </div>
      </div>
      <div
        className="tile-map"
        aria-label={en ? "Service locations map" : "Mapa de servicios"}
      >
        {tiles.map((tile) => (
          /* Browser caching and a referrer are required by OSM tile policy. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${viewport.zoom}/${tile.x}/${tile.y}`}
            alt=""
            draggable={false}
            referrerPolicy="strict-origin-when-cross-origin"
            src={`https://tile.openstreetmap.org/${viewport.zoom}/${tile.tileX}/${tile.y}.png`}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
              setFailed(true);
            }}
            style={{
              left: `${((tile.x * 256 - viewport.left) / 640) * 100}%`,
              top: `${((tile.y * 256 - viewport.top) / 360) * 100}%`,
              width: "40%",
              height: `${(256 / 360) * 100}%`,
            }}
          />
        ))}
        <svg
          viewBox="0 0 640 360"
          className="map-route-line"
          aria-hidden="true"
        >
          {start && (
            <>
              <path
                d={`M${start.x},${start.y} L${end.x},${end.y}`}
                stroke="white"
                strokeWidth="8"
                fill="none"
              />
              <path
                d={`M${start.x},${start.y} L${end.x},${end.y}`}
                stroke="#245c46"
                strokeWidth="4"
                strokeDasharray="9 7"
                fill="none"
              />
              <circle
                cx={start.x}
                cy={start.y}
                r="9"
                fill="#245c46"
                stroke="white"
                strokeWidth="4"
              />
            </>
          )}
        </svg>
        {visible.map((p, i) => {
          const v = position(p.coordinates);
          return (
            <button
              key={p.id}
              type="button"
              className={
                "map-marker " + (p.id === selected.id ? "selected" : "")
              }
              style={{
                left: `${(v.x / 640) * 100}%`,
                top: `${(v.y / 360) * 100}%`,
              }}
              aria-label={`${i + 1}. ${p.name[locale]}`}
              aria-pressed={p.id === selected.id}
              onClick={() => onSelect(p.id)}
            >
              {i + 1}
            </button>
          );
        })}
        <a
          className="map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
      {failed && (
        <p role="status" className="small-text">
          {en
            ? "Map tiles could not load. The numbered locations and route summary are still available."
            : "No se cargó el mapa. Las ubicaciones y el resumen siguen disponibles."}
        </p>
      )}
    </div>
  );
}

export function RouteMap({
  providers,
  expanded = false,
}: {
  providers: Provider[];
  expanded?: boolean;
}) {
  const { locale, preferences, setPreferences, t } = useApp();
  const en = locale === "en";
  const [selectedId, setSelectedId] = useState(providers[0]?.id || "");
  const [showMap, setShowMap] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const selected = providers.find((p) => p.id === selectedId) || providers[0];
  if (!selected) return null;
  const route = approximateRoute(selected, preferences.location);
  const canMap =
    (selected.demo || selected.coordinatesVerified) &&
    validPoint(selected.coordinates);
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(t.locationError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPreferences({
          ...preferences,
          location: {
            lat: Math.round(pos.coords.latitude * 1000) / 1000,
            lng: Math.round(pos.coords.longitude * 1000) / 1000,
          },
        });
        setLocationMessage(t.locationSuccess);
      },
      () => setLocationMessage(t.locationError),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }
  return (
    <section
      className="route-preview"
      aria-label={en ? "Approximate route" : "Ruta aproximada"}
    >
      <div className="route-heading">
        <div>
          <span className="eyebrow">
            {en ? "PLAN YOUR PICKUP" : "PLANIFICA TU RECOGIDA"}
          </span>
          <h2>
            <Footprints size={22} />
            {en ? "Approximate route" : "Ruta aproximada"}
          </h2>
        </div>
        <span className="route-badge">
          {selected.demo
            ? en
              ? "Fictional example"
              : "Ejemplo ficticio"
            : en
              ? "Planning estimate"
              : "Estimación"}
        </span>
      </div>
      {providers.length > 1 && (
        <label>
          {en ? "Preview a destination" : "Elige un destino"}
          <select
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {providers.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.name[locale]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="route-journey">
        <div>
          <span className="route-dot" />
          <span>
            {route?.example
              ? en
                ? "Example starting point · Bedford Park"
                : "Inicio de ejemplo · Bedford Park"
              : preferences.location
                ? en
                  ? "Your approximate location"
                  : "Tu ubicación aproximada"
                : en
                  ? "Choose your starting point"
                  : "Elige el punto de partida"}
          </span>
        </div>
        <ArrowRight size={18} />
        <div>
          <MapPin size={18} />
          <strong>{selected.name[locale]}</strong>
        </div>
      </div>
      {route ? (
        <>
          <div className="route-estimate">
            <strong>
              {route.minMinutes}–{route.maxMinutes} <span>{t.minutes}</span>
            </strong>
            <span>
              {en ? "approx. walking" : "a pie, aprox."} ·{" "}
              {route.directKm.toFixed(1)} km{" "}
              {en ? "direct distance" : "distancia directa"}
            </span>
          </div>
          <p className="route-preference">
            {en ? "Your preferred range" : "Tu intervalo preferido"}:{" "}
            {preferences.minMinutes}–{preferences.maxMinutes} {t.minutes}
            {" · "}
            {route.maxMinutes >= preferences.minMinutes &&
            route.minMinutes <= preferences.maxMinutes
              ? en
                ? "estimate overlaps"
                : "la estimación coincide"
              : en
                ? "estimate falls outside"
                : "la estimación queda fuera"}
          </p>
          <p className="small-text">
            {en
              ? "The dashed line connects the two points; it does not follow streets. Walking time uses distance plus an allowance for detours. Crossings, accessibility and transit schedules need confirmation."
              : "La línea une los puntos sin seguir calles. El tiempo a pie incluye un margen para desvíos. Confirma cruces, accesibilidad y horarios de transporte."}
          </p>
          {selected.demo && (
            <p className="notice">
              {en
                ? "This is an example trip to a fictional service. Do not use it for navigation."
                : "Es un ejemplo hacia un servicio ficticio. No lo uses para navegar."}
            </p>
          )}
          {preferences.mode === "transit" && (
            <p className="small-text">
              {en
                ? "Walking preview only. Public transportation times are not available yet."
                : "Solo vista a pie. Aún no hay tiempos de transporte público."}
            </p>
          )}
        </>
      ) : (
        <p>
          {en
            ? canMap
              ? "Add your location to estimate the walk. ZIP codes and landmarks are not geocoded yet."
              : "This listing needs verified coordinates before a route can be shown."
            : canMap
              ? "Añade tu ubicación para estimar la caminata. Los códigos postales aún no se geocodifican."
              : "Este registro necesita coordenadas verificadas para mostrar una ruta."}
        </p>
      )}
      {!selected.demo && canMap && (
        <button
          type="button"
          className="button secondary small"
          onClick={locate}
        >
          <LocateFixed size={16} />
          {t.locate}
        </button>
      )}
      {locationMessage && <p role="status">{locationMessage}</p>}
      {canMap &&
        (showMap || expanded ? (
          <TileMap
            key={selected.id}
            providers={providers}
            selected={selected}
            onSelect={setSelectedId}
          />
        ) : (
          <button
            type="button"
            className="button secondary small"
            onClick={() => setShowMap(true)}
          >
            <Map size={17} />
            {en ? "Show route on map" : "Mostrar ruta en el mapa"}
          </button>
        ))}
      {canMap && (
        <p className="map-privacy small-text">
          {en
            ? "Opening the map loads tiles from OpenStreetMap, which receives your IP address and the viewed map area."
            : "Al abrir el mapa, OpenStreetMap recibe tu dirección IP y el área que ves."}
        </p>
      )}
    </section>
  );
}
