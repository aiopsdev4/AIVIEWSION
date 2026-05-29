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
import useSWR, { mutate } from "swr";

import { FrigateConfig } from "@/types/frigateConfig";
import { registerCamera, deleteCamera } from "@/services/configService";

import AssetTable, { Asset } from "@/components/assets/AssetTable";
import AddDeviceDialog, { NewAsset } from "@/components/assets/AddDeviceDialog";

export default function AssetsDashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

  const handleDelete = async (camId: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the device '${camId}'?`,
      )
    )
      return;

    setIsDeleting(camId);
    try {
      await deleteCamera(camId);
      toast.success("Device deleted successfully!");
      await mutate("config");
      await mutate("config/raw");
    } catch (e) {
      toast.error("Failed to delete device configuration.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSave = async (newAsset: NewAsset) => {
    try {
      await registerCamera(newAsset.name, newAsset.rtsp_url);
      toast.success("Asset registered successfully!");
      setIsAdding(false);
      await mutate("config");
      await mutate("config/raw");
    } catch (e) {
      const err = e as any;
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to register asset.",
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
    </div>
  );
}
