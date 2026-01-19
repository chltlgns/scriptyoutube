'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ChatRoom } from '@/components/ChatRoom';
import { ScriptOutput } from '@/components/ScriptOutput';
import { useConversationStore } from '@/lib/store';
import { InputFiles, AgentMessage, FinalScript } from '@/lib/types';

export default function Home() {
  const {
    messages,
    currentRound,
    isGenerating,
    finalScript,
    addMessage,
    setIsGenerating,
    setFinalScript,
    incrementRound,
    reset,
  } = useConversationStore();

  const [inputFiles, setInputFiles] = useState<InputFiles | null>(null);
  const [isStarted, setIsStarted] = useState(false);

  const handleFilesReady = async (files: InputFiles) => {
    setInputFiles(files);
    setIsStarted(true);
    reset();
    setIsGenerating(true);

    try {
      // Round 1: 초기 분석
      await runRound(files, 1, []);

      // Round 2: 토론
      const round1Messages = useConversationStore.getState().messages;
      await runRound(files, 2, round1Messages);

      // Round 3: 최종 대본
      const round2Messages = useConversationStore.getState().messages;
      await runRound(files, 3, round2Messages);

    } catch (error) {
      console.error('생성 오류:', error);
      alert('대본 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const runRound = async (
    files: InputFiles,
    round: number,
    previousMessages: AgentMessage[]
  ) => {
    incrementRound();

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputFiles: files,
        round,
        previousMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '알 수 없는 오류');
    }

    const data = await response.json() as {
      messages: AgentMessage[];
      finalScript?: FinalScript;
    };

    // 메시지 순차 추가 (애니메이션 효과)
    for (const message of data.messages) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      addMessage({
        ...message,
        timestamp: new Date(message.timestamp),
      });
    }

    // 최종 대본 설정
    if (data.finalScript) {
      setFinalScript(data.finalScript);
    }
  };

  // 사용자 메시지 전송 핸들러
  const handleSendMessage = async (content: string) => {
    if (!inputFiles) return;

    // 사용자 메시지 추가
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      agentId: 'USER',
      content,
      timestamp: new Date(),
      messageType: finalScript ? 'revision_request' : 'user_input',
    };
    addMessage(userMessage);

    setIsGenerating(true);

    try {
      // 현재 메시지 목록 가져오기
      const currentMessages = useConversationStore.getState().messages;

      // 수정 라운드 실행
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputFiles,
          round: finalScript ? 4 : currentRound, // 수정 요청이면 라운드 4
          previousMessages: currentMessages,
          userFeedback: content,
          isRevision: !!finalScript,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '알 수 없는 오류');
      }

      const data = await response.json() as {
        messages: AgentMessage[];
        finalScript?: FinalScript;
      };

      // 메시지 순차 추가
      for (const message of data.messages) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        addMessage({
          ...message,
          timestamp: new Date(message.timestamp),
        });
      }

      // 최종 대본 업데이트
      if (data.finalScript) {
        setFinalScript(data.finalScript);
      }

    } catch (error) {
      console.error('메시지 처리 오류:', error);
      alert('메시지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* 헤더 */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            AI 쇼츠 대본 생성기
          </h1>
          <div className="text-sm text-gray-400">
            멀티에이전트 시스템
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 파일 업로드 + 대본 출력 */}
          <div className="space-y-6">
            <FileUpload
              onFilesReady={handleFilesReady}
              isDisabled={isGenerating}
            />
            <ScriptOutput script={finalScript} />
          </div>

          {/* 우측: 채팅방 */}
          <div className="lg:col-span-2">
            <ChatRoom
              messages={messages}
              isGenerating={isGenerating}
              currentRound={currentRound}
              onSendMessage={handleSendMessage}
              canSendMessage={isStarted}
            />
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-gray-600 text-sm">
          Powered by Claude AI · 멀티에이전트 쇼츠 대본 생성 시스템
        </div>
      </footer>
    </div>
  );
}
