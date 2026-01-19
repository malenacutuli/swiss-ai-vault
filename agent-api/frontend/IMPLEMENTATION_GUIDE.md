# Prompt Management UI - Complete Implementation Guide

This guide provides step-by-step instructions for building each component and page of the Prompt Management System frontend, following SwissBrain design patterns.

## Phase 1: Core UI Components

### Step 1.1: Create Button Component

**File**: `src/components/ui/button.tsx`

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

**Usage**:
```typescript
<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button size="sm">Small</Button>
<Button variant="destructive" size="lg">Large Destructive</Button>
```

### Step 1.2: Create Card Component

**File**: `src/components/ui/card.tsx`

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
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
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**Usage**:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Prompt Versions</CardTitle>
    <CardDescription>Manage your prompt versions</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content here */}
  </CardContent>
  <CardFooter>
    <Button>Create Version</Button>
  </CardFooter>
</Card>
```

### Step 1.3: Create Badge Component

**File**: `src/components/ui/badge.tsx`

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

**Usage**:
```typescript
<Badge>Active</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Deprecated</Badge>
<Badge variant="outline">Archived</Badge>
```

### Step 1.4: Create Input Component

**File**: `src/components/ui/input.tsx`

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

### Step 1.5: Create Table Component

**File**: `src/components/ui/table.tsx`

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
```

## Phase 2: Layout Components

### Step 2.1: Create Dashboard Layout

**File**: `src/components/layout/DashboardLayout.tsx`

```typescript
import { Link } from 'wouter'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  GitBranch,
  FileText,
  FlaskConical,
  BarChart3,
  Sparkles,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Versions', href: '/versions', icon: GitBranch },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'A/B Tests', href: '/ab-tests', icon: FlaskConical },
  { name: 'Metrics', href: '/metrics', icon: BarChart3 },
  { name: 'Optimizer', href: '/optimizer', icon: Sparkles },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card">
        <div className="flex h-full flex-col gap-y-5 px-6 py-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold">Prompt Manager</h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link href={item.href}>
                    <a className={cn(
                      "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-accent hover:text-accent-foreground transition-colors",
                      window.location.pathname === item.href && "bg-accent text-accent-foreground"
                    )}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
```

## Phase 3: Pages

### Step 3.1: Dashboard Page

**File**: `src/pages/Dashboard.tsx`

```typescript
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatNumber, formatPercentage } from '@/lib/utils'
import { Activity, TrendingUp, GitBranch, FlaskConical } from 'lucide-react'

interface DashboardStats {
  totalExecutions: number
  avgSuccessRate: number
  activeVersions: number
  runningTests: number
}

function StatsCard({ title, value, icon: Icon }: {
  title: string
  value: string
  icon: any
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production, these would be actual API calls
    // For now, using mock data
    setTimeout(() => {
      setStats({
        totalExecutions: 45231,
        avgSuccessRate: 0.892,
        activeVersions: 12,
        runningTests: 3,
      })
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div>Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your prompt management system
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Executions"
            value={formatNumber(stats!.totalExecutions)}
            icon={Activity}
          />
          <StatsCard
            title="Success Rate"
            value={formatPercentage(stats!.avgSuccessRate)}
            icon={TrendingUp}
          />
          <StatsCard
            title="Active Versions"
            value={stats!.activeVersions.toString()}
            icon={GitBranch}
          />
          <StatsCard
            title="Running Tests"
            value={stats!.runningTests.toString()}
            icon={FlaskConical}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Chart would go here (integrate Recharts)
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Top Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Top performing prompts list would go here
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
```

### Step 3.2: Versions Page

**File**: `src/pages/Versions.tsx`

```typescript
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function Versions() {
  const [promptId, setPromptId] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchVersions = async () => {
    if (!promptId) {
      toast.error('Please enter a prompt ID')
      return
    }

    setLoading(true)
    try {
      const response = await api.listVersions(promptId)
      setVersions(response.versions || [])
      toast.success(`Loaded ${response.versions.length} versions`)
    } catch (error: any) {
      toast.error(error.message)
      setVersions([])
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (version: number) => {
    try {
      await api.activateVersion(promptId, version)
      await fetchVersions()
      toast.success(`Version ${version} activated`)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const getStatusVariant = (status: string): any => {
    switch (status) {
      case 'active': return 'default'
      case 'draft': return 'secondary'
      case 'deprecated': return 'destructive'
      case 'archived': return 'outline'
      default: return 'secondary'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Version Management</h1>
            <p className="text-muted-foreground">
              Create, activate, and manage prompt versions
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Version
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter prompt ID..."
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVersions()}
              />
              <Button onClick={fetchVersions} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Loading...' : 'Load Versions'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Versions for "{promptId}"</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-medium">v{v.version}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(v.status)}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(v.created_at)}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {v.content}
                      </TableCell>
                      <TableCell className="text-right">
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
```

## Phase 4: Custom Hooks

### Step 4.1: Create useVersions Hook

**File**: `src/hooks/use-versions.ts`

```typescript
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export function useVersions(promptId: string) {
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!promptId) {
      setVersions([])
      setLoading(false)
      return
    }

    setLoading(true)
    api.listVersions(promptId)
      .then(response => {
        setVersions(response.versions || [])
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setVersions([])
      })
      .finally(() => setLoading(false))
  }, [promptId])

  const refetch = async () => {
    if (!promptId) return

    const response = await api.listVersions(promptId)
    setVersions(response.versions || [])
  }

  const activateVersion = async (version: number) => {
    await api.activateVersion(promptId, version)
    await refetch()
  }

  return { versions, loading, error, refetch, activateVersion }
}
```

## Phase 5: Integration

### Step 5.1: Environment Setup

Create `.env`:
```
VITE_API_BASE_URL=http://localhost:8000
```

### Step 5.2: Install Dependencies

```bash
cd frontend
npm install
```

### Step 5.3: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Next Steps

1. **Complete remaining components**: Dialog, Select, Tabs
2. **Build all pages**: Templates, ABTests, Metrics, Optimizer
3. **Add data visualization**: Integrate Recharts for metrics
4. **Implement forms**: Use react-hook-form + zod for validation
5. **Add authentication**: Login page and token management
6. **Responsive design**: Test and optimize for mobile
7. **Dark mode toggle**: Add theme switcher in header
8. **Deploy to production**: Build and integrate with FastAPI

## Production Checklist

- [ ] All components implemented
- [ ] All pages functional
- [ ] API error handling
- [ ] Loading states
- [ ] Empty states
- [ ] Form validation
- [ ] Authentication flow
- [ ] Responsive design
- [ ] Dark mode tested
- [ ] Performance optimized
- [ ] Accessibility audit
- [ ] Production build tested
