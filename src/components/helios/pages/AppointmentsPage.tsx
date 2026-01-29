/**
 * Appointments Page
 * View and book appointments
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Video, Plus, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { BookingModal } from '../booking/BookingModal';
import { AIVisitRequiredModal } from '../booking/AIVisitRequiredModal';
import { DoctorDirectory, type Doctor } from '../booking/DoctorDirectory';

const doctorAvatars = [
  { id: 1, name: 'Dr. Smith', image: '/avatars/doctor-1.jpg' },
  { id: 2, name: 'Dr. Johnson', image: '/avatars/doctor-2.jpg' },
  { id: 3, name: 'Dr. Williams', image: '/avatars/doctor-3.jpg' },
];

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAIRequiredModal, setShowAIRequiredModal] = useState(false);
  const [showDoctorDirectory, setShowDoctorDirectory] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [hasRecentConsult, setHasRecentConsult] = useState(false);

  const { vault, isInitialized } = useHealthVault();

  useEffect(() => {
    if (vault && isInitialized) {
      loadAppointments();
      checkRecentConsults();
    }
  }, [vault, isInitialized]);

  const loadAppointments = async () => {
    const appts = await vault?.listAppointments();
    setAppointments(appts || []);
  };

  const checkRecentConsults = async () => {
    const consults = await vault?.listConsults();
    // Check if there's a consult in the last 24 hours
    const recentConsult = consults?.find(c => {
      const createdAt = new Date(c.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      return hoursDiff < 24;
    });
    setHasRecentConsult(!!recentConsult);
  };

  const handleBookClick = () => {
    if (hasRecentConsult) {
      setShowDoctorDirectory(true);
    } else {
      setShowAIRequiredModal(true);
    }
  };

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowDoctorDirectory(false);
    setShowBookingModal(true);
  };

  const upcomingAppointments = appointments.filter(a =>
    a.status === 'scheduled' && new Date(a.scheduledAt) > new Date()
  );

  const pastAppointments = appointments.filter(a =>
    a.status === 'completed' || new Date(a.scheduledAt) <= new Date()
  );

  // Show doctor directory view
  if (showDoctorDirectory) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif">Find a Doctor</h1>
            <p className="text-gray-600">Browse our network of licensed physicians</p>
          </div>
          <Button variant="outline" onClick={() => setShowDoctorDirectory(false)}>
            Back
          </Button>
        </div>
        <DoctorDirectory onSelectDoctor={handleSelectDoctor} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {appointments.length === 0 ? (
        // Empty state
        <div className="text-center py-16">
          <h1 className="text-4xl font-serif mb-6">
            You have no<br />appointments
          </h1>

          {/* Doctor avatars */}
          <div className="flex justify-center -space-x-3 mb-8">
            {doctorAvatars.map((doc) => (
              <div
                key={doc.id}
                className="w-12 h-12 rounded-full bg-gray-300 border-2 border-white"
              />
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">
              Follow up with a human doctor
            </h2>
            <p className="text-gray-600 mb-6">
              Book a video appointment with top doctors licensed in all 50 states.
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleBookClick}
                className="w-full h-12 bg-[#2196F3] hover:bg-[#1976D2]"
              >
                Book Appointment
              </Button>

              {hasRecentConsult && (
                <Button
                  variant="outline"
                  onClick={() => setShowDoctorDirectory(true)}
                  className="w-full h-12"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Browse All Doctors
                </Button>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="mt-12 space-y-4 text-left max-w-md mx-auto">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Top licensed doctors</p>
                <p className="text-sm text-gray-500">Available in all 50 states</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Full service care</p>
                <p className="text-sm text-gray-500">Prescriptions, referrals & treatment</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">No insurance needed</p>
                <p className="text-sm text-gray-500">All notes available in HELIOS</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Appointments list
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-serif">Appointments</h1>
            <Button onClick={handleBookClick}>
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </div>

          {/* Upcoming */}
          {upcomingAppointments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-white rounded-xl p-4 border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div>
                        <p className="font-medium">{appt.providerName}</p>
                        <p className="text-sm text-gray-500">{appt.specialty}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {new Date(appt.scheduledAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(appt.scheduledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Video className="w-4 h-4 mr-2" />
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastAppointments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Past</h2>
              <div className="space-y-3">
                {pastAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-white rounded-xl p-4 border flex items-center justify-between opacity-75"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div>
                        <p className="font-medium">{appt.providerName}</p>
                        <p className="text-sm text-gray-500">{appt.specialty}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">
                        {new Date(appt.scheduledAt).toLocaleDateString()}
                      </p>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Required Modal */}
      {showAIRequiredModal && (
        <AIVisitRequiredModal
          onClose={() => setShowAIRequiredModal(false)}
          onStartAI={() => {
            setShowAIRequiredModal(false);
            window.location.href = '/health';
          }}
        />
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          onClose={() => {
            setShowBookingModal(false);
            setSelectedDoctor(null);
          }}
          onBook={async (data) => {
            // Save appointment with doctor info
            await vault?.saveAppointment({
              id: crypto.randomUUID(),
              ...data,
              providerId: selectedDoctor?.id,
              providerName: selectedDoctor?.name || 'Next Available Doctor',
              specialty: selectedDoctor?.specialty || data.specialty,
              status: 'scheduled',
            });
            setShowBookingModal(false);
            setSelectedDoctor(null);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}
