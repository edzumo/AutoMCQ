import React from 'react';
import { RawChunk, ProcessingStats } from '../types';
import { Play, Loader2, CheckCircle2, AlertOctagon, FileText } from 'lucide-react';
import { logger } from '../services/loggerService';

interface ProcessingPanelProps {
  queue: RawChunk[];
  stats: ProcessingStats;
  isProcessing: boolean;
  onStartProcessing: () => void;
}

const ProcessingPanel: React.FC<ProcessingPanelProps> = ({ 
  queue, 
  stats, 
  isProcessing, 
  onStartProcessing 
}) => {
  const pendingCount = queue.filter(c => c.status === 'pending').length;
  const progress = stats.totalChunks > 0 ? (stats.processedChunks / stats.totalChunks) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Cleaning Pipeline</h2>
        <div className="flex items-center gap-2">
            <button 
              onClick={() => logger.downloadLogs()}
              className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 border px-2 py-1 rounded"
              title="Download execution logs"
            >
              <FileText size={12} /> Logs
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Chunks Processed</p>
          <p className="text-2xl font-bold text-gray-900">{stats.processedChunks} <span className="text-gray-400 text-sm">/ {stats.totalChunks}</span></p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs uppercase tracking-wider text-green-600 font-semibold mb-1">Clean Questions</p>
          <p className="text-2xl font-bold text-green-700">{stats.questionsFound}</p>
        </div>
      </div>

      {stats.failedChunks > 0 && (
        <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 text-sm text-red-700">
          <AlertOctagon size={16} />
          <span>{stats.failedChunks} chunks failed or were skipped. Check logs.</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Processing Status</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 mb-6 space-y-2 border border-gray-100 rounded-lg p-2 bg-gray-50">
        {queue.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">Queue is empty</div>
        ) : (
          queue.map((chunk) => (
            <div key={chunk.id} className="bg-white p-3 rounded border border-gray-100 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                {chunk.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />}
                {chunk.status === 'processing' && <Loader2 className="w-3 h-3 text-indigo-500 animate-spin shrink-0" />}
                {chunk.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
                {chunk.status === 'failed' && <AlertOctagon className="w-3 h-3 text-red-500 shrink-0" />}
                
                <span className="truncate font-medium text-gray-700 max-w-[150px]">{chunk.source_name}</span>
                <span className="text-gray-400 text-xs truncate max-w-[100px]">{chunk.page_or_url}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                chunk.status === 'completed' ? 'bg-green-100 text-green-700' :
                chunk.status === 'processing' ? 'bg-indigo-100 text-indigo-700' :
                chunk.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {chunk.status}
              </span>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onStartProcessing}
        disabled={isProcessing || pendingCount === 0}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
          isProcessing 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : pendingCount === 0 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
        }`}
      >
        {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
        {isProcessing ? 'Pipeline Running...' : 'Start Cleaning Pipeline'}
      </button>
    </div>
  );
};

export default ProcessingPanel;
