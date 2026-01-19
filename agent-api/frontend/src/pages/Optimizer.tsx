import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, Zap, DollarSign } from 'lucide-react'

export default function Optimizer() {
  const [promptId, setPromptId] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    setAnalyzing(true)
    // Simulate analysis
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setAnalyzing(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Prompt Optimizer</h1>
          <p className="text-muted-foreground">
            Get intelligent recommendations to improve prompt performance
          </p>
        </div>

        {/* Analyze Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>Analyze Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter prompt ID to analyze"
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={!promptId.trim() || analyzing}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {analyzing ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {!analyzing && promptId && (
          <>
            {/* Overall Score */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-bold text-primary">78</div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      Your prompt has room for improvement
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: '78%' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Performance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline">Medium Priority</Badge>
                  <p className="text-sm text-muted-foreground">
                    Your prompt's latency is 15% slower than similar prompts.
                    Consider reducing complexity or breaking into smaller steps.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">
                    Apply Optimization
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Token Efficiency</CardTitle>
                  <Zap className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="success">High Priority</Badge>
                  <p className="text-sm text-muted-foreground">
                    Reduce token usage by 23% by removing redundant instructions
                    and using more concise language.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">
                    Apply Optimization
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Cost Savings</CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline">Low Priority</Badge>
                  <p className="text-sm text-muted-foreground">
                    Potential savings of $42/month by optimizing token usage
                    and switching to a more efficient model variant.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">
                    View Details
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Success Rate</CardTitle>
                  <Sparkles className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="warning">High Priority</Badge>
                  <p className="text-sm text-muted-foreground">
                    Success rate is 8% below average. Add more specific
                    constraints and examples to improve output quality.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">
                    Apply Optimization
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Auto-Optimize */}
            <Card>
              <CardHeader>
                <CardTitle>Auto-Optimize</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Automatically apply all high-priority optimizations and
                    create a new optimized version of your prompt.
                  </p>
                  <div className="flex gap-2">
                    <Button>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create Optimized Version
                    </Button>
                    <Button variant="outline">Preview Changes</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
