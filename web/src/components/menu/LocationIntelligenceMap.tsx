import { useEffect, useState } from "react";
import { Compass, Navigation2 } from "lucide-react";

interface LocationIntelligenceMapProps {
  latitude: number;
  longitude: number;
  cameraName: string;
}

export default function LocationIntelligenceMap({
  latitude,
  longitude,
  cameraName
}: LocationIntelligenceMapProps) {
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
    <div className="relative w-full h-full bg-[#020b18] overflow-hidden border border-[rgba(0,243,255,0.2)] rounded-none shadow-[inset_0_0_20px_rgba(0,243,255,0.05)]">
      {/* Dark Tactical Iframe Map */}
      <iframe
        title="Tactical Map"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`}
        className="w-full h-full border-none select-none pointer-events-auto opacity-70"
        style={{
          filter: "invert(90%) hue-rotate(185deg) brightness(85%) contrast(95%) saturate(80%)",
          mixBlendMode: "lighten"
        }}
      />

      {/* Grid Overlay Lines */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(0,243,255,0.01)_1px,transparent_1px)] [background-size:16px_16px]"></div>

      {/* Target Reticle Overlay (Centered) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Target Corner brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[var(--hud-cyan)]"></div>
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--hud-cyan)]"></div>

          {/* Pulsing ring */}
          <div className={`absolute inset-4 border border-[var(--hud-cyan)]/30 rounded-full ${isLocked ? "animate-ping" : ""}`}></div>
          <div className="w-1.5 h-1.5 bg-[var(--hud-cyan)] rounded-full shadow-[0_0_8px_var(--hud-cyan)]"></div>
        </div>
      </div>

      {/* Floating Tactical Telemetry */}
      <div className="absolute top-3 left-3 bg-[#020b18]/85 border border-[rgba(0,243,255,0.25)] px-2.5 py-1.5 font-mono text-[9px] text-[#e0f8ff] uppercase space-y-1 backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-1.5 text-[var(--hud-cyan)] font-bold">
          <Navigation2 size={10} className="animate-pulse" />
          LOCATION LOCK: {isLocked ? "SECURED" : "SEARCHING..."}
        </div>
        <div>CCTV NODE: {cameraName.toUpperCase()}</div>
        <div>COORDS: {latitude.toFixed(5)}N / {longitude.toFixed(5)}E</div>
      </div>

      <div className="absolute bottom-3 right-3 bg-[#020b18]/85 border border-[rgba(0,243,255,0.25)] px-2 py-1 font-mono text-[8px] text-[var(--hud-cyan)]/80 backdrop-blur-sm pointer-events-none">
        PRECISION: ±1.2m • GPS RTK-L2
      </div>

      <div className="absolute bottom-3 left-3 flex gap-1 pointer-events-none">
        <div className="w-2.5 h-2.5 border border-[var(--hud-cyan)]/30 flex items-center justify-center bg-[#020b18]/85">
          <Compass size={8} className="text-[var(--hud-cyan)] animate-spin-slow" />
        </div>
      </div>
    </div>
  );
}
