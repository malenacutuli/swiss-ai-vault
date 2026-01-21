import { cn } from "@/lib/utils";

interface Template {
  id: string;
  title: string;
  description: string;
  image?: string;
}

const defaultTemplates: Template[] = [
  {
    id: "professional-headshot",
    title: "Professional Headshot",
    description: "Generate a professional headshot for your profile picture, avatar, or team photo.",
    image: "/templates/headshot.jpg",
  },
  {
    id: "career-document",
    title: "Career Document Crafter",
    description: "Craft a compelling resume, CV, or cover letter to land your dream job.",
    image: "/templates/resume.jpg",
  },
  {
    id: "custom-web-tool",
    title: "Custom Web Tool",
    description: "Create a specialized online tool, such as a custom calculator or unit converter.",
    image: "/templates/webtool.jpg",
  },
  {
    id: "localize-content",
    title: "Localize Content",
    description: "Adapt your content for new markets with cultural and linguistic localization.",
    image: "/templates/localize.jpg",
  },
  {
    id: "pitch-deck",
    title: "Design a Project Proposal Pitch D...",
    description: "Generate a compelling pitch deck to present a new project proposal.",
    image: "/templates/pitchdeck.jpg",
  },
  {
    id: "professional-emails",
    title: "Craft Professional Emails",
    description: "Your assistant for drafting formal, well-structured business and professional emails for any occasion.",
    image: "/templates/email.jpg",
  },
  {
    id: "automated-reminders",
    title: "Automated Reminders",
    description: "Set up automated meeting reminders from your Google Calendar to never miss an important event.",
    image: "/templates/reminders.jpg",
  },
  {
    id: "clean-data",
    title: "Clean Data Output",
    description: "Clean and structure your raw data into a polished, ready-to-use, and export-ready format.",
    image: "/templates/data.jpg",
  },
  {
    id: "export-table",
    title: "Export to Table",
    description: "Extracts key information from your documents and organizes it into a structured table format.",
    image: "/templates/table.jpg",
  },
  {
    id: "ai-image-wizard",
    title: "AI Image Wizard",
    description: "Effortlessly edit your images by removing backgrounds, enhancing quality, and applying various...",
    image: "/templates/imagewizard.jpg",
  },
  {
    id: "polish-writing",
    title: "Polish Your Writing",
    description: "Refine and enhance your text for better clarity, style, and impact.",
    image: "/templates/writing.jpg",
  },
  {
    id: "personal-website",
    title: "Build Personal Website",
    description: "Create a professional personal website to showcase your portfolio and build your brand.",
    image: "/templates/website.jpg",
  },
];

interface ManusTemplateGalleryProps {
  templates?: Template[];
  onSelect?: (template: Template) => void;
  className?: string;
}

export function ManusTemplateGallery({
  templates = defaultTemplates,
  onSelect,
  className,
}: ManusTemplateGalleryProps) {
  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      <h2 className="text-lg font-medium text-gray-900 mb-6">What are you building?</h2>

      <div className="grid grid-cols-2 gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect?.(template)}
            className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left bg-white"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 mb-1 truncate">{template.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
            </div>
            {/* Placeholder for template image */}
            <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 overflow-hidden">
              {template.image ? (
                <img
                  src={template.image}
                  alt={template.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide broken images
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ManusTemplateGallery;
