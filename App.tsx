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

  // Ref to hold cleanBank to access in closures if needed, though state is usually fine
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

      if (chunk.status !== 'pending') continue;

      setQueue(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'processing' } : c));

      const extractedMCQs = await cleanChunkWithAI(chunk);

      if (extractedMCQs.length > 0) {
        setCleanBank(prev => [...prev, ...extractedMCQs]);
        setQueue(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'completed' } : c));
      } else {
        setQueue(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'completed' } : c));
      }
      
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

  const handleGeneratePaper = (config: PaperConfig, format: 'PDF' | 'EXCEL') => {
    setIsPaperModalOpen(false);
    const { selected } = selectQuestionsForPaper(cleanBank, config);

    if (format === 'PDF') {
      generatePaperPDF(selected, config);
      setTimeout(() => {
          generateSolutionsPDF(selected, config);
      }, 1000);
    } else {
      generatePaperExcel(selected, config);
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
          logger.info('App', `Starting Bulk Generation. Mode: ${mode}`);

          if (mode === 'MULTI_STREAM' && selection.streams) {
              for (const stream of selection.streams) {
                  let questions: MCQ[] = [];
                  let streamNameForFile = stream;
                  
                  if (stream.includes("Current Session")) {
                      // Use ref to ensure we have latest even if state closure is stale (unlikely but safe)
                      questions = cleanBankRef.current;
                      streamNameForFile = "Current_Session";
                      logger.info('App', `BulkGen: Using Current Session (${questions.length} Qs)`);
                  } else {
                      const result = await fetchQuestionsByStream(stream);
                      questions = result.data || [];
                      logger.info('App', `BulkGen: Fetched ${questions.length} Qs for ${stream}`);
                  }
                  
                  if (questions.length === 0) {
                      errors.push(`Stream '${stream}': No questions found.`);
                      continue;
                  }

                  const streamConfig = { ...config, subjectName: stream.replace(/Current Session.*/, "Mixed Questions") };
                  const { selected, stats } = selectQuestionsForPaper(questions, streamConfig);

                  if (selected.length === 0) {
                      const details = Object.entries(stats).map(([k,v]: any) => `${k}: Req ${v.requested}/Avail ${v.available}`).join(', ');
                      errors.push(`Stream '${stream}': Config mismatch (${details})`);
                      continue;
                  }

                  try {
                    const pdfBlob = generatePaperPDF(selected, streamConfig, true);
                    const solBlob = generateSolutionsPDF(selected, streamConfig, true);

                    if (pdfBlob) files.push({ filename: `${streamNameForFile.replace(/\s+/g,'_')}_QP.pdf`, content: pdfBlob as Blob });
                    if (solBlob) files.push({ filename: `${streamNameForFile.replace(/\s+/g,'_')}_SOL.pdf`, content: solBlob as Blob });
                  } catch (genErr: any) {
                      logger.error('App', `PDF Gen Error for ${stream}`, genErr);
                      errors.push(`Stream '${stream}': PDF Generation failed (${genErr.message})`);
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
              
              if (questions.length === 0) {
                  alert(`No questions found for stream: ${selection.targetStream}.`);
                  setIsBulkGenerating(false);
                  return;
              }

              // Pre-check config availability
              const { selected: testSelect, stats } = selectQuestionsForPaper(questions, config);
              if (testSelect.length === 0) {
                   const details = Object.entries(stats).map(([k,v]: any) => `${k}: Req ${v.requested}/Avail ${v.available}`).join(', ');
                   alert(`Config Mismatch: ${details}`);
                   setIsBulkGenerating(false);
                   return;
              }

              for (let i = 1; i <= selection.setCounts; i++) {
                     const setConfig = { ...config, subjectName: `${selection.targetStream.replace("Current Session", "Mixed")} - Set ${String.fromCharCode(64 + i)}` };
                     const { selected } = selectQuestionsForPaper(questions, setConfig);

                     try {
                        const pdfBlob = generatePaperPDF(selected, setConfig, true);
                        const solBlob = generateSolutionsPDF(selected, setConfig, true);

                        const sanitizedStream = selection.targetStream.replace(/\s+/g,'_');
                        if (pdfBlob) files.push({ filename: `${sanitizedStream}_Set_${i}_QP.pdf`, content: pdfBlob as Blob });
                        if (solBlob) files.push({ filename: `${sanitizedStream}_Set_${i}_SOL.pdf`, content: solBlob as Blob });
                     } catch (genErr: any) {
                        logger.error('App', `Failed to generate set ${i}`, genErr);
                     }
              }
          }

          if (files.length > 0) {
              await createZipBundle(files);
              if (errors.length > 0) {
                  alert(`Generated ${files.length/2} papers with some errors:\n\n${errors.join('\n')}`);
              }
          } else {
              if (errors.length > 0) {
                  alert(`Generation Failed.\n\n${errors.join('\n')}`);
              } else {
                  alert("No files generated. Check logs.");
              }
          }

      } catch (e: any) {
          logger.error('App', 'Bulk Generation Critical Error', e);
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
    logger.info('App', 'Data cleared');
  };

  // Prepare streams list including current session if active
  const effectiveStreams = [...dbStreams];
  if (cleanBank.length > 0) {
      effectiveStreams.unshift(`Current Session (${cleanBank.length} Qs)`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2 rounded-lg">
              <Zap className="text-yellow-400 w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">AutoMCQ <span className="text-gray-400 font-normal">Pipeline</span></h1>
              <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Clean Data Extraction System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
             <button
               onClick={() => setIsSettingsOpen(true)}
               className={`p-2 rounded-lg transition-colors ${isDBConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
               title={isDBConnected ? "Database Connected" : "Connect Database"}
             >
                <Settings size={18} />
             </button>

             <button 
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
             >
                 <FolderDown size={16} /> Bulk Papers
             </button>

             {isAutoSaving ? (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium animate-pulse">
                    <Save size={14} /> Saving...
                </div>
             ) : (
                <div className="text-xs text-gray-400">
                   {cleanBank.length > 0 && cleanBank.length === lastSavedIndex ? 'All Saved' : ''}
                </div>
             )}

             <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                <span className="px-2 text-gray-700 font-medium text-xs">Load DB:</span>
                <select 
                   className="bg-white text-gray-900 text-sm focus:ring-0 cursor-pointer outline-none max-w-[150px] border border-gray-200 rounded px-2 py-1"
                   onChange={(e) => handleLoadFromDB(e.target.value)}
                   value=""
                   disabled={!isDBConnected}
                >
                    <option value="" disabled>{isDBConnected ? "Select Stream" : "No DB"}</option>
                    {dbStreams.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {isLoadingDB && <Loader2 className="w-4 h-4 animate-spin ml-2 text-indigo-500" />}
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50/50 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
          
          {/* Left Column: Input & Controls */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="flex-1 min-h-0">
               <IngestionPanel 
                 onAddChunks={handleAddChunks} 
                 onAddDirectMCQs={handleAddDirectMCQs}
               />
            </div>
            <div className="flex-1 min-h-0">
               <ProcessingPanel 
                 queue={queue} 
                 stats={stats} 
                 isProcessing={isProcessing}
                 onStartProcessing={processQueue}
               />
            </div>
          </div>

          {/* Right Column: Data View */}
          <div className="col-span-12 lg:col-span-8 h-full">
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