import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MdSettingsEthernet } from "react-icons/md";
import { LuRotateCw } from "react-icons/lu";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import { NewAsset } from "./AddDeviceDialog";

interface AutoDiscoverDialogProps {
  onSaveMultiple: (assets: NewAsset[]) => Promise<void>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface DiscoveredDevice {
  ip: string;
  status: string;
  manufacturer: string;
  model: string;
  device_type: string;
  ptz: boolean;
  audio: boolean;
  port: number;
  rtsp_url: string;
  username?: string;
  password?: string;
  customName?: string;
  selected?: boolean;
  channel_index?: number;
}

export default function AutoDiscoverDialog({
  onSaveMultiple,
  isOpen,
  setIsOpen,
}: AutoDiscoverDialogProps) {
  const [subnet, setSubnet] = useState("172.16.0");
  const [bulkUsername, setBulkUsername] = useState("");
  const [bulkPassword, setBulkPassword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [testingRows, setTestingRows] = useState<Record<number, boolean>>({});

  const handleBulkUsernameChange = (val: string) => {
    setBulkUsername(val);
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        username: d.username === bulkUsername ? val : d.username,
      })),
    );
  };

  const handleBulkPasswordChange = (val: string) => {
    setBulkPassword(val);
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        password: d.password === bulkPassword ? val : d.password,
      })),
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
            username: bulkUsername,
            password: bulkPassword,
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

  const handleTestRow = async (idx: number) => {
    const dev = devices[idx];
    setTestingRows((prev) => ({ ...prev, [idx]: true }));
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
        const updated = [...devices];
        const suffix =
          dev.channel_index !== undefined ? `_ch${dev.channel_index}` : "";
        updated[idx] = {
          ...dev,
          ...tested,
          selected: tested.status === "Online",
          customName:
            dev.customName ||
            `${tested.manufacturer.replace(/[^a-zA-Z0-9]/g, "")}_${tested.ip.split(".").pop()}${suffix}`,
          username: dev.username,
          password: dev.password,
        };
        setDevices(updated);
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
      setTestingRows((prev) => ({ ...prev, [idx]: false }));
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
      const assetsToSave: NewAsset[] = [];
      for (const dev of selectedDevices) {
        const name = dev.customName || `cam_${dev.ip.replace(/\./g, "_")}`;

        // Ensure RTSP URL uses the latest typed credentials
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
      await onSaveMultiple(assetsToSave);
      setIsOpen(false);
      setDevices([]);
    } catch (e) {
      toast.error(`Error registering devices: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <MdSettingsEthernet className="h-4 w-4 text-primary" />
          Auto-Discover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/40 bg-background p-6 shadow-2xl sm:max-w-[1000px]">
        <DialogHeader className="mb-4 border-b border-border/40 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
            <LuRotateCw className="animate-spin-slow h-5 w-5 text-primary" />
            <span>Scan Connected CCTV Network</span>
          </DialogTitle>
        </DialogHeader>

        {/* Bulk Credentials box styled exactly like photo */}
        <div className="mb-4 flex flex-col justify-between gap-4 rounded-xl border border-border/40 bg-card/30 p-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Bulk Credentials
            </h4>
            <p className="text-xs text-muted-foreground">
              Use these default credentials to authenticate discovered devices
              during batch import.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Subnet:
              </span>
              <Input
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                className="h-8 w-28 animate-none rounded-md border-border/40 bg-background text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Username:
              </span>
              <Input
                value={bulkUsername}
                onChange={(e) => handleBulkUsernameChange(e.target.value)}
                className="h-8 w-28 animate-none rounded-md border-border/40 bg-background text-xs"
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
                className="h-8 w-36 animate-none rounded-md border-border/40 bg-background text-xs"
              />
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="mt-2 min-h-[300px]">
          {scanning && (
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute h-full w-full animate-ping rounded-full border-4 border-primary/20" />
                <div className="absolute h-12 w-12 animate-pulse rounded-full border-4 border-primary/40" />
                <LuRotateCw className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="animate-pulse text-sm font-medium text-primary">
                Probing active IPs and ONVIF profiles...
              </p>
            </div>
          )}

          {!scanning && devices.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-card/10 py-20">
              <MdSettingsEthernet className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No active devices discovered. Adjust the subnet and click
                "Rescan Subnet".
              </p>
            </div>
          )}

          {!scanning && devices.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border/40 bg-card/20 shadow-lg">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-background/50 font-semibold text-muted-foreground">
                      <th className="w-10 p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={
                            devices.length > 0 &&
                            devices.every((d) => d.selected)
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDevices((prev) =>
                              prev.map((d) => ({
                                ...d,
                                selected:
                                  d.status === "Online" ? checked : false,
                              })),
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
                    {devices.map((dev, idx) => (
                      <tr
                        key={idx}
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
                              const updated = [...devices];
                              updated[idx].selected = e.target.checked;
                              setDevices(updated);
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
                                const updated = [...devices];
                                updated[idx].username = e.target.value;
                                setDevices(updated);
                              }}
                              className="h-8 w-20 rounded-md border-border/40 bg-background/50 text-xs"
                            />
                            <Input
                              placeholder="Pass"
                              type="password"
                              value={dev.password || ""}
                              onChange={(e) => {
                                const updated = [...devices];
                                updated[idx].password = e.target.value;
                                setDevices(updated);
                              }}
                              className="h-8 w-28 rounded-md border-border/40 bg-background/50 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTestRow(idx)}
                              disabled={testingRows[idx]}
                              className="h-8 border-border/40 px-2 text-[10px] font-semibold hover:bg-muted"
                            >
                              {testingRows[idx] ? (
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
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions matching exactly the photo */}
        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={saving}
            className="h-9 border-border/40 px-4 text-xs font-semibold uppercase tracking-wider hover:bg-muted"
          >
            Close
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={scanning || !subnet}
              className="flex h-9 items-center gap-2 border-border/40 px-4 text-xs font-semibold uppercase tracking-wider hover:bg-muted"
            >
              {scanning ? (
                <ActivityIndicator className="h-4 w-4" />
              ) : (
                <LuRotateCw className="h-4 w-4" />
              )}
              {scanning ? "Scanning..." : "Rescan Subnet"}
            </Button>
            <Button
              onClick={handleOnboard}
              disabled={
                saving || devices.filter((d) => d.selected).length === 0
              }
              className="flex h-9 items-center gap-2 bg-primary px-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/95"
            >
              {saving && <ActivityIndicator className="h-4 w-4" />}
              IMPORT SELECTED ({devices.filter((d) => d.selected).length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
