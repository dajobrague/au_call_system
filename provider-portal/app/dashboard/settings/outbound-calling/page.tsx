/**
 * Outbound Calling Settings Page
 * Configure outbound calling feature for SMS follow-up
 */

'use client';

import { useEffect, useState } from 'react';
import { Phone, Clock, MessageSquare, Loader2, Check, Save, AlertCircle, Info } from 'lucide-react';

interface ProviderData {
  id: string;
  fields: {
    'Name': string;
    'Provider ID': number;
    'Outbound Call Enabled'?: boolean;
    'Outbound Call Wait Minutes'?: number;
    'Outbound Call Max Rounds'?: number;
    'Outbound Call Message Template'?: string;
  };
}

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'employeeName', description: 'Staff member first name', example: 'Sarah' },
  { name: 'patientName', description: 'Patient full name (privacy safe)', example: 'John S.' },
  { name: 'date', description: 'Shift date (short format)', example: 'Jan 23' },
  { name: 'time', description: 'Shift start time', example: '9:00 AM' },
  { name: 'startTime', description: 'Shift start time (24h)', example: '09:00' },
  { name: 'endTime', description: 'Shift end time (24h)', example: '17:00' },
  { name: 'suburb', description: 'Location suburb', example: 'Sydney CBD' },
];

const DEFAULT_TEMPLATE = 'Hi {employeeName}, we have an urgent shift for {patientName} on {date} at {time}. It\'s in {suburb}. Press 1 to accept this shift, or press 2 to decline.';

export default function OutboundCallingPage() {
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [enabled, setEnabled] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(15);
  const [maxRounds, setMaxRounds] = useState(3);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  
  // Template builder state
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showVariables, setShowVariables] = useState(false);
  
  useEffect(() => {
    fetchProviderSettings();
  }, []);
  
  const fetchProviderSettings = async () => {
    try {
      const response = await fetch('/api/provider/outbound-calling');
      const data = await response.json();
      
      if (data.success && data.provider) {
        setProvider(data.provider);
        setEnabled(data.provider.fields['Outbound Call Enabled'] || false);
        setWaitMinutes(data.provider.fields['Outbound Call Wait Minutes'] || 15);
        setMaxRounds(data.provider.fields['Outbound Call Max Rounds'] || 3);
        setMessageTemplate(data.provider.fields['Outbound Call Message Template'] || DEFAULT_TEMPLATE);
      } else {
        setError('Failed to load outbound calling settings');
      }
    } catch {
      setError('An error occurred while loading settings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    // Validation
    if (waitMinutes < 1 || waitMinutes > 120) {
      setError('Wait time must be between 1 and 120 minutes');
      return;
    }
    
    if (maxRounds < 1 || maxRounds > 5) {
      setError('Max rounds must be between 1 and 5');
      return;
    }
    
    if (!messageTemplate.trim()) {
      setError('Message template cannot be empty');
      return;
    }
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/provider/outbound-calling', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          waitMinutes,
          maxRounds,
          messageTemplate: messageTemplate.trim(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setProvider(data.provider);
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newText = before + `{${variable}}` + after;
    setMessageTemplate(newText);
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length + 2; // +2 for {}
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
    
    setShowVariables(false);
  };
  
  const previewMessage = () => {
    let preview = messageTemplate;
    TEMPLATE_VARIABLES.forEach(v => {
      preview = preview.replace(new RegExp(`\\{${v.name}\\}`, 'g'), v.example);
    });
    return preview;
  };
  
  const calculateTotalCalls = () => {
    // This would come from the actual staff pool size
    // For now, show a formula
    return `Staff Pool Size × ${maxRounds} rounds`;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Outbound Calling Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure automated phone calls to staff when SMS messages are not responded to
        </p>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
          <Check className="w-5 h-5" />
          <span>Outbound calling settings updated successfully!</span>
        </div>
      )}
      
      {/* Feature Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">How Outbound Calling Works</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>After Wave 3 SMS is sent with no acceptance, system waits the configured time</li>
              <li>System automatically calls each staff member in the pool (in order)</li>
              <li>Staff member hears a personalized message and can press 1 to accept or 2 to decline</li>
              <li>If declined or no answer, system calls the next person in the pool</li>
              <li>Process continues for the configured number of rounds</li>
              <li>If someone accepts, all remaining calls are cancelled and confirmation SMS is sent</li>
            </ol>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Enable/Disable Feature */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center h-6">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="enabled" className="text-base font-semibold text-gray-900 cursor-pointer">
                Enable Outbound Calling
              </label>
              <p className="text-sm text-gray-600 mt-1">
                When enabled, system will automatically call staff members after Wave 3 SMS if no one responds.
                {!enabled && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    ⚠️  Feature is currently disabled. Enable it to use outbound calling.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        
        {/* Configuration Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timing & Attempts Configuration
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="waitMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                Wait Time After Wave 3 (minutes) *
              </label>
              <input
                type="number"
                id="waitMinutes"
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(parseInt(e.target.value) || 15)}
                min="1"
                max="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                disabled={!enabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                How long to wait after Wave 3 SMS before starting calls (1-120 minutes)
              </p>
            </div>
            
            <div>
              <label htmlFor="maxRounds" className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Rounds *
              </label>
              <input
                type="number"
                id="maxRounds"
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value) || 3)}
                min="1"
                max="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                disabled={!enabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                How many times to call each staff member (1-5 rounds)
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-700">
              <strong>Maximum possible calls:</strong> {calculateTotalCalls()}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Example: If you have 4 staff in the pool and set {maxRounds} rounds, the system will make up to {4 * maxRounds} calls total.
            </p>
          </div>
        </div>
        
        {/* Message Template Builder */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Call Message Template
          </h2>
          
          <p className="text-sm text-gray-600">
            Customize the message that will be spoken to staff members. Click variables below to insert them.
          </p>
          
          {/* Variable Buttons */}
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => insertVariable(variable.name)}
                disabled={!enabled}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={`${variable.description} (e.g., ${variable.example})`}
              >
                + {variable.name}
              </button>
            ))}
          </div>
          
          {/* Template Textarea */}
          <div>
            <label htmlFor="messageTemplate" className="block text-sm font-medium text-gray-700 mb-1">
              Message Template *
            </label>
            <textarea
              id="messageTemplate"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
              placeholder="Enter your message template using the variables above..."
              required
              disabled={!enabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables like {'{employeeName}'} will be replaced with actual values when calling.
            </p>
          </div>
          
          {/* Preview */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Message Preview</h3>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {previewMessage()}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This is how the message will sound with example data.
            </p>
          </div>
          
          {/* Reset to Default */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMessageTemplate(DEFAULT_TEMPLATE)}
              disabled={!enabled}
              className="text-sm text-blue-600 hover:text-blue-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset to default template
            </button>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
