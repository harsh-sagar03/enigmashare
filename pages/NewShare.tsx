import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { useEncryption } from '../hooks/useEncryption';
import { generateShortId, getExpiryMinutes } from '../lib/utils';
import type { Profile } from '../types/database';
import RecipientSearchModal from '../components/recipient/RecipientSearchModal';
import { FiUpload, FiFile, FiX, FiClock, FiDownload, FiLock, FiShield, FiCopy, FiCheck, FiAlertCircle, FiInfo, FiUserPlus, FiUsers, FiLink2, FiMail } from 'react-icons/fi';

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.scr', '.pif', '.vbs'];
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB

type ShareMode = 'user' | 'link' | null;

interface SelectedFile {
  file: File;
  id: string;
}

type Step = 'select' | 'mode' | 'configure' | 'uploading' | 'result';

export default function NewShare() {
  const [step, setStep] = useState<Step>('select');
  const [mode, setMode] = useState<ShareMode>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expiry, setExpiry] = useState('24h');
  const [customExpiry, setCustomExpiry] = useState('');
  const [downloadLimit, setDownloadLimit] = useState(5);
  const [password, setPassword] = useState('');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [recipients, setRecipients] = useState<Profile[]>([]);
  const [showRecipientSearch, setShowRecipientSearch] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { generateKey, encryptBlob } = useEncryption();

  const validateFiles = (files: File[]): File[] => {
    const valid: File[] = [];
    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        setError(`File type "${ext}" is not allowed for security reasons.`);
        return valid;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 150MB size limit.`);
        return valid;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleFiles = (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    const valid = validateFiles(fileArray);
    if (valid.length === 0) return;

    setSelectedFiles((prev) => [
      ...prev,
      ...valid.map((file) => ({ file, id: crypto.randomUUID() })),
    ]);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleModeSelect = (selectedMode: ShareMode) => {
    setMode(selectedMode);
    setStep('configure');
    if (selectedMode === 'user') {
      // Reset password when in user mode
      setPasswordEnabled(false);
      setPassword('');
    } else {
      // Reset recipients when in link mode
      setRecipients([]);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!mode) return;
    setError(null);

    // Validate password for public link mode
    if (mode === 'link' && passwordEnabled && password.length > 0 && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    // Validate at least one recipient for user mode
    if (mode === 'user' && recipients.length === 0) {
      setError('Please select at least one recipient.');
      return;
    }

    // ── Auth check ──────────────────────────────────────────────────────
    setStatusMessage('Verifying session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        setError('Your session has expired. Please sign in again.');
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────

    setStep('uploading');
    setProgress(0);
    setStatusMessage('Zipping files...');

    try {
      // 1. Zip files client-side
      const zip = new JSZip();
      for (const { file } of selectedFiles) {
        zip.file(file.name, file);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setProgress(15);

      // 2. Generate encryption key
      setStatusMessage('Generating encryption key...');
      const key = await generateKey();
      setDecryptionKey(key);
      setProgress(25);

      // 3. Encrypt the zip
      setStatusMessage('Encrypting file...');
      const encryptedBlob = await encryptBlob(zipBlob, key);
      setProgress(40);

      // 4. Create DB record via Edge Function
      setStatusMessage('Creating share record...');
      const storagePath = `${generateShortId()}.enc`;
      const fileNames = selectedFiles.map((f) => f.file.name);
      const originalName = fileNames.length === 1
        ? fileNames[0]
        : `EnigmaShare-${fileNames.length}-files.zip`;

      const expiryMinutes = customExpiry
        ? parseInt(customExpiry, 10)
        : getExpiryMinutes(expiry);
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('request-upload', {
        body: {
          storagePath,
          originalName,
          fileNames,
          fileSize: encryptedBlob.size,
          expiresAt,
          downloadLimit,
          // Only send password if in public link mode with password enabled
          password: mode === 'link' && passwordEnabled && password ? password : null,
          // Only send recipients if in user mode
          recipientIds: mode === 'user' ? recipients.map((r) => r.id) : [],
        },
      });

      if (uploadError) {
        console.error('request-upload invocation error:', uploadError);
        let errorMessage = uploadError.message || 'Failed to create share';
        try {
          if (typeof uploadError.context?.json === 'function') {
            const ctx = await uploadError.context.json();
            errorMessage = ctx.error || ctx.message || errorMessage;
          }
        } catch {}
        throw new Error(errorMessage);
      }
      setProgress(60);

      // 5. Upload encrypted blob
      setStatusMessage('Uploading encrypted file...');
      const { error: storageError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, encryptedBlob, {
          contentType: 'application/octet-stream',
          upsert: false,
        });

      if (storageError) throw new Error('Failed to upload encrypted file. Please try again.');
      setProgress(85);

      // 6. Confirm upload
      setStatusMessage('Finalizing...');
      await supabase.functions.invoke('confirm-upload', {
        body: { fileId: uploadData.fileId },
      });
      setProgress(100);

      // 7. Show result — different content based on mode
      const link = `${window.location.origin}/share/${uploadData.fileId}`;
      setShareLink(link);
      setRecipientCount(uploadData.recipientCount || 0);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('configure');
    }
  };

  const copyToClipboard = async (text: string, type: 'link' | 'key') => {
    await navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedKey(true);
      setKeyConfirmed(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  useEffect(() => {
    if (step === 'result' && !keyConfirmed) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [step, keyConfirmed]);

  const resetForm = () => {
    setSelectedFiles([]);
    setMode(null);
    setStep('select');
    setError(null);
    setProgress(0);
    setShareLink('');
    setDecryptionKey('');
    setPassword('');
    setPasswordEnabled(false);
    setRecipients([]);
    setRecipientCount(0);
    setDownloadLimit(5);
    setExpiry('24h');
    setKeyConfirmed(false);
  };

  const stepNumber = () => {
    if (step === 'select' || step === 'mode') return 1;
    if (step === 'configure') return 2;
    if (step === 'uploading') return 3;
    return 4;
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">New Share</h1>
        <p className="text-foreground/50 text-sm mt-1">Upload and encrypt files to share securely</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                s === stepNumber()
                  ? 'bg-accent text-white'
                  : s < stepNumber()
                  ? 'bg-accent/20 text-accent'
                  : 'bg-muted text-foreground/30'
              }`}
            >
              {s < stepNumber() ? <FiCheck className="w-4 h-4" /> : s === 4 && step === 'result' ? <FiCheck className="w-4 h-4" /> : s}
            </div>
            {s < 4 && <div className={`w-6 h-px rounded ${s < stepNumber() ? 'bg-accent/40' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* STEP 1: Select Files */}
      {step === 'select' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40 hover:bg-muted/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <FiUpload className="w-10 h-10 text-foreground/20 mx-auto mb-4" />
            <p className="font-heading font-semibold mb-1">Drop files here or click to browse</p>
            <p className="text-sm text-foreground/40">Maximum 150MB total. Executable files (.exe, .bat, etc.) are blocked.</p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-foreground/50">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</p>
              {selectedFiles.map(({ file, id }) => (
                <div key={id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <FiFile className="w-4 h-4 text-foreground/30 shrink-0" />
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <span className="text-xs text-foreground/40">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                    className="p-1 rounded-lg text-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
                    aria-label={`Remove ${file.name}`}
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setStep('mode')}
                className="w-full mt-4 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Choose Mode */}
      {step === 'mode' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground/50 mb-4">Choose how to share your file(s)</p>

          <button
            onClick={() => handleModeSelect('user')}
            className="w-full text-left p-5 rounded-2xl border-2 border-border hover:border-accent/40 hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-all duration-200">
                <FiUsers className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold text-base mb-1">Send to Platform User</h3>
                <p className="text-sm text-foreground/50">
                  Share with registered EnigmaShare users. They'll find the file in their dashboard.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">No password needed</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Delivered to inbox</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Key out-of-band</span>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleModeSelect('link')}
            className="w-full text-left p-5 rounded-2xl border-2 border-border hover:border-accent/40 hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-all duration-200">
                <FiLink2 className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold text-base mb-1">Create Public Link</h3>
                <p className="text-sm text-foreground/50">
                  Generate a shareable link for anyone — even if they don't have an account.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Optional password</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Anyone with link can access</span>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStep('select')}
            className="w-full py-2.5 rounded-xl border border-border text-foreground/60 font-medium text-sm hover:bg-muted transition-all duration-200 cursor-pointer mt-2"
          >
            Back
          </button>
        </div>
      )}

      {/* STEP 3: Configure */}
      {step === 'configure' && (
        <div className="space-y-6">
          {/* Mode indicator */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border text-sm">
            {mode === 'user' ? (
              <>
                <FiUsers className="w-4 h-4 text-accent" />
                <span className="text-foreground/60">Sending to <strong className="text-foreground">platform user{recipients.length !== 1 ? 's' : ''}</strong></span>
              </>
            ) : (
              <>
                <FiLink2 className="w-4 h-4 text-accent" />
                <span className="text-foreground/60">Creating a <strong className="text-foreground">public link</strong></span>
              </>
            )}
            <button
              onClick={() => { setMode(null); setStep('mode'); }}
              className="ml-auto text-xs text-foreground/40 hover:text-foreground hover:bg-muted px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Expiry */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2.5">
              <FiClock className="w-4 h-4 text-foreground/30" />
              Expiration Time
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '1h', label: '1 Hour' },
                { value: '24h', label: '24 Hours' },
                { value: '7d', label: '7 Days' },
                { value: '30d', label: '30 Days' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setExpiry(opt.value); setCustomExpiry(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer ${
                    expiry === opt.value && !customExpiry
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-foreground/50 hover:border-accent/40 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="number"
                min="1"
                max="43200"
                value={customExpiry}
                onChange={(e) => { setCustomExpiry(e.target.value); setExpiry(''); }}
                placeholder="Custom (minutes)"
                className="w-full px-4 py-2 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 text-sm"
              />
            </div>
          </div>

          {/* Download limit */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2.5">
              <FiDownload className="w-4 h-4 text-foreground/30" />
              Download Limit
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={downloadLimit}
              onChange={(e) => setDownloadLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-4 py-2 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 text-sm"
            />
          </div>

          {/* Password — only for public link mode */}
          {mode === 'link' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2.5">
                <FiLock className="w-4 h-4 text-foreground/30" />
                Password Protection
                <span className="text-xs text-foreground/30 font-normal">(recommended)</span>
              </label>
              <div className="flex items-center gap-3 mb-2.5">
                <button
                  onClick={() => setPasswordEnabled(!passwordEnabled)}
                  className={`relative w-10 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                    passwordEnabled ? 'bg-accent' : 'bg-muted'
                  }`}
                  role="switch"
                  aria-checked={passwordEnabled}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                      passwordEnabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-foreground/50">{passwordEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              {passwordEnabled && (
                <>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a password for this link"
                    className="w-full px-4 py-2 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 text-sm"
                  />
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                      <FiAlertCircle className="w-3 h-3" />
                      Password must be at least 8 characters
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Recipient Selection — only for user mode */}
          {mode === 'user' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2.5">
                <FiUsers className="w-4 h-4 text-foreground/30" />
                Recipients
                <span className="text-xs text-foreground/30 font-normal">(required)</span>
              </label>
              <button
                onClick={() => setShowRecipientSearch(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground/60 hover:text-foreground hover:bg-muted hover:border-accent/40 transition-all duration-200 cursor-pointer text-sm"
              >
                <FiUserPlus className="w-4 h-4" />
                {recipients.length > 0
                  ? `${recipients.length} recipient${recipients.length !== 1 ? 's' : ''} selected`
                  : 'Search and add recipients'}
              </button>
              {recipients.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {recipients.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-sm"
                      >
                        <span className="text-accent text-xs font-medium">@{r.username}</span>
                        <button
                          onClick={() => setRecipients((prev) => prev.filter((p) => p.id !== r.id))}
                          className="p-0.5 rounded text-accent/50 hover:text-accent transition-all duration-200 cursor-pointer"
                          aria-label={`Remove ${r.username}`}
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-foreground/40 mt-2 flex items-center gap-1.5">
                    <FiInfo className="w-3 h-3" />
                    Recipients see the file in their dashboard. Share the decryption key separately.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border text-sm">
            <div className="flex items-center gap-2 mb-2 text-foreground/40">
              <FiInfo className="w-4 h-4" />
              Summary
            </div>
            <p className="text-foreground/60">
              Sharing <strong className="text-foreground">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}</strong>
              {' \u00b7 '}expires in{' '}
              <strong className="text-foreground">
                {customExpiry
                  ? `${customExpiry} minutes`
                  : expiry === '1h' ? '1 hour' : expiry === '24h' ? '24 hours' : expiry === '7d' ? '7 days' : '30 days'}
              </strong>
              {' \u00b7 '}max <strong className="text-foreground">{downloadLimit} download{downloadLimit !== 1 ? 's' : ''}</strong>
              {mode === 'link' && passwordEnabled && ' \u00b7 password protected'}
              {mode === 'user' && recipients.length > 0 && ` \u00b7 ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('mode')}
              className="flex-1 py-2.5 rounded-xl border border-border text-foreground/60 font-medium text-sm hover:bg-muted transition-all duration-200 cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleUpload}
              disabled={mode === 'user' && recipients.length === 0}
              className="flex-[2] py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {mode === 'user'
                ? `Encrypt & Send to ${recipients.length} Recipient${recipients.length !== 1 ? 's' : ''}`
                : 'Encrypt & Create Link'}
            </button>
          </div>
        </div>
      )}

      {/* UPLOADING */}
      {step === 'uploading' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-6" />
          <h3 className="font-heading font-semibold text-lg mb-2">{statusMessage}</h3>
          <div className="max-w-xs mx-auto mt-6">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-foreground/40 mt-2">{progress}%</p>
          </div>
        </div>
      )}

      {/* RESULT */}
      {step === 'result' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <FiShield className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">Share Created!</h3>
            <p className="text-foreground/50 text-sm max-w-sm mx-auto">
              Your file has been encrypted and uploaded.
              {mode === 'user' && recipientCount > 0
                ? ` ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''} will find it in their dashboard.`
                : mode === 'link'
                ? ' Share the link and decryption key through separate channels.'
                : ''}
            </p>
          </div>

          {!keyConfirmed && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Copy your decryption key below before leaving.</strong> It will not be shown again, and without it your recipient cannot decrypt the file.
              </span>
            </div>
          )}

          {/* Only show share link for public link mode */}
          {mode === 'link' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Share Link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground text-sm truncate"
                />
                <button
                  onClick={() => copyToClipboard(shareLink, 'link')}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
                >
                  {copiedLink ? <FiCheck className="w-4 h-4 text-accent" /> : <FiCopy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Message for user mode - no link */}
          {mode === 'user' && (
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <div className="flex items-start gap-3">
                <FiMail className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Delivered to dashboard</p>
                  <p className="text-xs text-foreground/50">
                    Your recipient{recipientCount !== 1 ? 's' : ''} will see this file in their Incoming tab when they log in.
                    No link or password needed — just share the decryption key through a separate channel.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Decryption Key{' '}
              <span className="text-destructive text-xs font-normal">(share this separately!)</span>
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={decryptionKey}
                className="flex-1 px-4 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-foreground text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(decryptionKey, 'key')}
                className="px-4 py-2.5 rounded-xl border border-border text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
              >
                {copiedKey ? <FiCheck className="w-4 h-4 text-accent" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-destructive/70 mt-1.5 flex items-center gap-1.5">
              <FiAlertCircle className="w-3 h-3" />
              Never share the decryption key through the same channel as the link.
            </p>
            {mode === 'user' && (
              <p className="text-xs text-foreground/50 mt-1.5 flex items-center gap-1.5">
                <FiInfo className="w-3 h-3" />
                All {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} receive the same key.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2.5 rounded-xl border border-border text-foreground/60 font-medium text-sm hover:bg-muted transition-all duration-200 cursor-pointer"
            >
              Share Another
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-[2] py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Recipient Search Modal */}
      <RecipientSearchModal
        isOpen={showRecipientSearch}
        onClose={() => setShowRecipientSearch(false)}
        onConfirm={(selected) => setRecipients(selected)}
        selectedRecipients={recipients}
      />
    </div>
  );
}