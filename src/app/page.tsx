'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ChatRoom } from '@/components/ChatRoom';
import { ScriptOutput } from '@/components/ScriptOutput';
import { useConversationStore } from '@/lib/store';
import { InputFiles, AgentMessage, StreamEvent } from '@/lib/types';

export default function Home() {
  const {
    messages,
    currentRound,
    isGenerating,
    finalScript,
    activeAgents,
    streamingContent,
    addMessage,
    setIsGenerating,
    setFinalScript,
    incrementRound,
    setAgentActive,
    setAgentInactive,
    appendStreamingContent,
    clearStreamingContent,
    clearAllStreaming,
    reset,
  } = useConversationStore();

  const [inputFiles, setInputFiles] = useState<InputFiles | null>(null);
  const [isStarted, setIsStarted] = useState(false);

  const processSSEStream = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 마지막 줄이 불완전할 수 있으므로 버퍼에 유지
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));

          switch (event.type) {
            case 'round_start':
              incrementRound();
              break;

            case 'agent_start':
              if (event.agentId) {
                setAgentActive(event.agentId);
              }
              break;

            case 'agent_chunk':
              if (event.agentId && event.content) {
                appendStreamingContent(event.agentId, event.content);
              }
              break;

            case 'agent_complete':
              if (event.agentId) {
                clearStreamingContent(event.agentId);
                setAgentInactive(event.agentId);
                if (event.content) {
                  addMessage({
                    id: `${currentRound}-${event.agentId}-${Date.now()}`,
                    agentId: event.agentId,
                    content: event.content,
                    timestamp: new Date(),
                    messageType: event.messageType || 'analysis',
                  });
                }
              }
              break;

            case 'final_script':
              if (event.finalScript) {
                setFinalScript(event.finalScript);
              }
              break;

            case 'error':
              console.error('스트리밍 에러:', event.error);
              break;
          }
        } catch {
          // JSON 파싱 실패 무시 (불완전한 청크)
        }
      }
    }
  };

  const runRoundStreaming = async (
    files: InputFiles,
    round: number,
    previousMessages: AgentMessage[],
    userFeedback?: string,
    isRevision?: boolean,
  ) => {
    const response = await fetch('/api/generate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputFiles: files,
        round,
        previousMessages,
        userFeedback,
        isRevision,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '알 수 없는 오류');
    }

    await processSSEStream(response);
  };

  const handleFilesReady = async (files: InputFiles) => {
    setInputFiles(files);
    setIsStarted(true);
    reset();
    setIsGenerating(true);

    try {
      // Round 1: 병렬 분석
      await runRoundStreaming(files, 1, []);

      // Round 2: 토론
      const round1Messages = useConversationStore.getState().messages;
      await runRoundStreaming(files, 2, round1Messages);

      // Round 3: 최종 대본
      const round2Messages = useConversationStore.getState().messages;
      await runRoundStreaming(files, 3, round2Messages);
    } catch (error) {
      console.error('생성 오류:', error);
      alert('대본 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      clearAllStreaming();
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!inputFiles) return;

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
      const currentMessages = useConversationStore.getState().messages;

      await runRoundStreaming(
        inputFiles,
        finalScript ? 4 : currentRound,
        currentMessages,
        content,
        !!finalScript,
      );
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      alert('메시지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      clearAllStreaming();
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
              activeAgents={activeAgents}
              streamingContent={streamingContent}
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
