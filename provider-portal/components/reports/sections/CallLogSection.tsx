/**
 * Detailed Call Log Section
 */

import type { DetailedCallLog } from '@/lib/daily-report-aggregation';
import { Phone, User, Target, CheckCircle, AlertTriangle, Headphones } from 'lucide-react';

interface CallLogSectionProps {
  callLog: DetailedCallLog[];
}

export default function CallLogSection({ callLog }: CallLogSectionProps) {
  if (callLog.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
        <h2 className="text-xl font-bold text-gray-900 mb-4 print:text-black">
          Detailed Call Log
        </h2>
        <p className="text-gray-600 print:text-black">No calls received during this period.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 print:text-black">
        Detailed Call Log (Chronological)
      </h2>
      
      <div className="space-y-6">
        {callLog.map((call) => (
          <div key={call.callNumber} className="border-l-4 border-blue-500 pl-4 pb-4 print:border-black">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 print:text-black">
                Call #{call.callNumber}
              </h3>
              {call.issuesFlagged && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded print:bg-gray-200 print:text-black">
                  Issue Flagged
                </span>
              )}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-gray-700 print:text-black">Timestamp:</span>
                  <span className="ml-2 text-gray-900 print:text-black">{call.timestamp}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-gray-700 print:text-black">Caller ID:</span>
                  <span className="ml-2 text-gray-900 print:text-black">{call.callerId}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-gray-700 print:text-black">Purpose of Call:</span>
                  <span className="ml-2 text-gray-900 print:text-black">{call.purposeOfCall}</span>
                </div>
              </div>
              
              {call.identifiedParticipant && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                  <div>
                    <span className="font-medium text-gray-700 print:text-black">Identified Participant:</span>
                    <span className="ml-2 text-gray-900 print:text-black">{call.identifiedParticipant}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-gray-700 print:text-black">Outcome:</span>
                  <span className="ml-2 text-gray-900 print:text-black">{call.outcome}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div className="flex-1">
                  <span className="font-medium text-gray-700 print:text-black">Actions Taken:</span>
                  <ul className="ml-2 mt-1 list-disc list-inside space-y-1">
                    {call.actionsTaken.map((action, idx) => (
                      <li key={idx} className="text-gray-900 print:text-black">{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-gray-700 print:text-black">Final Resolution:</span>
                  <span className="ml-2 text-gray-900 print:text-black">{call.finalResolution}</span>
                </div>
              </div>
              
              {call.recordingUrl && (
                <div className="flex items-start gap-2">
                  <Headphones className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0 print:text-black" />
                  <div>
                    <span className="font-medium text-gray-700 print:text-black">Recording:</span>
                    <a 
                      href={call.recordingUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-700 underline print:text-black print:no-underline"
                    >
                      Listen to recording
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

