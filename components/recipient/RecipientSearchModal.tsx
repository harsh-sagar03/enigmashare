import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { FiSearch, FiX, FiUser, FiCheck, FiAlertCircle } from 'react-icons/fi';

interface RecipientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recipients: Profile[]) => void;
  selectedRecipients: Profile[];
}

export default function RecipientSearchModal({
  isOpen,
  onClose,
  onConfirm,
  selectedRecipients,
}: RecipientSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Profile[]>(selectedRecipients);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelected(selectedRecipients);
      setError(null);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('search-users', {
          body: {
            query: query.trim(),
            excludeIds: [...selected.map((p) => p.id)],
          },
        });

        if (fnError) throw new Error(fnError.message);

        setResults(data?.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setSearching(false);
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const toggleRecipient = (profile: Profile) => {
    setSelected((prev) => {
      const exists = prev.find((p) => p.id === profile.id);
      if (exists) {
        return prev.filter((p) => p.id !== profile.id);
      }
      return [...prev, profile];
    });
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConfirm = () => {
    onConfirm(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold">Share with Platform Users</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or display name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search results */}
        <div className="px-6 py-2 max-h-48 overflow-y-auto">
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => toggleRecipient(profile)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                    selected.find((p) => p.id === profile.id)
                      ? 'bg-accent/10 border border-accent/30'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <FiUser className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile.display_name || profile.username}
                    </p>
                    <p className="text-xs text-foreground/40 truncate">@{profile.username}</p>
                  </div>
                  {selected.find((p) => p.id === profile.id) ? (
                    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <FiCheck className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 && !searching ? (
            <p className="text-center text-sm text-foreground/40 py-6">No users found</p>
          ) : (
            <p className="text-center text-sm text-foreground/30 py-6">
              Type at least 2 characters to search
            </p>
          )}
        </div>

        {/* Selected recipients */}
        {selected.length > 0 && (
          <div className="px-6 py-3 border-t border-border">
            <p className="text-xs font-medium text-foreground/40 mb-2">
              Selected ({selected.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-sm"
                >
                  <span className="text-accent text-xs font-medium">
                    @{profile.username}
                  </span>
                  <button
                    onClick={() => removeSelected(profile.id)}
                    className="p-0.5 rounded text-accent/50 hover:text-accent transition-all duration-200 cursor-pointer"
                    aria-label={`Remove ${profile.username}`}
                  >
                    <FiX className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key delivery info + actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          <div className="flex items-start gap-2 mb-4 text-xs text-foreground/50">
            <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              Recipients will see this file in their dashboard. You'll still need to share the
              <strong className="text-foreground/70"> decryption key</strong> separately through
              another channel. All recipients receive the same key.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-foreground/60 font-medium text-sm hover:bg-muted transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="flex-[2] py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {selected.length === 0
                ? 'Select Recipients'
                : `Send to ${selected.length} Recipient${selected.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
