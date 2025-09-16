"use client";

/**
 * Professional Job Acceptance Page
 * Built with Tailwind CSS
 */

import { useState, useEffect } from 'react';

interface JobAcceptancePageProps {
  params: {
    id: string;
  };
  searchParams: {
    emp?: string;
  };
}

interface JobDetails {
  id: string;
  occurrenceId?: string;
  scheduledAt?: string;
  time?: string;
  status: string;
  reason?: string;
  assignedToCurrentEmployee?: boolean;
  isAvailable?: boolean;
  patient?: {
    name: string;
    address: string;
    notes: string;
  } | null;
  jobTemplate?: {
    title: string;
    serviceType: string;
  };
  provider?: {
    name: string;
    logo?: string | null;
  };
  employee?: {
    name: string;
    id: string;
  };
}

export default function JobAcceptancePage({ params, searchParams }: JobAcceptancePageProps) {
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const jobId = params.id;
  const employeeId = searchParams.emp;

  useEffect(() => {
    if (!employeeId) {
      setError('Invalid link - missing employee ID');
      setLoading(false);
      return;
    }

    loadJobDetails();
  }, [jobId, employeeId]);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/job/${jobId}?emp=${employeeId}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setError('This job is no longer available - it has been assigned to another employee.');
        } else {
          setError(data.error || 'Failed to load job details');
        }
        setLoading(false);
        return;
      }

      setJobDetails(data.job);
      setLoading(false);
    } catch (error) {
      setError('Failed to load job details');
      setLoading(false);
    }
  };

  const handleAction = async (action: 'accept' | 'decline') => {
    try {
      setActionLoading(true);
      
      const response = await fetch(`/api/job/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          employeeId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setActionResult(data.message);
      } else {
        setError(data.error || 'Failed to process action');
      }
    } catch (error) {
      setError('Failed to process action');
    } finally {
      setActionLoading(false);
    }
  };

  // Success state - show confirmation with job details
  if (actionResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Provider Logo & Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 p-6">
              <img
                alt="Healthcare Provider Logo"
                height={60}
                src={jobDetails?.provider?.logo || "https://t4.ftcdn.net/jpg/06/96/89/13/360_F_696891328_utj80ZwXsdy8SloC9IBaFGDIcGNBrEze.jpg"}
                width={120}
                className="object-contain rounded-sm"
              />
              <div className="flex flex-col justify-center">
                <p className="text-lg font-semibold text-blue-700">
                  {jobDetails?.provider?.name || 'Healthcare Services'}
                </p>
                <p className="text-sm text-gray-600">Professional Assignment System</p>
              </div>
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-100 p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Assignment Confirmed!</h2>
            <p className="text-gray-600 mb-4">{actionResult}</p>
            {jobDetails?.employee && (
              <p className="text-sm text-green-700 font-medium">
                Welcome, {jobDetails.employee.name} - Here are your assignment details:
              </p>
            )}
          </div>

          {/* Job Details */}
          {jobDetails && (
            <div className="bg-white shadow-sm rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">Your Assignment</h2>
                    <p className="text-sm text-gray-600">Confirmed Healthcare Assignment</p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Confirmed
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Patient Information */}
                {jobDetails.patient && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Patient Information
                    </h3>
                    <div className="space-y-3">
                      <p className="text-sm text-blue-900"><strong>Name:</strong> {jobDetails.patient.name}</p>
                      {jobDetails.patient.notes && (
                        <p className="text-sm text-blue-900"><strong>Notes:</strong> {jobDetails.patient.notes}</p>
                      )}
                      <div>
                        <p className="text-sm text-blue-900 mb-2"><strong>Address:</strong> {jobDetails.patient?.address || ''}</p>
                        {/* Google Maps Embed */}
                        {process.env.NEXT_PUBLIC_MAPS_API ? (
                          <div className="rounded-lg overflow-hidden border border-blue-200 bg-white relative cursor-pointer group">
                            <iframe
                              width="100%"
                              height="200"
                              style={{ border: 0, pointerEvents: 'none' }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_MAPS_API}&q=${encodeURIComponent(jobDetails.patient?.address || '')}&zoom=15&maptype=roadmap`}
                              title="Patient Location"
                            />
                            <div 
                              className="absolute inset-0 bg-transparent hover:bg-blue-500/5 transition-colors flex items-center justify-center"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobDetails.patient?.address || '')}`, '_blank')}
                            >
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                Tap to open in Maps
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-blue-200 bg-white p-4 text-center">
                            <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-blue-700">Map unavailable</p>
                            <p className="text-xs text-blue-600">Google Maps API key not configured</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobDetails.patient?.address || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-700 hover:text-blue-800 underline"
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Schedule Information */}
                {jobDetails.scheduledAt && jobDetails.time && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Schedule Details
                    </h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700"><strong>Date:</strong> {new Date(jobDetails.scheduledAt || '').toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p className="text-sm text-gray-700"><strong>Time:</strong> {jobDetails.time}</p>
                      {jobDetails.jobTemplate && (
                        <>
                          <p className="text-sm text-gray-700"><strong>Service:</strong> {jobDetails.jobTemplate?.title || 'Healthcare Service'}</p>
                          <p className="text-sm text-gray-700"><strong>Type:</strong> {jobDetails.jobTemplate?.serviceType || 'General'}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Provider Logo & Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4 p-6">
            <img
              alt="Healthcare Provider Logo"
              height={60}
              src={jobDetails?.provider?.logo || "https://t4.ftcdn.net/jpg/06/96/89/13/360_F_696891328_utj80ZwXsdy8SloC9IBaFGDIcGNBrEze.jpg"}
              width={120}
              className="object-contain rounded-sm"
            />
            <div className="flex flex-col justify-center">
              <p className="text-lg font-semibold text-blue-700">
                {jobDetails?.provider?.name || 'Healthcare Services'}
              </p>
              <p className="text-sm text-gray-600">Professional Assignment System</p>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        {jobDetails && !loading && !error && jobDetails.employee && jobDetails.status !== 'assigned_to_others' && (
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-800">
                  Welcome, {jobDetails.employee.name}
                </p>
                <p className="text-sm text-blue-600">
                  {jobDetails.assignedToCurrentEmployee 
                    ? "This is your assigned job" 
                    : "You have a new assignment opportunity"
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Job Taken Message */}
        {jobDetails && !loading && !error && jobDetails.status === 'assigned_to_others' && jobDetails.employee && (
          <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Assignment No Longer Available</h2>
            <p className="text-gray-600">
              Sorry {jobDetails.employee.name}, this job has been taken by someone else. 
              Thanks for your interest!
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white shadow-sm rounded-xl border border-gray-200">
            <div className="text-center py-8 px-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
              <p className="text-sm text-gray-600">Please wait while we fetch the job information</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-white shadow-sm rounded-xl border border-gray-200">
            <div className="text-center py-8 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Unable to Load Assignment</h2>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          </div>
        )}

        {/* Job Details */}
        {jobDetails && !loading && !error && jobDetails.status !== 'assigned_to_others' && (
          <>
            {/* Main Job Card */}
            <div className="bg-white shadow-sm rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">Assignment Available</h2>
                    <p className="text-sm text-gray-600">Healthcare Professional Opportunity</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-xs font-medium text-blue-700">Available</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Patient Information */}
                {jobDetails.patient && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Patient Information
                    </h3>
                    <div className="space-y-3">
                      <p className="text-sm text-blue-900"><strong>Name:</strong> {jobDetails.patient.name}</p>
                      {jobDetails.patient.notes && (
                        <p className="text-sm text-blue-900"><strong>Notes:</strong> {jobDetails.patient.notes}</p>
                      )}
                      <div>
                        <p className="text-sm text-blue-900 mb-2"><strong>Address:</strong> {jobDetails.patient?.address || ''}</p>
                        {/* Google Maps Embed */}
                        {process.env.NEXT_PUBLIC_MAPS_API ? (
                          <div className="rounded-lg overflow-hidden border border-blue-200 bg-white relative cursor-pointer group">
                            <iframe
                              width="100%"
                              height="200"
                              style={{ border: 0, pointerEvents: 'none' }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_MAPS_API}&q=${encodeURIComponent(jobDetails.patient?.address || '')}&zoom=15&maptype=roadmap`}
                              title="Patient Location"
                            />
                            <div 
                              className="absolute inset-0 bg-transparent hover:bg-blue-500/5 transition-colors flex items-center justify-center"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobDetails.patient?.address || '')}`, '_blank')}
                            >
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                Tap to open in Maps
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-blue-200 bg-white p-4 text-center">
                            <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-blue-700">Map unavailable</p>
                            <p className="text-xs text-blue-600">Google Maps API key not configured</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobDetails.patient?.address || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-700 hover:text-blue-800 underline"
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Schedule Information */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedule Details
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700"><strong>Date:</strong> {new Date(jobDetails.scheduledAt || '').toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-sm text-gray-700"><strong>Time:</strong> {jobDetails.time}</p>
                    <p className="text-sm text-gray-700"><strong>Service:</strong> {jobDetails.jobTemplate?.title || 'Healthcare Service'}</p>
                    <p className="text-sm text-gray-700"><strong>Type:</strong> {jobDetails.jobTemplate?.serviceType || 'General'}</p>
                  </div>
                </div>
                
                {/* Availability Reason */}
                {jobDetails.reason && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Assignment Details
                    </h3>
                    <p className="text-sm text-gray-700">{jobDetails.reason}</p>
                  </div>
                )}
              </div>

              {/* Action Button - Only show if job is available and not assigned to current employee */}
              {jobDetails.isAvailable && !jobDetails.assignedToCurrentEmployee && (
                <div className="p-6 pt-4 border-t border-gray-100">
                  <button
                    className="w-full font-semibold inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white h-12 px-6 disabled:opacity-60 hover:bg-blue-700 transition-colors"
                    disabled={actionLoading}
                    onClick={() => handleAction('accept')}
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {actionLoading ? 'Processing Assignment...' : 'Accept Assignment'}
                  </button>
                </div>
              )}

              {/* Already Assigned Message */}
              {jobDetails.assignedToCurrentEmployee && (
                <div className="p-6 pt-4 border-t border-gray-100 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Assignment Confirmed
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}