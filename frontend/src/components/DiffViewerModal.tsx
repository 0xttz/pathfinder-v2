import * as Diff from 'jsdiff';

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldText: string;
  newText: string;
}

export function DiffViewerModal({ isOpen, onClose, oldText, newText }: DiffViewerModalProps) {
  if (!isOpen) return null;

  const diff: DiffPart[] = Diff.diffChars(oldText, newText);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Synthesis Result</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            &times;
          </button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900 p-4 rounded-md font-mono text-sm overflow-auto max-h-[60vh]">
          {diff.map((part, index) => {
            const style = {
              backgroundColor: part.added ? 'rgba(67, 255, 67, 0.2)' : part.removed ? 'rgba(255, 67, 67, 0.2)' : 'transparent',
              textDecoration: part.removed ? 'line-through' : 'none',
              color: part.added ? '#4CAF50' : part.removed ? '#F44336' : 'inherit',
            };
            return (
              <span key={index} style={style}>
                {part.value}
              </span>
            );
          })}
        </div>
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 