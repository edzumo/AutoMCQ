import React from 'react';
import { MCQ } from '../types';
import { Download, Trash2, Database, Search, FileText, Save, Loader2 } from 'lucide-react';
import { saveQuestionsToDB } from '../services/dbService';

interface ResultsTableProps {
  mcqs: MCQ[];
  onDownload: () => void;
  onClear: () => void;
  onGeneratePaper?: () => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ mcqs, onDownload, onClear, onGeneratePaper }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const filtered = mcqs.filter(q => 
    q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.source_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveToDB = async () => {
    if (mcqs.length === 0) return;
    setIsSaving(true);
    await saveQuestionsToDB(mcqs);
    setIsSaving(false);
    alert('Saved to Database!');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
           <div className="p-2 bg-purple-50 rounded-lg">
             <Database className="w-5 h-5 text-purple-600" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900">Clean Question Bank</h2>
             <p className="text-xs text-gray-500">{mcqs.length} valid records ready</p>
           </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search questions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
          
          <button 
            onClick={onClear}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Clear All"
          >
            <Trash2 size={18} />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={handleSaveToDB}
            disabled={mcqs.length === 0 || isSaving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-colors"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save to DB
          </button>

          {onGeneratePaper && (
            <button
              onClick={onGeneratePaper}
              disabled={mcqs.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-colors"
            >
              <FileText size={16} />
              Generate Paper
            </button>
          )}

          <button
            onClick={onDownload}
            disabled={mcqs.length === 0}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Subject/Source</th>
              <th className="px-6 py-3 font-medium text-gray-500">Type</th>
              <th className="px-6 py-3 font-medium text-gray-500">Question</th>
              <th className="px-6 py-3 font-medium text-gray-500">Answer</th>
              <th className="px-6 py-3 font-medium text-gray-500">Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
               <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  {mcqs.length === 0 ? "No data generated yet. Start the pipeline." : "No matches found."}
                </td>
               </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.qid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 max-w-[200px] truncate text-gray-500">
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-900 truncate">{q.topic || q.source_name}</span>
                        <span className="text-xs text-indigo-500">{q.stream || q.source_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-indigo-600 font-bold">
                    {q.type}
                  </td>
                  <td className="px-6 py-3 max-w-[300px] truncate font-medium text-gray-800" title={q.question}>
                    {q.question}
                  </td>
                  <td className="px-6 py-3 max-w-[100px] truncate text-emerald-600 font-medium" title={q.answer}>
                    {q.answer || '-'}
                  </td>
                  <td className="px-6 py-3 max-w-[200px] truncate text-gray-500">
                     {q.type === 'NAT' ? (
                        <span className="italic text-gray-400">No Options (NAT)</span>
                     ) : (
                        `${q.options.a} / ${q.options.b} ...`
                     )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;