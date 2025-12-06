-- Fine-tuning Templates table
CREATE TABLE IF NOT EXISTS public.finetuning_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  language TEXT NOT NULL,
  language_code TEXT NOT NULL,
  domain TEXT NOT NULL,
  icon TEXT,
  
  -- Template configuration
  recommended_model TEXT NOT NULL,
  recommended_method TEXT DEFAULT 'lora',
  default_hyperparameters JSONB DEFAULT '{
    "epochs": 3,
    "learning_rate": 0.0002,
    "batch_size": 4
  }',
  
  -- Sample data
  sample_system_prompt TEXT,
  sample_conversations JSONB,
  
  -- Metadata
  difficulty TEXT DEFAULT 'beginner',
  estimated_time TEXT DEFAULT '30 minutes',
  use_cases TEXT[],
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS templates_language_idx ON public.finetuning_templates(language_code);
CREATE INDEX IF NOT EXISTS templates_domain_idx ON public.finetuning_templates(domain);

-- Enable RLS
ALTER TABLE public.finetuning_templates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active templates
CREATE POLICY "Anyone can view active templates"
ON public.finetuning_templates
FOR SELECT
USING (is_active = true);

-- Allow admins to manage templates
CREATE POLICY "Admins can manage templates"
ON public.finetuning_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Seed European language templates
INSERT INTO public.finetuning_templates (
  name, slug, description, language, language_code, domain, icon,
  recommended_model, sample_system_prompt, sample_conversations, use_cases
) VALUES

-- German Templates
(
  'German Customer Service',
  'de-customer-service',
  'Fine-tune a model to handle German customer support inquiries with proper formal/informal address (Sie/Du).',
  'German',
  'de',
  'customer_service',
  '🇩🇪',
  'qwen2.5-7b',
  'Du bist ein freundlicher Kundenservice-Mitarbeiter. Antworte höflich und professionell auf Deutsch. Verwende die Sie-Form.',
  '[
    {"messages": [
      {"role": "system", "content": "Du bist ein Kundenservice-Mitarbeiter für einen Online-Shop."},
      {"role": "user", "content": "Ich habe meine Bestellung noch nicht erhalten. Bestellnummer: 12345"},
      {"role": "assistant", "content": "Guten Tag! Vielen Dank für Ihre Nachricht. Ich verstehe, dass Sie auf Ihre Bestellung warten. Lassen Sie mich den Status der Bestellung 12345 für Sie überprüfen. Einen Moment bitte..."}
    ]},
    {"messages": [
      {"role": "system", "content": "Du bist ein Kundenservice-Mitarbeiter für einen Online-Shop."},
      {"role": "user", "content": "Kann ich meine Bestellung stornieren?"},
      {"role": "assistant", "content": "Selbstverständlich kann ich Ihnen dabei helfen. Könnten Sie mir bitte Ihre Bestellnummer mitteilen? Dann prüfe ich sofort, ob eine Stornierung noch möglich ist."}
    ]}
  ]'::jsonb,
  ARRAY['E-commerce support', 'Helpdesk', 'B2B communications']
),

(
  'German Legal Assistant',
  'de-legal',
  'Create a German legal assistant for basic legal questions and document drafting.',
  'German',
  'de',
  'legal',
  '⚖️',
  'qwen2.5-7b',
  'Du bist ein juristischer Assistent. Beantworte rechtliche Fragen nach deutschem Recht. Weise darauf hin, dass dies keine Rechtsberatung ersetzt.',
  '[
    {"messages": [
      {"role": "system", "content": "Du bist ein juristischer Assistent für deutsches Recht."},
      {"role": "user", "content": "Was sind die Kündigungsfristen bei einem Arbeitsvertrag?"},
      {"role": "assistant", "content": "Nach § 622 BGB gelten folgende gesetzliche Kündigungsfristen: Die Grundkündigungsfrist beträgt vier Wochen zum 15. oder zum Ende eines Kalendermonats. Je nach Betriebszugehörigkeit verlängert sich diese Frist für den Arbeitgeber...\n\nBitte beachten Sie: Dies ist eine allgemeine Information und ersetzt keine individuelle Rechtsberatung."}
    ]}
  ]'::jsonb,
  ARRAY['Legal Q&A', 'Contract review', 'Compliance']
),

