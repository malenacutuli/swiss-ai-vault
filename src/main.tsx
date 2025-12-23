import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <OrganizationProvider>
      <App />
    </OrganizationProvider>
  </HelmetProvider>
);
