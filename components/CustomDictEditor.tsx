'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import { createClient } from '@/lib/supabase/client';
import {
  validateDictionary,
  parseDictionary,
  getDictPairLimit,
  type DictValidationError,
} from '@/lib/custom-dict';
import { isPaidUser } from '@/lib/auth';
import { updateDictCache } from '@/lib/client-converter';

interface CustomDictEditorProps {
  user: User | null;
  profile: Profile | null;
}

type SaveStatus = 'idle' | 'saving' | 'auto-saving' | 'saved' | 'error';

export default function CustomDictEditor({ user, profile }: CustomDictEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [errors, setErrors] = useState<DictValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSent, setLoginSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPaid = isPaidUser(profile);
  const licenseType = profile?.license_type ?? 'free';
  const limit = getDictPairLimit(licenseType);
  const pairCount = useMemo(() => parseDictionary(content).length, [content]);
  const hasUnsavedChanges = content !== savedContent;
  const isOverLimit = pairCount > limit;
  const isAtLimit = pairCount === limit;
  const hasErrors = errors.length > 0;
  const canSave = hasUnsavedChanges && !hasErrors && !isOverLimit && saveStatus !== 'saving' && saveStatus !== 'auto-saving';

  // Load dictionary on mount when user exists
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoading(true);

    fetch('/api/dictionary')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const loaded = data.content ?? '';
        setContent(loaded);
        setSavedContent(loaded);
        // Update client-side cache
        updateDictCache(parseDictionary(loaded));
        setErrors(validateDictionary(loaded));
      })
      .catch(() => {
        // silently fail — user can still type manually
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (savedStatusTimerRef.current) {
        clearTimeout(savedStatusTimerRef.current);
      }
    };
  }, []);

  // Save function
  const performSave = useCallback(async (contentToSave: string, isAuto = false) => {
    setSaveStatus(isAuto ? 'auto-saving' : 'saving');
    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave }),
      });

      if (!res.ok) {
        setSaveStatus('error');
        // Reset error status after 3 seconds
        savedStatusTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
        return;
      }

      setSavedContent(contentToSave);
      // Update client-side cache for conversion
      updateDictCache(parseDictionary(contentToSave));
      setSaveStatus('saved');
      // Reset saved status after 2 seconds
      savedStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('error');
      savedStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }, []);

  // Handle content change with auto-save
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    const validationErrors = validateDictionary(newContent);
    setErrors(validationErrors);

    // Clear existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Only auto-save if content is valid and within limit
    const newPairCount = parseDictionary(newContent).length;
    const newLimit = getDictPairLimit(licenseType);
    const isValid = validationErrors.length === 0 && newPairCount <= newLimit;

    if (isValid && newContent !== savedContent) {
      // Debounce auto-save by 1 second
      autoSaveTimerRef.current = setTimeout(() => {
        performSave(newContent, true);
      }, 1000);
    }
  }, [licenseType, savedContent, performSave]);

  // Manual save handler
  const handleSave = useCallback(() => {
    if (!canSave) return;
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    performSave(content);
  }, [canSave, content, performSave]);

  // CSV upload handler
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          handleContentChange(text);
        }
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    },
    [handleContentChange]
  );

  // CSV download handler
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-dictionary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  // Login handler
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;

    setIsLoggingIn(true);
    const supabase = createClient();
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: `${redirectUrl}/auth/callback`,
      },
    });

    setIsLoggingIn(false);

    if (!error) {
      setLoginSent(true);
    }
  }, [loginEmail]);

  // Determine badge text and style
  const getBadge = () => {
    if (!user) {
      return { text: 'GUEST', className: 'bg-gray-100 text-gray-500' };
    }
    if (isPaid) {
      return { text: 'PRO', className: 'bg-primary/10 text-primary' };
    }
    return { text: 'FREE', className: 'bg-gray-100 text-gray-500' };
  };

  // Get save button text and style
  const getSaveButtonState = () => {
    if (saveStatus === 'auto-saving') {
      return { text: '自動儲存中', disabled: true, className: 'bg-gray-100 text-gray-400 cursor-not-allowed' };
    }
    if (saveStatus === 'saving') {
      return { text: '儲存中...', disabled: true, className: 'bg-gray-100 text-gray-400 cursor-not-allowed' };
    }
    if (saveStatus === 'saved') {
      return { text: '已儲存 ✓', disabled: true, className: 'bg-green-50 text-green-600 border border-green-200' };
    }
    if (saveStatus === 'error') {
      return { text: '儲存失敗', disabled: false, className: 'bg-red-50 text-red-600 border border-red-200' };
    }
    if (!canSave) {
      return { text: '儲存', disabled: true, className: 'bg-gray-100 text-gray-400 cursor-not-allowed' };
    }
    return { text: '儲存', disabled: false, className: 'bg-primary hover:bg-primary-hover text-white' };
  };

  const badge = getBadge();
  const saveButton = getSaveButtonState();

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-gray-600">book_2</span>
          <h2 className="text-base font-semibold text-gray-800">自訂字典對照</h2>
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${badge.className}`}>
            {badge.text}
          </span>
        </div>
        <span className="material-symbols-outlined text-gray-400">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Info text */}
          <p className="text-sm text-gray-500">
            自訂簡繁對照詞彙，可覆蓋預設轉換結果。每行一組，格式：簡體詞,繁體詞
          </p>

          {/* ─── Guest state (not logged in) ─────────────────────────────── */}
          {!user && (
            <>
              {/* Blurred textarea placeholder */}
              <div className="relative">
                <div className="w-full h-40 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono text-gray-300 blur-[2px] select-none">
                  代码,程式碼{'\n'}内存,記憶體{'\n'}信息,訊息{'\n'}软件,軟體{'\n'}硬件,硬體
                </div>
                {/* Login overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">login</span>
                    Login
                  </button>
                  <p className="text-sm text-gray-500">登入後即可開始建立自訂字典</p>
                </div>
              </div>

              {/* Counter row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">0 / 5 組對照（免費版）</span>
                <span className="text-gray-400">格式：簡體詞,繁體詞</span>
              </div>

              {/* Disabled action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  儲存
                </button>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-300 cursor-not-allowed"
                >
                  匯入
                </button>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-300 cursor-not-allowed"
                >
                  匯出
                </button>
              </div>

              {/* Login Modal */}
              {showLoginModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowLoginModal(false); setLoginSent(false); setLoginEmail(''); }} />
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6">
                    <button
                      onClick={() => { setShowLoginModal(false); setLoginSent(false); setLoginEmail(''); }}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>

                    {!loginSent ? (
                      <>
                        <h2 className="text-xl font-semibold text-gray-800 mb-1">登入 / 註冊</h2>
                        <p className="text-sm text-gray-500 mb-5">輸入電子信箱，我們將寄送登入連結給您</p>
                        <form onSubmit={handleLogin}>
                          <input
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-3"
                            type="email"
                            placeholder="your@email.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            required
                          />
                          <button
                            className={`w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''}`}
                            type="submit"
                            disabled={isLoggingIn}
                          >
                            {isLoggingIn ? '傳送中...' : '寄送登入連結'}
                          </button>
                        </form>
                        <p className="text-xs text-gray-400 text-center mt-4">無須密碼，安全便捷</p>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">請檢查您的信箱</h2>
                        <p className="text-sm text-gray-500">
                          我們已將登入連結寄送至<br />
                          <span className="font-medium text-gray-700">{loginEmail}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Logged in state ─────────────────────────────────────────── */}
          {user && (
            <>
              {isLoading ? (
                <div className="w-full h-40 flex items-center justify-center text-sm text-gray-400">
                  載入中...
                </div>
              ) : (
                <>
                  {/* Textarea */}
                  <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder={`代码,程式碼\n内存,記憶體\n信息,訊息`}
                    className="w-full h-40 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-y"
                  />

                  {/* Over limit warning for free users - message left, CTA right */}
                  {!isPaid && (isOverLimit || isAtLimit) && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <span className="material-symbols-outlined text-amber-500 text-lg">warning</span>
                        <span>免費版僅支援 {limit} 組對照，升級以解鎖 10,000 組</span>
                      </div>
                      <a
                        href={process.env.NEXT_PUBLIC_GUMROAD_URL || '#pricing'}
                        className="shrink-0 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        升級 Pro
                      </a>
                    </div>
                  )}

                  {/* Validation errors */}
                  {hasErrors && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                      <ul className="space-y-1">
                        {errors.slice(0, 3).map((err) => (
                          <li key={err.line}>{err.message}</li>
                        ))}
                      </ul>
                      {errors.length > 3 && (
                        <p className="mt-1 text-red-500 text-xs">
                          ...還有 {errors.length - 3} 個錯誤
                        </p>
                      )}
                    </div>
                  )}

                  {/* Counter row */}
                  <div className="flex items-center justify-between text-xs">
                    <span className={isOverLimit || isAtLimit ? 'text-red-500 font-medium' : 'text-gray-400'}>
                      {pairCount} / {limit.toLocaleString()} 組對照
                      {(isOverLimit || isAtLimit) && !isPaid && '（已達上限）'}
                    </span>
                    <span className="text-gray-400">格式：簡體詞,繁體詞</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saveButton.disabled}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${saveButton.className}`}
                    >
                      {saveButton.text}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      匯入 CSV
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      匯出 CSV
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
