"use client";
import {
  Check,
  Clock,
  Leaf,
  MapPin,
  ShoppingBasket,
  Heart,
} from "lucide-react";
import { useApp } from "./context";
export function Neighborhood() {
  const { locale } = useApp();
  return (
    <div
      className="neighborhood"
      role="img"
      aria-label={
        locale === "en"
          ? "Illustration of neighborhood food connections in the Bronx"
          : "Ilustración de conexiones alimentarias en el Bronx"
      }
    >
      <div className="illustration-grid" />
      <div className="map-river" />
      <div className="map-park park-one" />
      <div className="map-park park-two" />
      <span className="map-label label-one">BEDFORD PARK</span>
      <span className="map-label label-two">JEROME PARK</span>
      <span className="street street-one">MOSHOLU PARKWAY</span>
      <span className="street street-two">GRAND CONCOURSE</span>
      <div className="neighborhood-heading">
        <span className="live-dot" />
        {locale === "en"
          ? "A neighborhood of possibilities"
          : "Un barrio de posibilidades"}
      </div>
      <svg viewBox="0 0 500 400" className="route-art" aria-hidden="true">
        <path
          d="M130 260 C120 200 255 270 255 173 S355 163 383 100"
          fill="none"
          stroke="#769b77"
          strokeWidth="3"
          strokeDasharray="6 8"
        />
        <path
          d="M255 173 C220 135 180 160 160 105"
          fill="none"
          stroke="#769b77"
          strokeWidth="3"
          strokeDasharray="6 8"
        />
      </svg>
      <div className="illustrated-store">
        <div className="store-roof" />
        <div className="awning">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="store-face">
          <div className="store-window">
            <Leaf size={25} />
          </div>
          <div className="store-door" />
          <div className="store-window">
            <ShoppingBasket size={25} />
          </div>
        </div>
        <div className="store-name">PANTRY</div>
        <div className="plant plant-left">✦</div>
        <div className="plant plant-right">✦</div>
      </div>
      <div className="pin pin-one">
        <ShoppingBasket size={20} />
      </div>
      <div className="pin pin-two">
        <Heart size={18} />
      </div>
      <div className="pin pin-three">
        <Leaf size={18} />
      </div>
      <div className="fit-card">
        <span className="fit-check">
          <Check size={17} />
        </span>
        <div>
          <strong>
            {locale === "en"
              ? "More than nearby. A better fit."
              : "Más que cerca. Mejor para ti."}
          </strong>
          <span>
            {locale === "en"
              ? "Your needs. Your neighborhood."
              : "Tus necesidades. Tu comunidad."}
          </span>
        </div>
      </div>
      <div className="little-card">
        <Clock size={17} />
        <span>
          {locale === "en"
            ? "Works with your schedule"
            : "Se adapta a tu horario"}
        </span>
      </div>
      <div className="bronx-badge">
        <MapPin size={14} /> BRONX, NY <span>10468</span>
      </div>
    </div>
  );
}
