'use client';

import { FileUpload } from '@/components/FileUpload';
import { ScriptOutput } from '@/components/ScriptOutput';
import { useScriptStore } from '@/lib/store';
import type { ScriptInput, StreamEvent, CrawlState, CrawlResponse } from '@/lib/types';
import { useState, useRef } from 'react';

export default function Home() {
  const store = useScriptStore();
  const [crawlState, setCrawlState] = useState<CrawlState>({ step: 'idle', message: '', progress: 0 });
  const [crawledData, setCrawledData] = useState<{ productInfo: string; reviews: string } | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processSSEStream = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          switch (event.type) {
            case 'price_extracted':
              if (event.priceData) store.setPriceData(event.priceData);
              break;
            case 'pattern_selected':
              if (event.pattern) store.setSelectedPattern(event.pattern);
              break;
            case 'chunk':
              if (event.content) store.appendStreamingText(event.content);
              break;
            case 'fact_check_start':
              store.setIsFactChecking(true);
              break;
            case 'fact_check_result':
              store.setIsFactChecking(false);
              if (event.factCheckResult) store.setFactCheckResult(event.factCheckResult);
              break;
            case 'complete':
              if (event.output) {
                store.setOutput(event.output);
                store.addToHistory(event.output.pattern);
              }
              break;
            case 'error':
              console.error('Error:', event.error);
              alert(`대본 생성 오류: ${event.error}`);
              break;
          }
        } catch { /* ignore parse errors */ }
      }
    }
  };

  const handleCrawl = async (url: string) => {
    // 1. validating
    setCrawlState({ step: 'validating', message: 'URL 검증 중...', progress: 10 });
    setCrawledData(null);

    // 2. start crawling with progress animation
    setCrawlState({ step: 'crawling', message: '쿠팡에서 데이터 수집 중... (최대 3분)', progress: 15 });

    // 시간 기반 프로그레스 (15% → 80%, 180초에 걸쳐)
    let currentProgress = 15;
    progressIntervalRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + 0.5, 80);
      setCrawlState(prev => ({ ...prev, progress: currentProgress }));
    }, 1500);

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      // 프로그레스 타이머 정리
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error || error.detail || '크롤링 실패';
        setCrawlState({ step: 'error', message: errorMsg, progress: 0 });
        return;
      }

      const data: CrawlResponse = await response.json();

      if (!data.success || (!data.productInfo && !data.reviews)) {
        setCrawlState({ step: 'error', message: '데이터를 수집하지 못했습니다.', progress: 0 });
        return;
      }

      // 3. filling
      setCrawlState({ step: 'filling', message: '데이터 채우는 중...', progress: 90 });
      const crawled = { productInfo: data.productInfo, reviews: data.reviews };
      setCrawledData(crawled);

      // 4. done
      setCrawlState({ step: 'done', message: `수집 완료! (${data.productName})`, progress: 100 });

      // 3초 후 크롤 상태 리셋 (사용자가 데이터 확인 후 수동으로 대본 생성)
      setTimeout(() => {
        setCrawlState({ step: 'idle', message: '', progress: 0 });
      }, 3000);

    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      const msg = error instanceof Error ? error.message : '알 수 없는 오류';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setCrawlState({ step: 'error', message: '크롤러 서버에 연결할 수 없습니다. start-crawler.bat을 실행해주세요.', progress: 0 });
      } else {
        setCrawlState({ step: 'error', message: `크롤링 오류: ${msg}`, progress: 0 });
      }
    }
  };

  const handleGenerate = async (input: ScriptInput) => {
    store.setInput(input);
    store.reset();
    store.setIsGenerating(true);

    try {
      const response = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          patternHistory: store.patternHistory ? (() => {
            const hooks = store.patternHistory.recentHooks;
            const bodies = store.patternHistory.recentBodies;
            const ctas = store.patternHistory.recentCtas;
            const len = Math.min(hooks.length, bodies.length, ctas.length);
            return Array.from({ length: Math.min(len, 5) }, (_, i) => ({
              hook: hooks[hooks.length - Math.min(len, 5) + i],
              body: bodies[bodies.length - Math.min(len, 5) + i],
              cta: ctas[ctas.length - Math.min(len, 5) + i],
            }));
          })() : [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '알 수 없는 오류');
      }

      await processSSEStream(response);
    } catch (error) {
      console.error('Generation error:', error);
      alert('대본 생성 중 오류가 발생했습니다.');
    } finally {
      store.setIsGenerating(false);
      store.clearStreamingText();
    }
  };

  const handleRevision = async (feedback: string) => {
    if (!store.input || !store.output) return;
    store.setIsGenerating(true);
    store.clearStreamingText();

    try {
      const response = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: store.input,
          isRevision: true,
          previousScript: store.output.script,
          feedback,
        }),
      });

      if (!response.ok) throw new Error('수정 요청 실패');
      await processSSEStream(response);
    } catch (error) {
      console.error('Revision error:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      store.setIsGenerating(false);
      store.clearStreamingText();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            쇼츠 대본 생성기
          </h1>
          <div className="text-sm text-gray-400">
            패턴 자동 로테이션 &middot; {store.patternHistory.totalGenerated}개 생성됨
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FileUpload
            onGenerate={handleGenerate}
            onCrawl={handleCrawl}
            crawlState={crawlState}
            crawledData={crawledData}
            isDisabled={store.isGenerating}
          />
          <ScriptOutput
            output={store.output}
            streamingText={store.streamingText}
            selectedPattern={store.selectedPattern}
            priceData={store.priceData}
            isGenerating={store.isGenerating}
            isFactChecking={store.isFactChecking}
            factCheckResult={store.factCheckResult}
            onRevision={handleRevision}
          />
        </div>
      </main>

      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-gray-600 text-sm">
          패턴 기반 대본 생성 &middot; 25-30초 최적화
        </div>
      </footer>
    </div>
  );
}
