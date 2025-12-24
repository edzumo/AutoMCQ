import React, { useState, useEffect } from 'react';
import { PaperConfig, MCQ } from '../types';
import { X, FileDown, Plus, Trash2, AlertCircle, LayoutTemplate } from 'lucide-react';

interface PaperConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: PaperConfig, format: 'PDF' | 'EXCEL') => void;
  totalAvailableQuestions: number;
  defaultSubject?: string;
}

const PaperConfigModal: React.FC<PaperConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  onGenerate, 
  totalAvailableQuestions,
  defaultSubject 
}) => {
  const [subject, setSubject] = useState(defaultSubject || 'General Aptitude');
  const [duration, setDuration] = useState(60);
  const [sections, setSections] = useState<PaperConfig['sections']>([
    { type: 'MCQ', count: 10, marksPerQuestion: 1, negativeMarks: 0.33 }
  ]);

  // Update subject when prop changes or modal opens
  useEffect(() => {
    if (isOpen && defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [isOpen, defaultSubject]);

  if (!isOpen) return null;

  const totalAllocated = sections.reduce((acc, curr) => acc + curr.count, 0);
  const isOverLimit = totalAllocated > totalAvailableQuestions;

  const addSection = () => {
    setSections([...sections, { type: 'MCQ', count: 5, marksPerQuestion: 2, negativeMarks: 0 }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: keyof typeof sections[0], value: any) => {
    const newSections = [...sections];
    newSections[idx] = { ...newSections[idx], [field]: value };
    setSections(newSections);
  };

  const handleGenerate = (format: 'PDF' | 'EXCEL') => {
    if (isOverLimit) {
        alert("You have selected more questions than are available in the bank!");
        return;
    }
    onGenerate({
      subjectName: subject,
      durationMins: duration,
      sections
    }, format);
  };

  const loadPreset = (type: 'GATE' | 'NET') => {
      if (type === 'GATE') {
          // GATE Approximation: 65 Qs. Mix of 1 and 2 marks.
          setDuration(180);
          setSections([
              { type: 'MCQ', count: 20, marksPerQuestion: 1, negativeMarks: 0.33 },
              { type: 'MCQ', count: 20, marksPerQuestion: 2, negativeMarks: 0.66 },
              { type: 'NAT', count: 10, marksPerQuestion: 1, negativeMarks: 0 },
              { type: 'NAT', count: 10, marksPerQuestion: 2, negativeMarks: 0 },
              { type: 'MSQ', count: 5, marksPerQuestion: 2, negativeMarks: 0 }
          ]);
      } else if (type === 'NET') {
          // UGC NET Approximation: 100 Qs (Paper 2), 2 marks each, no negative.
          setDuration(120);
          setSections([
              { type: 'MCQ', count: 50, marksPerQuestion: 2, negativeMarks: 0 },
              { type: 'MCQ', count: 50, marksPerQuestion: 2, negativeMarks: 0 }
          ]);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Generate Model Question Paper</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* General Config */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject / Test Name</label>
              <input 
                type="text" 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Mins)</label>
              <input 
                type="number" 
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">Section Configuration</h3>
                <div className="flex gap-1 ml-2">
                   <button 
                     onClick={() => loadPreset('GATE')}
                     className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200 flex items-center gap-1"
                   >
                     <LayoutTemplate size={10} /> GATE Pattern
                   </button>
                   <button 
                     onClick={() => loadPreset('NET')}
                     className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded border border-purple-200 hover:bg-purple-200 flex items-center gap-1"
                   >
                     <LayoutTemplate size={10} /> NET Pattern
                   </button>
                </div>
             </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${isOverLimit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              Allocated: {totalAllocated} / {totalAvailableQuestions} Available
            </span>
          </div>

          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={idx} className="flex items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select 
                    value={sec.type}
                    onChange={e => updateSection(idx, 'type', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value="MCQ">MCQ</option>
                    <option value="MSQ">MSQ</option>
                    <option value="NAT">NAT</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Count</label>
                  <input 
                    type="number" 
                    min="1"
                    value={sec.count}
                    onChange={e => updateSection(idx, 'count', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Marks</label>
                  <input 
                    type="number" 
                    value={sec.marksPerQuestion}
                    onChange={e => updateSection(idx, 'marksPerQuestion', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Neg.</label>
                  <input 
                    type="number" 
                    value={sec.negativeMarks}
                    onChange={e => updateSection(idx, 'negativeMarks', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button 
                  onClick={() => removeSection(idx)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded mb-0.5"
                  disabled={sections.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={addSection}
            className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={16} /> Add Section
          </button>
          
          {isOverLimit && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded text-sm text-red-600 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>You have requested {totalAllocated} questions, but only {totalAvailableQuestions} are available in the cleaned bank. Please reduce the count or extract more data.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => handleGenerate('EXCEL')}
            disabled={isOverLimit}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileDown size={18} /> Excel
          </button>
          <button 
            onClick={() => handleGenerate('PDF')}
            disabled={isOverLimit}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileDown size={18} /> PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperConfigModal;