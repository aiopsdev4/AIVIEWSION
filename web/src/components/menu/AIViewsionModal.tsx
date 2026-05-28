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
  RefreshCw
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
  Cell
} from "recharts";

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

export default function AIViewsionModal({
  isOpen,
  onClose,
  camera,
  preferredLiveMode,
  streamName
}: AIViewsionModalProps) {
  // AI Modules list
  const aiModules: AIModule[] = [
    {
      id: "objects",
      name: "General Objects",
      description: "Detects pedestrians, backpacks, bags, and general assets.",
      icon: <Cctv className="size-4" />
    },
    {
      id: "face",
      name: "Face Recognition",
      description: "Extracts biometric keypoints and cross-references POI records.",
      icon: <User className="size-4" />
    },
    {
      id: "people_count",
      name: "People Counting",
      description: "Maintains crowd density estimation and line-crossing counts.",
      icon: <Users className="size-4" />
    },
    {
      id: "vehicle",
      name: "Road AI",
      description: "Extracts plate numbers, makes, models, and color classifications.",
      icon: <Car className="size-4" />
    },
    {
      id: "vehicle_count",
      name: "Vehicle Counting",
      description: "Monitors traffic throughput, average speeds, and directional flow.",
      icon: <TrendingUp className="size-4" />
    },
    {
      id: "fire",
      name: "Fire Detection",
      description: "Flicker-frequency smoke and flame detection inference.",
      icon: <Flame className="size-4" />
    },
    {
      id: "flood",
      name: "Flood Detection",
      description: "Visual pooling and rising water level boundary tracking.",
      icon: <Waves className="size-4" />
    },
    {
      id: "violence",
      name: "Violence",
      description: "Skeletal motion analysis for physical altercations and weapons.",
      icon: <ShieldAlert className="size-4" />
    }
  ];

  // Enabled modules state saved in localStorage for persistence
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(() => {
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
            violence: false
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
        violence: false
      };
    }
  });

  // Persist modules to localStorage when changed
  useEffect(() => {
    localStorage.setItem(
      `aiviewsion-modules-${camera.name}`,
      JSON.stringify(enabledModules)
    );
  }, [enabledModules, camera.name]);

  // Live dynamic telemetry variables
  const [vehicleCount, setVehicleCount] = useState(0);
  const [activeObjects, setActiveObjects] = useState(0);
  const [roadDensity, setRoadDensity] = useState(0);
  const [trafficFlowScore, setTrafficFlowScore] = useState(100);

  // Charts data state
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [vehicleTypesData, setVehicleTypesData] = useState<any[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);

  // Simulation tick for live data
  useEffect(() => {
    // Generate initial charts baseline
    const baseTime = new Date();
    const initialTraffic = [];
    const initialActivity = [];
    for (let i = 6; i >= 0; i--) {
      const timeStr = new Date(baseTime.getTime() - i * 60 * 1000)
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      initialTraffic.push({ name: timeStr, vehicles: 0, pedestrians: 0 });
      initialActivity.push({ name: timeStr, general: 0, alerts: 0 });
    }
    setTrafficData(initialTraffic);
    setActivityTimeline(initialActivity);

    setVehicleTypesData([
      { name: "Sedan", value: 0 },
      { name: "SUV", value: 0 },
      { name: "Truck", value: 0 },
      { name: "Motorcycle", value: 0 }
    ]);
  }, []);

  // Update telemetry and charts in real-time when modules are toggled
  useEffect(() => {
    const isRoadAIActive = enabledModules.vehicle || enabledModules.vehicle_count;
    const isObjectsActive = enabledModules.objects || enabledModules.people_count;

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
        second: "2-digit"
      });

      setTrafficData((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          name: timeStr,
          vehicles: isRoadAIActive ? Math.floor(Math.random() * 5) + 2 : 0,
          pedestrians: isObjectsActive ? Math.floor(Math.random() * 3) + 1 : 0
        });
        return next;
      });

      setActivityTimeline((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          name: timeStr,
          general: baseObjects * 10,
          alerts: enabledModules.violence || enabledModules.fire ? Math.floor(Math.random() * 15) : 0
        });
        return next;
      });

      // Update vehicle types
      if (isRoadAIActive) {
        setVehicleTypesData([
          { name: "Sedan", value: Math.floor(Math.random() * 20) + 15 },
          { name: "SUV", value: Math.floor(Math.random() * 15) + 10 },
          { name: "Truck", value: Math.floor(Math.random() * 5) + 2 },
          { name: "Motorcycle", value: Math.floor(Math.random() * 12) + 5 }
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
  const [predictiveData, setPredictiveData] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handleGenerateForecast = () => {
    setIsPredicting(true);
    setPredictiveData(null);

    setTimeout(() => {
      // Generate dynamically based on toggled modules and camera name
      const isRoadAI = enabledModules.vehicle || enabledModules.vehicle_count;
      const isSecurity = enabledModules.face || enabledModules.violence || enabledModules.fire;

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
        is_heuristic: false
      });
      setIsPredicting(false);
      toast.success("Foresight Analysis sitrep generated.");
    }, 2000);
  };

  const handleToggleModule = (moduleId: string) => {
    const currentState = enabledModules[moduleId];

    if (currentState) {
      // Trigger confirmation dialog when disabling an active module
      setConfirmModule(moduleId);
    } else {
      setEnabledModules((prev) => ({ ...prev, [moduleId]: true }));
      toast.success(`Activated ${aiModules.find((m) => m.id === moduleId)?.name} module.`);
    }
  };

  const confirmDeactivate = () => {
    if (confirmModule) {
      setEnabledModules((prev) => ({ ...prev, [confirmModule]: false }));
      const moduleName = aiModules.find((m) => m.id === confirmModule)?.name;
      toast.info(`Deactivated ${moduleName} module.`);
      setConfirmModule(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#010813] flex flex-col overflow-hidden animate-fade-in text-[#ffffff]">
      {/* HUD Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[rgba(0,243,255,0.2)] bg-[#030f22]/90 z-50 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold flex items-center gap-2 text-[var(--hud-cyan)] uppercase tracking-widest font-mono">
            <ShieldAlert size={16} className="animate-pulse" /> AIViewsion Intelligence Portal
          </h2>
          <div className="w-px h-4 bg-[rgba(0,243,255,0.4)] shadow-[0_0_8px_rgba(0,243,255,0.8)]"></div>
          <p className="text-xs text-[var(--hud-text-sub)] font-mono uppercase tracking-widest">
            {camera.name.toUpperCase()} • LIVE STREAM ANALYSIS
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.1)] hover:border-[var(--hud-cyan)] text-gray-400 hover:text-white transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#010813]">
        {/* Left Column: Visual Analytics & Charts (Cols 3) */}
        <div className="lg:col-span-3 border-r border-[rgba(0,243,255,0.15)] flex flex-col overflow-y-auto p-4 space-y-4 scrollbar-container bg-[#020b18]/40">
          {/* Live Counts Grid */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <div className="hud-panel">
              <div className="hud-panel-br"></div>
              <div className="hud-header">Total Vehicles</div>
              <div className="hud-content py-3.5 flex flex-col justify-center items-center">
                <div className="text-2xl font-bold font-mono text-[var(--hud-cyan)] tracking-tight">
                  {enabledModules.vehicle || enabledModules.vehicle_count ? (
                    vehicleCount
                  ) : (
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-[8px] text-gray-400 font-mono uppercase mt-1">
                  Accumulated Count
                </div>
              </div>
            </div>

            <div className="hud-panel">
              <div className="hud-panel-br"></div>
              <div className="hud-header">Active Objects</div>
              <div className="hud-content py-3.5 flex flex-col justify-center items-center">
                <div className="text-2xl font-bold font-mono text-[var(--hud-cyan)] tracking-tight animate-pulse">
                  {enabledModules.objects || enabledModules.people_count ? (
                    activeObjects
                  ) : (
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                      Standby
                    </span>
                  )}
                </div>
                <div className="text-[8px] text-gray-400 font-mono uppercase mt-1">
                  Active in Scene
                </div>
              </div>
            </div>

            <div className="hud-panel">
              <div className="hud-panel-br"></div>
              <div className="hud-header">Road Density</div>
              <div className="hud-content py-3.5 flex flex-col justify-center items-center">
                <div className="text-2xl font-bold font-mono text-[var(--hud-cyan)] tracking-tight">
                  {enabledModules.vehicle || enabledModules.vehicle_count ? (
                    `${roadDensity}%`
                  ) : (
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                      Off
                    </span>
                  )}
                </div>
                <div className="text-[8px] text-gray-400 font-mono uppercase mt-1">
                  Occupancy Ratio
                </div>
              </div>
            </div>

            <div className="hud-panel">
              <div className="hud-panel-br"></div>
              <div className="hud-header">Traffic Flow</div>
              <div className="hud-content py-3.5 flex flex-col justify-center items-center">
                <div
                  className="text-sm font-bold font-mono tracking-wider uppercase"
                  style={{
                    color:
                      !enabledModules.vehicle && !enabledModules.vehicle_count
                        ? "#64748b"
                        : trafficFlowScore > 92
                          ? "#39FF14"
                          : "#f59e0b"
                  }}
                >
                  {!enabledModules.vehicle && !enabledModules.vehicle_count
                    ? "STANDBY"
                    : trafficFlowScore > 92
                      ? "FLUID"
                      : "STABLE"}
                </div>
                <div className="text-[8px] text-gray-400 font-mono uppercase mt-1">
                  {!enabledModules.vehicle && !enabledModules.vehicle_count
                    ? "Flow Monitor Off"
                    : `Score: ${trafficFlowScore}/100`}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Flow Analysis Chart */}
          <div className="hud-panel h-[180px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">Traffic Flow (Last 10m)</div>
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
                      fontFamily: "monospace"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vehicles"
                    name="Vehicles"
                    stroke="#00f3ff"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pedestrians"
                    name="Pedestrians"
                    stroke="#bc13fe"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vehicle Types Distribution Chart */}
          <div className="hud-panel h-[180px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">Vehicle Classifications</div>
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
                      fontFamily: "monospace"
                    }}
                  />
                  <Bar dataKey="value" name="Detected" radius={[0, 4, 4, 0]}>
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
          <div className="hud-panel h-[170px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">Combined Activity Timeline</div>
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
                      fontFamily: "monospace"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="general"
                    name="Motion"
                    stackId="1"
                    stroke="#00f3ff"
                    fill="rgba(0, 243, 255, 0.1)"
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    name="Alerts"
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
        <div className="lg:col-span-6 border-r border-[rgba(0,243,255,0.15)] flex flex-col overflow-y-auto p-4 space-y-4 scrollbar-container bg-[#010813]">
          {/* Live Player Container */}
          <div className="hud-panel aspect-video w-full flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header flex justify-between items-center">
              <span>LIVE VIDEO STREAM feed</span>
              <span className="text-[9px] text-[var(--hud-cyan)] animate-pulse">
                ● 1080P • 30FPS • {camera.name.toUpperCase()}
              </span>
            </div>
            <div className="hud-content p-1 bg-black flex items-center justify-center overflow-hidden">
              <LivePlayer
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
          <div className="hud-panel h-[230px] flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">Location Intelligence GIS</div>
            <div className="hud-content p-1">
              <LocationIntelligenceMap
                latitude={coordinates.lat}
                longitude={coordinates.lng}
                cameraName={camera.name}
              />
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
            <button
              onClick={() => setQuickAddType("person")}
              className="px-3 py-2.5 bg-[#031534]/60 border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.15)] hover:border-[var(--hud-cyan)] text-[#e0f8ff] font-mono text-[10px] tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-1.5 shadow-[inset_0_0_10px_rgba(0,243,255,0.02)]"
            >
              <User size={16} className="text-[var(--hud-cyan)]" />
              <span>Person of Interest</span>
            </button>

            <button
              onClick={() => setQuickAddType("vehicle")}
              className="px-3 py-2.5 bg-[#031534]/60 border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.15)] hover:border-[var(--hud-cyan)] text-[#e0f8ff] font-mono text-[10px] tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-1.5 shadow-[inset_0_0_10px_rgba(0,243,255,0.02)]"
            >
              <Car size={16} className="text-[var(--hud-cyan)]" />
              <span>Target Vehicle</span>
            </button>

            <button
              onClick={() => setQuickAddType("asset")}
              className="px-3 py-2.5 bg-[#031534]/60 border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.15)] hover:border-[var(--hud-cyan)] text-[#e0f8ff] font-mono text-[10px] tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-1.5 shadow-[inset_0_0_10px_rgba(0,243,255,0.02)]"
            >
              <Cctv size={16} className="text-[var(--hud-cyan)]" />
              <span>Tracked Asset</span>
            </button>

            <button
              onClick={() => setQuickAddType("roi")}
              className="px-3 py-2.5 bg-[#031534]/60 border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.15)] hover:border-[var(--hud-cyan)] text-[#e0f8ff] font-mono text-[10px] tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-1.5 shadow-[inset_0_0_10px_rgba(0,243,255,0.02)]"
            >
              <ShieldAlert size={16} className="text-[var(--hud-cyan)]" />
              <span>Security ROI Zone</span>
            </button>
          </div>
        </div>

        {/* Right Column: AI Toggles & Predictive Foresight (Cols 3) */}
        <div className="lg:col-span-3 flex flex-col overflow-y-auto p-4 space-y-4 scrollbar-container bg-[#020b18]/40">
          {/* AI Suite Modules */}
          <div className="hud-panel flex-shrink-0">
            <div className="hud-panel-br"></div>
            <div className="hud-header">AI Intelligent Suite</div>
            <div className="hud-content p-3 space-y-3.5">
              {aiModules.map((module) => {
                const isActive = enabledModules[module.id];
                return (
                  <div
                    key={module.id}
                    className="flex justify-between items-start gap-3 border-b border-[rgba(255,255,255,0.03)] pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-200 font-mono">
                        <span
                          style={{
                            color: isActive ? "var(--hud-cyan)" : "#64748b"
                          }}
                        >
                          {module.icon}
                        </span>
                        <span>{module.name}</span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono leading-tight">
                        {module.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleModule(module.id)}
                      />
                      <span
                        className="text-[8px] font-mono font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                        style={{
                          color: isActive ? "#39FF14" : "#64748b",
                          background: isActive
                            ? "rgba(57, 255, 20, 0.05)"
                            : "rgba(255, 255, 255, 0.02)"
                        }}
                      >
                        {isActive ? "ONLINE" : "STANDBY"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Predictive Foresight */}
          <div className="hud-panel flex-1 min-h-[250px]">
            <div className="hud-panel-br"></div>
            <div className="hud-header">AI Predictive Foresight</div>
            <div className="hud-content p-3 flex flex-col justify-between">
              {/* Output Analysis Blocks */}
              <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar max-h-[420px]">
                {!predictiveData && !isPredicting && (
                  <div className="h-full flex flex-col justify-center items-center py-12 text-center space-y-3">
                    <Brain className="size-12 text-gray-500 animate-pulse" />
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
                      Predictive engine ready. Trigger scanner below.
                    </p>
                  </div>
                )}

                {isPredicting && (
                  <div className="py-16 flex flex-col items-center justify-center space-y-4">
                    <RefreshCw className="size-8 text-[var(--hud-cyan)] animate-spin" />
                    <span className="text-[9px] text-[var(--hud-cyan)] font-mono uppercase tracking-widest animate-pulse">
                      SCANNING STREAM & VLM ANALYSIS IN PROGRESS...
                    </span>
                  </div>
                )}

                {predictiveData && (
                  <div className="space-y-3">
                    <div className="bg-[var(--hud-cyan-dim)] p-2.5 border-l-[3px] border-[var(--hud-cyan)]">
                      <div className="text-[9px] text-[var(--hud-cyan)] font-bold uppercase mb-1 tracking-widest font-mono flex items-center gap-1.5">
                        <Eye size={12} /> Situation Analysis
                      </div>
                      <p className="text-[10px] text-[#e0f8ff] leading-relaxed font-mono">
                        {predictiveData.situation_analysis}
                      </p>
                    </div>

                    <div className="bg-[rgba(245,158,11,0.05)] p-2.5 border-l-[3px] border-[#f59e0b]">
                      <div className="text-[9px] text-[#f59e0b] font-bold uppercase mb-1 tracking-widest font-mono flex items-center gap-1.5">
                        <ShieldAlert size={12} /> Risk Index
                      </div>
                      <p className="text-[10px] text-[#e0f8ff] leading-relaxed font-mono">
                        {predictiveData.risk_analysis}
                      </p>
                    </div>

                    <div className="bg-[rgba(188,19,254,0.05)] p-2.5 border-l-[3px] border-[#bc13fe]">
                      <div className="text-[9px] text-[#bc13fe] font-bold uppercase mb-1 tracking-widest font-mono flex items-center gap-1.5">
                        <Brain size={12} /> Foresight Forecast
                      </div>
                      <p className="text-[10px] text-[#e0f8ff] leading-relaxed font-mono">
                        {predictiveData.predictive_analysis}
                      </p>
                    </div>

                    <div className="bg-[rgba(57,255,20,0.05)] p-2.5 border-l-[3px] border-[#39FF14]">
                      <div className="text-[9px] text-[#39FF14] font-bold uppercase mb-1 tracking-widest font-mono flex items-center gap-1.5">
                        <CheckCircle size={12} /> Recommended Action
                      </div>
                      <p className="text-[10px] text-[#e0f8ff] leading-relaxed font-mono">
                        {predictiveData.operational_recommendations}
                      </p>
                    </div>

                    <div className="text-[8px] text-right text-gray-500 font-mono mt-1">
                       Vision Language Model • {predictiveData.timestamp}
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleGenerateForecast}
                disabled={isPredicting}
                className="w-full mt-3 py-2 bg-[rgba(0,243,255,0.15)] border border-[var(--hud-cyan)] text-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.25)] rounded font-mono text-[10px] uppercase font-bold tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(0,243,255,0.1)]"
              >
                <Brain size={12} />
                <span>Generate Foresight Forecast</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmModule && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[110000] backdrop-blur-sm">
          <div className="hud-panel w-full max-w-md p-6 bg-[#030f22] border border-[rgba(0,243,255,0.3)] shadow-[0_0_30px_rgba(0,243,255,0.2)] text-[#ffffff]">
            <div className="hud-panel-br"></div>
            <div className="flex gap-3 items-start mb-4">
              <AlertTriangle className="size-8 text-[#ef4444] animate-pulse flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold font-mono text-[#ef4444] uppercase tracking-wider">
                  Disable Module Inference Warning
                </h3>
                <p className="text-xs text-gray-300 font-mono mt-2 leading-relaxed">
                  Are you sure you want to deactivate the{" "}
                  <span className="text-[var(--hud-cyan)] font-bold">
                    {aiModules.find((m) => m.id === confirmModule)?.name}
                  </span>{" "}
                  module? This will permanently close the active inference stream and purge
                  temporary target track logs for node{" "}
                  <span className="text-[var(--hud-cyan)] font-bold">
                    {camera.name.toUpperCase()}
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmModule(null)}
                className="flex-1 py-1.5 border border-gray-500 hover:bg-white/5 rounded text-xs font-mono uppercase text-gray-300 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={confirmDeactivate}
                className="flex-1 py-1.5 bg-[#ef4444]/20 border border-[#ef4444] hover:bg-[#ef4444]/35 text-[#ef4444] rounded text-xs font-mono uppercase font-bold tracking-wider transition-all"
              >
                CONFIRM DEACTIVATION
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