-- French Templates
(
  'French Banking Assistant',
  'fr-banking',
  'Fine-tune a model for French banking and financial services customer interactions.',
  'French',
  'fr',
  'finance',
  '🇫🇷',
  'qwen2.5-7b',
  'Vous êtes un assistant bancaire professionnel. Répondez aux questions financières en français avec précision et clarté.',
  '[
    {"messages": [
      {"role": "system", "content": "Vous êtes un conseiller bancaire virtuel."},
      {"role": "user", "content": "Comment puis-je ouvrir un compte épargne?"},
      {"role": "assistant", "content": "Bonjour et merci de votre intérêt pour nos services d''épargne. Pour ouvrir un compte épargne chez nous, vous aurez besoin de:\n\n1. Une pièce d''identité valide\n2. Un justificatif de domicile de moins de 3 mois\n3. Un dépôt initial minimum de 10€\n\nVous pouvez effectuer cette démarche en ligne ou dans l''une de nos agences. Souhaitez-vous que je vous guide dans le processus en ligne?"}
    ]}
  ]'::jsonb,
  ARRAY['Banking support', 'Financial advice', 'Account management']
),

(
  'French Healthcare Assistant',
  'fr-healthcare',
  'Create a French medical assistant for patient inquiries and health information.',
  'French',
  'fr',
  'healthcare',
  '🏥',
  'qwen2.5-7b',
  'Vous êtes un assistant médical. Fournissez des informations de santé générales en français. Recommandez toujours de consulter un professionnel de santé.',
  '[
    {"messages": [
      {"role": "system", "content": "Vous êtes un assistant médical informatif."},
      {"role": "user", "content": "Quels sont les symptômes de la grippe?"},
      {"role": "assistant", "content": "Les symptômes courants de la grippe incluent:\n\n• Fièvre élevée (38-40°C)\n• Frissons et courbatures\n• Fatigue intense\n• Maux de tête\n• Toux sèche\n• Mal de gorge\n\nSi vos symptômes sont sévères ou persistent plus de 7 jours, je vous recommande de consulter votre médecin. Avez-vous d''autres questions sur la grippe?"}
    ]}
  ]'::jsonb,
  ARRAY['Patient support', 'Health information', 'Appointment scheduling']
),

-- Italian Templates
(
  'Italian Insurance Assistant',
  'it-insurance',
  'Fine-tune a model for Italian insurance customer service and claims processing.',
  'Italian',
  'it',
  'insurance',
  '🇮🇹',
  'qwen2.5-7b',
  'Sei un assistente assicurativo professionale. Rispondi alle domande sulle polizze e i sinistri in italiano.',
  '[
    {"messages": [
      {"role": "system", "content": "Sei un consulente assicurativo virtuale."},
      {"role": "user", "content": "Come posso denunciare un sinistro auto?"},
      {"role": "assistant", "content": "Buongiorno! Per denunciare un sinistro auto, segua questi passaggi:\n\n1. Compili il modulo CID (Constatazione Amichevole) se possibile\n2. Raccolga foto del danno e della scena\n3. Annoti i dati dell''altra parte coinvolta\n4. Ci contatti entro 3 giorni dall''incidente\n\nPuò effettuare la denuncia:\n• Online tramite la sua area clienti\n• Telefonicamente al numero verde\n• Presso la sua agenzia\n\nHa già compilato il modulo CID?"}
    ]}
  ]'::jsonb,
  ARRAY['Claims processing', 'Policy inquiries', 'Customer support']
),

-- Spanish Templates
(
  'Spanish E-commerce Support',
  'es-ecommerce',
  'Create a Spanish e-commerce assistant for online retail customer service.',
  'Spanish',
  'es',
  'retail',
  '🇪🇸',
  'qwen2.5-7b',
  'Eres un asistente de atención al cliente para una tienda online. Responde de manera amable y profesional en español.',
  '[
    {"messages": [
      {"role": "system", "content": "Eres un asistente de tienda online."},
      {"role": "user", "content": "¿Cuánto tarda el envío a Madrid?"},
      {"role": "assistant", "content": "¡Hola! Gracias por tu consulta. Los tiempos de envío a Madrid son:\n\n📦 Envío estándar: 3-5 días laborables (gratis en pedidos +50€)\n🚀 Envío express: 24-48 horas (4,99€)\n⚡ Envío urgente: mismo día (9,99€, pedidos antes de las 12h)\n\n¿Te gustaría saber más sobre alguna opción de envío?"}
    ]}
  ]'::jsonb,
  ARRAY['Order support', 'Shipping inquiries', 'Returns processing']
),

