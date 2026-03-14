# CLAUDE.md — LimbeHomes Real Estate Platform

> **Project Codename:** LimbeHomes (working title — rename as needed)
> **Location Focus:** Limbe, Cameroon (with potential expansion to Buea, Douala, Yaoundé)
> **Stack:** React (frontend) · Node.js/Express (backend) · Supabase (database + storage + auth)
> **Payment:** Mobile Money (MTN/Orange via Notch Pay) · Escrow-based transaction model
> **Last Updated:** March 2026

---

## 1. Project Overview

LimbeHomes is a trusted real estate marketplace for Limbe, Cameroon. It connects:

- **Buyers/Renters** — people looking to purchase land, buy a house, or rent a home
- **Vendors** — private landowners and house sellers listing their own property for sale
- **House Agents** — professional agents listing rental properties on behalf of landlords
- **Landlords** — property owners listing rentals directly

The platform's core differentiator is a **built-in escrow payment system** that protects both parties in every transaction. Money is held by the platform and only released to the vendor/agent once the client confirms satisfaction. This mirrors how Preply holds tutor payments until a lesson is confirmed complete.

All vendors and agents must be **manually verified** by platform admins before they can post any listing — they must upload a national ID card and a selfie photo before being approved.

---

## 2. User Roles & Permissions

| Role | Description | Can Post? | Requires Verification? | Pays Registration Fee? |
|---|---|---|---|---|
| **Guest** | Browse listings only | No | No | No |
| **Buyer/Renter** | Search, shortlist, make payments | No | No | No |
| **Vendor** | Sell land or houses they own | Yes | ✅ Yes (Admin approved) | ✅ 2,000 FCFA one-time |
| **House Agent** | List rentals on behalf of landlords | Yes | ✅ Yes (Admin approved) | ✅ 2,000 FCFA one-time |
| **Landlord** | List their own rental properties | Yes | ✅ Yes (Admin approved) | ✅ 2,000 FCFA one-time |
| **Admin** | Manage all users, listings, disputes, payouts | Full access | N/A | N/A |

---

## 3. Business Model & Revenue

### 3.1 Registration Fee
- Every vendor, house agent, and landlord pays a **one-time 2,000 FCFA** registration fee before their account is submitted for admin approval.
- Payment is collected via Mobile Money (MTN/Orange through Notch Pay).
- If an account is rejected by admin, the fee is refunded.

### 3.2 Commission on Successful Transactions
- The platform takes a **10% commission** from every successful deal closed through the platform.
- **Sales (land/house):** 10% of the agreed sale price, paid by the vendor on deal confirmation.
- **Rentals:** 10% of the agent's/landlord's rental fee, deducted automatically when the escrow is released.

### 3.3 Optional Future Revenue Streams (consider for v2)
- **Featured Listings** — vendors pay to boost their listing to the top of search results
- **Premium Agent Badges** — verified badge with green checkmark for high-performing agents
- **SMS/Email Alert Subscriptions** — buyers pay for new listing notifications in their area

---

## 4. Listing Types

### 4.1 For Sale
- Land (plot, farm, commercial land)
- House / Villa
- Apartment / Flat

### 4.2 For Rent
- House
- Apartment / Flat
- Room (single rooms for rent)
- Short-term rental (weekly/monthly)

### 4.3 Listing Fields (all types)
- Title and description
- Property type (land / house / apartment / room)
- Transaction type (sale / rent)
- Price (FCFA) — for rent: specify if it's per month, per year, etc.
- Location (neighborhood, area in Limbe — e.g., Bota, Down Beach, GRA, Mabeta)
- Size (in square meters or plots for land)
- Number of bedrooms / bathrooms (for houses/apartments)
- Amenities (water supply, electricity, fenced compound, parking, borehole, generator, etc.)
- Photos (minimum 2, maximum 20)
- Videos (optional, max 2 videos, max 100MB each)
- Map pin (Google Maps or OpenStreetMap embedded location picker)
- Availability status (Available / Under Offer / Rented/Sold)
- Contact preference (in-app messaging only — phone number hidden until deal is initiated)

