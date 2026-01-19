# SwissBrain Design Patterns - Complete Guide for Swiss AI Vault

**Purpose**: Production-grade UI patterns, components, and configuration for building enterprise React applications.

**Based On**: Manus Core Platform (manus.im)
**Adapted For**: Swiss AI Vault Agent API & Platform
**Last Updated**: 2026-01-15

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Setup](#project-setup)
3. [Configuration Files](#configuration-files)
4. [UI Component Library (45+ Components)](#ui-component-library)
5. [Styling System](#styling-system)
6. [Animation Patterns](#animation-patterns)
7. [Layout Components](#layout-components)
8. [Page Templates](#page-templates)
9. [Custom Hooks](#custom-hooks)
10. [Best Practices](#best-practices)
11. [Deployment](#deployment)

---

## Technology Stack

### Core Dependencies

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "~5.6.2",
  "vite": "^6.0.1",
  "tailwindcss": "^4.1.14"
}
```

### UI & Styling

```json
{
  "@radix-ui/react-*": "latest",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "lucide-react": "^0.364.0",
  "tailwindcss-animate": "^1.0.7"
}
```

### Additional Features

```json
{
  "framer-motion": "^12.15.0",
  "recharts": "^2.12.4",
  "react-hook-form": "^7.54.2",
  "zod": "^3.24.1",
  "wouter": "^3.3.5",
  "date-fns": "^4.1.0",
  "sonner": "^1.7.2"
}
```

---

## Project Setup

### Standard Project Structure

```
project/
├── src/
│   ├── components/
│   │   ├── ui/              # 45+ shadcn components
│   │   └── layout/          # Layout components
│   ├── pages/               # Page components
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── utils.ts         # cn() utility
│   │   └── api.ts           # API client
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── components.json          # shadcn/ui config
```

---

## Configuration Files

### 1. vite.config.ts

```typescript
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3. tailwind.config.js

```javascript
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(60px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.7s ease-out forwards",
        "slide-up": "slide-up 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "float": "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 4. postcss.config.js

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 5. components.json (shadcn/ui)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

---

## UI Component Library

### Core Utility: cn()

**File**: `src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage**:
```typescript
className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes"
)}
```

### Complete Component List (45 Components)

1. **accordion.tsx** - Expandable content sections
2. **alert-dialog.tsx** - Modal confirmation dialogs
3. **alert.tsx** - Inline notifications
4. **aspect-ratio.tsx** - Aspect ratio containers
5. **avatar.tsx** - User profile images
6. **badge.tsx** - Status indicators
7. **breadcrumb.tsx** - Navigation breadcrumbs
8. **button.tsx** - Clickable buttons with variants
9. **calendar.tsx** - Date picker calendar
10. **card.tsx** - Content containers
11. **carousel.tsx** - Image/content sliders
12. **chart.tsx** - Data visualization
13. **checkbox.tsx** - Checkbox inputs
14. **collapsible.tsx** - Collapsible content
15. **command.tsx** - Command palette
16. **context-menu.tsx** - Right-click menus
17. **dialog.tsx** - Modal dialogs
18. **drawer.tsx** - Slide-out panels
19. **dropdown-menu.tsx** - Dropdown menus
20. **form.tsx** - Form components
21. **hover-card.tsx** - Hover popover cards
22. **input-otp.tsx** - OTP input fields
23. **input.tsx** - Text inputs
24. **label.tsx** - Form labels
25. **menubar.tsx** - Menu bars
26. **navigation-menu.tsx** - Navigation menus
27. **pagination.tsx** - Pagination controls
28. **popover.tsx** - Popover overlays
29. **progress.tsx** - Progress indicators
30. **radio-group.tsx** - Radio button groups
31. **resizable.tsx** - Resizable panels
32. **scroll-area.tsx** - Custom scrollbars
33. **select.tsx** - Select dropdowns
34. **separator.tsx** - Visual separators
35. **sheet.tsx** - Side sheets
36. **sidebar.tsx** - Sidebar navigation
37. **skeleton.tsx** - Loading skeletons
38. **slider.tsx** - Range sliders
39. **sonner.tsx** - Toast notifications (Sonner)
40. **switch.tsx** - Toggle switches
41. **table.tsx** - Data tables
42. **tabs.tsx** - Tabbed interfaces
43. **textarea.tsx** - Multi-line text inputs
44. **toast.tsx** - Toast notifications
45. **toaster.tsx** - Toast container
46. **toggle-group.tsx** - Toggle button groups
47. **toggle.tsx** - Toggle buttons
48. **tooltip.tsx** - Tooltips

### Essential Components Implementation

#### 1. Button Component

**Pattern**: CVA (Class Variance Authority) for variants

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
<Button variant="destructive" size="sm">Small Destructive</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

#### 2. Card Component

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
    <CardTitle>Analytics Dashboard</CardTitle>
    <CardDescription>View your metrics</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

#### 3. Badge Component

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
<Badge variant="destructive">Failed</Badge>
<Badge variant="outline">Archived</Badge>
```

#### 4. Input Component

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

#### 5. Table Component

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
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground",
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
    className={cn("p-2 align-middle", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
```

---

## Styling System

### CSS Variables (index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.5rem;

    /* Light mode colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    /* Chart colors */
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    /* Dark mode colors */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;

    /* Chart colors (dark) */
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

### Color Usage Patterns

```typescript
// Using semantic colors that adapt to light/dark mode
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <h2 className="text-primary">Primary Text</h2>
    <p className="text-muted-foreground">Muted description</p>
    <Button className="bg-secondary text-secondary-foreground">
      Secondary Action
    </Button>
  </Card>
</div>
```

---

## Animation Patterns

### Custom CSS Animations

```css
/* Float animation */
.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

/* Pulse glow effect */
.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(var(--primary), 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(var(--primary), 0.6);
  }
}

/* Slide up with fade */
.animate-slide-up {
  animation: slide-up 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(60px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade in */
.animate-fade-in {
  animation: fade-in 0.7s ease-out forwards;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Staggered fade in (use with style delay) */
.animate-stagger {
  opacity: 0;
  animation: fade-in 0.5s ease-out forwards;
}
```

### Framer Motion Patterns

```typescript
import { motion } from "framer-motion"

// 1. Fade in on scroll
export const FadeInSection = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}

// 2. Staggered children
export const StaggerContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.1 }
        }
      }}
    >
      {children}
    </motion.div>
  )
}

export const StaggerItem = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {children}
    </motion.div>
  )
}

// 3. Scale on hover
export const ScaleOnHover = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {children}
    </motion.div>
  )
}
```

### Intersection Observer for Scroll Animations

```typescript
import { useEffect, useRef } from 'react'

export const useScrollAnimation = (threshold = 0.1) => {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [threshold])

  return elementRef
}

// Usage
const FeatureCard = ({ title, description, index }: Props) => {
  const cardRef = useScrollAnimation()

  return (
    <div
      ref={cardRef}
      className="opacity-0 p-6 rounded-xl border"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
```

---

## Layout Components

### Dashboard Layout with Sidebar

```typescript
import { Link } from 'wouter'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  GitBranch,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Versions', href: '/versions', icon: GitBranch },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card">
        <div className="flex h-full flex-col gap-y-5 px-6 py-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold">Swiss AI Vault</h1>
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

### Stats Card Component

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  const isPositive = trend && trend.value > 0

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-xs",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Page Templates

### Dashboard Page

```typescript
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, TrendingUp, Users, DollarSign } from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  revenue: number
  activeUsers: number
  growthRate: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch stats from API
    fetchStats().then(data => {
      setStats(data)
      setLoading(false)
    })
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Users"
            value={stats!.totalUsers}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            trend={{ value: 12, label: "from last month" }}
          />
          <StatsCard
            title="Revenue"
            value={`$${stats!.revenue.toLocaleString()}`}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            trend={{ value: 8, label: "from last month" }}
          />
          <StatsCard
            title="Active Users"
            value={stats!.activeUsers}
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            trend={{ value: 5, label: "from last week" }}
          />
          <StatsCard
            title="Growth Rate"
            value={`${stats!.growthRate}%`}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Chart component would go here */}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Activity list would go here */}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
```

---

## Custom Hooks

### useToast Hook

```typescript
import { toast as sonnerToast } from 'sonner'

export const useToast = () => {
  return {
    toast: (options: {
      title?: string
      description?: string
      variant?: 'default' | 'destructive'
    }) => {
      if (options.variant === 'destructive') {
        sonnerToast.error(options.title, {
          description: options.description
        })
      } else {
        sonnerToast.success(options.title, {
          description: options.description
        })
      }
    },
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast.info(message),
  }
}
```

### useFetch Hook

```typescript
import { useState, useEffect } from 'react'

export function useFetch<T>(url: string, initialData: T) {
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (mounted) {
          setData(json)
          setLoading(false)
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err)
          setLoading(false)
        }
      })

    return () => { mounted = false }
  }, [url])

  return { data, loading, error }
}
```

---

## Best Practices

### 1. Component Design Patterns

#### Use CVA for Variants
```typescript
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { default: "...", sm: "...", lg: "..." }
  },
  defaultVariants: { variant: "default", size: "default" }
})
```

#### Forward Refs for Extensibility
```typescript
const Component = React.forwardRef<HTMLDivElement, Props>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("base-classes", className)} {...props} />
  )
)
```

#### Compose with Radix Primitives
```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogContent = DialogPrimitive.Content
```

### 2. Performance Optimizations

#### useMemo for Expensive Computations
```typescript
const filteredData = useMemo(
  () => data.filter(item => item.name.includes(searchTerm)),
  [data, searchTerm]
)
```

#### Lazy Loading
```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'))

