import { supabaseManager } from './supabaseClient';
import { MCQ } from '../types';
import { logger } from './loggerService';

export const saveQuestionsToDB = async (questions: MCQ[]) => {
  const supabase = supabaseManager.getClient();
  
  if (!supabase) {
    logger.warn('DBService', 'Supabase not configured. Skipping save.');
    return { error: 'Supabase not configured' };
  }

  logger.info('DBService', `Attempting to save ${questions.length} questions to DB`);

  const rows = questions.map(q => ({
    qid: q.qid,
    stream: q.stream || 'General',
    topic: q.topic || 'General',
    type: q.type,
    question: q.question,
    options: q.options, // stored as JSONB
    answer: q.answer,
    explanation: q.explanation,
    source_name: q.source_name
  }));

  const { data, error } = await supabase
    .from('questions')
    .upsert(rows, { onConflict: 'qid' });

  if (error) {
    logger.error('DBService', 'Failed to save questions', error);
    return { error };
  }

  logger.info('DBService', 'Questions saved successfully');
  return { data };
};

export const fetchQuestionsByStream = async (stream: string) => {
  const supabase = supabaseManager.getClient();
  if (!supabase) return { data: [] };

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .ilike('stream', `%${stream}%`);

  if (error) {
    logger.error('DBService', 'Failed to fetch questions', error);
    return { data: [] };
  }

  // Map DB rows back to MCQ objects
  const mcqs: MCQ[] = (data || []).map((row: any) => ({
    qid: row.qid,
    type: row.type,
    stream: row.stream,
    topic: row.topic,
    question: row.question,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation,
    source_type: 'DB',
    source_name: row.source_name,
    page_or_url: 'Database Archive'
  }));

  return { data: mcqs };
};

export const getAvailableStreams = async () => {
  const supabase = supabaseManager.getClient();
  if (!supabase) return [];
  
  // Get unique streams
  const { data, error } = await supabase
    .from('questions')
    .select('stream'); 
    
  if (error) return [];
  
  const streams = Array.from(new Set(data.map((d: any) => d.stream)));
  return streams.filter(Boolean);
};
