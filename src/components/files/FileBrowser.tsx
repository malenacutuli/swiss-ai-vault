// src/components/files/FileBrowser.tsx
import React, { useState } from 'react';
import {
  File, FileText, FileSpreadsheet, Image, FileCode,
  Download, Trash2, Eye, Loader2, Search, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useArtifacts, Artifact } from '@/hooks/useArtifacts';
import { formatDistanceToNow } from 'date-fns';

interface FileBrowserProps {
  runId?: string;
}

export function FileBrowser({ runId }: FileBrowserProps) {
  const { artifacts, isLoading, error, getDownloadUrl, deleteArtifact } = useArtifacts(runId);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const getFileIcon = (type: string, mimeType: string) => {
    if (type === 'image' || mimeType.startsWith('image/'))
      return <Image className="w-5 h-5 text-purple-500" />;
    if (type === 'document' || mimeType.includes('pdf') || mimeType.includes('word'))
      return <FileText className="w-5 h-5 text-blue-500" />;
    if (type === 'data' || mimeType.includes('spreadsheet') || mimeType.includes('excel'))
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    if (type === 'code' || mimeType.includes('text/') || mimeType.includes('json'))
      return <FileCode className="w-5 h-5 text-orange-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (artifact: Artifact) => {
    setDownloading(artifact.id);
    try {
      const url = await getDownloadUrl(artifact.id);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = artifact.file_name;
        link.click();
      }
    } finally {
      setDownloading(null);
    }
  };

  const filteredArtifacts = artifacts.filter(a => {
    if (search && !a.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    return true;
  });

  const types = [...new Set(artifacts.map(a => a.type))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#1D4E5F]" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <File className="w-5 h-5" />
            Files & Artifacts
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <select
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value || null)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Types</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {filteredArtifacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {artifacts.length === 0 ? 'No files yet' : 'No files match your search'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredArtifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(artifact.type, artifact.mime_type)}
                  <div>
                    <p className="font-medium text-sm">{artifact.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(artifact.file_size_bytes)}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(artifact.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {artifact.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(artifact)}
                    disabled={downloading === artifact.id}
                  >
                    {downloading === artifact.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteArtifact(artifact.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
