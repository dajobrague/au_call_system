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
      <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 print:text-black">
          <Paperclip className="w-5 h-5 print:text-black" />
          Attachments / Raw Transcripts
        </h2>
        <p className="text-muted-foreground print:text-black">No attachments available for this report.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 print:text-black">
        <Paperclip className="w-5 h-5 print:text-black" />
        Attachments / Raw Transcripts
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4 print:text-black">
        Access call recordings and transcripts (if enabled)
      </p>
      
      <div className="space-y-2">
        {attachments.map((attachment, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 p-3 border border-border/60 rounded-lg hover:bg-muted/30 transition-colors print:border-black print:hover:bg-white"
          >
            {attachment.type === 'recording' ? (
              <FileAudio className="w-5 h-5 text-primary shrink-0 print:text-black" />
            ) : (
              <FileText className="w-5 h-5 text-primary shrink-0 print:text-black" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground print:text-black">
                {attachment.label}
              </p>
              <p className="text-xs text-muted-foreground truncate print:text-black">
                {attachment.type === 'recording' ? 'Audio Recording' : 'Text Transcript'}
              </p>
            </div>
            
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:text-primary font-medium px-3 py-1 rounded hover:bg-primary/10 transition-colors print:text-black print:no-underline"
            >
              View
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

