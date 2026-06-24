<div align="center">

# EnigmaShare

### Privacy-First Secure File Sharing Platform

Share files securely through encrypted links or direct recipient sharing with client-side encryption, download controls, and zero-knowledge storage.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql)

</div>

---

## Overview

EnigmaShare is a secure file-sharing platform designed around a simple principle:

> Files should remain private even from the platform storing them.

Unlike traditional cloud-sharing solutions, files are encrypted **before leaving the user's browser**. The server only stores encrypted data and metadata required to manage sharing.

Users can:

- Create secure share links
- Share files directly with registered users
- Protect links with passwords
- Limit downloads
- Set automatic expirations
- Track recipient access activity

The result is a modern, privacy-focused file-sharing experience built with React, TypeScript, and Supabase.

---

## Key Features

### Client-Side Encryption

Every file is encrypted locally using **AES-256-GCM** before upload.

- Encryption occurs entirely in the browser
- Decryption occurs entirely in the browser
- Encryption keys are never stored on the server
- Files remain encrypted at rest

---

### Secure Link Sharing

Generate secure shareable links with configurable controls.

Features include:

- Public share links
- Password protection
- Expiration dates
- Download limits
- Automatic share invalidation

---

### Direct Recipient Sharing

Share files directly with registered users.

Capabilities:

- Recipient selection
- Access tracking
- Recipient-specific permissions
- Access status monitoring
- Download activity logging

---

### Activity Dashboard

Manage all sharing activity from a centralized dashboard.

Track:

- Created shares
- Incoming shares
- Download counts
- Share status
- Recipient access history
- Expiration state

---

### Notification System

Built-in notifications for important sharing events.

Examples:

- New file shared
- File accessed
- Download completed
- Access revoked
- Share expired

---

## Security Architecture

### Encryption Flow

```text
User File
    │
    ▼
AES-256-GCM Encryption
    │
    ▼
Encrypted Blob
    │
    ▼
Supabase Storage
    │
    ▼
Secure Share Access
    │
    ▼
Client-Side Decryption
```

### Password Protection

Password-protected links use:

- PBKDF2 key derivation
- Random cryptographic salts
- 100,000 hashing iterations
- Secure hash storage

Passwords are never stored in plaintext.

---

## Sharing Modes

### Link Sharing

```text
Upload File
    ↓
Encrypt
    ↓
Store Encrypted File
    ↓
Generate Share Link
    ↓
Recipient Downloads
    ↓
Decrypt Locally
```

### Direct Sharing

```text
Upload File
    ↓
Encrypt
    ↓
Select Recipients
    ↓
Create Share Records
    ↓
Send Notifications
    ↓
Recipient Access
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|----------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| React Router | Routing |
| Tailwind CSS | Styling |
| React Icons | Icon Library |

### Backend

| Technology | Purpose |
|------------|----------|
| Supabase | Backend Platform |
| PostgreSQL | Database |
| Edge Functions | Serverless Logic |
| Supabase Storage | File Storage |

### Security

| Technology | Purpose |
|------------|----------|
| AES-256-GCM | File Encryption |
| Web Crypto API | Cryptographic Operations |
| PBKDF2 | Password Hashing |
| RLS | Database Security |

---

## Database Design

The application is centered around four primary entities.

### `shared_files`

Stores file metadata and sharing configuration.

Responsibilities:

- Share ownership
- Download limits
- Expiration tracking
- Share status
- Storage references

---

### `recipient_shares`

Stores recipient-specific access records.

Responsibilities:

- Access control
- Download tracking
- Recipient status
- Share activity

---

### `profiles`

Stores user profile information.

Responsibilities:

- Identity management
- User discovery
- Recipient selection

---

### `share_notifications`

Stores notification events.

Responsibilities:

- Activity feeds
- Share alerts
- Download notifications

---

## Project Structure

```text
enigmashare/
│
├── assets/
├── components/
│   ├── recipient/
│   ├── Layout.tsx
│   ├── NotificationBell.tsx
│   └── ProtectedRoute.tsx
│
├── db/
├── docs/
├── hooks/
│   └── useEncryption.ts
│
├── lib/
│   ├── constants.ts
│   ├── supabase.ts
│   └── utils.ts
│
├── pages/
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── NewShare.tsx
│   └── SharePage.tsx
│
├── types/
├── App.tsx
├── main.tsx
└── README.md
```

---

## Local Development

### Clone Repository

```bash
git clone https://github.com/harsh-sagar03/enigmashare.git
cd enigmashare
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

### Start Development Server

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Notable Implementation Details

### Atomic Download Consumption

Download limits are enforced through an atomic PostgreSQL update strategy.

Benefits:

- Race-condition safe
- Concurrent request safe
- Prevents download limit bypass
- Single-query enforcement

---

### Zero-Knowledge Storage

The server never receives:

- Unencrypted file contents
- User encryption keys
- Decrypted file data

Only encrypted blobs and sharing metadata are stored.

---

### Signed URL Access

File downloads use short-lived signed URLs.

Features:

- Time-limited access
- Storage isolation
- Reduced attack surface
- Controlled download permissions

---

## Future Enhancements

- Folder sharing
- Team workspaces
- Share analytics
- File previews
- Email notifications
- Audit logging
- File version history

---

## Author

**Harsh Sagar**

GitHub: https://github.com/harsh-sagar03

---

## License

This project is released for educational, portfolio, and learning purposes.