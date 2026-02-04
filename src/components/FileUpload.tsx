'use client';

import { useState, useRef } from 'react';
import { InputFiles } from '@/lib/types';

interface FileUploadProps {
    onFilesReady: (files: InputFiles) => void;
    isDisabled: boolean;
}

export function FileUpload({ onFilesReady, isDisabled }: FileUploadProps) {
    const [productInfo, setProductInfo] = useState<string>('');
    const [reviews, setReviews] = useState<string>('');
    const [priceData, setPriceData] = useState({
        currentPrice: 0,
        lowestPrice: 0,
        purchaseCount: 0,
        discountRate: 0,
    });
    const [hasPriceData, setHasPriceData] = useState(false);
    const [priceImage, setPriceImage] = useState<string>('');
    const [priceImagePreview, setPriceImagePreview] = useState<string>('');
    const [direction, setDirection] = useState<string>('');

    // URL crawl states
    const [coupangUrl, setCoupangUrl] = useState<string>('');
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlStatus, setCrawlStatus] = useState<string>('');
    const [crawlError, setCrawlError] = useState<string>('');
    const [productName, setProductName] = useState<string>('');

    const productFileRef = useRef<HTMLInputElement>(null);
    const reviewFileRef = useRef<HTMLInputElement>(null);
    const priceImageRef = useRef<HTMLInputElement>(null);

    const handleFileRead = (
        file: File,
        setter: (content: string) => void
    ) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setter(e.target?.result as string);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setPriceImage(base64);
            setPriceImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    // Handle URL crawl (reviews only)
    const handleCrawl = async () => {
        if (!coupangUrl || !coupangUrl.includes('coupang.com')) {
            setCrawlError('유효한 쿠팡 URL을 입력해주세요.');
            return;
        }

        setIsCrawling(true);
        setCrawlStatus('크롤링 중... (Chrome 실행 중이면 먼저 종료해주세요)');
        setCrawlError('');

        try {
            const response = await fetch('/api/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: coupangUrl }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '크롤링 실패');
            }

            // Auto-fill reviews only (not product info)
            setReviews(data.reviews || '');
            setProductName(data.productName || '');
            setCrawlStatus(`✅ "${data.productName}" 리뷰 수집 완료!`);
        } catch (error) {
            const message = error instanceof Error ? error.message : '크롤링 실패';
            setCrawlError(message);
            setCrawlStatus('');
        } finally {
            setIsCrawling(false);
        }
    };

    // Download TXT file helper
    const handleDownloadTxt = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSubmit = () => {
        if (!productInfo || !reviews) {
            alert('제품 정보와 리뷰 파일을 모두 업로드해주세요.');
            return;
        }

        onFilesReady({
            productInfo,
            reviews,
            priceData: hasPriceData ? priceData : undefined,
            priceImage: priceImage || undefined,
            direction: direction || undefined,
        });
    };

    const isReady = productInfo && reviews;

    return (
        <div className="bg-gray-900 rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                📁 데이터 입력
            </h2>

            {/* Section 1: 제품 정보 (TXT File Upload Only) */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                    📄 제품 정보 (TXT 파일 업로드)
                </label>
                <input
                    type="file"
                    ref={productFileRef}
                    accept=".txt"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileRead(file, setProductInfo);
                    }}
                    className="hidden"
                />
                <button
                    onClick={() => productFileRef.current?.click()}
                    className={`w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors ${
                        productInfo
                            ? 'border-green-500 bg-green-500/10 text-green-400'
                            : 'border-gray-600 hover:border-blue-500 text-gray-400'
                    }`}
                >
                    {productInfo ? '✅ 업로드됨' : '📄 파일 선택...'}
                </button>
            </div>

            {/* Section 2: 리뷰 데이터 */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                    💬 리뷰 데이터
                </label>

                {/* Option A: URL 자동 수집 */}
                <div className="space-y-3 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-800/50">
                    <label className="text-xs font-medium text-blue-300 flex items-center gap-2">
                        🔗 쿠팡 리뷰 URL로 자동 수집
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={coupangUrl}
                            onChange={(e) => {
                                setCoupangUrl(e.target.value);
                                setCrawlError('');
                            }}
                            placeholder="https://www.coupang.com/vp/products/..."
                            className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none"
                            disabled={isCrawling}
                        />
                        <button
                            onClick={handleCrawl}
                            disabled={isCrawling || !coupangUrl}
                            className={`px-6 py-3 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                                isCrawling
                                    ? 'bg-blue-800 text-blue-300 cursor-wait'
                                    : coupangUrl
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isCrawling ? '⏳ 수집 중...' : '🕷️ 자동 수집'}
                        </button>
                    </div>

                    {/* Status */}
                    {crawlStatus && (
                        <p className="text-sm text-green-400">{crawlStatus}</p>
                    )}
                    {crawlError && (
                        <p className="text-sm text-red-400">{crawlError}</p>
                    )}
                    {isCrawling && (
                        <div className="flex items-center gap-2 text-sm text-blue-300">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                            Chrome으로 쿠팡 리뷰를 수집 중입니다... (약 1-2분 소요)
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-700"></div>
                    <span className="text-xs text-gray-500">또는 직접 업로드</span>
                    <div className="flex-1 h-px bg-gray-700"></div>
                </div>

                {/* Option B: TXT File Upload */}
                <div className="space-y-2">
                    <input
                        type="file"
                        ref={reviewFileRef}
                        accept=".txt"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileRead(file, setReviews);
                        }}
                        className="hidden"
                    />
                    <button
                        onClick={() => reviewFileRef.current?.click()}
                        className={`w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors ${
                            reviews
                                ? 'border-green-500 bg-green-500/10 text-green-400'
                                : 'border-gray-600 hover:border-blue-500 text-gray-400'
                        }`}
                    >
                        {reviews ? '✅ 업로드됨' : '📄 파일 선택...'}
                    </button>
                </div>
            </div>

            {/* 수집된 리뷰 다운로드 (crawled data only) */}
            {reviews && productName && (
                <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
                    <label className="text-xs font-medium text-gray-400">📥 수집된 리뷰 다운로드</label>
                    <button
                        onClick={() => handleDownloadTxt(reviews, `리뷰_${productName}.txt`)}
                        className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                    >
                        💬 리뷰 저장
                    </button>
                </div>
            )}

            {/* 쿠팡 가격 이미지 (선택) */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                    💰 쿠팡 가격 캡처 이미지 (선택)
                </label>
                <input
                    type="file"
                    ref={priceImageRef}
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                />
                <button
                    onClick={() => priceImageRef.current?.click()}
                    className={`w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors ${
                        priceImage
                            ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                            : 'border-gray-600 hover:border-pink-500 text-gray-400'
                    }`}
                >
                    {priceImage ? '✅ 이미지 업로드됨' : '🖼️ 이미지 선택...'}
                </button>
                {priceImagePreview && (
                    <div className="mt-2 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={priceImagePreview}
                            alt="가격 캡처"
                            className="rounded-lg w-full h-auto max-h-40 object-contain bg-gray-800"
                        />
                        <button
                            onClick={() => {
                                setPriceImage('');
                                setPriceImagePreview('');
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>

            {/* 대본 작성 방향 (선택) */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                    🎯 대본 작성 방향 (선택)
                </label>
                <textarea
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    placeholder="예: 가성비를 강조해줘, 학생 타겟으로 작성해줘, 게이밍 성능을 메인으로..."
                    className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                />
            </div>

            {/* 가격 데이터 (선택) */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <input
                        type="checkbox"
                        checked={hasPriceData}
                        onChange={(e) => setHasPriceData(e.target.checked)}
                        className="rounded"
                    />
                    가격 추적 데이터 직접 입력 (선택)
                </label>

                {hasPriceData && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="text-xs text-gray-400">현재가</label>
                            <input
                                type="number"
                                value={priceData.currentPrice || ''}
                                onChange={(e) =>
                                    setPriceData({ ...priceData, currentPrice: Number(e.target.value) })
                                }
                                placeholder="1,400,000"
                                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">최저가</label>
                            <input
                                type="number"
                                value={priceData.lowestPrice || ''}
                                onChange={(e) =>
                                    setPriceData({ ...priceData, lowestPrice: Number(e.target.value) })
                                }
                                placeholder="1,250,000"
                                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">구매자 수</label>
                            <input
                                type="number"
                                value={priceData.purchaseCount || ''}
                                onChange={(e) =>
                                    setPriceData({ ...priceData, purchaseCount: Number(e.target.value) })
                                }
                                placeholder="600"
                                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">할인율 (%)</label>
                            <input
                                type="number"
                                value={priceData.discountRate || ''}
                                onChange={(e) =>
                                    setPriceData({ ...priceData, discountRate: Number(e.target.value) })
                                }
                                placeholder="6"
                                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 생성 버튼 */}
            <button
                onClick={handleSubmit}
                disabled={!isReady || isDisabled}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    isReady && !isDisabled
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
            >
                {isDisabled ? '⏳ 생성 중...' : '🚀 대본 생성 시작'}
            </button>
        </div>
    );
}
