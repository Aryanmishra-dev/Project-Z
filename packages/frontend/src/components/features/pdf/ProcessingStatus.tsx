import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui';
import { pdfService } from '@/services/pdf.service';
import { usePDFStore } from '@/stores/pdfStore';
import { PROCESSING_STEPS } from '@/utils/constants';
import { cn } from '@/utils/cn';

interface ProcessingStatusProps {
  pdfId: string;
}

export function ProcessingStatus({ pdfId }: ProcessingStatusProps) {
  const uploadProgress = usePDFStore((state) => state.uploadProgress[pdfId]);
  
  // Poll for status every 5 seconds as a fallback
  const { data: statusData } = useQuery({
    queryKey: ['pdf-status', pdfId],
    queryFn: () => pdfService.getStatus(pdfId),
    refetchInterval: 5000,
    enabled: !uploadProgress, // Only poll if no WebSocket updates
  });

  const progress = uploadProgress?.progress ?? statusData?.progress ?? 0;
  const currentStep = uploadProgress?.step ?? statusData?.step ?? 'extracting';
  const currentStepIndex = PROCESSING_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <Progress value={progress} max={100} showValue variant="default" />

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {PROCESSING_STEPS.slice(0, -1).map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-col items-center',
                isActive && 'text-primary-600',
                isCompleted && 'text-success-600',
                !isActive && !isCompleted && 'text-gray-400'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                  isActive && 'bg-primary-100',
                  isCompleted && 'bg-success-100',
                  !isActive && !isCompleted && 'bg-gray-100'
                )}
              >
                {isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>{step.icon}</span>
                )}
              </div>
              <span className="mt-1 text-xs hidden sm:block">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Current action text */}
      <p className="text-center text-sm text-gray-600" aria-live="polite">
        {uploadProgress?.message || PROCESSING_STEPS[currentStepIndex]?.label || 'Processing...'}
      </p>
    </div>
  );
}
