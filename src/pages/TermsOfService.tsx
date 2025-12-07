import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last Updated: December 7, 2025</p>
        
        <Card className="mb-8">
          <CardContent className="pt-6 prose prose-sm max-w-none text-foreground">
            <p className="text-muted-foreground mb-6">
              Welcome to swissvault.ai, a website operated by Axessible Labs AG ("Axessible," "we," or "our"). By accessing or using our website and services ("Services"), you agree to be bound by these Terms. If you do not agree with any provision of these Terms, you may not access or use the Services. These Terms apply to all users and visitors of the platform.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Accessing the Services</h2>
            
            <h3 className="text-lg font-medium mt-6 mb-3">1.1 Age Requirements</h3>
            <p className="text-muted-foreground mb-4">
              To use our Services, you must be at least thirteen (13) years old. Minors require parental or legal guardian consent to create a Swiss Vault account. Accounts created in violation of this policy will be removed.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">1.2 Swiss Vault Accounts</h3>
            <p className="text-muted-foreground mb-4">
              Some Services require a Swiss Vault account. You agree to provide accurate, complete account information and keep it up to date. Your account is personal and non-transferable. Sharing login credentials, reselling, leasing, or unauthorized access is prohibited. You are responsible for all activity under your account, including use by any end user provisioned under your account. Notify us immediately at <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">hola@axessible.ai</a> if you suspect unauthorized access or use.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">1.3 Admin Accounts</h3>
            <p className="text-muted-foreground mb-4">
              Administrators of organizational accounts have additional permissions, including user provisioning by invitation or domain association, account management, and workspace feature control.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Use of Services</h2>
            
            <h3 className="text-lg font-medium mt-6 mb-3">2.1 Grant of Use</h3>
            <p className="text-muted-foreground mb-4">
              You are granted a non-exclusive right to access and use the Services, subject to these Terms, any additional policies, and applicable laws. Certain Services may require a paid subscription and may have usage restrictions described in service-specific documentation.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">2.2 Usage Restrictions</h3>
            <p className="text-muted-foreground mb-2">You shall not, and shall not permit others to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
              <li>(a) Violate any laws, these Terms, or our Usage Policy;</li>
              <li>(b) Infringe upon third-party rights or generate infringing Output;</li>
              <li>(c) Submit personal data of children under 13 or permit minors to use the Services without appropriate consent;</li>
              <li>(d) Attempt to reverse engineer or extract models, algorithms, or source code;</li>
              <li>(e) Use Output to reverse engineer the Services;</li>
              <li>(f) Compromise system security or perform vulnerability testing;</li>
              <li>(g) Extract content by methods outside the Services;</li>
              <li>(h) Buy, sell, or transfer API keys or accounts.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. User Data</h2>
            
            <h3 className="text-lg font-medium mt-6 mb-3">3.1 Ownership</h3>
            <p className="text-muted-foreground mb-4">
              You retain ownership of any input you provide ("Input") and any output returned ("Output"). Combined, these constitute "Your Data." Axessible claims no ownership over Your Data, except as required to operate and improve the Services.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">3.2 Responsibilities</h3>
            <p className="text-muted-foreground mb-4">
              You are solely responsible for your Input, including the accuracy, legality, and rights associated with it. You are also responsible for reviewing Output for suitability and must not present machine-generated Output as human-generated content.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">3.3 Use and Storage</h3>
            <p className="text-muted-foreground mb-4">
              Your Data is used and stored in accordance with applicable Additional Terms and our Privacy Policy.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">3.4 Similarity of Output</h3>
            <p className="text-muted-foreground mb-4">
              Due to the nature of generative services, Output may resemble that of other users. Axessible does not guarantee Output uniqueness.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">3.5 Reporting Illegal Content</h3>
            <p className="text-muted-foreground mb-4">
              You may report illegal or policy-violating content through the platform or by email at <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">hola@axessible.ai</a>. This includes content promoting hate, harassment, terrorism, sexual abuse, or harm to minors. You grant Axessible a limited license to access such reported content to improve service safety and moderation.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              The Services and all intellectual property associated therewith remain the sole property of Axessible Labs AG and its licensors. You may not use our trademarks or trade dress without prior written consent.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Model Licenses</h2>
            <p className="text-muted-foreground mb-4">
              Some models made available through the Services may be subject to third-party licenses. You are responsible for complying with such terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Use License</h2>
            <p className="text-muted-foreground mb-4">
              Axessible grants a limited, non-exclusive, non-transferable license to access the Services for personal, non-commercial use, contingent upon your continued compliance with these Terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Prohibited Uses</h2>
            <p className="text-muted-foreground mb-2">You may not use the Services:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
              <li>In violation of any applicable law;</li>
              <li>To harm or exploit minors;</li>
              <li>To distribute spam or solicitations;</li>
              <li>In ways that violate the Content Standards outlined herein.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. User Contributions</h2>
            <p className="text-muted-foreground mb-4">
              Users may contribute content to forums or other interactive features ("User Contributions"). All content must adhere to our Content Standards.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Warranties</h2>
            <p className="text-muted-foreground mb-4">
              We warrant the Services will operate materially as described and any professional services will be performed in a workmanlike manner. However, we disclaim all other warranties, including fitness for a particular purpose, and do not guarantee uninterrupted service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              Axessible Labs AG is not liable for indirect, incidental, special, or consequential damages resulting from your use of the Services. This includes, but is not limited to, data loss, business interruption, or unauthorized data access.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">11. Third-Party Notices</h2>
            <p className="text-muted-foreground mb-2">Certain services incorporate third-party models or tools. Relevant terms include:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
              <li>Meta AI: <a href="https://ai.meta.com/llama/license/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://ai.meta.com/llama/license/</a></li>
              <li>Google Gemma: <a href="https://ai.google.dev/gemma/terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://ai.google.dev/gemma/terms</a></li>
              <li>OpenAI: <a href="https://openai.com/policies/terms-of-use/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://openai.com/policies/terms-of-use/</a></li>
              <li>Mistral: <a href="https://mistral.ai/terms#partner-hosted-deployment-terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://mistral.ai/terms#partner-hosted-deployment-terms</a></li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">12. Modifications</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to update these Terms at any time. Material changes will be notified via email or in-platform with at least 30 days' notice. Continued use constitutes acceptance of updated Terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">13. General Provisions</h2>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li><strong>Termination:</strong> Agreement remains in force until terminated. Provisions that by nature survive termination (e.g., intellectual property, limitation of liability) remain effective.</li>
              <li><strong>Assignment:</strong> Neither party may assign without written consent, except to a successor entity.</li>
              <li><strong>Independent Contractors:</strong> No agency, joint venture, or partnership is created.</li>
              <li><strong>Governing Law:</strong> Delaware law governs, excluding conflict of law rules.</li>
              <li><strong>Severability:</strong> If any part is held invalid, the remainder remains enforceable.</li>
              <li><strong>Entire Agreement:</strong> These Terms constitute the full agreement between you and Axessible Labs AG.</li>
              <li><strong>Force Majeure:</strong> We are not liable for service disruption due to unforeseen events beyond our control.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">Contact Information</h2>
            <p className="text-muted-foreground">
              For questions or concerns, contact us at <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">hola@axessible.ai</a>.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
