import { useState, useCallback, useId } from 'react';
import { useTranslation } from '../../lib/i18n';

export default function FileUploadZone({ onFilesSelected, accept, label, sublabel }) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const inputId = useId();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
    onFilesSelected?.(droppedFiles);
  }, [onFilesSelected]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    onFilesSelected?.(selectedFiles);
  }, [onFilesSelected]);

  return (
    <div
      className={`upload-zone px-8 py-10 flex flex-col items-center justify-center gap-4 min-h-[220px] ${isDragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={handleFileInput}
      />
      <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center justify-center gap-3 w-full flex-1">
        <div className="w-16 h-16 rounded-[24px] bg-primary-container/25 flex items-center justify-center shadow-[0_10px_28px_rgba(111,80,146,0.08)]">
          <span className="material-symbols-outlined text-[28px] text-primary">cloud_upload</span>
        </div>
        <span className="text-[14px] text-primary font-medium">
          {label || t('file_upload.label')}
        </span>
        <span className="text-[12px] text-on-surface-variant">
          {sublabel || t('file_upload.sublabel')}
        </span>
      </label>

      {files.length > 0 && (
        <div className="w-full mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[13px] font-bold text-on-surface">已選擇 {files.length} 個檔案</span>
          </div>
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
          {files.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            const previewUrl = isImage ? URL.createObjectURL(file) : null;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface-container-low/80 rounded-[18px]">
                {isImage ? (
                  <img src={previewUrl} alt={file.name} className="w-10 h-10 object-cover rounded-md" />
                ) : (
                  <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                )}
                <span className="text-[13px] text-on-surface flex-1 truncate">{file.name}</span>
                <span className="text-[11px] text-on-surface-variant">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
