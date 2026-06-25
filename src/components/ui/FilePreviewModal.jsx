import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function getFileCategory(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  
  if (file.data && (file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))) {
    return 'image';
  }
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['py', 'js', 'jsx', 'ts', 'tsx', 'css', 'json', 'java', 'c', 'cpp', 'rb', 'go', 'rs', 'sh', 'bat', 'yaml', 'yml', 'toml', 'xml', 'sql'].includes(ext)) return 'code';
  if (['txt', 'csv', 'log'].includes(ext) || file.type?.startsWith('text/')) return 'text';
  
  // Fallback: if it has text_content, treat as text
  if (file.text_content) return 'text';
  if (file.data) return 'image';
  
  return 'unknown';
}

function getFileIcon(category) {
  switch (category) {
    case 'image': return 'image';
    case 'pdf': return 'picture_as_pdf';
    case 'doc': return 'article';
    case 'markdown': return 'edit_note';
    case 'html': return 'code';
    case 'code': return 'terminal';
    case 'text': return 'description';
    default: return 'insert_drive_file';
  }
}

function getCategoryLabel(category) {
  switch (category) {
    case 'image': return '圖片';
    case 'pdf': return 'PDF 文件';
    case 'doc': return 'Word 文件';
    case 'markdown': return 'Markdown';
    case 'html': return 'HTML';
    case 'code': return '程式碼';
    case 'text': return '文字檔案';
    default: return '檔案';
  }
}

/**
 * Open a base64 data URL in a new browser tab.
 */
function openDataInNewTab(dataUrl, fileName) {
  // For PDF data URLs, convert to blob URL for better browser handling
  if (dataUrl.startsWith('data:')) {
    try {
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    } catch (e) {
      // fallback: open data URL directly
    }
  }
  window.open(dataUrl, '_blank');
}

function DocxRenderer({ base64Data }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function renderDocx() {
      if (!base64Data || !containerRef.current) return;
      
      try {
        setLoading(true);
        // Dynamic import to avoid bloating initial bundle
        const docx = await import('docx-preview');
        
        // Convert Base64 data URL to Blob
        const byteString = atob(base64Data.split(',')[1]);
        const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });

        if (isMounted && containerRef.current) {
          // Clear previous render
          containerRef.current.innerHTML = '';
          
          await docx.renderAsync(blob, containerRef.current, null, {
            className: 'docx-preview-wrapper',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            experimental: false,
            trimXmlDeclaration: true,
            debug: false,
          });
        }
      } catch (err) {
        console.error('DOCX render error:', err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    renderDocx();

    return () => { isMounted = false; };
  }, [base64Data]);

  if (error) {
    return (
      <div className="p-6 text-error flex flex-col items-center justify-center min-h-[200px]">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-70">error</span>
        <p className="font-medium">高保真渲染失敗</p>
        <p className="text-[12px] opacity-70 mt-1">{error}</p>
        <p className="text-[12px] opacity-70 mt-4">請關閉視窗重新開啟，或使用備用文字萃取預覽。</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative min-h-[70vh] bg-[#f8f9fa] overflow-auto">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <span className="text-sm text-on-surface-variant font-medium">正在載入高保真預覽...</span>
        </div>
      )}
      {/* docx-preview rendering container */}
      <div 
        ref={containerRef} 
        className="w-full h-full [&>.docx-wrapper]:bg-transparent [&>.docx-wrapper]:p-4 sm:[&>.docx-wrapper]:p-8 [&>.docx-wrapper>section.docx]:shadow-lg"
      />
    </div>
  );
}

export default function FilePreviewModal({ file, onClose }) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  // Convert PDF data URL to blob URL for better iframe compatibility
  useEffect(() => {
    if (!file) return;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext === 'pdf' && file.data && file.data.startsWith('data:')) {
      try {
        const byteString = atob(file.data.split(',')[1]);
        const mimeString = file.data.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Failed to create blob URL for PDF:', e);
      }
    }
    return () => setPdfBlobUrl(null);
  }, [file]);

  if (!file) return null;

  const category = getFileCategory(file);
  const icon = getFileIcon(category);
  const label = getCategoryLabel(category);
  const hasDataUrl = !!file.data;
  const hasPdfData = category === 'pdf' && (pdfBlobUrl || hasDataUrl);
  const hasDocxData = category === 'doc' && hasDataUrl;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative max-w-4xl w-full max-h-[90vh] bg-surface rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md shrink-0">
          <h3 className="text-[16px] font-bold text-on-surface flex items-center gap-2 truncate flex-1 min-w-0">
            <span className="material-symbols-outlined text-primary shrink-0">{icon}</span>
            <span className="truncate">{file.name}</span>
            <span className="text-[11px] font-medium text-on-surface-variant bg-surface-variant/50 px-2 py-0.5 rounded-full shrink-0">{label}</span>
          </h3>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {/* Open in new tab button */}
            {hasDataUrl && (
              <button 
                onClick={() => openDataInNewTab(file.data, file.name)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
                title="在新分頁中開啟"
              >
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="overflow-auto flex-1 bg-surface-container-lowest">
          {/* Native PDF rendering via iframe */}
          {hasPdfData ? (
            <div className="w-full h-full flex flex-col" style={{ minHeight: '70vh' }}>
              <iframe
                src={pdfBlobUrl || file.data}
                title={file.name}
                className="w-full flex-1 border-0"
                style={{ minHeight: '70vh' }}
              />
              {/* Fallback link in case iframe doesn't render */}
              <div className="flex items-center justify-center gap-3 p-3 border-t border-outline-variant/30 bg-surface/60 shrink-0">
                <button
                  onClick={() => openDataInNewTab(file.data, file.name)}
                  className="flex items-center gap-2 text-[13px] text-primary font-medium hover:underline"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  在新分頁中開啟 PDF
                </button>
              </div>
            </div>
          ) : hasDocxData ? (
            <DocxRenderer base64Data={file.data} />
          ) : category === 'image' && file.data ? (
            <div className="w-full h-full flex items-center justify-center min-h-[200px] p-4">
              <img src={file.data} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          ) : (category === 'code' || category === 'html') && file.text_content ? (
            <pre className="whitespace-pre-wrap text-[13px] text-on-surface bg-inverse-surface/[0.03] p-6 font-mono text-left m-0 break-all leading-relaxed">
              {file.text_content}
            </pre>
          ) : file.text_content ? (
            <div className="p-6">
              {category === 'pdf' && (
                <div className="flex items-center gap-2 text-[12px] text-on-surface-variant bg-surface-variant/40 rounded-lg px-3 py-2 mb-4">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  PDF 文件已自動擷取文字內容，以下為萃取結果。原始檔案因未保存預覽資料，無法直接顯示。重新上傳即可啟用完整預覽。
                </div>
              )}
              {category === 'doc' && (
                <div className="flex items-center gap-2 text-[12px] text-on-surface-variant bg-surface-variant/40 rounded-lg px-3 py-2 mb-4">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  無法載入高保真 DOCX 預覽資料，以下為自動萃取之純文字內容。重新上傳即可啟用完整預覽。
                </div>
              )}
              <pre className="whitespace-pre-wrap text-[14px] text-on-surface bg-surface-container-low p-5 rounded-xl font-sans text-left m-0 break-words leading-[1.8]">
                {file.text_content}
              </pre>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[200px] text-center p-8">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-4">insert_drive_file</span>
              <p className="text-[14px] text-on-surface-variant">此檔案類型暫無法預覽內容，僅紀錄檔名。</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
