'use client';

import { useRef, useEffect } from 'react';
import { AgentMessage, AGENTS } from '@/lib/types';
import { AgentMessageItem } from './AgentMessageItem';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatRoomProps {
    messages: AgentMessage[];
    isGenerating: boolean;
    currentRound: number;
}

export function ChatRoom({ messages, isGenerating, currentRound }: ChatRoomProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // 새 메시지가 추가되면 스크롤
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                    {Object.values(AGENTS).map((agent) => (
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
        </div>
    );
}
