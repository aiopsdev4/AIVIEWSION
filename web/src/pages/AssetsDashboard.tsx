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
import { MdSearch, MdDownload, MdRefresh, MdAdd } from "react-icons/md";
import useSWR, { useSWRConfig } from "swr";
import { useTranslation } from "react-i18next";
import axios from "axios";

import { FrigateConfig } from "@/types/frigateConfig";
import { addCameraToYaml } from "@/helpers/configHelpers";
import { saveAndRestartConfig } from "@/services/configService";

import AssetTable, { Asset } from "@/components/assets/AssetTable";
import AutoDiscoverDialog from "@/components/assets/AutoDiscoverDialog";
import CameraWizardDialog from "@/components/settings/CameraWizardDialog";

interface NewAsset {
  name: string;
  device_type: string;
  ip_address: string;
  username: string;
  password: string;
  rtsp_url: string;
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
  const { t } = useTranslation(["views/settings"]);
  const { mutate } = useSWRConfig();
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
      setIsAdding(false);
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
            onSaveMultiple={handleSaveMultiple}
          />
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsAdding(true)}
          >
            <MdAdd className="h-4 w-4" />
            {t("cameraManagement.addCamera")}
          </Button>
          <CameraWizardDialog
            open={isAdding}
            onClose={() => setIsAdding(false)}
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
    </div>
  );
}
