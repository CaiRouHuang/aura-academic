import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  addLog,
  createAIReview,
  createSrlProbeResponse,
  createSubmission,
  getAIReview,
  getCheckpoints,
  getCurrentParticipantCode,
  getCurrentUser,
  getProjects,
  getSubmissions,
  updateCheckpoint,
} from '../../lib/store';
import { reviewSubmission, summarizePdfChunk } from '../../lib/ai';
import { logUploadEvent, logAIEvalEvent, logStudentResponseEvent, logCheckpointSummary, logSrlProbeResponse } from '../../lib/eventLogger';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import FileUploadZone from '../../components/ui/FileUploadZone';
import FilePreviewModal from '../../components/ui/FilePreviewModal';
import { extractTextFromFile, isTextExtractable, renderPdfPagesToImages, analyzePdfPages, buildPdfText, VISUAL_PAGES_MAX, analyzeDocx } from '../../lib/fileParser';

const MAX_TEXT_CHARS = 80000;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const STORED_TEXT_CHARS = 5000;
const STORED_IMAGE_DATA_URL_CHARS = 700000;
const PDF_VISUAL_MAX_DIMENSION = 900;
const PDF_VISUAL_JPEG_QUALITY = 0.55;
const AI_TEXT_CHARS_WITH_IMAGES = 24000;
const AI_TEXT_CHARS_TEXT_ONLY = 60000;
const AI_IMAGE_DATA_URL_BUDGET = 1800000;
const AI_RETRY_IMAGE_DATA_URL_BUDGET = 700000;

const ANALYSIS_TIPS = [
  "AI 正在仔細閱讀您的每一頁文件...",
  "如果文件包含豐富的圖片或表格，會需要更多時間解析。",
  "這就像老師在批改作業一樣，請給它一點時間思考...",
  "好的分析值得等待，我們正在交叉比對各項評分標準。",
  "AI 正在對您的產出內容進行深度檢視...",
  "為了確保評分品質，AI 會反覆驗證您的每一個段落。"
];

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

