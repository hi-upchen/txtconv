'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { upload } from '@vercel/blob/client';
import { validateFile } from '@/lib/file-validator';
import {
  convertFile as clientConvertFile,
  type ConversionProgress,
} from '@/lib/client-converter';
import {
  trackFileUploadStarted,
  trackFileUploadCompleted,
  trackFileUploadFailed,
  trackFileConversionStarted,
  trackFileConversionCompleted,
  trackFileConversionFailed,
} from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';

export interface UploadFile {
  id: string;
  file: File;
  uploadProgress: number;
  convertProgress: number;
  isUploading: boolean | null;
  isProcessing: boolean | null;
  downloadLink: string | null;
  filename: string;
  size: number;
  errMessage: string | null;
  isRetryable: boolean;  // true = server error, false = validation error
  convertedContent?: string;
  uploadStartTime?: number;
  conversionStartTime?: number;
  inputEncoding?: string;
}

// Circular progress ring component
function ProgressRing({ progress, color = 'primary' }: {
  progress: number;
  color?: 'primary' | 'gray' | 'blue' | 'amber'
}) {
  const circumference = 2 * Math.PI * 16;
  const offset = circumference * (1 - progress);
  const percent = Math.round(progress * 100);

  const colorMap = {
    primary: { stroke: 'stroke-primary', text: 'text-primary' },
    gray: { stroke: 'stroke-gray-300', text: 'text-gray-300' },
    blue: { stroke: 'stroke-blue-400', text: 'text-blue-400' },
    amber: { stroke: 'stroke-amber-400', text: 'text-amber-400' },
  };

  const { stroke: strokeClass, text: textClass } = colorMap[color];

  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          className="stroke-gray-100"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          className={strokeClass}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.35s ease' }}
        />
      </svg>
      <span className={`absolute text-[10px] font-bold ${textClass}`}>{percent}%</span>
    </div>
  );
}

