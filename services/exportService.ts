import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { MCQ, PaperConfig } from '../types';
import { logger } from './loggerService';

// Ensure jsPDF instance is available
// Some environments might import it as default
const getJsPDF = () => {
  if (typeof jsPDF !== 'undefined') return new jsPDF();
  // Fallback for default export quirks
  const JSPDF_ANY = (jsPDF as any).default || jsPDF;
  return new JSPDF_ANY();
};

const addHeader = (doc: any, pageWidth: number, margin: number) => {
    try {
        // Branding
        doc.setFontSize(22);
        doc.setTextColor(0, 102, 204); // CGP Blue
        doc.setFont("helvetica", "bold");
        doc.text("CGP Career Avenues", margin, 25);
        
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "normal");
        doc.text("Gateway to IITs", margin, 30);

        // Line separator
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

export const generatePaperPDF = (questions: MCQ[], config: PaperConfig, returnBlob: boolean = false): Blob | void => {
  try {
      logger.info('ExportService', `Starting PDF Generation for ${config.subjectName}. Qs: ${questions.length}`);
      
      // Initialize PDF
      // @ts-ignore
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;

      addHeader(doc, pageWidth, margin);

      // --- PAPER INFO ---
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

      // Safe AutoTable Call
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
          logger.error('ExportService', 'AutoTable failed', tableErr);
          yPos += 40; // Fallback spacing
      }

      // --- GENERAL INSTRUCTIONS ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("INSTRUCTIONS:", margin, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const instructions = [
        "1. This question paper contains multiple sections as detailed above.",
        "2. NAT (Numerical Answer Type) questions require a specific value.",
        "3. MSQ (Multiple Select Questions) may have one or more correct options.",
        "4. Read the questions carefully before selecting your response.",
        "5. Do not close the browser window during the test."
      ];

      instructions.forEach(inst => {
        doc.text(inst, margin, yPos);
        yPos += 6;
      });

      // --- QUESTIONS GENERATION ---
      doc.addPage();
      yPos = 20;

      let currentQIndex = 0;

      config.sections.forEach((section, secIdx) => {
        // Section Header
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos - 5, pageWidth - (margin*2), 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`SECTION ${secIdx + 1}: ${section.type} (${section.marksPerQuestion} Marks)`, margin + 2, yPos + 1);
        yPos += 15;

        // Questions Loop
        for (let i = 0; i < section.count; i++) {
          if (currentQIndex >= questions.length) break;
          const q = questions[currentQIndex];

          // Page break check
          if (yPos > 230) { doc.addPage(); yPos = 20; }

          // Question Text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          const qNum = `Q.${currentQIndex + 1}`;
          
          const maxTextWidth = pageWidth - margin - 25;
          const cleanQText = q.question.replace(/\n+/g, ' ').trim();
          const splitQuestion = doc.splitTextToSize(cleanQText, maxTextWidth);
          
          doc.text(qNum, margin, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(splitQuestion, margin + 10, yPos);
          
          const qHeight = splitQuestion.length * 5;
          yPos += qHeight + 5;

          // Render Options based on Type
          if (section.type === 'NAT') {
             // Render Input Box for NAT
             doc.setDrawColor(150);
             doc.text("Answer: ", margin + 12, yPos + 5);
             doc.rect(margin + 30, yPos, 40, 8); // Input box
             yPos += 15;
          } else {
             // Render Options for MCQ/MSQ
             const optArr = [
                `a) ${q.options.a}`,
                `b) ${q.options.b}`,
                `c) ${q.options.c}`,
                `d) ${q.options.d}`
             ];

             optArr.forEach(opt => {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                const cleanOpt = opt.replace(/\n+/g, ' ').trim();
                const splitOpt = doc.splitTextToSize(cleanOpt, maxTextWidth);
                doc.text(splitOpt, margin + 12, yPos);
                yPos += (splitOpt.length * 5) + 2;
             });
             yPos += 5;
          }

          yPos += 5; // Spacing between questions
          currentQIndex++;
        }
      });

      if (returnBlob) {
        return doc.output('blob');
      }
      doc.save(`CGP_Paper_${config.subjectName.replace(/\s+/g, '_')}_QP.pdf`);

  } catch (err: any) {
      logger.error('ExportService', 'Critical PDF generation error', err);
      throw new Error(`PDF Generation Failed: ${err.message}`);
  }
};

export const generateSolutionsPDF = (questions: MCQ[], config: PaperConfig, returnBlob: boolean = false): Blob | void => {
    try {
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
        
        // Prepare table data for solutions
        const tableBody = questions.map((q, idx) => [
            `${idx + 1}`,
            q.type,
            q.answer || 'N/A',
            q.explanation || 'No explanation provided.'
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