// eslint-disable-next-line no-unused-vars
function HistorySubmissionCard({ sub, idx, currentCp, setPreviewFile }) {
  const [expanded, setExpanded] = useState(false);
  const review = getAIReview(sub.id);
  const isLatest = idx === 0;
  
  const allFiles = sub.files_data || [];
  const MAX_VISIBLE = 4;
  const filesToShow = expanded ? allFiles : allFiles.slice(0, MAX_VISIBLE);
  const hiddenCount = allFiles.length > MAX_VISIBLE ? allFiles.length - MAX_VISIBLE : 0;

  return (
    <div className="relative pl-12">
      {/* Timeline dot */}
      <div className={`absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-surface ${isLatest ? 'bg-primary' : 'bg-outline-variant'}`} />
      
      <div className={`bg-surface border ${isLatest ? 'border-primary/30 shadow-md' : 'border-outline-variant/30 shadow-sm opacity-80'} rounded-2xl p-5`}>
        <div className="flex justify-between items-start mb-3">
          <span className="text-[14px] font-bold text-on-surface">第 {sub.version} 次提交</span>
          <span className="text-[12px] text-on-surface-variant">
            {new Date(sub.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="mb-4">
          <p className="text-[13px] text-on-surface-variant mb-2" title={sub.file_urls.join(', ')}>已上傳：{sub.file_urls.length} 個檔案</p>
          {allFiles.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              {filesToShow.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewFile(f)}
                  className="block relative group overflow-hidden rounded-lg border border-outline-variant/30 text-left h-16 bg-surface-container-low transition-transform hover:scale-105 shrink-0"
                  style={{ width: '64px' }}
                >
                  {f.data && f.data.startsWith('data:image/') ? (
                    <img src={f.data} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant mb-0.5">
                        {f.name.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                      </span>
                      <span className="text-[9px] text-on-surface-variant truncate w-full text-center" title={f.name}>
                        {f.name}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <span className="material-symbols-outlined text-white text-[18px]">visibility</span>
                  </div>
                </button>
              ))}
              {hiddenCount > 0 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="h-16 w-16 rounded-lg border border-outline-variant/30 bg-surface-container flex flex-col items-center justify-center hover:bg-surface-variant transition-colors"
                >
                  <span className="text-[12px] font-bold text-primary">+{hiddenCount}</span>
                  <span className="text-[10px] text-on-surface-variant">更多檔案</span>
                </button>
              )}
              {expanded && hiddenCount > 0 && (
                <button
                  onClick={() => setExpanded(false)}
                  className="h-16 px-3 rounded-lg border border-outline-variant/30 bg-surface-container flex flex-col items-center justify-center hover:bg-surface-variant transition-colors text-[11px] text-on-surface-variant"
                >
                  收合檔案
                </button>
              )}
            </div>
          )}
          {sub.description && (
            <p className="text-[14px] text-on-surface bg-surface-variant/30 p-3 rounded-lg border border-outline-variant/20 italic">"{sub.description}"</p>
          )}
        </div>
        
        {review && (
          <div className={`rounded-xl p-4 border ${review.completion_rate >= 80 ? 'bg-status-pass-bg/30 border-status-pass-border/30' : 'bg-status-warning-bg/30 border-status-warning-border/30'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border ${review.completion_rate >= 80 ? 'bg-status-pass-bg text-status-pass border-status-pass-border' : 'bg-status-warning-bg text-status-warning border-status-warning-border'}`}>
                {review.completion_rate}%
              </span>
              <span className="text-[13px] font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                AI 分析回饋
              </span>
            </div>
            <p className="text-[14px] text-on-surface-variant mb-4 font-medium leading-relaxed">{review.overall_comment}</p>
            
            {review.criteria_results && review.criteria_results.length > 0 && (
              <div className="space-y-2 mb-4">
                {review.criteria_results.map((cr, i) => {
                  const criterion = currentCp?.criteria?.find(c => c.id === cr.criterion_id);
                  return (
                    <div key={i} className="bg-surface/50 rounded p-2 border border-outline-variant/10">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[12px] font-bold text-on-surface">{criterion?.label || '評分項目'}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cr.passed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
                          {cr.passed ? '達成' : '未達'} ({cr.score}分)
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant">{cr.comment}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[13px] text-on-surface-variant/80 pl-2 border-l-2 border-primary/30">{review.suggestions}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function trimTextContentsForAi(textContents, maxChars) {
  let used = 0;
  return textContents.map((item) => {
    const remaining = Math.max(0, maxChars - used);
    const content = item.content || '';
    if (remaining <= 0) {
      return { ...item, content: '[Omitted due to AI request size limit.]' };
    }

    const nextContent = content.length > remaining
      ? `${content.slice(0, remaining)}\n\n[AI input truncated to keep analysis responsive.]`
      : content;
    used += nextContent.length;
    return { ...item, content: nextContent };
  });
}

function budgetImagesForAi(images, maxChars) {
  const selected = [];
  let used = 0;

  for (const image of images) {
    if (!image) continue;
    if (used + image.length > maxChars) break;
    selected.push(image);
    used += image.length;
  }

  return selected;
}

function isAiTimeout(error) {
  return /timed out|timeout/i.test(error?.message || '');
}

export default function UploadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const projectIdParam = searchParams.get('project');
  const checkpointIdParam = searchParams.get('checkpoint');

  const allProjects = getProjects();
  const projects = allProjects.filter(p => p.status === 'active' || p.id === projectIdParam || !p.status);

  const initialProject = projectIdParam 
    ? projects.find(p => p.id === projectIdParam)?.id 
    : projects[0]?.id || '';

  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(checkpointIdParam || '');
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState('upload'); // upload | analyzing | result
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [analysisStep, setAnalysisStep] = useState({
    title: '',
    detail: '',
    progress: null,
    startedAt: null,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewFile, setPreviewFile] = useState(null);
  const [feedbackValueProbe, setFeedbackValueProbe] = useState('');
  const [finalChangeProbe, setFinalChangeProbe] = useState('');
  const [probeError, setProbeError] = useState('');

  const projectCheckpoints = selectedProject
    ? getCheckpoints(selectedProject)
    : [];

  const currentCp = projectCheckpoints.find(c => c.id === selectedCheckpoint) 
    || projectCheckpoints.find(c => c.status !== 'passed') 
    || projectCheckpoints[0];
  const currentProject = projects.find(p => p.id === selectedProject);

  const isPassed = currentCp?.status === 'passed';
  const submissionsHistory = currentCp ? getSubmissions(currentCp.id) : [];
  const resultAllPassed = phase === 'result'
    && aiResult?.completion_rate >= 80
    && selectedProject
    && getCheckpoints(selectedProject).every(c => c.status === 'passed');
  const postFormUrl = import.meta.env.VITE_POST_FORM_URL || '';
  const hasPostFormUrl = /^https:\/\/.+/i.test(postFormUrl);

  useEffect(() => {
    if (phase !== 'analyzing' || !analysisStep.startedAt) return undefined;

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((new Date().getTime() - analysisStep.startedAt) / 1000));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [phase, analysisStep.startedAt]);

  const updateAnalysisStep = (title, detail = '', progress = null) => {
    setAnalysisStep(prev => ({
      title,
      detail,
      progress,
      startedAt: prev.startedAt || new Date().getTime(),
    }));
  };

  const handleUpload = async () => {
    if (!files.length || !currentCp) return;
    const participantCode = getCurrentParticipantCode();

    const startedAt = new Date().getTime();
    setPhase('analyzing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setAiError('');
    setAiResult(null);
    setFeedbackValueProbe('');
    setFinalChangeProbe('');
    setProbeError('');
    setElapsedSeconds(0);
    setAnalysisStep({
      title: '準備分析檔案',
      detail: '正在建立分析任務...',
      progress: 0,
      startedAt,
    });

    try {

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const textFiles = files.filter(f => isTextExtractable(f));
    // Binary-previewable files (PDF, DOCX) — store raw data URL for native preview
    const binaryPreviewExts = ['pdf', 'doc', 'docx'];
    const binaryPreviewFiles = files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return binaryPreviewExts.includes(ext);
    });
    const pdfFiles = files.filter(f => f.name.split('.').pop().toLowerCase() === 'pdf');

    const resizeImageToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const MAX_DIM = 900;
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round(height * (MAX_DIM / width));
                width = MAX_DIM;
              } else {
                width = Math.round(width * (MAX_DIM / height));
                height = MAX_DIM;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.62));
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    const fileToDataUrl = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    updateAnalysisStep(
      '正在處理圖片',
      imageFiles.length ? `正在壓縮 ${imageFiles.length} 個圖片檔案...` : '沒有需要處理的圖片。',
      0.1
    );
    const base64Images = await Promise.all(
      imageFiles.map(f => resizeImageToBase64(f))
    );

    // Read raw data URLs for binary-previewable files (PDF, DOCX)
    const binaryDataUrls = new Map();
    const previewableFiles = binaryPreviewFiles.filter(f => f.size <= MAX_PREVIEW_BYTES);
    const skippedPreviewFiles = binaryPreviewFiles.filter(f => f.size > MAX_PREVIEW_BYTES);
    updateAnalysisStep(
      '正在準備檔案預覽',
      skippedPreviewFiles.length
        ? `大型檔案將只保存文字內容，不保存原始預覽：${skippedPreviewFiles.map(f => f.name).join(', ')}`
        : '正在準備可預覽檔案...',
      0.2
    );
    await Promise.all(
      previewableFiles.map(async (f) => {
        const dataUrl = await fileToDataUrl(f);
        binaryDataUrls.set(f, dataUrl);
      })
    );

    const textContents = [];
    const pdfVisualImages = [];
    const docxVisualImages = [];
    let pdfAnalysisMeta = { total_pages: 0, text_pages: 0, visual_pages: 0, pages_analyzed: 0 };
    let docxAnalysisMeta = { embedded_images: 0 };

    for (let fileIndex = 0; fileIndex < textFiles.length; fileIndex++) {
      const f = textFiles[fileIndex];
      const ext = f.name.split('.').pop().toLowerCase();
      const isPdf = ext === 'pdf';
      const isDocx = ext === 'docx' || ext === 'doc';

      if (isPdf) {
        updateAnalysisStep(
          '正在分析 PDF 頁面結構',
          `${f.name} (${fileIndex + 1}/${textFiles.length})`,
          0.25 + (textFiles.length ? (fileIndex / textFiles.length) * 0.35 : 0)
        );

        const pdfAnalysis = await analyzePdfPages(f, { 
          onProgress: (progress) => {
            if (progress.type !== 'pdf-analyze-page') return;
            updateAnalysisStep(
              '正在分析 PDF 頁面結構',
              `${f.name}: 第 ${progress.page}/${progress.totalPages} 頁`,
              0.25 + (textFiles.length ? ((fileIndex + progress.page / progress.pagesToRead) / textFiles.length) * 0.35 : 0)
            );
          }
        });
        
        pdfAnalysisMeta.total_pages += pdfAnalysis.totalPages;
        pdfAnalysisMeta.text_pages += pdfAnalysis.summary.textPages;
        pdfAnalysisMeta.visual_pages += pdfAnalysis.summary.visualPages;
        pdfAnalysisMeta.pages_analyzed += pdfAnalysis.pagesAnalyzed;

        if (pdfAnalysis.visualPageIndices.length > 0) {
          updateAnalysisStep(
            '正在轉換 PDF 視覺頁面',
            `${f.name}: 發現 ${pdfAnalysis.summary.visualPages} 頁視覺內容`,
            0.25 + (textFiles.length ? (fileIndex / textFiles.length) * 0.35 : 0)
          );

          const renderedPages = await renderPdfPagesToImages(f, {
            maxPages: VISUAL_PAGES_MAX,
            maxDimension: PDF_VISUAL_MAX_DIMENSION,
            quality: PDF_VISUAL_JPEG_QUALITY,
            pageIndices: pdfAnalysis.visualPageIndices,
          });
          pdfVisualImages.push(...renderedPages.map(page => page.data));
        }

        const CHUNK_THRESHOLD = 8;
        if (pdfAnalysis.totalPages > CHUNK_THRESHOLD) {
          updateAnalysisStep(
            '分批分析大型 PDF',
            `${f.name} 共 ${pdfAnalysis.totalPages} 頁，正在進行分段摘要...`,
            0.6
          );
          
          let fileChunkedSummaries = [];
          const chunkSize = 5;
          for (let i = 0; i < pdfAnalysis.pages.length; i += chunkSize) {
            const chunkPages = pdfAnalysis.pages.slice(i, i + chunkSize);
            const chunkText = buildPdfText({ pages: chunkPages, totalPages: pdfAnalysis.totalPages, pagesAnalyzed: pdfAnalysis.pagesAnalyzed }, 15000);
            
            updateAnalysisStep(
              '分批分析大型 PDF',
              `${f.name}: 正在摘要第 ${chunkPages[0].pageNum} 到 ${chunkPages[chunkPages.length - 1].pageNum} 頁...`,
              0.6 + ((i / pdfAnalysis.pages.length) * 0.2)
            );

            try {
              const chunkSummary = await summarizePdfChunk({
                chunkText,
                chunkInfo: `Pages ${chunkPages[0].pageNum} to ${chunkPages[chunkPages.length - 1].pageNum}`,
                checkpoint: currentCp,
                project: currentProject,
              });
              fileChunkedSummaries.push(`--- Chunk Pages ${chunkPages[0].pageNum}-${chunkPages[chunkPages.length - 1].pageNum} Summary ---\n` + 
                `Summary: ${chunkSummary.summary}\n` +
                `Key Claims: ${chunkSummary.key_claims.join(', ')}\n` +
                `Evidence: ${chunkSummary.evidence_found.join(', ')}\n` +
                `Visual Content: ${chunkSummary.visual_content_described.join(', ')}\n`);
            } catch (e) {
              console.error('Failed to summarize chunk', e);
            }
          }
          
          const combinedSummaryText = `[AI Generated Summary of Large PDF: ${f.name}]\n\n` + fileChunkedSummaries.join('\n\n');
          textContents.push({ name: f.name, content: combinedSummaryText });
          
        } else {
          const fullPdfText = buildPdfText(pdfAnalysis, MAX_TEXT_CHARS);
          textContents.push({ name: f.name, content: fullPdfText });
        }
      } else if (isDocx) {
        updateAnalysisStep(
          '正在分析 Word 文件內容',
          `${f.name} (${fileIndex + 1}/${textFiles.length})`,
          0.25 + (textFiles.length ? (fileIndex / textFiles.length) * 0.35 : 0)
        );

        const docxAnalysis = await analyzeDocx(f);
        let text = docxAnalysis.text;
        if (text.length > MAX_TEXT_CHARS) {
          text = text.substring(0, MAX_TEXT_CHARS) + '\n\n[Content truncated due to length limits...]';
        }
        textContents.push({ name: f.name, content: text });
        
        if (docxAnalysis.images && docxAnalysis.images.length > 0) {
          docxAnalysisMeta.embedded_images += docxAnalysis.images.length;
          docxVisualImages.push(...docxAnalysis.images.map(img => img.data));
          updateAnalysisStep(
            '發現 Word 內嵌圖片',
            `${f.name} 包含 ${docxAnalysis.images.length} 張圖`,
            0.25 + (textFiles.length ? (fileIndex / textFiles.length) * 0.35 : 0)
          );
        }
      } else {
        updateAnalysisStep(
          '正在擷取文字',
          `${f.name} (${fileIndex + 1}/${textFiles.length})`,
          0.25 + (textFiles.length ? (fileIndex / textFiles.length) * 0.35 : 0)
        );

        let text = await extractTextFromFile(f, {
          maxChars: MAX_TEXT_CHARS,
        });
        if (text.length > MAX_TEXT_CHARS) {
          text = text.substring(0, MAX_TEXT_CHARS) + '\n\n[Content truncated due to length limits...]';
        }
        textContents.push({ name: f.name, content: text });
      }
    }

    // Create submission
    updateAnalysisStep('正在保存提交紀錄', '已完成檔案處理，正在寫入本機紀錄。', 0.8);
    const storedFilesData = files.map((f) => {
      const baseEntry = { name: f.name, type: f.type, size: f.size };

      if (imageFiles.includes(f)) {
        const idx = imageFiles.indexOf(f);
        const data = base64Images[idx];
        return {
          ...baseEntry,
          data: data && data.length <= STORED_IMAGE_DATA_URL_CHARS ? data : null,
          preview_note: data && data.length > STORED_IMAGE_DATA_URL_CHARS
            ? 'Image preview omitted to keep browser storage under quota.'
            : undefined,
        };
      }

      if (textFiles.includes(f)) {
        const idx = textFiles.indexOf(f);
        const fullText = textContents[idx]?.content || '';
        const entry = {
          ...baseEntry,
          text_content: fullText.length > STORED_TEXT_CHARS
            ? `${fullText.slice(0, STORED_TEXT_CHARS)}\n\n[Stored preview truncated. Full text was used for AI analysis.]`
            : fullText,
          text_truncated: fullText.length > STORED_TEXT_CHARS,
          extracted_text_length: fullText.length,
        };
        // Also attach raw data URL for small binary-previewable files (PDF, DOCX)
        if (binaryDataUrls.has(f)) {
          entry.data = binaryDataUrls.get(f);
        }
        return entry;
      }

      return { ...baseEntry, data: null };
    });
    const submission = createSubmission({
      checkpoint_id: currentCp.id,
      submitted_by: participantCode,
      file_urls: files.map(f => f.name),
      files_data: storedFilesData,
      description: description,
    });
    // ── Research LOG: Upload Event ──
    const documentAnalysisMs = Math.round(new Date().getTime() - startedAt);
    const existingSubs = getSubmissions(currentCp.id);
    const daysBeforeDeadline = currentCp.due_date
      ? (new Date(currentCp.due_date) - new Date()) / (1000 * 60 * 60 * 24)
      : null;
    const fileTypes = [...new Set(files.map(f => {
      const ext = f.name.split('.').pop().toUpperCase();
      return ext || 'UNKNOWN';
    }))];
    const fileDetails = files.map(f => ({
      name: f.name,
      type: f.type || 'unknown',
      size_bytes: f.size,
      extension: f.name.split('.').pop()?.toLowerCase() || '',
      used_for_text_extraction: textFiles.includes(f),
      used_for_image_analysis: imageFiles.includes(f),
      stored_preview: Boolean(binaryDataUrls.has(f)),
    }));
    const textExtractionSummary = textContents.map(item => ({
      name: item.name,
      extracted_chars: item.content?.length || 0,
    }));
    const submissionMeta = {
      total_files: files.length,
      file_types: {
        images: imageFiles.length,
        pdfs: pdfFiles.length,
        text: textFiles.length - pdfFiles.length,
      },
      pdf_analysis: pdfAnalysisMeta,
      docx_analysis: docxAnalysisMeta,
      images_attached_to_ai: 0,
    };
    const uploadEvent = logUploadEvent({
      project_id: selectedProject,
      project_title: currentProject?.title || '',
      student_id: participantCode,
      checkpoint_id: currentCp.id,
      checkpoint_title: currentCp.title,
      version_number: submission.version,
      file_type: fileTypes.join(', '),
      file_count: files.length,
      file_names: files.map(f => f.name),
      file_details: fileDetails,
      description_length: description.length,
      days_before_deadline: daysBeforeDeadline,
      document_analysis_latency_ms: documentAnalysisMs,
      frontend_latency_ms: documentAnalysisMs,
      skipped_preview_files: skippedPreviewFiles.map(f => ({
        name: f.name,
        size_bytes: f.size,
      })),
      text_extraction_summary: textExtractionSummary,
      pdf_analysis: pdfAnalysisMeta,
      docx_analysis: docxAnalysisMeta,
      input_snapshot: {
        project: {
          id: currentProject?.id || selectedProject,
          title: currentProject?.title || '',
        },
        checkpoint: {
          id: currentCp.id,
          title: currentCp.title,
          order_index: currentCp.order_index,
          due_date: currentCp.due_date,
          criteria: currentCp.criteria || [],
        },
        submission: {
          id: submission.id,
          version: submission.version,
          description,
          file_names: files.map(f => f.name),
        },
      },
      processing_output: {
        stored_file_count: storedFilesData.length,
        stored_text_chars: storedFilesData.reduce((sum, f) => sum + (f.text_content?.length || 0), 0),
        extracted_text_files: textContents.length,
        base64_image_count: base64Images.length,
        pdf_visual_image_count: pdfVisualImages.length,
        docx_visual_image_count: docxVisualImages.length,
      },
    });

    // ── If this is a resubmission, log student response event ──
    const prevSub = submission.version > 1 && existingSubs.length > 0 ? existingSubs[0] : null;
    const secondsSincePrev = prevSub?.submitted_at
      ? (new Date() - new Date(prevSub.submitted_at)) / 1000
      : null;
    logStudentResponseEvent({
      project_id: selectedProject,
      project_title: currentProject?.title || '',
      submission_id: submission.id,
      student_id: participantCode,
      checkpoint_id: currentCp.id,
      checkpoint_title: currentCp.title,
      version_number: submission.version,
      file_names: files.map(f => f.name),
      file_details: fileDetails,
      description,
      description_length: description.length,
      time_to_resubmit_seconds: secondsSincePrev !== null ? Math.round(secondsSincePrev) : null,
      resubmitted: submission.version > 1,
    });

    let reviewData;
    let promptContext = null;
    const aiStartTime = new Date().getTime();
    let aiImages = [];
    try {
      updateAnalysisStep('準備 AI 視覺資料', '正在最佳化圖像以便傳輸...', 0.85);
      aiImages = budgetImagesForAi([...base64Images, ...pdfVisualImages, ...docxVisualImages], AI_IMAGE_DATA_URL_BUDGET);
    } catch (e) {
      console.warn('Failed to budget images', e);
    }
    const aiTexts = trimTextContentsForAi(
      textContents,
      aiImages.length ? AI_TEXT_CHARS_WITH_IMAGES : AI_TEXT_CHARS_TEXT_ONLY
    );
    submissionMeta.images_attached_to_ai = aiImages.length;
    let aiInputSummary = {
      attempt: 'primary',
      image_count: aiImages.length,
      text_file_count: aiTexts.length,
      text_chars_sent: aiTexts.reduce((sum, item) => sum + (item.content?.length || 0), 0),
      text_files_sent: aiTexts.map(item => ({
        name: item.name,
        chars_sent: item.content?.length || 0,
      })),
      submission_metadata: submissionMeta,
    };
    const imageContext = (pdfVisualImages.length || docxVisualImages.length)
      ? `Document pages/embedded objects were rendered as optimized images so the AI can inspect figures, screenshots, charts, and scanned content. ${aiImages.length} image(s) were attached within the request budget.`
      : '';
      
    updateAnalysisStep('正在送交 AI 評估', '已完成檔案處理，正在等待模型回覆。', null);
    try {
      const aiResultOutput = await reviewSubmission({
        project: currentProject,
        checkpoint: currentCp,
        submission,
        images: aiImages,
        texts: aiTexts,
        imageContext,
        submissionMeta,
      });
      reviewData = aiResultOutput.reviewData;
      promptContext = aiResultOutput.promptContext;
    } catch (error) {
      if (!isAiTimeout(error) || aiImages.length === 0) {
        setAiError(error.message || 'AI submission review failed.');
        setPhase('upload');
        return;
      }

      updateAnalysisStep(
        'AI 回覆逾時，正在改用輕量模式',
        '系統會保留少量 PDF 圖像與重點文字再試一次。',
        null
      );

      try {
        const retryImages = budgetImagesForAi(aiImages, AI_RETRY_IMAGE_DATA_URL_BUDGET);
        const retryTexts = trimTextContentsForAi(textContents, 12000);
        const retrySubmissionMeta = {
          ...submissionMeta,
          images_attached_to_ai: retryImages.length,
        };
        aiInputSummary = {
          attempt: 'retry_timeout_reduced_payload',
          image_count: retryImages.length,
          text_file_count: retryTexts.length,
          text_chars_sent: retryTexts.reduce((sum, item) => sum + (item.content?.length || 0), 0),
          text_files_sent: retryTexts.map(item => ({
            name: item.name,
            chars_sent: item.content?.length || 0,
          })),
          submission_metadata: retrySubmissionMeta,
        };
        const retryResult = await reviewSubmission({
          project: currentProject,
          checkpoint: currentCp,
          submission,
          images: retryImages,
          texts: retryTexts,
          imageContext: 'Retry mode: only the smallest visual subset and condensed text were attached to avoid timeout.',
          submissionMeta: retrySubmissionMeta,
        });
        reviewData = retryResult.reviewData;
        promptContext = retryResult.promptContext;
      } catch (retryError) {
        setAiError(retryError.message || error.message || 'AI submission review failed.');
        setPhase('upload');
        return;
      }
    }
    const aiLatencyMs = Math.round(new Date().getTime() - aiStartTime);

    updateAnalysisStep('正在整理 AI 結果', 'AI 已回覆，正在更新提交狀態。', 0.9);
    const completionRate = reviewData.completion_rate;
    // Calculate completion delta from previous version.
    let completionDelta = null;
    if (existingSubs.length > 0) {
      const prevReview = getAIReview(existingSubs[0].id);
      if (prevReview) {
        completionDelta = completionRate - prevReview.completion_rate;
      }
    }

    const review = createAIReview({
      submission_id: submission.id,
      ...reviewData,
    });

    // ── Research LOG: AI Evaluation Event ──
    const statusLabel = completionRate >= 80 ? 'Pass' : 'Warning';
    const fullFeedbackText = [
      reviewData.overall_comment,
      reviewData.suggestions,
      reviewData.encouragement,
      ...(reviewData.criteria_results || []).map(item => item.comment),
      ...(reviewData.reflection_questions || []).map(item => item.question || item.fse_prompt),
    ].filter(Boolean).join(' | ');
    const flaggedMissingItems = (reviewData.criteria_results || [])
      .filter(item => Number(item.score) < 70 || item.passed === false)
      .map(item => ({
        criterion_id: item.criterion_id,
        score: item.score,
        comment: item.comment,
      }));
    logAIEvalEvent({
      linked_upload_event_id: uploadEvent.event_id,
      project_id: selectedProject,
      project_title: currentProject?.title || '',
      submission_id: submission.id,
      checkpoint_id: currentCp.id,
      checkpoint_title: currentCp.title,
      student_id: participantCode,
      completion_rate: completionRate,
      completion_delta: completionDelta,
      status_label: statusLabel,
      feedback_text: fullFeedbackText,
      flagged_missing_items: flaggedMissingItems,
      eval_latency_ms: aiLatencyMs,
      document_analysis_latency_ms: documentAnalysisMs,
      frontend_latency_ms: documentAnalysisMs,
      total_flow_latency_ms: Math.round(new Date().getTime() - startedAt),
      ai_input_summary: aiInputSummary,
      ai_output_summary: {
        criteria_count: reviewData.criteria_results?.length || 0,
        reflection_question_count: reviewData.reflection_questions?.length || 0,
        overall_comment_chars: reviewData.overall_comment?.length || 0,
        suggestions_chars: reviewData.suggestions?.length || 0,
        encouragement_chars: reviewData.encouragement?.length || 0,
      },
      full_ai_response: reviewData,
      prompt_context: promptContext,
    });

    // Automatic pass/fail logic based on threshold
    const isPassedScore = completionRate >= 80;



    if (isPassedScore) {
      updateCheckpoint(currentCp.id, { status: 'passed' });
      const logText = t('upload.log_submitted')
        .replace('{cp}', currentCp.order_index)
        .replace('{title}', currentCp.title) + ' - 已通過';
      addLog(selectedProject, 'checkpoint_pass', logText, {
        checkpoint_id: currentCp.id,
        score: completionRate,
        document_analysis_latency_ms: documentAnalysisMs,
        eval_latency_ms: aiLatencyMs,
        total_flow_latency_ms: Math.round(new Date().getTime() - startedAt),
        completion_delta: completionDelta,
        full_feedback_text: fullFeedbackText,
        full_ai_response: reviewData,
        ai_input_summary: aiInputSummary,
        prompt_context: promptContext,
      });

      // ── Research LOG: Checkpoint Summary (auto on pass) ──
      const allSubsForCp = getSubmissions(currentCp.id);
      const allRates = allSubsForCp.map(s => {
        const r = getAIReview(s.id);
        return r ? r.completion_rate : null;
      }).filter(r => r !== null).reverse(); // chronological
      const firstSub = allSubsForCp[allSubsForCp.length - 1];
      const lastSub = allSubsForCp[0];
      const totalHours = firstSub && lastSub
        ? (new Date(lastSub.submitted_at) - new Date(firstSub.submitted_at)) / (1000 * 60 * 60)
        : 0;
      // Stagnation: count consecutive deltas < 2%
      let stagnation = 0;
      for (let i = 1; i < allRates.length; i++) {
        if (Math.abs(allRates[i] - allRates[i - 1]) < 2) stagnation++;
      }
      const deltas = [];
      for (let i = 1; i < allRates.length; i++) deltas.push(allRates[i] - allRates[i - 1]);

      logCheckpointSummary({
        student_id: participantCode,
        checkpoint_id: currentCp.id,
        total_upload_count: allSubsForCp.length,
        first_upload_timestamp: firstSub?.submitted_at || null,
        last_upload_timestamp: lastSub?.submitted_at || null,
        total_time_spent_hours: Math.round(totalHours * 100) / 100,
        completion_rate_start: allRates[0] ?? null,
        completion_rate_end: allRates[allRates.length - 1] ?? null,
        completion_rate_trajectory: allRates,
        max_completion_delta: deltas.length > 0 ? Math.max(...deltas) : null,
        stagnation_count: stagnation,
      });
    } else {
      updateCheckpoint(currentCp.id, { status: 'needs_revision' });
      const logText = t('upload.log_submitted')
        .replace('{cp}', currentCp.order_index)
        .replace('{title}', currentCp.title) + ' - 需修改';
      addLog(selectedProject, 'upload', logText, {
        checkpoint_id: currentCp.id,
        score: completionRate,
        document_analysis_latency_ms: documentAnalysisMs,
        eval_latency_ms: aiLatencyMs,
        total_flow_latency_ms: Math.round(new Date().getTime() - startedAt),
        completion_delta: completionDelta,
        full_feedback_text: fullFeedbackText,
        full_ai_response: reviewData,
        ai_input_summary: aiInputSummary,
        prompt_context: promptContext,
      });
    }

    setAiResult(review);
    setPhase('result');
    } catch (error) {
      console.error('Upload analysis failed:', error);
      setAiError(error.message || 'AI submission review failed.');
      setPhase('upload');
    }
  };

  const saveResultProbeResponses = () => {
    if (!aiResult || !currentCp) return false;

    const allCps = getCheckpoints(selectedProject);
    const allPassed = aiResult.completion_rate >= 80 && allCps.every(c => c.status === 'passed');
    const user = getCurrentUser();
    const participantCode = getCurrentParticipantCode();

    if (!feedbackValueProbe.trim()) {
      setProbeError('請先回答「哪一點最有參考價值」後再繼續。');
      return false;
    }

    if (allPassed && !finalChangeProbe.trim()) {
      setProbeError('請先回答 V1 到現在最大的改變後再完成。');
      return false;
    }

    const feedbackProbe = createSrlProbeResponse({
      probe_key: 'ai_feedback_most_valuable',
      prompt: '這段回饋裡，哪一點你覺得最有參考價值？',
      project_id: selectedProject,
      checkpoint_id: currentCp.id,
      submission_id: aiResult.submission_id,
      response_text: feedbackValueProbe.trim().slice(0, 100),
    });
    logSrlProbeResponse({
      probe_key: 'ai_feedback_most_valuable',
      prompt: '這段回饋裡，哪一點你覺得最有參考價值？',
      user_id: user?.id,
      participant_code: participantCode,
      project_id: selectedProject,
      checkpoint_id: currentCp.id,
      submission_id: aiResult.submission_id,
      response_text: feedbackValueProbe.trim().slice(0, 100),
      response_id: feedbackProbe.id,
    });

    if (allPassed) {
      const finalProbe = createSrlProbeResponse({
        probe_key: 'final_v1_change',
        prompt: '跟 V1 比，你最大的改變是什麼？為什麼？',
        project_id: selectedProject,
        checkpoint_id: currentCp.id,
        submission_id: aiResult.submission_id,
        response_text: finalChangeProbe.trim().slice(0, 150),
      });
      logSrlProbeResponse({
        probe_key: 'final_v1_change',
        prompt: '跟 V1 比，你最大的改變是什麼？為什麼？',
        user_id: user?.id,
        participant_code: participantCode,
        project_id: selectedProject,
        checkpoint_id: currentCp.id,
        submission_id: aiResult.submission_id,
        response_text: finalChangeProbe.trim().slice(0, 150),
        response_id: finalProbe.id,
      });
    }

    setProbeError('');
    return true;
  };

  const handleNextAction = () => {
    if (!saveResultProbeResponses()) return;

    if (aiResult?.completion_rate >= 80) {
      const allCps = getCheckpoints(selectedProject);
      const allPassed = allCps.every(c => c.status === 'passed');
      if (allPassed) {
        navigate(`/report/${selectedProject}`);
      } else {
        navigate(`/projects/${selectedProject}/checkpoints`);
      }
    } else {
      setPhase('upload');
      setFiles([]);
      setAiResult(null);
      setFeedbackValueProbe('');
      setFinalChangeProbe('');
      setProbeError('');
    }
  };

  return (
    <>
      <TopBar title="Aura Academic" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 animate-fade-up font-medium">
          {t('upload.title')}
        </h2>
        <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed animate-fade-up delay-100">
          {t('upload.subtitle')}
        </p>

        {phase === 'upload' && (
          <div className="flex flex-col gap-8 animate-fade-up delay-200">
            {/* Project Selector */}
            {projects.length > 1 && (
              <select
                value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setSelectedCheckpoint(''); }}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 text-[14px] text-on-surface outline-none"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}

            {/* Checkpoint Selector */}
            {projectCheckpoints.length > 0 && (
              <select
                value={selectedCheckpoint || currentCp?.id || ''}
                onChange={(e) => setSelectedCheckpoint(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 text-[14px] text-on-surface outline-none"
              >
                {projectCheckpoints.map(cp => (
                  <option key={cp.id} value={cp.id}>Phase {cp.order_index}: {cp.title}</option>
                ))}
              </select>
            )}

            {isPassed && (
              <div className="bg-status-pass-bg border border-status-pass-border rounded-xl p-4 flex items-center gap-3 mb-2 shadow-sm animate-fade-up">
                <span className="material-symbols-outlined text-[24px] text-status-pass" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-status-pass">此階段已通過</h4>
                  <p className="text-[13px] text-status-pass/80">您可以繼續上傳新版本進行迭代，AI 將提供最新建議並更新紀錄。</p>
                </div>
              </div>
            )}

            {/* Upload Zone */}
            <FileUploadZone
              onFilesSelected={(f) => setFiles(f)}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md,.csv,.html,.py,.js"
            />

            {/* Current Checkpoint Info */}
            {currentCp && (
              <GlassCard className="animate-fade-up delay-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[12px] text-primary font-medium">{t('upload.current_checkpoint')}</span>
                </div>
                <h3 className="text-[16px] font-bold text-on-surface mb-1">{currentCp.title}</h3>
                <p className="text-[14px] text-on-surface-variant leading-relaxed">{currentCp.goal_description}</p>
              </GlassCard>
            )}

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('upload.comment_placeholder')}
              rows={3}
              className="w-full bg-white/55 border border-outline-variant/40 rounded-[24px] focus:border-primary p-5 text-[14px] text-on-surface outline-none resize-none transition-colors shadow-[0_8px_26px_rgba(87,56,120,0.04)]"
            />

            {/* Submit */}
            {aiError && (
              <div className="rounded-xl bg-error-container text-on-error-container border border-error/20 p-4 text-[13px] leading-relaxed">
                {aiError}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!files.length}
              className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
              {t('upload.submit_btn')}
            </button>

            {/* Inline History */}
            {submissionsHistory.length > 0 && (
              <div className="mt-8 pt-8 border-t border-outline-variant/30 animate-fade-up delay-300">
                <h3 className="text-[18px] font-medium text-on-surface mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history</span>
                  歷史上傳紀錄與 AI 建議
                </h3>
                <div className="flex flex-col gap-6 relative before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-outline-variant/30">
                  {submissionsHistory.map((sub, idx) => {
                    const review = getAIReview(sub.id);
                    const isLatest = idx === 0;
                    return (
                      <div key={sub.id} className="relative pl-12">
                        {/* Timeline dot */}
                        <div className={`absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-surface ${isLatest ? 'bg-primary' : 'bg-outline-variant'}`} />
                        
                        <div className={`bg-surface border ${isLatest ? 'border-primary/30 shadow-md' : 'border-outline-variant/30 shadow-sm opacity-80'} rounded-2xl p-5`}>
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[14px] font-bold text-on-surface">第 {sub.version} 次提交</span>
                            <span className="text-[12px] text-on-surface-variant">
                              {new Date(sub.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="mb-4">
                            <p className="text-[13px] text-on-surface-variant mb-2">已上傳：{sub.file_urls.join(', ')}</p>
                            {sub.files_data && (
                              <div className="flex gap-2 mb-3 flex-wrap">
                                {sub.files_data.map((f, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setPreviewFile(f)}
                                    className="block relative group overflow-hidden rounded-lg border border-outline-variant/30 text-left h-16 bg-surface-container-low transition-transform hover:scale-105 shrink-0"
                                    style={{ width: '64px' }}
                                  >
                                    {f.data && f.data.startsWith('data:image/') ? (
                                      <img src={f.data} alt={f.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center p-1">
                                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mb-0.5">
                                          {f.name.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                                        </span>
                                        <span className="text-[9px] text-on-surface-variant truncate w-full text-center" title={f.name}>
                                          {f.name}
                                        </span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                      <span className="material-symbols-outlined text-white text-[18px]">visibility</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            {sub.description && (
                              <p className="text-[14px] text-on-surface bg-surface-variant/30 p-3 rounded-lg border border-outline-variant/20 italic">"{sub.description}"</p>
                            )}
                          </div>
                          
                          {review && (
                            <div className={`rounded-xl p-4 border ${review.completion_rate >= 80 ? 'bg-status-pass-bg/30 border-status-pass-border/30' : 'bg-status-warning-bg/30 border-status-warning-border/30'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border ${review.completion_rate >= 80 ? 'bg-status-pass-bg text-status-pass border-status-pass-border' : 'bg-status-warning-bg text-status-warning border-status-warning-border'}`}>
                                  {review.completion_rate}%
                                </span>
                                <span className="text-[13px] font-bold text-on-surface flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                  AI 分析回饋
                                </span>
                              </div>
                              <p className="text-[14px] text-on-surface-variant mb-4 font-medium leading-relaxed">{review.overall_comment}</p>
                              
                              {review.criteria_results && review.criteria_results.length > 0 && (
                                <div className="space-y-2 mb-4">
                                  {review.criteria_results.map((cr, i) => {
                                    const criterion = currentCp?.criteria?.find(c => c.id === cr.criterion_id);
                                    return (
                                      <div key={i} className="bg-surface/50 rounded p-2 border border-outline-variant/10">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-[12px] font-bold text-on-surface">{criterion?.label || '評分項目'}</span>
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cr.passed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
                                            {cr.passed ? '達成' : '未達'} ({cr.score}分)
                                          </span>
                                        </div>
                                        <p className="text-[12px] text-on-surface-variant">{cr.comment}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <p className="text-[13px] text-on-surface-variant/80 pl-2 border-l-2 border-primary/30">{review.suggestions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-up">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-container/60 to-tertiary-container/60 flex items-center justify-center mb-6 ai-orb-pulse">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-primary sparkle-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
            </div>
            <p className="text-[16px] text-on-surface-variant text-center">
              {analysisStep.title || t('upload.analyzing_title')}
            </p>
            <p className="text-[12px] text-on-surface-variant/70 mt-2 text-center max-w-md leading-relaxed">
              {analysisStep.detail || t('upload.analyzing_desc')}
            </p>
            {typeof analysisStep.progress === 'number' && (
              <div className="w-full max-w-sm mt-6">
                <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-tertiary transition-all duration-300"
                    style={{ width: `${Math.round(Math.max(0, Math.min(1, analysisStep.progress)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-[12px] text-on-surface-variant/60 mt-4">
              已等待 {formatElapsed(elapsedSeconds)}
            </p>
            {elapsedSeconds > 90 ? (
              <div className="mt-5 rounded-2xl border border-status-warning-border bg-status-warning-bg/35 px-4 py-3 text-[12px] text-status-warning leading-relaxed max-w-md text-center">
                AI 回覆時間較長，系統仍在等待；若超過 180 秒會自動停止並讓您重試。
              </div>
            ) : elapsedSeconds > 4 ? (
              <div className="mt-5 h-8 flex items-center justify-center">
                <p key={Math.floor((elapsedSeconds - 5) / 6)} className="text-[13px] text-primary/80 italic animate-fade-in text-center max-w-sm">
                  💡 {ANALYSIS_TIPS[Math.floor((elapsedSeconds - 5) / 6) % ANALYSIS_TIPS.length]}
                </p>
              </div>
            ) : (
              <div className="mt-5 h-8"></div>
            )}
          </div>
        )}

        {phase === 'result' && aiResult && (
          <div className="flex flex-col items-center gap-8 animate-fade-up">
            {/* Score Badge */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-[24px] font-bold border-2 shadow-[0_18px_46px_rgba(111,80,146,0.12)] ${
              aiResult.completion_rate >= 80
                ? 'bg-status-pass-bg text-status-pass border-status-pass-border'
                : 'bg-status-warning-bg text-status-warning border-status-warning-border'
            }`}>
              {aiResult.completion_rate >= 80 ? (
                <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              ) : (
                <span>{aiResult.completion_rate}%</span>
              )}
            </div>

            <p className="text-[16px] text-on-surface font-medium text-center">
              {aiResult.completion_rate >= 80 ? '完成度已達標，AI 已自動標記為通過！' : '未達 80% 通過門檻，請參考建議修改後重新上傳。'}
            </p>

            {/* AI Feedback */}
            <GlassCard className="w-full">
              <h3 className="text-[14px] font-bold text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                {t('upload.ai_feedback')}
              </h3>
              <p className="text-[14px] text-on-surface-variant mb-4">{aiResult.overall_comment}</p>
              
              {aiResult.criteria_results && aiResult.criteria_results.length > 0 && (
                <div className="space-y-3 mb-4">
                  <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1 border-b border-outline-variant/30 pb-1">
                    <span className="material-symbols-outlined text-[14px]">checklist</span>
                    逐項評分明細
                  </h4>
                  {aiResult.criteria_results.map((cr, i) => {
                    const criterion = currentCp?.criteria?.find(c => c.id === cr.criterion_id);
                    return (
                      <div key={i} className="bg-surface/50 rounded-lg p-3 border border-outline-variant/10 flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] font-bold text-on-surface">{criterion?.label || '評分項目'}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${cr.passed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
                            {cr.passed ? '達成' : '未達'} ({cr.score}分)
                          </span>
                        </div>
                        <p className="text-[12px] text-on-surface-variant/80">{criterion?.description}</p>
                        <div className="mt-1 pt-2 border-t border-outline-variant/10">
                          <p className="text-[13px] text-on-surface-variant flex items-start gap-1">
                            <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                            <span>{cr.comment}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {aiResult.suggestions && (
                <div className="border-t border-outline-variant/30 pt-3">
                  <p className="text-[12px] text-primary font-medium mb-1">{t('upload.suggestion')}</p>
                  <p className="text-[13px] text-on-surface-variant">{aiResult.suggestions}</p>
                </div>
              )}
            </GlassCard>

            <div className="w-full rounded-2xl border border-primary/20 bg-primary-container/10 p-4">
              <label htmlFor="feedback-value-probe" className="text-[14px] font-bold text-on-surface">
                這段回饋裡，哪一點你覺得最有參考價值？
              </label>
              <textarea
                id="feedback-value-probe"
                value={feedbackValueProbe}
                maxLength={100}
                onChange={(event) => {
                  setFeedbackValueProbe(event.target.value);
                  setProbeError('');
                }}
                rows={3}
                className="mt-3 w-full rounded-xl border border-outline-variant/40 bg-surface p-3 text-[14px] text-on-surface outline-none transition-colors focus:border-primary"
                placeholder="請用 100 字以內簡短回答"
              />
              <p className="mt-1 text-right text-[11px] text-on-surface-variant">
                {feedbackValueProbe.length}/100
              </p>
            </div>

            {resultAllPassed && (
              <div className="w-full rounded-2xl border border-tertiary/20 bg-tertiary-container/10 p-4">
                <label htmlFor="final-change-probe" className="text-[14px] font-bold text-on-surface">
                  跟 V1 比，你最大的改變是什麼？為什麼？
                </label>
                <textarea
                  id="final-change-probe"
                  value={finalChangeProbe}
                  maxLength={150}
                  onChange={(event) => {
                    setFinalChangeProbe(event.target.value);
                    setProbeError('');
                  }}
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-outline-variant/40 bg-surface p-3 text-[14px] text-on-surface outline-none transition-colors focus:border-primary"
                  placeholder="請用 150 字以內簡短回答"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  {hasPostFormUrl ? (
                    <a
                      href={postFormUrl}
                    target="_blank"
                    rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    開啟結束表單
                    </a>
                  ) : (
                    <span className="text-[12px] text-status-warning">
                      尚未設定 VITE_POST_FORM_URL
                    </span>
                  )}
                  <span className="text-[11px] text-on-surface-variant">{finalChangeProbe.length}/150</span>
                </div>
              </div>
            )}

            {probeError && (
              <div className="w-full rounded-xl bg-error-container text-on-error-container border border-error/20 p-3 text-[13px] leading-relaxed">
                {probeError}
              </div>
            )}

            {/* Encouragement */}
            <p className="text-[14px] text-on-surface-variant text-center italic">
              {aiResult.encouragement}
            </p>

            {/* Actions */}
            <div className="flex gap-4 w-full">
              {aiResult.completion_rate >= 80 ? (
                <button
                  onClick={handleNextAction}
                  disabled={!feedbackValueProbe.trim() || (resultAllPassed && !finalChangeProbe.trim())}
                  className="flex-1 bg-gradient-to-r from-primary to-tertiary text-on-primary rounded-full py-4 text-[16px] font-medium text-center shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  繼續下一步
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate(`/projects/${selectedProject}/checkpoints`)}
                    className="flex-1 glass-card-solid rounded-full py-3 text-[14px] text-on-surface font-medium text-center hover:bg-surface-variant/30 transition-colors"
                  >
                    稍後再試
                  </button>
                  <button
                    onClick={handleNextAction}
                    disabled={!feedbackValueProbe.trim()}
                    className="flex-1 bg-primary text-on-primary rounded-full py-3 text-[14px] font-medium text-center hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    重新上傳
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
