'use client';

import { useRef, useEffect, useState } from 'react';
import { AgentMessage, AGENTS } from '@/lib/types';
import { AgentMessageItem } from './AgentMessageItem';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatRoomProps {
    messages: AgentMessage[];
    isGenerating: boolean;
    currentRound: number;
    onSendMessage?: (message: string) => void;
    canSendMessage?: boolean;
}

export function ChatRoom({
    messages,
    isGenerating,
    currentRound,
    onSendMessage,
    canSendMessage = false
}: ChatRoomProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState('');

    // 새 메시지가 추가되면 스크롤
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && onSendMessage && !isGenerating) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    // USER를 제외한 AI 에이전트만 표시
    const aiAgents = Object.values(AGENTS).filter(agent => agent.id !== 'USER');

    return (
        <div className="bg-gray-900 rounded-xl flex flex-col h-[600px]">
            {/* 헤더 */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">💬 에이전트 채팅방</h2>
                    {currentRound > 0 && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            Round {currentRound}
                        </span>
                    )}
                </div>

                {/* 에이전트 목록 */}
                <div className="flex items-center gap-2">
                    {aiAgents.map((agent) => (
                        <div
                            key={agent.id}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                            style={{ backgroundColor: agent.color + '20' }}
                            title={`${agent.name} - ${agent.role}`}
                        >
                            {agent.icon}
                        </div>
                    ))}
                </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <div className="text-6xl mb-4">🤖</div>
                        <p className="text-lg">파일을 업로드하면</p>
                        <p className="text-lg">에이전트들이 대화를 시작합니다!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {messages.map((message) => (
                            <AgentMessageItem key={message.id} message={message} />
                        ))}
                    </AnimatePresence>
                )}

                {/* 타이핑 인디케이터 */}
                {isGenerating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 p-4"
                    >
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                        <span className="text-gray-400">에이전트들이 토론 중...</span>
                    </motion.div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* 사용자 입력창 */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={
                            !canSendMessage
                                ? "파일을 업로드하면 토론에 참여할 수 있습니다"
                                : isGenerating
                                    ? "에이전트들이 토론 중입니다..."
                                    : "의견을 입력하세요 (예: 후킹을 더 강하게 해주세요)"
                        }
                        disabled={!canSendMessage || isGenerating}
                        className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3
                                 placeholder-gray-500 border border-gray-700
                                 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!canSendMessage || isGenerating || !inputValue.trim()}
                        className="px-6 py-3 bg-amber-500 text-white rounded-lg font-medium
                                 hover:bg-amber-600 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
                    >
                        전송
                    </button>
                </div>
                {canSendMessage && !isGenerating && (
                    <p className="text-xs text-gray-500 mt-2">
                        💡 토론 중 의견을 내거나, 대본 완성 후 수정 요청을 할 수 있습니다
                    </p>
                )}
            </form>
        </div>
    );
}
