'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';
import { Loader2, Upload } from 'lucide-react';

export default function WizardLogoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [skipLogo, setSkipLogo] = useState(false);

  useEffect(() => {
    const wizardState = getWizardState();
    if (!wizardState.plan?.planRecordId) {
      router.replace('/wizard/plan');
      return;
    }
    if (wizardState.logo?.logoUrl) {
      setLogoPreview(wizardState.logo.logoUrl);
      setSkipLogo(false);
    } else {
      setSkipLogo(true);
    }
  }, [router]);

  const handleBack = () => {
    router.push('/wizard/business');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setLogoFile(file);
    setUploadError('');
    setSkipLogo(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsUploading(true);

    try {
      if (skipLogo || !logoFile) {
        saveWizardState({
          logo: {
            logoUrl: undefined,
            logoS3Key: undefined,
          },
          currentStep: 5,
        });
        router.push('/wizard/greeting');
        return;
      }

      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch('/api/wizard/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      saveWizardState({
        logo: {
          logoUrl: data.url,
          logoS3Key: data.key,
        },
        currentStep: 5,
      });

      router.push('/wizard/greeting');
    } catch (err) {
      console.error('Failed to upload logo:', err);
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
      setIsUploading(false);
    }
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Upload your logo
        </h2>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
          Add your organization&apos;s logo (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3">
            <input
              id="skipLogo"
              type="checkbox"
              checked={skipLogo}
              onChange={(e) => {
                setSkipLogo(e.target.checked);
                if (e.target.checked) {
                  handleRemoveLogo();
                }
              }}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="skipLogo" className="text-sm text-foreground">
              <span className="font-medium">Skip for now</span>
              <span className="text-muted-foreground">
                {' '}
                (I&apos;ll add this later)
              </span>
            </label>
          </div>

          {!skipLogo && (
            <div>
              {!logoPreview ? (
                <div className="rounded-lg border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center transition-colors hover:border-primary/40">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="logoUpload"
                  />
                  <label
                    htmlFor="logoUpload"
                    className="flex cursor-pointer flex-col items-center"
                  >
                    <Upload
                      className="mb-3 h-12 w-12 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="font-medium text-primary">
                      Click to upload
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      PNG, JPG, GIF up to 5MB
                    </span>
                  </label>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-24 w-24 rounded-md border border-border/60 object-contain"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {logoFile?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {logoFile &&
                            `${(logoFile.size / 1024).toFixed(1)} KB`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-sm font-medium text-destructive hover:text-destructive/80"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={isUploading}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Next: Greeting'
              )}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}
