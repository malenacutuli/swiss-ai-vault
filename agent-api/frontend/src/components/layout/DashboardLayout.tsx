import { Link, useLocation } from 'wouter'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Copy,
  FlaskConical,
  BarChart3,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Versions',
    href: '/versions',
    icon: FileText,
  },
  {
    title: 'Templates',
    href: '/templates',
    icon: Copy,
  },
  {
    title: 'A/B Tests',
    href: '/ab-tests',
    icon: FlaskConical,
  },
  {
    title: 'Metrics',
    href: '/metrics',
    icon: BarChart3,
  },
  {
    title: 'Optimizer',
    href: '/optimizer',
    icon: Sparkles,
  },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b p-6">
            <h1 className="text-xl font-bold">Prompt Manager</h1>
            <p className="text-sm text-muted-foreground">Swiss AI Vault</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </a>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground">
              Phase 5 - Prompt Management
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}
