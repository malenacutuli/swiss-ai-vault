import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useMetrics } from '@/hooks/use-metrics'

export default function Metrics() {
  const [promptId, setPromptId] = useState<string>('')
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [days, setDays] = useState<number>(30)
  const { metrics, loading } = useMetrics(selectedPromptId, days)

  const handleLoadMetrics = () => {
    if (promptId.trim()) {
      setSelectedPromptId(promptId.trim())
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Metrics & Analytics</h1>
          <p className="text-muted-foreground">
            Track performance and analyze prompt effectiveness
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Select Prompt and Time Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter prompt ID"
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadMetrics()}
                className="flex-1"
              />
              <Select
                value={days.toString()}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
              <Button onClick={handleLoadMetrics} disabled={!promptId.trim()}>
                Load Metrics
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Display */}
        {selectedPromptId && (
          <>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading metrics...
              </div>
            ) : metrics ? (
              <>
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Executions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {metrics.total_executions.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Success Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {metrics.success_rate.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Avg Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {metrics.avg_latency_ms.toFixed(0)}ms
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Avg Tokens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {metrics.avg_tokens.toFixed(0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${metrics.cost_usd.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Chart visualization coming soon
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Latency Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Chart visualization coming soon
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No metrics found for this prompt
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