---

## 5. Verification & Onboarding Flow

### 5.1 Vendor/Agent/Landlord Registration Steps
1. User signs up with email + phone number
2. Selects role: Vendor / Agent / Landlord
3. Fills in profile (full name, address, brief bio)
4. Uploads:
   - Front and back of National ID Card (JPEG/PNG/PDF, max 5MB)
   - A clear selfie photo (JPEG/PNG, max 3MB)
5. Pays the 2,000 FCFA registration fee via MTN/Orange Mobile Money through Notch Pay
6. Account is placed in **"Pending Verification"** status
7. Admin reviews documents manually in the Admin Dashboard
8. Admin approves or rejects:
   - **Approved:** User gets email/SMS + can now create listings
   - **Rejected:** User gets email/SMS with reason + fee is refunded
9. Approved agents get a **"Verified Agent"** badge on their profile and listings

### 5.2 Admin Verification Dashboard
- Table of all pending verifications
- View uploaded ID and selfie side by side
- Approve / Reject buttons with optional rejection reason text field
- Audit log of who approved/rejected and when

---

## 6. Escrow Payment System

This is the **most critical feature** of the platform and must be implemented carefully.

### 6.1 How It Works (Rental Flow — Preply-style)

```
[Client selects property] 
  → [Client initiates payment via MTN/Orange Mobile Money]
    → [Payment is captured into Platform Escrow Account]
      → [Agent/Landlord is notified: "Payment secured, arrange viewing"]
        → [Client visits property / moves in]
          → [Client confirms satisfaction in-app within X days]
            → [Platform releases 90% to Agent, retains 10% commission]
```

**Automatic Release Trigger:**
- Client has **72 hours** (configurable by admin) after the agreed move-in/handover date to raise a dispute.
- If no dispute is raised in 72 hours, payment auto-releases to vendor/agent.
- This mirrors how Airbnb and Preply handle payment release.

### 6.2 How It Works (Sale Flow)

```
[Buyer & Seller agree on price via in-app chat]
  → [Buyer initiates escrow deposit (full amount or agreed deposit)]
    → [Funds held in platform account]
      → [Documents verified, property visit done]
        → [Buyer clicks "Confirm Satisfaction" in app]
          → [90% released to vendor, 10% retained by platform]
```

### 6.3 Dispute Resolution
- Either party can raise a dispute within the dispute window
- Admin is notified immediately
- Admin can: Release to buyer (refund) / Release to seller / Split
- All in-app messages serve as evidence
- Dispute resolution target: within 5 business days

### 6.4 Escrow Data Model

```sql
escrow_transactions {
  id uuid PK
  listing_id uuid FK → listings
  buyer_id uuid FK → users
  seller_id uuid FK → users
  amount_fcfa integer
  commission_amount integer  -- 10% of amount
  net_payout integer        -- 90% of amount
  status enum: [pending, held, released, disputed, refunded]
  payment_reference text    -- Notch Pay transaction reference
  held_at timestamptz
  release_deadline timestamptz
  released_at timestamptz
  dispute_raised_at timestamptz
  dispute_reason text
  dispute_resolved_at timestamptz
  resolved_by uuid FK → admin_users
  resolution text
  created_at timestamptz
}
```

### 6.5 Payment Provider
- **Notch Pay** (supports MTN Mobile Money and Orange Money in Cameroon)
- Use Notch Pay's webhook to confirm payment before setting escrow status to `held`
- Store all payment references and webhook events in the database
- Never trust payment status without webhook confirmation

---

## 7. In-App Messaging System

This is a **core feature** — clients must be able to chat directly with agents/vendors from within the platform. No phone numbers are ever shared publicly.

