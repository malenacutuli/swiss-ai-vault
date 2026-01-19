# Prompt Management UI - React Frontend

Production-grade React frontend for the Phase 5 Prompt Management System, built following SwissBrain design patterns.

## Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── select.tsx
│   │   │   └── toast.tsx
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── charts/
│   │       ├── MetricsChart.tsx
│   │       └── PerformanceChart.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview with stats
│   │   ├── Versions.tsx           # Version management
│   │   ├── Templates.tsx          # Template CRUD
│   │   ├── ABTests.tsx            # A/B testing dashboard
│   │   ├── Metrics.tsx            # Metrics visualization
│   │   └── Optimizer.tsx          # Optimization recommendations
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── use-versions.ts
│   │   ├── use-metrics.ts
│   │   └── use-templates.ts
│   ├── lib/
│   │   ├── utils.ts               # cn() utility
│   │   └── api.ts                 # API client
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Technology Stack

- **React 18.3** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling with CSS variables
- **Radix UI** - Accessible primitives
- **Wouter** - Lightweight routing
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Sonner** - Toast notifications

## Features

### 1. Version Management
- List all prompt versions
- Create new versions
- Activate/deactivate versions
- Rollback capability
- Version comparison
- Status badges (draft, active, archived, deprecated)

### 2. Template Management
- Create/edit/delete templates
- Variable extraction UI
- Template validation
- Live preview with test values
- Template library browsing

### 3. A/B Testing Dashboard
- Create tests with traffic split slider
- Running tests table
- Variant performance comparison
- Winner determination
- Test lifecycle management
- Real-time metrics updates

### 4. Metrics Visualization
- Success rate charts (Recharts line/bar charts)
- Latency distribution
- Quality score trends
- Time-series data with granularity toggle (hourly/daily)
- Version comparison tool
- Top performing prompts leaderboard

### 5. Optimizer Dashboard
- Performance analysis cards
- Automated recommendations
- Confidence indicators
- One-click optimization
- Before/after comparisons

## Component Patterns

### Button Component (SwissBrain Pattern)
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
```

### Card Component
```typescript
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow",
        className
      )}
      {...props}
    />
  )
)

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)

