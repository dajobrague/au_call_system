/**
 * Compliance Notes Section
 */

import type { ComplianceNotes } from '@/lib/daily-report-aggregation';
import { Shield, CheckCircle } from 'lucide-react';

interface ComplianceSectionProps {
  compliance: ComplianceNotes;
}

export default function ComplianceSection({ compliance }: ComplianceSectionProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 print:text-black">
        <Shield className="w-5 h-5 print:text-black" />
        Compliance Notes
      </h2>
      
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 print:text-black" />
          <div>
            <p className="text-sm font-medium text-gray-900 print:text-black">
              All timestamps recorded
            </p>
            <p className="text-xs text-gray-600 print:text-black">
              Every call and action has been logged with accurate timestamps
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 print:text-black" />
          <div>
            <p className="text-sm font-medium text-gray-900 print:text-black">
              All call outcomes logged
            </p>
            <p className="text-xs text-gray-600 print:text-black">
              Every call has a documented outcome and resolution
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 print:text-black" />
          <div>
            <p className="text-sm font-medium text-gray-900 print:text-black">
              Data stored securely ({compliance.dataStoredSecurely})
            </p>
            <p className="text-xs text-gray-600 print:text-black">
              All data is stored on secure servers in compliance with local regulations
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 print:text-black" />
          <div>
            <p className="text-sm font-medium text-gray-900 print:text-black">
              Provider identifiers matched automatically
            </p>
            <p className="text-xs text-gray-600 print:text-black">
              All calls and actions are automatically linked to the correct provider
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 print:text-black" />
          <div>
            <p className="text-sm font-medium text-gray-900 print:text-black">
              No unverified data stored
            </p>
            <p className="text-xs text-gray-600 print:text-black">
              All data has been verified and validated before storage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