### 7.1 Chat Features
- Any logged-in buyer/renter can open a chat with a vendor/agent from a listing page
- Chat is tied to a **specific listing** (not a general inbox) — this keeps context clear
- Both parties can send: text messages, and image attachments (e.g., sharing additional property photos or documents)
- **Read receipts** — sender can see when message was read
- **Online/offline indicator** on agent profile
- Unread message count badge in the navigation bar
- Full chat history persisted in database (never deleted — used as evidence in disputes)

### 7.2 Language in Chat
- UI is bilingual (English + French) but chat messages are free-text — users type in whatever language they prefer
- Auto-language detection is a v2 feature

### 7.3 Phone Number Policy
- Phone numbers are **never exposed** in listings or chat UI
- If a user types a phone number pattern in chat, show a soft warning: *"For your protection, we recommend keeping all communication on-platform."* (Do not block it — just warn.)
- After a deal is confirmed and escrow is released, both parties' contact info is unlocked for that transaction

### 7.4 Notifications for Messages
- Push notification (browser/PWA) + email for new messages when recipient is offline
- SMS fallback for critical messages (e.g., escrow action required) via Africa's Talking

### 7.5 Chat Data Model

```sql
message_threads {
  id uuid PK
  listing_id uuid FK → listings
  buyer_id uuid FK → users
  seller_id uuid FK → users  -- agent/vendor/landlord
  created_at timestamptz
  last_message_at timestamptz
}

messages {
  id uuid PK
  thread_id uuid FK → message_threads
  sender_id uuid FK → users
  content text
  attachment_url text  -- optional image/doc
  is_read boolean default false
  read_at timestamptz
  created_at timestamptz
}
```

---

## 8. Search & Discovery

### 8.1 Filters
- Location (neighborhood in Limbe)
- Property type (land / house / apartment / room)
- Transaction type (sale / rent)
- Price range (min/max in FCFA)
- Number of bedrooms
- Amenities (checkboxes)
- Listing date (newest first by default)

### 8.2 Search UX
- Full-text search on title + description
- Map view (OpenStreetMap with Leaflet.js — free, no API cost)
- Grid/List toggle view
- Save/shortlist listings (for logged-in buyers)
- "Similar listings" section on each listing page

---

## 9. Admin Dashboard

### 9.1 Key Admin Capabilities
- **User Management:** View, suspend, ban, or delete any user account
- **Verification Queue:** Approve/reject pending vendor/agent registrations with ID review
- **Listings Moderation:** Remove inappropriate listings, flag suspicious prices
- **Escrow Management:** View all held funds, manually trigger releases, handle disputes
- **Commission Tracking:** Dashboard of all commissions collected, pending, released
- **Financial Reports:** Daily/monthly revenue reports (registration fees + commissions)
- **Notification Tools:** Send bulk SMS/email to all users or specific groups

### 9.2 Admin Roles (Sub-roles)
- **Super Admin** — full access including other admin management
- **Moderator** — can approve listings and handle disputes, no financial access
- **Finance Admin** — can view and manage escrow/payouts only

---

## 10. Notifications

| Trigger | Channel | Recipient |
|---|---|---|
| New listing posted | Email | Admin (moderation alert) |
| Verification approved/rejected | Email + SMS | Vendor/Agent |
| New message received | Email + In-app | Recipient |
| Payment held in escrow | Email + SMS | Agent + Buyer |
| Dispute raised | Email + SMS | Admin + both parties |
| Escrow auto-release (72h) | Email + SMS | Agent |
| Account suspended | Email | User |

Use **Africa's Talking** for SMS (strong Cameroon support, affordable) or fall back to Notch Pay's SMS API.

---

## 11. Tech Stack & Architecture

### 11.1 Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **State Management:** Zustand or React Context
- **Routing:** React Router v6
- **Map:** Leaflet.js + OpenStreetMap (free)
- **File Uploads:** Direct to Supabase Storage via signed URLs
- **Forms:** React Hook Form + Zod validation
- **Image Gallery:** Lightbox2 or Swiper.js

