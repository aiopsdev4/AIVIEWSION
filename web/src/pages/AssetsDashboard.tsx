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
import { MdSearch, MdDownload, MdRefresh } from "react-icons/md";
import useSWR from "swr";

import { FrigateConfig } from "@/types/frigateConfig";
import { removeCameraFromYaml, addCameraToYaml } from "@/helpers/configHelpers";
import { saveAndRestartConfig } from "@/services/configService";

import AssetTable, { Asset } from "@/components/assets/AssetTable";
import AddDeviceDialog, { NewAsset } from "@/components/assets/AddDeviceDialog";
import AutoDiscoverDialog from "@/components/assets/AutoDiscoverDialog";
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [cameraToDelete, setCameraToDelete] = useState<string | null>(null);

  const { data: config } = useSWR<FrigateConfig>("config");
  const { data: rawConfig } = useSWR<string>("config/raw");

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
      const updatedYaml = removeCameraFromYaml(rawConfig!, camId);
      await saveAndRestartConfig(updatedYaml);
      toast.success("Device deleted! The video engine is rebooting...");
      setTimeout(pollServer, 5000);
    } catch (e) {
      toast.error("Failed to delete device configuration.");
      setIsDeleting(null);
    }
  };

  const handleSave = async (newAsset: NewAsset) => {
    if (!rawConfig) {
      toast.error("System configuration not loaded yet.");
      return;
    }

    const camId = newAsset.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    if (Object.keys(config?.cameras || {}).includes(camId)) {
      toast.error(
        `Device ID '${camId}' is already registered! Use a unique name.`,
      );
      return;
    }

    try {
      const updatedYaml = addCameraToYaml(rawConfig, camId, newAsset.rtsp_url);
      await saveAndRestartConfig(updatedYaml);
      toast.success(
        "Asset saved! The video engine is now rebooting, please wait...",
      );
      setIsAdding(false);
      setTimeout(pollServer, 5000);
    } catch (e) {
      const err = e as Error;
      toast.error(
        err.message ||
          "Failed to commit settings to main system configuration.",
      );
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background p-4 md:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Device Registry
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage and register camera assets across the network.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <MdRefresh className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <MdDownload className="h-4 w-4" />
            Export
          </Button>
          <AutoDiscoverDialog
            isOpen={isDiscovering}
            setIsOpen={setIsDiscovering}
            onSave={handleSave}
          />
          <AddDeviceDialog
            isOpen={isAdding}
            setIsOpen={setIsAdding}
            onSave={handleSave}
          />
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden border border-secondary-highlight bg-background_alt shadow-sm">
        <div className="flex flex-col gap-4 border-b border-secondary-highlight bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-sm">
              <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-background pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filter Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="cctv">CCTV Only</SelectItem>
                <SelectItem value="nvr">NVR Systems</SelectItem>
                <SelectItem value="ptz">PTZ Cameras</SelectItem>
                <SelectItem value="bodycam">BodyCams</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AssetTable
          assets={filteredAssets}
          isDeleting={isDeleting}
          onDelete={handleDelete}
        />
      </Card>

      <AlertDialog open={!!cameraToDelete} onOpenChange={(open) => !open && setCameraToDelete(null)}>
        <AlertDialogContent className="border-secondary-highlight bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the device '{cameraToDelete}'? This action cannot be undone and will reboot the video engine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
