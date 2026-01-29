/**
 * HELIOS Main Layout
 * Doctronic-style with sidebar navigation
 */

import React, { useState } from 'react';
import {
  MessageSquare, Stethoscope, FileText, Calendar,
  Menu, X, User, Settings, LogOut, Shield, Heart
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface HeliosLayoutProps {
  children: React.ReactNode;
  userName?: string;
}

const navigation = [
  { name: 'New Consult', href: '/health', icon: MessageSquare, primary: true },
  { name: 'Consults', href: '/health/consults', icon: Stethoscope },
  { name: 'Health Record', href: '/health/record', icon: FileText },
  { name: 'Appointments', href: '/health/appointments', icon: Calendar },
];

const specialtyConsults = [
  'Primary Care',
  'Dermatology',
  'Women\'s Health',
  'Mental Health',
  'Pediatrics',
  'Cardiology',
  'More',
];

export function HeliosLayout({ children, userName }: HeliosLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-80 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <Link to="/health" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1D4E5F] rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">HELIOS</span>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        isActive
                          ? "bg-[#1D4E5F]/10 text-[#1D4E5F]"
                          : "text-gray-700 hover:bg-gray-100",
                        item.primary && "text-[#1D4E5F] font-medium"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Specialty Consults */}
            <div className="mt-8">
              <h3 className="px-4 text-sm font-medium text-gray-500 mb-2">
                Free AI Doctor Consults
              </h3>
              <ul className="space-y-1">
                {specialtyConsults.map((specialty) => (
                  <li key={specialty}>
                    <Link
                      to={`/health/consult/${specialty.toLowerCase().replace(/\s+/g, '-')}`}
                      className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {specialty}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Privacy Badge */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="w-4 h-4" />
              <span>End-to-end encrypted • Data stays on your device</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-4 border-t text-xs text-gray-400 leading-relaxed">
            <p>
              <span className="underline">Always discuss HELIOS output with a doctor</span>.
              HELIOS is an AI health assistant, not a licensed doctor, does not practice medicine,
              and does not provide medical advice or care.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-80">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#FAF9F7] border-b border-gray-200 lg:border-0">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 max-w-md mx-4 lg:mx-0">
              {/* Search bar placeholder */}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">
                  {userName || 'Guest'}
                </span>
                {!userName && (
                  <span className="text-xs text-gray-500">(Guest)</span>
                )}
              </div>
              <div className="w-10 h-10 bg-[#B8E8F5] rounded-full flex items-center justify-center text-[#1D4E5F] font-medium">
                {userName?.charAt(0).toUpperCase() || 'G'}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
