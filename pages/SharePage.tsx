import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { useEncryption } from '../hooks/useEncryption';
import { formatFileSize } from '../lib/utils';
import { FiShield, FiDownload, FiLock, FiKey, FiAlertCircle, FiCheck, FiFile } from 'react-icons/fi';

interface FileMetadata {
  id: string;
  originalName: string;
  fileNames: string[];
  fileSize: number;
  hasPassword: boolean;
  isAuthorizedRecipient: boolean;
  status: string;
  downloadCount: number;
  downloadLimit: number;
}

type PageState = 'loading' | 'password' | 'ready' | 'downloading' | 'decrypting' | 'complete' | 'error';

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState(() => sessionStorage.getItem(`share_pw_${id}`) || '');
  const [passwordError, setPasswordError] = useState(false);
  const [decryptionKey, setDecryptionKey] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadedFiles, setDownloadedFiles] = useState<{ name: string; blob: Blob }[]>([]);
  const { decryptBlob } = useEncryption();

  const MAX_DECOMPRESSED_SIZE = 1024 * 1024 * 1024; // 1GB limit for zip bomb protection

  useEffect(() => {
    if (!id) return;
    loadMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadMetadata = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('file-info', {
        body: { fileId: id },
      });

      if (error) throw new Error(error.message);

      if (data.status !== 'active') {
        setErrorMessage(
          data.status === 'expired' || data.status === 'limit_reached'
            ? 'This file is no longer available. It may have expired or reached its download limit.'
            : 'This file could not be found.'
        );
        setPageState('error');
        return;
      }

      setMetadata(data);

      if (data.isAuthorizedRecipient) {
        // Mode 1: Authorized recipient — redirect to dashboard for download
        // The dashboard's Incoming tab + DownloadAccessModal handles the full flow
        navigate('/dashboard', { replace: true });
        return;
      } else if (data.hasPassword) {
        setPageState('password');
      } else {
        setPageState('ready');
      }
    } catch {
      setErrorMessage('Could not load file information.');
      setPageState('error');
    }
  };

  // Silently refreshes metadata without changing page state
  const refreshMetadata = async () => {
    try {
      const { data } = await supabase.functions.invoke('file-info', {
        body: { fileId: id },
      });
      if (data) setMetadata(data);
    } catch {
      // Silently ignore
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password || !id) return;

    try {
      const { data, error } = await supabase.functions.invoke('request-download', {
        body: { fileId: id, password, validateOnly: true },
      });

      const serverError = data && typeof data === 'object' && 'error' in data ? (data as any).error : null;

      if (error || serverError) {
        setPasswordError(true);
        return;
      }

      setPasswordError(false);
      sessionStorage.setItem(`share_pw_${id}`, password);
      setPageState('ready');
    } catch {
      setPasswordError(true);
    }
  };

  const handleDownload = async () => {
    if (!id) return;

    if (!decryptionKey) {
      setKeyError(true);
      return;
    }

    setPageState('downloading');

    try {
      const storedPassword = password || sessionStorage.getItem(`share_pw_${id}`) || undefined;

      const { data, error } = await supabase.functions.invoke('request-download', {
        body: { fileId: id, password: storedPassword },
      });

      if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
        throw new Error((data as any).error);
      }
      if (error) {
        throw new Error(error.message);
      }

      let encryptedBlob: Blob;
      if (data.downloadUrl) {
        const response = await fetch(data.downloadUrl);
        if (!response.ok) throw new Error('Download failed');
        encryptedBlob = await response.blob();
      } else if (data.encryptedBase64) {
        const binaryStr = atob(data.encryptedBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        encryptedBlob = new Blob([bytes]);
      } else {
        throw new Error('No download data received');
      }

      setPageState('decrypting');

      // Decrypt
      const decryptedBlob = await decryptBlob(encryptedBlob, decryptionKey);

      // Try to unzip
      let files: { name: string; blob: Blob }[] = [];
      let isZip = false;
      try {
        const zip = await JSZip.loadAsync(decryptedBlob);
        const promises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            promises.push(
              zipEntry.async('blob').then((blob) => {
                files.push({ name: relativePath, blob });
              })
            );
          }
        });

        await Promise.all(promises);
        isZip = true;

        const totalSize = files.reduce((sum, f) => sum + f.blob.size, 0);
        if (totalSize > MAX_DECOMPRESSED_SIZE) {
          files.forEach((f) => URL.revokeObjectURL(URL.createObjectURL(f.blob)));
          files = [];
          throw new Error('Decompressed file size exceeds the 1 GB safety limit.');
        }

        setDownloadedFiles(files);

        if (files.length === 1) {
          downloadBlob(files[0].blob, files[0].name);
        }
      } catch (err) {
        if (isZip) throw err;
        // Not a zip — download as-is
        const originalName = metadata?.originalName || 'decrypted-file';
        downloadBlob(decryptedBlob, originalName.replace('.enc', ''));
      }

      setPageState('complete');
      setKeyError(false);

      refreshMetadata();
    } catch (err) {
      let detailedMessage = 'Download failed';

      if (err instanceof Error) {
        detailedMessage = err.message;
        if (detailedMessage.includes('operation') || detailedMessage.includes('key') || detailedMessage.includes('decrypt')) {
          detailedMessage = 'Invalid decryption key. Please check and try again.';
        }
      } else if (typeof err === 'object' && err !== null && 'context' in err) {
        try {
          const ctx = (err as any).context;
          if (typeof ctx?.json === 'function') {
            const parsed = await ctx.json();
            detailedMessage = parsed.error || parsed.message || 'Download failed';
          }
        } catch { /* ignore */ }
      }

      setErrorMessage(`Download failed: ${detailedMessage}`);
      setPageState('error');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">File Unavailable</h1>
          <p className="text-foreground/50 mb-6">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'password') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <FiLock className="w-6 h-6 text-accent" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Password Required</h1>
            <p className="text-foreground/50 text-sm mt-1.5">
              This file is password protected. Enter the password to continue.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              className={`w-full px-4 py-2.5 rounded-xl border ${
                passwordError ? 'border-destructive' : 'border-border'
              } bg-muted/50 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200`}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            {passwordError && (
              <p className="text-destructive text-sm flex items-center gap-1.5">
                <FiAlertCircle className="w-3.5 h-3.5" />
                Incorrect password
              </p>
            )}
            <button
              onClick={handlePasswordSubmit}
              className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <FiShield className="w-6 h-6 text-accent" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Secure Download</h1>
          {metadata && (
            <p className="text-foreground/50 text-sm mt-1.5">
              {metadata.originalName} · {formatFileSize(metadata.fileSize)}
            </p>
          )}
          {metadata && metadata.fileNames.length > 1 && (
            <p className="text-xs text-foreground/30 mt-1">
              {metadata.fileNames.length} files bundled
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Decryption key input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
              <FiKey className="w-4 h-4 text-foreground/30" />
              Decryption Key
            </label>
            <input
              type="text"
              value={decryptionKey}
              onChange={(e) => { setDecryptionKey(e.target.value); setKeyError(false); }}
              placeholder="Enter the decryption key from the sender"
              className={`w-full px-4 py-2.5 rounded-xl border ${
                keyError ? 'border-destructive' : 'border-border'
              } bg-muted/50 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-mono text-sm`}
            />
            {keyError && (
              <p className="text-destructive text-xs mt-1.5">Please enter the decryption key</p>
            )}
          </div>

          {pageState === 'downloading' || pageState === 'decrypting' ? (
            <div className="text-center py-10">
              <div className="animate-spin w-10 h-10 border-3 border-accent/20 border-t-accent rounded-full mx-auto mb-4" />
              <p className="text-sm text-foreground/50">
                {pageState === 'downloading' ? 'Downloading encrypted file...' : 'Decrypting in your browser...'}
              </p>
              <p className="text-xs text-foreground/30 mt-1">Large files may take a moment</p>
            </div>
          ) : pageState === 'complete' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-heading font-semibold mb-3">Decryption Complete!</h3>
              {downloadedFiles.length > 0 ? (
                <div className="space-y-2">
                  {downloadedFiles.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => downloadBlob(file.blob, file.name)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border hover:bg-muted/40 hover:border-accent/20 transition-all duration-200 cursor-pointer"
                    >
                      <FiFile className="w-4 h-4 text-foreground/30 shrink-0" />
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <FiDownload className="w-4 h-4 text-accent shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/50">File has been downloaded to your device.</p>
              )}
            </div>
          ) : (
            <button
              onClick={handleDownload}
              className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Download & Decrypt
            </button>
          )}

          {metadata && (
            <div className="flex items-center justify-center gap-4 text-xs text-foreground/30 pt-2">
              <span>{formatFileSize(metadata.fileSize)} encrypted</span>
              <span>{metadata.downloadCount}/{metadata.downloadLimit} downloads</span>
              {metadata.hasPassword && (
                <span className="flex items-center gap-1">
                  <FiLock className="w-3 h-3" /> Password protected
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}