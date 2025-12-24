import { GoogleGenAI, Type } from "@google/genai";
import { RawChunk, MCQ } from '../types';
import { logger } from './loggerService';

// Initialize Gemini
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const CLEANING_SYSTEM_INSTRUCTION = `
You are a High-Performance Educational Content Extraction Engine.
Your goal is to extract MAXIMAL VALID QUESTIONS from the provided text.

INPUT: Raw, messy text from PDFs (exam papers, coaching material).
OUTPUT: A clean JSON array of questions.

CLASSIFICATION RULES:
1. **MCQ**: Standard Multiple Choice (4 options). One correct answer.
2. **MSQ**: Multiple Select Question (4 options). One OR MORE correct answers.
3. **NAT**: Numerical Answer Type. A question asking for a number/value. NO OPTIONS provided.

EXTRACTION RULES:
1. **AGGRESSIVE EXTRACTION**: Do not drop a question just because it has minor formatting issues. Fix grammar.
2. **NAT Handling**: If a question has NO options but asks for a value/calculation, classify as 'NAT'. Set options a,b,c,d to empty strings.
3. **Answers & Explanations**: 
   - actively search for the Answer Key or Explanations in the text (often at the end of a block or marked with "Ans:", "Key:", "Sol:").
   - If found, put them in the 'answer' and 'explanation' fields.
   - If NOT found, leave them empty. DO NOT HALLUCINATE ANSWERS.
4. **Junk Removal**: Remove "Join Telegram", headers, footers, watermarks.
5. **Option Cleaning**: Remove "a)", "A.", "1." prefixes from option text.
6. **QUALITY FILTER**: DROP questions that are trivial, incomplete, or elementary level (e.g., "What is the full form of CPU?"). Keep only exam-relevant content.

FORMATTING RULES (CRITICAL):
1. **MATH**: Identify ALL mathematical expressions, formulas, and variables.
2. **LATEX**: Convert all math into LaTeX syntax enclosed in double dollar signs $$...$$. 
3. **JSON ESCAPING**: You are outputting a JSON string. **YOU MUST DOUBLE-ESCAPE BACKSLASHES**.
   - CORRECT: "$$ \\frac{a}{b} $$" (Becomes \frac in JS)
   - INCORRECT: "$$ \frac{a}{b} $$" (Becomes form feed or error)
   - CORRECT: "$$ \\int_{0}^{1} $$"
   - Example: "Calculate $$ x^2 + \\frac{1}{2} $$"

JSON SCHEMA:
[
  {
    "type": "MCQ" | "MSQ" | "NAT",
    "question": "Question text with $$math$$...",
    "a": "Option A text with $$math$$...",
    "b": "Option B",
    "c": "Option C",
    "d": "Option D",
    "answer": "Correct Option",
    "explanation": "Explanation with $$math$$...",
    "imageUrl": "URL of any relevant diagram/image found (optional)"
  }
]
`;

export const cleanChunkWithAI = async (chunk: RawChunk): Promise<MCQ[]> => {
  const ai = getAI();
  const startTime = Date.now();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `EXTRACT ALL QUESTIONS (MCQ, MSQ, NAT) FROM THIS TEXT. RECONSTRUCT BROKEN MATH SYMBOLS INTO VALID LATEX ($$...$$). REMEMBER TO DOUBLE-ESCAPE BACKSLASHES:\n\n${chunk.text}`,
      config: {
        systemInstruction: CLEANING_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["MCQ", "MSQ", "NAT"] },
              question: { type: Type.STRING },
              a: { type: Type.STRING },
              b: { type: Type.STRING },
              c: { type: Type.STRING },
              d: { type: Type.STRING },
              answer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              imageUrl: { type: Type.STRING, description: "URL of any associated image" }
            },
            required: ["type", "question", "a", "b", "c", "d"]
          }
        }
      }
    });

    const jsonText = response.text || "[]";
    let parsed = [];
    try {
        parsed = JSON.parse(jsonText);
    } catch (e) {
        logger.error('GeminiService', `JSON Parse failed for chunk`, { chunkId: chunk.id, error: e });
        return [];
    }

    const duration = Date.now() - startTime;
    const questions = parsed.map((item: any) => ({
      qid: crypto.randomUUID(),
      type: item.type || 'MCQ',
      question: item.question,
      options: {
        a: item.a || '',
        b: item.b || '',
        c: item.c || '',
        d: item.d || ''
      },
      answer: item.answer || '',
      explanation: item.explanation || '',
      source_type: chunk.source_type,
      source_name: chunk.source_name,
      page_or_url: chunk.page_or_url,
      imageUrl: item.imageUrl || ''
    }));

    logger.info('GeminiService', `Cleaned chunk ${chunk.id}. Found ${questions.length} items.`, { durationMs: duration });
    return questions;

  } catch (error: any) {
    logger.error('GeminiService', `AI Processing failed for chunk ${chunk.id}`, { error: error.message });
    return [];
  }
};

