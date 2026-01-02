
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ComfyPreviewParams, MediaFile } from './types';
import { updateCaptions } from './services/projectService';
import { CONFIRM_MODAL_TEXTS } from './types';

// Contexts
import {
  ComfyPreviewProvider,
  useMedia,
  useApiConfig,
  useSettings,
  useQueue as useQueueContext,
  useComfyQueue,
  useModal,
  useProjectContext,
} from './contexts';

// Hooks
import {
  ToastProvider,
  useToast,
  useCaptionGeneration,
  useMetadataQueue,
  useProfile,
  useFileUpload,
  type FileConflictInfo,
  useCaptionHandlers,
  useMediaHandlers,
  useModalHandlers,
  useApiKeyHandler,
  useQueueProcessor,
  useUIState,
  useModalSync,
  useSegmentedAnalysis,
  useComfyPreview,
  useComfyHandlers,
  useConfirmModals,
  useProjectHandlers,
  useFileDragDrop,
  type ConflictInfo,
  type PendingProjectChange,
} from './hooks';

// Components
import {
  SettingsPanel,
  ComfyUIPanel,
  SegmentedAnalysisPanel,
  SegmentedAnalysisDetailModal,
  MediaGrid,
  ActionBar,
  ActionSidebar,
  ProfilePanel,
  MediaModal,
  ModalConfirm,
  ModalTripleChoice,
  MetadataProgressBar,
  GenericProgressBar,
  GlobalDragOverlay,
  ToastContainer,
} from './components';

// FIX: Imported `GenerateContentResponse` to correctly type the Gemini API response.

