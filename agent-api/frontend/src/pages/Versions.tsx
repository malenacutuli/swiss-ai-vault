import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useVersions } from '@/hooks/use-versions'
import { formatDate } from '@/lib/utils'
import { Plus } from 'lucide-react'

export default function Versions() {
  const [promptId, setPromptId] = useState<string>('')
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const { versions, loading, activateVersion, rollbackVersion } = useVersions(selectedPromptId)

  const handleLoadVersions = () => {
    if (promptId.trim()) {
      setSelectedPromptId(promptId.trim())
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'draft':
        return 'secondary'
      case 'archived':
        return 'outline'
      case 'deprecated':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Version Management</h1>
            <p className="text-muted-foreground">
              Manage prompt versions and track changes
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Version
          </Button>
        </div>

        {/* Prompt Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter prompt ID (e.g., task-planner)"
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadVersions()}
              />
              <Button onClick={handleLoadVersions} disabled={!promptId.trim()}>
                Load Versions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Versions Table */}
        {selectedPromptId && (
          <Card>
            <CardHeader>
              <CardTitle>Versions for "{selectedPromptId}"</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading versions...
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No versions found for this prompt
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((version) => (
                      <TableRow key={version.version}>
                        <TableCell className="font-medium">
                          v{version.version}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(version.status)}>
                            {version.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(version.created_at)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {version.content.substring(0, 100)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {version.status !== 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => activateVersion(version.version)}
                              >
                                Activate
                              </Button>
                            )}
                            {version.status === 'active' && (
                              <Badge variant="success">Active</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rollbackVersion(version.version)}
                            >
                              Rollback
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
