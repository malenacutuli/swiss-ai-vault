import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SwissFlag } from "@/components/icons/SwissFlag";

const DPA = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <SwissFlag className="h-4 w-4" />
              <span className="text-sm font-medium text-primary">Legal</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Data Processing Agreement</h1>
            <p className="text-muted-foreground">Last updated: December 8, 2025</p>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                This Data Processing Agreement ("DPA") forms part of the agreement between Axessible Labs AG 
                ("SwissVault", "we", "us") and the Customer ("you") for the use of SwissVault.ai services.
              </p>
              <p className="text-muted-foreground">
                This DPA reflects the parties' agreement with regard to the Processing of Personal Data 
                in accordance with the requirements of Data Protection Laws, including the Swiss Federal 
                Act on Data Protection (FADP) and the EU General Data Protection Regulation (GDPR).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Definitions</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person.</li>
                <li><strong>"Processing"</strong> means any operation performed on Personal Data.</li>
                <li><strong>"Data Controller"</strong> means the entity that determines the purposes and means of Processing.</li>
                <li><strong>"Data Processor"</strong> means the entity that Processes Personal Data on behalf of the Controller.</li>
                <li><strong>"Sub-processor"</strong> means any third party engaged by SwissVault to Process Personal Data.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Data Processing</h2>
              <h3 className="text-xl font-medium mb-3">3.1 Role of the Parties</h3>
              <p className="text-muted-foreground mb-4">
                The Customer is the Data Controller and SwissVault is the Data Processor with respect to 
                Personal Data processed through the Services.
              </p>
              
              <h3 className="text-xl font-medium mb-3">3.2 Purpose and Instructions</h3>
              <p className="text-muted-foreground mb-4">
                SwissVault will only Process Personal Data in accordance with the Customer's documented 
                instructions and for the purpose of providing the Services.
              </p>

              <h3 className="text-xl font-medium mb-3">3.3 Data Residency</h3>
              <p className="text-muted-foreground">
                All Personal Data is stored and processed exclusively within Switzerland (AWS eu-central-2, Zurich) 
                unless otherwise agreed in writing. Data never leaves Swiss jurisdiction.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Security Measures</h2>
              <p className="text-muted-foreground mb-4">
                SwissVault implements appropriate technical and organizational measures to ensure a level 
                of security appropriate to the risk, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>End-to-end encryption (AES-256-GCM) for all data at rest and in transit</li>
                <li>Client-side encryption keys (zero-knowledge architecture)</li>
                <li>Role-based access controls and authentication</li>
                <li>Regular security audits and penetration testing</li>
                <li>Comprehensive audit logging</li>
                <li>Data backup and disaster recovery procedures</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Sub-processors</h2>
              <p className="text-muted-foreground mb-4">
                SwissVault may engage Sub-processors to assist in providing the Services. Current Sub-processors include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>AWS (eu-central-2, Zurich)</strong> - Infrastructure hosting</li>
                <li><strong>Supabase (EU region)</strong> - Database services</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We will notify customers of any changes to Sub-processors with at least 30 days' notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Data Subject Rights</h2>
              <p className="text-muted-foreground">
                SwissVault will assist the Customer in responding to requests from Data Subjects to exercise 
                their rights under applicable Data Protection Laws, including rights of access, rectification, 
                erasure, restriction, portability, and objection.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Data Breach Notification</h2>
              <p className="text-muted-foreground">
                SwissVault will notify the Customer without undue delay (and in any event within 72 hours) 
                after becoming aware of a Personal Data breach that affects the Customer's data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Data Deletion</h2>
              <p className="text-muted-foreground">
                Upon termination of the Services or upon Customer request, SwissVault will delete or return 
                all Personal Data and delete existing copies, unless retention is required by applicable law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
              <p className="text-muted-foreground">
                For questions about this DPA or to request a signed copy, please contact us at{" "}
                <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">
                  hola@axessible.ai
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DPA;