const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  )
)

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
```

## Page Examples

### Dashboard Page
```typescript
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch dashboard stats
    Promise.all([
      api.getMetrics('all'),
      api.listVersions('all'),
      api.listABTests('running'),
      api.getTopPrompts(5)
    ]).then(([metrics, versions, tests, topPrompts]) => {
      setStats({
        totalExecutions: metrics.total_count,
        avgSuccessRate: metrics.avg_success_rate,
        activeVersions: versions.filter(v => v.status === 'active').length,
        runningTests: tests.length,
        topPrompts
      })
      setLoading(false)
    })
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Executions"
          value={formatNumber(stats.totalExecutions)}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatsCard
          title="Success Rate"
          value={formatPercentage(stats.avgSuccessRate)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatsCard
          title="Active Versions"
          value={stats.activeVersions.toString()}
          icon={<GitBranch className="h-4 w-4" />}
        />
        <StatsCard
          title="Running Tests"
          value={stats.runningTests.toString()}
          icon={<FlaskConical className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsChart data={stats.metricsHistory} />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <TopPromptsTable prompts={stats.topPrompts} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
```

### Versions Page
```typescript
export function Versions() {
  const [promptId, setPromptId] = useState('')
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const fetchVersions = async () => {
    setLoading(true)
    const response = await api.listVersions(promptId)
    setVersions(response.versions)
    setLoading(false)
  }

  const handleActivate = async (version: number) => {
    await api.activateVersion(promptId, version)
    await fetchVersions()
    toast.success(`Version ${version} activated`)
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Version Management</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Version
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter prompt ID..."
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
            />
            <Button onClick={fetchVersions}>Load Versions</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.version}>
                <TableCell className="font-medium">v{v.version}</TableCell>
                <TableCell>
                  <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(v.created_at)}</TableCell>
                <TableCell>
                  {v.status !== 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleActivate(v.version)}
                    >
                      Activate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateVersionDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        promptId={promptId}
        onSuccess={fetchVersions}
      />
    </DashboardLayout>
  )
}
```

### A/B Testing Page
```typescript
export function ABTests() {
  const [tests, setTests] = useState([])
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  const fetchTests = async () => {
    const response = await api.listABTests()
    setTests(response.tests)
  }

  useEffect(() => {
    fetchTests()
  }, [])

  const handleComplete = async (testId: string) => {
    const response = await api.completeABTest(testId)
    toast.success(`Test completed. Winner: Variant ${response.winner}`)
    await fetchTests()
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">A/B Testing</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <FlaskConical className="h-4 w-4 mr-2" />
          Create Test
        </Button>
      </div>

      <Tabs defaultValue="running">
        <TabsList>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="running">
          <div className="grid gap-4">
            {tests.filter(t => t.status === 'running').map((test) => (
              <Card key={test.test_id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{test.test_id}</CardTitle>
                    <Badge>{test.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Variant A */}
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Variant A</h4>
                      <div className="space-y-1 text-sm">
                        <div>Samples: {test.metrics_a.count}</div>
                        <div>Success Rate: {formatPercentage(test.metrics_a.success_rate)}</div>
                        <div>Avg Latency: {test.metrics_a.avg_latency}ms</div>
                      </div>
                    </div>

                    {/* Variant B */}
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Variant B</h4>
                      <div className="space-y-1 text-sm">
                        <div>Samples: {test.metrics_b.count}</div>
                        <div>Success Rate: {formatPercentage(test.metrics_b.success_rate)}</div>
                        <div>Avg Latency: {test.metrics_b.avg_latency}ms</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => handleComplete(test.test_id)}>
                      Complete Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
```

## Styling Patterns

### Using CSS Variables
```typescript
// Colors automatically adapt to light/dark mode
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <h2 className="text-primary">Primary Text</h2>
    <p className="text-muted-foreground">Muted description</p>
  </Card>
</div>
```

### Responsive Design
```typescript
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Cards automatically adjust to screen size */}
</div>
```

### Animations
```typescript
<div className="animate-fade-in">
  {/* Fades in on mount */}
</div>

<div className="transition-colors hover:bg-accent">
  {/* Smooth color transition on hover */}
</div>
```

## Custom Hooks

### useVersions Hook
```typescript
export function useVersions(promptId: string) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!promptId) return

    setLoading(true)
    api.listVersions(promptId)
      .then(response => {
        setVersions(response.versions)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [promptId])

  const activateVersion = async (version: number) => {
    await api.activateVersion(promptId, version)
    // Refetch versions
    const response = await api.listVersions(promptId)
    setVersions(response.versions)
  }

  return { versions, loading, error, activateVersion }
}
```

### useMetrics Hook
```typescript
export function useMetrics(promptId: string, version?: number, days: number = 30) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!promptId) return

    api.getMetrics(promptId, version, days)
      .then(response => {
        setMetrics(response.metrics)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [promptId, version, days])

  return { metrics, loading }
}
```

## Development

### Setup
```bash
cd frontend
npm install
```

### Run Development Server
```bash
npm run dev
# Opens at http://localhost:3000
# API proxy configured to http://localhost:8000
```

### Build for Production
```bash
npm run build
# Outputs to dist/
```

### Preview Production Build
```bash
npm run preview
```

## Deployment

### Integration with Backend
The frontend is designed to be served by the FastAPI backend:

```python
# Add to app/main.py
from fastapi.staticfiles import StaticFiles

# Serve frontend static files
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

### Environment Variables
Create `.env` for configuration:
```
VITE_API_BASE_URL=https://api.swissbrain.ai
```

### Docker Build
```dockerfile
# Multi-stage build
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
# ... backend setup ...
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
```

## Best Practices

1. **Type Safety**: Use TypeScript interfaces for all API responses
2. **Error Handling**: Toast notifications for all errors
3. **Loading States**: Show skeleton loaders during data fetching
4. **Optimistic Updates**: Update UI immediately, revert on error
5. **Accessibility**: All interactive elements have proper ARIA labels
6. **Responsive**: Mobile-first approach, works on all screen sizes
7. **Dark Mode**: Automatic dark mode support via CSS variables
8. **Performance**: Lazy load heavy components, memoize expensive operations

## Future Enhancements

- [ ] WebSocket integration for real-time metrics updates
- [ ] Advanced filtering and search
- [ ] Bulk operations (activate multiple versions, etc.)
- [ ] Export data (CSV, JSON)
- [ ] Custom dashboard layouts
- [ ] Prompt diff viewer
- [ ] Collaborative features (comments, sharing)
- [ ] Mobile app (React Native)
