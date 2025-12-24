import Papa from 'papaparse';
import { MCQ } from '../types';

export const generateAndDownloadCSV = (mcqs: MCQ[]) => {
  const data = mcqs.map(q => ({
    qid: q.qid,
    question: q.question,
    a: q.options.a,
    b: q.options.b,
    c: q.options.c,
    d: q.options.d,
    source_type: q.source_type,
    source_name: q.source_name,
    page_or_url: q.page_or_url
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'clean_questions.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
