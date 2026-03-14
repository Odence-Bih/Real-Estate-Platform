-- ============================================
-- LimbeHomes Database Schema
-- Run this in Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ============================================

-- 1. User Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'vendor', 'agent', 'landlord', 'admin')) DEFAULT 'buyer',
  bio TEXT,
  address TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'fr')),
  verification_status TEXT DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Vendor Verifications table
CREATE TABLE IF NOT EXISTS vendor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  id_card_front_url TEXT NOT NULL,
  id_card_back_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  registration_fee_paid BOOLEAN DEFAULT false,
  payment_reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS vendor_verifications_updated_at ON vendor_verifications;
CREATE TRIGGER vendor_verifications_updated_at
  BEFORE UPDATE ON vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_verifications ENABLE ROW LEVEL SECURITY;

-- User profiles: anyone can read public info, only owner can update their own
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Vendor verifications: owner can read their own, admins can read all
DROP POLICY IF EXISTS "Users can view own verification" ON vendor_verifications;
CREATE POLICY "Users can view own verification"
  ON vendor_verifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own verification" ON vendor_verifications;
CREATE POLICY "Users can insert own verification"
  ON vendor_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all verifications" ON vendor_verifications;
CREATE POLICY "Admins can view all verifications"
  ON vendor_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update verifications" ON vendor_verifications;
CREATE POLICY "Admins can update verifications"
  ON vendor_verifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Admin Audit Logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('land', 'house', 'apartment', 'room')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'rent')),
  price INTEGER NOT NULL,
  price_period TEXT CHECK (price_period IN ('total', 'per_month', 'per_year', 'per_week')),
  location TEXT NOT NULL,
  neighborhood TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  size_sqm DOUBLE PRECISION,
  bedrooms INTEGER,
  bathrooms INTEGER,
  amenities TEXT[] DEFAULT '{}',
  payment_terms TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'under_offer', 'rented', 'sold')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Listing Images table
CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Triggers for listings
DROP TRIGGER IF EXISTS listings_updated_at ON listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8b. Listing Videos table
CREATE TABLE IF NOT EXISTS listing_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  storage_path TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listings are viewable by everyone" ON listings;
CREATE POLICY "Listings are viewable by everyone"
  ON listings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Verified users can create listings" ON listings;
CREATE POLICY "Verified users can create listings"
  ON listings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('vendor', 'agent', 'landlord', 'admin')
        AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Owners can update own listings" ON listings;
CREATE POLICY "Owners can update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own listings" ON listings;
CREATE POLICY "Owners can delete own listings"
  ON listings FOR DELETE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Listing images are viewable by everyone" ON listing_images;
CREATE POLICY "Listing images are viewable by everyone"
  ON listing_images FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Listing owners can manage images" ON listing_images;
CREATE POLICY "Listing owners can manage images"
  ON listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Listing owners can delete images" ON listing_images;
CREATE POLICY "Listing owners can delete images"
  ON listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Listing videos are viewable by everyone" ON listing_videos;
CREATE POLICY "Listing videos are viewable by everyone"
  ON listing_videos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Listing owners can manage videos" ON listing_videos;
CREATE POLICY "Listing owners can manage videos"
  ON listing_videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Listing owners can delete videos" ON listing_videos;
CREATE POLICY "Listing owners can delete videos"
  ON listing_videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND owner_id = auth.uid()
    )
  );

-- Admins can manage all listings
DROP POLICY IF EXISTS "Admins can update any listing" ON listings;
CREATE POLICY "Admins can update any listing"
  ON listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete any listing" ON listings;
CREATE POLICY "Admins can delete any listing"
  ON listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Message Threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, buyer_id, seller_id)
);

-- 10. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for messaging
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own threads" ON message_threads;
CREATE POLICY "Users can view own threads"
  ON message_threads FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can create threads" ON message_threads;
CREATE POLICY "Users can create threads"
  ON message_threads FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_threads
      WHERE id = thread_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM message_threads
      WHERE id = thread_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Recipients can update messages (read receipts)" ON messages;
CREATE POLICY "Recipients can update messages (read receipts)"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM message_threads
      WHERE id = thread_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- Admins can view all for dispute resolution
DROP POLICY IF EXISTS "Admins can view all threads" ON message_threads;
CREATE POLICY "Admins can view all threads"
  ON message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins can view all messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 11. Escrow Transactions table
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  amount_fcfa INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_payout INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'disputed', 'refunded', 'cancelled')),
  payment_reference TEXT,
  notchpay_transaction_id TEXT,
  payment_method TEXT,
  held_at TIMESTAMPTZ,
  release_deadline TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  dispute_raised_at TIMESTAMPTZ,
  dispute_reason TEXT,
  dispute_raised_by UUID REFERENCES user_profiles(id),
  dispute_resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  resolution TEXT,
  resolution_type TEXT CHECK (resolution_type IN ('release_to_seller', 'refund_to_buyer', 'split')),
  buyer_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Payout Logs table
