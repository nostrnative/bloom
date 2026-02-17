import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Server,
  List,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface BlobItem {
  sha256: string;
  url: string;
  size: number;
  type: string;
  uploaded: number;
}

export default function BlossomServer() {
  const { pubkey, blossomPort: port } = useAppStore();
  const queryClient = useQueryClient();
  const [serverRunning, setServerRunning] = useState(false);

  const [uploadStats, setUploadStats] = useState<{
    total: number;
    current: number;
    isUploading: boolean;
  }>({ total: 0, current: 0, isUploading: false });

  const serverUrl = useMemo(() => `http://127.0.0.1:${port}`, [port]);

  const checkServer = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/`, {
        method: 'GET',
        cache: 'no-cache',
        headers: { Accept: 'application/json' },
      });
      setServerRunning(response.ok);
    } catch {
      setServerRunning(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    if (serverRunning) return;

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, [checkServer, serverRunning]);

  const { data: blobs = [], isLoading: isLoadingBlobs } = useQuery({
    queryKey: ['blobs', serverUrl, pubkey],
    queryFn: async () => {
      // Fallback to "anonymous" if no pubkey, but still try to list
      const listPubkey = pubkey || 'anonymous';
      const response = await fetch(`${serverUrl}/list/${listPubkey}`);
      if (!response.ok) throw new Error('Failed to fetch blobs');
      return response.json() as Promise<BlobItem[]>;
    },
    enabled: serverRunning,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const contentType = file.type || 'application/octet-stream';
      const fileExtension = file.name.split('.').pop();

      const response = await fetch(`${serverUrl}/upload`, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          ...(fileExtension ? { 'X-File-Extension': fileExtension } : {}),
        },
        body: uint8Array,
      });

      if (!response.ok) throw new Error('Upload failed');
      return response.json() as Promise<BlobItem>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobs', serverUrl] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sha256: string) => {
      const response = await fetch(`${serverUrl}/${sha256}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const reason = response.headers.get('X-Reason');
        throw new Error(reason || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobs', serverUrl] });
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadStats({
      total: files.length,
      current: 0,
      isUploading: true,
    });

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadStats((prev) => ({ ...prev, current: i + 1 }));
        await uploadMutation.mutateAsync(files[i]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadStats({ total: 0, current: 0, isUploading: false });
      event.target.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const totalSize = blobs.reduce((acc, blob) => acc + blob.size, 0);

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='bg-primary/10 rounded-2xl p-3'>
            <Server className='text-primary h-8 w-8' />
          </div>
          <div>
            <h1 className='text-3xl font-bold'>Blossom Server</h1>
            <p className='text-muted-foreground'>
              Decentralized media storage for the Nostr ecosystem
            </p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={() => {
              checkServer();
              queryClient.invalidateQueries({
                queryKey: ['blobs', serverUrl, pubkey],
              });
            }}
          >
            <RefreshCw className='h-4 w-4' />
          </Button>
          <Badge variant={serverRunning ? 'default' : 'destructive'}>
            <Server className='mr-1 h-3 w-3' />
            {serverRunning ? 'Running' : 'Stopped'}
          </Badge>
          <Badge variant='outline'>Port {port}</Badge>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader className='text-muted-foreground pb-2 text-sm font-medium tracking-wider uppercase'>
            Connection URL
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <code className='text-lg font-bold text-blue-600 dark:text-blue-400'>
                {serverUrl}
              </code>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => navigator.clipboard.writeText(serverUrl)}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='text-muted-foreground pb-2 text-sm font-medium tracking-wider uppercase'>
            Storage Info
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <div className='text-2xl font-bold'>
                {isLoadingBlobs ? (
                  <Loader2 className='h-6 w-6 animate-spin' />
                ) : (
                  formatFileSize(totalSize)
                )}
              </div>
              <div className='text-muted-foreground text-sm'>
                {blobs.length} blobs
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Upload className='mr-2 h-5 w-5' />
            Upload Files
          </CardTitle>
          <CardDescription>
            Upload files to your Blossom server. Files are stored with SHA256
            hashes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border-2 border-dashed border-gray-300 p-6 text-center'>
            <input
              type='file'
              onChange={handleFileUpload}
              className='hidden'
              id='file-upload'
              multiple
              accept='image/*,video/*,audio/*,.pdf,.txt,.psbt'
              disabled={uploadStats.isUploading || !pubkey}
            />
            <label htmlFor='file-upload' className='cursor-pointer'>
              {uploadStats.isUploading ? (
                <Loader2 className='mx-auto mb-4 h-12 w-12 animate-spin text-blue-500' />
              ) : (
                <Upload className='mx-auto mb-4 h-12 w-12 text-gray-400' />
              )}
              <p className='text-lg font-medium'>
                {uploadStats.isUploading
                  ? `Uploading (${uploadStats.current}/${uploadStats.total})...`
                  : 'Click to upload files'}
              </p>
              <p className='text-sm text-gray-500'>
                {!pubkey
                  ? 'Set up your Nostr key in settings first'
                  : 'Drag and drop or click to select multiple files'}
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <List className='mr-2 h-5 w-5' />
            Stored Blobs
          </CardTitle>
          <CardDescription>Files stored on your Blossom server</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBlobs ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
            </div>
          ) : blobs.length === 0 ? (
            <div className='py-8 text-center text-gray-500'>
              No files uploaded yet
            </div>
          ) : (
            <div className='space-y-2'>
              {blobs.map((blob) => (
                <div
                  key={blob.sha256}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='flex-1'>
                    <div className='text-sm font-medium'>
                      {blob.sha256.substring(0, 12)}...
                    </div>
                    <div className='text-xs text-gray-500'>
                      {blob.type} • {formatFileSize(blob.size)} •{' '}
                      {formatDate(blob.uploaded)}
                    </div>
                  </div>
                  <div className='flex space-x-2'>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => window.open(blob.url, '_blank')}
                    >
                      <Download className='h-4 w-4' />
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => deleteMutation.mutate(blob.sha256)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending &&
                      deleteMutation.variables === blob.sha256 ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Trash2 className='h-4 w-4' />
                      )}
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
