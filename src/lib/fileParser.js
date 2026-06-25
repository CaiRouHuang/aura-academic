import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Smart PDF analysis constants
const TEXT_DENSITY_THRESHOLD = 100; // chars per page — below this → visual page
export const VISUAL_PAGES_MAX = 4;  // max pages to render as images

export async function extractTextFromFile(file, options = {}) {
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (extension === 'pdf') {
    return await extractTextFromPDF(file, options);
  }
  
  if (extension === 'docx' || extension === 'doc') {
    return await extractTextFromDocx(file);
  }
  
  // For standard text files
  return await extractRawText(file);
}

async function extractTextFromPDF(file, options = {}) {
  const {
    maxChars = 80000,
    maxPages = 40,
    onProgress,
  } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pagesToRead = Math.min(totalPages, maxPages);
    
    let fullText = '';
    onProgress?.({ type: 'pdf-start', page: 0, totalPages, pagesToRead });

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      onProgress?.({ type: 'pdf-page', page: i, totalPages, pagesToRead });

      if (fullText.length >= maxChars) {
        return fullText.slice(0, maxChars) + '\n\n[Content truncated due to length limits.]';
      }
    }

    if (totalPages > pagesToRead) {
      fullText += `\n[Only the first ${pagesToRead} of ${totalPages} PDF pages were analyzed.]\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    return `[Failed to extract text from PDF: ${error.message}]`;
  }
}

/**
 * Analyze a PDF file page-by-page: classify each page as 'text' or 'visual'
 * based on extractable text density. Returns structured per-page data
 * so callers can selectively render only visual pages as images.
 */
export async function analyzePdfPages(file, options = {}) {
  const {
    maxPages = 40,
    maxChars = 80000,
    onProgress,
  } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pagesToRead = Math.min(totalPages, maxPages);
    const pages = [];
    const visualPageIndices = [];
    let totalChars = 0;

    onProgress?.({ type: 'pdf-analyze-start', page: 0, totalPages, pagesToRead });

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ').trim();
      const charCount = pageText.length;
      
      const opList = await page.getOperatorList();
      const hasImageOps = opList.fnArray.some(fn => 
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintInlineImageXObject ||
        fn === pdfjsLib.OPS.paintJpegXObject
      );

      // If page has image ops and text isn't overwhelmingly dense, or text is very sparse
      const type = (charCount <= TEXT_DENSITY_THRESHOLD || (hasImageOps && charCount <= 1500)) ? 'visual' : 'text';

      if (type === 'visual') {
        visualPageIndices.push(i);
      }

      pages.push({
        pageNum: i,
        type,
        text: pageText,
        charCount,
      });

      totalChars += charCount;
      page.cleanup?.();
      onProgress?.({ type: 'pdf-analyze-page', page: i, totalPages, pagesToRead });

      // Stop early if we already have enough text
      if (totalChars >= maxChars) break;
    }

    const textPageCount = pages.filter(p => p.type === 'text').length;
    const visualPageCount = pages.filter(p => p.type === 'visual').length;

    return {
      totalPages,
      pagesAnalyzed: pages.length,
      pages,
      visualPageIndices,
      summary: {
        textPages: textPageCount,
        visualPages: visualPageCount,
        totalChars,
      },
    };
  } catch (error) {
    console.error('PDF page analysis error:', error);
    return {
      totalPages: 0,
      pagesAnalyzed: 0,
      pages: [],
      visualPageIndices: [],
      summary: { textPages: 0, visualPages: 0, totalChars: 0 },
      error: error.message,
    };
  }
}

/**
 * Build a combined text string from analyzePdfPages() results,
 * including only text-classified pages (visual pages get a placeholder).
 */
export function buildPdfText(analysis, maxChars = 80000) {
  let text = '';
  for (const page of analysis.pages) {
    if (text.length >= maxChars) {
      text += '\n\n[Content truncated due to length limits.]';
      break;
    }
    if (page.type === 'text') {
      text += `--- Page ${page.pageNum} ---\n${page.text}\n\n`;
    } else {
      text += `--- Page ${page.pageNum} [Visual content — rendered as image for AI] ---\n\n`;
    }
  }
  if (analysis.totalPages > analysis.pagesAnalyzed) {
    text += `\n[Only ${analysis.pagesAnalyzed} of ${analysis.totalPages} pages were analyzed.]\n`;
  }
  return text;
}

export async function renderPdfPagesToImages(file, options = {}) {
  const {
    maxPages = 6,
    maxDimension = 1200,
    quality = 0.72,
    pageIndices = null, // if provided, only render these specific pages
    onProgress,
  } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    // If specific page indices are given, use those (capped at maxPages);
    // otherwise fall back to rendering the first maxPages pages sequentially.
    const targetPages = pageIndices
      ? pageIndices.filter(p => p >= 1 && p <= totalPages).slice(0, maxPages)
      : Array.from({ length: Math.min(totalPages, maxPages) }, (_, i) => i + 1);
    const pagesToRender = targetPages.length;
    const images = [];

    onProgress?.({ type: 'pdf-render-start', page: 0, totalPages, pagesToRender });

    for (let idx = 0; idx < targetPages.length; idx++) {
      const pageNum = targetPages[idx];
      const page = await pdf.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(maxDimension / Math.max(baseViewport.width, baseViewport.height), 1.6);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: 'white',
      }).promise;

      images.push({
        name: `${file.name} page ${pageNum}`,
        data: canvas.toDataURL('image/jpeg', quality),
        page: pageNum,
        totalPages,
      });

      canvas.width = 1;
      canvas.height = 1;
      page.cleanup?.();
      onProgress?.({ type: 'pdf-render-page', page: idx + 1, totalPages, pagesToRender });
    }

    return images;
  } catch (error) {
    console.error('PDF image rendering error:', error);
    return [];
  }
}

async function extractTextFromDocx(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    return `[Failed to extract text from DOCX: ${error.message}]`;
  }
}

export async function analyzeDocx(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Get text
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    const text = textResult.value;
    
    // Get HTML to extract images
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const html = htmlResult.value;
    
    const images = [];
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1].startsWith('data:image')) {
        images.push({
          name: `${file.name} embedded image ${images.length + 1}`,
          data: match[1],
        });
      }
    }
    
    return { text, images };
  } catch (error) {
    console.error('DOCX analysis error:', error);
    return { text: `[Failed to analyze DOCX: ${error.message}]`, images: [] };
  }
}

async function extractRawText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function isTextExtractable(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const textExtensions = ['txt', 'md', 'csv', 'json', 'html', 'py', 'js', 'jsx', 'ts', 'tsx', 'css', 'pdf', 'doc', 'docx'];
  return textExtensions.includes(ext) || file.type.startsWith('text/');
}
