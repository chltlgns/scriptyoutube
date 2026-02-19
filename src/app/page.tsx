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
              store.setCurrentPhase('price');
              break;
            case 'team_analysis_start':
              store.setCurrentPhase('team_analysis');
              break;
            case 'team_analysis_chunk':
              if (event.content) store.appendTeamAnalysisText(event.content);
              break;
            case 'team_analysis_complete':
              if (event.directorDecision) store.setDirectorDecision(event.directorDecision);
              if (event.directorDecision?.productType) store.setDetectedProductType(event.directorDecision.productType);
              break;
            case 'pattern_selected':
              if (event.pattern) store.setSelectedPattern(event.pattern);
              store.setCurrentPhase('script_generation');
              break;
            case 'chunk':
              if (event.content) store.appendStreamingText(event.content);
              break;
            case 'word_check_result':
              if (event.wordCheckResult) store.setWordCheckResult(event.wordCheckResult);
              store.setCurrentPhase('word_check');
              break;
            case 'fact_check_start':
              store.setIsFactChecking(true);
              store.setCurrentPhase('fact_check');
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
              store.setCurrentPhase('idle');
              break;
            case 'error':
              console.error('Error:', event.error);
              alert(`대본 생성 오류: ${event.error}`);
              store.setCurrentPhase('idle');
              break;
          }
        } catch { /* ignore parse errors */ }
      }
    }
  };

  const handleCrawl = async (url: string) => {
    setCrawlState({ step: 'validating', message: 'URL 검증 중...', progress: 10 });
    setCrawledData(null);

    setCrawlState({ step: 'crawling', message: '쿠팡에서 데이터 수집 중... (최대 3분)', progress: 15 });

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

      setCrawlState({ step: 'filling', message: '데이터 채우는 중...', progress: 90 });
      const crawled = { productInfo: data.productInfo, reviews: data.reviews };
      setCrawledData(crawled);

      setCrawlState({ step: 'done', message: `수집 완료! (${data.productName})`, progress: 100 });

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
      store.clearTeamAnalysisText();
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
            쇼츠 대본 생성기 <span className="text-sm font-normal text-gray-500">v2</span>
          </h1>
          <div className="text-sm text-gray-400">
            4+1 팀 분석 &middot; {store.patternHistory.totalGenerated}개 생성됨
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
            teamAnalysisText={store.teamAnalysisText}
            selectedPattern={store.selectedPattern}
            priceData={store.priceData}
            isGenerating={store.isGenerating}
            isFactChecking={store.isFactChecking}
            factCheckResult={store.factCheckResult}
            wordCheckResult={store.wordCheckResult}
            currentPhase={store.currentPhase}
            onRevision={handleRevision}
          />
        </div>
      </main>

      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-gray-600 text-sm">
          4+1 팀 분석 기반 대본 생성 &middot; 3채널 128개 영상 데이터
        </div>
      </footer>
    </div>
  );
}
