/**
 * Domain Icon Mapping Utility
 * Maps template domains, languages, and types to Lucide icons
 * Used to replace emojis with consistent iconography
 */

import {
  Headphones,
  Scale,
  Building2,
  Heart,
  Shield,
  Users,
  ShoppingCart,
  Code,
  Globe,
  Terminal,
  Braces,
  Database,
  BookOpen,
  FileCode,
  type LucideIcon,
} from "@/icons";

// Domain to icon mapping for finetuning templates
export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  customer_service: Headphones,
  legal: Scale,
  finance: Building2,
  healthcare: Heart,
  insurance: Shield,
  hr: Users,
  retail: ShoppingCart,
  code: Code,
};

// Language/technology to icon mapping
export const LANGUAGE_ICONS: Record<string, LucideIcon> = {
  python: Terminal,
  typescript: Braces,
  javascript: Braces,
  react: Braces,
  sql: Database,
  documentation: BookOpen,
};

/**
 * Get the appropriate Lucide icon for a domain
 * Falls back to Globe if domain not found
 */
export function getDomainIcon(domain: string): LucideIcon {
  return DOMAIN_ICONS[domain] || Globe;
}

/**
 * Get the appropriate Lucide icon for a language/technology
 * Falls back to FileCode if language not found
 */
export function getLanguageIcon(language: string): LucideIcon {
  const key = language.toLowerCase();
  return LANGUAGE_ICONS[key] || FileCode;
}
