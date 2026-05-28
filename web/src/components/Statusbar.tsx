import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Cpu,
  Layers,
  HardDrive,
  Wifi,
  Activity,
  Thermometer,
} from "lucide-react";
import axios from "axios";

interface MemoryStats {
  percent: number;
  total: number;
  available: number;
  used: number;
}

interface DiskStats {
  percent: number;
  free: number;
  total: number;
}

interface NetworkStats {
  bytes_sent: number;
  bytes_recv: number;
}

interface GpuStats {
  id: number;
  name: string;
  load: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  temperature: number;
}

interface ProcessStats {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

interface SystemStats {
  cpu_percent: number;
  cpu_cores: number;
  cpu_threads: number;
  cpu_freq: number;
  cpu_temp: number;
  memory: MemoryStats;
  disk: DiskStats;
  network: NetworkStats;
  gpu: GpuStats[];
  processes: ProcessStats[];
}

interface StatusbarProps {
  isStatic?: boolean;
}

export default function Statusbar({ isStatic = false }: StatusbarProps) {
  // System Stats Realtime Telemetry
  const [stats, setStats] = useState<SystemStats>({
    cpu_percent: 0,
    cpu_cores: 0,
    cpu_threads: 0,
    cpu_freq: 0,
    cpu_temp: 0,
    memory: { percent: 0, total: 0, available: 0, used: 0 },
    disk: { percent: 0, free: 0, total: 0 },
    network: { bytes_sent: 0, bytes_recv: 0 },
    gpu: [],
    processes: [],
  });

  const [netSpeed, setNetSpeed] = useState({ up: 0, down: 0 }); // Bytes/sec
  const lastNetRef = useRef<NetworkStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get("system/stats");
        const newData: SystemStats = response.data;

        // Network Speed Calculation
        if (newData.network && lastNetRef.current) {
          const downDiff =
            newData.network.bytes_recv - lastNetRef.current.bytes_recv;
          const upDiff =
            newData.network.bytes_sent - lastNetRef.current.bytes_sent;
          setNetSpeed({
            down: Math.max(0, downDiff / 2),
            up: Math.max(0, upDiff / 2),
          });
        }
        if (newData.network) lastNetRef.current = newData.network;

        setStats(newData);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch system stats", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const renderCards = () => (
    <>
      {/* CPU Card */}
      <Link
        to="/system#general"
        className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5 transition-all hover:bg-background_alt/80"
      >
        <div className="flex items-center justify-between leading-none">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-sky-400" />
            <span className="text-sm font-semibold text-slate-300">
              CPU Usage
            </span>
          </div>
          <span className="text-lg font-bold text-white">
            {stats.cpu_percent.toFixed(1)}%
          </span>
        </div>
        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-sky-500 transition-all duration-500"
            style={{ width: `${stats.cpu_percent}%` }}
          ></div>
        </div>
        <div className="text-slate-455 flex justify-between text-[10px] leading-none">
          <span>
            {stats.cpu_cores} Cores / {stats.cpu_threads} Threads
          </span>
          <span>
            {stats.cpu_freq ? `${(stats.cpu_freq / 1000).toFixed(2)} GHz` : ""}
          </span>
        </div>
      </Link>

      {/* Memory Card */}
      <Link
        to="/system#general"
        className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5 transition-all hover:bg-background_alt/80"
      >
        <div className="flex items-center justify-between leading-none">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-purple-400" />
            <span className="text-sm font-semibold text-slate-300">Memory</span>
          </div>
          <span className="text-lg font-bold text-white">
            {stats.memory.percent.toFixed(1)}%
          </span>
        </div>
        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${stats.memory.percent}%` }}
          ></div>
        </div>
        <div className="text-slate-455 flex justify-between text-[10px] leading-none">
          <span>Used: {formatBytes(stats.memory.used, 2)}</span>
          <span>Avail: {formatBytes(stats.memory.available, 2)}</span>
        </div>
      </Link>

      {/* Storage Card */}
      <Link
        to="/system#general"
        className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5 transition-all hover:bg-background_alt/80"
      >
        <div className="flex items-center justify-between leading-none">
          <div className="flex items-center gap-2">
            <HardDrive size={15} className="text-amber-400" />
            <span className="text-sm font-semibold text-slate-300">
              Storage
            </span>
          </div>
          <span className="text-lg font-bold text-white">
            {stats.disk.percent.toFixed(1)}%
          </span>
        </div>
        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${stats.disk.percent}%` }}
          ></div>
        </div>
        <div className="text-slate-455 flex justify-between text-[10px] leading-none">
          <span>
            Used: {formatBytes(stats.disk.total - stats.disk.free, 2)}
          </span>
          <span>Free: {formatBytes(stats.disk.free, 2)}</span>
        </div>
      </Link>

      {/* Network Card */}
      <div className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5">
        <div className="flex items-center gap-2 leading-none">
          <Wifi size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-slate-300">Network</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-slate-455 text-[10px]">Download</span>
            <span className="mt-0.5 text-base font-bold text-emerald-400">
              {formatSpeed(netSpeed.down)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-455 text-[10px]">Upload</span>
            <span className="mt-0.5 text-base font-bold text-sky-400">
              {formatSpeed(netSpeed.up)}
            </span>
          </div>
        </div>
      </div>

      {/* Temp Card */}
      <div className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5 transition-all hover:bg-background_alt/80">
        <div className="flex items-center justify-between leading-none">
          <div className="flex items-center gap-2">
            <Thermometer size={15} className="text-orange-400" />
            <span className="text-sm font-semibold text-slate-300">
              System Temp
            </span>
          </div>
          <span className="text-lg font-bold text-white">
            {stats.cpu_temp || "48"}°C
          </span>
        </div>
        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${stats.cpu_temp || 48}%` }}
          ></div>
        </div>
        <div className="h-3"></div>
      </div>

      {/* GPU Card */}
      {stats.gpu && stats.gpu.length > 0 ? (
        stats.gpu.slice(0, 1).map((gpu) => (
          <div
            key={gpu.id}
            className="flex h-[88px] select-none flex-col justify-between rounded-xl border border-white/5 bg-background_alt p-3.5 transition-all hover:bg-background_alt/80"
          >
            <div className="flex items-center justify-between leading-none">
              <div className="flex max-w-[70%] items-center gap-2">
                <Activity size={15} className="flex-shrink-0 text-rose-400" />
                <span
                  className="line-clamp-2 text-xs font-semibold leading-tight text-slate-300"
                  title={gpu.name}
                >
                  GPU: {gpu.name}
                </span>
              </div>
              <span className="ml-1 flex-shrink-0 text-lg font-bold text-white">
                {gpu.load.toFixed(1)}%
              </span>
            </div>
            <div className="my-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${gpu.load}%` }}
              ></div>
            </div>
            <div className="text-slate-455 flex justify-between text-[10px] leading-none">
              <span>
                Mem:{" "}
                {gpu.memory_used
                  ? `${formatBytes(gpu.memory_used * 1024 * 1024, 2)} / ${formatBytes(gpu.memory_total * 1024 * 1024, 1)}`
                  : ""}
              </span>
              <span>Temp: {gpu.temperature}°C</span>
            </div>
          </div>
        ))
      ) : (
        <div className="flex h-[88px] select-none flex-col items-center justify-center rounded-xl border border-white/5 bg-background_alt/40 p-3.5 text-[10px] font-bold text-slate-500">
          <Activity size={18} className="mb-1 text-slate-600" />
          NO ACTIVE GPU
        </div>
      )}
    </>
  );

  // If rendered as a static block inside a scrollable view
  if (isStatic) {
    return (
      <div className="mt-6 w-full select-none">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {renderCards()}
        </div>
      </div>
    );
  }

  // Otherwise, render as the fixed-position bottom status bar
  return (
    <div className="fixed bottom-2 left-[62px] right-2 z-10 select-none">
      <div className="grid grid-cols-6 gap-3">{renderCards()}</div>
    </div>
  );
}
