import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MdSettingsEthernet,
  MdCheck,
  MdClose,
  MdVolumeUp,
  MdVolumeOff,
  MdOpenWith,
  MdSearch,
} from "react-icons/md";
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
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [testingRows, setTestingRows] = useState<Record<number, boolean>>({});

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
            username: dev.username || "admin",
            password: dev.password || "password1",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto border border-secondary-highlight bg-background shadow-xl sm:max-w-[950px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Network CCTV Auto-Scanner
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Scan local network range and dynamically manage individual device
            credentials.
          </DialogDescription>
        </DialogHeader>

        {/* Scanner Configurations */}
        <div className="mt-4 flex max-w-sm items-end gap-4 rounded-lg border border-secondary-highlight bg-card p-4">
          <div className="flex-grow space-y-2">
            <Label
              htmlFor="subnet"
              className="text-xs font-semibold text-foreground"
            >
              Target Subnet Range
            </Label>
            <Input
              id="subnet"
              placeholder="e.g. 172.16.0"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              className="h-9 bg-background"
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={scanning || !subnet}
            className="flex h-9 items-center justify-center gap-2"
          >
            {scanning ? (
              <ActivityIndicator className="h-4 w-4" />
            ) : (
              <MdSearch className="h-5 w-5" />
            )}
            {scanning ? "Scanning..." : "Scan Subnet"}
          </Button>
        </div>

        {/* Scan Status / Results Table */}
        <div className="mt-6">
          {scanning && (
            <div className="flex flex-col items-center justify-center space-y-4 py-16">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-full w-full animate-ping rounded-full border-4 border-primary/20" />
                <div className="absolute h-16 w-16 animate-pulse rounded-full border-4 border-primary/40" />
                <MdSettingsEthernet className="h-10 w-10 animate-spin text-primary" />
              </div>
              <p className="animate-pulse text-sm font-medium text-primary">
                Probing active IPs and ONVIF profiles...
              </p>
            </div>
          )}

          {!scanning && devices.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-secondary-highlight py-12">
              <MdSettingsEthernet className="mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No search results. Enter a subnet above and click scan.
              </p>
            </div>
          )}

          {!scanning && devices.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Discovered Camera Assets ({devices.length})
              </h3>
              <div className="overflow-hidden rounded-md border border-secondary-highlight bg-card">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-secondary-highlight bg-background font-semibold text-muted-foreground">
                      <th className="w-8 p-3"></th>
                      <th className="p-3">Brand & Model</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Audio</th>
                      <th className="p-3">PTZ</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Device Credentials</th>
                      <th className="w-16 p-3">Verify</th>
                      <th className="p-3">Name Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((dev, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-secondary-highlight transition hover:bg-background_alt ${
                          dev.selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={!!dev.selected}
                            disabled={dev.status !== "Online"}
                            onChange={(e) => {
                              const updated = [...devices];
                              updated[idx].selected = e.target.checked;
                              setDevices(updated);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="p-3 font-medium">
                          <div className="font-semibold text-foreground">
                            {dev.manufacturer}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {dev.model}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-foreground">
                          {dev.ip}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              dev.device_type === "nvr"
                                ? "border border-purple-800 bg-purple-900/40 text-purple-300"
                                : "border border-blue-800 bg-blue-900/40 text-blue-300"
                            }`}
                          >
                            {dev.device_type}
                          </span>
                        </td>
                        <td className="p-3">
                          {dev.audio ? (
                            <MdVolumeUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <MdVolumeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="p-3">
                          {dev.ptz ? (
                            <MdOpenWith className="h-4 w-4 text-green-400" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              -
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              dev.status === "Online"
                                ? "border border-green-900 bg-green-950 text-green-400"
                                : "border border-red-900 bg-red-950 text-red-400"
                            }`}
                          >
                            {dev.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex max-w-[120px] flex-col gap-1">
                            <Input
                              placeholder="Username"
                              value={dev.username || ""}
                              onChange={(e) => {
                                const updated = [...devices];
                                updated[idx].username = e.target.value;
                                setDevices(updated);
                              }}
                              className="h-6 bg-background px-1.5 py-0.5 text-[10px]"
                            />
                            <Input
                              placeholder="Password"
                              type="password"
                              value={dev.password || ""}
                              onChange={(e) => {
                                const updated = [...devices];
                                updated[idx].password = e.target.value;
                                setDevices(updated);
                              }}
                              className="h-6 bg-background px-1.5 py-0.5 text-[10px]"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestRow(idx)}
                            disabled={testingRows[idx]}
                            className="h-7 px-2 text-[10px] font-medium"
                          >
                            {testingRows[idx] ? (
                              <ActivityIndicator className="h-3 w-3" />
                            ) : (
                              "Test"
                            )}
                          </Button>
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder="camera_name"
                            value={dev.customName || ""}
                            disabled={!dev.selected}
                            onChange={(e) => {
                              const updated = [...devices];
                              updated[idx].customName = e.target.value;
                              setDevices(updated);
                            }}
                            className="h-7 max-w-[130px] bg-background text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  <MdClose className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleOnboard}
                  disabled={
                    saving || devices.filter((d) => d.selected).length === 0
                  }
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <ActivityIndicator className="h-4 w-4" />
                  ) : (
                    <MdCheck className="h-4 w-4" />
                  )}
                  {saving
                    ? "Registering Assets..."
                    : "Register Selected Devices"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
