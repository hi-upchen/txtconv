'use client';

import { useCallback, useRef, useState } from 'react';
import { readFileWithEncoding } from '@/lib/client-converter';
import { validateFile } from '@/lib/file-validator';
import {
  convertTraditionalToSimplified,
  generateSimplifiedFilename,
} from '@/lib/tw2cn-converter';
import type { LicenseType } from '@/types/user';

/**
 * Traditional to Simplified converter. The user pastes text or picks a .txt
 * file. Conversion runs in the browser, so nothing is uploaded.
 * Files use the same size limits as the Simplified to Traditional tool.
 */
export default function TraditionalToSimplified({
  licenseType = 'free',
}: {
  licenseType?: LicenseType;
}) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertPasted = useCallback(async (text: string) => {
    setInput(text);
    setCopied(false);
    setError('');
    setOutput(await convertTraditionalToSimplified(text));
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError('');
      setCopied(false);
      if (file.name.toLowerCase().endsWith('.epub')) {
        setError('這個頁面只轉換 .txt 純文字檔。EPUB 請回首頁上傳。');
        return;
      }
      const validation = validateFile(file, licenseType);
      if (!validation.valid) {
        setError(validation.error ?? '無法處理這個檔案');
        return;
      }
      setBusy(true);
      try {
        const { content } = await readFileWithEncoding(file);
        const converted = await convertTraditionalToSimplified(content);
        const fileName = await generateSimplifiedFilename(file.name);
        setInput(content);
        setOutput(converted);
        const url = URL.createObjectURL(
          new Blob([converted], { type: 'text/plain; charset=utf-8' })
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError('轉換失敗，請確認檔案是文字檔後再試一次。');
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [licenseType]
  );

  const copyOutput = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
  }, [output]);

  const downloadOutput = useCallback(() => {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain; charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simplified.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          繁體中文（貼上文字）
          <textarea
            data-testid="tw2cn-input"
            value={input}
            onChange={(e) => void convertPasted(e.target.value)}
            rows={10}
            placeholder="在這裡貼上繁體中文"
            className="w-full rounded-xl border border-gray-200 p-4 text-base font-normal text-gray-800"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          簡體中文（轉換結果）
          <textarea
            data-testid="tw2cn-output"
            value={output}
            readOnly
            rows={10}
            placeholder="轉換結果會顯示在這裡"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base font-normal text-gray-800"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copyOutput}
          disabled={!output}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {copied ? '已複製' : '複製結果'}
        </button>
        <button
          type="button"
          onClick={downloadOutput}
          disabled={!output}
          className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-40"
        >
          下載 .txt
        </button>
        <label className="cursor-pointer rounded-lg border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary">
          {busy ? '轉換中…' : '或選擇 .txt 檔案，轉完自動下載'}
          <input
            ref={fileInputRef}
            data-testid="tw2cn-file"
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
