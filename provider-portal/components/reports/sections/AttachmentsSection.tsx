/**
 * Attachments / Raw Transcript Section
 */

import type { Attachment } from '@/lib/daily-report-aggregation';
import { Paperclip, FileAudio, FileText } from 'lucide-react';

interface AttachmentsSectionProps {
  attachments: Attachment[];
}

export default function AttachmentsSection({ attachments }: AttachmentsSectionProps) {
  if (attachments.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 print:text-black">
          <Paperclip className="w-5 h-5 print:text-black" />
          Attachments / Raw Transcripts
        </h2>
        <p className="text-gray-600 print:text-black">No attachments available for this report.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 print:text-black">
        <Paperclip className="w-5 h-5 print:text-black" />
        Attachments / Raw Transcripts
      </h2>
      
      <p className="text-sm text-gray-600 mb-4 print:text-black">
        Access call recordings and transcripts (if enabled)
      </p>
      
      <div className="space-y-2">
        {attachments.map((attachment, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors print:border-black print:hover:bg-white"
          >
            {attachment.type === 'recording' ? (
              <FileAudio className="w-5 h-5 text-blue-600 flex-shrink-0 print:text-black" />
            ) : (
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 print:text-black" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 print:text-black">
                {attachment.label}
              </p>
              <p className="text-xs text-gray-500 truncate print:text-black">
                {attachment.type === 'recording' ? 'Audio Recording' : 'Text Transcript'}
              </p>
            </div>
            
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors print:text-black print:no-underline"
            >
              View
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

