import { useEffect, useState } from "react";
import { Compass, Navigation2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LocationIntelligenceMapProps {
  latitude: number;
  longitude: number;
  cameraName: string;
}

export default function LocationIntelligenceMap({
  latitude,
  longitude,
  cameraName,
}: LocationIntelligenceMapProps) {
  const { t } = useTranslation(["views/aiviewsion"]);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    setIsLocked(false);
    const timer = setTimeout(() => setIsLocked(true), 1000);
    return () => clearTimeout(timer);
  }, [latitude, longitude]);

  // Adjust bbox around target coordinates for OpenStreetMap embed
  const delta = 0.003;
  const minLng = longitude - delta;
  const maxLng = longitude + delta;
  const minLat = latitude - delta * 0.6;
  const maxLat = latitude + delta * 0.6;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-none border border-[rgba(0,243,255,0.2)] bg-[#020b18] shadow-[inset_0_0_20px_rgba(0,243,255,0.05)]">
      {/* Dark Tactical Iframe Map */}
      <iframe
        title={t("map.tactical_map_title")}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`}
        className="pointer-events-auto h-full w-full select-none border-none opacity-70"
        style={{
          filter:
            "invert(90%) hue-rotate(185deg) brightness(85%) contrast(95%) saturate(80%)",
          mixBlendMode: "lighten",
        }}
      />

      {/* Grid Overlay Lines */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(0,243,255,0.01)_1px,transparent_1px)] [background-size:16px_16px]"></div>

      {/* Target Reticle Overlay (Centered) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Target Corner brackets */}
          <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-[var(--hud-cyan)]"></div>

          {/* Pulsing ring */}
          <div
            className={`border-[var(--hud-cyan)]/30 absolute inset-4 rounded-full border ${isLocked ? "animate-ping" : ""}`}
          ></div>
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--hud-cyan)] shadow-[0_0_8px_var(--hud-cyan)]"></div>
        </div>
      </div>

      {/* Floating Tactical Telemetry */}
      <div className="pointer-events-none absolute left-3 top-3 space-y-1 border border-[rgba(0,243,255,0.25)] bg-[#020b18]/85 px-2.5 py-1.5 font-mono text-[9px] uppercase text-[#e0f8ff] backdrop-blur-sm">
        <div className="flex items-center gap-1.5 font-bold text-[var(--hud-cyan)]">
          <Navigation2 size={10} className="animate-pulse" />
          {t("map.location_lock")}:{" "}
          {isLocked ? t("map.secured") : t("map.searching")}
        </div>
        <div>
          {t("map.cctv_node")}: {cameraName.toUpperCase()}
        </div>
        <div>
          {t("map.coords")}: {latitude.toFixed(5)}N / {longitude.toFixed(5)}E
        </div>
      </div>

      <div className="text-[var(--hud-cyan)]/80 pointer-events-none absolute bottom-3 right-3 border border-[rgba(0,243,255,0.25)] bg-[#020b18]/85 px-2 py-1 font-mono text-[8px] backdrop-blur-sm">
        {t("map.precision")}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex gap-1">
        <div className="border-[var(--hud-cyan)]/30 flex h-2.5 w-2.5 items-center justify-center border bg-[#020b18]/85">
          <Compass
            size={8}
            className="animate-spin-slow text-[var(--hud-cyan)]"
          />
        </div>
      </div>
    </div>
  );
}
