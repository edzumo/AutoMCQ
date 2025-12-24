import React, { useState, useRef } from 'react';
import { Upload, Globe, FileText, Loader2, Plus, AlertCircle, Terminal, Settings, Zap, BookOpen } from 'lucide-react';
import { extractTextFromPdf } from '../services/pdfService';
import { searchAndExtractWebQuestions, generateFullExamBank } from '../services/geminiService';
import { scrapeUrls } from '../services/scrapingService';
import { RawChunk, MCQ, ScraperConfig } from '../types';
import { logger } from '../services/loggerService';
import { getExamTopics, ExamType, StreamType } from '../services/syllabusData';

interface IngestionPanelProps {
  onAddChunks: (chunks: RawChunk[]) => void;
  onAddDirectMCQs: (mcqs: MCQ[]) => void;
}

const IngestionPanel: React.FC<IngestionPanelProps> = ({ onAddChunks, onAddDirectMCQs }) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'web' | 'scraper'>('pdf');
  
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [searchTopic, setSearchTopic] = useState('');
  
  const [genMode, setGenMode] = useState<'TOPIC' | 'FULL'>('TOPIC');
  const [selectedExam, setSelectedExam] = useState<ExamType>('CUSTOM');
  const [selectedStream, setSelectedStream] = useState<StreamType>('CSE');

  const [progressMessage, setProgressMessage] = useState('');

  const [isScraping, setIsScraping] = useState(false);
  const [urlsText, setUrlsText] = useState('');
  const [showScraperConfig, setShowScraperConfig] = useState(false);
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig>({
    containerSelector: '',
    questionSelector: '',
    optionSelector: '',
    useProxy: true,
    rateLimitMs: 1000
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsProcessingPdf(true);
    
    const files = Array.from(e.target.files);
    let allChunks: RawChunk[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        try {
          const chunks = await extractTextFromPdf(file);
          allChunks = [...allChunks, ...chunks];
        } catch (err: any) {
          logger.error('IngestionPanel', `Failed to parse ${file.name}`, err);
        }
      }
    }

    onAddChunks(allChunks);
    setIsProcessingPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleWebAction = async () => {
    if (genMode === 'TOPIC' && !searchTopic.trim()) return;
    
    setIsSearchingWeb(true);
    setProgressMessage('Initializing...');

    if (genMode === 'FULL') {
        try {
            let streamLabel = searchTopic;
            let topics: string[] = [];
            
            if (selectedExam !== 'CUSTOM') {
                streamLabel = `${selectedExam} ${selectedStream}`;
                topics = getExamTopics(selectedExam, selectedStream);
            }

            await generateFullExamBank(
                streamLabel, 
                (msg) => setProgressMessage(msg),
                (questions) => onAddDirectMCQs(questions),
                topics 
            );
        } catch (e) {
            logger.error('IngestionPanel', 'Full Exam Generation Failed', e);
            setProgressMessage('Error occurred during generation.');
        }
    } else {
        const questions = await searchAndExtractWebQuestions(searchTopic);
        onAddDirectMCQs(questions);
    }

    setIsSearchingWeb(false);
    setSearchTopic('');
    setProgressMessage('');
  };

  const handleScrape = async () => {
    const urls = urlsText.split('\n').filter(u => u.trim().length > 0);
    if (urls.length === 0) return;

    setIsScraping(true);
    const newChunks: RawChunk[] = [];
    await scrapeUrls(urls, scraperConfig, (chunk) => newChunks.push(chunk));
    onAddChunks(newChunks);
    setIsScraping(false);
    setUrlsText('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex p-2 bg-gray-50/50 border-b border-gray-100 gap-1">
        {[
            { id: 'pdf', icon: Upload, label: 'PDF Upload' },
            { id: 'web', icon: Globe, label: 'AI Generator' },
            { id: 'scraper', icon: Terminal, label: 'Web Scraper' }
        ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {activeTab === 'pdf' && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="p-5 bg-indigo-50 rounded-2xl shadow-inner">
              <FileText className="w-10 h-10 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Upload PDF Documents</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                Bulk upload exam papers. We'll split them into chunks automatically.
              </p>
            </div>
            
            <input
              type="file"
              multiple
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPdf}
              className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              {isProcessingPdf ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              {isProcessingPdf ? 'Extracting...' : 'Select Files'}
            </button>
          </div>
        )}

        {activeTab === 'scraper' && (
           <div className="flex flex-col h-full space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Web Scraper</h3>
                  <p className="text-xs text-gray-500">Extract content from URLs</p>
                </div>
                <button 
                  onClick={() => setShowScraperConfig(!showScraperConfig)}
                  className={`p-2 rounded-lg hover:bg-gray-100 ${showScraperConfig ? 'bg-gray-100 text-indigo-600' : 'text-gray-400'}`}
                >
                  <Settings size={18} />
                </button>
              </div>

              {showScraperConfig && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 text-sm animate-in fade-in slide-in-from-top-2">
                   <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Advanced Selectors</h4>
                   <div className="grid grid-cols-1 gap-2">
                      <input 
                        placeholder="Container CSS (e.g. .mcq-box)" 
                        className="input-field"
                        value={scraperConfig.containerSelector}
                        onChange={e => setScraperConfig({...scraperConfig, containerSelector: e.target.value})}
                      />
                      <label className="flex items-center gap-2 cursor-pointer text-gray-600 text-xs pt-1">
                            <input 
                              type="checkbox" 
                              checked={scraperConfig.useProxy}
                              onChange={e => setScraperConfig({...scraperConfig, useProxy: e.target.checked})}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Enable CORS Proxy</span>
                      </label>
                   </div>
                </div>
              )}

              <textarea 
                className="flex-1 w-full border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none transition-all placeholder:text-gray-400"
                placeholder="https://example.com/quiz1&#10;https://example.com/quiz2"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
              />

              <button
                onClick={handleScrape}
                disabled={isScraping || !urlsText.trim()}
                className="w-full py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-md transition-all"
              >
                {isScraping ? <Loader2 className="animate-spin" size={18} /> : <Terminal size={18} />}
                {isScraping ? 'Scraping...' : 'Start Extraction'}
              </button>
           </div>
        )}

        {activeTab === 'web' && (
          <div className="flex flex-col h-full items-center justify-center space-y-5 text-center">
             <div className="p-4 bg-emerald-50 rounded-2xl shadow-inner">
               <Zap className="w-8 h-8 text-emerald-600" />
             </div>
             
             <div>
               <h3 className="text-lg font-bold text-gray-900">AI Exam Generator</h3>
               <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                 Create exam-quality questions from our Knowledge Base.
               </p>
             </div>

             <div className="w-full max-w-sm space-y-4">
                 <div className="flex bg-gray-100/80 p-1 rounded-xl">
                     <button 
                        onClick={() => setGenMode('TOPIC')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${genMode === 'TOPIC' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                         Single Topic
                     </button>
                     <button 
                        onClick={() => setGenMode('FULL')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${genMode === 'FULL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                         Full Syllabus
                     </button>
                 </div>

                 {genMode === 'TOPIC' ? (
                     <input 
                        type="text" 
                        value={searchTopic}
                        onChange={(e) => setSearchTopic(e.target.value)}
                        placeholder="Enter Topic (e.g. Thermodynamics)"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900 text-sm shadow-sm"
                    />
                 ) : (
                    <div className="space-y-3 text-left">
                        <div className="grid grid-cols-2 gap-2">
                            <select 
                                value={selectedExam}
                                onChange={(e) => setSelectedExam(e.target.value as ExamType)}
                                className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value="CUSTOM">Custom</option>
                                <option value="GATE">GATE</option>
                                <option value="UGC_NET">UGC NET</option>
                            </select>
                            
                            {selectedExam !== 'CUSTOM' && (
                                <select 
                                    value={selectedStream}
                                    onChange={(e) => setSelectedStream(e.target.value as StreamType)}
                                    className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="CSE">CSE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="ECE">ECE</option>
                                    <option value="ME">Mech</option>
                                    <option value="CE">Civil</option>
                                </select>
                            )}
                        </div>

                        {selectedExam === 'CUSTOM' && (
                             <input 
                                type="text" 
                                value={searchTopic}
                                onChange={(e) => setSearchTopic(e.target.value)}
                                placeholder="Exam Name (e.g. CAT 2024)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 text-sm"
                            />
                        )}
                    </div>
                 )}
                 
                 <button 
                   onClick={handleWebAction}
                   disabled={isSearchingWeb || (genMode === 'TOPIC' && !searchTopic)}
                   className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-200 font-medium"
                 >
                   {isSearchingWeb ? <Loader2 className="animate-spin" size={18} /> : (genMode === 'FULL' ? <Zap size={18} fill="currentColor" /> : <Globe size={18} />)}
                   {isSearchingWeb ? 'Generating...' : (genMode === 'FULL' ? 'Generate Full Exam' : 'Find Questions')}
                 </button>
             </div>
             
             {isSearchingWeb && genMode === 'FULL' && (
                <div className="text-xs text-emerald-700 font-medium bg-emerald-50 px-4 py-2 rounded-full animate-pulse border border-emerald-100 shadow-sm">
                    {progressMessage || "AI Agent working..."}
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IngestionPanel;