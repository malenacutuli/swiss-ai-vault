-- Enable RLS on research_quotas (public read-only reference table)
ALTER TABLE research_quotas ENABLE ROW LEVEL SECURITY;

-- Anyone can view quota tiers (reference data)
CREATE POLICY "Anyone can view research quotas"
  ON research_quotas FOR SELECT
  USING (true);

-- Only admins can modify quotas
CREATE POLICY "Admins can manage research quotas"
  ON research_quotas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));