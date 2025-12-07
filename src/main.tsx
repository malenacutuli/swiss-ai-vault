import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(
  <OrganizationProvider>
    <App />
  </OrganizationProvider>
);
