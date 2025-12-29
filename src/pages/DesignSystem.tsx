import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertCircle, 
  ArrowLeft, 
  Check, 
  Copy, 
  Info, 
  Palette, 
  Type, 
  Layout, 
  MousePointer, 
  FormInput,
  Layers,
  Sparkles,
  Flag,
  Moon,
  Circle,
} from "@/icons";
import { SwissIconTile } from "@/components/ui/swiss";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const ColorSwatch = ({ name, variable, className }: { name: string; variable: string; className: string }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(variable);
    toast.success(`Copied ${variable}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div 
        className={`h-16 w-full rounded-lg border cursor-pointer transition-transform hover:scale-105 ${className}`}
        onClick={copyToClipboard}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{variable}</p>
      </div>
    </div>
  );
};

const CodeBlock = ({ code, language = "tsx" }: { code: string; language?: string }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copyToClipboard}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
};

const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
    </div>
    {children}
  </section>
);

const DesignSystem = () => {
  const [sliderValue, setSliderValue] = useState([50]);
  const [progressValue] = useState(65);

  const navItems = [
    { id: "colors", label: "Colors", icon: Palette },
    { id: "typography", label: "Typography", icon: Type },
    { id: "buttons", label: "Buttons", icon: MousePointer },
    { id: "cards", label: "Cards", icon: Layout },
    { id: "forms", label: "Form Elements", icon: FormInput },
    { id: "feedback", label: "Feedback", icon: AlertCircle },
    { id: "data-display", label: "Data Display", icon: Layers },
    { id: "effects", label: "Effects & Animations", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">SwissVault Design System</h1>
              <p className="text-xs text-muted-foreground">Component Library & Guidelines</p>
            </div>
          </div>
          <Badge variant="secondary">v1.0</Badge>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-56 shrink-0">
            <nav className="sticky top-24 space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-16">
            {/* Introduction */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold">Design System</h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                SwissVault's design system is built on principles of Swiss minimalism, precision, and clarity. 
                This documentation showcases all available components with usage examples.
              </p>
              <div className="flex gap-2">
                <Badge>Dark-First</Badge>
                <Badge variant="secondary">Swiss Inspired</Badge>
                <Badge variant="outline">Shadcn/ui</Badge>
              </div>
            </div>

            {/* Colors */}
            <Section id="colors" title="Color Palette" icon={Palette}>
              <div className="space-y-8">
                {/* Primary Colors */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Primary Colors</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    <ColorSwatch name="Background" variable="bg-background" className="bg-background" />
                    <ColorSwatch name="Foreground" variable="text-foreground" className="bg-foreground" />
                    <ColorSwatch name="Primary" variable="bg-primary" className="bg-primary" />
                    <ColorSwatch name="Secondary" variable="bg-secondary" className="bg-secondary" />
                    <ColorSwatch name="Muted" variable="bg-muted" className="bg-muted" />
                    <ColorSwatch name="Accent" variable="bg-accent" className="bg-accent" />
                  </div>
                </div>

                {/* Semantic Colors */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Semantic Colors</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <ColorSwatch name="Destructive" variable="bg-destructive" className="bg-destructive" />
                    <ColorSwatch name="Success" variable="bg-green-500" className="bg-green-500" />
                    <ColorSwatch name="Warning" variable="bg-yellow-500" className="bg-yellow-500" />
                    <ColorSwatch name="Info" variable="bg-blue-500" className="bg-blue-500" />
                  </div>
                </div>

                {/* UI Colors */}
                <div>
                  <h3 className="text-lg font-medium mb-4">UI Colors</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    <ColorSwatch name="Card" variable="bg-card" className="bg-card" />
                    <ColorSwatch name="Popover" variable="bg-popover" className="bg-popover" />
                    <ColorSwatch name="Border" variable="border-border" className="bg-border" />
                    <ColorSwatch name="Input" variable="border-input" className="bg-input" />
                    <ColorSwatch name="Ring" variable="ring-ring" className="bg-ring" />
                    <ColorSwatch name="Chart 1" variable="bg-chart-1" className="bg-[hsl(var(--chart-1))]" />
                  </div>
                </div>

                <CodeBlock code={`// Using colors in components
<div className="bg-background text-foreground">
  <Button className="bg-primary text-primary-foreground">
    Primary Button
  </Button>
</div>`} />
              </div>
            </Section>

            {/* Typography */}
            <Section id="typography" title="Typography" icon={Type}>
              <div className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Display / Hero</p>
                    <p className="text-5xl font-bold tracking-tight">The quick brown fox</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">H1 / Page Title</p>
                    <h1 className="text-4xl font-bold">The quick brown fox</h1>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">H2 / Section Title</p>
                    <h2 className="text-3xl font-semibold">The quick brown fox</h2>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">H3 / Subsection</p>
                    <h3 className="text-2xl font-semibold">The quick brown fox</h3>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">H4 / Card Title</p>
                    <h4 className="text-xl font-medium">The quick brown fox</h4>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Body / Paragraph</p>
                    <p className="text-base">The quick brown fox jumps over the lazy dog. This is body text used for main content.</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Small / Caption</p>
                    <p className="text-sm text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Monospace / Code</p>
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">const swissVault = "precision";</code>
                  </div>
                </div>

                <CodeBlock code={`// Typography classes
<h1 className="text-4xl font-bold">Page Title</h1>
<h2 className="text-3xl font-semibold">Section Title</h2>
<p className="text-base">Body text</p>
<p className="text-sm text-muted-foreground">Caption</p>
<code className="font-mono text-sm">Code snippet</code>`} />
              </div>
            </Section>

            {/* Buttons */}
            <Section id="buttons" title="Buttons" icon={MousePointer}>
              <div className="space-y-8">
                {/* Variants */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Variants</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="hero">Hero</Button>
                    <Button variant="swiss">Swiss</Button>
                    <Button variant="glass">Glass</Button>
                  </div>
                </div>

                {/* Sizes */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Sizes</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button size="sm">Small</Button>
                    <Button size="default">Default</Button>
                    <Button size="lg">Large</Button>
                    <Button size="xl">Extra Large</Button>
                    <Button size="icon"><Check className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* States */}
                <div>
                  <h3 className="text-lg font-medium mb-4">States</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button>Normal</Button>
                    <Button disabled>Disabled</Button>
                    <Button className="pointer-events-none opacity-50">Loading...</Button>
                  </div>
                </div>

                {/* With Icons */}
                <div>
                  <h3 className="text-lg font-medium mb-4">With Icons</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button><Check className="mr-2 h-4 w-4" /> With Icon</Button>
                    <Button variant="outline">Icon Right <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button>
                  </div>
                </div>

                <CodeBlock code={`// Button usage
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="hero">Hero CTA</Button>
<Button variant="swiss">Swiss Accent</Button>
<Button size="lg">Large Button</Button>
<Button disabled>Disabled</Button>
<Button><Icon className="mr-2 h-4 w-4" /> With Icon</Button>`} />
              </div>
            </Section>

            {/* Cards */}
            <Section id="cards" title="Cards" icon={Layout}>
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Basic Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Basic Card</CardTitle>
                      <CardDescription>A simple card with header and content.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        This is the card content area. Use it for any type of information.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Card with Footer */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Card with Footer</CardTitle>
                      <CardDescription>Includes action buttons in footer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Cards can have footers for actions.
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="ghost">Cancel</Button>
                      <Button>Save</Button>
                    </CardFooter>
                  </Card>

                  {/* Glass Card */}
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle>Glass Card</CardTitle>
                      <CardDescription>Glassmorphism effect.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Semi-transparent with blur for layered UIs.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Interactive Card */}
                  <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                    <CardHeader>
                      <CardTitle>Interactive Card</CardTitle>
                      <CardDescription>Hover for effect.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Cards can be interactive with hover states.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Gradient Border Card */}
                  <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
                    <CardHeader>
                      <CardTitle>Gradient Card</CardTitle>
                      <CardDescription>Subtle gradient background.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Use gradients for premium features.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Stat Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Users</CardDescription>
                      <CardTitle className="text-3xl">12,345</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-green-500">+12% from last month</p>
                    </CardContent>
                  </Card>
                </div>

                <CodeBlock code={`// Card usage
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>

// Glass effect
<Card className="bg-card/50 backdrop-blur-sm border-border/50">

// Interactive
<Card className="cursor-pointer hover:shadow-lg hover:border-primary/50">`} />
              </div>
            </Section>

            {/* Form Elements */}
            <Section id="forms" title="Form Elements" icon={FormInput}>
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Input */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Text Input</h3>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="name@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disabled">Disabled</Label>
                      <Input id="disabled" disabled placeholder="Disabled input" />
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Textarea</h3>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" placeholder="Type your message here..." />
                    </div>
                  </div>

                  {/* Select */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Select</h3>
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="claude">Claude 3.5</SelectItem>
                          <SelectItem value="gemini">Gemini Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Checkbox & Switch */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Checkbox & Switch</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="terms" />
                      <Label htmlFor="terms">Accept terms and conditions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="notifications" />
                      <Label htmlFor="notifications">Enable notifications</Label>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Slider</h3>
                    <div className="space-y-2">
                      <Label>Temperature: {sliderValue[0]}%</Label>
                      <Slider
                        value={sliderValue}
                        onValueChange={setSliderValue}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Progress</h3>
                    <div className="space-y-2">
                      <Label>Training Progress: {progressValue}%</Label>
                      <Progress value={progressValue} />
                    </div>
                  </div>
                </div>

                <CodeBlock code={`// Form elements
<Input placeholder="Enter text..." />
<Textarea placeholder="Long text..." />

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="opt1">Option 1</SelectItem>
  </SelectContent>
</Select>

<Checkbox id="check" />
<Switch id="switch" />
<Slider value={[50]} max={100} />
<Progress value={65} />`} />
              </div>
            </Section>

            {/* Feedback */}
            <Section id="feedback" title="Feedback & Alerts" icon={AlertCircle}>
              <div className="space-y-8">
                {/* Badges */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Badges</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                </div>

                {/* Status Badges */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Status Badges</h3>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="pending" />
                    <StatusBadge status="processing" />
                    <StatusBadge status="ready" />
                    <StatusBadge status="completed" />
                    <StatusBadge status="training" />
                    <StatusBadge status="running" />
                    <StatusBadge status="failed" />
                    <StatusBadge status="error" />
                    <StatusBadge status="queued" />
                    <StatusBadge status="cancelled" />
                  </div>
                </div>

                {/* Alerts */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-4">Alerts</h3>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Default Alert</AlertTitle>
                    <AlertDescription>
                      This is a default alert for general information.
                    </AlertDescription>
                  </Alert>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Alert</AlertTitle>
                    <AlertDescription>
                      Something went wrong. Please try again.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Toasts */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Toast Notifications</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => toast.success("Success message!")}>
                      Success Toast
                    </Button>
                    <Button variant="outline" onClick={() => toast.error("Error message!")}>
                      Error Toast
                    </Button>
                    <Button variant="outline" onClick={() => toast.info("Info message!")}>
                      Info Toast
                    </Button>
                    <Button variant="outline" onClick={() => toast.warning("Warning message!")}>
                      Warning Toast
                    </Button>
                  </div>
                </div>

                <CodeBlock code={`// Badges
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<StatusBadge status="completed" />

// Alerts
<Alert>
  <AlertTitle>Title</AlertTitle>
  <AlertDescription>Description</AlertDescription>
</Alert>

// Toasts
toast.success("Success!")
toast.error("Error!")
toast.info("Info")`} />
              </div>
            </Section>

            {/* Data Display */}
            <Section id="data-display" title="Data Display" icon={Layers}>
              <div className="space-y-8">
                {/* Tabs */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Tabs</h3>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4">
                      <Card>
                        <CardContent className="pt-6">
                          Overview content goes here.
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="analytics" className="mt-4">
                      <Card>
                        <CardContent className="pt-6">
                          Analytics content goes here.
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="settings" className="mt-4">
                      <Card>
                        <CardContent className="pt-6">
                          Settings content goes here.
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Avatar */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Avatars</h3>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg">SV</AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Separator */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Separator</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Content above</p>
                    <Separator />
                    <p className="text-sm text-muted-foreground">Content below</p>
                  </div>
                </div>

                {/* Tooltip */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Tooltip</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline">Hover me</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This is a tooltip</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <CodeBlock code={`// Tabs
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>

// Avatar
<Avatar>
  <AvatarImage src="..." />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>

// Tooltip
<Tooltip>
  <TooltipTrigger>Hover</TooltipTrigger>
  <TooltipContent>Tooltip text</TooltipContent>
</Tooltip>`} />
              </div>
            </Section>

            {/* Effects & Animations */}
            <Section id="effects" title="Effects & Animations" icon={Sparkles}>
              <div className="space-y-8">
                {/* Gradients */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Gradients</h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="h-24 rounded-lg gradient-hero flex items-center justify-center text-white font-medium">
                      Hero Gradient
                    </div>
                    <div className="h-24 rounded-lg gradient-card border flex items-center justify-center font-medium">
                      Card Gradient
                    </div>
                    <div className="h-24 rounded-lg gradient-accent flex items-center justify-center text-white font-medium">
                      Accent Gradient
                    </div>
                    <div className="h-24 rounded-lg gradient-swiss flex items-center justify-center text-white font-medium">
                      Swiss Gradient
                    </div>
                  </div>
                </div>

                {/* Animations */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Animations</h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="animate-fade-in">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm font-medium">Fade In</p>
                        <p className="text-xs text-muted-foreground">animate-fade-in</p>
                      </CardContent>
                    </Card>
                    <Card className="animate-slide-up">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm font-medium">Slide Up</p>
                        <p className="text-xs text-muted-foreground">animate-slide-up</p>
                      </CardContent>
                    </Card>
                    <Card className="animate-pulse-glow">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm font-medium">Pulse Glow</p>
                        <p className="text-xs text-muted-foreground">animate-pulse-glow</p>
                      </CardContent>
                    </Card>
                    <Card className="animate-float">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm font-medium">Float</p>
                        <p className="text-xs text-muted-foreground">animate-float</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Shadows */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Shadows</h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="h-24 rounded-lg bg-card shadow-sm flex items-center justify-center">
                      <p className="text-sm">shadow-sm</p>
                    </div>
                    <div className="h-24 rounded-lg bg-card shadow-card flex items-center justify-center">
                      <p className="text-sm">shadow-card</p>
                    </div>
                    <div className="h-24 rounded-lg bg-card shadow-elevated flex items-center justify-center">
                      <p className="text-sm">shadow-elevated</p>
                    </div>
                    <div className="h-24 rounded-lg bg-card shadow-glow flex items-center justify-center">
                      <p className="text-sm">shadow-glow</p>
                    </div>
                  </div>
                </div>

                {/* Glass Effect */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Glass Effect</h3>
                  <div className="relative h-40 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 gradient-hero" />
                    <div className="absolute inset-4 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50 flex items-center justify-center">
                      <p className="text-sm font-medium">Glassmorphism: bg-background/50 backdrop-blur-sm</p>
                    </div>
                  </div>
                </div>

                <CodeBlock code={`// Gradients
<div className="gradient-hero">Hero gradient</div>
<div className="gradient-swiss">Swiss red gradient</div>

// Animations
<div className="animate-fade-in">Fades in</div>
<div className="animate-slide-up">Slides up</div>
<div className="animate-float">Floats</div>

// Shadows
<div className="shadow-card">Card shadow</div>
<div className="shadow-glow">Glowing shadow</div>

// Glass effect
<div className="bg-card/50 backdrop-blur-sm border-border/50">
  Glassmorphism
</div>`} />
              </div>
            </Section>

            {/* Design Principles */}
            <div className="mt-16 p-8 rounded-xl border bg-muted/30">
              <h2 className="text-2xl font-semibold mb-6">Design Principles</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Flag className="h-3 w-3" /></SwissIconTile>
                    Swiss Minimalism
                  </h3>
                  <p className="text-sm text-muted-foreground">Clean, precise, and functional. Every element has a purpose.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Moon className="h-3 w-3" /></SwissIconTile>
                    Dark-First Design
                  </h3>
                  <p className="text-sm text-muted-foreground">Optimized for dark mode with careful light mode support.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Circle className="h-3 w-3" /></SwissIconTile>
                    Swiss Red Accent
                  </h3>
                  <p className="text-sm text-muted-foreground">Strategic use of the primary red for important actions and CTAs.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Sparkles className="h-3 w-3" /></SwissIconTile>
                    Subtle Animations
                  </h3>
                  <p className="text-sm text-muted-foreground">Purposeful motion that enhances without distracting.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Layers className="h-3 w-3" /></SwissIconTile>
                    Glassmorphism
                  </h3>
                  <p className="text-sm text-muted-foreground">Layered, translucent surfaces for depth and hierarchy.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <SwissIconTile size="xs" variant="muted"><Palette className="h-3 w-3" /></SwissIconTile>
                    Semantic Colors
                  </h3>
                  <p className="text-sm text-muted-foreground">Consistent use of colors for states: success, error, warning, info.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DesignSystem;
