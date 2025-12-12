/**
 * Additional Comments Section (Editable)
 */

import { MessageSquare } from 'lucide-react';

interface AdditionalCommentsSectionProps {
  comments: string;
  onCommentsChange: (comments: string) => void;
  readOnly?: boolean;
}

export default function AdditionalCommentsSection({ 
  comments, 
  onCommentsChange,
  readOnly = false 
}: AdditionalCommentsSectionProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 print:text-black">
        <MessageSquare className="w-5 h-5 print:text-black" />
        Additional Comments
      </h2>
      
      <p className="text-sm text-gray-600 mb-3 print:text-black">
        This is a free-text area where the global admin or provider can add important notes 
        before finalizing or exporting the report.
      </p>
      
      {readOnly ? (
        <div className="min-h-[120px] p-3 border border-gray-300 rounded-md bg-gray-50 whitespace-pre-wrap print:bg-white print:border-black">
          {comments || <span className="text-gray-400 print:text-black italic">No additional comments</span>}
        </div>
      ) : (
        <>
          <textarea
            value={comments}
            onChange={(e) => onCommentsChange(e.target.value)}
            placeholder="Example: Client called again at 2:15 AM requesting clarification on transport. No action needed."
            className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y print:border-black"
            rows={5}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500 print:text-black">
              Add any important notes, follow-up actions, or clarifications
            </p>
            <p className="text-xs text-gray-500 print:text-black">
              {comments.length} characters
            </p>
          </div>
        </>
      )}
    </div>
  );
}

