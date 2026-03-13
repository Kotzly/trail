import { useCallback, useState } from 'react';
import { sendRpcMessage } from '@shared/rpc/client.js';
import { rpc } from '@shared/rpc/contracts.js';

type ExportButtonProps = {
  treeId: string;
  label: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'trail';
}

export default function ExportButton({ treeId, label }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await sendRpcMessage(rpc.exportTree({ treeId }));
      if (!response.success) {
        console.error('Export failed:', response.error);
        return;
      }

      const json = JSON.stringify(response.data);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(label)}.trail.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [treeId, label, exporting]);

  return (
    <button
      type="button"
      className="account-btn account-btn--secondary"
      onClick={() => void handleExport()}
      disabled={exporting}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {exporting ? 'Exporting...' : 'Export JSON'}
    </button>
  );
}
