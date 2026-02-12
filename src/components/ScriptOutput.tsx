'use client';

import { useState } from 'react';
import type { ScriptOutput as ScriptOutputType, PatternSelection, FactCheckResult } from '@/lib/types';

const hookLabels: Record<string, string> = {
  problem_empathy: '문제공감형',
  rhetorical: '반문형',
  fomo_urgency: 'FOMO/긴급성형',
  price_shock: '가격충격형',
  question: '질문형',
  command: '명령형',
  comparison: '비교프레임형',
  value_declare: '가성비선언형',
};

const bodyLabels: Record<string, string> = {
  experience: '체험중심',
  spec_experience: '스펙+체험 혼합',
  comparison: '비교분석',
  problem_solution: '문제-솔루션',
};

const ctaLabels: Record<string, string> = {
  urgency: '긴급성 CTA',
  price_anchor: '가격앵커 CTA',
  soft: '부드러운 CTA',
};

const severityConfig = {
  HIGH: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', label: 'HIGH' },
  MEDIUM: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'MED' },
  LOW: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', label: 'LOW' },
};

interface ScriptOutputProps {
  output: ScriptOutputType | null;
  streamingText: string;
  selectedPattern: PatternSelection | null;
  priceData: string | null;
  isGenerating: boolean;
  isFactChecking: boolean;
  factCheckResult: FactCheckResult | null;
  onRevision: (feedback: string) => void;
}

function FactCheckBadge({ result }: { result: FactCheckResult }) {
  if (result.passed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-green-400 text-sm font-medium">팩트체크 통과</span>
        {result.searchesPerformed > 0 && (
          <span className="text-green-400/60 text-xs">({result.searchesPerformed}회 웹검색)</span>
        )}
      </div>
    );
  }

  const highCount = result.issues.filter(i => i.severity === 'HIGH').length;
  const medCount = result.issues.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = result.issues.filter(i => i.severity === 'LOW').length;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span className="text-red-400 text-sm font-medium">
        팩트체크 이슈 {result.issues.length}건
      </span>
      <div className="flex gap-1 text-xs">
        {highCount > 0 && <span className="text-red-400">H:{highCount}</span>}
        {medCount > 0 && <span className="text-yellow-400">M:{medCount}</span>}
        {lowCount > 0 && <span className="text-blue-400">L:{lowCount}</span>}
      </div>
      {result.searchesPerformed > 0 && (
        <span className="text-red-400/60 text-xs">({result.searchesPerformed}회 웹검색)</span>
      )}
    </div>
  );
}