CREATE TABLE IF NOT EXISTS payout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrow_transactions(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payout', 'commission', 'refund')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Payment Webhook Events (audit trail)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'notchpay',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  escrow_id UUID REFERENCES escrow_transactions(id),
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Triggers
DROP TRIGGER IF EXISTS escrow_transactions_updated_at ON escrow_transactions;
CREATE TRIGGER escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS for escrow
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers and sellers can view own escrow" ON escrow_transactions;
CREATE POLICY "Buyers and sellers can view own escrow"
  ON escrow_transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create escrow" ON escrow_transactions;
CREATE POLICY "Buyers can create escrow"
  ON escrow_transactions FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Participants can update escrow" ON escrow_transactions;
CREATE POLICY "Participants can update escrow"
  ON escrow_transactions FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins can view all escrow" ON escrow_transactions;
CREATE POLICY "Admins can view all escrow"
  ON escrow_transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update all escrow" ON escrow_transactions;
CREATE POLICY "Admins can update all escrow"
  ON escrow_transactions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can view own payouts" ON payout_logs;
CREATE POLICY "Users can view own payouts"
  ON payout_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payouts" ON payout_logs;
CREATE POLICY "Admins can view all payouts"
  ON payout_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage webhook events" ON payment_webhook_events;
CREATE POLICY "Admins can manage webhook events"
  ON payment_webhook_events FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 14. Storage Buckets & Policies
-- Run these in Supabase SQL Editor
-- ============================================

-- Create buckets (run via Supabase Dashboard or API, not SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-videos', 'property-videos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('id-documents', 'id-documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', false);

-- ============================================
-- property-images (PUBLIC) — listing photos
-- ============================================

DROP POLICY IF EXISTS "Public read access for property images" ON storage.objects;
CREATE POLICY "Public read access for property images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Verified users can upload property images" ON storage.objects;
CREATE POLICY "Verified users can upload property images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('vendor', 'agent', 'landlord', 'admin')
        AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Users can delete own property images" ON storage.objects;
CREATE POLICY "Users can delete own property images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- property-videos (PUBLIC) — listing videos
-- ============================================

DROP POLICY IF EXISTS "Public read access for property videos" ON storage.objects;
CREATE POLICY "Public read access for property videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-videos');

DROP POLICY IF EXISTS "Verified users can upload property videos" ON storage.objects;
CREATE POLICY "Verified users can upload property videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-videos'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('vendor', 'agent', 'landlord', 'admin')
        AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Users can delete own property videos" ON storage.objects;
CREATE POLICY "Users can delete own property videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- id-documents (PRIVATE) — national ID cards
-- ============================================

DROP POLICY IF EXISTS "Users can view own ID documents" ON storage.objects;
CREATE POLICY "Users can view own ID documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'id-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins can view all ID documents" ON storage.objects;
CREATE POLICY "Admins can view all ID documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'id-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can upload own ID documents" ON storage.objects;
CREATE POLICY "Users can upload own ID documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'id-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own ID documents" ON storage.objects;
CREATE POLICY "Users can delete own ID documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'id-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- selfies (PRIVATE) — verification selfies
-- ============================================

DROP POLICY IF EXISTS "Users can view own selfies" ON storage.objects;
CREATE POLICY "Users can view own selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins can view all selfies" ON storage.objects;
CREATE POLICY "Admins can view all selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfies'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can upload own selfies" ON storage.objects;
CREATE POLICY "Users can upload own selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own selfies" ON storage.objects;
CREATE POLICY "Users can delete own selfies"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- 15. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- verification_approved, verification_rejected, escrow_held, escrow_released, escrow_disputed, dispute_resolved, new_message, listing_flagged
  title TEXT NOT NULL,
  body TEXT,
  link TEXT, -- optional in-app link, e.g., /dashboard/escrow/uuid
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 16. REVIEWS & RATINGS
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(escrow_id, reviewer_id) -- one review per user per transaction
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create reviews for their completed deals" ON reviews;
CREATE POLICY "Users can create reviews for their completed deals"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM escrow_transactions
      WHERE id = escrow_id
        AND status = 'released'
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- ============================================
-- 17. Performance Indexes
-- Critical for production query performance
-- ============================================

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_transaction_type ON listings(transaction_type);
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_is_active_created ON listings(is_active, created_at DESC);

-- Escrow indexes
CREATE INDEX IF NOT EXISTS idx_escrow_buyer_id ON escrow_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller_id ON escrow_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_release_deadline ON escrow_transactions(release_deadline);
CREATE INDEX IF NOT EXISTS idx_escrow_payment_reference ON escrow_transactions(payment_reference);
CREATE INDEX IF NOT EXISTS idx_escrow_listing_id ON escrow_transactions(listing_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_buyer_id ON message_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_seller_id ON message_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_listing_id ON message_threads(listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read, sender_id);

-- Vendor verification indexes
CREATE INDEX IF NOT EXISTS idx_vendor_verifications_user_id ON vendor_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_verifications_status ON vendor_verifications(status);

-- Listing media indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_videos_listing_id ON listing_videos(listing_id);

-- Payout and audit indexes
CREATE INDEX IF NOT EXISTS idx_payout_logs_user_id ON payout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_logs_escrow_id ON payout_logs(escrow_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- User profile indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
