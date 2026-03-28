/**
 * Additional Comments Section (Editable)
 */

import { MessageSquare, Check, Loader2 } from 'lucide-react';

interface AdditionalCommentsSectionProps {
  comments: string;
  onCommentsChange: (comments: string) => void;
  readOnly?: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
}

export default function AdditionalCommentsSection({ 
  comments, 
  onCommentsChange,
  readOnly = false,
  saveStatus = 'saved'
}: AdditionalCommentsSectionProps) {
  return (
    <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2 print:text-black">
          <MessageSquare className="w-5 h-5 print:text-black" />
          Additional Comments
        </h2>
        
        {!readOnly && (
          <div className="flex items-center gap-2 text-sm print:hidden">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-primary">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-muted-foreground/60">Unsaved</span>
            )}
          </div>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground mb-3 print:text-black">
        This is a free-text area where the global admin or provider can add important notes 
        before finalizing or exporting the report.
      </p>
      
      {readOnly ? (
        <div className="min-h-[120px] p-3 border border-input rounded-lg bg-muted/30 whitespace-pre-wrap print:bg-white print:border-black">
          {comments || <span className="text-muted-foreground/60 print:text-black italic">No additional comments</span>}
        </div>
      ) : (
        <>
          <textarea
            value={comments}
            onChange={(e) => onCommentsChange(e.target.value)}
            placeholder="Example: Client called again at 2:15 AM requesting clarification on transport. No action needed."
            className="w-full min-h-[120px] p-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y print:border-black"
            rows={5}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-muted-foreground print:text-black">
              Add any important notes, follow-up actions, or clarifications
            </p>
            <p className="text-xs text-muted-foreground print:text-black">
              {comments.length} characters
            </p>
          </div>
        </>
      )}
    </div>
  );
}

