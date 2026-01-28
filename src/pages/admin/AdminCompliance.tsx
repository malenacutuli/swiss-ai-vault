import { Shield, FileCheck, AlertTriangle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminCompliance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance & Security</h1>
        <p className="text-muted-foreground">Security compliance status and audit controls</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground">Overall status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policies</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encryption</CardTitle>
            <Lock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AES-256</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Residency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Primary Region</span>
                <span className="text-sm font-medium">Switzerland (Zurich)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Data Classification</span>
                <span className="text-sm font-medium">Confidential</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Retention Policy</span>
                <span className="text-sm font-medium">90 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">GDPR</span>
                <span className="text-sm font-medium text-green-500">Compliant</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">SOC 2 Type II</span>
                <span className="text-sm font-medium text-green-500">Certified</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">ISO 27001</span>
                <span className="text-sm font-medium text-green-500">Certified</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
