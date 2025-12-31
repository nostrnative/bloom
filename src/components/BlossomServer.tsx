import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Server, List, Trash2, Download } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface BlobItem {
  sha256: string;
  url: string;
  size: number;
  type: string;
  uploaded: number;
}

export default function BlossomServer() {
  const [serverRunning, setServerRunning] = useState(false);
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const { nsec } = useAppStore();

  useEffect(() => {
    setServerRunning(true);
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const response = await fetch("http://localhost:24242/upload", {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: uint8Array,
      });

      if (response.ok) {
        const result = await response.json();
        setBlobs((prev) => [...prev, result]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blossom Server</h1>
          <p className="text-muted-foreground">
            Decentralized media storage for the Nostr ecosystem
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={serverRunning ? "default" : "destructive"}>
            <Server className="w-3 h-3 mr-1" />
            {serverRunning ? "Running" : "Stopped"}
          </Badge>
          {serverRunning && <Badge variant="outline">Port 24242</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Blobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blobs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(blobs.reduce((acc, blob) => acc + blob.size, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Server Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {serverRunning ? "Online" : "Offline"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Upload files to your Blossom server. Files are stored with SHA256
            hashes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              onChange={async (name) => await handleFileUpload(name)}
              className="hidden"
              id="file-upload"
              disabled={uploading || !nsec}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">
                {uploading ? "Uploading..." : "Click to upload files"}
              </p>
              <p className="text-sm text-gray-500">
                {!nsec
                  ? "Set up your Nostr key in settings first"
                  : "Drag and drop or click to select"}
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <List className="w-5 h-5 mr-2" />
            Stored Blobs
          </CardTitle>
          <CardDescription>Files stored on your Blossom server</CardDescription>
        </CardHeader>
        <CardContent>
          {blobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No files uploaded yet
            </div>
          ) : (
            <div className="space-y-2">
              {blobs.map((blob) => (
                <div
                  key={blob.sha256}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {blob.sha256.substring(0, 12)}...
                    </div>
                    <div className="text-xs text-gray-500">
                      {blob.type} • {formatFileSize(blob.size)} •{" "}
                      {formatDate(blob.uploaded)}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
