import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MdSearch, MdRefresh, MdAdd, MdSettingsEthernet } from "react-icons/md";
import { LuRotateCw } from "react-icons/lu";
import { Cctv, ShieldAlert, WifiOff } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import axios from "axios";

import { FrigateConfig } from "@/types/frigateConfig";
import { FrigateStats } from "@/types/stats";
import { addCameraToYaml } from "@/helpers/configHelpers";
import { saveAndRestartConfig } from "@/services/configService";

import AssetTable, { Asset } from "@/components/assets/AssetTable";
import CameraWizardDialog from "@/components/settings/CameraWizardDialog";
import ActivityIndicator from "@/components/indicators/activity-indicator";

interface NewAsset {
  name: string;
  device_type: string;
  ip_address: string;
  username: string;
  password: string;
  rtsp_url: string;
}

export interface DiscoveredDevice {
  ip: string;
  mac: string;
  status: string;
  manufacturer: string;
  model: string;
  device_type: string;
  ptz: boolean;
  audio: boolean;
  port: number;
  onvif_url?: string;
  rtsp_url?: string;
  username?: string;
  password?: string;
  selected?: boolean;
  customName?: string;
  channel_index?: number;
  playable?: boolean;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AssetsDashboard() {
  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [cameraToDelete, setCameraToDelete] = useState<string | null>(null);
  const [testFailureDetail, setTestFailureDetail] = useState<{
    ip: string;
    type: "unauthorized" | "connect_failed";
    message: string;
    manufacturer?: string;
    model?: string;
  } | null>(null);

  const { data: config } = useSWR<FrigateConfig>("config");
  const { data: rawConfig } = useSWR<string>("config/raw");
  const { data: stats } = useSWR<FrigateStats>("stats", { refreshInterval: 5000 });

  // Discovery states
  const [subnet, setSubnet] = useState(() => {
    return localStorage.getItem("aiviewsion_subnet") || "172.16.0";
  });
  const [bulkUsername, setBulkUsername] = useState(() => {
    return localStorage.getItem("aiviewsion_bulkUsername") || "";
  });
  const [bulkPassword, setBulkPassword] = useState(() => {
    return localStorage.getItem("aiviewsion_bulkPassword") || "";
  });
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>(() => {
    try {
      const saved = localStorage.getItem("aiviewsion_devices");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [testingRows, setTestingRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem("aiviewsion_subnet", subnet);
  }, [subnet]);

  useEffect(() => {
    localStorage.setItem("aiviewsion_bulkUsername", bulkUsername);
  }, [bulkUsername]);

  useEffect(() => {
    localStorage.setItem("aiviewsion_bulkPassword", bulkPassword);
  }, [bulkPassword]);

  useEffect(() => {
    localStorage.setItem("aiviewsion_devices", JSON.stringify(devices));
  }, [devices]);

  const expandNvrChannelsInBackground = useCallback(async (ip: string, user: string, pass: string) => {
    setTestingRows((prev) => {
      if (prev[ip]) return prev;

      (async () => {
        try {
          const url = `/api/network/discover/scan?subnet_prefix=${ip}&username=${user || ""}&password=${pass || ""}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as DiscoveredDevice[];
            if (data && data.length > 0) {
              if (data.length > 1 || (data.length === 1 && data[0].channel_index !== undefined)) {
                setDevices((currentDevices) => {
                  const index = currentDevices.findIndex((d) => d.ip === ip);
                  if (index === -1) return currentDevices;
                  const updated = [...currentDevices];
                  const expandedRows = data.map((tested: DiscoveredDevice) => {
                    const suffix = `_ch${tested.channel_index}`;
                    return {
                      ...tested,
                      selected: tested.playable === true,
                      customName: `${tested.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${tested.ip.split(".").pop()}${suffix}`,
                      username: user,
                      password: pass,
                    };
                  });
                  updated.splice(index, 1, ...expandedRows);
                  return updated;
                });
              }
            }
          }
        } catch (e) {
          // Silent catch to prevent console warning
        } finally {
          setTestingRows((latest) => ({ ...latest, [ip]: false }));
        }
      })();

      return { ...prev, [ip]: true };
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("aiviewsion_devices");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DiscoveredDevice[];
        parsed.forEach((dev) => {
          if (dev.device_type === "nvr" && (dev.username || bulkUsername)) {
            expandNvrChannelsInBackground(dev.ip, dev.username || bulkUsername, dev.password || bulkPassword);
          }
        });
      } catch (e) {
        // Silent catch
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractChannelIndex = (path: string): number | undefined => {
    if (!path) return undefined;
    let match = path.match(/[?&]channel=(\d+)/i);
    if (match) return parseInt(match[1], 10);
    match = path.match(/\/Streaming\/Channels\/(\d+)0\d/i);
    if (match) return parseInt(match[1], 10);
    match = path.match(/\/Channels\/(\d+)/i);
    if (match) return parseInt(match[1], 10);
    return undefined;
  };

  const assets: Asset[] = useMemo(() => {
    if (!config?.cameras) return [];

    return Object.entries(config.cameras).map(([camName, camConfig]) => {
      let ip = "Unknown IP";
      const path = camConfig.ffmpeg?.inputs?.[0]?.path || "";
      if (path && path.includes("@")) {
        ip = path.split("@")[1]?.split(":")[0]?.split("/")[0] || "Unknown IP";
      }

      const chIdx = extractChannelIndex(path);

      // Try to find matching scanned device details
      const matched = devices.find((d) => d.ip === ip && (chIdx === undefined || d.channel_index === chIdx));
      
      let category = "IPC";
      if (matched) {
        category = matched.device_type === "nvr" ? "NVR" : matched.device_type === "bwc" ? "BWC" : "IPC";
      } else if (
        camName.toLowerCase().includes("nvr") || 
        path.includes("channel=")
      ) {
        category = "NVR";
      } else if (
        camName.toLowerCase().includes("bwc") ||
        camName.toLowerCase().includes("body")
      ) {
        category = "BWC";
      }

      let model = "Generic IPC";
      if (matched) {
        model = matched.model;
      } else if (camName.toLowerCase().includes("hikvision")) {
        model = "Hikvision Camera";
      } else if (camName.toLowerCase().includes("dahua")) {
        model = "Dahua Camera";
      } else if (camName.toLowerCase().includes("bwc")) {
        model = "Body Worn Camera";
      }

      return {
        id: camName,
        name: camName,
        device_type: model,
        category: category,
        ip_address: ip,
        status: (() => {
          if (camConfig.enabled === false) return "Offline";
          if (stats?.cameras?.[camName]) {
            const camStats = stats.cameras[camName];
            return camStats.camera_fps > 0.0 ? "Online" : "Offline";
          }
          return "Offline";
        })(),
        channel_index: chIdx,
      };
    });
  }, [config, devices, stats]);

  const discoveredDevices = useMemo(() => {
    return devices.filter((d) => {
      const isRegistered = assets.some((a) => {
        if (a.ip_address !== d.ip) return false;
        
        if (d.channel_index !== undefined) {
          return a.channel_index === d.channel_index;
        }
        
        if (a.channel_index !== undefined) {
          return false;
        }
        
        return true;
      });
      return !isRegistered;
    });
  }, [devices, assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.ip_address.includes(search);
      const matchFilter =
        filter === "all" ||
        item.category.toLowerCase() === filter.toLowerCase();
      return matchSearch && matchFilter;
    });
  }, [search, filter, assets]);

  const pollServer = async (expectedCamIds?: string[]) => {
    try {
      const res = await fetch("/api/config?t=" + Date.now());
      if (res.ok) {
        const configData = await res.json();
        if (expectedCamIds && expectedCamIds.length > 0) {
          const cameras = configData?.cameras || {};
          const allExist = expectedCamIds.every((id) => id in cameras);
          if (!allExist) {
            setTimeout(() => pollServer(expectedCamIds), 2000);
            return;
          }
        }
        await Promise.all([
          mutate("config"),
          mutate("config/raw"),
          mutate("stats"),
        ]);
      } else {
        setTimeout(() => pollServer(expectedCamIds), 2000);
      }
    } catch (e) {
      setTimeout(() => pollServer(expectedCamIds), 2000);
    }
  };

  const handleDelete = async (camId: string) => {
    if (!rawConfig) {
      toast.error("System configuration not loaded yet.");
      return;
    }
    setCameraToDelete(camId);
  };

  const confirmDelete = async () => {
    if (!cameraToDelete) return;
    const camId = cameraToDelete;
    setCameraToDelete(null);
    setIsDeleting(camId);
    try {
      await axios.delete(`cameras/${camId}`);
      toast.success("Device deleted successfully! Database and files cleaned.");
      await Promise.all([
        mutate("config"),
        mutate("config/raw"),
        mutate("stats"),
      ]);
      setIsDeleting(null);
    } catch (e) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to delete device configuration.";
      toast.error(errMsg);
      setIsDeleting(null);
    }
  };

  const handleSaveMultiple = async (newAssets: NewAsset[]) => {
    if (!rawConfig) {
      toast.error("System configuration not loaded yet.");
      return;
    }

    let updatedYaml = rawConfig;
    const registeredIds = Object.keys(config?.cameras || {});
    const newlyAddedIds: string[] = [];

    for (const asset of newAssets) {
      const camId = asset.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      if (registeredIds.includes(camId)) {
        toast.warning(`Device ID '${camId}' is already registered! Skipping.`);
        continue;
      }
      updatedYaml = addCameraToYaml(updatedYaml, camId, asset.rtsp_url);
      newlyAddedIds.push(camId);
    }

    try {
      await saveAndRestartConfig(updatedYaml);
      toast.success(
        "Assets saved! The video engine is now rebooting, please wait...",
      );
      setTimeout(() => pollServer(newlyAddedIds), 5000);
    } catch (e) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to commit settings to main system configuration.";
      toast.error(errMsg);
    }
  };

  const handleBulkUsernameChange = (val: string) => {
    setBulkUsername(val);
    setDevices((prev) =>
      prev.map((d) => {
        if (d.username === bulkUsername || !d.username) {
          return {
            ...d,
            username: val,
            playable: false,
            selected: false,
          };
        }
        return d;
      }),
    );
  };

  const handleBulkPasswordChange = (val: string) => {
    setBulkPassword(val);
    setDevices((prev) =>
      prev.map((d) => {
        if (d.password === bulkPassword || !d.password) {
          return {
            ...d,
            password: val,
            playable: false,
            selected: false,
          };
        }
        return d;
      }),
    );
  };

  const handleScan = async () => {
    setScanning(true);
    setDevices([]);
    try {
      const url = `/api/network/discover/scan?subnet_prefix=${subnet}&username=${encodeURIComponent(bulkUsername)}&password=${encodeURIComponent(bulkPassword)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      const mapped = data.map((dev: DiscoveredDevice) => {
        const suffix =
          dev.channel_index !== undefined ? `_ch${dev.channel_index}` : "";
        return {
          ...dev,
          selected: dev.playable === true,
          customName: `${dev.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${dev.ip.split(".").pop()}${suffix}`,
          username: bulkUsername || dev.username || "",
          password: bulkPassword || dev.password || "",
        };
      });
      setDevices(mapped);
      toast.success(
        `Scan complete! Found ${data.length} active camera devices.`,
      );

      // Trigger connected channel expansion in the background for any NVRs
      mapped.forEach((dev: DiscoveredDevice) => {
        if (dev.device_type === "nvr") {
          expandNvrChannelsInBackground(dev.ip, dev.username || "", dev.password || "");
        }
      });
    } catch (e) {
      toast.error(`Scan failed: ${(e as Error).message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleTestRow = async (ip: string) => {
    const dev = devices.find((d) => d.ip === ip);
    if (!dev) return;
    setTestingRows((prev) => ({ ...prev, [ip]: true }));
    try {
      const channelParam =
        dev.channel_index !== undefined ? `&channel=${dev.channel_index}` : "";
      const url = `/api/network/discover/scan?subnet_prefix=${dev.ip}&username=${dev.username || ""}&password=${dev.password || ""}${channelParam}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      if (data && data.length > 0) {
        if (data.length > 1 || (data.length === 1 && data[0].channel_index !== undefined)) {
          // Expanded NVR: replace the single row with all its expanded channels
          setDevices((prev) => {
            const index = prev.findIndex((d) => d.ip === ip);
            if (index === -1) return prev;
            const updated = [...prev];
            const expandedRows = data.map((tested: DiscoveredDevice) => {
              const suffix = `_ch${tested.channel_index}`;
              return {
                ...tested,
                selected: tested.playable === true,
                customName: `${tested.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${tested.ip.split(".").pop()}${suffix}`,
                username: dev.username,
                password: dev.password,
              };
            });
            updated.splice(index, 1, ...expandedRows);
            return updated;
          });
          toast.success(`Successfully verified connection and unpacked NVR channels for ${dev.ip}!`);
        } else {
          // Single camera update
          const tested = data[0];
          setDevices((prev) =>
            prev.map((d) => {
              if (d.ip === ip) {
                return {
                  ...d,
                  ...tested,
                  selected: tested.playable === true,
                  customName:
                    d.customName ||
                    `${tested.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${tested.ip.split(".").pop()}`,
                  username: d.username,
                  password: d.password,
                };
              }
              return d;
            }),
          );
          if (tested.playable) {
            toast.success(`Successfully verified connection to ${dev.ip}!`);
          } else {
            const isLocked =
              tested.model?.toLowerCase().includes("locked") ||
              tested.manufacturer?.toLowerCase().includes("credentials");
            if (isLocked) {
              setTestFailureDetail({
                ip: dev.ip,
                type: "unauthorized",
                message: `Authentication failed. The camera rejected the credentials. Please verify the Username and Password fields are correct.`,
                manufacturer: tested.manufacturer,
                model: tested.model,
              });
            } else {
              setTestFailureDetail({
                ip: dev.ip,
                type: "connect_failed",
                message: `RTSP Stream Connection Failed. The device is reachable on the network, but the RTSP stream is offline, refused connection, or returned an invalid path.\n\nValidated URL: ${tested.rtsp_url || "N/A"}`,
                manufacturer: tested.manufacturer,
                model: tested.model,
              });
            }
          }
        }
      } else {
        setTestFailureDetail({
          ip: dev.ip,
          type: "connect_failed",
          message: `No response from device. The device did not respond to ONVIF or RTSP probes. Check if the device is online and the ports are open.`,
        });
      }
    } catch (e) {
      setTestFailureDetail({
        ip: dev.ip,
        type: "connect_failed",
        message: `Verification failed. Could not communicate with the device. Ensure the IP address is correct and target host is online.\n\nError details: ${(e as Error).message}`,
      });
    } finally {
      setTestingRows((prev) => ({ ...prev, [ip]: false }));
    }
  };

  const handleOnboard = async () => {
    const selectedDevices = devices.filter((d) => d.selected);
    if (selectedDevices.length === 0) {
      toast.error("No devices selected for onboarding");
      return;
    }

    setSaving(true);
    try {
      const verifiedDevices: DiscoveredDevice[] = [];
      const failedDevices: string[] = [];

      for (const dev of selectedDevices) {
        if (dev.playable) {
          verifiedDevices.push(dev);
        } else {
          // Auto-test connection for this device
          try {
            const channelParam =
              dev.channel_index !== undefined ? `&channel=${dev.channel_index}` : "";
            const url = `/api/network/discover/scan?subnet_prefix=${dev.ip}&username=${dev.username || ""}&password=${dev.password || ""}${channelParam}`;
            const res = await fetch(url);
            if (!res.ok) {
              failedDevices.push(dev.ip);
              continue;
            }
            const data = await res.json();
            if (data && data.length > 0) {
              const tested = data[0];
              if (tested.playable) {
                const updatedDev = {
                  ...dev,
                  ...tested,
                  playable: true,
                };
                verifiedDevices.push(updatedDev);
                // Sync row in the UI devices list
                setDevices((prev) =>
                  prev.map((d) => (d.ip === dev.ip ? updatedDev : d)),
                );
              } else {
                failedDevices.push(dev.ip);
              }
            } else {
              failedDevices.push(dev.ip);
            }
          } catch (e) {
            failedDevices.push(dev.ip);
          }
        }
      }

      if (failedDevices.length > 0) {
        toast.error(
          `Cannot onboard devices. Connection failed or credentials incorrect for: ${failedDevices.join(", ")}. Please check your credentials.`,
        );
        setSaving(false);
        return;
      }

      const assetsToSave: NewAsset[] = [];
      for (const dev of verifiedDevices) {
        const name = dev.customName || `cam_${dev.ip.replace(/\./g, "_")}`;

        const updatedRtsp = dev.rtsp_url
          ? dev.rtsp_url.replace(
              /rtsp:\/\/[^@]+@/,
              `rtsp://${dev.username}:${dev.password}@`,
            )
          : `rtsp://${dev.username}:${dev.password}@${dev.ip}:554/h264/ch1/main/av_stream`;

        assetsToSave.push({
          name,
          device_type: dev.device_type,
          ip_address: dev.ip,
          username: dev.username || "",
          password: dev.password || "",
          rtsp_url: updatedRtsp,
        });
      }
      await handleSaveMultiple(assetsToSave);
      setDevices((prev) => prev.filter((d) => !d.selected));
    } catch (e) {
      toast.error(`Error registering devices: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Device Registry
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage and register camera assets across the network.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-hidden">
        {/* Top Card: Scanned/Auto-Discovered Network Devices */}
        <Card className="flex flex-1 flex-col overflow-hidden border border-secondary-highlight bg-background_alt shadow-sm">
          {/* Header and Toolbar in one line */}
          <div className="flex flex-col gap-4 border-b border-secondary-highlight bg-card p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <LuRotateCw
                className={`h-4 w-4 text-primary ${scanning ? "animate-spin" : ""}`}
              />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Discover Device
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  Subnet:
                </span>
                <Input
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                  className="h-8 w-28 rounded-md border-border/40 bg-background text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  Username:
                </span>
                <Input
                  value={bulkUsername}
                  autoComplete="new-password"
                  onChange={(e) => handleBulkUsernameChange(e.target.value)}
                  className="h-8 w-28 rounded-md border-border/40 bg-background text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  Password:
                </span>
                <Input
                  type="password"
                  placeholder="Device password"
                  autoComplete="new-password"
                  value={bulkPassword}
                  onChange={(e) => handleBulkPasswordChange(e.target.value)}
                  className="h-8 w-36 rounded-md border-border/40 bg-background text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScan}
                disabled={scanning || !subnet}
                className="flex h-8 items-center gap-1.5 border-border/40 text-xs hover:bg-muted"
              >
                {scanning ? (
                  <ActivityIndicator className="h-3 w-3" />
                ) : (
                  <LuRotateCw className="h-3.5 w-3.5" />
                )}
                {scanning ? "Scanning..." : "Scan"}
              </Button>
              <Button
                size="sm"
                onClick={handleOnboard}
                disabled={
                  saving ||
                  discoveredDevices.filter((d) => d.selected).length === 0
                }
                className="flex h-8 items-center gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/95"
              >
                {saving && <ActivityIndicator className="h-3.5 w-3.5" />}
                Add to Device List (
                {discoveredDevices.filter((d) => d.selected).length})
              </Button>
            </div>
          </div>

          {/* Table of Discovered Devices */}
          <div className="flex-1 overflow-auto">
            {scanning && (
              <div className="flex flex-col items-center justify-center space-y-4 py-16">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute h-full w-full animate-ping rounded-full border-4 border-primary/20" />
                  <div className="absolute h-10 w-10 animate-pulse rounded-full border-4 border-primary/40" />
                  <LuRotateCw className="h-6 w-6 animate-spin text-primary" />
                </div>
                <p className="animate-pulse text-xs font-medium text-primary">
                  Probing active IPs and ONVIF profiles...
                </p>
              </div>
            )}

            {!scanning && discoveredDevices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <MdSettingsEthernet className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No active devices discovered. Enter subnet and click "Scan".
                </p>
              </div>
            )}

            {!scanning && discoveredDevices.length > 0 && (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-border/40 bg-background/50 font-semibold text-muted-foreground">
                    <th className="w-10 p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={
                          discoveredDevices.length > 0 &&
                          discoveredDevices.filter((d) => d.playable).length > 0 &&
                          discoveredDevices.filter((d) => d.playable).every((d) => d.selected)
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDevices((prev) =>
                            prev.map((d) => {
                              const isRegistered = assets.some(
                                (a) => a.ip_address === d.ip,
                              );
                              if (!isRegistered) {
                                return {
                                  ...d,
                                  selected:
                                    d.playable === true ? checked : false,
                                };
                              }
                              return d;
                            }),
                          );
                        }}
                        className="h-4 w-4 rounded border-border/40 bg-background text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      Port
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      Device Category
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      Device Type
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="p-3.5 text-[10px] font-semibold uppercase tracking-wider">
                      Credentials Override
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {discoveredDevices.map((dev) => (
                    <tr
                      key={dev.ip}
                      className={`border-b border-border/40 transition hover:bg-background/40 ${
                        dev.selected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!dev.selected}
                          disabled={dev.status !== "Online"}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDevices((prev) =>
                              prev.map((d) =>
                                d.ip === dev.ip
                                  ? { ...d, selected: checked }
                                  : d,
                              ),
                            );
                          }}
                          className="h-4 w-4 rounded border-border/40 bg-background text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-3.5 font-mono text-sm font-semibold text-foreground">
                        {dev.ip}
                      </td>
                      <td className="p-3.5 font-mono text-sm text-muted-foreground">
                        {dev.port}
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground font-semibold">
                        {dev.device_type === "nvr" ? "NVR" : dev.device_type === "bwc" ? "BWC" : "IPC"}
                      </td>
                      <td className="p-3.5 text-xs text-foreground font-semibold">
                        {dev.model}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`rounded border px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${
                            dev.playable
                              ? "border-green-950 bg-green-950 text-green-400"
                              : dev.status === "Online"
                                ? "border-amber-950 bg-amber-950 text-amber-400"
                                : "border-red-950 bg-red-950 text-red-400"
                          }`}
                        >
                          {dev.playable ? "Online" : dev.status === "Online" ? "Locked" : "Offline"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex max-w-[320px] items-center gap-2">
                          <Input
                            placeholder="admin"
                            autoComplete="new-password"
                            value={dev.username || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDevices((prev) =>
                                prev.map((d) =>
                                  d.ip === dev.ip
                                    ? {
                                        ...d,
                                        username: val,
                                        playable: false,
                                        selected: false,
                                      }
                                    : d,
                                ),
                              );
                            }}
                            className="h-8 w-20 rounded-md border-border/40 bg-background/50 text-xs"
                          />
                          <Input
                            placeholder="Pass"
                            type="password"
                            autoComplete="new-password"
                            value={dev.password || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDevices((prev) =>
                                prev.map((d) =>
                                  d.ip === dev.ip
                                    ? {
                                        ...d,
                                        password: val,
                                        playable: false,
                                        selected: false,
                                      }
                                    : d,
                                ),
                              );
                            }}
                            className="h-8 w-28 rounded-md border-border/40 bg-background/50 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestRow(dev.ip)}
                            disabled={testingRows[dev.ip]}
                            className="h-8 border-border/40 px-2 text-[10px] font-semibold hover:bg-muted"
                          >
                            {testingRows[dev.ip] ? (
                              <ActivityIndicator className="h-3 w-3" />
                            ) : (
                              "Test"
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Bottom Card: Added/Registered CCTV/NVR */}
        <Card className="flex flex-1 flex-col overflow-hidden border border-secondary-highlight bg-background_alt shadow-sm">
          {/* Header and Toolbar in one line */}
          <div className="flex flex-col gap-4 border-b border-secondary-highlight bg-card p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Cctv className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Added Devices
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs md:w-60">
                <MdSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search added assets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 bg-background pl-8 text-xs"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-32 bg-background text-xs">
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="ipc">IPC Cameras</SelectItem>
                  <SelectItem value="nvr">NVR Systems</SelectItem>
                  <SelectItem value="bwc">Body Cameras</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="flex h-8 items-center gap-1.5 border-border/40 text-xs hover:bg-muted"
                onClick={() => {
                  mutate("config");
                  mutate("config/raw");
                }}
              >
                <MdRefresh className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                size="sm"
                className="flex h-8 items-center gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/95"
                onClick={() => setIsAdding(true)}
              >
                <MdAdd className="h-4 w-4" />
                Add Device
              </Button>
            </div>
          </div>

          {/* Asset Table */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <AssetTable
              assets={filteredAssets}
              isDeleting={isDeleting}
              onDelete={handleDelete}
            />
          </div>
        </Card>
      </div>

      <AlertDialog
        open={!!cameraToDelete}
        onOpenChange={(open) => !open && setCameraToDelete(null)}
      >
        <AlertDialogContent className="border-secondary-highlight bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              Delete Device
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the device '
              {cameraToDelete}'? This action cannot be undone and will reboot
              the video engine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-danger-foreground bg-danger hover:bg-danger/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!testFailureDetail}
        onOpenChange={(open) => !open && setTestFailureDetail(null)}
      >
        <AlertDialogContent className="border-red-500/40 bg-background max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-red-500/10 p-3 text-red-500">
              {testFailureDetail?.type === "unauthorized" ? (
                <ShieldAlert className="h-10 w-10 animate-bounce" />
              ) : (
                <WifiOff className="h-10 w-10 animate-pulse" />
              )}
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-tight text-red-500">
              {testFailureDetail?.type === "unauthorized"
                ? "Authentication Failed"
                : "Connection Error"}
            </AlertDialogTitle>
            <div className="w-full text-left bg-secondary/20 rounded-xl p-4 border border-border/50 space-y-2 mt-2">
              <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-1.5">
                <span>Target Host:</span>
                <span className="font-mono font-semibold text-foreground">{testFailureDetail?.ip}</span>
              </div>
              {testFailureDetail?.manufacturer && (
                <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-1.5">
                  <span>Device Manufacturer:</span>
                  <span className="font-semibold text-foreground">{testFailureDetail.manufacturer}</span>
                </div>
              )}
              {testFailureDetail?.model && (
                <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-1.5">
                  <span>Device Model:</span>
                  <span className="font-semibold text-foreground">{testFailureDetail.model}</span>
                </div>
              )}
              <div className="pt-2 text-sm text-foreground leading-relaxed whitespace-pre-line">
                {testFailureDetail?.message}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-6">
            <AlertDialogAction
              className="w-full sm:w-auto px-8 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-600/20 transition-all font-semibold"
              onClick={() => setTestFailureDetail(null)}
            >
              Acknowledge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraWizardDialog open={isAdding} onClose={() => setIsAdding(false)} />
    </div>
  );
}
