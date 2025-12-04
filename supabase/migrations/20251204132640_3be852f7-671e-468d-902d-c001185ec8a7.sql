-- ============================================
-- BILLING TABLES
-- ============================================

-- Billing customers
CREATE TABLE public.billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    email TEXT NOT NULL,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

-- Billing invoices
CREATE TABLE public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_invoice_id TEXT UNIQUE,
    stripe_customer_id TEXT REFERENCES public.billing_customers(stripe_customer_id),
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'usd',
    status TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- Daily usage tracking
CREATE TABLE public.usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metric TEXT NOT NULL,
    value BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, metric)
);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- Fine-tuning usage details
CREATE TABLE public.usage_finetuning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.finetuning_jobs(id) ON DELETE SET NULL,
    base_model TEXT,
    gpu_minutes DECIMAL(10, 2),
    cost DECIMAL(10, 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.usage_finetuning ENABLE ROW LEVEL SECURITY;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_user_id UUID,
    p_date DATE,
    p_metric TEXT,
    p_value BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.usage_daily (user_id, date, metric, value)
    VALUES (p_user_id, p_date, p_metric, p_value)
    ON CONFLICT (user_id, date, metric)
    DO UPDATE SET value = public.usage_daily.value + p_value;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- Indexes
CREATE INDEX idx_usage_daily_user_date ON public.usage_daily(user_id, date);
CREATE INDEX idx_usage_finetuning_user ON public.usage_finetuning(user_id);
CREATE INDEX idx_billing_customers_stripe ON public.billing_customers(stripe_customer_id);
CREATE INDEX idx_billing_customers_user ON public.billing_customers(user_id);

-- RLS Policies
CREATE POLICY "Users can view own billing" ON public.billing_customers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON public.billing_invoices
    FOR SELECT USING (
        stripe_customer_id IN (
            SELECT stripe_customer_id FROM public.billing_customers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own usage" ON public.usage_daily
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own finetuning usage" ON public.usage_finetuning
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies for billing
CREATE POLICY "Admins can view all billing" ON public.billing_customers
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all invoices" ON public.billing_invoices
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all usage" ON public.usage_daily
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_billing_customers_updated_at 
    BEFORE UPDATE ON public.billing_customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();