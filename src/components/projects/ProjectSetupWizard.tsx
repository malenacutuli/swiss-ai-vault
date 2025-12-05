import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Check,
  Circle,
  FileText,
  Database,
  Cpu,
  BarChart3,
  ClipboardCheck,
  Trophy,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

interface ProjectSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (projectName: string, projectGoal: string) => void;
  isCreating?: boolean;
}

type StageStatus = "completed" | "current" | "locked";

interface SubStep {
  id: string;
  label: string;
  status: StageStatus;
}

interface Stage {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: StageStatus;
  subSteps?: SubStep[];
}

export function ProjectSetupWizard({
  open,
  onOpenChange,
  onComplete,
  isCreating = false,
}: ProjectSetupWizardProps) {
  const [projectName, setProjectName] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [currentStage, setCurrentStage] = useState("general");

  const stages: Stage[] = [
    {
      id: "general",
      label: "General",
      icon: <FileText className="h-4 w-4" />,
      status: currentStage === "general" ? "current" : "completed",
    },
    {
      id: "dataset",
      label: "Create Dataset",
      icon: <Database className="h-4 w-4" />,
      status: "locked",
      subSteps: [
        { id: "dataset-source", label: "Dataset source", status: "locked" },
        { id: "create-dataset", label: "Create dataset", status: "locked" },
        { id: "create-snapshot", label: "Create snapshot", status: "locked" },
      ],
    },
    {
      id: "finetune",
      label: "Fine-tune Model",
      icon: <Cpu className="h-4 w-4" />,
      status: "locked",
      subSteps: [
        { id: "new-job", label: "New finetuning job", status: "locked" },
        { id: "analyzing", label: "Analyzing dataset", status: "locked" },
        { id: "configure", label: "Configure experiments", status: "locked" },
        { id: "running", label: "Running experiments", status: "locked" },
      ],
    },
    {
      id: "metrics",
      label: "Metrics",
      icon: <BarChart3 className="h-4 w-4" />,
      status: "locked",
      subSteps: [
        { id: "generate-rules", label: "Generate rules", status: "locked" },
        { id: "create-metric", label: "Create metric", status: "locked" },
      ],
    },
    {
      id: "evaluation",
      label: "Evaluation",
      icon: <ClipboardCheck className="h-4 w-4" />,
      status: "locked",
      subSteps: [
        { id: "choose-metrics", label: "Choose metrics", status: "locked" },
        { id: "evaluating", label: "Evaluating", status: "locked" },
      ],
    },
    {
      id: "complete",
      label: "Project Complete",
      icon: <Trophy className="h-4 w-4" />,
      status: "locked",
    },
  ];

  const handleReset = () => {
    setProjectName("");
    setProjectGoal("");
  };

  const handleContinue = () => {
    if (!projectName.trim()) return;
    onComplete(projectName.trim(), projectGoal.trim());
  };

  const getStatusIcon = (status: StageStatus) => {
    switch (status) {
      case "completed":
        return (
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        );
      case "current":
        return (
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <Circle className="h-3 w-3 fill-primary-foreground text-primary-foreground" />
          </div>
        );
      case "locked":
        return (
          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
            <Circle className="h-2 w-2 fill-muted-foreground/30 text-muted-foreground/30" />
          </div>
        );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-card rounded-xl border border-border shadow-elevated overflow-hidden flex">
        {/* Left Sidebar - Progress */}
        <div className="w-72 bg-secondary/50 border-r border-border flex flex-col">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Project Setup</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Complete each stage to set up your project
            </p>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-1">
              {stages.map((stage, index) => (
                <div key={stage.id}>
                  {/* Main Stage */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      stage.status === "current" && "bg-primary/10",
                      stage.status === "locked" && "opacity-60"
                    )}
                  >
                    {getStatusIcon(stage.status)}
                    <div className="flex items-center gap-2 flex-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          stage.status === "current" && "text-primary",
                          stage.status === "completed" && "text-foreground",
                          stage.status === "locked" && "text-muted-foreground"
                        )}
                      >
                        {stage.label}
                      </span>
                      {stage.id === "complete" && stage.status === "completed" && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Sub-steps */}
                  {stage.subSteps && (
                    <div className="ml-6 pl-5 border-l border-border/50 space-y-0.5 py-1">
                      {stage.subSteps.map((subStep) => (
                        <div
                          key={subStep.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md",
                            subStep.status === "current" && "text-primary bg-primary/5",
                            subStep.status === "completed" && "text-foreground",
                            subStep.status === "locked" && "text-muted-foreground/60"
                          )}
                        >
                          {subStep.status === "completed" ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : subStep.status === "current" ? (
                            <ChevronRight className="h-3 w-3 text-primary" />
                          ) : (
                            <Circle className="h-2 w-2 fill-muted-foreground/30" />
                          )}
                          <span>{subStep.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connector line between stages */}
                  {index < stages.length - 1 && !stage.subSteps && (
                    <div className="ml-6 h-4 border-l border-border/50" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Close button */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Close Wizard
            </Button>
          </div>
        </div>

        {/* Right Panel - Current Step Form */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-medium">
                Step 1 of 6
              </span>
              <ChevronRight className="h-4 w-4" />
              <span>General Information</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              Tell us about your project
            </h1>
            <p className="text-muted-foreground mt-1">
              Start by providing basic information about your AI project
            </p>
          </div>

          {/* Form Content */}
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-foreground text-base">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="project-name"
                  placeholder="Enter project name (e.g., Customer Support Bot, Legal Document Analyzer)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-secondary border-border h-12 text-base"
                />
                <p className="text-sm text-muted-foreground">
                  Choose a descriptive name that reflects your project's purpose
                </p>
              </div>

              {/* Project Goal */}
              <div className="space-y-2">
                <Label htmlFor="project-goal" className="text-foreground text-base">
                  What is your goal?
                </Label>
                <Textarea
                  id="project-goal"
                  placeholder={`Describe what you want to achieve with this project. For example:

• "Build a customer support chatbot that can handle billing inquiries, technical support questions, and account management tasks."

• "Create a legal document analyzer that extracts key clauses, identifies risks, and summarizes contract terms."

• "Develop a code assistant specialized in Python that can explain, debug, and suggest improvements for data science code."`}
                  value={projectGoal}
                  onChange={(e) => setProjectGoal(e.target.value)}
                  className="bg-secondary border-border min-h-[240px] text-base resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  A clear goal helps guide dataset creation and model fine-tuning
                </p>
              </div>

              {/* Tips Section */}
              <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Tips for a successful project
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Be specific about the tasks your model should perform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Consider the tone and style of responses you need</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Think about edge cases and how the model should handle them</span>
                  </li>
                </ul>
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="p-6 border-t border-border bg-secondary/30">
            <div className="flex items-center justify-between max-w-2xl">
              <Button
                variant="ghost"
                onClick={handleReset}
                className="text-muted-foreground gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!projectName.trim() || isCreating}
                className="bg-primary hover:bg-primary/90 min-w-[140px]"
              >
                {isCreating ? "Creating..." : "Continue"}
                {!isCreating && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
