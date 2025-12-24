import React from 'react';
import { MCQ } from '../types';
import { Download, Trash2, Database, Search, FileText, Save, Loader2, ChevronDown } from 'lucide-react';
import { saveQuestionsToDB } from '../services/dbService';
import katex from 'katex';

declare global {
  interface Window {
    katex: any;
  }
}

interface ResultsTableProps {
  mcqs: MCQ[];
  onDownload: () => void;
  onClear: () => void;
  onGeneratePaper?: () => void;
}

const LatexRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return <span>-</span>;
  
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?:\$[^$\n]+\$))/g;
  const parts = text.split(regex);

  const getKatex = () => {
    return (typeof katex !== 'undefined' && katex.renderToString) ? katex : (window.katex || null);
  };

  return (
    <span>
      {parts.map((part, index) => {
        let latex = '';
        let isDisplay = false;

        if (part.startsWith('$$') && part.endsWith('$$')) {
           latex = part.slice(2, -2);
           isDisplay = true;
        } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
           latex = part.slice(2, -2);
           isDisplay = true;
        } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
           latex = part.slice(2, -2);
           isDisplay = false;
        } else if (part.startsWith('$') && part.endsWith('$')) {
           latex = part.slice(1, -1);
           isDisplay = false;
        } else {
           return <span key={index}>{part}</span>;
        }

        try {
           const k = getKatex();
           if (!k) return <span key={index} className="text-red-500 font-mono text-xs">{part}</span>;
           const html = k.renderToString(latex, { throwOnError: false, displayMode: isDisplay });
           return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
           return <span key={index} className="text-red-500 font-mono text-xs" title="Render Error">{part}</span>;
        }
      })}
    </span>
  );
};

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
    <div className="flex flex-col h-full bg-white">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
             <Database size={20} />
           </div>
           <div>
             <h2 className="font-bold text-gray-900 text-sm md:text-base">Question Bank</h2>
             <p className="text-xs text-gray-500 font-medium">{mcqs.length} items ready</p>
           </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto md:ml-0">
             <button 
                onClick={onClear}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Clear All"
             >
                <Trash2 size={18} />
             </button>
             
             <button
                onClick={handleSaveToDB}
                disabled={mcqs.length === 0 || isSaving}
                className="hidden md:flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-colors"
             >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span className="hidden lg:inline">Save</span>
             </button>

             {onGeneratePaper && (
                <button
                onClick={onGeneratePaper}
                disabled={mcqs.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-colors"
                >
                <FileText size={16} />
                <span className="hidden lg:inline">Paper</span>
                </button>
             )}

             <button
                onClick={onDownload}
                disabled={mcqs.length === 0}
                className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium shadow-sm"
             >
                <Download size={16} />
                <span className="hidden lg:inline">CSV</span>
             </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50/50 p-2 md:p-0">
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 pb-20">
           {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                   {mcqs.length === 0 ? "No questions generated yet." : "No matches found."}
                </div>
           ) : (
                filtered.map(q => (
                    <div key={q.qid} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">{q.type}</span>
                            <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{q.source_name}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">
                            <LatexRenderer text={q.question} />
                            {q.imageUrl && <img src={q.imageUrl} alt="Diagram" className="mt-2 rounded border border-gray-200 max-h-32" />}
                        </div>
                        {q.type !== 'NAT' && (
                            <div className="space-y-1 text-xs text-gray-600 pl-2 border-l-2 border-gray-100">
                                <div className="flex gap-2"><span className="font-semibold text-gray-400">A</span> <LatexRenderer text={q.options.a} /></div>
                                <div className="flex gap-2"><span className="font-semibold text-gray-400">B</span> <LatexRenderer text={q.options.b} /></div>
                                <div className="flex gap-2"><span className="font-semibold text-gray-400">C</span> <LatexRenderer text={q.options.c} /></div>
                                <div className="flex gap-2"><span className="font-semibold text-gray-400">D</span> <LatexRenderer text={q.options.d} /></div>
                            </div>
                        )}
                        <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-xs font-semibold text-emerald-600">Ans: <LatexRenderer text={q.answer || '?'} /></span>
                        </div>
                    </div>
                ))
           )}
        </div>

        {/* Desktop Table View */}
        <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider w-1/3">Question</th>
              <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Answer</th>
              <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider w-1/3">Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
               <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                   <div className="flex flex-col items-center gap-2">
                      <Search size={32} strokeWidth={1.5} className="opacity-20" />
                      <p>{mcqs.length === 0 ? "Pipeline is empty. Start extracting." : "No matching questions."}</p>
                   </div>
                </td>
               </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.qid} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4 max-w-[150px] truncate">
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-900 truncate" title={q.topic || q.source_name}>{q.topic || q.source_name}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{q.stream || q.source_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                        q.type === 'MCQ' ? 'bg-indigo-50 text-indigo-700' :
                        q.type === 'MSQ' ? 'bg-purple-50 text-purple-700' :
                        'bg-orange-50 text-orange-700'
                    }`}>
                        {q.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-[400px] whitespace-normal">
                    <div className="font-medium text-gray-800 leading-relaxed text-sm line-clamp-3 group-hover:line-clamp-none transition-all">
                        <LatexRenderer text={q.question} />
                    </div>
                    {q.imageUrl && (
                        <a href={q.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                            View Diagram
                        </a>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-emerald-600">
                    <LatexRenderer text={q.answer || '-'} />
                  </td>
                  <td className="px-6 py-4 max-w-[300px] whitespace-normal text-gray-500 text-xs">
                     {q.type === 'NAT' ? (
                        <span className="italic text-gray-400">Numerical Input</span>
                     ) : (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex gap-1 truncate" title={q.options.a}><span className="font-bold text-gray-300">A</span> <LatexRenderer text={q.options.a} /></div>
                            <div className="flex gap-1 truncate" title={q.options.b}><span className="font-bold text-gray-300">B</span> <LatexRenderer text={q.options.b} /></div>
                            <div className="flex gap-1 truncate" title={q.options.c}><span className="font-bold text-gray-300">C</span> <LatexRenderer text={q.options.c} /></div>
                            <div className="flex gap-1 truncate" title={q.options.d}><span className="font-bold text-gray-300">D</span> <LatexRenderer text={q.options.d} /></div>
                        </div>
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