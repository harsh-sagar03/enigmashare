import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { SharedFile, Profile, RecipientShare } from '../types/database';
import { formatFileSize, formatExpiry } from '../lib/utils';
import { FiUpload, FiTrash2, FiClock, FiDownload, FiShield, FiCopy, FiCheck, FiInbox, FiUser, FiX, FiAlertCircle, FiEye, FiRefreshCw, FiUsers, FiLink2 } from 'react-icons/fi';
import DownloadAccessModal from '../components/recipient/DownloadAccessModal';

type DashboardTab = 'outgoing' | 'incoming';

interface RecipientShareWithDetails extends RecipientShare {
  recipient?: Pick<Profile, 'id' | 'username' | 'display_name'>;
  file?: Pick<SharedFile, 'original_name' | 'file_names' | 'file_size' | 'expires_at' | 'download_limit' | 'download_count' | 'status'>;
  sender?: Pick<Profile, 'id' | 'username' | 'display_name'>;
}

export type { RecipientShareWithDetails };

export default function Dashboard() {
  const [tab, setTab] = useState<DashboardTab>('outgoing');
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [incomingShares, setIncomingShares] = useState<RecipientShareWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingShare, setDownloadingShare] = useState<RecipientShareWithDetails | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }
    setUserId(session.user.id);
    fetchFiles(session.user.id);
    fetchIncomingShares();
  };

  const fetchFiles = async (uid?: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = uid || session?.user.id;

    const query = supabase
      .from('shared_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (currentUserId) {
      query.eq('owner_id', currentUserId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setFiles(data as SharedFile[]);
    }
    setLoading(false);
  };

  const fetchIncomingShares = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: shares, error } = await supabase
      .from('recipient_shares')
      .select('*')
      .eq('recipient_id', session.user.id)
      .order('shared_at', { ascending: false });

    if (error || !shares) return;

    const senderIds = [...new Set(shares.map(s => s.sender_id))];
    const { data: senders } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', senderIds.length > 0 ? senderIds : ['00000000-0000-0000-0000-000000000000']);
    const senderMap = new Map((senders || []).map(s => [s.id, s]));

    const fileIds = [...new Set(shares.map(s => s.file_id))];
    const { data: files } = await supabase
      .from('shared_files')
      .select('id, original_name, file_names, file_size, expires_at, download_limit, download_count, status')
      .in('id', fileIds.length > 0 ? fileIds : ['00000000-0000-0000-0000-000000000000']);
    const fileMap = new Map((files || []).map(f => [f.id, f]));

    const merged = shares.map(share => ({
      ...share,
      sender: senderMap.get(share.sender_id) || null,
      file: fileMap.get(share.file_id) || null,
    }));

    setIncomingShares(merged as unknown as RecipientShareWithDetails[]);
  };

  const handleCopyLink = async (fileId: string) => {
    const link = `${window.location.origin}/share/${fileId}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(fileId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this share? The file will be permanently removed.')) return;

    setDeleting(fileId);
    setDeleteError(null);

    try {
      const supabaseUrl = 'https://eaquwvcumdgwuacoiexa.supabase.co';
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to delete files.');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-share`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ fileId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete share');
      }

      // Only remove from local state on confirmed success
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setDeleteError(message);
      console.error('handleDelete error:', message);
    } finally {
      setDeleting(null);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Revoke access for this recipient? They will no longer be able to download the file.')) return;

    const { error } = await supabase
      .from('recipient_shares')
      .update({ access_status: 'revoked' })
      .eq('id', shareId);

    if (!error) {
      fetchIncomingShares();
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const now = new Date();
    const expired = new Date(expiresAt) <= now;

    if (expired || status === 'expired') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">Expired</span>;
    }
    if (status === 'limit_reached') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Limit Reached</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">Active</span>;
  };

  const getAccessStatusBadge = (share: RecipientShareWithDetails) => {
    const { access_status, first_accessed_at } = share;
    const isNew = !first_accessed_at && access_status === 'active';

    switch (access_status) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5">
            {isNew && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent text-white uppercase leading-none">New</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">Active</span>
          </div>
        );
      case 'revoked':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">Revoked</span>;
      case 'expired':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive/60 border border-destructive/20">Expired</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/40 border border-border">{access_status}</span>;
    }
  };

  const getModeBadge = (file: SharedFile) => {
    const hasRecipients = incomingShares.some(s => s.file_id === file.id);
    // Check if this file has recipient_shares records
    // For now, a simple heuristic: if password_hash is set, it's link mode
    if (file.password_hash) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <FiLink2 className="w-2.5 h-2.5" /> Link
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
        <FiUsers className="w-2.5 h-2.5" /> Direct
      </span>
    );
  };

  const unreadCount = incomingShares.filter(s => !s.first_accessed_at && s.access_status === 'active').length;
  if (loading && tab === 'outgoing' && files.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-foreground/50 text-sm mt-1">Manage your shared files</p>
        </div>
        <Link
          to="/share/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-85 transition-all duration-200 cursor-pointer"
        >
          <FiUpload className="w-4 h-4" />
          New Share
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-border">
        <button
          onClick={() => setTab('outgoing')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 cursor-pointer ${
            tab === 'outgoing'
              ? 'border-accent text-foreground'
              : 'border-transparent text-foreground/40 hover:text-foreground hover:border-border'
          }`}
        >
          <FiUpload className="w-4 h-4" />
          My Shares
          {files.length > 0 && (
            <span className="text-xs text-foreground/30 ml-1">({files.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 cursor-pointer ${
            tab === 'incoming'
              ? 'border-accent text-foreground'
              : 'border-transparent text-foreground/40 hover:text-foreground hover:border-border'
          }`}
        >
          <FiInbox className="w-4 h-4" />
          Incoming
          {incomingShares.length > 0 && (
            <span className="text-xs text-foreground/30 ml-1">({incomingShares.length})</span>
          )}
          {unreadCount > 0 && (
            <span className="ml-1 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'outgoing' && (
        <>
          {files.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/20">
              <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FiShield className="w-7 h-7 text-foreground/20" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">No shared files yet</h3>
              <p className="text-foreground/50 text-sm mb-6">Create your first secure share to get started.</p>
              <Link
                to="/share/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-85 transition-all duration-200 cursor-pointer"
              >
                <FiUpload className="w-4 h-4" />
                Share a File
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => {
                const isExpired = new Date(file.expires_at) <= new Date();
                return (
                  <div
                    key={file.id}
                    className="group p-5 rounded-2xl bg-muted/20 backdrop-blur-sm border border-border hover:bg-muted/40 hover:border-accent/20 transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {getModeBadge(file)}
                          <h3 className="font-heading font-semibold truncate">{file.original_name}</h3>
                          {getStatusBadge(file.status, file.expires_at)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/40">
                          <span className="flex items-center gap-1.5">
                            <FiDownload className="w-3 h-3" />
                            {file.download_count}/{file.download_limit} downloads
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FiClock className="w-3 h-3" />
                            {formatExpiry(file.expires_at)}
                          </span>
                          <span>{formatFileSize(file.file_size)}</span>
                          <span className="text-foreground/30">{file.file_names.length} file{file.file_names.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!file.password_hash && (
                          <button
                            onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
                            title="View recipients"
                          >
                            <FiUsers className="w-3.5 h-3.5" />
                            Recipients
                          </button>
                        )}
                        {file.password_hash && (
                          <button
                            onClick={() => handleCopyLink(file.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
                            title="Copy share link"
                          >
                            {copiedId === file.id ? (
                              <><FiCheck className="w-3.5 h-3.5 text-accent" /> Copied</>
                            ) : (
                              <><FiCopy className="w-3.5 h-3.5" /> Copy Link</>
                            )}
                          </button>
                        )}
                        {userId === file.owner_id && !isExpired && file.status === 'active' && (
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={deleting === file.id}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 cursor-pointer ${
                              deleting === file.id
                                ? 'border-accent/30 text-accent/50 bg-muted/30'
                                : 'border-border text-foreground/40 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10'
                            }`}
                            title="Delete share"
                          >
                            {deleting === file.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FiTrash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'incoming' && (
        <>
          {incomingShares.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/20">
              <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FiInbox className="w-7 h-7 text-foreground/20" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">No incoming shares</h3>
              <p className="text-foreground/50 text-sm mb-6">When someone shares a file with you, it will appear here.</p>
              <p className="text-xs text-foreground/30">Ask the sender to share the decryption key through a separate channel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingShares.map((share) => {
                const isNew = !share.first_accessed_at && share.access_status === 'active';
                const isExpired = share.file && new Date(share.file.expires_at) <= new Date();
                return (
                  <div
                    key={share.id}
                    className={`p-5 rounded-2xl backdrop-blur-sm border transition-all duration-200 ${
                      isNew
                        ? 'bg-accent/[0.04] border-accent/20'
                        : 'bg-muted/20 border-border hover:bg-muted/40 hover:border-accent/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {isNew && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent text-white uppercase leading-none">New</span>
                          )}
                          <h3 className={`font-heading font-semibold truncate ${isNew ? 'text-foreground' : ''}`}>
                            {share.file?.original_name || 'Unknown file'}
                          </h3>
                          {getAccessStatusBadge(share)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/40">
                          <span className="flex items-center gap-1.5">
                            <FiUser className="w-3 h-3" />
                            From: <span className="font-medium text-foreground/60">@{share.sender?.username || 'unknown'}</span>
                          </span>
                          {share.file && (
                            <>
                              <span className="flex items-center gap-1.5">
                                <FiDownload className="w-3 h-3" />
                                {share.download_count}/{share.file.download_limit} downloads
                              </span>
                              <span className="flex items-center gap-1.5">
                                <FiClock className="w-3 h-3" />
                                {formatExpiry(share.file.expires_at)}
                              </span>
                              <span>{formatFileSize(share.file.file_size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(share.access_status === 'active' && share.file?.status === 'active' && !isExpired) ? (
                          <button
                            onClick={() => setDownloadingShare(share)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-85 transition-all duration-200 cursor-pointer"
                          >
                            <FiDownload className="w-4 h-4" />
                            Download
                          </button>
                        ) : share.access_status === 'revoked' ? (
                          <span className="text-xs text-destructive/60 flex items-center gap-1 px-3 py-1.5">
                            <FiX className="w-3 h-3" />
                            Access revoked
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/40 flex items-center gap-1 px-3 py-1.5">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                    {share.first_accessed_at && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-[10px] text-foreground/30">
                        <span className="flex items-center gap-1">
                          <FiEye className="w-2.5 h-2.5" />
                          First accessed: {new Date(share.first_accessed_at).toLocaleString()}
                        </span>
                        {share.last_accessed_at && share.last_accessed_at !== share.first_accessed_at && (
                          <span className="flex items-center gap-1">
                            <FiRefreshCw className="w-2.5 h-2.5" />
                            Last accessed: {new Date(share.last_accessed_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Download Access Modal */}
      <DownloadAccessModal
        share={downloadingShare}
        isOpen={!!downloadingShare}
        onClose={() => setDownloadingShare(null)}
        onSuccess={() => {
          fetchIncomingShares();
        }}
      />

      {/* Delete error toast */}
      {deleteError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-destructive/20 border border-destructive/30 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{deleteError}</p>
            <button
              onClick={() => setDeleteError(null)}
              className="ml-2 text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}