import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default function Templates() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Template Management</h1>
            <p className="text-muted-foreground">
              Create and manage reusable prompt templates
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              id: 'task-template',
              name: 'Task Planning Template',
              description: 'Template for task breakdown and planning',
              variables: ['task_type', 'complexity', 'deadline'],
            },
            {
              id: 'code-review',
              name: 'Code Review Template',
              description: 'Template for code review prompts',
              variables: ['language', 'focus_area', 'severity'],
            },
            {
              id: 'data-analysis',
              name: 'Data Analysis Template',
              description: 'Template for data analysis tasks',
              variables: ['data_source', 'analysis_type', 'output_format'],
            },
          ].map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-all">
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description}
                </p>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Variables:</div>
                  <div className="flex flex-wrap gap-2">
                    {template.variables.map((variable) => (
                      <code
                        key={variable}
                        className="text-xs bg-muted px-2 py-1 rounded"
                      >
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1">
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <div className="text-muted-foreground mb-2"># Task Planning Template</div>
              <div>You are an AI assistant specialized in {`{{task_type}}`}.</div>
              <div>The task complexity is {`{{complexity}}`}.</div>
              <div>The deadline is {`{{deadline}}`}.</div>
              <div className="mt-4">Please provide a detailed plan...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
