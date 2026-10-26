"use client";
import { ExternalLink } from "lucide-react";
import { googleMapsDirectionsUrl } from "@/lib/directions";
import type { Provider } from "@/lib/model";
import { useApp } from "./context";

export function DirectionsLink({
  provider,
  className = "text-link",
}: {
  provider: Provider;
  className?: string;
}) {
  const { t, locale } = useApp();
  const href = provider.demo
    ? null
    : googleMapsDirectionsUrl(provider.address?.[locale]);
  if (!href) return null;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t.directions}
      <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
}