// File row component with all states
function FileRow({
  store,
  onDownload,
  onRetry,
}: {
  store: UploadFile;
  onDownload: () => void;
  onRetry: () => void;
}) {
  // Determine state
  const isUploading = store.isUploading === true;
  const isConverting = store.isProcessing === true;
  const isWaiting = store.isUploading === false && store.isProcessing === false && !store.downloadLink && !store.errMessage;
  const isFinished = store.downloadLink !== null;
  const isFailed = store.errMessage !== null;

  // Calculate progress
  const progress = isUploading
    ? store.uploadProgress / 100
    : isConverting
    ? store.convertProgress
    : isFinished
    ? 1
    : 0;

  // Status text and dot color
  let statusText = '';
  let dotColor = '';
  let dotAnimate = false;

  if (isUploading) {
    statusText = 'Uploading...';
    dotColor = 'bg-blue-400';
    dotAnimate = true;
  } else if (isConverting) {
    statusText = 'Converting...';
    dotColor = 'bg-amber-400';
    dotAnimate = true;
  } else if (isWaiting) {
    statusText = 'Waiting...';
    dotColor = 'bg-gray-300';
  } else if (isFinished) {
    statusText = 'Finished';
  } else if (isFailed) {
    statusText = 'Failed';
  }

  // Border style
  let borderClass = 'border-gray-100';
  if (isFinished) borderClass = 'border-primary/30';
  if (isFailed) borderClass = 'border-red-100';

  return (
    <div
      className={`w-full bg-white rounded-lg border ${borderClass} p-4 flex items-center justify-between gap-4 shadow-sm h-20 transition-all`}
    >
      {/* Left: File info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`font-bold text-sm truncate mb-1 ${isFailed ? 'text-gray-400' : 'text-gray-800'}`}>
          {store.filename}
        </div>
        {isFinished ? (
          <div className="text-xs font-medium text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            {statusText}
          </div>
        ) : isFailed ? (
          <div className="text-xs text-red-500 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {statusText}
          </div>
        ) : (
          <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${dotAnimate ? 'animate-pulse' : ''}`} />
            {statusText}
          </div>
        )}
      </div>

      {/* Right: Action or Progress */}
      <div className="flex items-center gap-4">
        {isFinished ? (
          <button
            onClick={onDownload}
            className="w-10 h-10 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all flex items-center justify-center shadow-md shadow-primary/20 shrink-0"
          >
            <span className="material-symbols-outlined">download</span>
          </button>
        ) : isFailed ? (
          store.isRetryable ? (
            <button
              onClick={onRetry}
              className="w-10 h-10 bg-white border border-red-200 hover:bg-red-50 text-red-500 rounded-full transition-all flex items-center justify-center shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          ) : (
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">warning</span>
            </div>
          )
        ) : (
          <ProgressRing
            progress={progress}
            color={isUploading ? 'blue' : isConverting ? 'amber' : isWaiting ? 'gray' : 'primary'}
          />
        )}
      </div>
    </div>
  );
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<Array<{ content: string; fileName: string }>>([]);
  const isProcessingQueue = useRef(false);
  const lastUploadMethod = useRef<'drag_drop' | 'click_select'>('click_select');
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Get user ID on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  // Process download queue one at a time
  useEffect(() => {
    if (downloadQueue.length > 0 && !isProcessingQueue.current) {
      isProcessingQueue.current = true;
      const { content, fileName } = downloadQueue[0];

      // Download the file
      const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      // Remove from queue and wait before processing next
      setTimeout(() => {
        setDownloadQueue((prev) => prev.slice(1));
        isProcessingQueue.current = false;
      }, 500); // 500ms delay between downloads
    }
  }, [downloadQueue]);

  const convertFile = useCallback(async (uploadFile: UploadFile) => {
    const { id, file } = uploadFile;

    // Track conversion started
    trackFileConversionStarted(file);
    const conversionStartTime = Date.now();

    // Set initial state
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              isUploading: false,
              isProcessing: true,
              uploadProgress: 0,
              convertProgress: 0,
              errMessage: null,
              conversionStartTime,
              isRetryable: false,
            }
          : f
      )
    );

    let convertedContent: string;
    let convertedFileName: string;
    let inputEncoding: string;

    try {
      // Run client-side conversion with progress
      const result = await clientConvertFile(file, userId, (progress: ConversionProgress) => {
        const displayPercent = progress.percent;

        // Map stages to progress ranges for UI
        // loading-libs: 0-10%, loading-dict: 10-15%, converting: 15-95%, archiving: 95-100%
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  convertProgress: displayPercent,
                }
              : f
          )
        );
      });

      convertedContent = result.content;
      convertedFileName = result.fileName;
      inputEncoding = result.encoding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Conversion failed';
      trackFileConversionFailed(file, 'processing_error', errorMessage);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isUploading: false,
                isProcessing: false,
                errMessage: errorMessage,
                isRetryable: true,
              }
            : f
        )
      );
      return;
    }

    // Archive original file to Vercel Blob
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, convertProgress: 0.95 } : f
      )
    );

    try {
      // Track upload for archival
      trackFileUploadStarted(file, lastUploadMethod.current);
      const uploadStartTime = Date.now();

      await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      const uploadDuration = Date.now() - uploadStartTime;
      trackFileUploadCompleted(file, uploadDuration);
    } catch (error) {
      // Archive failure is non-fatal, just log it
      console.error('Failed to archive file:', error);
    }

    // Track successful conversion
    const conversionDuration = Date.now() - conversionStartTime;
    trackFileConversionCompleted(file, conversionDuration, inputEncoding);

    // Update state with converted file
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              isProcessing: false,
              convertProgress: 1.0,
              downloadLink: 'blob://converted',
              filename: convertedFileName,
              convertedContent: convertedContent,
              inputEncoding,
            }
          : f
      )
    );

    // Add to download queue
    setDownloadQueue((prev) => [...prev, { content: convertedContent, fileName: convertedFileName }]);
  }, [userId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => {
      // Validate file using shared validator
      const validation = validateFile(file);

      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        uploadProgress: 0,
        convertProgress: 0,
        isUploading: validation.valid ? null : false,
        isProcessing: false,
        downloadLink: null,
        filename: file.name,
        size: file.size,
        errMessage: validation.valid ? null : validation.error || 'Invalid file',
        isRetryable: false,  // Validation errors are never retryable
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);

    // Auto-convert only valid files (client-side, no upload needed)
    newFiles.forEach((uploadFile, index) => {
      if (!uploadFile.errMessage) {
        setTimeout(() => {
          convertFile(uploadFile);
        }, index * 100); // Stagger by 100ms
      }
    });
  }, [convertFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    onDragEnter: () => {
      lastUploadMethod.current = 'drag_drop';
    },
  });

  // Retry handler
  const retryFile = useCallback((fileId: string) => {
    const failedFile = files.find((f) => f.id === fileId);
    if (!failedFile || !failedFile.isRetryable) return;  // Safety check

    // Reset state and retry
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              errMessage: null,
              uploadProgress: 0,
              convertProgress: 0,
              isUploading: null,
              isProcessing: false,
              isRetryable: false,  // Reset for new attempt
            }
          : f
      )
    );

    // Re-run conversion
    convertFile(failedFile);
  }, [files, convertFile]);

  // Download handler
  const downloadFile = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file?.convertedContent && file?.filename) {
      const blob = new Blob([file.convertedContent], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [files]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Dropzone */}
      <section className="w-full">
        <div className="relative group">
          <div
            {...getRootProps()}
            className={`border-4 border-dashed rounded-xl bg-transparent py-16 px-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
              isDragActive
                ? 'border-green-500 bg-green-50/50 scale-[1.02] shadow-lg'
                : 'border-primary hover:bg-primary/5'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-2xl font-medium text-primary text-center pointer-events-none">
              上傳檔案，支援 txt, csv, srt, ...
            </p>
          </div>
        </div>
      </section>

      {/* File list */}
      {files.length > 0 && (
        <section className="flex flex-col gap-3">
          {files.map((fileHandler) => (
            <FileRow
              key={fileHandler.id}
              store={fileHandler}
              onDownload={() => downloadFile(fileHandler.id)}
              onRetry={() => retryFile(fileHandler.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
