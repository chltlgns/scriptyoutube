'use client';

import { useState, useRef, useCallback } from 'react';
import type { ScriptInput } from '@/lib/types';

interface FileUploadProps {
  onGenerate: (input: ScriptInput) => void;
  isDisabled: boolean;
}

export function FileUpload({ onGenerate, isDisabled }: FileUploadProps) {
  const [productInfo, setProductInfo] = useState('');
  const [reviews, setReviews] = useState('');
  const [priceImage, setPriceImage] = useState('');
  const [priceImagePreview, setPriceImagePreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const productFileRef = useRef<HTMLInputElement>(null);
  const reviewFileRef = useRef<HTMLInputElement>(null);
  const priceImageRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (file: File, setter: (content: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => setter(e.target?.result as string);
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, []);

  const handleSubmit = () => {
    if (!productInfo || !reviews) {
      alert('제품 정보와 리뷰 데이터를 모두 입력해주세요.');
      return;
    }
    onGenerate({
      productInfo,
      reviews,
      priceImage: priceImage || undefined,
    });
  };

  const isReady = productInfo && reviews;

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-5 border border-gray-800">
      <h2 className="text-xl font-bold text-white">
        데이터 입력
      </h2>

      {/* 제품 정보 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">
            제품 정보
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
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            TXT 파일 불러오기
          </button>
        </div>
        <textarea
          value={productInfo}
          onChange={(e) => setProductInfo(e.target.value)}
          placeholder="제품 이름, 스펙, 특징 등의 정보를 입력하세요..."
          className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
          rows={5}
        />
        {productInfo && (
          <p className="text-xs text-green-400">{productInfo.length}자 입력됨</p>
        )}
      </div>

      {/* 리뷰 데이터 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">
            리뷰 데이터
          </label>
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
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            TXT 파일 불러오기
          </button>
        </div>
        <textarea
          value={reviews}
          onChange={(e) => setReviews(e.target.value)}
          placeholder="고객 리뷰를 붙여넣으세요..."
          className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
          rows={5}
        />
        {reviews && (
          <p className="text-xs text-green-400">{reviews.length}자 입력됨</p>
        )}
      </div>

      {/* 가격 추적 이미지 (드래그 앤 드롭) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">
          가격 추적 이미지 (선택)
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

        {!priceImagePreview ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => priceImageRef.current?.click()}
            className={`w-full py-8 px-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center gap-2 ${
              isDragging
                ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                : 'border-gray-600 hover:border-blue-500 text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">
              {isDragging ? '여기에 놓으세요' : '이미지를 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="text-xs text-gray-500">가격 추적 캡처 이미지 (PNG, JPG)</p>
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={priceImagePreview}
              alt="가격 캡처"
              className="rounded-xl w-full h-auto max-h-48 object-contain bg-gray-800 border border-gray-700"
            />
            <button
              onClick={() => {
                setPriceImage('');
                setPriceImagePreview('');
              }}
              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
            >
              x
            </button>
          </div>
        )}
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!isReady || isDisabled}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
          isReady && !isDisabled
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isDisabled ? '생성 중...' : '대본 생성'}
      </button>
    </div>
  );
}
