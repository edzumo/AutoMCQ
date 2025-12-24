import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { MCQ, PaperConfig } from '../types';
import { logger } from './loggerService';

// Ensure globals
declare global {
  interface Window {
    html2canvas: any;
    katex: any;
  }
}

// Helper to render latex-mixed string to HTML string
const processTextToHTML = (text: string): string => {
    if (!text) return '';
    
    // 1. Convert Markdown Images to HTML Images
    let processed = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />');

    // 2. Process LaTeX
    const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?:\$[^$\n]+\$))/g;
    const parts = processed.split(regex);
    
    return parts.map(part => {
        if (part.match(regex)) {
             // Remove wrappers
             let latex = part;
             let display = false;
             if (part.startsWith('$$')) { latex = part.slice(2, -2); display = true; }
             else if (part.startsWith('\\[')) { latex = part.slice(2, -2); display = true; }
             else if (part.startsWith('\\(')) { latex = part.slice(2, -2); }
             else if (part.startsWith('$')) { latex = part.slice(1, -1); }

             try {
                return window.katex 
                    ? window.katex.renderToString(latex, { throwOnError: false, displayMode: display }) 
                    : part;
             } catch (e) { return part; }
        }
        return `<span>${part}</span>`;
    }).join('');
};

// Robust function to convert HTML block (math/images) to canvas data URL
const renderMathBlockToImage = async (htmlContent: string, widthPx: number): Promise<{dataUrl: string, height: number, width: number} | null> => {
    if (!window.html2canvas) return null;

    const div = document.createElement('div');
    // Important: Place it in the viewport but behind everything so it actually renders
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.zIndex = '-1000';
    div.style.width = `${widthPx}px`;
    div.style.fontFamily = 'Helvetica, sans-serif';
    div.style.fontSize = '12px'; 
    div.style.color = '#000000';
    div.style.backgroundColor = '#ffffff'; // White bg is crucial for valid capture
    div.style.lineHeight = '1.5';
    div.style.padding = '10px'; // Add padding to avoid cutting off edges
    div.innerHTML = htmlContent;

    document.body.appendChild(div);
    
    // Check for images inside the HTML and wait for them to load
    const images = div.querySelectorAll('img');
    if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { 
                img.onload = resolve; 
                img.onerror = resolve; 
            });
        }));
    }
    
    // Critical Delay: Allow fonts (Katex) to layout
    await new Promise(r => setTimeout(r, 100)); 

    try {
        const canvas = await window.html2canvas(div, { 
            scale: 2, 
            backgroundColor: '#ffffff',
            logging: false, 
            useCORS: true,
            width: widthPx, // Force width
            windowWidth: widthPx + 50
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        // Subtract padding from reported width if needed, or just use canvas dims
        return { dataUrl, height: canvas.height, width: canvas.width };
    } catch (e) {
        console.error("Render failed", e);
        return null;
    } finally {
        if (document.body.contains(div)) {
            document.body.removeChild(div);
        }
    }
};

const addHeader = (doc: any, pageWidth: number, margin: number) => {
    try {
        doc.setFontSize(22);
        doc.setTextColor(0, 102, 204); 
        doc.setFont("helvetica", "bold");
        doc.text("CGP Career Avenues", margin, 25);
        
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "normal");
        doc.text("Gateway to IITs", margin, 30);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, 35, pageWidth - margin, 35);
    } catch (e) {
        logger.error('ExportService', 'Header generation failed', e);
    }
};

const centerText = (doc: any, pageWidth: number, text: string, y: number, size: number = 12, font: string = 'helvetica', style: string = 'normal') => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
};

export const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

