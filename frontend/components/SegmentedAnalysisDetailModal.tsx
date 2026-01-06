import React from 'react';
import type { MediaFile, SegmentStep, PostProcessStep } from '../types';
import { XIcon } from './Icons';

interface SegmentedAnalysisDetailModalProps {
  isOpen: boolean;
  mediaFiles: MediaFile[];
  onClose: () => void;
}

const STEP_LABELS: Record<SegmentStep | PostProcessStep, string> = {
  background: 'Bg',
  costume: 'Costume',
  pose: 'Pose',
  bodyType: 'Body',
  integration: 'Int',
  review: 'Rev',
  refine: 'Ref',
};

const STATUS_ICONS: Record<string, string> = {
  idle: '⏸',
  pending: '⏸',
  processing: '⏳',
  completed: '✓',
  error: '✗',
};

const SegmentedAnalysisDetailModal: React.FC<SegmentedAnalysisDetailModalProps> = ({
  isOpen,
  mediaFiles,
  onClose,
}) => {
  if (!isOpen) return null;

  const activeFiles = mediaFiles.filter(mf => mf.segmentedAnalysis?.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Segmented Analysis Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeFiles.map(file => {
            const sa = file.segmentedAnalysis;
            if (!sa) return null;

            return (
              <div key={file.id} className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img src={file.files?.preview || file.previewUrl} alt="" className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-300 truncate">{file.name}</p>
                    {sa.currentStep && (
                      <p className="text-xs text-gray-500 truncate mt-1">{sa.currentStep}</p>
                    )}
                  </div>
                </div>

                <div className="pl-2 space-y-2">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Segments:</div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(sa.steps.segments) as [SegmentStep, any][]).map(([step, result]) => (
                        <div key={step} className="flex items-center gap-2 text-xs bg-gray-800 rounded px-3 py-1.5 min-w-[120px]">
                          <span className={
                            result.status === 'completed' ? 'text-green-400' :
                            result.status === 'error' ? 'text-red-400' :
                            result.status === 'processing' ? 'text-yellow-400 animate-pulse' :
                            'text-gray-500'
                          }>
                            {STATUS_ICONS[result.status] || '?'}
                          </span>
                          <span className="text-gray-400 font-medium">{STEP_LABELS[step]}</span>
                          {result.status === 'processing' && (
                            <span className="text-gray-500 ml-auto">Processing...</span>
                          )}
                          {result.status === 'error' && result.error && (
                            <span className="text-red-400 ml-auto truncate max-w-[150px]" title={result.error}>
                              {result.error}
                            </span>
                          )}
                          {result.status === 'completed' && result.result && (
                            <span className="text-gray-400 truncate max-w-[200px]" title={result.result}>
                              {result.result}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Post-Processing:</div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(sa.steps.postProcessing) as [PostProcessStep, any][]).map(([step, result]) => (
                        <div key={step} className="flex items-center gap-2 text-xs bg-gray-800 rounded px-3 py-1.5 min-w-[120px]">
                          <span className={
                            result.status === 'completed' ? 'text-green-400' :
                            result.status === 'error' ? 'text-red-400' :
                            result.status === 'processing' ? 'text-yellow-400 animate-pulse' :
                            'text-gray-500'
                          }>
                            {STATUS_ICONS[result.status] || '?'}
                          </span>
                          <span className="text-gray-400 font-medium">{STEP_LABELS[step]}</span>
                          {result.status === 'processing' && (
                            <span className="text-gray-500 ml-auto">Processing...</span>
                          )}
                          {result.status === 'error' && result.error && (
                            <span className="text-red-400 ml-auto truncate max-w-[150px]" title={result.error}>
                              {result.error}
                            </span>
                          )}
                          {result.status === 'completed' && result.result && (
                            <span className="text-gray-400 truncate max-w-[200px]" title={result.result}>
                              {result.result}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {sa.finalCaption && (
                    <div className="mt-2 p-3 bg-gray-800 rounded">
                      <span className="text-xs font-medium text-gray-500 block mb-1">Final Caption:</span>
                      <span className="text-sm text-gray-300">{sa.finalCaption}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activeFiles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No segmented analysis in progress.</p>
              <p className="text-sm text-gray-500 mt-1">Enable segmented analysis and generate captions to see details here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SegmentedAnalysisDetailModal;
