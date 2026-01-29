/**
 * Doctor Directory
 * Browse and select doctors for booking
 */

import React, { useState } from 'react';
import { Search, Star, Clock, Video, MapPin, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  languages: string[];
  nextAvailable: string;
  priceRange: string;
  acceptsInsurance: boolean;
  bio: string;
  avatar?: string;
}

// Mock doctor data
const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'dr-smith',
    name: 'Dr. Sarah Smith',
    title: 'MD, FACP',
    specialty: 'primary-care',
    rating: 4.9,
    reviewCount: 234,
    yearsExperience: 15,
    languages: ['English', 'Spanish'],
    nextAvailable: 'Today, 2:30 PM',
    priceRange: '$39 - $59',
    acceptsInsurance: true,
    bio: 'Board-certified internal medicine physician with expertise in preventive care and chronic disease management.',
  },
  {
    id: 'dr-johnson',
    name: 'Dr. Michael Johnson',
    title: 'MD',
    specialty: 'cardiology',
    rating: 4.8,
    reviewCount: 156,
    yearsExperience: 20,
    languages: ['English'],
    nextAvailable: 'Today, 4:00 PM',
    priceRange: '$79 - $99',
    acceptsInsurance: true,
    bio: 'Cardiologist specializing in heart disease prevention and management. Fellow of the American College of Cardiology.',
  },
  {
    id: 'dr-chen',
    name: 'Dr. Emily Chen',
    title: 'MD, FAAD',
    specialty: 'dermatology',
    rating: 4.9,
    reviewCount: 312,
    yearsExperience: 12,
    languages: ['English', 'Mandarin'],
    nextAvailable: 'Tomorrow, 10:00 AM',
    priceRange: '$59 - $79',
    acceptsInsurance: true,
    bio: 'Board-certified dermatologist with expertise in medical dermatology, skin cancer screening, and cosmetic procedures.',
  },
  {
    id: 'dr-patel',
    name: 'Dr. Raj Patel',
    title: 'MD, PhD',
    specialty: 'mental-health',
    rating: 4.7,
    reviewCount: 189,
    yearsExperience: 10,
    languages: ['English', 'Hindi'],
    nextAvailable: 'Today, 5:30 PM',
    priceRange: '$49 - $69',
    acceptsInsurance: true,
    bio: 'Psychiatrist specializing in anxiety, depression, and stress management. Integrative approach combining therapy and medication.',
  },
  {
    id: 'dr-williams',
    name: 'Dr. Jessica Williams',
    title: 'MD, FACOG',
    specialty: 'womens-health',
    rating: 4.9,
    reviewCount: 278,
    yearsExperience: 18,
    languages: ['English', 'French'],
    nextAvailable: 'Tomorrow, 9:00 AM',
    priceRange: '$59 - $79',
    acceptsInsurance: true,
    bio: 'OB-GYN with expertise in women\'s health, reproductive medicine, and menopause management.',
  },
  {
    id: 'dr-garcia',
    name: 'Dr. Maria Garcia',
    title: 'MD',
    specialty: 'pediatrics',
    rating: 4.8,
    reviewCount: 201,
    yearsExperience: 14,
    languages: ['English', 'Spanish'],
    nextAvailable: 'Today, 3:00 PM',
    priceRange: '$39 - $59',
    acceptsInsurance: true,
    bio: 'Pediatrician passionate about child health and development. Special interest in childhood nutrition and behavioral health.',
  },
];

const SPECIALTIES = [
  { value: 'all', label: 'All Specialties' },
  { value: 'primary-care', label: 'Primary Care' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'mental-health', label: 'Mental Health' },
  { value: 'womens-health', label: "Women's Health" },
  { value: 'pediatrics', label: 'Pediatrics' },
];

interface DoctorDirectoryProps {
  onSelectDoctor: (doctor: Doctor) => void;
  recommendedSpecialty?: string;
}

export function DoctorDirectory({ onSelectDoctor, recommendedSpecialty }: DoctorDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(recommendedSpecialty || 'all');
  const [sortBy, setSortBy] = useState<'rating' | 'availability' | 'experience'>('rating');

  // Filter and sort doctors
  const filteredDoctors = MOCK_DOCTORS
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.bio.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty = selectedSpecialty === 'all' || doc.specialty === selectedSpecialty;
      return matchesSearch && matchesSpecialty;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return b.yearsExperience - a.yearsExperience;
        case 'availability':
          // Sort by "Today" first
          const aToday = a.nextAvailable.toLowerCase().includes('today');
          const bToday = b.nextAvailable.toLowerCase().includes('today');
          if (aToday && !bToday) return -1;
          if (!aToday && bToday) return 1;
          return 0;
        default:
          return 0;
      }
    });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors by name or specialty..."
              className="pl-10"
            />
          </div>

          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALTIES.map((spec) => (
                <SelectItem key={spec.value} value={spec.value}>
                  {spec.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="availability">Soonest Available</SelectItem>
              <SelectItem value="experience">Most Experience</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recommended Banner */}
      {recommendedSpecialty && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800">
            Based on your consult, we recommend seeing a{' '}
            <strong>{SPECIALTIES.find(s => s.value === recommendedSpecialty)?.label}</strong> specialist.
          </p>
        </div>
      )}

      {/* Doctor List */}
      <div className="space-y-4">
        {filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500">No doctors found matching your criteria.</p>
          </div>
        ) : (
          filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-white rounded-xl border p-6 hover:border-gray-300 transition-colors"
            >
              <div className="flex flex-col md:flex-row gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                    {doctor.name.split(' ').map(n => n[0]).join('')}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{doctor.name}</h3>
                      <p className="text-sm text-gray-500">{doctor.title}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{doctor.rating}</span>
                      <span className="text-gray-400">({doctor.reviewCount} reviews)</span>
                    </div>
                  </div>

                  <p className="text-gray-600 mt-2 text-sm">{doctor.bio}</p>

                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>{doctor.yearsExperience} years experience</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{doctor.languages.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <Video className="w-4 h-4" />
                      <span>{doctor.nextAvailable}</span>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
                    <div className="text-sm">
                      <span className="font-medium">{doctor.priceRange}</span>
                      {doctor.acceptsInsurance && (
                        <span className="ml-2 text-gray-500">| Accepts insurance</span>
                      )}
                    </div>
                    <Button
                      onClick={() => onSelectDoctor(doctor)}
                      className="bg-[#2196F3] hover:bg-[#1976D2]"
                    >
                      Book Appointment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export type { Doctor };
