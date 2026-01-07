'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';

const MAX_GREETING_LENGTH = 150;

export default function WizardGreetingPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [greetingText, setGreetingText] = useState('');
  const [lastGeneratedText, setLastGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [error, setError] = useState('');
  const [skipGreeting, setSkipGreeting] = useState(false);
  const [providerName, setProviderName] = useState('');

  // Load saved state
  useEffect(() => {
    const wizardState = getWizardState();
    
    // Get provider name for sample text
    if (wizardState.business?.providerName) {
      setProviderName(wizardState.business.providerName);
    }
    
    if (wizardState.greeting?.greetingText) {
      setGreetingText(wizardState.greeting.greetingText);
      setSkipGreeting(false);
    } else {
      setSkipGreeting(false); // Changed: not checked by default
    }
  }, []);

  const handleBack = () => {
    router.push('/wizard/logo');
  };

  const handleGenerateAudio = async () => {
    if (!greetingText.trim()) {
      setError('Please enter greeting text');
      return;
    }

    setIsGenerating(true);
    setError('');
    setAudioUrl(null);

    try {
      const response = await fetch('/api/wizard/generate-greeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: greetingText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate audio');
      }

      // Create audio blob URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setLastGeneratedText(greetingText);
      setHasPlayedAudio(false); // Reset played status for new audio
    } catch (err) {
      console.error('Failed to generate audio:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setHasPlayedAudio(true); // Mark as played
  };

  const handleUseSample = () => {
    const sampleText = `Welcome to ${providerName || '[Your Organization]'}. Please enter your employee PIN to continue.`;
    setGreetingText(sampleText);
    setSkipGreeting(false);
    setAudioUrl(null); // Reset audio when text changes
    setHasPlayedAudio(false);
  };
  
  const handleTextChange = (newText: string) => {
    setGreetingText(newText);
    // If text changed significantly, reset audio
    if (audioUrl && newText !== lastGeneratedText) {
      setAudioUrl(null);
      setHasPlayedAudio(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // If skipping or no greeting, save empty state and continue
    if (skipGreeting || !greetingText.trim()) {
      saveWizardState({
        greeting: {
          greetingText: '',
        },
        currentStep: 4,
      });
      router.push('/wizard/transfer');
      return;
    }

    // Validate greeting length
    if (greetingText.length > MAX_GREETING_LENGTH) {
      setError(`Greeting must be ${MAX_GREETING_LENGTH} characters or less`);
      return;
    }

    // Save to wizard state
    saveWizardState({
      greeting: {
        greetingText: greetingText.trim(),
      },
      currentStep: 4,
    });

    // Navigate to next step
    router.push('/wizard/transfer');
  };

  const remainingChars = MAX_GREETING_LENGTH - greetingText.length;

  return (
    <WizardLayout>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          IVR Greeting
        </h2>
        <p className="text-gray-600 mb-6">
          Create a greeting message for your voice system (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Skip Greeting Checkbox */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="skipGreeting"
                type="checkbox"
                checked={skipGreeting}
                onChange={(e) => {
                  setSkipGreeting(e.target.checked);
                  if (e.target.checked) {
                    setGreetingText('');
                    setAudioUrl(null);
                    setError('');
                  }
                }}
                className="w-4 h-4 text-[#bd1e2b] border-gray-300 rounded focus:ring-[#bd1e2b]"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="skipGreeting" className="font-medium text-gray-700">
                Skip for now (I'll add this later)
              </label>
            </div>
          </div>

          {/* Greeting Text Input */}
          {!skipGreeting && (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label
                    htmlFor="greetingText"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Greeting Text
                  </label>
                  <button
                    type="button"
                    onClick={handleUseSample}
                    className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
                  >
                    Use Sample
                  </button>
                </div>
                <textarea
                  id="greetingText"
                  value={greetingText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={4}
                  maxLength={MAX_GREETING_LENGTH}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent resize-none"
                  placeholder="Enter your greeting message..."
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    This message will be played when callers reach your system
                  </p>
                  <p
                    className={`text-xs ${
                      remainingChars < 20 ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {remainingChars} characters remaining
                  </p>
                </div>
              </div>

              {/* Audio Preview/Player Button */}
              <div>
                {!audioUrl ? (
                  // Generate Audio Button
                  <button
                    type="button"
                    onClick={handleGenerateAudio}
                    disabled={isGenerating || !greetingText.trim()}
                    className="w-full px-4 py-3 bg-[#bd1e2b] text-white rounded-lg font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {isGenerating ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Generating Audio...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                        Generate & Preview Audio
                      </>
                    )}
                  </button>
                ) : (
                  // Audio Player with Regenerate Option
                  <div className="space-y-3">
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <svg
                            className="w-5 h-5 text-green-600 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-green-900">
                            Audio Ready - Click to Listen
                          </span>
                        </div>
                        {hasPlayedAudio && (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handlePlayAudio}
                        disabled={isPlaying}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-500 transition-colors flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          {isPlaying ? (
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          )}
                        </svg>
                        {isPlaying ? 'Playing...' : 'Play Greeting'}
                      </button>
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={handleAudioEnded}
                        className="hidden"
                      />
                    </div>
                    
                    {/* Regenerate Button */}
                    {greetingText !== lastGeneratedText && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800 mb-2">
                          Text has changed. Regenerate audio to hear the updated version.
                        </p>
                        <button
                          type="button"
                          onClick={handleGenerateAudio}
                          disabled={isGenerating}
                          className="w-full px-3 py-2 bg-[#bd1e2b] text-white rounded text-sm font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 transition-colors"
                        >
                          Regenerate Audio
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!skipGreeting && (!greetingText.trim() || !hasPlayedAudio)}
              className="px-6 py-3 bg-[#bd1e2b] text-white rounded-lg font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title={
                !skipGreeting && !greetingText.trim() 
                  ? 'Please enter a greeting or check "Skip for now"' 
                  : !skipGreeting && !hasPlayedAudio 
                  ? 'Please listen to the greeting audio before proceeding' 
                  : ''
              }
            >
              Next: Transfer Number
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}

