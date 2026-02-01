import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { PDFList, PDFUploader } from '@/components/features/pdf';

export function PDFsPage() {
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My PDFs</h1>
          <p className="mt-1 text-gray-500">
            Manage your uploaded documents and start quizzes
          </p>
        </div>
        <Button onClick={() => setShowUploader(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Upload PDF
        </Button>
      </div>

      {/* PDF List */}
      <PDFList onUploadClick={() => setShowUploader(true)} />

      {/* Upload Dialog */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload PDF</DialogTitle>
          </DialogHeader>
          <PDFUploader onSuccess={() => setShowUploader(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
