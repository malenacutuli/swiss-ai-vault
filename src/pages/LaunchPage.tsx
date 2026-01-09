/**
 * LaunchPage - Production launch announcement page
 * Light themed with sovereignTeal accents
 */

import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Shield,
  Bot,
  Zap,
  ArrowRight,
  Lock,
  Globe,
  CheckCircle,
  Users,
  FileText,
  Sparkles,
  Server,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LaunchPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold text-gray-900">
              Swiss Br<span className="text-red-600">AI</span>n
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/status" className="text-sm text-gray-600 hover:text-[#1D4E5F]">
              Status
            </Link>
            <Link to="/security" className="text-sm text-gray-600 hover:text-[#1D4E5F]">
              Security
            </Link>
            <Link to="/auth">
              <Button className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-4 bg-[#F8F9FA]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D4E5F]/10 rounded-full text-[#1D4E5F] text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            Now Available
          </div>

          <h1 className="font-['Playfair_Display'] italic text-5xl md:text-6xl text-gray-900 mb-6">
            Swiss Br<span className="text-red-600">AI</span>n is Live
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Swiss-hosted AI agents with privacy by design. Your data never leaves Switzerland.
            Enterprise-grade security meets cutting-edge AI capabilities.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white px-8"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" strokeWidth={1.5} />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Play className="w-5 h-5 mr-2" strokeWidth={1.5} />
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-['Playfair_Display'] italic text-3xl text-gray-900 mb-4">
              Why Swiss Br<span className="text-red-600">AI</span>n?
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Built from the ground up for privacy-conscious enterprises
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Swiss Data Residency"
              description="All data stored exclusively in Swiss data centers. GDPR and FADP compliant by design."
            />
            <FeatureCard
              icon={Bot}
              title="Intelligent Agents"
              description="AI agents that can research, analyze, create documents, and automate complex workflows."
            />
            <FeatureCard
              icon={Zap}
              title="Lightning Fast"
              description="Pre-warmed container pool ensures sub-second cold starts for instant responsiveness."
            />
            <FeatureCard
              icon={Lock}
              title="E2E Encryption"
              description="Client-side AES-256-GCM encryption. Your data is encrypted before it ever leaves your browser."
            />
            <FeatureCard
              icon={Globe}
              title="Browser Automation"
              description="Agents can browse the web, extract data, and interact with websites on your behalf."
            />
            <FeatureCard
              icon={FileText}
              title="Rich Outputs"
              description="Generate presentations, documents, spreadsheets, audio summaries, and more."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-[#1D4E5F]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <StatCard value="99.98%" label="Uptime SLA" />
            <StatCard value="<200ms" label="Avg Response" />
            <StatCard value="100%" label="Swiss Hosted" />
            <StatCard value="0" label="Data Leaks" />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-['Playfair_Display'] italic text-3xl text-gray-900 mb-4">
              Built for Enterprise
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Trusted by financial institutions, healthcare providers, and legal firms
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <UseCaseCard
              title="Financial Services"
              items={[
                'Compliant document processing',
                'Automated regulatory research',
                'Secure client communications',
              ]}
            />
            <UseCaseCard
              title="Healthcare"
              items={[
                'HIPAA-ready architecture',
                'Patient data summarization',
                'Research literature analysis',
              ]}
            />
            <UseCaseCard
              title="Legal"
              items={[
                'Contract analysis and review',
                'Legal research automation',
                'Privileged document handling',
              ]}
            />
            <UseCaseCard
              title="Consulting"
              items={[
                'Market research automation',
                'Presentation generation',
                'Competitive intelligence',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8">
            <TrustBadge icon={Server} label="Swiss Hosted" />
            <TrustBadge icon={Shield} label="GDPR Compliant" />
            <TrustBadge icon={Lock} label="E2E Encrypted" />
            <TrustBadge icon={CheckCircle} label="SOC 2 Type II" />
            <TrustBadge icon={Users} label="FINMA Ready" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#F8F9FA]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-['Playfair_Display'] italic text-3xl text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            Join thousands of professionals using Swiss BrAIn for secure AI workflows
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white px-8"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" strokeWidth={1.5} />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-gray-300">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                Swiss Br<span className="text-red-600">AI</span>n
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <Link to="/status" className="hover:text-[#1D4E5F]">
                Status
              </Link>
              <Link to="/security" className="hover:text-[#1D4E5F]">
                Security
              </Link>
              <Link to="/privacy" className="hover:text-[#1D4E5F]">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-[#1D4E5F]">
                Terms
              </Link>
            </div>
            <p className="text-sm text-gray-500">Made with precision in Switzerland</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-[#1D4E5F]/30 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-[#1D4E5F]/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#1D4E5F]" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

interface StatCardProps {
  value: string;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <div>
      <p className="text-4xl font-bold text-white mb-2">{value}</p>
      <p className="text-[#1D4E5F]/60 text-white/70">{label}</p>
    </div>
  );
}

interface UseCaseCardProps {
  title: string;
  items: string[];
}

function UseCaseCard({ title, items }: UseCaseCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-3 text-gray-600">
            <CheckCircle className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.5} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TrustBadgeProps {
  icon: LucideIcon;
  label: string;
}

function TrustBadge({ icon: Icon, label }: TrustBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
      <Icon className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.5} />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
}
