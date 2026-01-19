import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default function ABTests() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">A/B Testing</h1>
            <p className="text-muted-foreground">
              Test and compare prompt variants
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Test
          </Button>
        </div>

        {/* Active Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Active Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  id: 'test-planner-v2',
                  name: 'Task Planner v2 vs v1',
                  promptA: 'task-planner:v1',
                  promptB: 'task-planner:v2',
                  split: 0.5,
                  executions: 1243,
                  status: 'running',
                },
                {
                  id: 'test-reviewer-concise',
                  name: 'Code Reviewer - Concise vs Detailed',
                  promptA: 'code-reviewer:v3',
                  promptB: 'code-reviewer:v4',
                  split: 0.5,
                  executions: 892,
                  status: 'running',
                },
              ].map((test) => (
                <div
                  key={test.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{test.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {test.executions} executions
                      </p>
                    </div>
                    <Badge variant="success">{test.status}</Badge>
                  </div>

                  {/* Variants Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded p-3 bg-muted/50">
                      <div className="text-sm font-medium mb-1">Variant A</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {test.promptA}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Traffic:</span>
                          <span className="font-medium">{test.split * 100}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="font-medium text-green-600">88.3%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Latency:</span>
                          <span className="font-medium">243ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded p-3 bg-muted/50">
                      <div className="text-sm font-medium mb-1">Variant B</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {test.promptB}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Traffic:</span>
                          <span className="font-medium">{(1 - test.split) * 100}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="font-medium text-green-600">91.7%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Latency:</span>
                          <span className="font-medium">198ms</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                    <Button size="sm" variant="outline">
                      Complete Test
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Completed Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No completed tests yet
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
