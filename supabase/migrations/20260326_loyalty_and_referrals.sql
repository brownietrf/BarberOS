-- ============================================================
-- BarberOS — Programa de Fidelidade + Sistema de Indicações
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Novas colunas em barbershops
-- ============================================================
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS referral_code       text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by         text,
  ADD COLUMN IF NOT EXISTS referral_bonus_ends_at timestamptz;

-- 2. Tabela: loyalty_programs
-- Configuração do programa de fidelidade (uma por barbearia)
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id       uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  visits_required     int NOT NULL DEFAULT 10 CHECK (visits_required >= 1),
  reward_description  text NOT NULL DEFAULT 'Recompensa especial',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barbershop_id)
);

-- 3. Tabela: loyalty_rewards
-- Histórico de resgates de recompensas
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id         uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  customer_id           uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  visits_at_redemption  int NOT NULL,
  notes                 text,
  redeemed_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. Tabela: referrals
-- Controle de indicações entre barbeiros
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_barbershop_id  uuid REFERENCES barbershops(id) ON DELETE SET NULL,
  referred_barbershop_id  uuid REFERENCES barbershops(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_granted_at       timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS: loyalty_programs
-- ============================================================
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage loyalty program"
  ON loyalty_programs FOR ALL
  USING (
    barbershop_id IN (
      SELECT id FROM barbershops WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "public can view active loyalty programs"
  ON loyalty_programs FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- RLS: loyalty_rewards
-- ============================================================
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage loyalty rewards"
  ON loyalty_rewards FOR ALL
  USING (
    barbershop_id IN (
      SELECT id FROM barbershops WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: referrals
-- ============================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Indicador pode ver suas indicações
CREATE POLICY "referrer can view own referrals"
  ON referrals FOR SELECT
  USING (
    referrer_barbershop_id IN (
      SELECT id FROM barbershops WHERE owner_id = auth.uid()
    )
  );

-- Indicado pode inserir o registro (only for their own barbershop)
CREATE POLICY "authenticated can insert referral"
  ON referrals FOR INSERT TO authenticated
  WITH CHECK (
    referred_barbershop_id IN (
      SELECT id FROM barbershops WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "service role can manage referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_customer
  ON loyalty_rewards (barbershop_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals (referrer_barbershop_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referred
  ON referrals (referred_barbershop_id);
