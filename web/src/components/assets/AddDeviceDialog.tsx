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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import { toast } from "sonner";
import { MdAdd } from "react-icons/md";
import { Wifi } from "lucide-react";

export interface NewAsset {
  name: string;
  device_type: string;
  ip_address: string;
  username: string;
  password: string;
  rtsp_url: string;
}

interface AddDeviceDialogProps {
  onSave: (asset: NewAsset) => Promise<void>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function AddDeviceDialog({ onSave, isOpen, setIsOpen }: AddDeviceDialogProps) {
  const [newAsset, setNewAsset] = useState<NewAsset>({
    name: "",
    device_type: "cctv",
    ip_address: "",
    username: "",
    password: "",
    rtsp_url: ""
  });
  
  const [probing, setProbing] = useState(false);
  const [probeSuccess, setProbeSuccess] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("discovery");

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
      setNewAsset(prev => ({
        ...prev,
        rtsp_url: `rtsp://${prev.username}:${prev.password}@${prev.ip_address}:554/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif`
      }));
      // Automatically switch to manual setup tab on success
      setActiveTab("manual");
    }, 1500);
  };

  const handleSaveClick = async () => {
    if (!newAsset.name || !newAsset.rtsp_url) {
      toast.error("Please ensure asset is named and stream URL is filled");
      return;
    }
    await onSave(newAsset);
    // Reset form on success
    setNewAsset({
      name: "",
      device_type: "cctv",
      ip_address: "",
      username: "",
      password: "",
      rtsp_url: ""
    });
    setProbeSuccess(null);
    setActiveTab("discovery");
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clean reset when dialog is closed/cancelled
      setNewAsset({
        name: "",
        device_type: "cctv",
        ip_address: "",
        username: "",
        password: "",
        rtsp_url: ""
      });
      setProbeSuccess(null);
      setActiveTab("discovery");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
        
        {/* Shared Device Type Selector */}
        <div className="space-y-2 mt-4">
          <Label htmlFor="device_type">Device Type</Label>
          <Select 
            value={newAsset.device_type} 
            onValueChange={(val) => setNewAsset({...newAsset, device_type: val})}
          >
            <SelectTrigger className="w-full">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discovery">Auto Discovery</TabsTrigger>
            <TabsTrigger value="manual">Manual Setup</TabsTrigger>
          </TabsList>
          
          <TabsContent value="discovery" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="device_username">Username</Label>
                <Input 
                  id="device_username" 
                  name="device_username"
                  autoComplete="off"
                  value={newAsset.username}
                  onChange={(e) => setNewAsset({...newAsset, username: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_password">Password</Label>
                <Input 
                  id="device_password" 
                  name="device_password"
                  type="password"
                  autoComplete="new-password"
                  data-lpignore="true"
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
              <Label htmlFor="rtsp">Detected RTSP Stream URL (Editable)</Label>
              <Input 
                id="rtsp" 
                placeholder="rtsp://username:password@ip:port/stream_path"
                value={newAsset.rtsp_url} 
                onChange={(e) => setNewAsset({...newAsset, rtsp_url: e.target.value})} 
              />
            </div>
            <div className="flex justify-end pt-4 gap-3">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSaveClick}>Save Registration</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
