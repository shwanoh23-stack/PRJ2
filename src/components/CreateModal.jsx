import React, { useState } from 'react';
import { PIPELINE_STAGES, formatKRW } from '../types/constants';

export default function CreateModal({ onClose, onCreatePipeline }) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [status, setStatus] = useState('LEAD');
  const [createdBy, setCreatedBy] = useState('');
  const [closingDate, setClosingDate] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!title || title.trim().length < 2) {
      nextErrors.title = '딜 제목을 2자 이상 입력해 주세요.';
    }
    if (!clientName || !clientName.trim()) {
      nextErrors.clientName = '거래처명을 입력해 주세요.';
    }

    const trimmedAmount = String(amountInput).trim();
    const numAmount = Number(trimmedAmount);
    if (
      trimmedAmount === '' ||
      Number.isNaN(numAmount) ||
      numAmount < 0 ||
      !/^\d+(\.\d+)?$/.test(trimmedAmount)
    ) {
      nextErrors.amount = '올바른 금액을 숫자로 입력해 주세요';
    }

    if (!createdBy || !createdBy.trim()) {
      nextErrors.createdBy = '담당자를 입력해 주세요.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAmountChange = (val) => {
    setAmountInput(val);
    const trimmed = String(val).trim();
    const num = Number(trimmed);
    if (
      trimmed !== '' &&
      (Number.isNaN(num) || num < 0 || !/^\d+(\.\d+)?$/.test(trimmed))
    ) {
      setErrors((prev) => ({
        ...prev,
        amount: '올바른 금액을 숫자로 입력해 주세요',
      }));
    } else {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onCreatePipeline({
        title: title.trim(),
        client_name: clientName.trim(),
        amount: Math.round(Number(amountInput)),
        status,
        created_by: createdBy.trim(),
        closing_date: closingDate || null,
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err.message || '파이프라인 등록에 실패했습니다.',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              + 새 파이프라인 등록
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              새로운 영업 기회(딜)를 등록하면 칸반보드에 즉시 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 입력 폼 (FR-02-2) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 거래처명 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              거래처명 (client_name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setErrors((prev) => ({ ...prev, clientName: undefined }));
              }}
              placeholder="예: (주)카카오엔터프라이즈"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
            {errors.clientName && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.clientName}
              </p>
            )}
          </div>

          {/* 딜 제목 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              딜 제목 (title, 2자 이상) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="예: AI 챗봇 도입 건"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
            {errors.title && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.title}
              </p>
            )}
          </div>

          {/* 예상 금액 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              예상 금액 (amount, 원화 ₩) <span className="text-rose-500">*</span>
              {amountInput && !errors.amount && (
                <span className="ml-2 font-normal text-indigo-600">
                  {formatKRW(amountInput)}
                </span>
              )}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="예: 25000000"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none ${
                errors.amount
                  ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                  : 'border-slate-300 focus:border-indigo-500'
              }`}
            />
            {errors.amount && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* 초기 단계 & 담당자 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                초기 단계 (status)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                {PIPELINE_STAGES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                담당자 (created_by) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={createdBy}
                onChange={(e) => {
                  setCreatedBy(e.target.value);
                  setErrors((prev) => ({ ...prev, createdBy: undefined }));
                }}
                placeholder="예: 김영업"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
              {errors.createdBy && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {errors.createdBy}
                </p>
              )}
            </div>
          </div>

          {/* 목표 마감일 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              목표 마감일 (closing_date, 선택)
            </label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {errors.submit && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600">
              {errors.submit}
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 px-5 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