### 11.2 Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Auth:** Supabase Auth (email/password + phone OTP)
- **API Style:** RESTful JSON API
- **File Storage:** Supabase Storage (for property photos, videos, ID documents)
- **Queue/Jobs:** node-cron for escrow auto-release jobs
- **Validation:** Zod
- **Environment:** Railway or Render for deployment

### 11.3 Database (Supabase / PostgreSQL)
Key tables:
```
users, user_profiles, vendor_verifications
listings, listing_images, listing_videos
messages, message_threads
escrow_transactions, payout_logs
admin_users, admin_audit_logs
notifications
reviews (future)
```

### 11.4 Storage Buckets (Supabase)
- `property-images` — public bucket, listing photos
- `property-videos` — public bucket, listing videos
- `id-documents` — **private bucket**, vendor ID cards (admin access only)
- `selfies` — **private bucket**, vendor verification selfies (admin access only)

### 11.5 Row Level Security (RLS)
- All Supabase tables must have RLS enabled
- `id-documents` and `selfies` buckets: only accessible by admins and the document owner
- Listings: public read, only owner can update/delete
- Messages: only sender and receiver can read
- Escrow transactions: only buyer, seller, and admin can read

---

## 12. Security Requirements

- All API routes must be authenticated (JWT via Supabase)
- Admin routes require additional `admin` role check on every request
- ID documents stored in private Supabase bucket with RLS
- No phone numbers exposed in listings or chat (masked until deal stage)
- Input sanitization on all user-supplied content (prevent XSS/injection)
- Rate limiting on auth endpoints (prevent brute force)
- Webhook signature verification for all Notch Pay payment webhooks
- HTTPS only (enforced at hosting level)
- Audit logging for all admin actions

---

## 13. Mobile Responsiveness

The platform **must be fully mobile-first**. Most users in Limbe will access from Android phones. Design all UI components mobile-first, then scale up to desktop. Test on low-end Android devices and slow 3G connections.

- Compress all property images on upload (sharp.js or Supabase image transforms)
- Lazy-load images and videos
- Minimize JavaScript bundle size
- Offline-friendly listing browsing (basic caching with service worker — v2 feature)

---

## 14. Key Pages / Routes

```
/ ─────────────── Home (featured listings, search bar, categories)
/listings ──────── Browse all listings (with filters)
/listings/:id ──── Single listing detail page
/post-listing ──── Create new listing (requires auth + verified status)
/dashboard ─────── User dashboard (my listings, my inquiries, my deals)
/dashboard/escrow ─ Escrow status tracker for active deals
/messages ──────── In-app messaging center
/register ──────── Buyer or Vendor/Agent registration
/verify ─────────── Verification upload page (ID + selfie + fee payment)
/admin ─────────── Admin dashboard (protected)
/admin/verify ───── Verification queue
/admin/escrow ───── Escrow management
/admin/listings ─── Listings moderation
```

---

## 15. Important Business Rules

1. A vendor/agent **cannot post any listing** until admin has approved their verification.
2. The **2,000 FCFA fee is non-refundable** if rejected for fraud/fake documents. Refundable for honest rejections (e.g., blurry photo — resubmit).
3. Listings go **live instantly** once posted by a verified vendor/agent — no per-listing admin approval needed. Admin can still remove listings retroactively if reported or flagged.
4. The **10% commission is automatically deducted** from escrow on release — it never touches the agent's hands.
5. Platform holds the escrow in its own **dedicated Notch Pay business account** (not a personal account).
6. **Dispute window is 72 hours** from confirmed handover date (configurable by admin).
7. Agents/vendors can **withdraw earnings** to their MTN/Orange Mobile Money at any time after release (manual payout in v1, automated in v2).
8. A listing must include **at least 2 photos** before it can be submitted.
9. All communication must stay **on-platform** — sharing phone numbers in chat is discouraged (warn users in UI).
11. **Land/house sale payment terms are set by the vendor.** The vendor specifies their payment conditions when creating the listing (e.g., full payment upfront, 50% deposit + balance on title transfer, installment plan). The escrow system must support flexible hold amounts to match the vendor's stated conditions. The buyer must agree to the terms before initiating payment.

