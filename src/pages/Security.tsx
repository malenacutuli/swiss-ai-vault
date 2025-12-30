import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Server, Database, FileCheck, Globe, Mail } from "lucide-react";

const Security = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t('securityPage.badge')}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('securityPage.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('securityPage.subtitle')}
          </p>
        </div>

        {/* Security Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* E2E Encryption */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('securityPage.e2e.title')}
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.e2e.point1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.e2e.point2')}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zero-Trust Backend */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('securityPage.zeroTrust.title')}
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.zeroTrust.point1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.zeroTrust.point2')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.zeroTrust.point3')}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Swiss Data Residency */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('securityPage.swissResidency.title')}
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.swissResidency.point1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.swissResidency.point2')}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Roadmap */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('securityPage.complianceRoadmap.title')}
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.complianceRoadmap.point1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {t('securityPage.complianceRoadmap.point2')}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zero-Knowledge Architecture */}
        <Card className="bg-card border-border mb-12">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              {t('securityPage.architecture.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Browser */}
              <div className="text-center p-6 rounded-lg bg-background border border-border">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t('securityPage.architecture.browser.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('securityPage.architecture.browser.description')}
                </p>
              </div>

              {/* Backend */}
              <div className="text-center p-6 rounded-lg bg-background border border-border">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t('securityPage.architecture.backend.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('securityPage.architecture.backend.description')}
                </p>
              </div>

              {/* Infrastructure */}
              <div className="text-center p-6 rounded-lg bg-background border border-border">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t('securityPage.architecture.infrastructure.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('securityPage.architecture.infrastructure.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2">
            <FileCheck className="w-4 h-4" />
            {t('securityPage.downloadWhitepaper')}
          </Button>
          <Button size="lg" variant="outline" className="gap-2" asChild>
            <a href="mailto:hola@axessible.ai">
              <Mail className="w-4 h-4" />
              {t('securityPage.talkToCISO')}
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Security;
