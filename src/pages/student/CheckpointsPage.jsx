import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, updateProject, getCheckpoints, getSubmissionsByProject, getCurrentUser, getAIReview } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import FilePreviewModal from '../../components/ui/FilePreviewModal';

export default function CheckpointsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Use state so re-reads trigger a re-render
  const [project, setProject] = useState(() => getProject(projectId));
  const [checkpoints, setCheckpoints] = useState(() => getCheckpoints(projectId));
  const [submissions, setSubmissions] = useState(() => getSubmissionsByProject(projectId));
  const user = getCurrentUser();

  // Reload data from localStorage (called after upload navigates back)
  const reload = useCallback(() => {
    setProject(getProject(projectId));
    setCheckpoints(getCheckpoints(projectId));
    setSubmissions(getSubmissionsByProject(projectId));
  }, [projectId]);

  // Listen for storage events (cross-tab) and custom aura_storage_change (same-tab)
  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener('storage', handler);
    window.addEventListener('aura_storage_change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('aura_storage_change', handler);
    };
  }, [reload]);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', team_members: '' });
  const [previewFile, setPreviewFile] = useState(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const handleOpenEdit = () => {
    setEditForm({
      title: project?.title || '',
      description: project?.description || '',
      team_members: Array.isArray(project?.team_members) ? project.team_members.join(', ') : (project?.team_members || '')
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateProject(project.id, {
      title: editForm.title,
      description: editForm.description,
      team_members: editForm.team_members.split(',').map(s => s.trim()).filter(Boolean)
    });
    setIsEditing(false);
    reload(); // re-read updated project from storage
  };

  if (!project) {
    return (
      <>
        <TopBar showBack />
        <div className="px-[var(--spacing-page)] max-w-lg mx-auto text-center py-20">
          <p className="text-on-surface-variant">{t('checkpoints.not_found')}</p>
        </div>
      </>
    );
  }

  const [expandedCp, setExpandedCp] = useState(null);

  const allCompleted = checkpoints.length > 0 && checkpoints.every(c => c.status === 'passed');
  const isEmpty = checkpoints.length === 0;

  // Calculate Progress — use completion_rate from latest review and checkpoint weights
  let totalProgress = 0;
  let totalWeight = 0;
  checkpoints.forEach(cp => {
    totalWeight += cp.weight_percent || 0;
    
    // Get latest review
    const cpSubs = submissions.filter(s => s.checkpoint_id === cp.id).sort((a,b) => b.version - a.version);
    const latestReview = cpSubs.length > 0 ? getAIReview(cpSubs[0].id) : null;
    
    let cpProgress = 0;
    if (cp.status === 'passed') {
      cpProgress = latestReview?.completion_rate ? Math.max(80, latestReview.completion_rate) : 100;
    } else if (latestReview) {
      cpProgress = latestReview.completion_rate || 0;
    }
    
    totalProgress += (cpProgress / 100) * (cp.weight_percent || 0);
  });
  
  // If weights don't sum exactly to 100 due to data errors, normalize
  const progressPercent = totalWeight > 0 ? Math.round((totalProgress / totalWeight) * 100) : 0;

  // Find next actionable checkpoint (not passed)
  const nextCp = checkpoints.find(c => c.status !== 'passed');

  // Collect unique files from submissions
  const uploadedFiles = [];
  submissions.forEach(sub => {
    if (sub.files_data) {
      sub.files_data.forEach(f => {
        uploadedFiles.push({
          ...f,
          submissionId: sub.id,
          type: f.name.endsWith('.pdf') ? 'pdf' : (f.name.match(/\.(png|jpg|jpeg)$/i) ? 'image' : 'other')
        });
      });
    } else {
      (sub.file_urls || []).forEach(fileUrl => {
        uploadedFiles.push({
          name: fileUrl,
          type: fileUrl.endsWith('.pdf') ? 'pdf' : (fileUrl.match(/\.(png|jpg|jpeg)$/i) ? 'image' : 'other'),
          submissionId: sub.id
        });
      });
    }
  });

  const MAX_VISIBLE_FILES = 4;
  const filesToShow = showAllFiles ? uploadedFiles : uploadedFiles.slice(0, MAX_VISIBLE_FILES);
  const hiddenFilesCount = uploadedFiles.length > MAX_VISIBLE_FILES ? uploadedFiles.length - MAX_VISIBLE_FILES : 0;

  if (isEmpty) {
    return (
      <>
        <TopBar title={t('checkpoints.title')} showBack />
        <div className="px-[var(--spacing-page)] max-w-lg mx-auto flex flex-col items-center justify-center min-h-[68vh] text-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-container/50 to-tertiary-container/50 flex items-center justify-center mb-8 shadow-sm border border-white/70">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">flag</span>
          </div>
          <h2 className="text-[20px] text-on-surface mb-2">{t('checkpoints.no_checkpoints_title')}</h2>
          <p className="text-[14px] text-on-surface-variant mb-6 max-w-xs leading-relaxed">
            {t('checkpoints.no_checkpoints_desc')}
          </p>
          <button
            onClick={() => navigate('/projects/new')}
            className="glass-card-solid rounded-full px-6 py-3 text-[14px] text-primary font-medium flex items-center gap-2 hover:shadow-md transition-shadow"
          >
            <span className="material-symbols-outlined text-[18px]">edit_document</span>
            {t('checkpoints.submit_proposal')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('checkpoints.title')} showBack />
      <main className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32 space-y-[var(--spacing-stack-xl)]">
        
        {/* Header Section */}
        <section className="animate-fade-up flex flex-col items-center">
          <div className="group relative inline-block">
            <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 font-medium">
              {project.title}
            </h2>
            <button 
              onClick={handleOpenEdit} 
              className="absolute -top-1 -right-10 p-1.5 text-outline-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100 rounded-full hover:bg-surface-variant/30"
              title={t('checkpoints.edit_project')}
            >
               <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>
          <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed delay-100 max-w-lg">
            {project.description || t('checkpoints.no_desc')}
          </p>
          
          {/* Team Members */}
          <div className="flex -space-x-3 justify-center mb-6">
            {project.team_members && project.team_members.length > 0 ? (
              (Array.isArray(project.team_members) ? project.team_members : [project.team_members]).map((member, i) => (
                <div key={i} title={member} className={`w-10 h-10 rounded-full border-2 border-surface flex items-center justify-center text-[12px] font-bold shadow-sm ${i % 3 === 0 ? 'bg-primary-container text-on-primary-container' : i % 3 === 1 ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'}`} style={{ zIndex: 20 - i }}>
                  {typeof member === 'string' ? member.charAt(0).toUpperCase() : '?'}
                </div>
              ))
            ) : (
              <>
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-primary-container flex items-center justify-center text-on-primary-container text-[12px] font-bold shadow-sm z-20">
                  {user?.name?.charAt(0) || 'Y'}
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-secondary-container flex items-center justify-center text-on-secondary-container text-[12px] font-bold shadow-sm z-10">
                  T
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-tertiary-container flex items-center justify-center text-on-tertiary-container text-[12px] font-bold shadow-sm z-0">
                  S
                </div>
              </>
            )}
          </div>
        </section>

        {/* Progress Section (Bento Card) */}
        <section className="bg-surface-container-lowest/80 backdrop-blur-2xl border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-[20px] p-[var(--spacing-stack-md)] flex items-center justify-between animate-fade-up delay-100">
          <div className="space-y-2 flex-1 pr-4">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="text-[12px] font-bold tracking-wider">{t('checkpoints.ai_summary')}</span>
            </div>
            <h2 className="text-[20px] text-on-surface font-light leading-snug">
              {allCompleted ? t('checkpoints.all_completed') : t('checkpoints.on_track')}
            </h2>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">
              {allCompleted 
                ? t('checkpoints.final_report_ready') 
                : nextCp ? `${t('checkpoints.next_prep')}${nextCp.title}${t('checkpoints.next_prep2')}` : ''}
            </p>
          </div>
          <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-surface-variant" cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeWidth="8"></circle>
              <circle 
                className="text-primary transition-all duration-1000 ease-out" 
                cx="50" cy="50" fill="none" r="40" stroke="currentColor" 
                strokeDasharray="251.2" 
                strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} 
                strokeLinecap="round" strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[22px] font-light text-on-surface">{progressPercent}<span className="text-[12px]">%</span></span>
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="space-y-[var(--spacing-stack-md)] animate-fade-up delay-200">
          <h3 className="text-[16px] font-medium text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-outline">format_list_bulleted</span>
            {t('checkpoints.checkpoints_label')}
          </h3>
          <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-outline-variant/30">
            {checkpoints.map((cp, idx) => {
              const isPassed = cp.status === 'passed';
              const isReview = cp.status === 'under_review' || cp.status === 'in_progress';
              const isRevision = cp.status === 'needs_revision';
              const isPending = !isPassed && !isReview && !isRevision;

              // Status label
              const statusLabel = isPassed
                ? t('checkpoints.completed')
                : isReview
                  ? t('checkpoints.in_progress')
                  : isRevision
                    ? t('checkpoints.needs_revision') || t('status_badge.needs_revision') || '需修改'
                    : t('checkpoints.incomplete');

              return (
                <div key={cp.id} className="relative group">
                  {/* Timeline Dot */}
                  {isPassed ? (
                    <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-primary-container border-4 border-surface flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[10px] text-on-primary-container font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    </div>
                  ) : isRevision ? (
                    <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-error-container border-4 border-surface shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] text-error font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                    </div>
                  ) : isReview ? (
                    <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-secondary-container border-4 border-surface shadow-sm"></div>
                  ) : (
                    <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-surface-variant border-4 border-surface"></div>
                  )}

                  {/* Timeline Content */}
                  <div 
                    onClick={() => setExpandedCp(expandedCp === cp.id ? null : cp.id)}
                    className={`rounded-[16px] p-4 transition-all duration-300 cursor-pointer ${
                    isPassed
                      ? 'bg-surface/50 border border-white/20 shadow-sm opacity-80 hover:opacity-100 hover:shadow-md'
                      : isRevision
                        ? 'bg-error-container/20 border border-error/20 shadow-sm hover:shadow-md'
                        : isReview
                          ? 'bg-surface border border-primary/10 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-md'
                          : 'bg-transparent border border-outline-variant/30 opacity-60 hover:opacity-100 hover:shadow-sm'
                  }`}>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h4 className={`text-[14px] font-medium text-on-surface leading-snug ${isPassed && expandedCp !== cp.id ? 'line-through decoration-on-surface-variant/50' : ''}`}>
                        {cp.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider ${
                          isPassed ? 'bg-surface-variant text-on-surface-variant' :
                          isRevision ? 'bg-error-container text-error' :
                          isReview ? 'bg-secondary-container text-on-secondary-container' :
                          'bg-surface-variant text-on-surface-variant'
                        }`}>
                          {statusLabel}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform" style={{ transform: expandedCp === cp.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          expand_more
                        </span>
                      </div>
                    </div>
                    <p className={`text-[14px] text-on-surface-variant leading-relaxed mb-3 ${expandedCp !== cp.id ? 'line-clamp-2' : ''}`}>
                      {cp.goal_description}
                    </p>

                    {expandedCp === cp.id && (
                       <div className="mt-4 pt-4 border-t border-outline-variant/30 animate-fade-in space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
                         {/* Description and Deliverable */}
                         <div>
                           <h5 className="text-[12px] font-bold text-on-surface mb-1">預期產出 (Deliverable)</h5>
                           <p className="text-[13px] text-on-surface-variant">{cp.expected_deliverable}</p>
                         </div>
                         
                         {/* Criteria List */}
                         {cp.criteria && cp.criteria.length > 0 && (
                           <div>
                             <h5 className="text-[12px] font-bold text-on-surface mb-2 flex items-center gap-1">
                               <span className="material-symbols-outlined text-[14px]">checklist</span>
                               評分標準 (Criteria)
                             </h5>
                             <div className="space-y-2">
                               {cp.criteria.map(c => {
                                 const cpSubs = submissions.filter(s => s.checkpoint_id === cp.id).sort((a,b) => b.version - a.version);
                                 const latestReview = cpSubs.length > 0 ? getAIReview(cpSubs[0].id) : null;
                                 const cResult = latestReview?.criteria_results?.find(r => r.criterion_id === c.id);
                                 
                                 return (
                                   <div key={c.id} className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20">
                                     <div className="flex justify-between items-start mb-1">
                                       <span className="text-[13px] font-medium text-on-surface">{c.label} ({c.weight}%)</span>
                                       {cResult && (
                                         <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${cResult.passed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
                                           {cResult.passed ? '達成' : '未達'} ({cResult.score}分)
                                         </span>
                                       )}
                                     </div>
                                     <p className="text-[12px] text-on-surface-variant mb-1">{c.description}</p>
                                     {cResult?.comment && (
                                       <div className="mt-2 pt-2 border-t border-outline-variant/10">
                                         <p className="text-[12px] text-on-surface-variant flex items-start gap-1">
                                           <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                                           <span>{cResult.comment}</span>
                                         </p>
                                       </div>
                                     )}
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                         
                         {/* Actions */}
                         <div className="flex gap-3 pt-2">
                           <button 
                             onClick={() => navigate(`/upload?project=${projectId}&checkpoint=${cp.id}`)}
                             className="flex-1 bg-primary text-on-primary text-[13px] font-medium py-2.5 rounded-lg flex items-center justify-center gap-1 shadow-sm hover:shadow-md transition-all hover:bg-primary/90"
                           >
                             <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                             {isPassed ? '更新版本' : '上傳成果'}
                           </button>
                         </div>
                       </div>
                    )}

                    {expandedCp !== cp.id && (
                      <>
                        {/* Due date */}
                        {cp.due_date && (
                          <p className={`text-[12px] flex items-center gap-1 mt-1 ${
                            !isPassed && new Date(cp.due_date) < new Date() ? 'text-error' : 'text-on-surface-variant/60'
                          }`}>
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {new Date(cp.due_date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                          </p>
                        )}

                        {isReview && (
                          <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-secondary w-[60%] rounded-full animate-[progress_2s_ease-out_forwards]"></div>
                          </div>
                        )}
                        {isRevision && (
                          <p className="text-[12px] text-error mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            完成度未達標，請修改後重新上傳
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Uploaded Files Section */}
        {uploadedFiles.length > 0 && (
          <section className="space-y-[var(--spacing-stack-md)] animate-fade-up delay-300">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-medium text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-outline">folder_open</span>
                {t('checkpoints.uploaded_files')}
              </h3>
              <span className="text-[12px] text-on-surface-variant font-medium">共 {uploadedFiles.length} 個檔案</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filesToShow.map((file, idx) => (
                <div key={idx} onClick={() => setPreviewFile(file)} className="bg-surface/70 backdrop-blur-sm rounded-lg p-2 border border-white/40 shadow-sm flex flex-col items-center text-center gap-2 hover:scale-105 transition-transform cursor-pointer">
                  <div className={`w-full h-24 rounded flex items-center justify-center overflow-hidden ${file.data && file.data.startsWith('data:image/') ? 'bg-tertiary-container/30' : 'bg-surface-variant'}`}>
                    {file.data && file.data.startsWith('data:image/') ? (
                      <img alt={file.name} className="w-full h-full object-cover" src={file.data} />
                    ) : (() => {
                      const ext = (file.name || '').split('.').pop().toLowerCase();
                      const iconMap = {
                        pdf: 'picture_as_pdf',
                        doc: 'article', docx: 'article',
                        md: 'edit_note', markdown: 'edit_note',
                        html: 'code', htm: 'code',
                        py: 'terminal', js: 'terminal', jsx: 'terminal', ts: 'terminal', tsx: 'terminal', css: 'terminal',
                        txt: 'description', csv: 'description', json: 'description',
                      };
                      return <span className="material-symbols-outlined text-outline text-[32px]">{iconMap[ext] || 'insert_drive_file'}</span>;
                    })()}
                  </div>
                  <span className="text-[12px] font-medium text-on-surface-variant truncate w-full px-1">{file.name}</span>
                </div>
              ))}
            </div>

            {hiddenFilesCount > 0 && !showAllFiles && (
              <button 
                onClick={() => setShowAllFiles(true)}
                className="w-full mt-2 py-2 rounded-lg border border-outline-variant/30 text-[13px] text-primary font-medium hover:bg-surface-variant/30 transition-colors flex justify-center items-center gap-1"
              >
                <span>展開所有檔案 (+{hiddenFilesCount})</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            )}
            {showAllFiles && hiddenFilesCount > 0 && (
              <button 
                onClick={() => setShowAllFiles(false)}
                className="w-full mt-2 py-2 rounded-lg border border-outline-variant/30 text-[13px] text-on-surface-variant font-medium hover:bg-surface-variant/30 transition-colors flex justify-center items-center gap-1"
              >
                <span>收合檔案</span>
                <span className="material-symbols-outlined text-[16px]">expand_less</span>
              </button>
            )}
            
            <div 
              onClick={() => navigate(`/upload?project=${projectId}`)}
              className="mt-4 bg-surface-container border border-dashed border-outline-variant/50 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-primary hover:bg-primary-container/20 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]">add_circle</span>
              <span className="text-[13px] font-medium">{t('checkpoints.add_more')}</span>
            </div>
          </section>
        )}

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col gap-4 animate-fade-up delay-400">
          {!allCompleted ? (
            <button
              onClick={() => navigate(`/upload?project=${projectId}`)}
              className="w-full bg-tertiary-container text-on-tertiary-container text-[16px] font-bold tracking-wider py-4 rounded-full shadow-sm hover:shadow-md hover:bg-tertiary-fixed-dim transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
              {t('checkpoints.upload_file')}
            </button>
          ) : (
            <button
              onClick={() => navigate(`/report/${projectId}`)}
              className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-bold tracking-wider py-4 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-xl">summarize</span>
              {t('checkpoints.view_final_report')}
            </button>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsEditing(false)}>
          <div className="bg-surface w-full max-w-lg rounded-3xl p-8 shadow-xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-[20px] font-bold text-on-surface mb-6">{t('checkpoints.edit_project')}</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5">{t('checkpoints.edit_title')}</label>
                <input 
                  value={editForm.title}
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary outline-none"
                />
              </div>
              
              <div>
                <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5">{t('checkpoints.edit_desc')}</label>
                <textarea 
                  value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  rows={4}
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5">{t('checkpoints.edit_members')}</label>
                <input 
                  value={editForm.team_members}
                  onChange={e => setEditForm({...editForm, team_members: e.target.value})}
                  placeholder="e.g. Alice, Bob, Charlie"
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 rounded-full border border-outline-variant/50 text-[14px] font-medium text-on-surface-variant hover:bg-surface-variant/30 transition-colors"
              >
                {t('checkpoints.edit_cancel')}
              </button>
              <button 
                onClick={handleSaveEdit}
                className="flex-1 bg-primary text-on-primary py-3 rounded-full text-[14px] font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                {t('checkpoints.edit_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
