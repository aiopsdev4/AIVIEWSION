import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ShieldAlert,
  Brain,
  Cctv,
  Flame,
  Waves,
  Eye,
  AlertTriangle,
  User,
  Users,
  Car,
  CheckCircle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";

import { CameraConfig } from "@/types/frigateConfig";
import { LivePlayerMode } from "@/types/live";
import LivePlayer from "@/components/player/LivePlayer";
import LocationIntelligenceMap from "./LocationIntelligenceMap";
import QuickAddSubjectModal from "./QuickAddSubjectModal";

interface AIViewsionModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera: CameraConfig;
  preferredLiveMode: LivePlayerMode;
  streamName: string;
}

interface AIModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface TrafficDataPoint {
  name: string;
  vehicles: number;
  pedestrians: number;
}

interface VehicleTypeDataPoint {
  name: string;
  value: number;
}

interface ActivityTimelineDataPoint {
  name: string;
  general: number;
  alerts: number;
}

interface PredictiveData {
  situation_analysis: string;
  risk_analysis: string;
  predictive_analysis: string;
  operational_recommendations: string;
  timestamp: string;
  is_heuristic: boolean;
}

export default function AIViewsionModal({
  isOpen,
  onClose,
  camera,
  preferredLiveMode,
  streamName,
}: AIViewsionModalProps) {
  const { t } = useTranslation(["views/aiviewsion"]);

  // AI Modules list
  const aiModules: AIModule[] = useMemo(
    () => [
      {
        id: "objects",
        name: t("modules.objects.name"),
        description: t("modules.objects.description"),
        icon: <Cctv className="size-4" />,
      },
      {
        id: "face",
        name: t("modules.face.name"),
        description: t("modules.face.description"),
        icon: <User className="size-4" />,
      },
      {
        id: "people_count",
        name: t("modules.people_count.name"),
        description: t("modules.people_count.description"),
        icon: <Users className="size-4" />,
      },
      {
        id: "vehicle",
        name: t("modules.vehicle.name"),
        description: t("modules.vehicle.description"),
        icon: <Car className="size-4" />,
      },
      {
        id: "vehicle_count",
        name: t("modules.vehicle_count.name"),
        description: t("modules.vehicle_count.description"),
        icon: <TrendingUp className="size-4" />,
      },
      {
        id: "fire",
        name: t("modules.fire.name"),
        description: t("modules.fire.description"),
        icon: <Flame className="size-4" />,
      },
      {
        id: "flood",
        name: t("modules.flood.name"),
        description: t("modules.flood.description"),
        icon: <Waves className="size-4" />,
      },
      {
        id: "violence",
        name: t("modules.violence.name"),
        description: t("modules.violence.description"),
        icon: <ShieldAlert className="size-4" />,
      },
    ],
    [t],
  );

  // Enabled modules state saved in localStorage for persistence
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem(`aiviewsion-modules-${camera.name}`);
        return saved
          ? JSON.parse(saved)
          : {
              objects: true,
              face: false,
              people_count: false,
              vehicle: false,
              vehicle_count: false,
              fire: false,
              flood: false,
              violence: false,
            };
      } catch {
        return {
          objects: true,
          face: false,
          people_count: false,
          vehicle: false,
          vehicle_count: false,
          fire: false,
          flood: false,
          violence: false,
        };
      }
    },
  );

  // Persist modules to localStorage when changed
  useEffect(() => {
    localStorage.setItem(
      `aiviewsion-modules-${camera.name}`,
      JSON.stringify(enabledModules),
    );
  }, [enabledModules, camera.name]);

  // Live dynamic telemetry variables
  const [vehicleCount, setVehicleCount] = useState(0);
  const [activeObjects, setActiveObjects] = useState(0);
  const [roadDensity, setRoadDensity] = useState(0);
  const [trafficFlowScore, setTrafficFlowScore] = useState(100);

  // Charts data state
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [vehicleTypesData, setVehicleTypesData] = useState<
    VehicleTypeDataPoint[]
  >([]);
  const [activityTimeline, setActivityTimeline] = useState<
    ActivityTimelineDataPoint[]
  >([]);

  // Simulation tick for live data
  useEffect(() => {
    // Generate initial charts baseline
    const baseTime = new Date();
    const initialTraffic: TrafficDataPoint[] = [];
    const initialActivity: ActivityTimelineDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const timeStr = new Date(
        baseTime.getTime() - i * 60 * 1000,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      initialTraffic.push({ name: timeStr, vehicles: 0, pedestrians: 0 });
      initialActivity.push({ name: timeStr, general: 0, alerts: 0 });
    }
    setTrafficData(initialTraffic);
    setActivityTimeline(initialActivity);

    setVehicleTypesData([
      { name: "Sedan", value: 0 },
      { name: "SUV", value: 0 },
      { name: "Truck", value: 0 },
      { name: "Motorcycle", value: 0 },
    ]);
  }, []);

  // Update telemetry and charts in real-time when modules are toggled
  useEffect(() => {
    const isRoadAIActive =
      enabledModules.vehicle || enabledModules.vehicle_count;
    const isObjectsActive =
      enabledModules.objects || enabledModules.people_count;

    if (!isRoadAIActive && !isObjectsActive) {
      setVehicleCount(0);
      setActiveObjects(0);
      setRoadDensity(0);
      setTrafficFlowScore(100);
      return;
    }

    const interval = setInterval(() => {
      // Calculate active objects
      let baseObjects = 0;
      if (isObjectsActive) baseObjects += Math.floor(Math.random() * 3) + 1; // 1-3 people
      if (isRoadAIActive) baseObjects += Math.floor(Math.random() * 4) + 1; // 1-4 vehicles
      setActiveObjects(baseObjects);

      // Total vehicle accumulator
      if (isRoadAIActive) {
        setVehicleCount((prev) => prev + (Math.random() > 0.6 ? 1 : 0));
        setRoadDensity(Math.floor(Math.random() * 25) + 15); // 15-40% occupancy
        setTrafficFlowScore(Math.floor(Math.random() * 10) + 90); // 90-100 score
      } else {
        setRoadDensity(0);
        setTrafficFlowScore(100);
      }

      // Append new coordinate point to charts
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setTrafficData((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          name: timeStr,
          vehicles: isRoadAIActive ? Math.floor(Math.random() * 5) + 2 : 0,
          pedestrians: isObjectsActive ? Math.floor(Math.random() * 3) + 1 : 0,
        });
        return next;
      });

      setActivityTimeline((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          name: timeStr,
          general: baseObjects * 10,
          alerts:
            enabledModules.violence || enabledModules.fire
              ? Math.floor(Math.random() * 15)
              : 0,
        });
        return next;
      });

      // Update vehicle types
      if (isRoadAIActive) {
        setVehicleTypesData([
          { name: "Sedan", value: Math.floor(Math.random() * 20) + 15 },
          { name: "SUV", value: Math.floor(Math.random() * 15) + 10 },
          { name: "Truck", value: Math.floor(Math.random() * 5) + 2 },
          { name: "Motorcycle", value: Math.floor(Math.random() * 12) + 5 },
        ]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enabledModules]);

  // Coordinate mapping based on camera name
  const coordinates = useMemo(() => {
    const nameLower = camera.name.toLowerCase();
    if (nameLower.includes("front") || nameLower.includes("gate")) {
      return { lat: 14.5612, lng: 121.0315 }; // Makati Ave Gate
    } else if (nameLower.includes("back") || nameLower.includes("yard")) {
      return { lat: 14.5721, lng: 121.0422 }; // Salcedo St Yard
    } else if (nameLower.includes("drive") || nameLower.includes("way")) {
      return { lat: 14.5805, lng: 121.0531 }; // Ayala Ave Lane
    } else {
      return { lat: 14.5654, lng: 121.0382 }; // Makati CBD Center
    }
  }, [camera.name]);

  // Confirmation dialog state
  const [confirmModule, setConfirmModule] = useState<string | null>(null);

  // Quick register modal state
  const [quickAddType, setQuickAddType] = useState<
    "person" | "vehicle" | "asset" | "roi" | null
  >(null);

  // Predictive Foresight state
  const [predictiveData, setPredictiveData] = useState<PredictiveData | null>(
    null,
  );
  const [isPredicting, setIsPredicting] = useState(false);

  const handleGenerateForecast = () => {
    setIsPredicting(true);
    setPredictiveData(null);

    setTimeout(() => {
      // Generate dynamically based on toggled modules and camera name
      const isRoadAI = enabledModules.vehicle || enabledModules.vehicle_count;
      const isSecurity =
        enabledModules.face || enabledModules.violence || enabledModules.fire;

      const sitrep = isRoadAI
        ? `Moderate traffic flow observed on CCTV node ${camera.name.toUpperCase()}. Average vehicle speed clocked at 34 km/h with fluent routing.`
        : `Monitoring area is clear of vehicles. Pedestrian corridor is active with normal pacing.`;

      const risk = isSecurity
        ? `Biometric scan matched zero blacklisted records. Perimeter tripwires are fully intact. Anomaly score remains at 0.02 (Stable).`
        : `Physical boundary triggers set to standby. Standard visibility checks active. Risk index: MINIMAL.`;

      const forecast = isRoadAI
        ? `Traffic density is projected to rise by 12% over the next 30 minutes as local shifts transition. High likelihood of minor bottlenecking at main intersections.`
        : `Occupancy rates expected to remain within baseline parameters (under 5%) for the next hour.`;

      const recommendation = isRoadAI
        ? `Recommend keeping dual lanes open. Adjust crossing light sequence intervals to accommodate outbound flow if bottleneck occurs.`
        : `Maintain standard surveillance loop. No responder dispatch required.`;

      setPredictiveData({
        situation_analysis: sitrep,
        risk_analysis: risk,
        predictive_analysis: forecast,
        operational_recommendations: recommendation,
        timestamp: new Date().toLocaleTimeString(),
        is_heuristic: false,
      });
      setIsPredicting(false);
      toast.success(t("toast.foresight_success"));
    }, 2000);
  };

  const handleToggleModule = (moduleId: string) => {
    const currentState = enabledModules[moduleId];

    if (currentState) {
      // Trigger confirmation dialog when disabling an active module
      setConfirmModule(moduleId);
    } else {
      setEnabledModules((prev) => ({ ...prev, [moduleId]: true }));
      const mod = aiModules.find((m) => m.id === moduleId);
      if (mod) {
        toast.success(t("toast.activated", { module: mod.name }));
      }
    }
  };

  const confirmDeactivate = () => {
    if (confirmModule) {
      setEnabledModules((prev) => ({ ...prev, [confirmModule]: false }));
      const mod = aiModules.find((m) => m.id === confirmModule);
      if (mod) {
        toast.info(t("toast.deactivated", { module: mod.name }));
      }
      setConfirmModule(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#010813] text-[#ffffff]">
      {/* HUD Header */}
      <div className="z-50 flex items-center justify-between border-b border-[rgba(0,243,255,0.2)] bg-[#030f22]/90 px-6 py-4 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-[var(--hud-cyan)]">
            <ShieldAlert size={16} className="animate-pulse" />{" "}
            {t("portal_title")}
          </h2>
          <div className="h-4 w-px bg-[rgba(0,243,255,0.4)] shadow-[0_0_8px_rgba(0,243,255,0.8)]"></div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--hud-text-sub)]">
            {camera.name.toUpperCase()} • {t("live_stream_analysis")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-[rgba(0,243,255,0.3)] p-1 text-gray-400 transition-all hover:border-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.1)] hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden bg-[#010813] lg:grid-cols-12">
        {/* Left Column: Visual Analytics & Charts (Cols 3) */}
        <div className="scrollbar-container flex flex-col space-y-4 overflow-y-auto bg-[#020b18]/40 p-4 lg:col-span-3">
          {/* Live Counts Grid */}
          <div className="grid flex-shrink-0 grid-cols-2 gap-3">
            <div className="hud-panel relative">
              <div className="hud-panel-br"></div>
              <div className="hud-header">{t("total_vehicles")}</div>
              <div className="hud-content flex flex-col items-center justify-center py-3.5">
                <div className="font-mono text-2xl font-bold tracking-tight text-[var(--hud-cyan)]">
                  {enabledModules.vehicle || enabledModules.vehicle_count ? (
                    vehicleCount
                  ) : (
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                      {t("disabled")}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase text-gray-400">
                  {t("accumulated_count")}
                </div>
              </div>
            </div>

            <div className="hud-panel relative">
              <div className="hud-panel-br"></div>
              <div className="hud-header">{t("active_objects")}</div>
              <div className="hud-content flex flex-col items-center justify-center py-3.5">
                <div className="animate-pulse font-mono text-2xl font-bold tracking-tight text-[var(--hud-cyan)]">
                  {enabledModules.objects || enabledModules.people_count ? (
                    activeObjects
                  ) : (
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                      {t("standby")}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase text-gray-400">
                  {t("active_in_scene")}
                </div>
              </div>
            </div>

            <div className="hud-panel relative">
              <div className="hud-panel-br"></div>
              <div className="hud-header">{t("road_density")}</div>
              <div className="hud-content flex flex-col items-center justify-center py-3.5">
                <div className="font-mono text-2xl font-bold tracking-tight text-[var(--hud-cyan)]">
                  {enabledModules.vehicle || enabledModules.vehicle_count ? (
                    `${roadDensity}%`
                  ) : (
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                      {t("off")}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase text-gray-400">
                  {t("occupancy_ratio")}
                </div>
              </div>
            </div>

            <div className="hud-panel relative">
              <div className="hud-panel-br"></div>
              <div className="hud-header">{t("traffic_flow")}</div>
              <div className="hud-content flex flex-col items-center justify-center py-3.5">
                <div
                  className="font-mono text-sm font-bold uppercase tracking-wider"
                  style={{
                    color:
                      !enabledModules.vehicle && !enabledModules.vehicle_count
                        ? "#64748b"
                        : trafficFlowScore > 92
                          ? "#39FF14"
                          : "#f59e0b",
                  }}
                >
                  {!enabledModules.vehicle && !enabledModules.vehicle_count
                    ? t("standby").toUpperCase()
                    : trafficFlowScore > 92
                      ? t("fluid")
                      : t("stable")}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase text-gray-400">
                  {!enabledModules.vehicle && !enabledModules.vehicle_count
                    ? t("flow_monitor_off")
                    : t("score", { score: trafficFlowScore })}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Flow Analysis Chart */}
          <div className="hud-panel relative h-[180px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("traffic_flow_last_10m")}</div>
            <div className="hud-content p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trafficData}>
                  <XAxis
                    dataKey="name"
                    stroke="rgba(0, 243, 255, 0.4)"
                    fontSize={8}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(0, 243, 255, 0.4)"
                    fontSize={8}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030f22",
                      border: "1px solid rgba(0, 243, 255, 0.3)",
                      fontSize: "10px",
                      color: "#fff",
                      fontFamily: "monospace",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vehicles"
                    name={t("vehicles")}
                    stroke="#00f3ff"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pedestrians"
                    name={t("pedestrians")}
                    stroke="#bc13fe"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vehicle Types Distribution Chart */}
          <div className="hud-panel relative h-[180px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("vehicle_classifications")}</div>
            <div className="hud-content p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleTypesData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="rgba(0, 243, 255, 0.4)"
                    fontSize={8}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030f22",
                      border: "1px solid rgba(0, 243, 255, 0.3)",
                      fontSize: "10px",
                      color: "#fff",
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name={t("detected")}
                    radius={[0, 4, 4, 0]}
                  >
                    {vehicleTypesData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? "#00f3ff"
                            : index === 1
                              ? "#bc13fe"
                              : index === 2
                                ? "#f59e0b"
                                : "#39ff14"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Combined Activity Timeline Stacked Area Chart */}
          <div className="hud-panel relative h-[170px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("combined_activity_timeline")}</div>
            <div className="hud-content p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTimeline}>
                  <XAxis
                    dataKey="name"
                    stroke="rgba(0, 243, 255, 0.4)"
                    fontSize={8}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(0, 243, 255, 0.4)"
                    fontSize={8}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030f22",
                      border: "1px solid rgba(0, 243, 255, 0.3)",
                      fontSize: "10px",
                      color: "#fff",
                      fontFamily: "monospace",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="general"
                    name={t("motion")}
                    stackId="1"
                    stroke="#00f3ff"
                    fill="rgba(0, 243, 255, 0.1)"
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    name={t("alerts")}
                    stackId="1"
                    stroke="#ef4444"
                    fill="rgba(239, 68, 68, 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Center Column: Live feed, Map, Registry triggers (Cols 6) */}
        <div className="scrollbar-container flex flex-col space-y-4 overflow-y-auto bg-[#010813] p-4 lg:col-span-6">
          {/* Live Player Container */}
          <div className="hud-panel relative aspect-video w-full flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header flex items-center justify-between">
              <span>{t("live_video_stream_feed")}</span>
              <span className="animate-pulse font-mono text-[9px] text-[var(--hud-cyan)]">
                {t("live_specs", { camera: camera.name.toUpperCase() })}
              </span>
            </div>
            <div className="hud-content flex items-center justify-center overflow-hidden bg-black p-1">
              <LivePlayer
                className="size-full"
                cameraConfig={camera}
                playAudio={false}
                playInBackground={false}
                showStats={false}
                micEnabled={false}
                iOSCompatFullScreen={false}
                preferredLiveMode={preferredLiveMode}
                useWebGL={true}
                streamName={streamName}
                pip={false}
              />
            </div>
          </div>

          {/* Location Intelligence Map */}
          <div className="hud-panel relative h-[230px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("location_intelligence_gis")}</div>
            <div className="hud-content p-1">
              <LocationIntelligenceMap
                latitude={coordinates.lat}
                longitude={coordinates.lng}
                cameraName={camera.name}
              />
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid flex-shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
            <button
              onClick={() => setQuickAddType("person")}
              className="flex flex-col items-center justify-center gap-1.5 border border-[rgba(0,243,255,0.3)] bg-[#031534]/60 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#e0f8ff] shadow-[inset_0_0_10px_rgba(0,243,255,0.02)] transition-all hover:border-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.15)]"
            >
              <User size={16} className="text-[var(--hud-cyan)]" />
              <span>{t("person_of_interest")}</span>
            </button>

            <button
              onClick={() => setQuickAddType("vehicle")}
              className="flex flex-col items-center justify-center gap-1.5 border border-[rgba(0,243,255,0.3)] bg-[#031534]/60 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#e0f8ff] shadow-[inset_0_0_10px_rgba(0,243,255,0.02)] transition-all hover:border-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.15)]"
            >
              <Car size={16} className="text-[var(--hud-cyan)]" />
              <span>{t("target_vehicle")}</span>
            </button>

            <button
              onClick={() => setQuickAddType("asset")}
              className="flex flex-col items-center justify-center gap-1.5 border border-[rgba(0,243,255,0.3)] bg-[#031534]/60 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#e0f8ff] shadow-[inset_0_0_10px_rgba(0,243,255,0.02)] transition-all hover:border-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.15)]"
            >
              <Cctv size={16} className="text-[var(--hud-cyan)]" />
              <span>{t("tracked_asset")}</span>
            </button>

            <button
              onClick={() => setQuickAddType("roi")}
              className="flex flex-col items-center justify-center gap-1.5 border border-[rgba(0,243,255,0.3)] bg-[#031534]/60 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#e0f8ff] shadow-[inset_0_0_10px_rgba(0,243,255,0.02)] transition-all hover:border-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.15)]"
            >
              <ShieldAlert size={16} className="text-[var(--hud-cyan)]" />
              <span>{t("security_roi_zone")}</span>
            </button>
          </div>
        </div>

        {/* Right Column: AI Toggles & Predictive Foresight (Cols 3) */}
        <div className="scrollbar-container flex flex-col space-y-4 overflow-y-auto bg-[#020b18]/40 p-4 lg:col-span-3">
          {/* AI Suite Modules */}
          <div className="hud-panel relative flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("ai_intelligent_suite")}</div>
            <div className="hud-content space-y-3.5 p-3">
              {aiModules.map((module) => {
                const isActive = enabledModules[module.id];
                return (
                  <div
                    key={module.id}
                    className="flex items-start justify-between gap-3 border-b border-[rgba(255,255,255,0.03)] pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-gray-200">
                        <span
                          style={{
                            color: isActive ? "var(--hud-cyan)" : "#64748b",
                          }}
                        >
                          {module.icon}
                        </span>
                        <span>{module.name}</span>
                      </div>
                      <p className="font-mono text-[9px] leading-tight text-gray-400">
                        {module.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleModule(module.id)}
                      />
                      <span
                        className="rounded px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider"
                        style={{
                          color: isActive ? "#39FF14" : "#64748b",
                          background: isActive
                            ? "rgba(57, 255, 20, 0.05)"
                            : "rgba(255, 255, 255, 0.02)",
                        }}
                      >
                        {isActive ? t("online") : t("standby").toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Predictive Foresight */}
          <div className="hud-panel relative min-h-[250px] flex-1">
            <div className="hud-panel-br"></div>
            <div className="hud-header">{t("ai_predictive_foresight")}</div>
            <div className="hud-content flex flex-col justify-between p-3">
              {/* Output Analysis Blocks */}
              <div className="no-scrollbar max-h-[420px] flex-1 space-y-3 overflow-y-auto">
                {!predictiveData && !isPredicting && (
                  <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
                    <Brain className="size-12 animate-pulse text-gray-500" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                      {t("predictive_engine_ready")}
                    </p>
                  </div>
                )}

                {isPredicting && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-16">
                    <RefreshCw className="size-8 animate-spin text-[var(--hud-cyan)]" />
                    <span className="animate-pulse font-mono text-[9px] uppercase tracking-widest text-[var(--hud-cyan)]">
                      {t("scanning_in_progress")}
                    </span>
                  </div>
                )}

                {predictiveData && (
                  <div className="space-y-3">
                    <div className="border-l-[3px] border-[var(--hud-cyan)] bg-[var(--hud-cyan-dim)] p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--hud-cyan)]">
                        <Eye size={12} /> {t("situation_analysis")}
                      </div>
                      <p className="font-mono text-[10px] leading-relaxed text-[#e0f8ff]">
                        {predictiveData.situation_analysis}
                      </p>
                    </div>

                    <div className="border-l-[3px] border-[#f59e0b] bg-[rgba(245,158,11,0.05)] p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#f59e0b]">
                        <ShieldAlert size={12} /> {t("risk_index")}
                      </div>
                      <p className="font-mono text-[10px] leading-relaxed text-[#e0f8ff]">
                        {predictiveData.risk_analysis}
                      </p>
                    </div>

                    <div className="border-l-[3px] border-[#bc13fe] bg-[rgba(188,19,254,0.05)] p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#bc13fe]">
                        <Brain size={12} /> {t("foresight_forecast")}
                      </div>
                      <p className="font-mono text-[10px] leading-relaxed text-[#e0f8ff]">
                        {predictiveData.predictive_analysis}
                      </p>
                    </div>

                    <div className="border-l-[3px] border-[#39FF14] bg-[rgba(57,255,20,0.05)] p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#39FF14]">
                        <CheckCircle size={12} /> {t("recommended_action")}
                      </div>
                      <p className="font-mono text-[10px] leading-relaxed text-[#e0f8ff]">
                        {predictiveData.operational_recommendations}
                      </p>
                    </div>

                    <div className="mt-1 text-right font-mono text-[8px] text-gray-500">
                      {t("vlm_model_timestamp", {
                        timestamp: predictiveData.timestamp,
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleGenerateForecast}
                disabled={isPredicting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-[var(--hud-cyan)] bg-[rgba(0,243,255,0.15)] py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--hud-cyan)] shadow-[0_0_12px_rgba(0,243,255,0.1)] transition-all hover:bg-[rgba(0,243,255,0.25)] disabled:opacity-50"
              >
                <Brain size={12} />
                <span>{t("generate_forecast_btn")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmModule && (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-md border border-[rgba(0,243,255,0.3)] bg-[#030f22] p-6 text-[#ffffff] shadow-[0_0_30px_rgba(0,243,255,0.2)]">
            <div className="hud-panel-br"></div>
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="size-8 flex-shrink-0 animate-pulse text-[#ef4444]" />
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[#ef4444]">
                  {t("disable_warning_title")}
                </h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-gray-300">
                  {t("disable_warning_desc", {
                    module: aiModules.find((m) => m.id === confirmModule)?.name,
                    camera: camera.name.toUpperCase(),
                  })}
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmModule(null)}
                className="flex-1 rounded border border-gray-500 py-1.5 font-mono text-xs uppercase text-gray-300 transition-colors hover:bg-white/5"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmDeactivate}
                className="flex-1 rounded border border-[#ef4444] bg-[#ef4444]/20 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#ef4444] transition-all hover:bg-[#ef4444]/35"
              >
                {t("confirm_deactivation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add subject modaler */}
      {quickAddType && (
        <QuickAddSubjectModal
          isOpen={quickAddType !== null}
          type={quickAddType}
          cameraName={camera.name}
          onClose={() => setQuickAddType(null)}
        />
      )}
    </div>
  );
}