function FactCheckDetails({ result }: { result: FactCheckResult }) {
  const [expanded, setExpanded] = useState(true);

  if (result.passed || result.issues.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        팩트체크 상세
      </button>

      {expanded && (
        <div className="space-y-2">
          {result.issues.map((issue, i) => {
            const config = severityConfig[issue.severity];
            return (
              <div
                key={i}
                className={`${config.bg} border ${config.border} rounded-lg p-3 space-y-1.5`}
              >
                <div className="flex items-start gap-2">
                  <span className={`${config.text} text-xs font-bold px-1.5 py-0.5 rounded ${config.bg} flex-shrink-0 mt-0.5`}>
                    {config.label}
                  </span>
                  <span className="text-gray-300 text-sm">&ldquo;{issue.claim}&rdquo;</span>
                </div>
                <p className="text-gray-400 text-xs pl-10">{issue.issue}</p>
                <p className="text-gray-200 text-xs pl-10">
                  <span className="text-gray-500">수정 &rarr; </span>
                  {issue.correction}
                </p>
                {issue.source && (
                  <p className="text-gray-500 text-xs pl-10 truncate">
                    출처: {issue.source}
                  </p>
                )}
              </div>
            );
          })}

          {result.correctedScript && (
            <div className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              HIGH 이슈가 감지되어 대본이 자동 수정되었습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScriptOutput({
  output,
  streamingText,
  selectedPattern,
  priceData,
  isGenerating,
  isFactChecking,
  factCheckResult,
  onRevision,
}: ScriptOutputProps) {
  const [copied, setCopied] = useState(false);
  const [revisionText, setRevisionText] = useState('');

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevisionSubmit = () => {
    if (!revisionText.trim()) return;
    onRevision(revisionText.trim());
    setRevisionText('');
  };

  // Generating state - show streaming text
  if (isGenerating) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          {isFactChecking ? '팩트체크 중' : '대본 생성 중'}
          <span className="flex gap-1">
            <span className={`w-2 h-2 ${isFactChecking ? 'bg-amber-400' : 'bg-blue-400'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
            <span className={`w-2 h-2 ${isFactChecking ? 'bg-amber-400' : 'bg-blue-400'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
            <span className={`w-2 h-2 ${isFactChecking ? 'bg-amber-400' : 'bg-blue-400'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
          </span>
        </h2>

        {/* Pattern badge */}
        {selectedPattern && (
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
              {hookLabels[selectedPattern.hook] || selectedPattern.hook}
            </span>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
              {bodyLabels[selectedPattern.body] || selectedPattern.body}
            </span>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
              {ctaLabels[selectedPattern.cta] || selectedPattern.cta}
            </span>
          </div>
        )}

        {/* Price data extracted */}
        {priceData && (
          <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
            가격 데이터 추출 완료
          </div>
        )}

        {/* Fact-checking indicator */}
        {isFactChecking && streamingText && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-amber-400 text-sm">Sonnet 4.5가 웹검색으로 대본을 검증하고 있습니다...</span>
          </div>
        )}

        {/* Streaming text */}
        {streamingText && (
          <div className="bg-gray-800 rounded-lg p-4 text-gray-200 whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto">
            {streamingText}
            {!isFactChecking && <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />}
          </div>
        )}

        {!streamingText && !selectedPattern && (
          <div className="text-center py-8 text-gray-500">
            <div className="inline-block w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">AI가 패턴을 선택하고 대본을 작성 중입니다...</p>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (!output) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">
          대본 출력
        </h2>
        <div className="text-center py-16 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>제품 정보와 리뷰를 입력하면</p>
          <p>여기에 대본이 생성됩니다</p>
        </div>
      </div>
    );
  }

  // Output state - show final result
  const fcResult = output.factCheckResult || factCheckResult;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          대본 완성
        </h2>
        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
          {output.duration}초
        </span>
      </div>

      {/* Fact-check badge */}
      {fcResult && <FactCheckBadge result={fcResult} />}

      {/* Fact-check details */}
      {fcResult && <FactCheckDetails result={fcResult} />}

      {/* Pattern info */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-400 self-center mr-1">사용 패턴:</span>
        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
          {hookLabels[output.pattern.hook] || output.pattern.hook}
        </span>
        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
          {bodyLabels[output.pattern.body] || output.pattern.body}
        </span>
        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
          {ctaLabels[output.pattern.cta] || output.pattern.cta}
        </span>
      </div>

      {/* Titles */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">제목 후보</h3>
        <div className="space-y-1">
          {output.titles.map((title, i) => (
            <button
              key={i}
              onClick={() => handleCopy(title)}
              className="w-full text-left text-white bg-gray-800 hover:bg-gray-750 px-3 py-2 rounded-lg text-sm transition-colors group"
            >
              <span className="text-gray-500 mr-2">{i + 1}.</span>
              {title}
              <span className="text-gray-600 text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                클릭하여 복사
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Target audience */}
      <div className="bg-gray-800 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">타겟: </span>
        <span className="text-sm text-white">{output.targetAudience}</span>
      </div>

      {/* Script */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">대본</h3>
        <div className="bg-gray-800 rounded-lg p-4 text-gray-200 whitespace-pre-wrap text-sm leading-relaxed max-h-[500px] overflow-y-auto">
          {output.script}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleCopy(output.script)}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          {copied ? '복사됨' : '전체 복사'}
        </button>
      </div>

      {/* Revision */}
      <div className="space-y-2 pt-2 border-t border-gray-800">
        <h3 className="text-sm font-medium text-gray-400">수정 요청</h3>
        <textarea
          value={revisionText}
          onChange={(e) => setRevisionText(e.target.value)}
          placeholder="수정하고 싶은 부분을 알려주세요..."
          className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
          rows={2}
        />
        <button
          onClick={handleRevisionSubmit}
          disabled={!revisionText.trim()}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            revisionText.trim()
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          수정 요청
        </button>
      </div>
    </div>
  );
}
