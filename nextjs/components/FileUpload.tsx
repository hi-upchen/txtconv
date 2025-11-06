'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'converting' | 'complete' | 'error';
  convertedContent?: string;
  fileName?: string;
  error?: string;
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const convertFile = async (uploadFile: UploadFile) => {
    const { id, file } = uploadFile;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'converting', progress: 0 } : f))
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileId', id);

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setFiles((prev) =>
                prev.map((f) => (f.id === id ? { ...f, progress: data.percent * 100 } : f))
              );
            } else if (data.type === 'complete') {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === id
                    ? {
                        ...f,
                        status: 'complete',
                        progress: 100,
                        convertedContent: data.content,
                        fileName: data.fileName,
                      }
                    : f
                )
              );

              // Auto-download the converted file
              if (data.content && data.fileName) {
                const blob = new Blob([data.content], { type: 'text/plain; charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.fileName;
                a.click();
                URL.revokeObjectURL(url);
              }
            } else if (data.type === 'error') {
              setFiles((prev) =>
                prev.map((f) => (f.id === id ? { ...f, status: 'error', error: data.message } : f))
              );
            }
          }
        }
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Conversion failed' }
            : f
        )
      );
    }
  };

  const convertAll = () => {
    files.filter((f) => f.status === 'pending').forEach((f) => convertFile(f));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="text-5xl">📄</div>
          <p className="text-lg font-medium">
            {isDragActive ? '放開以上傳檔案' : '拖曳 .txt 檔案到此處，或點擊選擇'}
          </p>
          <p className="text-sm text-gray-500">支援多個檔案，單檔最大 4MB</p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">檔案列表 ({files.length})</h3>
            {files.some((f) => f.status === 'pending') && (
              <button
                onClick={convertAll}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                轉換全部
              </button>
            )}
          </div>

          <div className="space-y-3">
            {files.map((file) => (
              <FileItem key={file.id} uploadFile={file} onConvert={() => convertFile(file)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileItem({
  uploadFile,
  onConvert,
}: {
  uploadFile: UploadFile;
  onConvert: () => void;
}) {
  const { file, progress, status, error, convertedContent, fileName } = uploadFile;

  const downloadConverted = () => {
    if (convertedContent && fileName) {
      const blob = new Blob([convertedContent], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
        </div>

        {status === 'pending' && (
          <button
            onClick={onConvert}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            轉換
          </button>
        )}

        {status === 'complete' && convertedContent && (
          <button
            onClick={downloadConverted}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            再次下載
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {status === 'converting' && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">{Math.round(progress)}%</p>
        </div>
      )}

      {/* Status Messages */}
      {status === 'complete' && <p className="text-sm text-green-600">✓ 轉換完成</p>}

      {status === 'error' && <p className="text-sm text-red-600">✗ {error || '轉換失敗'}</p>}
    </div>
  );
}