---

## 16. Future Features (v2 Roadmap)

- [ ] **Mobile App** (React Native — reuse existing API)
- [ ] **AI Listing Assistant** — auto-generate description from photos
- [ ] **Property Valuation Tool** — estimated price based on area + size
- [ ] **Featured/Sponsored Listings** — pay to appear at top of search
- [ ] **Saved Search Alerts** — email/SMS when matching listings appear
- [ ] **Agent Reviews & Ratings** — post-deal reviews from verified buyers
- [ ] **Landlord Portal** — landlords manage their own portfolio with multiple agents
- [ ] **Automated Escrow Payout** — automatic Mobile Money disbursement via Notch Pay API
- [ ] **Property History** — past sale prices in a neighborhood
- [ ] **Virtual Tour** — 360° photo support
- [ ] **Expansion** to Buea, Douala, Yaoundé

---

## 17. Questions Still to Clarify

The following decisions still need confirmation before or during development:

1. **Platform name & domain** — What is the final name? (e.g., LimbeHomes.com, LimbeProperty.com)
2. **Dispute window duration** — Is 72 hours right for rentals? Sales may need longer (e.g., 7 days for land/house purchases).
3. **Video hosting** — Supabase Storage directly, or Cloudflare Stream / Mux for better mobile streaming?
4. **SMS provider** — Africa's Talking or Notch Pay's built-in SMS?
5. **Listing expiry** — Should listings auto-expire after 60/90 days if the vendor doesn't renew them?
6. **Re-submission fee** — If a vendor is rejected for bad document quality and resubmits, do they pay 2,000 FCFA again?
7. **Payout schedule** — Can agents withdraw earnings anytime, or is there a weekly/monthly payout cycle?
8. **Cancellation before handover** — If a sale deal is cancelled before the property is handed over, full refund to buyer minus Notch Pay fees?

---

## 18. Development Phases

### Phase 1 — MVP (Core Platform)
- User auth (buyers + vendors/agents)
- Vendor/agent registration + verification flow (ID upload + fee payment)
- Admin verification dashboard
- Listing creation (photos, description, location, price)
- Listing browsing + search + filters
- Single listing detail page
- Basic in-app messaging

### Phase 2 — Escrow & Payments
- Notch Pay integration (Mobile Money collection)
- Escrow transaction flow (hold → confirm → release)
- Commission auto-deduction
- Dispute raising + admin dispute resolution
- Payout tracking dashboard (vendor side)

### Phase 3 — Polish & Growth
- Map view (Leaflet + OpenStreetMap)
- Notifications (email + SMS)
- Video support for listings
- Mobile responsiveness optimization
- Admin financial reports
- Reviews & ratings

---

---

## 19. Bilingual Requirements (English + French)

Cameroon is officially bilingual. Limbe is in the Anglophone Southwest Region, but the platform should serve French-speaking users from Douala, Yaoundé, and beyond as it grows.

### Implementation Approach
- Use **i18next** (React i18next) for all UI strings — every label, button, error message, and notification must have both EN and FR translations
- Language toggle in the navbar (🇬🇧 EN / 🇫🇷 FR) — persisted in localStorage and user profile
- Default language: **English** (Limbe-first launch), with French fully supported
- All system emails and SMS notifications must also be sent in the user's preferred language
- Admin dashboard: English only (v1), add French in v2
- Property descriptions and chat messages are free-text — no translation required

---

*This document should be kept up to date as the project evolves. Every major decision or change to business logic should be reflected here.*
