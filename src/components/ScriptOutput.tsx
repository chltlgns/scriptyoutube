'use client';

import { FinalScript } from '@/lib/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface ScriptOutputProps {
    script: FinalScript | null;
}

export function ScriptOutput({ script }: ScriptOutputProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (script) {
            await navigator.clipboard.writeText(script.script);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        if (script) {
            const content = `## 제목 후보
${script.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 타겟
${script.targetAudience}

## 대본 (${script.duration}초)
${script.script}

## 핵심 포인트
${script.keyPoints.map((p) => `- ${p}`).join('\n')}
`;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `쇼츠대본_${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    if (!script) {
        return (
            <div className="bg-gray-900 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    📝 최종 대본
                </h2>
                <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-3">📄</div>
                    <p>대본 생성 후 여기에 표시됩니다</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-xl p-6 space-y-4"
        >
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                📝 최종 대본
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                    완성
                </span>
            </h2>

            {/* 제목 후보 */}
            <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">📌 제목 후보</h3>
                <div className="space-y-1">
                    {script.titles.map((title, index) => (
                        <div
                            key={index}
                            className="text-white bg-gray-800 px-3 py-2 rounded-lg text-sm"
                        >
                            {index + 1}. {title}
                        </div>
                    ))}
                </div>
            </div>

            {/* 타겟 & 길이 */}
            <div className="flex gap-4">
                <div className="flex-1 bg-gray-800 rounded-lg p-3">
                    <span className="text-xs text-gray-400">타겟</span>
                    <p className="text-white text-sm mt-1">{script.targetAudience}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                    <span className="text-xs text-gray-400">길이</span>
                    <p className="text-white text-sm mt-1">{script.duration}초</p>
                </div>
            </div>

            {/* 대본 */}
            <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">📜 대본</h3>
                <div className="bg-gray-800 rounded-lg p-4 text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
                    {script.script}
                </div>
            </div>

            {/* 핵심 포인트 */}
            <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">💡 핵심 포인트</h3>
                <ul className="space-y-1">
                    {script.keyPoints.map((point, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            {point}
                        </li>
                    ))}
                </ul>
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={handleCopy}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {copied ? '✅ 복사됨!' : '📋 복사'}
                </button>
                <button
                    onClick={handleDownload}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    💾 저장
                </button>
            </div>
        </motion.div>
    );
}
