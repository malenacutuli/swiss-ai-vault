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
            <p className="text-muted-foreground mb-8">Last Updated: December 7th 2025</p>
            
            <div className="prose prose-invert max-w-none space-y-6 text-foreground/90">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Privacy Policy of Axessible Labs AG</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Axessible Labs AG operates the SwissVault.ai website, serving as an applied AI research lab and provider of AI services. This document informs you of our policies related to the collection, use, and disclosure of personal information when you use our Service via the swissvault.ai website. By utilizing our Service, you consent to the gathering and use of information according to this policy. We use the collected personal information for enhancing and providing our Service and will not share your data with anyone except as outlined in this Privacy Policy. Definitions in this Privacy Policy align with those in our Terms and Conditions available on our website unless stated otherwise here.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Information Collection and Use</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We collect personally identifiable information, such as your name, phone number, and address, to improve your experience with our Service. This data supports us in identifying and contacting you.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Log Data</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your browser sends information known as Log Data when you visit our Service. This might include details like your computer's IP address, browser type, visited pages on our Service, time and date of your visit, time spent on those pages, and other statistics.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Cookies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Cookies are small data files used as anonymous unique identifiers, sent to your browser from websites you visit and stored on your computer's hard drive. Our website utilizes "cookies" to gather information and enhance our Service. You may accept or refuse these cookies, and we'll inform you when a cookie is sent to your computer. If you refuse our cookies, you might not be able to use the full functionalities of our Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Service Providers</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We may employ third-party companies and individuals for the following reasons:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To facilitate our Service;</li>
                  <li>To provide the Service on our behalf;</li>
                  <li>To perform Service-related tasks; or</li>
                  <li>To help us understand how our Service is used.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  These third parties have access to your Personal Information solely to perform these tasks for us. They are obligated not to disclose or use the information for any other purpose.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your trust in providing us your Personal Information is important to us, hence we strive to use commercially acceptable means of protecting it. Please be aware, no method of transmission over the internet or electronic storage is entirely secure, and we cannot guarantee its absolute safety.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Links to Other Sites</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Service may feature links to external sites not operated by us. We recommend reviewing the Privacy Policy of these third-party sites, as we do not control and are not responsible for their content, privacy practices, or policies.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Service does not cater to anyone under the age of 13. We do not intentionally collect personally identifiable information from children under 13. If we become aware that we have collected personal information from a child under 13 without verification of parental consent, we take steps to remove that information from our servers. If you believe your child has provided us this kind of information, please contact us to take necessary actions.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Privacy Policy may undergo updates, with the latest revision date displayed at the top of this document. We encourage you to review this page periodically for any changes. We will notify you of any changes by posting the updated Privacy Policy on this page. These changes become effective immediately after they are posted on this page.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For questions or suggestions regarding our Privacy Policy, please contact us at{' '}
                  <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">
                    hola@axessible.ai
                  </a>
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
