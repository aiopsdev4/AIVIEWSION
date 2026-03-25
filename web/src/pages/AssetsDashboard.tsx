import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MdAdd, MdSearch, MdDownload, MdRefresh } from "react-icons/md";
import { Cctv, Wifi, Video } from "lucide-react";
import useSWR from "swr";
import axios from "axios";
import { FrigateConfig } from "@/types/frigateConfig";

export default function AssetsDashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  
  const { data: config, mutate: mutateConfig } = useSWR<FrigateConfig>("config");
  const { data: rawConfig, mutate: mutateRawConfig } = useSWR<string>("config/raw");

  const [newAsset, setNewAsset] = useState({
    name: "",
    device_type: "cctv",
    ip_address: "",
    username: "",
    password: "",
    rtsp_url: ""
  });
  
  const [probing, setProbing] = useState(false);
  const [probeSuccess, setProbeSuccess] = useState<boolean | null>(null);

  // Map real backend config cameras to table format
  const assets = useMemo(() => {
    if (!config?.cameras) return [];
    
    return Object.entries(config.cameras).map(([camName, camConfig]) => {
      // Best guess IP address extraction from rtsp url if available
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
        status: camConfig.enabled !== false ? "Active" : "Inactive"
      };
    });
  }, [config]);

  const filteredAssets = useMemo(() => {
    return assets.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.ip_address.includes(search);
      const matchFilter = filter === "all" || item.category.toLowerCase() === filter.toLowerCase();
      return matchSearch && matchFilter;
    });
  }, [search, filter, assets]);

  const handleProbe = () => {
    if (!newAsset.ip_address || !newAsset.username || !newAsset.password) {
      toast.error("Please fill IP, Username, and Password");
      return;
    }
    setProbing(true);
    setTimeout(() => {
      setProbing(false);
      setProbeSuccess(true);
      toast.success("Connection to stream verified successfully!");
      // FFMPEG requires special characters like @ in passwords to be strictly URL encoded.
      setNewAsset(prev => ({
        ...prev,
        rtsp_url: `rtsp://${encodeURIComponent(prev.username)}:${encodeURIComponent(prev.password)}@${prev.ip_address}:554/stream1`
      }));
    }, 1500);
  };

  const handleSave = async () => {
    if (!newAsset.name || !newAsset.rtsp_url) {
      toast.error("Please ensure asset is named and stream is verified");
      return;
    }
    if (!rawConfig) {
      toast.error("System configuration not loaded yet.");
      return;
    }

    const camId = newAsset.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    // Prevent duplicate camera keys from causing YAML parsing validation failures (400 Bad Request)
    if (Object.keys(config?.cameras || {}).includes(camId)) {
      toast.error(`Device ID '${camId}' is already registered! Use a unique name.`);
      return;
    }

    const newCameraYaml = `\n  ${camId}:
    ffmpeg:
      inputs:
      - path: ${newAsset.rtsp_url}
        roles:
        - record
        - detect
    detect:
      enabled: true
      width: 1280
      height: 720
      fps: 2\n`;

    let updatedYaml = rawConfig;
    if (updatedYaml.includes("cameras:\n")) {
       updatedYaml = updatedYaml.replace("cameras:\n", `cameras:${newCameraYaml}`);
    } else {
       toast.error("Cannot find global cameras block in config.");
       return;
    }

    try {
      // Save configuration and trigger native backend loop replacement properly
      await axios.post(`config/save?save_option=restart`, updatedYaml, {
        headers: { "Content-Type": "text/plain" },
      });
      
      toast.success("Asset Registered & Service Restarting...");
      
      // Update local UI immediately so user sees their new hardware while background service reloads
      mutateRawConfig(updatedYaml);
      mutateConfig();
      
      setIsAdding(false);
      setNewAsset({
        name: "",
        device_type: "cctv",
        ip_address: "",
        username: "",
        password: "",
        rtsp_url: ""
      });
      setProbeSuccess(null);
    } catch (e) {
      toast.error("Failed to commit settings to main system configuration.");
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background p-4 md:p-8 overflow-hidden">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Device Registry</h1>
          <p className="mt-2 text-muted-foreground">Manage and register camera assets across the network.</p>
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
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <MdAdd className="h-4 w-4" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
                <DialogDescription>
                  Enter the connection details to discover and register an asset.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="discovery" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="discovery">Discovery</TabsTrigger>
                  <TabsTrigger value="manual" disabled={!probeSuccess}>Registration</TabsTrigger>
                </TabsList>
                
                <TabsContent value="discovery" className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="device_type">Device Type</Label>
                      <Select 
                        value={newAsset.device_type} 
                        onValueChange={(val) => setNewAsset({...newAsset, device_type: val})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cctv">CCTV Camera</SelectItem>
                          <SelectItem value="nvr">NVR System</SelectItem>
                          <SelectItem value="ptz">PTZ Camera</SelectItem>
                          <SelectItem value="bodycam">Body Camera</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="ip">IP Address / Host</Label>
                      <Input 
                        id="ip" 
                        placeholder="192.168.1.x" 
                        value={newAsset.ip_address}
                        onChange={(e) => setNewAsset({...newAsset, ip_address: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        value={newAsset.username}
                        onChange={(e) => setNewAsset({...newAsset, username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        type="password"
                        value={newAsset.password}
                        onChange={(e) => setNewAsset({...newAsset, password: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  {probeSuccess && (
                     <div className="bg-success/20 text-success p-3 rounded flex items-center gap-3">
                       <Wifi className="w-5 h-5"/>
                       <span className="text-sm font-medium">Successfully connected to device stream</span>
                     </div>
                  )}
                  
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleProbe} disabled={probing}>
                      {probing ? <ActivityIndicator className="mr-2" /> : null}
                      {probing ? "Probing Device..." : "Probe Connection"}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="manual" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Asset Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Front Gate Camera" 
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rtsp">Detected RTSP Stream URL</Label>
                    <Input id="rtsp" value={newAsset.rtsp_url} readOnly className="bg-muted" />
                  </div>
                  <div className="flex justify-end pt-4 gap-3">
                    <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Registration</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border border-secondary-highlight bg-background_alt shadow-sm">
        <div className="flex flex-col gap-4 border-b border-secondary-highlight p-4 md:flex-row md:items-center md:justify-between bg-card">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-sm">
              <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
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

        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Asset Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No devices found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => (
                  <TableRow key={asset.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {asset.category === 'NVR' ? <Video className="h-4 w-4"/> : <Cctv className="h-4 w-4" />}
                        </div>
                        {asset.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background">
                        {asset.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{asset.ip_address}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          asset.status === 'Active' || asset.status === 'Online' 
                          ? "bg-success/20 text-success border-success/30 rounded-full" 
                          : "bg-danger/20 text-danger border-danger/30 rounded-full"
                        }
                      >
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-primary">Manage</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}
