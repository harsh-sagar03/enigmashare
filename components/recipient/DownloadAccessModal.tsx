import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { supabase } from '../../lib/supabase';
import { useEncryption } from '../../hooks/useEncryption';
import { formatFileSize } from '../../lib/utils';
import type { RecipientShareWithDetails } from '../../pages/Dashboard';
import { FiX, FiDownload, FiKey, FiShield, FiCheck, FiAlertCircle, FiFile, FiUser } from 'react-icons/fi';

interface Props {
  share: RecipientShareWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalState = 'idle' | 'downloading' | 'decrypting' | 'complete' | 'error';

export default function DownloadAccessModal({ share, isOpen, onClose, onSuccess }: Props) {
  const [state, setState] = useState<ModalState>('idle');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadedFiles, setDownloadedFiles] = useState<{ name: string; blob: Blob }[]>([]);
  const { decryptBlob } = useEncryption();
  const fileIdRef = useRef<string | null>(null);

  const MAX_DECOMPRESSED_SIZE = 1024 * 1024 * 1024; // 1GB

  const reset = () => {
    setState('idle');
    setDecryptionKey('');
    setKeyError(false);
    setErrorMessage('');
    setDownloadedFiles([]);
    fileIdRef.current = null;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownload = async () => {
    if (!share?.file_id) return;

    if (!decryptionKey) {
      setKeyError(true);
      return;
    }

    setKeyError(false);
    setState('downloading');
    fileIdRef.current = share.file_id;

    try {
      // Call request-download edge function (authenticated, so no password needed for recipients)
      const { data, error } = await supabase.functions.invoke('request-download', {
        body: { fileId: share.file_id },
      });

      if (error) {
        const serverMessage = (data && typeof data === 'object' && 'error' in data)
          ? (data as any).error
          : error.message;
        throw new Error(serverMessage);
      }

      // Edge function always returns 200 — check for error in response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error((data as any).error as string);
      }

      // Fetch the encrypted blob
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

      setState('decrypting');

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
        const originalName = share.file?.original_name || 'decrypted-file';
        downloadBlob(decryptedBlob, originalName);
      }

      setState('complete');
      onSuccess();
    } catch (err) {
      let msg = 'Download failed';
      if (err instanceof Error) {
        msg = err.message;
        // Provide a friendlier message for key errors
        if (msg.includes('operation') || msg.includes('key')) {
          msg = 'Invalid decryption key. Please check and try again.';
        }
      }
      setErrorMessage(msg);
      setState('error');
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

  if (!isOpen || !share) return null;

  const file = share.file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <FiShield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-sm">Access Shared File</h2>
              <p className="text-xs text-foreground/40">Enter the decryption key to download</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
            aria-label="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* File info */}
        <div className="px-5 py-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <FiFile className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file?.original_name || 'Unknown file'}</p>
              <div className="flex items-center gap-3 text-xs text-foreground/40 mt-0.5">
                {file && <span>{formatFileSize(file.file_size)}</span>}
                {share.sender && (
                  <span className="flex items-center gap-1">
                    <FiUser className="w-3 h-3" />
                    @{share.sender.username}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {state === 'idle' && (
            <div className="space-y-4">
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
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                />
                {keyError && (
                  <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                    <FiAlertCircle className="w-3 h-3" />
                    Please enter the decryption key
                  </p>
                )}
              </div>
              <button
                onClick={handleDownload}
                className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <FiDownload className="w-4 h-4" />
                Decrypt & Download
              </button>
            </div>
          )}

          {state === 'downloading' && (
            <div className="text-center py-8">
              <div className="animate-spin w-10 h-10 border-3 border-accent/20 border-t-accent rounded-full mx-auto mb-4" />
              <p className="text-sm text-foreground/50">Downloading encrypted file...</p>
              <p className="text-xs text-foreground/30 mt-1">Large files may take a moment</p>
            </div>
          )}

          {state === 'decrypting' && (
            <div className="text-center py-8">
              <div className="animate-spin w-10 h-10 border-3 border-accent/20 border-t-accent rounded-full mx-auto mb-4" />
              <p className="text-sm text-foreground/50">Decrypting in your browser...</p>
              <p className="text-xs text-foreground/30 mt-1">End-to-end encrypted — only you can read it</p>
            </div>
          )}

          {state === 'complete' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-heading font-semibold mb-3">Decryption Complete!</h3>
              {downloadedFiles.length > 0 ? (
                <div className="space-y-2">
                  {downloadedFiles.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => downloadBlob(f.blob, f.name)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border hover:bg-muted/40 hover:border-accent/20 transition-all duration-200 cursor-pointer"
                    >
                      <FiFile className="w-4 h-4 text-foreground/30 shrink-0" />
                      <span className="text-sm truncate flex-1">{f.name}</span>
                      <FiDownload className="w-4 h-4 text-accent shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/50">File has been downloaded to your device.</p>
              )}
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-all duration-200 cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <FiAlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold mb-2">Download Failed</h3>
              <p className="text-sm text-foreground/50 mb-4">{errorMessage}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-border text-foreground/60 text-sm font-medium hover:bg-muted transition-all duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setState('idle'); setErrorMessage(''); }}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-85 transition-all duration-200 cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
