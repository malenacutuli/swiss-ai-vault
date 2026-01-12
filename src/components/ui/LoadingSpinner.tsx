// src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-[#1D4E5F] border-t-transparent rounded-full" />
    </div>
  );
}
