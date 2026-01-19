'use client';

import { AgentMessage, AGENTS } from '@/lib/types';
import { motion } from 'framer-motion';

interface AgentMessageItemProps {
    message: AgentMessage;
}

export function AgentMessageItem({ message }: AgentMessageItemProps) {
    const agent = AGENTS[message.agentId];

    // 멘션 하이라이팅
    const formatContent = (content: string) => {
        return content.replace(/@(SPEC|REVIEW|STYLE|BOSS|USER)(_AGENT)?/g, (match) => {
            const agentId = match.replace('@', '').replace('_AGENT', '') as keyof typeof AGENTS;
            if (AGENTS[agentId]) {
                return `<span class="text-${agentId.toLowerCase()}-highlight font-semibold">@${AGENTS[agentId].name}</span>`;
            }
            return match;
        });
    };

    // 사용자 메시지인지 확인
    const isUserMessage = message.agentId === 'USER';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex gap-3 p-4 hover:bg-gray-800/50 rounded-lg transition-colors"
        >
            {/* 아바타 */}
            <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: agent.color + '20' }}
            >
                {agent.icon}
            </div>

            {/* 메시지 본문 */}
            <div className="flex-1 min-w-0">
                {/* 헤더 */}
                <div className="flex items-center gap-2 mb-1">
                    <span
                        className="font-semibold"
                        style={{ color: agent.color }}
                    >
                        {agent.name}
                    </span>
                    <span className="text-xs text-gray-500">
                        {agent.role}
                    </span>
                    <span className="text-xs text-gray-600">
                        {message.timestamp.toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                </div>

                {/* 내용 */}
                <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {message.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-1">
                            {line.startsWith('@') ? (
                                <span>
                                    <span
                                        className="font-semibold px-1 rounded"
                                        style={{
                                            backgroundColor: AGENTS[line.split(' ')[0].replace('@', '').replace('_AGENT', '') as keyof typeof AGENTS]?.color + '30' || '#666',
                                            color: AGENTS[line.split(' ')[0].replace('@', '').replace('_AGENT', '') as keyof typeof AGENTS]?.color || '#fff'
                                        }}
                                    >
                                        {line.split(' ')[0]}
                                    </span>
                                    {' '}{line.split(' ').slice(1).join(' ')}
                                </span>
                            ) : line.startsWith('[') ? (
                                <span className="font-semibold text-white">{line}</span>
                            ) : line.startsWith('-') || line.startsWith('•') || line.match(/^\d\./) ? (
                                <span className="text-gray-300 ml-2">{line}</span>
                            ) : (
                                line
                            )}
                        </p>
                    ))}
                </div>

                {/* 메시지 타입 태그 */}
                {message.messageType === 'final_script' && (
                    <div className="mt-2 inline-block px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                        📝 최종 대본
                    </div>
                )}
                {message.messageType === 'consensus' && (
                    <div className="mt-2 inline-block px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        ✅ 합의
                    </div>
                )}
                {message.messageType === 'rebuttal' && (
                    <div className="mt-2 inline-block px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                        💭 반박
                    </div>
                )}
                {message.messageType === 'user_input' && (
                    <div className="mt-2 inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                        💬 의견
                    </div>
                )}
                {message.messageType === 'revision_request' && (
                    <div className="mt-2 inline-block px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        ✏️ 수정 요청
                    </div>
                )}
            </div>
        </motion.div>
    );
}