const App: React.FC = () => {
  const { mediaFiles, setMediaFiles, selectedFiles, updateFile, isSavingCaption } = useMedia();
  const { toasts, remove: removeToast, error: toastError, warning: toastWarning } = useToast();

  // Project context
  const {
    projects,
    selectedProjectId,
    isSaving: isProjectSaving,
    isLoading: isProjectLoading,
    isDeleting: isProjectDeleting,
    isDownloading: isProjectDownloading,
    error: projectError,
    selectProject,
    createProject,
    saveProject,
    loadProject,
    downloadProject,
    deleteProject,
    clearError: clearProjectError,
    saveProgress,
  } = useProjectContext();

  const currentProject = projects.find(p => p.id === selectedProjectId);

  const {
    apiProvider,
    setApiProvider,
    envApiKey,
    manualApiKey,
    setManualApiKey,
    isAiStudioKey,
    setIsAiStudioKey,
    openaiCompatibleEndpoint,
    setOpenaiCompatibleEndpoint,
    openaiCompatibleApiKey,
    setOpenaiCompatibleApiKey,
    openaiCompatibleModel,
    setOpenaiCompatibleModel,
    openaiCompatibleVideoFrameCount,
    setOpenaiCompatibleVideoFrameCount,
    isHttps,
    hasValidConfig,
    activeGeminiKey,
    activeOpenAICompatibleModel,
  } = useApiConfig();

  const {
    activeMediaId,
    setActiveMediaId,
    modalCaption,
    setModalCaption,
    modalCustomInstructions,
    setModalCustomInstructions,
    isModalOpen,
    activeMedia,
    hasPrevMedia,
    hasNextMedia,
    setMediaFiles: _setModalMediaFiles,
  } = useModal();

  React.useEffect(() => {
    _setModalMediaFiles(mediaFiles);
  }, [mediaFiles, _setModalMediaFiles]);

  const {
    triggerWord,
    setTriggerWord,
    datasetPrefix,
    setDatasetPrefix,
    isCharacterTaggingEnabled,
    setIsCharacterTaggingEnabled,
    characterShowName,
    setCharacterShowName,
    bulkGenerationInstructions,
    setBulkGenerationInstructions,
    bulkInstructions,
    setBulkInstructions,
    autofitTextareas,
    setAutofitTextareas,
    segmentedAnalysisConfig,
    setSegmentedAnalysisConfig,
    setSegmentPrompt,
    setSegmentTemperature,
    setPostProcessPrompt,
    setSegmentExpanded,
    setPostProcessExpanded,
    comfyServerUrl,
    setComfyServerUrl,
    comfyWorkflowId,
    setComfyWorkflowId,
    comfySeed,
    setComfySeed,
    comfySteps,
    setComfySteps,
    comfyStepsMin,
    setComfyStepsMin,
    comfyStepsMax,
    setComfyStepsMax,
    comfySeedLow,
    setComfySeedLow,
    comfySeedHigh,
    setComfySeedHigh,
  } = useSettings();

  const {
    isQueueEnabled,
    setIsQueueEnabled,
    requestQueue,
    setRequestQueue,
    isProcessingQueueItem,
    setIsProcessingQueueItem,
    completedQueueCount,
    setCompletedQueueCount,
    rpmLimit,
    setRpmLimit,
    batchSize,
    setBatchSize,
    enqueueGenerateRequest,
    enqueueSegmentedAnalysisRequest,
    currentBatch,
    setCurrentBatch,
    clearWaitingQueue,
    totalQueueItems,
    queueProgress,
  } = useQueueContext();

  // ComfyUI Queue context
  const {
    queueStatus: comfyQueueStatus,
    setIsEnabled: setComfyEnabled,
    setServerUrl: setComfyServerUrlContext,
  } = useComfyQueue();

  const [metadataQueue, setMetadataQueue] = useState<string[]>([]);
  const [metadataActiveId, setMetadataActiveId] = useState<string | null>(null);
  const [metadataCompletedCount, setMetadataCompletedCount] = useState<number>(0);

  // Segmented analysis modal and progress state
  const [isSAModalOpen, setIsSAModalOpen] = useState(false);
  const [saCompletedCount, setSaCompletedCount] = useState(0);

  // ZIP extraction progress state
  const [zipProgress, setZipProgress] = useState({ isActive: false, progress: 0, current: 0, total: 0 });

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<{
    userProfile?: boolean;
    globalSettings?: boolean;
    comfyUI?: boolean;
    segmentedAnalysis?: boolean;
  }>({});

  // Calculate segmented analysis progress
  const saActiveRequests = requestQueue.filter(r => r.type === 'segmentedAnalysis').length;
  const saTotalCount = saCompletedCount + saActiveRequests;
  const saProgress = saTotalCount > 0 ? (saCompletedCount / saTotalCount) * 100 : 0;

  const { _generateCaption, _checkQuality, handlersRef } = useCaptionGeneration({
    mediaFiles,
    triggerWord,
    isCharacterTaggingEnabled,
    characterShowName,
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
    hasValidConfig,
    openaiCompatibleVideoFrameCount,
    updateFile,
    onCaptionGenerated: async (id, caption) => {
      if (selectedProjectId) {
        await updateCaptions(selectedProjectId, { [id]: caption });
      }
    },
  });

  const { executeSegmentedAnalysis } = useSegmentedAnalysis({
    mediaFiles,
    config: segmentedAnalysisConfig,
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
    updateFile,
  });

  // Add segmented analysis handler to handlersRef
  handlersRef.current._executeSegmentedAnalysis = executeSegmentedAnalysis;

  // ComfyUI Preview hook
  const { startPreview: startComfyPreview } = useComfyPreview({
    comfyServerUrl,
    comfyWorkflowId,
    comfySeed,
    comfySteps,
    comfyStepsMin,
    comfyStepsMax,
    comfySeedLow,
    comfySeedHigh,
    updateFile,
    projectId: selectedProjectId,
  });

  // Define handleComfyPreview here to use in both useConfirmModals and useComfyHandlers
  const handleComfyPreview = useCallback(
    (id: string, caption?: string, params?: ComfyPreviewParams) => {
      const file = mediaFiles.find((f) => f.id === id);
      if (file) {
        const captionToUse = caption || file.caption;
        if (captionToUse) {
          startComfyPreview(file, captionToUse, params);
        }
      }
    },
    [mediaFiles, startComfyPreview]
  );

  const {
    profileName,
    setProfileName,
    profileError,
    autoSaveStatus,
    handleProjectSave,
    handleProfileDownload,
    handleProfileUpload,
    isSavingProfile,
    isUploading,
    uploadSuccess,
  } = useProfile({
    apiProvider,
    manualApiKey,
    envApiKey,
    openaiCompatibleEndpoint,
    openaiCompatibleModel,
    openaiCompatibleApiKey,
    openaiCompatibleVideoFrameCount,
    triggerWord,
    datasetPrefix,
    isCharacterTaggingEnabled,
    characterShowName,
    bulkGenerationInstructions,
    bulkInstructions,
    isQueueEnabled,
    rpmLimit,
    batchSize,
    autofitTextareas,
    comfyServerUrl,
    setComfyServerUrl,
    comfyWorkflowId,
    setComfyWorkflowId,
    comfySeed,
    setComfySeed,
    comfySteps,
    setComfySteps,
    comfyStepsMin,
    setComfyStepsMin,
    comfyStepsMax,
    setComfyStepsMax,
    comfySeedLow,
    setComfySeedLow,
    comfySeedHigh,
    setComfySeedHigh,
    segmentedAnalysisConfig,
    setSegmentedAnalysisConfig,
    setApiProvider,
    setManualApiKey,
    setIsAiStudioKey,
    setOpenaiCompatibleEndpoint,
    setOpenaiCompatibleModel,
    setOpenaiCompatibleApiKey,
    setOpenaiCompatibleVideoFrameCount,
    setTriggerWord,
    setDatasetPrefix,
    setIsCharacterTaggingEnabled,
    setCharacterShowName,
    setBulkGenerationInstructions,
    setBulkInstructions,
    setIsQueueEnabled,
    setRpmLimit,
    setBatchSize,
    setAutofitTextareas,
    collapsedSections,
    setCollapsedSections,
  });

  const { enqueueMetadataRequest, metadataProgress, isMetadataQueueActive } = useMetadataQueue({
    metadataQueue,
    metadataActiveId,
    metadataCompletedCount,
    setMetadataQueue,
    setMetadataActiveId,
    setMetadataCompletedCount,
    mediaFiles,
    updateFile,
    projectId: currentProject?.id ?? null,
  });

  // Use media handlers hook for media management
  const {
    handleSelectAll,
    handleCheckQuality,
    handleCaptionChange,
    handleCustomInstructionsChange,
    handleSelectionChange,
    handleDownload,
    deleteSelected,
    deleteOne,
  } = useMediaHandlers({
    mediaFiles,
    selectedFiles,
    datasetPrefix,
    isQueueEnabled,
    _checkQuality,
    updateFile,
    setMediaFiles,
    setRequestQueue,
  });

  // Use modal handlers hook for modal navigation
  const {
    openMediaModal,
    handleModalClose,
    handleModalPrev,
    handleModalNext,
    handleModalCaptionChange,
    handleModalCustomInstructionsChange,
  } = useModalHandlers({
    mediaFiles,
    activeMediaId,
    hasPrevMedia,
    hasNextMedia,
    updateFile,
    setActiveMediaId,
    setModalCaption,
    setModalCustomInstructions,
    onModalNavigate: async (item) => {
      if (!selectedProjectId) return;
      // Save caption history only when new caption is not blank
      if (item.caption.trim()) {
        await updateCaptions(selectedProjectId, { [item.id]: item.caption });
      }
      // Update initialCaption after successful save
      updateFile(item.id, { initialCaption: item.caption });
    },
    onModalClose: async (item) => {
      if (!selectedProjectId || !item) return;
      // Save caption history only when new caption is not blank
      if (item.caption.trim()) {
        await updateCaptions(selectedProjectId, { [item.id]: item.caption });
      }
      // Update initialCaption after successful save
      updateFile(item.id, { initialCaption: item.caption });
    },
  });

  const { handleSelectKey } = useApiKeyHandler(envApiKey, setIsAiStudioKey);

  useQueueProcessor({
    isQueueEnabled,
    isProcessingQueueItem,
    requestQueue,
    rpmLimit,
    completedQueueCount,
    batchSize,
    setIsProcessingQueueItem,
    setCompletedQueueCount,
    setRequestQueue,
    currentBatch,
    setCurrentBatch,
    handlersRef,
  });

  // Use confirm modals hook first to get showGenerateAllConfirm
  const {
    isConfirmModalOpen,
    isDeleteConfirmOpen,
    isProjectDeleteConfirmOpen,
    isUploadConfirmOpen,
    isDownloadConfirmOpen,
    isPreviewConfirmOpen,
    isProjectChangeConfirmOpen,
    isGenerateAllConfirmOpen,
    conflictInfo,
    deleteItemId,
    pendingUploadFile,
    includeApiKeys,
    existingPreviewCount,
    totalPreviewCount,
    pendingProjectChange,
    isProjectChanging,
    showConflictModal,
    hideConflictModal,
    showDeleteConfirm,
    confirmDelete,
    hideDeleteConfirm,
    showDeleteItemConfirm,
    showUploadConfirm,
    confirmUpload,
    hideUploadConfirm,
    showDownloadConfirm,
    confirmDownload,
    hideDownloadConfirm,
    showPreviewConfirm,
    confirmPreviewRegenerateAll,
    confirmPreviewSkipExisting,
    hidePreviewConfirm,
    showProjectDeleteConfirm,
    confirmProjectDelete,
    hideProjectDeleteConfirm,
    showProjectChangeConfirm,
    confirmProjectChange,
    hideProjectChangeConfirm,
    setIncludeApiKeys,
    showGenerateAllConfirm,
    confirmGenerateAllRegenerate,
    confirmGenerateAllSkipExisting,
    hideGenerateAllConfirm,
  } = useConfirmModals({
    onDeleteSelected: deleteSelected,
    onDeleteOne: deleteOne,
    onProfileUpload: handleProfileUpload,
    onProfileDownload: handleProfileDownload,
    onPreviewAll: (regenerateAll?: boolean) => {
      const itemsWithCaption = mediaFiles.filter(f => f.caption.trim());
      if (regenerateAll === true) {
        itemsWithCaption.forEach(item => {
          handleComfyPreview(item.id);
        });
      } else if (regenerateAll === false) {
        const itemsWithoutPreview = itemsWithCaption.filter(f => !f.previewFile);
        itemsWithoutPreview.forEach(item => {
          handleComfyPreview(item.id);
        });
      } else {
        // No parameter - check if existing previews
        const itemsWithPreview = itemsWithCaption.filter(f => f.previewFile);
        if (itemsWithPreview.length > 0) {
          showPreviewConfirm(itemsWithPreview.length, itemsWithCaption.length);
        } else {
          itemsWithCaption.forEach(item => {
            handleComfyPreview(item.id);
          });
        }
      }
    },
    mediaFiles,
    onSelectProject: selectProject,
    onSetMediaFiles: setMediaFiles,
    onDeleteProject: deleteProject,
    selectedProjectId,
  });

  // Use caption handlers with showGenerateAllConfirm
  const {
    handleGenerateCaption,
    handleGenerateAll,
    handleGenerateSelected,
    handleRefineSelected,
  } = useCaptionHandlers({
    mediaFiles,
    selectedFiles,
    bulkGenerationInstructions,
    bulkInstructions,
    isQueueEnabled,
    segmentedAnalysisConfig,
    _generateCaption,
    enqueueGenerateRequest,
    enqueueSegmentedAnalysisRequest,
    showGenerateAllConfirm,
  });

  const {
    handlePreviewAll,
    comfyGeneratingItems,
    comfyCompletedItems,
    comfyTotalRequested,
    isComfyProcessing,
    comfyProgress,
  } = useComfyHandlers({
    mediaFiles,
    showPreviewConfirm,
    handleComfyPreview,
  });

  // Use project handlers hook for project management
  const {
    handleMediaProjectFilesLoaded,
    handleBeforeProjectChange,
    handleMediaProjectCreate,
    handleMediaProjectSave,
    handleMediaProjectLoad,
    handleRenameMedia,
    handleRestoreVersion,
    handleMediaProjectDownload,
    handleMediaProjectDelete,
  } = useProjectHandlers({
    mediaFiles,
    selectedProjectId,
    currentProject,
    datasetPrefix,
    createProject,
    saveProject,
    loadProject,
    downloadProject,
    deleteProject,
    setMediaFiles,
    showProjectDeleteConfirm,
    showProjectChangeConfirm,
    updateFile,
    toastError,
    toastWarning,
  });

  // Use file upload hook for file handling
  const { handleFilesAdded } = useFileUpload({
    setMediaFiles,
    enqueueMetadataRequest,
    selectedProjectId,
    onConflictDetected: useCallback((conflict: FileConflictInfo, confirmCallback: () => void, cancelCallback: () => void) => {
      showConflictModal({
        conflictingFiles: conflict.existingNames,
        confirmCallback,
        cancelCallback,
      });
    }, [showConflictModal]),
    onZipProgressChange: useCallback((isActive: boolean, progress: number, current: number, total: number) => {
      setZipProgress({ isActive, progress, current, total });
    }, []),
  });

  // Track segmented analysis completion
  useEffect(() => {
    if (currentBatch) {
      const saRequestsInBatch = currentBatch.requests.filter(r => r.type === 'segmentedAnalysis').length;
      // When batch completes, saCompletedCount will be updated
      const checkInterval = setInterval(() => {
        if (!isProcessingQueueItem) {
          clearInterval(checkInterval);
          setSaCompletedCount(prev => prev + saRequestsInBatch);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, [isProcessingQueueItem, currentBatch]);

  // Reset segmented analysis count when disabled
  useEffect(() => {
    if (!segmentedAnalysisConfig.enabled) {
      setSaCompletedCount(0);
    }
  }, [segmentedAnalysisConfig.enabled]);

  // Sync ComfyUI server URL with settings and enable queue when configured
  useEffect(() => {
    if (comfyServerUrl && comfyWorkflowId) {
      setComfyServerUrlContext(comfyServerUrl);
      setComfyEnabled(true);
    } else {
      setComfyEnabled(false);
    }
  }, [comfyServerUrl, comfyWorkflowId, setComfyServerUrlContext, setComfyEnabled]);

  const { modalCaptionRef, allSelected } = useUIState(mediaFiles);

  useModalSync(
    activeMediaId,
    mediaFiles,
    activeMedia,
    modalCaption,
    setActiveMediaId,
    setModalCaption,
    setModalCustomInstructions
  );

  const handleClearQueue = () => {
    clearWaitingQueue(updateFile);
  };

  const { isDragging, dragHandlers } = useFileDragDrop({
    onFilesDrop: (files) => {
      handleFilesAdded(files, mediaFiles);
    }
  });

  return (
    <ComfyPreviewProvider
      initialSeed={comfySeed}
      initialSteps={comfySteps}
      initialStepsMin={comfyStepsMin}
      initialStepsMax={comfyStepsMax}
      initialSeedLow={comfySeedLow}
      initialSeedHigh={comfySeedHigh}
      initialWorkflowId={comfyWorkflowId}
      onSeedChange={setComfySeed}
      onStepsChange={setComfySteps}
      onStepsMinChange={setComfyStepsMin}
      onStepsMaxChange={setComfyStepsMax}
      onSeedLowChange={setComfySeedLow}
      onSeedHighChange={setComfySeedHigh}
      onWorkflowIdChange={setComfyWorkflowId}
    >
      {/* ActionSidebar: Sidebar always displayed on the right */}
      <ActionSidebar
        hasValidConfig={hasValidConfig}
        mediaCount={mediaFiles.length}
        selectedCount={selectedFiles.length}
        captionedCount={mediaFiles.filter(f => f.caption.trim()).length}
        allSelected={allSelected}
        isIndeterminate={selectedFiles.length > 0 && !allSelected}
        onSelectAll={handleSelectAll}
        onGenerateAll={handleGenerateAll}
        onGenerateSelected={handleGenerateSelected}
        onCheckQuality={() => { void handleCheckQuality(); }}
        onDownload={() => { void handleDownload(); }}
        onDelete={showDeleteConfirm}
        comfyEnabled={!!comfyServerUrl && !!comfyWorkflowId}
        onPreviewAll={handlePreviewAll}
        onSortItems={() => {
          setMediaFiles(prev => [...prev].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          ));
        }}
        isProcessing={Boolean(isQueueEnabled && totalQueueItems > 0 || isComfyProcessing)}
      />
      <div
        className="min-h-screen mx-auto p-4 pr-16 md:p-8 md:pr-20 w-full max-w-screen-2xl"
        {...dragHandlers}
      >
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">LoRA Caption Assistant</h1>
          <p className="mt-2 text-lg text-gray-400">Generate high-quality captions for your training data.</p>
        </header>

        <main className="space-y-8">
          <ProfilePanel
            profileName={profileName}
            onProfileNameChange={setProfileName}
            autoSaveStatus={autoSaveStatus}
            onSaveNow={handleProjectSave}
            onDownload={showDownloadConfirm}
            onUpload={showUploadConfirm}
            errorMessage={profileError}
            isCollapsed={collapsedSections.userProfile ?? false}
            onToggleCollapse={() => setCollapsedSections(prev => ({ ...prev, userProfile: !prev.userProfile }))}
            isSaving={isSavingProfile}
            isUploading={isUploading}
            uploadSuccess={uploadSuccess}
          />
          <SettingsPanel
            apiProvider={apiProvider}
            onApiProviderChange={setApiProvider}
            geminiSettings={{
              envApiKey,
              manualApiKey,
              isAiStudioKey,
              onManualApiKeyChange: setManualApiKey,
              onSelectKey: handleSelectKey,
            }}
            openaiCompatibleSettings={{
              openaiCompatibleEndpoint,
              onOpenAICompatibleEndpointChange: setOpenaiCompatibleEndpoint,
              openaiCompatibleApiKey,
              onOpenAICompatibleApiKeyChange: setOpenaiCompatibleApiKey,
              openaiCompatibleModel,
              onOpenAICompatibleModelChange: setOpenaiCompatibleModel,
              openaiCompatibleVideoFrameCount,
              onOpenAICompatibleVideoFrameCountChange: setOpenaiCompatibleVideoFrameCount,
              isHttps,
            }}
            generalSettings={{
              triggerWord,
              onTriggerWordChange: setTriggerWord,
              datasetPrefix,
              onDatasetPrefixChange: setDatasetPrefix,
              isCharacterTaggingEnabled,
              onCharacterTaggingToggle: setIsCharacterTaggingEnabled,
              characterShowName,
              onCharacterShowNameChange: setCharacterShowName,
            }}
            instructionSettings={{
              bulkGenerationInstructions,
              onBulkGenerationInstructionsChange: setBulkGenerationInstructions,
              bulkInstructions,
              onBulkInstructionsChange: setBulkInstructions,
              onRefineSelected: handleRefineSelected,
              hasValidConfig,
              selectedCount: selectedFiles.length,
            }}
            autofitToggle={{
              autofitTextareas,
              onAutofitToggle: setAutofitTextareas,
            }}
            queueControls={{
              isQueueEnabled,
              onQueueToggle: setIsQueueEnabled,
              rpmLimit,
              onRpmLimitChange: setRpmLimit,
              batchSize,
              onBatchSizeChange: setBatchSize,
              isProcessingQueueItem,
              requestQueueLength: requestQueue.length,
              completedQueueCount,
              totalQueueItems,
              queueProgress,
              onClearQueue: handleClearQueue,
              queueRunning: comfyQueueStatus?.queue_running?.length,
              queueRemaining: comfyQueueStatus?.queue_pending?.length,
            }}
            isCollapsed={collapsedSections.globalSettings ?? false}
            onToggleCollapse={() => setCollapsedSections(prev => ({ ...prev, globalSettings: !prev.globalSettings }))}
          />

          <ComfyUIPanel
            serverUrl={comfyServerUrl}
            onServerUrlChange={setComfyServerUrl}
            queueRunning={comfyQueueStatus?.queue_running?.length}
            queueRemaining={comfyQueueStatus?.queue_pending?.length}
            isCollapsed={collapsedSections.comfyUI ?? false}
            onToggleCollapse={() => setCollapsedSections(prev => ({ ...prev, comfyUI: !prev.comfyUI }))}
          />

          <SegmentedAnalysisPanel
            config={segmentedAnalysisConfig}
            onConfigChange={setSegmentedAnalysisConfig}
            onSegmentPromptChange={setSegmentPrompt}
            onSegmentTemperatureChange={setSegmentTemperature}
            onPostProcessPromptChange={setPostProcessPrompt}
            onSegmentExpandedChange={setSegmentExpanded}
            onPostProcessExpandedChange={setPostProcessExpanded}
            isCollapsed={collapsedSections.segmentedAnalysis ?? false}
            onToggleCollapse={() => setCollapsedSections(prev => ({ ...prev, segmentedAnalysis: !prev.segmentedAnalysis }))}
          />

          <MediaGrid
            mediaFiles={mediaFiles}
            autofitTextareas={autofitTextareas}
            hasValidConfig={hasValidConfig}
            onGenerate={handleGenerateCaption}
            onCaptionChange={handleCaptionChange}
            onCustomInstructionsChange={handleCustomInstructionsChange}
            onSelectionChange={handleSelectionChange}
            onPreview={openMediaModal}
            comfyEnabled={!!comfyServerUrl && !!comfyWorkflowId}
            onComfyPreview={handleComfyPreview}
            onDelete={showDeleteItemConfirm}
            projectId={currentProject?.id || null}
            onFilesDrop={(files) => handleFilesAdded(files, mediaFiles)}
            actionBar={
              <ActionBar
                hasValidConfig={hasValidConfig}
                mediaCount={mediaFiles.length}
                selectedCount={selectedFiles.length}
                captionedCount={mediaFiles.filter(f => f.caption.trim()).length}
                allSelected={allSelected}
                onSelectAll={handleSelectAll}
                onGenerateAll={handleGenerateAll}
                onGenerateSelected={handleGenerateSelected}
                onCheckQuality={() => { void handleCheckQuality(); }}
                onDownload={() => { void handleDownload(); }}
                onDelete={showDeleteConfirm}
                comfyEnabled={!!comfyServerUrl && !!comfyWorkflowId}
                onPreviewAll={handlePreviewAll}
                onSortItems={() => {
                  setMediaFiles(prev => [...prev].sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                  ));
                }}
                isProcessing={Boolean(isQueueEnabled && totalQueueItems > 0 || isComfyProcessing)}
                projectSelectedId={selectedProjectId}
                projectList={projects}
                onProjectChange={async (projectId) => {
                  if (projectId === null) {
                    // Clear project selection - convert media file IDs to temporary IDs
                    setMediaFiles(prev => prev.map(file => {
                      const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                      return { ...file, id: tempId };
                    }));
                    await selectProject(null);
                  } else {
                    // Clear the media files grid before loading the new project
                    // This prevents files from different projects from mixing
                    setMediaFiles([]);
                    await selectProject(projectId, handleMediaProjectFilesLoaded);
                  }
                }}
                onBeforeProjectChange={handleBeforeProjectChange}
                onProjectCreate={handleMediaProjectCreate}
                onProjectSave={handleMediaProjectSave}
                onProjectLoad={handleMediaProjectLoad}
                onProjectDownload={handleMediaProjectDownload}
                onProjectDelete={handleMediaProjectDelete}
                isProjectSaving={isProjectSaving}
                isProjectLoading={isProjectLoading}
                isProjectDownloading={isProjectDownloading}
                isSavingCaption={isSavingCaption}
              />
            }
          />
        </main>
        <MediaModal
          isOpen={isModalOpen}
          item={activeMedia}
          index={activeMedia ? mediaFiles.findIndex(m => m.id === activeMedia.id) : 0}
          totalCount={mediaFiles.length}
          caption={modalCaption}
          customInstructions={modalCustomInstructions}
          captionInputRef={modalCaptionRef}
          onCaptionChange={handleModalCaptionChange}
          onCustomInstructionsChange={handleModalCustomInstructionsChange}
          onGenerate={handleGenerateCaption}
          hasValidConfig={hasValidConfig}
          onClose={handleModalClose}
          onPrev={handleModalPrev}
          onNext={handleModalNext}
          hasPrev={hasPrevMedia}
          hasNext={hasNextMedia}
          comfyEnabled={!!comfyServerUrl && !!comfyWorkflowId}
          onComfyPreview={handleComfyPreview}
          projectId={selectedProjectId}
          onFileRestore={handleRestoreVersion}
          onRename={handleRenameMedia}
        />
        <SegmentedAnalysisDetailModal
          isOpen={isSAModalOpen}
          mediaFiles={mediaFiles}
          onClose={() => setIsSAModalOpen(false)}
        />
        <MetadataProgressBar
          isMetadataQueueActive={isMetadataQueueActive}
          metadataProgress={metadataProgress}
        />
        <GenericProgressBar
          isActive={isQueueEnabled && totalQueueItems > 0}
          progress={queueProgress}
          color="purple"
          offset={0}
          label="Generating Captions"
          detailLabel={`${completedQueueCount}/${totalQueueItems} items`}
        />
        <GenericProgressBar
          isActive={isComfyProcessing}
          progress={comfyProgress}
          color="pink"
          offset={isComfyProcessing ? 0 : 42}
          label="ComfyUI Previews"
          detailLabel={`${comfyCompletedItems}/${comfyTotalRequested} items`}
        />
        <GenericProgressBar
          isActive={segmentedAnalysisConfig.enabled && saTotalCount > 0}
          progress={saProgress}
          color="purple"
          offset={42}
          label="Segmented Analysis"
          detailLabel={`${saCompletedCount}/${saTotalCount} items`}
          onShowDetail={() => setIsSAModalOpen(true)}
        />
        <GenericProgressBar
          isActive={zipProgress.isActive}
          progress={zipProgress.progress}
          color="blue"
          offset={zipProgress.isActive ? 0 : 42}
          label="Extracting ZIP files"
          detailLabel={`${zipProgress.current}/${zipProgress.total}`}
        />
        <GenericProgressBar
          isActive={saveProgress.isActive || isProjectLoading}
          progress={saveProgress.isActive ? saveProgress.progress : (isProjectSaving ? 50 : 100)}
          color="blue"
          offset={saveProgress.isActive ? 0 : (isProjectSaving || isProjectLoading ? 0 : 42)}
          label={saveProgress.isActive ? 'Saving Project' : (isProjectSaving ? 'Saving Project' : 'Loading Project')}
          detailLabel={saveProgress.isActive ? `${saveProgress.current}/${saveProgress.total}` : undefined}
        />
        <GlobalDragOverlay isVisible={isDragging} />
        <ModalConfirm
          isOpen={isConfirmModalOpen}
          title="Duplicate File Names"
          message={
            <>
              <p className="mb-3">The following file(s) already exist:</p>
              <div className="max-h-40 overflow-y-auto bg-gray-900 rounded-md p-3 space-y-1">
                {conflictInfo?.conflictingFiles.map((fileName, idx) => (
                  <div key={idx} className="text-sm truncate" title={fileName}>
                    {fileName}
                  </div>
                ))}
              </div>
              <p className="mt-3">Do you want to replace them?</p>
            </>
          }
          confirmText="Replace"
          cancelText="Keep Both"
          onConfirm={() => {
            conflictInfo?.confirmCallback();
            hideConflictModal();
          }}
          onCancel={() => {
            conflictInfo?.cancelCallback();
            hideConflictModal();
          }}
          variant="warning"
          initialFocus="confirm"
        />
        <ModalConfirm
          isOpen={isDeleteConfirmOpen}
          title={deleteItemId ? "Delete Item" : "Delete Selected Items"}
          message={deleteItemId
            ? "Are you sure you want to delete this item? This action cannot be undone."
            : `Are you sure you want to delete ${selectedFiles.length} selected item(s)? This action cannot be undone.`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={hideDeleteConfirm}
          variant="danger"
          initialFocus="confirm"
        />
        <ModalConfirm
          isOpen={isProjectDeleteConfirmOpen}
          title="Delete Project"
          message={`Are you sure you want to delete project "${projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId || ''}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmProjectDelete}
          onCancel={hideProjectDeleteConfirm}
          variant="danger"
          isLoading={isProjectDeleting}
          initialFocus="confirm"
        />
        <ModalConfirm
          isOpen={isUploadConfirmOpen}
          title="Upload Profile File"
          message={
            <>
              <p className="mb-3">This will replace your current profile configuration with the uploaded file.</p>
              <p className="text-orange-400 font-medium">⚠ Warning: This action cannot be undone. The current configuration will be permanently lost.</p>
            </>
          }
          confirmText="Upload"
          cancelText="Cancel"
          onConfirm={confirmUpload}
          onCancel={hideUploadConfirm}
          variant="warning"
          initialFocus="confirm"
        />
        <ModalConfirm
          isOpen={isDownloadConfirmOpen}
          title="Download Profile File"
          message={
            <>
              <p className="mb-3">Download your profile configuration as a JSON file.</p>
              <p className="text-gray-400 text-sm">By default, API keys are excluded for security. Check the box below to include them.</p>
            </>
          }
          confirmText="Download"
          cancelText="Cancel"
          onConfirm={confirmDownload}
          onCancel={hideDownloadConfirm}
          variant="info"
          checkboxLabel="Include API keys in the downloaded file"
          checkboxChecked={false}
          onCheckboxChange={setIncludeApiKeys}
          initialFocus="confirm"
        />
        <ModalTripleChoice
          isOpen={isPreviewConfirmOpen}
          title="Existing Previews Found"
          message={
            <>
              <p className="mb-2">
                {existingPreviewCount} out of {totalPreviewCount} items already have previews.
              </p>
              <p className="text-gray-400 text-sm">What would you like to do?</p>
            </>
          }
          firstText="Regenerate All"
          secondText="Skip Existing"
          thirdText="Cancel"
          onFirst={confirmPreviewRegenerateAll}
          onSecond={confirmPreviewSkipExisting}
          onThird={hidePreviewConfirm}
          variant="warning"
          firstVariant="danger"
          secondVariant="warning"
        />

        <ModalConfirm
          isOpen={isProjectChangeConfirmOpen}
          title="Change Project"
          message={
            <>
              <p className="mb-2">
                Unsaved changes may be lost.
              </p>
              <p className="text-gray-400 text-sm">
                Are you sure you want to reload to a different project?
              </p>
            </>
          }
          confirmText="Change"
          cancelText="Cancel"
          onConfirm={confirmProjectChange}
          onCancel={hideProjectChangeConfirm}
          variant="warning"
          isLoading={isProjectChanging}
          initialFocus="confirm"
        />
        <ModalTripleChoice
          isOpen={isGenerateAllConfirmOpen}
          title={CONFIRM_MODAL_TEXTS.CAPTION.title}
          message={
            <>
              <p className="mb-2">
                {CONFIRM_MODAL_TEXTS.MESSAGE.SOME_HAVE_CAPTIONS}
              </p>
              <p className="text-gray-400 text-sm">{CONFIRM_MODAL_TEXTS.MESSAGE.WHAT_WOULD_YOU_DO}</p>
            </>
          }
          firstText={CONFIRM_MODAL_TEXTS.BUTTONS.REGENERATE_ALL}
          secondText={CONFIRM_MODAL_TEXTS.BUTTONS.SKIP_EXISTING}
          thirdText={CONFIRM_MODAL_TEXTS.BUTTONS.CANCEL}
          onFirst={confirmGenerateAllRegenerate}
          onSecond={confirmGenerateAllSkipExisting}
          onThird={hideGenerateAllConfirm}
          variant="warning"
          firstVariant="danger"
          secondVariant="warning"
        />

      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ComfyPreviewProvider>
  );
};

export default App;
