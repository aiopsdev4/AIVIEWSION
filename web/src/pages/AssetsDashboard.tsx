import { useState, useMemo } from "react";
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
import { Cctv } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import axios from "axios";

import { FrigateConfig } from "@/types/frigateConfig";
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

  const { data: config } = useSWR<FrigateConfig>("config");
  const { data: rawConfig } = useSWR<string>("config/raw");

  // Discovery states
  const [subnet, setSubnet] = useState("172.16.0");
  const [bulkUsername, setBulkUsername] = useState("");
  const [bulkPassword, setBulkPassword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [testingRows, setTestingRows] = useState<Record<string, boolean>>({});

  const assets: Asset[] = useMemo(() => {
    if (!config?.cameras) return [];

    return Object.entries(config.cameras).map(([camName, camConfig]) => {
      let ip = "Unknown IP";
      const path = camConfig.ffmpeg?.inputs?.[0]?.path;
      if (path && path.includes("@")) {
        ip = path.split("@")[1]?.split(":")[0]?.split("/")[0] || "Unknown IP";
      }

      return {
        id: camName,
        name: camName,
        device_type: "cctv",
        category: "CAMERA",
        ip_address: ip,
        status: camConfig.enabled !== false ? "Active" : "Inactive",
      };
    });
  }, [config]);

  const discoveredDevices = useMemo(() => {
    const registeredIps = new Set(assets.map((a) => a.ip_address));
    return devices.filter((d) => !registeredIps.has(d.ip));
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

  const pollServer = async () => {
    try {
      const res = await fetch(window.location.pathname + "?t=" + Date.now());
      if (res.ok) {
        window.location.reload();
      } else {
        setTimeout(pollServer, 2000);
      }
    } catch (e) {
      setTimeout(pollServer, 2000);
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
      mutate("config");
      mutate("config/raw");
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

    for (const asset of newAssets) {
      const camId = asset.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      if (registeredIds.includes(camId)) {
        toast.warning(`Device ID '${camId}' is already registered! Skipping.`);
        continue;
      }
      updatedYaml = addCameraToYaml(updatedYaml, camId, asset.rtsp_url);
    }

    try {
      await saveAndRestartConfig(updatedYaml);
      toast.success(
        "Assets saved! The video engine is now rebooting, please wait...",
      );
      setTimeout(pollServer, 5000);
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
        if (d.username === bulkUsername) {
          return {
            ...d,
            username: val,
            status: "Unverified",
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
        if (d.password === bulkPassword) {
          return {
            ...d,
            password: val,
            status: "Unverified",
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
      const url = `/api/network/discover/scan?subnet_prefix=${subnet}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setDevices(
        data.map((dev: DiscoveredDevice) => {
          const suffix =
            dev.channel_index !== undefined ? `_ch${dev.channel_index}` : "";
          return {
            ...dev,
            selected: dev.status === "Online",
            customName: `${dev.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${dev.ip.split(".").pop()}${suffix}`,
            username: bulkUsername || dev.username || "",
            password: bulkPassword || dev.password || "",
          };
        }),
      );
      toast.success(
        `Scan complete! Found ${data.length} active camera devices.`,
      );
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
        const tested = data[0];
        const suffix =
          dev.channel_index !== undefined ? `_ch${dev.channel_index}` : "";
        setDevices((prev) =>
          prev.map((d) => {
            if (d.ip === ip) {
              return {
                ...d,
                ...tested,
                selected: tested.status === "Online",
                customName:
                  d.customName ||
                  `${tested.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${tested.ip.split(".").pop()}${suffix}`,
                username: d.username,
                password: d.password,
              };
            }
            return d;
          }),
        );
        if (tested.status === "Online") {
          toast.success(`Successfully verified connection to ${dev.ip}!`);
        } else {
          toast.warning(
            `Connection tested but stream is unplayable: ${tested.status}`,
          );
        }
      } else {
        toast.error(`No response from device at ${dev.ip}`);
      }
    } catch (e) {
      toast.error(`Verification failed for ${dev.ip}: ${(e as Error).message}`);
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

    const invalidDevices = selectedDevices.filter((d) => d.status !== "Online");
    if (invalidDevices.length > 0) {
      toast.error(
        `Cannot add devices that are not online/verified: ${invalidDevices.map((d) => d.ip).join(", ")}. Please test connection first.`,
      );
      return;
    }

    setSaving(true);
    try {
      const assetsToSave: NewAsset[] = [];
      for (const dev of selectedDevices) {
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
      setDevices([]);
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
                          discoveredDevices.every((d) => d.selected)
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
                                    d.status === "Online" ? checked : false,
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
                      Open Ports
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
                      <td className="p-3.5 font-mono text-[10px] text-muted-foreground">
                        {dev.port}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`rounded border px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${
                            dev.status === "Online"
                              ? "border-green-950 bg-green-950 text-green-400"
                              : dev.status === "Unverified"
                                ? "border-amber-950 bg-amber-950 text-amber-400"
                                : "border-red-950 bg-red-950 text-red-400"
                          }`}
                        >
                          {dev.status === "Online"
                            ? "Ready to Import"
                            : dev.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex max-w-[320px] items-center gap-2">
                          <Input
                            placeholder="admin"
                            value={dev.username || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDevices((prev) =>
                                prev.map((d) =>
                                  d.ip === dev.ip
                                    ? {
                                        ...d,
                                        username: val,
                                        status: "Unverified",
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
                            value={dev.password || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDevices((prev) =>
                                prev.map((d) =>
                                  d.ip === dev.ip
                                    ? {
                                        ...d,
                                        password: val,
                                        status: "Unverified",
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
                  <SelectItem value="cctv">CCTV Only</SelectItem>
                  <SelectItem value="nvr">NVR Systems</SelectItem>
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

      <CameraWizardDialog open={isAdding} onClose={() => setIsAdding(false)} />
    </div>
  );
}
