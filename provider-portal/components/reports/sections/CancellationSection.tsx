/**
 * Shift Cancellation Workflow Section
 */

import type { ShiftCancellation } from '@/lib/daily-report-aggregation';
import { UserX, UserCheck, Phone, User, Calendar, MessageSquare, Users, CheckCircle2, XCircle } from 'lucide-react';

interface CancellationSectionProps {
  cancellations: ShiftCancellation[];
}

export default function CancellationSection({ cancellations }: CancellationSectionProps) {
  if (cancellations.length === 0) {
    return (
      <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
        <h2 className="text-xl font-bold text-foreground mb-4 print:text-black">
          Shift Cancellation Workflow
        </h2>
        <p className="text-muted-foreground print:text-black">No shift cancellations during this period.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-foreground mb-4 print:text-black">
        Shift Cancellation Workflow
      </h2>
      
      <div className="space-y-6">
        {cancellations.map((cancellation) => (
          <div key={cancellation.cancellationId} className="border border-border/60 rounded-lg p-4 print:border-black">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground print:text-black">
                Cancellation #{cancellation.cancellationId}
              </h3>
              <span className={`text-xs px-2 py-1 rounded print:bg-muted print:text-black ${
                cancellation.finalOutcome === 'Filled' 
                  ? 'bg-green-100 text-green-700' 
                  : cancellation.finalOutcome === 'Not Filled'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {cancellation.finalOutcome}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <UserX className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Cancelled By:</span>
                  <span className="ml-2 text-foreground print:text-black">{cancellation.cancelledBy}</span>
                </div>
              </div>
              
              {cancellation.pickedUpBy && (
                <div className="flex items-start gap-2">
                  <UserCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0 print:text-black" />
                  <div>
                    <span className="font-medium text-foreground/80 print:text-black">Picked Up By:</span>
                    <span className="ml-2 text-foreground print:text-black">{cancellation.pickedUpBy}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Phone Number:</span>
                  <span className="ml-2 text-foreground print:text-black">{cancellation.phoneNumber}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Participant:</span>
                  <span className="ml-2 text-foreground print:text-black">{cancellation.participant}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Shift Time:</span>
                  <span className="ml-2 text-foreground print:text-black">{cancellation.shiftTime}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Reason for Cancellation:</span>
                  <span className="ml-2 text-foreground print:text-black">{cancellation.reason}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                {cancellation.replacementTriggered ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0 print:text-black" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0 print:text-black" />
                )}
                <div>
                  <span className="font-medium text-foreground/80 print:text-black">Replacement Workflow Triggered:</span>
                  <span className="ml-2 text-foreground print:text-black">
                    {cancellation.replacementTriggered ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              {cancellation.replacementTriggered && (
                <>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 print:text-black" />
                    <div>
                      <span className="font-medium text-foreground/80 print:text-black">Staff Pool Contacted:</span>
                      <span className="ml-2 text-foreground print:text-black">
                        {cancellation.staffContacted} staff at {cancellation.contactedAt}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pl-6 border-l-2 border-border/60 print:border-black">
                    <p className="font-medium text-foreground/80 mb-2 print:text-black">Responses:</p>
                    {cancellation.responses.length > 0 ? (
                      <ul className="space-y-1">
                        {cancellation.responses.map((response, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-foreground print:text-black">
                            <span className="font-medium">{response.staffName}</span>
                            <span className="text-muted-foreground print:text-black">—</span>
                            <span className={`${
                              response.response.includes('Accepted') ? 'text-green-600 print:text-black' :
                              response.response.includes('Declined') ? 'text-red-600 print:text-black' :
                              'text-muted-foreground print:text-black'
                            }`}>
                              {response.response}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm print:text-black">No responses recorded</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

