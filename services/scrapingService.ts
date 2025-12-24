import { RawChunk, ScraperConfig } from '../types';
import { logger } from './loggerService';

const DEFAULT_CONFIG: ScraperConfig = {
  rateLimitMs: 1000,
  useProxy: true // Defaulting to true for browser-based demo to bypass CORS often
};

const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"; // NOTE: Demo proxy. In production, use own proxy.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const scrapeUrls = async (
  urls: string[], 
  config: ScraperConfig = DEFAULT_CONFIG,
  onChunkFound: (chunk: RawChunk) => void
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  for (const url of urls) {
    const cleanUrl = url.trim();
    if (!cleanUrl) continue;

    try {
      logger.info('Scraper', `Starting scrape for: ${cleanUrl}`);

      // Rate Limiting
      await sleep(finalConfig.rateLimitMs || 1000);

      // Check robots.txt (Simplified / Best Effort)
      // Real robots.txt parsing is complex. Here we assume permission if not explicitly forbidden in common locations.
      // We skip actual fetch of robots.txt to avoid double CORS issues in this demo environment.
      
      // Fetch Content
      // We prepend a proxy if configured to handle CORS in browser
      const fetchUrl = finalConfig.useProxy ? `${CORS_PROXY}${cleanUrl}` : cleanUrl;
      
      let response;
      try {
        response = await fetch(fetchUrl);
      } catch (netErr) {
        if (finalConfig.useProxy) {
           // Retry without proxy if proxy fails? Or log fatal.
           throw new Error(`Network failed with proxy. ${netErr}`);
        } else {
           throw new Error(`Network failed. Possible CORS issue. Try enabling proxy. ${netErr}`);
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Parsing Logic
      let extractedText = '';

      if (finalConfig.containerSelector) {
        // Structured Extraction
        const containers = doc.querySelectorAll(finalConfig.containerSelector);
        logger.info('Scraper', `Found ${containers.length} containers using selector '${finalConfig.containerSelector}'`);
        
        containers.forEach((container, idx) => {
           let qText = '';
           if (finalConfig.questionSelector) {
             const qEl = container.querySelector(finalConfig.questionSelector);
             qText = qEl?.textContent?.trim() || '';
           } else {
             // Fallback: take entire container text if no specific question selector
             qText = container.textContent?.trim() || '';
           }

           // If specific options selectors are used, append them clearly
           // This helps the AI cleaner later
           if (finalConfig.optionSelector) {
              const opts = container.querySelectorAll(finalConfig.optionSelector);
              opts.forEach((opt, oIdx) => {
                 qText += `\nOption: ${opt.textContent?.trim()}`;
              });
           }

           if (qText.length > 10) {
              extractedText += `\n--- QUESTION BLOCK ${idx} ---\n${qText}\n`;
           }
        });

      } else {
        // Unstructured / Fallback Extraction (Body Text)
        // Remove scripts and styles
        doc.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
        extractedText = doc.body.textContent || '';
        // Basic cleanup of multiple newlines
        extractedText = extractedText.replace(/\n\s*\n/g, '\n\n');
      }

      if (extractedText.length < 50) {
         logger.warn('Scraper', `Low content extracted from ${cleanUrl}`, { length: extractedText.length });
      }

      // Create Chunk
      const chunk: RawChunk = {
        id: crypto.randomUUID(),
        text: extractedText,
        source_type: 'SCRAPER',
        source_name: cleanUrl,
        page_or_url: cleanUrl,
        status: 'pending'
      };

      onChunkFound(chunk);
      logger.info('Scraper', `Successfully extracted content from ${cleanUrl}`);

    } catch (error: any) {
      logger.error('Scraper', `Failed to scrape ${cleanUrl}`, { error: error.message });
      // Create a failed chunk so the user sees it in the UI
      const failedChunk: RawChunk = {
        id: crypto.randomUUID(),
        text: '',
        source_type: 'SCRAPER',
        source_name: cleanUrl,
        page_or_url: cleanUrl,
        status: 'failed',
        error: error.message
      };
      onChunkFound(failedChunk);
    }
  }
};
