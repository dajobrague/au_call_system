/**
 * CSV Imports Page
 * Main page for managing CSV imports and mapping profiles
 */

'use client';

import { useState, useEffect } from 'react';
import { Upload, Plus, Edit, Trash2, Clock } from 'lucide-react';
import ImportWizard from '@/components/import/ImportWizard';
import { CSVMappingProfile } from '@/lib/airtable';

export default function ImportsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [profiles, setProfiles] = useState<CSVMappingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<CSVMappingProfile | null>(null);
  const [preselectedFileType, setPreselectedFileType] = useState<FileType | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/import/profiles');
      const data = await response.json();
      
      if (data.success) {
        setProfiles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this mapping profile?')) {
      return;
    }

    try {
      const response = await fetch(`/api/import/profiles?id=${profileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setSelectedProfile(null);
    setPreselectedFileType(null);
    fetchProfiles(); // Refresh profiles
  };

  const handleStartImport = (fileType: FileType) => {
    setPreselectedFileType(fileType);
    setShowWizard(true);
  };

  const getFileTypeName = (fileType: string) => {
    switch (fileType) {
      case 'staff': return 'Staff (Employees)';
      case 'participants': return 'Participants (Patients)';
      case 'pools': return 'Pools (Staff-Patient Links)';
      case 'shifts': return 'Shifts (Job Occurrences)';
      default: return fileType;
    }
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'staff': return 'bg-blue-100 text-blue-800';
      case 'participants': return 'bg-green-100 text-green-800';
      case 'pools': return 'bg-purple-100 text-purple-800';
      case 'shifts': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CSV Imports</h1>
            <p className="text-gray-600 mt-2">
              Upload and manage bulk data imports with mapping profiles
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Import
          </button>
        </div>
      </div>

      {/* Import Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => handleStartImport('pools')}
          className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <Upload className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-900">Pools</div>
              <div className="text-sm text-purple-700">Staff-patient links</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleStartImport('shifts')}
          className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 hover:bg-orange-100 hover:border-orange-300 transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <Upload className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-900">Shifts</div>
              <div className="text-sm text-orange-700">Job occurrences</div>
            </div>
          </div>
        </button>
      </div>

      {/* Saved Mapping Profiles */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Saved Mapping Profiles</h2>
          <p className="text-sm text-gray-600 mt-1">
            Reuse your column mappings for faster imports
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No mapping profiles yet</p>
              <p className="text-sm text-gray-500">
                Create your first profile by importing a CSV and saving the mapping
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{profile.name}</h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getFileTypeColor(profile.fileType)}`}>
                        {getFileTypeName(profile.fileType)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedProfile(profile);
                          setShowWizard(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Use this profile"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3" />
                    Last used: {new Date(profile.lastUsedAt).toLocaleDateString()}
                  </div>

                  <div className="text-xs text-gray-600">
                    {profile.columnMappings.length} columns mapped
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Wizard Modal */}
      {showWizard && (
        <ImportWizard
          onClose={handleWizardClose}
          initialProfile={selectedProfile}
          preselectedFileType={preselectedFileType}
        />
      )}
    </div>
  );
}

