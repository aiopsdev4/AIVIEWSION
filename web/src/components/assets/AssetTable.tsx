import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import { Cctv, Video, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Asset {
  id: string;
  name: string;
  device_type: string;
  category: string;
  ip_address: string;
  status: string;
}

interface AssetTableProps {
  assets: Asset[];
  isDeleting: string | null;
  onDelete: (id: string) => Promise<void>;
}

export default function AssetTable({ assets, isDeleting, onDelete }: AssetTableProps) {
  return (
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
          {assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                No devices found matching your criteria.
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => (
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
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-primary">Manage</Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-danger hover:text-danger hover:bg-danger/20"
                      onClick={() => onDelete(asset.id)}
                      disabled={isDeleting === asset.id}
                    >
                      {isDeleting === asset.id ? <ActivityIndicator className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
