'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

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
}

function humanFileSize(bytes: number, si: boolean = true): string {
  const thresh = si ? 1000 : 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }
  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + ' ' + units[u];
}

function FileRow({ store, onConvert }: { store: UploadFile; onConvert: () => void }) {
  const downloadConverted = () => {
    if (store.convertedContent && store.filename) {
      const blob = new Blob([store.convertedContent], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = store.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="file-row file-status animate__animated animate__fadeIn">
      <div className="is-flex">
        <div className="main-infos">
          <h3 className="is-size-5">
            {store.downloadLink ? (
              <a onClick={downloadConverted} style={{ cursor: 'pointer' }}>
                {store.filename}
              </a>
            ) : (
              store.filename
            )}
          </h3>
          <div>{humanFileSize(store.size, true)}</div>
          {store.errMessage && <div className="has-text-danger">{store.errMessage}</div>}
        </div>
        <div className="is-flex controls">
          {store.isUploading !== false && (
            <div className="control-msg-progress">
              <progress className="progress" value={store.uploadProgress} max="100"></progress>
              <div className="status-msg">上傳中</div>
            </div>
          )}
          {store.isUploading === false && store.isProcessing === false && store.downloadLink === null && (
            <div className="control-msg-progress">
              <span>
                <i className="fa fa-spinner fa-spin"></i>
              </span>
            </div>
          )}
          {store.isProcessing !== false && (
            <div className="control-msg-progress">
              <progress className="progress" value={store.convertProgress} max="1"></progress>
              <div className="status-msg">轉換中</div>
            </div>
          )}
          {store.downloadLink && (
            <a onClick={downloadConverted} style={{ cursor: 'pointer' }}>
              <i className="fa fa-download"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      uploadProgress: 0,
      convertProgress: 0,
      isUploading: null,
      isProcessing: null,
      downloadLink: null,
      filename: file.name,
      size: file.size,
      errMessage: null,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Auto-convert each file
    newFiles.forEach((uploadFile) => {
      convertFile(uploadFile);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/x-subrip': ['.srt'],
      'text/csv': ['.csv'],
    },
    multiple: true,
  });

  const convertFile = async (uploadFile: UploadFile) => {
    const { id, file } = uploadFile;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, isUploading: true, uploadProgress: 0, isProcessing: false } : f
      )
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

      // Mark upload complete, start processing
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isUploading: false, isProcessing: true } : f))
      );

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
                prev.map((f) => (f.id === id ? { ...f, convertProgress: data.percent } : f))
              );
            } else if (data.type === 'complete') {
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
                prev.map((f) =>
                  f.id === id
                    ? {
                        ...f,
                        isUploading: false,
                        isProcessing: false,
                        errMessage: data.message,
                      }
                    : f
                )
              );
            }
          }
        }
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isUploading: false,
                isProcessing: false,
                errMessage: error instanceof Error ? error.message : 'Conversion failed',
              }
            : f
        )
      );
    }
  };

  return (
    <>
      <div className="dropzone">
        <div
          {...getRootProps()}
          className={isDragActive ? 'dropzone-active' : 'dropzone-nornaml'}
        >
          <input {...getInputProps()} />
          <p>上傳檔案，支援 txt, csv, srt, ...</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="App">
          {files.map((fileHandler, i) => (
            <FileRow store={fileHandler} key={'FileRow' + i} onConvert={() => convertFile(fileHandler)} />
          ))}
        </div>
      )}

      {/* Survey message */}
      {files.length > 0 && (
        <div className="container animate__animated animate__fadeInUp animate__delay-2s" style={{ marginTop: '2rem' }}>
          <article className="message is-info survey-message">
            <div
              className="message-header"
              style={{
                padding: '0.5rem 2rem',
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
              }}
            >
              <p>
                <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>📋</span>
                幫助我做得更好
              </p>
            </div>
            <div
              className="message-body"
              style={{
                padding: '1rem 2rem',
                background: 'linear-gradient(to bottom, #fff5f5 0%, #ffffff 100%)',
              }}
            >
              <p style={{ marginBottom: '0.75rem', color: '#4a5568', lineHeight: '1.6' }}>
                <span style={{ fontWeight: '500' }}>感謝您使用繁簡轉換工具！</span>
                <br />
                為了提供更好的服務，我想了解您的使用需求。
                <span style={{ color: '#ee5a24', fontWeight: '500' }}> 只需 2 分鐘</span>，幫助我改善功能！
              </p>
              <div className="buttons" style={{ marginBottom: '0.25rem' }}>
                <a
                  href="https://www.surveycake.com/s/w8oKr"
                  className="button is-primary survey-button"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: '500',
                    padding: '0.75rem 1.5rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 6px rgba(238, 90, 36, 0.25)',
                  }}
                >
                  填寫問卷 →
                </a>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