// In component
<Suspense fallback={<div>Loading...</div>}>
  <HeavyComponent />
</Suspense>
```

### 3. Accessibility Guidelines

#### Semantic HTML
```typescript
<section id="about">
  <h2>About Us</h2>
  <p>...</p>
</section>
```

#### ARIA Labels
```typescript
<button aria-label="Close menu">
  <X className="h-4 w-4" />
</button>
```

#### Keyboard Navigation
```typescript
<TabsPrimitive.Trigger
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      // Handle activation
    }
  }}
/>
```

### 4. Common Patterns

#### Conditional Classes
```typescript
className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes"
)}
```

#### Responsive Design
```typescript
className="flex flex-col md:flex-row lg:grid lg:grid-cols-3"
```

#### Dark Mode
```typescript
className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50"
```

#### Animation Delays
```typescript
style={{ animationDelay: `${index * 0.1}s` }}
```

---

## Deployment

### Build for Production

```bash
# Install dependencies
npm install

# Build
npm run build
# Output: dist/

# Preview build
npm run preview
```

### Environment Variables

```bash
# .env
VITE_API_BASE_URL=https://api.swissbrain.ai
VITE_APP_NAME=Swiss AI Vault
```

### Docker Integration

```dockerfile
# Multi-stage build
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
# ... backend setup ...
COPY --from=frontend /app/frontend/dist /app/frontend/dist
```

### Serve from FastAPI

```python
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