// --- SINGLE TOPIC FETCH ---
export const searchAndExtractWebQuestions = async (topic: string, stream?: string): Promise<MCQ[]> => {
  const ai = getAI();
  
  // High-Difficulty Prompt Strategy
  const prompt = `
    Role: Senior Professor at IIT/IISc setting the HARDEST section of the GATE/NET Exam for ${stream || 'Engineering'}.
    Topic: "${topic}"

    Objective: Create 8-12 HIGH-COMPLEXITY, TIME-CONSUMING questions.
    
    STRICT DIFFICULTY RULES (Non-negotiable):
    1. **NO DIRECT RECALL**: If a question can be answered in 10 seconds, REJECT IT.
    2. **MULTI-STEP LOGIC**: Every question must require at least 2 distinct logical steps or formulas to solve.
    3. **NUMERICAL INTENSITY (NAT)**: 
       - Create problems involving integration, differential equations, or complex circuit/system analysis.
       - Inputs should not be simple integers (e.g., use 10.5 instead of 10).
       - Answer must require calculation, not guessing.
    4. **CONCEPTUAL TRAPS**: For MCQs, options must represent common calculation errors or conceptual misunderstandings.
    5. **LENGTH**: Problem statements should be detailed (3-5 sentences), setting up a specific scenario.
    
    REQUIRED MIX:
    - 40% Numerical Answer Type (NAT) - Hardest difficulty.
    - 30% MSQ (Multiple Select) - Testing comprehensive theory depth.
    - 30% MCQ - Application/Analysis based (Match the following, Assertion-Reasoning).

    FORMATTING (CRITICAL):
    - **Use LaTeX ($$...$$) for ALL mathematical notation.**
    - **JSON ESCAPING**: You are outputting JSON. **Double-escape backslashes**.
    - Ensure equations are strictly valid LaTeX.
    - **IMAGES**: If a question requires a diagram, try to provide a relevant generic URL or leave imageUrl blank.

    DOMAIN ENFORCEMENT:
    - Strictly adhere to ${stream} syllabus. 
    - If the topic is generic (e.g., "Probability"), frame the question in the context of ${stream} (e.g., "Probability of packet loss in TCP" for CSE, "Probability of failure in a beam" for Civil).

    Output strictly as JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Strengthened system instruction for complexity
        systemInstruction: "You are an elite academic examiner. You DO NOT generate simple questions. You prioritize lengthy, complex problems that test deep understanding. You reject broad/easy questions. You ALWAYS use LaTeX for math and Double-Escape backslashes in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["MCQ", "MSQ", "NAT"] },
                question: { type: Type.STRING },
                a: { type: Type.STRING },
                b: { type: Type.STRING },
                c: { type: Type.STRING },
                d: { type: Type.STRING },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                imageUrl: { type: Type.STRING }
              },
              required: ["type", "question", "a", "b", "c", "d"]
            }
          }
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let sourceUrl = "Google Search";
    if (groundingChunks.length > 0 && groundingChunks[0].web?.uri) {
      sourceUrl = groundingChunks[0].web.uri;
    }

    const jsonText = response.text || "[]";
    const parsed = JSON.parse(jsonText);

    return parsed.map((item: any) => ({
      qid: crypto.randomUUID(),
      type: item.type || 'MCQ',
      stream: stream,
      topic: topic,
      question: item.question,
      options: {
        a: item.a || '',
        b: item.b || '',
        c: item.c || '',
        d: item.d || ''
      },
      answer: item.answer || '',
      explanation: item.explanation || '',
      source_type: 'WEB',
      source_name: `AI: ${topic}`,
      page_or_url: sourceUrl,
      imageUrl: item.imageUrl || ''
    }));

  } catch (error: any) {
    logger.error('GeminiService', `Web search extraction failed for ${topic}`, { error: error.message });
    return [];
  }
};

// --- HELPER: SHUFFLE ---
const shuffle = <T>(array: T[]): T[] => {
    let currentIndex = array.length,  randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

// --- FULL EXAM BANK GENERATOR (Progressive & Parallelized) ---
export const generateFullExamBank = async (
    streamName: string, 
    onProgress: (msg: string) => void,
    onQuestionsFound: (questions: MCQ[]) => void,
    forcedTopics?: string[]
): Promise<void> => {
    const ai = getAI();
    logger.info('GeminiService', `Starting Full Exam Bank generation for: ${streamName}`);
    
    let topics: string[] = [];

    if (forcedTopics && forcedTopics.length > 0) {
        // Use forced syllabus if provided
        topics = shuffle([...forcedTopics]); // Randomize order
        onProgress(`Using standardized syllabus with ${topics.length} topics (Randomized Order)...`);
    } else {
        // Fallback to AI generation
        onProgress(`Analyzing syllabus for ${streamName}...`);
        try {
            const planResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `List the top 10 most complex, high-difficulty topics for the "${streamName}" competitive exam (GATE/NET). Return ONLY a JSON array of strings.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            });
            topics = JSON.parse(planResponse.text || "[]");
            topics = shuffle(topics);
            logger.info('GeminiService', `Identified topics`, { topics });
        } catch (e) {
            logger.error('GeminiService', 'Failed to plan topics, falling back to defaults', e);
            topics = [`${streamName} Advanced Concepts`, `${streamName} Complex Calculations`, `${streamName} Application Problems`];
        }
    }

    onProgress(`Processing ${topics.length} topics...`);

    // Step 2: Parallel Fetching with Progressive Updates
    const BATCH_SIZE = 3; // Reduced batch size to allow for higher complexity generation
    
    for (let i = 0; i < topics.length; i += BATCH_SIZE) {
        const batch = topics.slice(i, i + BATCH_SIZE);
        onProgress(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.join(', ')}`);
        
        const promises = batch.map(async (topic) => {
            try {
                // Pass streamName strictly to prevent cross-domain pollution
                // The topic string itself is enriched with the stream name for clarity
                const qs = await searchAndExtractWebQuestions(topic, streamName);
                const enrichedQs = qs.map(q => ({...q, topic: topic.replace(streamName, '').trim() || topic}));
                if (enrichedQs.length > 0) {
                    onQuestionsFound(enrichedQs); // Streaming update!
                }
                return enrichedQs;
            } catch (err) {
                logger.error('GeminiService', `Failed topic ${topic}`, err);
                return [];
            }
        });

        // Wait for this batch to finish before starting next to manage rate limits mildly
        await Promise.all(promises);
    }

    onProgress(`Generation complete.`);
};