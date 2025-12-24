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
  
  // AI Generator Mode State
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
                topics // Pass the hardcoded syllabus
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
    
    await scrapeUrls(urls, scraperConfig, (chunk) => {
      newChunks.push(chunk);
    });

    onAddChunks(newChunks);
    setIsScraping(false);
    setUrlsText('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'pdf' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900 bg-gray-50'
          }`}
        >
          <Upload size={18} />
          PDFs
        </button>
        <button
          onClick={() => setActiveTab('scraper')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'scraper' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900 bg-gray-50'
          }`}
        >
          <Terminal size={18} />
          Scraper
        </button>
        <button
          onClick={() => setActiveTab('web')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'web' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900 bg-gray-50'
          }`}
        >
          <Globe size={18} />
          AI Import
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {activeTab === 'pdf' && (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
            <div className="p-4 bg-indigo-50 rounded-full">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upload PDF Documents</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Select a folder or multiple PDF files. The system will extract text page-by-page.
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
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isProcessingPdf ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              {isProcessingPdf ? 'Extracting Text...' : 'Select PDFs'}
            </button>
          </div>
        )}

        {activeTab === 'scraper' && (
           <div className="flex flex-col h-full space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Web Scraper Module</h3>
                  <p className="text-xs text-gray-500">Extracts text from URL list. Use CORS proxy if needed.</p>
                </div>
                <button 
                  onClick={() => setShowScraperConfig(!showScraperConfig)}
                  className={`p-2 rounded-lg hover:bg-gray-100 ${showScraperConfig ? 'bg-gray-100 text-indigo-600' : 'text-gray-500'}`}
                  title="Configure Selectors"
                >
                  <Settings size={18} />
                </button>
              </div>

              {showScraperConfig && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3 text-sm">
                   <h4 className="font-semibold text-gray-700 text-xs uppercase">CSS Selectors (Optional)</h4>
                   <div className="grid grid-cols-2 gap-2">
                      <input 
                        placeholder="Container (e.g. .mcq-box)" 
                        className="px-2 py-1 border rounded bg-white text-gray-900"
                        value={scraperConfig.containerSelector}
                        onChange={e => setScraperConfig({...scraperConfig, containerSelector: e.target.value})}
                      />
                      <input 
                        placeholder="Question (e.g. .q-text)" 
                        className="px-2 py-1 border rounded bg-white text-gray-900"
                        value={scraperConfig.questionSelector}
                        onChange={e => setScraperConfig({...scraperConfig, questionSelector: e.target.value})}
                      />
                      <input 
                        placeholder="Options (e.g. .opt)" 
                        className="px-2 py-1 border rounded bg-white text-gray-900"
                        value={scraperConfig.optionSelector}
                        onChange={e => setScraperConfig({...scraperConfig, optionSelector: e.target.value})}
                      />
                      <div className="flex items-center gap-2">
                         <label className="flex items-center gap-1 cursor-pointer text-gray-700">
                            <input 
                              type="checkbox" 
                              checked={scraperConfig.useProxy}
                              onChange={e => setScraperConfig({...scraperConfig, useProxy: e.target.checked})}
                            />
                            <span>Use Demo Proxy</span>
                         </label>
                      </div>
                   </div>
                </div>
              )}

              <textarea 
                className="flex-1 w-full border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="https://example.com/quiz1&#10;https://example.com/quiz2"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
              />

              <button
                onClick={handleScrape}
                disabled={isScraping || !urlsText.trim()}
                className="w-full py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isScraping ? <Loader2 className="animate-spin" size={18} /> : <Terminal size={18} />}
                {isScraping ? 'Scraping...' : 'Start Scraping'}
              </button>
           </div>
        )}

        {activeTab === 'web' && (
          <div className="flex flex-col h-full items-center justify-center space-y-4 text-center">
             <div className="p-4 bg-emerald-50 rounded-full">
               <Zap className="w-8 h-8 text-emerald-600" />
             </div>
             
             <div>
               <h3 className="text-lg font-semibold text-gray-900">AI Exam Bank Generator</h3>
               <p className="text-sm text-gray-500 mt-1 max-w-sm">
                 Generate exam-quality questions directly from the Knowledge Base.
               </p>
             </div>

             <div className="w-full max-w-md space-y-3">
                 <div className="flex items-center justify-center gap-3 text-sm bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${genMode === 'TOPIC' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-400'}`}>
                            {genMode === 'TOPIC' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input type="radio" checked={genMode === 'TOPIC'} onChange={() => setGenMode('TOPIC')} className="hidden" />
                        <span>Topic Search</span>
                    </label>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-emerald-800">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${genMode === 'FULL' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-400'}`}>
                            {genMode === 'FULL' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input type="radio" checked={genMode === 'FULL'} onChange={() => setGenMode('FULL')} className="hidden" />
                        <span>Full Exam Syllabus</span>
                    </label>
                 </div>

                 {genMode === 'TOPIC' ? (
                     <input 
                        type="text" 
                        value={searchTopic}
                        onChange={(e) => setSearchTopic(e.target.value)}
                        placeholder="Enter Topic (e.g. Fluid Mechanics)"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white text-gray-900 placeholder-gray-400"
                    />
                 ) : (
                    <div className="space-y-2 text-left">
                        <div className="flex gap-2">
                            <select 
                                value={selectedExam}
                                onChange={(e) => setSelectedExam(e.target.value as ExamType)}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="CUSTOM">Custom Stream</option>
                                <option value="GATE">GATE</option>
                                <option value="UGC_NET">UGC NET</option>
                            </select>
                            
                            {selectedExam !== 'CUSTOM' && (
                                <select 
                                    value={selectedStream}
                                    onChange={(e) => setSelectedStream(e.target.value as StreamType)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="CSE">CSE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="ECE">ECE</option>
                                    <option value="ME">Mechanical</option>
                                    <option value="CE">Civil</option>
                                    <option value="CH">Chemical</option>
                                </select>
                            )}
                        </div>

                        {selectedExam === 'CUSTOM' && (
                             <input 
                                type="text" 
                                value={searchTopic}
                                onChange={(e) => setSearchTopic(e.target.value)}
                                placeholder="Enter Stream Name (e.g. IBPS PO)"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                            />
                        )}

                        {selectedExam !== 'CUSTOM' && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200 flex items-center gap-1">
                                <BookOpen size={14} />
                                Will generate using standardized {selectedExam} syllabus for {selectedStream}.
                            </div>
                        )}
                    </div>
                 )}
                 
                 <button 
                   onClick={handleWebAction}
                   disabled={isSearchingWeb || (genMode === 'TOPIC' && !searchTopic)}
                   className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm"
                 >
                   {isSearchingWeb ? <Loader2 className="animate-spin" size={18} /> : (genMode === 'FULL' ? <Zap size={18} fill="currentColor" /> : <Globe size={18} />)}
                   {isSearchingWeb ? 'Processing...' : (genMode === 'FULL' ? 'Start Exam Generation' : 'Find Questions')}
                 </button>
             </div>
             
             {isSearchingWeb && genMode === 'FULL' && (
                <div className="text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1 rounded-full animate-pulse border border-emerald-100">
                    {progressMessage || "AI is thinking..."}
                </div>
             )}

             <div className="bg-yellow-50 p-3 rounded-lg flex items-start gap-2 text-left max-w-md mt-2 border border-yellow-100">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  <strong>Pro Tip:</strong> Questions appear automatically as they are found. {genMode === 'FULL' && "Full generation runs in parallel batches."}
                </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IngestionPanel;