---

## Quick Reference

### Import Paths

```typescript
// Components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

// Utilities
import { cn } from "@/lib/utils"

// Hooks
import { useToast } from "@/hooks/use-toast"

// Icons
import { Plus, X, Check, ChevronDown } from "lucide-react"
```

### Component Usage Examples

```typescript
// Button
<Button>Click me</Button>
<Button variant="outline" size="sm">Small</Button>

// Card
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Badge
<Badge>Active</Badge>
<Badge variant="secondary">Draft</Badge>

// Input
<Input placeholder="Enter text..." />

// Table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John</TableCell>
      <TableCell><Badge>Active</Badge></TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## Summary

This guide consolidates **SwissBrain design patterns** for building production-grade React applications:

✅ **Technology Stack** - React 18.3, TypeScript, Vite, Tailwind CSS
✅ **Configuration** - Complete setup files
✅ **45+ UI Components** - shadcn/ui with CVA patterns
✅ **Styling System** - CSS variables for theming
✅ **Animation Patterns** - CSS animations & Framer Motion
✅ **Layout Components** - Dashboard, sidebar, stats cards
✅ **Page Templates** - Dashboard, data tables, forms
✅ **Custom Hooks** - useToast, useFetch, useScrollAnimation
✅ **Best Practices** - Performance, accessibility, patterns
✅ **Deployment** - Build, Docker, FastAPI integration

**Usage**: Apply these patterns to build enterprise-grade frontends for Swiss AI Vault agents and services.
