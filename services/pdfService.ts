import { RawChunk } from '../types';
import { logger } from './loggerService';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const extractTextFromPdf = async (file: File): Promise<RawChunk[]> => {
  logger.info('PDFService', `Starting PDF extraction for: ${file.name}`);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const chunks: RawChunk[] = [];
    const totalPages = pdf.numPages;

    logger.info('PDFService', `PDF loaded. Pages: ${totalPages}`, { fileName: file.name });

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str).join(' ');
        
        if (textItems.length > 50) {
          chunks.push({
            id: crypto.randomUUID(),
            text: textItems,
            source_type: 'PDF',
            source_name: file.name,
            page_or_url: `Page ${i}`,
            status: 'pending'
          });
        } else {
            logger.warn('PDFService', `Skipping empty/low-content page`, { fileName: file.name, page: i });
        }
      } catch (pageError: any) {
        logger.error('PDFService', `Error extracting page ${i}`, { fileName: file.name, error: pageError.message });
      }
    }

    logger.info('PDFService', `Finished extraction. Generated ${chunks.length} chunks.`, { fileName: file.name });
    return chunks;
  } catch (error: any) {
    logger.error('PDFService', `Fatal error reading PDF`, { fileName: file.name, error: error.message });
    throw error;
  }
};
