export interface MCQ {
  qid: string;
  type: 'MCQ' | 'MSQ' | 'NAT'; 
  stream?: string; // e.g. "Computer Science"
  topic?: string;  // e.g. "Algorithms"
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  answer?: string;      
  explanation?: string; 
  source_type: 'PDF' | 'WEB' | 'SCRAPER' | 'DB';
  source_name: string;
  page_or_url: string;
  imageUrl?: string; // New field for diagrams
}

export interface RawChunk {
  id: string;
  text: string;
  source_type: 'PDF' | 'WEB' | 'SCRAPER';
  source_name: string;
  page_or_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount?: number;
}

export enum AppState {
  INGESTION = 'INGESTION',
  PROCESSING = 'PROCESSING',
  RESULTS = 'RESULTS'
}

export interface ProcessingStats {
  totalChunks: number;
  processedChunks: number;
  questionsFound: number;
  failedChunks: number;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  meta?: any;
}

export interface ScraperConfig {
  containerSelector?: string;
  questionSelector?: string;
  optionSelector?: string;
  answerSelector?: string;
  useProxy?: boolean; 
  rateLimitMs?: number;
}

export interface PaperConfig {
  subjectName: string;
  durationMins: number;
  sections: {
    type: 'MCQ' | 'MSQ' | 'NAT';
    count: number;
    marksPerQuestion: number;
    negativeMarks: number;
  }[];
}