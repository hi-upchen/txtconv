'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { upload } from '@vercel/blob/client';
import { validateFile } from '@/lib/file-validator';
import {
  trackFileUploadStarted,
  trackFileUploadCompleted,
  trackFileUploadFailed,
  trackFileConversionStarted,
  trackFileConversionCompleted,
  trackFileConversionFailed,
} from '@/lib/analytics';

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
  convertedContent?: string;
  uploadStartTime?: number;
  conversionStartTime?: number;
  inputEncoding?: string;
}

// Circular progress ring component
function ProgressRing({ progress, color = 'primary' }: { progress: number; color?: 'primary' | 'gray' }) {
  const circumference = 2 * Math.PI * 16; // radius = 16
  const offset = circumference * (1 - progress);
  const percent = Math.round(progress * 100);

  const strokeClass = color === 'primary' ? 'stroke-primary' : 'stroke-gray-300';
  const textClass = color === 'primary' ? 'text-primary' : 'text-gray-300';

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
          <button
            onClick={onRetry}
            className="w-10 h-10 bg-white border border-red-200 hover:bg-red-50 text-red-500 rounded-full transition-all flex items-center justify-center shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        ) : (
          <ProgressRing progress={progress} color={isWaiting ? 'gray' : 'primary'} />
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

    // STEP 1: Upload to Vercel Blob with progress
    const uploadStartTime = Date.now();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, isUploading: true, uploadProgress: 0, isProcessing: false, errMessage: null, uploadStartTime } : f
      )
    );

    let blobUrl: string;
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: ({ percentage }) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, uploadProgress: percentage } : f))
          );
        },
      });
      blobUrl = blob.url;

      // Track successful upload
      const uploadDuration = Date.now() - uploadStartTime;
      trackFileUploadCompleted(file, uploadDuration);
    } catch (error) {
      // Track failed upload
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      trackFileUploadFailed(file, 'network_error', errorMessage);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isUploading: false,
                isProcessing: false,
                errMessage: errorMessage,
              }
            : f
        )
      );
      return;
    }

    // STEP 2a: Show "處理中" status
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isUploading: false, isProcessing: false } : f))
    );

    // STEP 2b: Prepare conversion request
    const formData = new FormData();
    formData.append('blobUrl', blobUrl);
    formData.append('fileName', file.name);
    formData.append('fileId', id);

    // STEP 2c: Start conversion (triggers "轉換中")
    const conversionStartTime = Date.now();

    // Track conversion started
    trackFileConversionStarted(file);

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isProcessing: true, conversionStartTime } : f))
    );

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Conversion request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = ''; // Buffer for incomplete SSE messages

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Append chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split by SSE message delimiter (\n\n)
        const messages = buffer.split('\n\n');

        // Keep last incomplete message in buffer
        buffer = messages.pop() || '';

        // Process complete messages
        for (const message of messages) {
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  setFiles((prev) =>
                    prev.map((f) => (f.id === id ? { ...f, convertProgress: data.percent } : f))
                  );
                } else if (data.type === 'complete') {
                  // Track successful conversion
                  const conversionDuration = Date.now() - conversionStartTime;
                  const inputEncoding = data.inputEncoding || 'unknown';
                  trackFileConversionCompleted(file, conversionDuration, inputEncoding);

                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === id
                        ? {
                            ...f,
                            isProcessing: false,
                            convertProgress: 1.0,
                            downloadLink: 'blob://converted',
                            filename: data.fileName,
                            convertedContent: data.content,
                            inputEncoding,
                          }
                        : f
                    )
                  );

                  // Add to download queue instead of downloading immediately
                  if (data.content && data.fileName) {
                    setDownloadQueue((prev) => [...prev, { content: data.content, fileName: data.fileName }]);
                  }
                } else if (data.type === 'error') {
                  // Track failed conversion
                  setFiles((prev) => {
                    const currentFile = prev.find((f) => f.id === id);
                    trackFileConversionFailed(
                      file,
                      'processing_error',
                      data.message,
                      currentFile?.inputEncoding
                    );
                    return prev.map((f) =>
                      f.id === id
                        ? {
                            ...f,
                            isUploading: false,
                            isProcessing: false,
                            errMessage: data.message,
                          }
                        : f
                    );
                  });
                }
              } catch (parseError) {
                console.error('Failed to parse SSE message:', parseError, 'Line:', line);
              }
            }
          }
        }
      }
    } catch (error) {
      // Track failed conversion (network or stream error)
      const errorMessage = error instanceof Error ? error.message : 'Conversion failed';
      setFiles((prev) => {
        const currentFile = prev.find((f) => f.id === id);
        trackFileConversionFailed(file, 'processing_error', errorMessage, currentFile?.inputEncoding);
        return prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isUploading: false,
                isProcessing: false,
                errMessage: errorMessage,
              }
            : f
        );
      });
    }
  }, []);

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
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);

    // Auto-convert only valid files
    newFiles.forEach((uploadFile, index) => {
      if (!uploadFile.errMessage) {
        // Track upload started for valid files
        trackFileUploadStarted(uploadFile.file, lastUploadMethod.current);

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
    if (!failedFile) return;

    // Reset state and retry
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, errMessage: null, uploadProgress: 0, convertProgress: 0, isUploading: null, isProcessing: false }
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
