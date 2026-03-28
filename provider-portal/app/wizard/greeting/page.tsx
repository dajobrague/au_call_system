'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';
import { Loader2, Mic } from 'lucide-react';

const MAX_GREETING_LENGTH = 150;

const field =
  'w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20';

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

  useEffect(() => {
    const wizardState = getWizardState();
    if (!wizardState.plan?.planRecordId) {
      router.replace('/wizard/plan');
      return;
    }

    if (wizardState.business?.providerName) {
      setProviderName(wizardState.business.providerName);
    }

    if (wizardState.greeting?.greetingText) {
      setGreetingText(wizardState.greeting.greetingText);
      setSkipGreeting(false);
    } else {
      setSkipGreeting(false);
    }
  }, [router]);

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

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setLastGeneratedText(greetingText);
      setHasPlayedAudio(false);
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
    setHasPlayedAudio(true);
  };

  const handleUseSample = () => {
    const sampleText = `Welcome to ${providerName || '[Your Organization]'}. Please enter your employee PIN to continue.`;
    setGreetingText(sampleText);
    setSkipGreeting(false);
    setAudioUrl(null);
    setHasPlayedAudio(false);
  };

  const handleTextChange = (newText: string) => {
    setGreetingText(newText);
    if (audioUrl && newText !== lastGeneratedText) {
      setAudioUrl(null);
      setHasPlayedAudio(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (skipGreeting || !greetingText.trim()) {
      saveWizardState({
        greeting: {
          greetingText: '',
        },
        currentStep: 6,
      });
      router.push('/wizard/transfer');
      return;
    }

    if (greetingText.length > MAX_GREETING_LENGTH) {
      setError(`Greeting must be ${MAX_GREETING_LENGTH} characters or less`);
      return;
    }

    saveWizardState({
      greeting: {
        greetingText: greetingText.trim(),
      },
      currentStep: 6,
    });

    router.push('/wizard/transfer');
  };

  const remainingChars = MAX_GREETING_LENGTH - greetingText.length;

  return (
    <WizardLayout>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          IVR greeting
        </h2>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
          Create a greeting message for your voice system (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3">
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
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="skipGreeting" className="text-sm text-foreground">
              <span className="font-medium">Skip for now</span>
              <span className="text-muted-foreground">
                {' '}
                (I&apos;ll add this later)
              </span>
            </label>
          </div>

          {!skipGreeting && (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="greetingText"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Greeting text
                  </label>
                  <button
                    type="button"
                    onClick={handleUseSample}
                    className="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    Use sample
                  </button>
                </div>
                <textarea
                  id="greetingText"
                  value={greetingText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={4}
                  maxLength={MAX_GREETING_LENGTH}
                  className={`${field} resize-none`}
                  placeholder="Enter your greeting message..."
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground/70">
                    This message will be played when callers reach your system
                  </p>
                  <p
                    className={`text-xs ${
                      remainingChars < 20
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {remainingChars} characters remaining
                  </p>
                </div>
              </div>

              <div>
                {!audioUrl ? (
                  <button
                    type="button"
                    onClick={handleGenerateAudio}
                    disabled={isGenerating || !greetingText.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating audio…
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5" strokeWidth={2} />
                        Generate &amp; preview audio
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200/60">
                            Ready
                          </span>
                          <span className="text-sm font-semibold text-emerald-900">
                            Audio ready — listen below
                          </span>
                        </div>
                        {hasPlayedAudio && (
                          <span className="text-emerald-600" aria-hidden>
                            ✓
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handlePlayAudio}
                        disabled={isPlaying}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:bg-emerald-500"
                      >
                        {isPlaying ? 'Playing…' : 'Play greeting'}
                      </button>
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={handleAudioEnded}
                        className="hidden"
                      />
                    </div>

                    {greetingText !== lastGeneratedText && (
                      <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3">
                        <p className="mb-2 text-xs text-amber-900">
                          Text has changed. Regenerate audio to hear the updated
                          version.
                        </p>
                        <button
                          type="button"
                          onClick={handleGenerateAudio}
                          disabled={isGenerating}
                          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          Regenerate audio
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={
                !skipGreeting && (!greetingText.trim() || !hasPlayedAudio)
              }
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                !skipGreeting && !greetingText.trim()
                  ? 'Please enter a greeting or check "Skip for now"'
                  : !skipGreeting && !hasPlayedAudio
                    ? 'Please listen to the greeting audio before proceeding'
                    : ''
              }
            >
              Next: Transfer number
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}
