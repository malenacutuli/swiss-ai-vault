import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Datasets from "./pages/Datasets";
import Finetuning from "./pages/Finetuning";
import Evaluations from "./pages/Evaluations";
import Models from "./pages/Models";
import Playground from "./pages/Playground";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/projects" element={<Projects />} />
          <Route path="/dashboard/datasets" element={<Datasets />} />
          <Route path="/dashboard/finetuning" element={<Finetuning />} />
          <Route path="/dashboard/evaluations" element={<Evaluations />} />
          <Route path="/dashboard/models" element={<Models />} />
          <Route path="/dashboard/playground" element={<Playground />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
