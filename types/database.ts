export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RecipientAccessStatus =
  | 'pending'
  | 'active'
  | 'revoked'
  | 'expired'
  | 'download_limit_reached';

export type NotificationType =
  | 'new_share'
  | 'share_downloaded'
  | 'share_expiring'
  | 'share_expired'
  | 'access_revoked';

export type SharedFileStatus = 'active' | 'expired' | 'limit_reached';

export interface Database {
  public: {
    Tables: {
      shared_files: {
        Row: {
          id: string;
          owner_id: string;
          storage_path: string;
          original_name: string;
          file_names: string[];
          file_size: number;
          expires_at: string;
          download_limit: number;
          download_count: number;
          password_hash: string | null;
          status: string;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          storage_path: string;
          original_name: string;
          file_names?: string[];
          file_size: number;
          expires_at: string;
          download_limit: number;
          download_count?: number;
          password_hash?: string | null;
          status?: string;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          storage_path?: string;
          original_name?: string;
          file_names?: string[];
          file_size?: number;
          expires_at?: string;
          download_limit?: number;
          download_count?: number;
          password_hash?: string | null;
          status?: string;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipient_shares: {
        Row: {
          id: string;
          file_id: string;
          sender_id: string;
          recipient_id: string;
          access_status: RecipientAccessStatus;
          shared_at: string;
          first_accessed_at: string | null;
          last_accessed_at: string | null;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          sender_id: string;
          recipient_id: string;
          access_status?: RecipientAccessStatus;
          shared_at?: string;
          first_accessed_at?: string | null;
          last_accessed_at?: string | null;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          sender_id?: string;
          recipient_id?: string;
          access_status?: RecipientAccessStatus;
          shared_at?: string;
          first_accessed_at?: string | null;
          last_accessed_at?: string | null;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipient_shares_file_id_fkey';
            columns: ['file_id'];
            isOneToOne: false;
            referencedRelation: 'shared_files';
            referencedColumns: ['id'];
          },
        ];
      };
      share_notifications: {
        Row: {
          id: string;
          user_id: string;
          share_id: string | null;
          notif_type: NotificationType;
          title: string;
          body: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          share_id?: string | null;
          notif_type: NotificationType;
          title: string;
          body?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          share_id?: string | null;
          notif_type?: NotificationType;
          title?: string;
          body?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'share_notifications_share_id_fkey';
            columns: ['share_id'];
            isOneToOne: false;
            referencedRelation: 'recipient_shares';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

export type SharedFile = Database['public']['Tables']['shared_files']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type RecipientShare = Database['public']['Tables']['recipient_shares']['Row'];
export type ShareNotification = Database['public']['Tables']['share_notifications']['Row'];

// Extended types for joined queries
export interface RecipientShareWithProfile extends RecipientShare {
  recipient?: Pick<Profile, 'id' | 'username' | 'display_name'>;
  file?: Pick<SharedFile, 'original_name' | 'file_size' | 'expires_at'>;
}

export interface IncomingShareWithDetails {
  id: string;
  file_id: string;
  sender_id: string;
  access_status: RecipientAccessStatus;
  shared_at: string;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
  download_count: number;
  sender?: Pick<Profile, 'id' | 'username' | 'display_name'>;
  file?: Pick<SharedFile, 'original_name' | 'file_names' | 'file_size' | 'expires_at' | 'download_limit' | 'download_count' | 'status'>;
}
