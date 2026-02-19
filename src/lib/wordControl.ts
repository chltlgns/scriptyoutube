import type { WordCheckResult } from './types';

// ===== 반복 단어 검출 =====

function findRepeatedWords(text: string): Array<{ word: string; count: number }> {
  const words = text.match(/[가-힣]{2,}/g) || [];

  const stopWords = new Set([
    '이것', '저것', '그것', '여기', '거기', '저기',
    '그리고', '하지만', '그래서', '때문에', '이라고',
    '합니다', '입니다', '습니다', '됩니다', '있습니다',
    '에서', '으로', '에게', '부터', '까지',
    '이건', '저건', '그건', '이게', '저게', '그게',
    '한번', '이번', '다음', '정도', '이상', '이하',
    '진짜', '되는', '하는', '있는', '없는', '같은',
    '그냥', '근데', '아니', '사실', '솔직히',
  ]);

  const wordCounts = new Map<string, number>();
  for (const word of words) {
    if (stopWords.has(word) || word.length < 2) continue;
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  }

  const repeated: Array<{ word: string; count: number }> = [];
  for (const [word, count] of wordCounts) {
    if (count >= 3) {
      repeated.push({ word, count });
    }
  }

  return repeated.sort((a, b) => b.count - a.count);
}

// ===== 대본 검증 (동적 금지어/필수어) =====

export function validateScript(
  script: string,
  forbiddenWords: string[],
  requiredPhrases: string[] = ['가격 추적'],
): WordCheckResult {
  // 금지어 체크 — Phase 1 팀 분석에서 AI가 생성한 금지어 리스트 사용
  const forbiddenFound = forbiddenWords.filter(word =>
    script.includes(word)
  );

  // 필수 문구 체크
  const missingRequired = requiredPhrases.filter(phrase =>
    !script.includes(phrase)
  );

  const repeatedWords = findRepeatedWords(script);

  return {
    passed: forbiddenFound.length === 0 && missingRequired.length === 0 && repeatedWords.length === 0,
    forbiddenWordsFound: forbiddenFound,
    missingRequiredPhrases: missingRequired,
    repeatedWords,
  };
}

// ===== 자동 수정 프롬프트 생성 =====

export function buildWordCorrectionPrompt(
  script: string,
  checkResult: WordCheckResult,
): string {
  const issues: string[] = [];

  if (checkResult.forbiddenWordsFound.length > 0) {
    issues.push(`금지어 발견: ${checkResult.forbiddenWordsFound.join(', ')} → 이 단어들을 제거하거나 적절한 대체어로 교체하세요.`);
  }

  if (checkResult.missingRequiredPhrases.length > 0) {
    issues.push(`필수 문구 누락: ${checkResult.missingRequiredPhrases.join(', ')} → 대본에 자연스럽게 포함시키세요.`);
  }

  if (checkResult.repeatedWords.length > 0) {
    const repeatList = checkResult.repeatedWords.map(r => `"${r.word}"(${r.count}회)`).join(', ');
    issues.push(`반복 단어: ${repeatList} → 동의어나 다른 표현으로 변경하세요.`);
  }

  return `아래 대본에서 다음 문제를 수정하세요. 대본의 구조와 톤은 유지하되 문제 부분만 수정하세요.

## 수정 필요 사항
${issues.join('\n')}

## 원본 대본
${script}

수정된 대본만 반환하세요. 기존 타임라인 형식([0-3초] 등)을 유지하세요. 제목 후보와 타겟도 함께 유지하세요.`;
}