export const generatePaperPDF = async (questions: MCQ[], config: PaperConfig, returnBlob: boolean = false): Promise<Blob | void> => {
  try {
      logger.info('ExportService', `Starting PDF Generation for ${config.subjectName}. Qs: ${questions.length}`);
      
      // @ts-ignore
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // Pixel width for html2canvas approximation
      // A4 width ~ 210mm. contentWidth ~ 180mm.
      // 180mm * 3.78px/mm ~ 680px.
      // We use a slightly wider canvas to ensure text wrapping matches PDF
      const cssPixelWidth = 700; 

      addHeader(doc, pageWidth, margin);

      let yPos = 50;
      
      doc.setTextColor(0, 0, 0);
      centerText(doc, pageWidth, `MODEL QUESTION PAPER: ${config.subjectName.toUpperCase()}`, yPos, 16, 'helvetica', 'bold');
      yPos += 10;
      
      centerText(doc, pageWidth, `Duration: ${config.durationMins} Minutes`, yPos, 12);
      yPos += 20;

      // --- INSTRUCTIONS TABLE ---
      const tableData = config.sections.map(sec => [
        sec.type,
        `${sec.count}`,
        `${sec.marksPerQuestion}`,
        `${sec.negativeMarks}`,
        `${sec.count * sec.marksPerQuestion}`
      ]);

      const totalQuestions = config.sections.reduce((acc, curr) => acc + curr.count, 0);
      const totalMarks = config.sections.reduce((acc, curr) => acc + (curr.count * curr.marksPerQuestion), 0);

      try {
          autoTable(doc, {
            startY: yPos,
            head: [['Section Type', 'No. of Questions', 'Marks / Q', 'Negative Marks', 'Total Marks']],
            body: [
              ...tableData,
              ['TOTAL', `${totalQuestions}`, '-', '-', `${totalMarks}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [0, 102, 204] },
            styles: { halign: 'center' },
            margin: { left: margin, right: margin }
          });
          // @ts-ignore
          yPos = doc.lastAutoTable.finalY + 15;
      } catch (tableErr) {
          yPos += 40; 
      }

      // --- INSTRUCTIONS ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("INSTRUCTIONS:", margin, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const instructions = [
        "1. This question paper contains multiple sections as detailed above.",
        "2. NAT questions require a specific value.",
        "3. MSQ may have one or more correct options.",
        "4. Diagrams are included where necessary.",
        "5. Do not close the browser window."
      ];

      instructions.forEach(inst => {
        doc.text(inst, margin, yPos);
        yPos += 6;
      });

      // --- QUESTIONS GENERATION ---
      doc.addPage();
      yPos = 20;

      let currentQIndex = 0;

      for (const [secIdx, section] of config.sections.entries()) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos - 5, pageWidth - (margin*2), 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`SECTION ${secIdx + 1}: ${section.type} (${section.marksPerQuestion} Marks)`, margin + 2, yPos + 1);
        yPos += 15;

        for (let i = 0; i < section.count; i++) {
          if (currentQIndex >= questions.length) break;
          const q = questions[currentQIndex];

          if (yPos > 230) { doc.addPage(); yPos = 20; }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          const qNum = `Q.${currentQIndex + 1}`;
          doc.text(qNum, margin, yPos);

          const hasMath = q.question.includes('$$') || q.question.includes('\\') || q.question.includes('$');
          const hasMarkdownImg = q.question.includes('![');
          const hasDirectImg = !!q.imageUrl;

          let renderSuccess = false;

          // Attempt to render as Rich Content (Math + Image)
          if ((hasMath || hasMarkdownImg || hasDirectImg) && window.html2canvas) {
             let htmlToRender = processTextToHTML(q.question);
             
             if (hasDirectImg) {
                 htmlToRender += `<br/><img src="${q.imageUrl}" style="max-width: 100%; height: auto; margin-top: 10px; border: 1px solid #ddd;" />`;
             }

             const result = await renderMathBlockToImage(htmlToRender, cssPixelWidth);
             
             if (result && result.dataUrl) {
                const { dataUrl, width, height } = result;
                const ratio = height / width;
                
                // Effective width in PDF is contentWidth - 10 (padding)
                // However, our canvas was 'width' wide (scale 2).
                // So PDF height = (PDF Width / Canvas Width) * Canvas Height ??
                // Actually it is cleaner to just use Aspect Ratio.
                const pdfImgDisplayHeight = (contentWidth - 10) * ratio;

                if (yPos + pdfImgDisplayHeight > 270) {
                    doc.addPage();
                    yPos = 20;
                    doc.text(`${qNum} (Continued)`, margin, yPos);
                }

                doc.addImage(dataUrl, 'PNG', margin + 8, yPos - 4, contentWidth - 10, pdfImgDisplayHeight);
                yPos += pdfImgDisplayHeight + 5;
                renderSuccess = true;
             }
          }

          // Fallback
          if (!renderSuccess) {
             doc.setFont('helvetica', 'normal');
             const maxTextWidth = pageWidth - margin - 25;
             const cleanQText = q.question.replace(/\n+/g, ' ').trim(); 
             const splitQuestion = doc.splitTextToSize(cleanQText, maxTextWidth);
             doc.text(splitQuestion, margin + 10, yPos);
             yPos += (splitQuestion.length * 5) + 5;
          }

          // OPTIONS
          if (section.type === 'NAT') {
             if (yPos > 260) { doc.addPage(); yPos = 20; }
             doc.setDrawColor(150);
             doc.text("Answer: ", margin + 12, yPos + 5);
             doc.rect(margin + 30, yPos, 40, 8); 
             yPos += 15;
          } else {
             const optArr = [
                { label: 'a)', text: q.options.a },
                { label: 'b)', text: q.options.b },
                { label: 'c)', text: q.options.c },
                { label: 'd)', text: q.options.d }
             ];

             for (const opt of optArr) {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                
                const hasOptMath = opt.text.includes('$$') || opt.text.includes('\\') || opt.text.includes('$');
                doc.setFont('helvetica', 'normal');
                let optRenderSuccess = false;
                
                if (hasOptMath && window.html2canvas) {
                   const html = `<b>${opt.label}</b> ${processTextToHTML(opt.text)}`;
                   const result = await renderMathBlockToImage(html, cssPixelWidth);
                   
                   if (result && result.dataUrl) {
                       const { dataUrl, width, height } = result;
                       const ratio = height / width;
                       const pdfImgDisplayHeight = (contentWidth - 10) * ratio;

                       doc.addImage(dataUrl, 'PNG', margin + 12, yPos - 2, contentWidth - 10, pdfImgDisplayHeight);
                       yPos += pdfImgDisplayHeight + 2;
                       optRenderSuccess = true;
                   }
                } 
                
                if (!optRenderSuccess) {
                   const fullText = `${opt.label} ${opt.text}`;
                   const splitOpt = doc.splitTextToSize(fullText, contentWidth - 15);
                   doc.text(splitOpt, margin + 12, yPos);
                   yPos += (splitOpt.length * 5) + 2;
                }
             }
             yPos += 5;
          }

          yPos += 5; 
          currentQIndex++;
        }
      }

      if (returnBlob) {
        return doc.output('blob');
      }
      doc.save(`CGP_Paper_${config.subjectName.replace(/\s+/g, '_')}_QP.pdf`);

  } catch (err: any) {
      logger.error('ExportService', 'Critical PDF generation error', err);
      throw new Error(`PDF Generation Failed: ${err.message}`);
  }
};

export const generateSolutionsPDF = async (questions: MCQ[], config: PaperConfig, returnBlob: boolean = false): Promise<Blob | void> => {
    try {
        // ... (Same content as previous but good to ensure full file integrity if requested)
        logger.info('ExportService', 'Starting Solutions PDF generation');
        // @ts-ignore
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
      
        addHeader(doc, pageWidth, margin);
      
        let yPos = 50;
        
        doc.setTextColor(0, 0, 0);
        centerText(doc, pageWidth, `KEY & SOLUTIONS: ${config.subjectName.toUpperCase()}`, yPos, 16, 'helvetica', 'bold');
        yPos += 15;
        
        const tableBody = questions.map((q, idx) => [
            `${idx + 1}`,
            q.type,
            q.answer || 'N/A',
            (q.explanation || 'No explanation provided.').substring(0, 100) + (q.explanation?.length > 100 ? '...' : '')
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Q.No', 'Type', 'Answer Key', 'Explanation / Solution']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [0, 102, 204] },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 15 },
                2: { cellWidth: 25 },
                3: { cellWidth: 'auto' }
            },
            margin: { left: margin, right: margin }
        });

        if (returnBlob) {
            return doc.output('blob');
        }
        doc.save(`CGP_Paper_${config.subjectName.replace(/\s+/g, '_')}_SOLUTIONS.pdf`);
    } catch (err: any) {
        logger.error('ExportService', 'Solutions PDF Generation Failed', err);
        throw new Error(`Solutions PDF Failed: ${err.message}`);
    }
};

export const generatePaperExcel = (questions: MCQ[], config: PaperConfig) => {
  logger.info('ExportService', 'Starting Excel generation');
  
  let currentQIndex = 0;
  const rows: any[] = [];

  config.sections.forEach((section, secIdx) => {
    for (let i = 0; i < section.count; i++) {
      if (currentQIndex >= questions.length) break;
      const q = questions[currentQIndex];
      
      rows.push({
        'Section': section.type,
        'Question ID': q.qid,
        'Type': q.type,
        'Question Text': q.question,
        'Option A': q.options.a,
        'Option B': q.options.b,
        'Option C': q.options.c,
        'Option D': q.options.d,
        'Answer Key': q.answer,
        'Explanation': q.explanation,
        'Image URL': q.imageUrl || '',
        'Marks': section.marksPerQuestion,
        'Negative Marks': section.negativeMarks,
        'Source': q.source_name
      });

      currentQIndex++;
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Question Paper");
  XLSX.writeFile(workbook, `CGP_Paper_${config.subjectName.replace(/\s+/g, '_')}.xlsx`);
  logger.info('ExportService', 'Excel Generation Complete');
};

export const createZipBundle = async (files: {filename: string, content: Blob}[]) => {
    if (files.length === 0) {
        logger.warn('ExportService', 'No files to zip');
        return;
    }

    logger.info('ExportService', `Creating ZIP bundle with ${files.length} files`);
    const zip = new JSZip();
    files.forEach(f => zip.file(f.filename, f.content));
    
    try {
        const content = await zip.generateAsync({type: "blob"});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Bulk_Question_Papers_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logger.info('ExportService', 'ZIP download triggered');
    } catch (e) {
        logger.error('ExportService', 'ZIP Generation Failed', e);
        throw e;
    }
};