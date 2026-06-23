# Recipient-Based Sharing — Architecture & Design Proposal

> **Status:** Design Document
> **Project:** SecureShare+
> **Date:** $(date +%Y-%m-%d)
> **Context:** This is an *addition* to the existing link-based sharing model, not a replacement.
> 
> **Key Architectural Decision:** Two-phase rollout. Phase 1 = same key for all recipients (out-of-band). Phase 2 = per-recipient RSA-wrapped keys (full PKI). Skip password-wrapped key approach entirely.
| Recipient search scope | Username + email + ID | UX flexibility, rate-limited to prevent enumeration |

> **Note on the key question:** In Phase 1, **all recipients receive the same AES-256 decryption key.** The file is encrypted once, uploaded once, and the single key is delivered out-of-band by the sender to all recipients. This is a deliberate trade-off to ship fast — the per-recipient key separation comes in Phase 2 with RSA key wrapping.
| Download limit model | Global (shared between link + recipients) | Prevents bypass via multiple access methods |
| New tables vs. modifying existing | New tables | Cleaner separation of concerns, no migration needed |
| Username vs. UUID in URLs | UUID internally, username for display | Prevents username changes from breaking references |
### 8.4 What is the safest architecture?

**Phase 1 (Option A)**, with these additional safeguards:

1. **Rate-limit recipient discovery** to prevent username enumeration.
2. **Audit logging** on all `recipient_shares` actions.
3. **Automatic expiration** tied to the parent file's expiry.
4. **Revocation** — sender can revoke a specific recipient at any time *(access-control only — doesn't invalidate key they already have)*.
5. **Limit enforcement** — recipient downloads count toward the global `download_limit`.
6. **No bulk email/username leak** — require exact match or partial match with rate limiting.
7. **Documented caveat:** All recipients share the same key. Phase 2 resolves this.
If both sender and recipient are authenticated users:
- The **authentication** replaces the share password.
- The recipient is known (verified via Supabase Auth).
- Access control is enforced through `recipient_shares` + the existing `request-download` Edge Function.
- The share-level password becomes redundant.

**For link-based shares (non-registered recipients):** Password protection is still available as an option.

**Result for Phase 1:** For registered-to-registered sharing, the friction goes from:
> "Share link + password + decryption key" → **"Share decryption key (out-of-band)"**

**Important:** The same key is shared with all recipients. If key separation is needed, it's Phase 2.
### 8.2 How should decryption keys be handled?

**Phase 1: Same key for all (out-of-band).**
- Sender copies the **single key** on upload (same as today).
- Platform shows the key alongside recipient names.
- Sender communicates the **same key** to all recipients through any existing channel (messaging, email, in-person).
- **The platform never stores the key.**
- **Downside:** No per-recipient key separation. A compromised recipient can re-share the key.

**Phase 2: RSA key wrapping (per-recipient).**
- Sender's browser wraps the AES-256 key with **each recipient's RSA public key**.
- Each recipient gets a uniquely wrapped key ciphertext stored in `recipient_shares.wrapped_key`.
- Recipients unwrap using their RSA private key (stored locally, encrypted with their auth password).
- **The platform stores only ciphertext — cannot unwrap.**
- **Benefit:** Per-recipient key separation. Revocation is cryptographic. Audit trail on key access.

**Excluded approach — Password-wrapped per-recipient keys (Option 2):**
Rejected by design. All the complexity of per-recipient key management (generate/store/deliver N wrapped key blobs) without the actual advantages of asymmetric cryptography. Worst complexity-to-benefit ratio.
│  ○ I will share the decryption key           │
│    separately. All recipients get the        │
│    same key. (Phase 1 — recommended)         │
│  ○ Share key through platform                │
│    (per-recipient RSA-wrapped keys.          │
1. All recipients share the **same key** (no per-recipient separation).
2. If the sender loses the key, the file is unrecoverable by anyone.
3. No persistent relationship between sender and recipient.
4. No access revocation (link is live until expiry/limit).

| Phase | Model | Key Delivery | Per-Recipient Keys? | Crypto | When |
|---|---|---|---|---|---|
| **1** | Option A — Platform-Enhanced Out-of-Band | Sender shares same key through their own channel | ❌ All recipients get the same key | None needed | **Ship now** |
| **2** | Option B — RSA Key Wrapping | Each recipient's public key wraps the AES key | ✅ Each recipient gets uniquely wrapped key | RSA-OAEP (asymmetric) | Future |

**Explicitly excluded:** Option 2 (password-wrapped per-recipient keys). It combines the complexity of per-recipient key management with none of the actual cryptographic guarantees of PKI. Highest complexity-to-benefit ratio. Rejected.

### Phase 1: Out-of-Band (same key for all)

Platform handles recipient discovery, share routing, access control, and notifications. Sender delivers the **same AES-256 key** to all recipients through their own channel. This gets us 80% of the UX improvement with zero new cryptographic complexity.

**Why start here:**
- The current flow already requires out-of-band key delivery.
- Adding recipient discovery and platform routing eliminates 2 of 3 manual steps (link + password are now handled) — only the key remains.
- No new cryptographic primitives to audit.
- No private key management UX to design.
- Can be shipped quickly.

**Important caveat:** All recipients share the same key. There is no per-recipient audit trail on key leaks. Revocation is not cryptographic — it's access-control only (removing the recipient from `recipient_shares` prevents future downloads, but doesn't invalidate a key they already possess).

### Phase 2: RSA Key Wrapping (per-recipient keys)

When the sender shares a file, the sender's browser encrypts the AES-256 key with **each recipient's RSA public key**. Each recipient gets their own uniquely wrapped key ciphertext stored on the platform. Recipients use their RSA private key to unwrap on their browser.

**Why wait for Phase 2:**
- Requires full RSA keypair lifecycle: generation, secure storage (IndexedDB encrypted with auth password), recovery, rotation.
- Private key loss = all previously shared files permanently inaccessible. This UX needs careful design.
- Higher implementation complexity — worth doing right, not rushing.

**Result:** When Phase 2 ships, senders can optionally use "platform key delivery" for recipients who have set up keypairs. Per-recipient key separation is achieved cryptographically.

### Password Elimination

Once users are authenticated on both sides:

- **The authentication itself replaces the share password.** Since both sender and recipient are known to the platform, the share-level password becomes redundant *for recipient shares*.
- The link-based flow (for non-registered recipients) retains the password option.
- **Result:** For registered-to-registered sharing, the friction goes from:
  > "Share link + password + decryption key" → **"Share decryption key (out-of-band)"**