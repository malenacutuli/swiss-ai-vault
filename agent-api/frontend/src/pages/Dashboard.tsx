import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/layout/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle, FileText, FlaskConical } from 'lucide-react'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your prompt management system
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Executions"
            value="45.2K"
            description="Last 30 days"
            icon={Activity}
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatsCard
            title="Success Rate"
            value="89.2%"
            description="Across all prompts"
            icon={CheckCircle}
            trend={{ value: 2.1, isPositive: true }}
          />
          <StatsCard
            title="Active Prompts"
            value="12"
            description="Currently in production"
            icon={FileText}
          />
          <StatsCard
            title="Running Tests"
            value="3"
            description="A/B tests active"
            icon={FlaskConical}
          />
        </div>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Chart visualization coming soon
            </div>
          </CardContent>
        </Card>

        {/* Top Prompts */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'task-planner', executions: 12543, successRate: 92.3 },
                { name: 'code-reviewer', executions: 8921, successRate: 88.1 },
                { name: 'data-analyst', executions: 6789, successRate: 91.7 },
              ].map((prompt) => (
                <div
                  key={prompt.name}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <div className="font-medium">{prompt.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {prompt.executions.toLocaleString()} executions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">
                      {prompt.successRate}%
                    </div>
                    <div className="text-sm text-muted-foreground">success</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
