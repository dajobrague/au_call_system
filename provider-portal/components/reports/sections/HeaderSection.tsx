/**
 * Report Header Section
 */

import type { ReportHeader } from '@/lib/daily-report-aggregation';

interface HeaderSectionProps {
  header: ReportHeader;
}

export default function HeaderSection({ header }: HeaderSectionProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h1 className="text-2xl font-bold text-gray-900 mb-4 print:text-black">
        Daily On-Call Report
      </h1>
      
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <span className="font-semibold text-gray-700 print:text-black">Provider Name:</span>
          <span className="ml-2 text-gray-900 print:text-black">{header.providerName}</span>
        </div>
        
        <div>
          <span className="font-semibold text-gray-700 print:text-black">Date:</span>
          <span className="ml-2 text-gray-900 print:text-black">{header.date}</span>
        </div>
        
        <div>
          <span className="font-semibold text-gray-700 print:text-black">On-Call Window:</span>
          <span className="ml-2 text-gray-900 print:text-black">{header.onCallWindow}</span>
        </div>
        
        <div>
          <span className="font-semibold text-gray-700 print:text-black">Operator Name:</span>
          <span className="ml-2 text-gray-900 print:text-black">{header.operatorName}</span>
        </div>
        
        <div className="col-span-2">
          <span className="font-semibold text-gray-700 print:text-black">Report Generated At:</span>
          <span className="ml-2 text-gray-900 print:text-black">{header.generatedAt}</span>
        </div>
      </div>
    </div>
  );
}

