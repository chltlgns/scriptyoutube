'use client';

import { FileUpload } from '@/components/FileUpload';
import { ScriptOutput } from '@/components/ScriptOutput';
import { useScriptStore } from '@/lib/store';
import type { ScriptInput, StreamEvent } from '@/lib/types';

export default function Home() {
  const store = useScriptStore();

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
          patternHistory: store.patternHistory ? [
            ...store.patternHistory.recentHooks.slice(-3).map((h, i) => ({
              hook: h,
              body: store.patternHistory.recentBodies[store.patternHistory.recentBodies.length - 3 + i] || 'experience',
              cta: store.patternHistory.recentCtas[store.patternHistory.recentCtas.length - 3 + i] || 'urgency',
            }))
          ] : [],
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
            isDisabled={store.isGenerating}
          />
          <ScriptOutput
            output={store.output}
            streamingText={store.streamingText}
            selectedPattern={store.selectedPattern}
            priceData={store.priceData}
            isGenerating={store.isGenerating}
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
