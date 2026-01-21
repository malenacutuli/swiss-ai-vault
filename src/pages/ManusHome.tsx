import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ManusLayout } from "@/components/manus/ManusLayout";
import { ManusInputBox } from "@/components/manus/ManusInputBox";
import { ManusFeatureCards } from "@/components/manus/ManusFeatureCards";
import { ManusTemplateGallery } from "@/components/manus/ManusTemplateGallery";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ManusHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connectedTools, setConnectedTools] = useState<string[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Use the existing agent execution hook
  const {
    tasks,
    isLoadingTasks,
    createTask,
  } = useAgentExecution();

  // Map tasks to the format expected by ManusLayout
  const mappedTasks = tasks?.map((task) => ({
    id: task.id,
    title: task.title || task.prompt?.slice(0, 50) || "Untitled Task",
    status: task.status as any,
    icon: undefined,
  })) || [];

  const handleSubmit = async (value: string, mode?: string) => {
    if (!value.trim() && mode !== "chat") return;

    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to create tasks",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsCreatingTask(true);
    try {
      const task = await createTask({
        prompt: value,
        mode: mode || "task",
      });

      if (task) {
        navigate(`/task/${task.id}`);
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast({
        title: "Failed to create task",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // TODO: Implement file upload to Supabase storage
    toast({
      title: "File upload",
      description: `Selected ${files.length} file(s). Upload functionality coming soon.`,
    });
  };

  const handleConnectorClick = (connectorType: string) => {
    // Toggle connector connection status
    if (connectedTools.includes(connectorType)) {
      setConnectedTools(connectedTools.filter((t) => t !== connectorType));
      toast({
        title: `${connectorType} disconnected`,
        description: `Removed ${connectorType} integration`,
      });
    } else {
      // TODO: Implement actual OAuth flow for connectors
      toast({
        title: `Connect ${connectorType}`,
        description: `${connectorType} integration coming soon`,
      });
    }
  };

  const handleTemplateSelect = (template: { id: string; title: string; description: string }) => {
    // Pre-fill the input with the template description
    handleSubmit(template.description);
  };

  const handleTaskSelect = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  return (
    <ManusLayout
      tasks={mappedTasks}
      selectedTaskId={null}
      onNewTask={() => navigate("/")}
      onTaskSelect={handleTaskSelect}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4 overflow-auto">
        {/* Main Heading */}
        <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-10 text-center">
          What can I do for you?
        </h1>

        {/* Input Box */}
        <ManusInputBox
          onSubmit={handleSubmit}
          onFileAttach={handleFileAttach}
          onConnectorClick={handleConnectorClick}
          disabled={isCreatingTask}
          connectedTools={connectedTools}
        />

        {/* Feature Cards */}
        <div className="mt-12 w-full">
          <ManusFeatureCards />
        </div>

        {/* Template Gallery */}
        <div className="mt-12 w-full pb-12">
          <ManusTemplateGallery onSelect={handleTemplateSelect} />
        </div>
      </div>
    </ManusLayout>
  );
}

export default ManusHome;
