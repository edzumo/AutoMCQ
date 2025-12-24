import React, { useState } from 'react';
import { PaperConfig } from '../types';
import { X, Layers, Copy, Plus, Trash2, Download, Loader2 } from 'lucide-react';

interface BulkPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableStreams: string[];
  onGenerateBulk: (
    mode: 'MULTI_STREAM' | 'MULTI_SET', 
    config: PaperConfig, 
    selection: { streams?: string[], targetStream?: string, setCounts?: number }
  ) => void;
  isGenerating: boolean;
}

const BulkPaperModal: React.FC<BulkPaperModalProps> = ({ 
  isOpen, 
  onClose, 
  availableStreams, 
  onGenerateBulk,
  isGenerating
}) => {
  const [mode, setMode] = useState<'MULTI_STREAM' | 'MULTI_SET'>('MULTI_STREAM');
  
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [targetStream, setTargetStream] = useState<string>('');
  const [setCounts, setSetCounts] = useState<number>(5);

  const [duration, setDuration] = useState(60);
  const [sections, setSections] = useState<PaperConfig['sections']>([
    { type: 'MCQ', count: 10, marksPerQuestion: 1, negativeMarks: 0.33 }
  ]);

  if (!isOpen) return null;

  const toggleStream = (stream: string) => {
    setSelectedStreams(prev => 
      prev.includes(stream) ? prev.filter(s => s !== stream) : [...prev, stream]
    );
  };

  const selectAllStreams = () => setSelectedStreams(availableStreams);
  const deselectAllStreams = () => setSelectedStreams([]);

  const addSection = () => setSections([...sections, { type: 'MCQ', count: 5, marksPerQuestion: 2, negativeMarks: 0 }]);
  const removeSection = (idx: number) => setSections(sections.filter((_, i) => i !== idx));
  const updateSection = (idx: number, field: keyof typeof sections[0], value: any) => {
    const newSections = [...sections];
    newSections[idx] = { ...newSections[idx], [field]: value };
    setSections(newSections);
  };

  const handleGenerate = () => {
    if (mode === 'MULTI_STREAM' && selectedStreams.length === 0) {
        alert("Please select at least one stream.");
        return;
    }
    if (mode === 'MULTI_SET' && !targetStream) {
        alert("Please enter or select a target stream.");
        return;
    }

    const config: PaperConfig = {
        subjectName: mode === 'MULTI_STREAM' ? 'VARIOUS' : targetStream,
        durationMins: duration,
        sections
    };

    onGenerateBulk(mode, config, {
        streams: mode === 'MULTI_STREAM' ? selectedStreams : undefined,
        targetStream: mode === 'MULTI_SET' ? targetStream : undefined,
        setCounts: mode === 'MULTI_SET' ? setCounts : undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50 text-gray-900">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-600 p-2 rounded-lg text-white">
                 <Layers size={20} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-900">Bulk Paper Generator</h2>
                <p className="text-xs text-gray-500">Generate multiple PDF sets in one go</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Generation Mode</p>
                <button 
                    onClick={() => setMode('MULTI_STREAM')}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${mode === 'MULTI_STREAM' ? 'bg-white shadow-sm ring-1 ring-indigo-200 text-indigo-700' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
                >
                    <Layers size={18} />
                    <div>
                        <div className="font-medium text-sm text-gray-900">Multiple Streams</div>
                        <div className="text-[10px] text-gray-500">1 Paper per selected stream</div>
                    </div>
                </button>

                <button 
                    onClick={() => setMode('MULTI_SET')}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${mode === 'MULTI_SET' ? 'bg-white shadow-sm ring-1 ring-indigo-200 text-indigo-700' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
                >
                    <Copy size={18} />
                    <div>
                        <div className="font-medium text-sm text-gray-900">Multiple Sets</div>
                        <div className="text-[10px] text-gray-500">Many papers for one stream</div>
                    </div>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto bg-white">
                
                <div className="mb-8">
                    {mode === 'MULTI_STREAM' && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-900">Select Streams</h3>
                                <div className="text-xs space-x-2">
                                    <button onClick={selectAllStreams} className="text-indigo-600 hover:underline">Select All</button>
                                    <button onClick={deselectAllStreams} className="text-gray-500 hover:underline">Clear</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {availableStreams.length === 0 && <p className="text-sm text-gray-500 col-span-3 italic">No streams found.</p>}
                                {availableStreams.map(stream => (
                                    <label key={stream} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm transition-colors ${selectedStreams.includes(stream) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedStreams.includes(stream)}
                                            onChange={() => toggleStream(stream)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="truncate font-medium">{stream}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === 'MULTI_SET' && (
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">Target Stream</label>
                                <input 
                                    list="stream-options"
                                    type="text"
                                    value={targetStream}
                                    onChange={e => setTargetStream(e.target.value)}
                                    placeholder="Select or Type..."
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <datalist id="stream-options">
                                    {availableStreams.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">Number of Sets</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="50"
                                    value={setCounts}
                                    onChange={e => setSetCounts(Number(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Paper Structure</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Duration (Minutes)</label>
                            <input 
                                type="number" 
                                value={duration}
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                         {sections.map((sec, idx) => (
                             <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                                 <select 
                                     value={sec.type}
                                     onChange={e => updateSection(idx, 'type', e.target.value)}
                                     className="bg-white border border-gray-300 rounded px-2 py-1 w-24 text-gray-900 focus:ring-1 focus:ring-indigo-500"
                                 >
                                     <option value="MCQ">MCQ</option>
                                     <option value="MSQ">MSQ</option>
                                     <option value="NAT">NAT</option>
                                 </select>
                                 
                                 <div className="flex items-center gap-1">
                                     <span className="text-gray-500 text-xs">Count:</span>
                                     <input 
                                         type="number" 
                                         value={sec.count}
                                         onChange={e => updateSection(idx, 'count', Number(e.target.value))}
                                         className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 focus:ring-1 focus:ring-indigo-500"
                                     />
                                 </div>

                                 <div className="flex items-center gap-1">
                                     <span className="text-gray-500 text-xs">Marks:</span>
                                     <input 
                                         type="number" 
                                         value={sec.marksPerQuestion}
                                         onChange={e => updateSection(idx, 'marksPerQuestion', Number(e.target.value))}
                                         className="w-14 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 focus:ring-1 focus:ring-indigo-500"
                                     />
                                 </div>

                                 <div className="flex items-center gap-1">
                                     <span className="text-gray-500 text-xs">Neg:</span>
                                     <input 
                                         type="number" 
                                         value={sec.negativeMarks}
                                         onChange={e => updateSection(idx, 'negativeMarks', Number(e.target.value))}
                                         className="w-14 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 focus:ring-1 focus:ring-indigo-500"
                                     />
                                 </div>

                                 <button 
                                    onClick={() => removeSection(idx)}
                                    className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                    disabled={sections.length === 1}
                                 >
                                    <Trash2 size={16} />
                                 </button>
                             </div>
                         ))}
                    </div>
                    
                    <button onClick={addSection} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1">
                        <Plus size={16} /> Add Section
                    </button>
                </div>

            </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium">
                 Cancel
             </button>
             <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-sm"
             >
                 {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                 {isGenerating ? 'Generating...' : 'Generate Papers'}
             </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPaperModal;
