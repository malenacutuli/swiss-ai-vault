import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <Card className="bg-card border-border">
          <CardContent className="p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground mb-2">SwissVault.ai - Operated by Axessible Labs AG</p>
            <p className="text-muted-foreground mb-8">Effective Date: December 6, 2025</p>
            
            <div className="prose prose-invert max-w-none space-y-6 text-foreground/90">
              <p className="text-muted-foreground leading-relaxed">
                SwissVault.ai, operated by Axessible Labs AG, is committed to protecting your privacy and ensuring the confidentiality of your interactions with our AI services. As a Swiss-based company, we adhere to the stringent requirements of the Swiss Federal Act on Data Protection (FADP) and other applicable Swiss privacy laws. This privacy policy outlines how we handle your data and your rights regarding that data.
              </p>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Data Collection and Use</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  SwissVault.ai prioritizes your privacy and operates with a focus on minimizing data collection. Our general principle is:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
                  <li><strong>Privacy-First Design:</strong> We design our AI services with privacy as a core consideration, aiming to minimize the collection and retention of personal data.</li>
                  <li><strong>Limited Data Collection:</strong> We collect only the data necessary to provide you with the requested AI services and to improve our platform.</li>
                  <li><strong>Transparency:</strong> We are transparent about the data we collect and how we use it.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Specific data collection practices may vary depending on the specific SwissVault.ai service you are using. However, common practices include:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Account Information:</strong> If you create an account, we may collect your name, email address, and password.</li>
                  <li><strong>Usage Data:</strong> We may collect data about how you use our services, such as the features you use, the time and duration of your sessions, and the content you interact with.</li>
                  <li><strong>Communications Data:</strong> If you contact us for support or feedback, we may collect your email address and the content of your communication.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Use of Data</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use your data for the following purposes:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Providing and Improving Services:</strong> To provide you with the AI services you request and to improve the functionality and performance of our platform.</li>
                  <li><strong>Personalization:</strong> To personalize your experience and provide you with relevant content and recommendations (where applicable).</li>
                  <li><strong>Communication:</strong> To communicate with you about our services, updates, and promotions.</li>
                  <li><strong>Research and Development:</strong> To conduct research and development to improve our AI models and develop new services.</li>
                  <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We employ robust security measures to protect your data from unauthorized access, loss, or alteration:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Encryption:</strong> We use encryption to protect your data both in transit and at rest.</li>
                  <li><strong>Access Controls:</strong> We implement strict access controls to limit access to your data to authorized personnel only.</li>
                  <li><strong>Regular Security Audits:</strong> We conduct regular security audits to identify and address potential vulnerabilities.</li>
                  <li><strong>Swiss Data Residency:</strong> Our servers are located in Switzerland, benefiting from strong Swiss privacy laws and data protection standards.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. Compliance with Swiss Law (FADP)</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  SwissVault.ai is committed to complying with the Swiss Federal Act on Data Protection (FADP). This means:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Data Minimization:</strong> We only collect and retain data that is strictly necessary for the operation of our services and as permitted by law.</li>
                  <li><strong>Purpose Limitation:</strong> We only use your data for the purposes described in this privacy policy.</li>
                  <li><strong>Data Security:</strong> We implement appropriate technical and organizational measures to protect your data against unauthorized access, loss, or alteration.</li>
                  <li><strong>Transparency:</strong> We are transparent about our data processing practices and provide you with clear information about how we handle your data.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Rights Under the FADP</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Under the FADP, you have the following rights:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Right to Access:</strong> You have the right to access the personal data we hold about you.</li>
                  <li><strong>Right to Rectification:</strong> You have the right to correct any inaccurate or incomplete personal data we hold about you.</li>
                  <li><strong>Right to Erasure:</strong> You have the right to request the deletion of your personal data, subject to certain legal limitations.</li>
                  <li><strong>Right to Restriction of Processing:</strong> You have the right to restrict the processing of your personal data in certain circumstances.</li>
                  <li><strong>Right to Object:</strong> You have the right to object to the processing of your personal data.</li>
                  <li><strong>Right to Data Portability:</strong> You have the right to receive your personal data in a structured, commonly used, and machine-readable format and to transmit it to another controller.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your data only for as long as necessary to fulfill the purposes described in this privacy policy or as required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Data Transfer</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not transfer your data to third parties except as required by law or with your explicit consent. In the event that we use third-party service providers to process your data, we will ensure that they are contractually bound to protect your data in accordance with Swiss data protection laws.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies and Similar Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may use cookies and similar technologies to collect data about your browsing behavior on our website. You can control the use of cookies through your browser settings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have any questions or concerns about this privacy policy or our data processing practices, please contact us at:
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Axessible Labs AG (SwissVault.ai)<br />
                  Email:{' '}
                  <a href="mailto:malena@axessible.ai" className="text-primary hover:underline">
                    malena@axessible.ai
                  </a>
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to this Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this privacy policy from time to time. We will post any changes on our website and notify you as required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">11. Supervisory Authority</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You have the right to lodge a complaint with the Swiss Federal Data Protection and Information Commissioner (FDPIC) if you believe that we have violated your privacy rights.
                </p>
              </section>

              <section className="pt-4 border-t border-border">
                <p className="text-muted-foreground leading-relaxed italic">
                  This privacy policy is governed by and construed in accordance with the laws of Switzerland.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
