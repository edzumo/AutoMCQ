import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RawChunk, MCQ, ProcessingStats, PaperConfig } from './types';
import IngestionPanel from './components/IngestionPanel';
import ProcessingPanel from './components/ProcessingPanel';
import ResultsTable from './components/ResultsTable';
import PaperConfigModal from './components/PaperConfigModal';
import BulkPaperModal from './components/BulkPaperModal';
import SettingsModal from './components/SettingsModal';
import { cleanChunkWithAI } from './services/geminiService';
import { generateAndDownloadCSV } from './services/csvService';
import { generatePaperPDF, generatePaperExcel, generateSolutionsPDF, shuffleArray, createZipBundle } from './services/exportService';
import { fetchQuestionsByStream, getAvailableStreams, saveQuestionsToDB } from './services/dbService';
import { supabaseManager } from './services/supabaseClient';
import { logger } from './services/loggerService';
import { Layers, Zap, Cloud, Loader2, Save, FolderDown, Settings } from 'lucide-react';

const AUTO_SAVE_THRESHOLD = 10;

const App: React.FC = () => {
  const [queue, setQueue] = useState<RawChunk[]>([]);
  const [cleanBank, setCleanBank] = useState<MCQ[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  
  const [activeStream, setActiveStream] = useState<string>('');
  const [dbStreams, setDbStreams] = useState<string[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);
  const [isDBConnected, setIsDBConnected] = useState(false);
  
  const [lastSavedIndex, setLastSavedIndex] = useState(0);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  // Ref to hold cleanBank to access in closures if needed
  const cleanBankRef = useRef<MCQ[]>([]);
  useEffect(() => { cleanBankRef.current = cleanBank; }, [cleanBank]);

  useEffect(() => {
    logger.info('System', 'Application initialized');
    checkDBConnection();
  }, []);

  const checkDBConnection = async () => {
      const connected = supabaseManager.isConnected();
      setIsDBConnected(connected);
      if (connected) {
          loadStreams();
      }
  };

  useEffect(() => {
    const unsavedCount = cleanBank.length - lastSavedIndex;
    if (unsavedCount >= AUTO_SAVE_THRESHOLD && !isAutoSaving && isDBConnected) {
        performAutoSave();
    }
  }, [cleanBank, lastSavedIndex, isAutoSaving, isDBConnected]);

  const performAutoSave = async () => {
    if (cleanBank.length === lastSavedIndex) return;
    
    setIsAutoSaving(true);
    const questionsToSave = cleanBank.slice(lastSavedIndex);
    
    try {
        await saveQuestionsToDB(questionsToSave);
        setLastSavedIndex(cleanBank.length);
        logger.info('App', `Auto-saved ${questionsToSave.length} questions`);
    } catch (error) {
        logger.error('App', 'Auto-save failed', error);
    } finally {
        setIsAutoSaving(false);
        loadStreams();
    }
  };

  const loadStreams = async () => {
      const streams = await getAvailableStreams();
      setDbStreams(streams);
  };

  const stats: ProcessingStats = {
    totalChunks: queue.length,
    processedChunks: processedCount,
    questionsFound: cleanBank.length,
    failedChunks: queue.filter(q => q.status === 'failed').length
  };

  const handleAddChunks = (newChunks: RawChunk[]) => {
    setQueue(prev => [...prev, ...newChunks]);
    logger.info('App', `Added ${newChunks.length} chunks to queue`);
  };

  const handleAddDirectMCQs = (newQuestions: MCQ[]) => {
    setCleanBank(prev => [...prev, ...newQuestions]);
    if (newQuestions.length > 0 && newQuestions[0].stream) {
        setActiveStream(newQuestions[0].stream);
    }
    logger.info('App', `Added ${newQuestions.length} direct MCQs`);
  };

  const handleLoadFromDB = async (stream: string) => {
      setIsLoadingDB(true);
      const { data } = await fetchQuestionsByStream(stream);
      if (data && data.length > 0) {
          if (cleanBank.length > 0 && !window.confirm("Loading from DB will clear current questions. Continue?")) {
             setIsLoadingDB(false);
             return;
          }
          
          setCleanBank(data);
          setLastSavedIndex(data.length);
          setActiveStream(stream);
          logger.info('App', `Loaded ${data.length} questions from DB for ${stream}`);
      } else {
          alert('No questions found in DB for this stream.');
      }
      setIsLoadingDB(false);
  };

  const processQueue = useCallback(async () => {
    setIsProcessing(true);
    logger.info('App', 'Started batch processing');
    
    const queueCopy = [...queue];
    
    for (let i = 0; i < queueCopy.length; i++) {
      const chunk = queueCopy[i];
      if (chunk.status !== 'pending' && chunk.status !== 'failed') continue;

      setQueue(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'processing' } : c));
      const extractedMCQs = await cleanChunkWithAI(chunk);

      if (extractedMCQs.length > 0) {
        setCleanBank(prev => [...prev, ...extractedMCQs]);
      }
      setQueue(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'completed' } : c));
      
      setProcessedCount(prev => prev + 1);
      await new Promise(r => setTimeout(r, 500));
    }

    setIsProcessing(false);
    logger.info('App', 'Batch processing finished');
  }, [queue]);

  const handleDownloadCSV = () => {
    generateAndDownloadCSV(cleanBank);
  };

  const selectQuestionsForPaper = (pool: MCQ[], config: PaperConfig): { selected: MCQ[], stats: any } => {
      let selected: MCQ[] = [];
      const stats: any = {};

      for (const section of config.sections) {
          const typeQs = pool.filter(q => q.type === section.type);
          stats[section.type] = { available: typeQs.length, requested: section.count };
          
          const shuffled = shuffleArray(typeQs);
          selected = [...selected, ...shuffled.slice(0, section.count)];
      }
      return { selected, stats };
  };

  const handleGeneratePaper = async (config: PaperConfig, format: 'PDF' | 'EXCEL') => {
    setIsPaperModalOpen(false);
    setIsGeneratingSingle(true);
    
    const { selected } = selectQuestionsForPaper(cleanBank, config);

    try {
        if (format === 'PDF') {
          await generatePaperPDF(selected, config);
          setTimeout(async () => {
              await generateSolutionsPDF(selected, config);
              setIsGeneratingSingle(false);
          }, 500);
        } else {
          generatePaperExcel(selected, config);
          setIsGeneratingSingle(false);
        }
    } catch (e) {
        logger.error('App', 'Single generation failed', e);
        setIsGeneratingSingle(false);
    }
  };

  const handleBulkGenerate = async (
    mode: 'MULTI_STREAM' | 'MULTI_SET', 
    config: PaperConfig, 
    selection: { streams?: string[], targetStream?: string, setCounts?: number }
  ) => {
      setIsBulkGenerating(true);
      const files: {filename: string, content: Blob}[] = [];
      const errors: string[] = [];

      try {
          if (mode === 'MULTI_STREAM' && selection.streams) {
              for (const stream of selection.streams) {
                  let questions: MCQ[] = [];
                  let streamNameForFile = stream;
                  
                  if (stream.includes("Current Session")) {
                      questions = cleanBankRef.current;
                      streamNameForFile = "Current_Session";
                  } else {
                      const result = await fetchQuestionsByStream(stream);
                      questions = result.data || [];
                  }
                  
                  if (questions.length === 0) {
                      errors.push(`Stream '${stream}': No questions found.`);
                      continue;
                  }

                  const streamConfig = { ...config, subjectName: stream.replace(/Current Session.*/, "Mixed Questions") };
                  const { selected } = selectQuestionsForPaper(questions, streamConfig);

                  if (selected.length === 0) continue;

                  try {
                    const pdfBlob = await generatePaperPDF(selected, streamConfig, true);
                    const solBlob = await generateSolutionsPDF(selected, streamConfig, true);

                    if (pdfBlob) files.push({ filename: `${streamNameForFile.replace(/\s+/g,'_')}_QP.pdf`, content: pdfBlob as Blob });
                    if (solBlob) files.push({ filename: `${streamNameForFile.replace(/\s+/g,'_')}_SOL.pdf`, content: solBlob as Blob });
                  } catch (genErr: any) {
                      errors.push(`Stream '${stream}': PDF Error`);
                  }
              }
          } 
          else if (mode === 'MULTI_SET' && selection.targetStream && selection.setCounts) {
              let questions: MCQ[] = [];
              if (selection.targetStream.includes("Current Session")) {
                  questions = cleanBankRef.current;
              } else {
                  const result = await fetchQuestionsByStream(selection.targetStream);
                  questions = result.data || [];
              }
              
              if (questions.length > 0) {
                 for (let i = 1; i <= selection.setCounts; i++) {
                     const setConfig = { ...config, subjectName: `${selection.targetStream.replace("Current Session", "Mixed")} - Set ${String.fromCharCode(64 + i)}` };
                     const { selected } = selectQuestionsForPaper(questions, setConfig);

                     try {
                        const pdfBlob = await generatePaperPDF(selected, setConfig, true);
                        const solBlob = await generateSolutionsPDF(selected, setConfig, true);
                        const sanitizedStream = selection.targetStream.replace(/\s+/g,'_');
                        if (pdfBlob) files.push({ filename: `${sanitizedStream}_Set_${i}_QP.pdf`, content: pdfBlob as Blob });
                        if (solBlob) files.push({ filename: `${sanitizedStream}_Set_${i}_SOL.pdf`, content: solBlob as Blob });
                     } catch (genErr) {}
                 }
              }
          }

          if (files.length > 0) {
              await createZipBundle(files);
              if (errors.length > 0) alert(`Generated ${files.length/2} papers with some errors.`);
          } else {
              alert("Generation Failed or No Files.");
          }

      } catch (e: any) {
          alert(`Error: ${e.message}`);
      } finally {
          setIsBulkGenerating(false);
          setIsBulkModalOpen(false);
      }
  };

  const handleClear = () => {
    setCleanBank([]);
    setQueue([]);
    setLastSavedIndex(0);
    setProcessedCount(0);
    setActiveStream('');
    logger.clear();
  };

  const effectiveStreams = [...dbStreams];
  if (cleanBank.length > 0) {
      effectiveStreams.unshift(`Current Session (${cleanBank.length} Qs)`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 pointer-events-none z-0" />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-40 transition-all">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2.5 rounded-xl shadow-lg shadow-indigo-100">
              <Zap className="text-yellow-400 w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">AutoMCQ <span className="text-gray-400 font-medium">Pro</span></h1>
              <p className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase mt-1">Intelligent Extraction Pipeline</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
             {isGeneratingSingle && (
                 <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-full animate-pulse border border-indigo-100 whitespace-nowrap">
                     <Loader2 size={12} className="animate-spin" /> Generating PDF...
                 </div>
             )}

             <div className="flex items-center gap-2 bg-gray-100/50 rounded-xl p-1 border border-gray-200/50">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`p-2 rounded-lg transition-all ${isDBConnected ? 'bg-white shadow-sm text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title={isDBConnected ? "Database Connected" : "Connect Database"}
                >
                    <Settings size={16} />
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <select 
                   className="bg-transparent text-gray-700 text-xs font-medium focus:ring-0 cursor-pointer outline-none w-[120px] py-1"
                   onChange={(e) => handleLoadFromDB(e.target.value)}
                   value=""
                   disabled={!isDBConnected}
                >
                    <option value="" disabled>{isDBConnected ? "Load Project" : "No DB"}</option>
                    {dbStreams.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {isLoadingDB && <Loader2 className="w-3 h-3 animate-spin mr-2 text-indigo-500" />}
             </div>

             <button 
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 px-3 py-2 rounded-xl font-medium transition-all border border-gray-200 hover:border-indigo-100 shadow-sm whitespace-nowrap"
             >
                 <FolderDown size={16} /> <span className="hidden sm:inline">Bulk Ops</span>
             </button>

             {isAutoSaving && (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium animate-pulse whitespace-nowrap">
                    <Save size={14} /> Saving...
                </div>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 relative z-10">
        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-6 h-full lg:h-[calc(100vh-9rem)]">
          
          {/* Left Column: Input & Controls */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-auto lg:h-full lg:overflow-hidden">
            <div className="flex-none lg:flex-1 min-h-0 bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <IngestionPanel 
                 onAddChunks={handleAddChunks} 
                 onAddDirectMCQs={handleAddDirectMCQs}
               />
            </div>
            <div className="flex-none lg:flex-1 min-h-0 bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <ProcessingPanel 
                 queue={queue} 
                 stats={stats} 
                 isProcessing={isProcessing}
                 onStartProcessing={processQueue}
               />
            </div>
          </div>

          {/* Right Column: Data View */}
          <div className="col-span-12 lg:col-span-8 h-[600px] lg:h-full bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
             <ResultsTable 
               mcqs={cleanBank} 
               onDownload={handleDownloadCSV}
               onClear={handleClear}
               onGeneratePaper={() => setIsPaperModalOpen(true)}
             />
          </div>
        </div>
      </main>

      <PaperConfigModal 
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        onGenerate={handleGeneratePaper}
        totalAvailableQuestions={cleanBank.length}
        defaultSubject={activeStream}
      />

      <BulkPaperModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        availableStreams={effectiveStreams}
        onGenerateBulk={handleBulkGenerate}
        isGenerating={isBulkGenerating}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigSaved={checkDBConnection}
      />
    </div>
  );
};

export default App;