-- Portuguese Templates
(
  'Portuguese Fintech Assistant',
  'pt-fintech',
  'Fine-tune a model for Portuguese fintech and digital banking services.',
  'Portuguese',
  'pt',
  'finance',
  '🇵🇹',
  'qwen2.5-7b',
  'Você é um assistente de fintech. Responda sobre serviços financeiros digitais em português de forma clara e acessível.',
  '[
    {"messages": [
      {"role": "system", "content": "Você é um assistente de banco digital."},
      {"role": "user", "content": "Como faço uma transferência PIX?"},
      {"role": "assistant", "content": "Olá! Fazer um PIX é muito simples. Siga estes passos:\n\n1. Acesse o app e vá em \"Transferir\"\n2. Selecione \"PIX\"\n3. Escolha a chave do destinatário (CPF, email, telefone ou chave aleatória)\n4. Digite o valor\n5. Confirme com sua senha ou biometria\n\nO PIX é instantâneo e funciona 24h, todos os dias! Posso ajudar com mais alguma coisa?"}
    ]}
  ]'::jsonb,
  ARRAY['Digital banking', 'Payments', 'Account management']
),

-- Dutch Templates
(
  'Dutch HR Assistant',
  'nl-hr',
  'Create a Dutch HR assistant for employee inquiries and HR processes.',
  'Dutch',
  'nl',
  'hr',
  '🇳🇱',
  'qwen2.5-7b',
  'Je bent een HR-assistent. Beantwoord vragen over personeelszaken in het Nederlands op een vriendelijke en professionele manier.',
  '[
    {"messages": [
      {"role": "system", "content": "Je bent een virtuele HR-medewerker."},
      {"role": "user", "content": "Hoeveel vakantiedagen heb ik nog?"},
      {"role": "assistant", "content": "Goedemiddag! Om uw vakantiesaldo te bekijken, kunt u:\n\n1. Inloggen op het HR-portaal\n2. Ga naar \"Mijn gegevens\" > \"Verlof\"\n3. Daar ziet u uw actuele saldo\n\nVolgens de CAO heeft u recht op minimaal 20 wettelijke vakantiedagen per jaar bij een fulltime dienstverband. Wilt u dat ik u help met een verlofaanvraag?"}
    ]}
  ]'::jsonb,
  ARRAY['Employee support', 'Leave management', 'Policy questions']
),

-- Swiss German Template
(
  'Swiss German Financial Advisor',
  'ch-de-finance',
  'Fine-tune for Swiss German financial advisory with Swiss banking terminology.',
  'Swiss German',
  'de-CH',
  'finance',
  '🇨🇭',
  'qwen2.5-7b',
  'Du bist ein Schweizer Finanzberater. Beantworte Fragen zu Schweizer Bankprodukten und Vorsorge. Verwende Schweizer Terminologie.',
  '[
    {"messages": [
      {"role": "system", "content": "Du bist ein Schweizer Finanzberater."},
      {"role": "user", "content": "Wie funktioniert die Säule 3a?"},
      {"role": "assistant", "content": "Grüezi! Die Säule 3a ist die private, gebundene Vorsorge in der Schweiz.\n\nDie wichtigsten Punkte:\n\n💰 Maximalbetrag 2024: CHF 7''056 (mit Pensionskasse)\n📉 Steuerersparnis: Einzahlungen können vom steuerbaren Einkommen abgezogen werden\n🔒 Gebunden: Bezug nur bei Pensionierung, Hauskauf, Auswanderung oder Selbständigkeit\n📈 Anlage: Sparkonto oder Wertschriften möglich\n\nMöchten Sie mehr über die verschiedenen 3a-Produkte erfahren?"}
    ]}
  ]'::jsonb,
  ARRAY['Retirement planning', 'Tax optimization', 'Investment advice']
)

ON CONFLICT (slug) DO NOTHING;

-- Create view for template listing
CREATE OR REPLACE VIEW public.template_summary AS
SELECT 
  id,
  name,
  slug,
  description,
  language,
  language_code,
  domain,
  icon,
  recommended_model,
  difficulty,
  estimated_time,
  use_cases,
  is_active
FROM public.finetuning_templates
WHERE is_active = true;

-- Grant select on view
GRANT SELECT ON public.template_summary TO anon, authenticated;