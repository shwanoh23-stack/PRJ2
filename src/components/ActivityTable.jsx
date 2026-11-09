import React, { useState } from 'react';
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_MAP,
  getDefaultActivityDateTime,
} from '../types/constants';

export default function ActivityTable({
  activities,
  loading,
  defaultAssignee,
  onAddActivity,
}) {
  const [activityType, setActivityType] = useState('CALL');
  const [activityDate, setActivityDate] = useState(getDefaultActivityDateTime);
  const [assignee, setAssignee] = useState(defaultAssignee || '홍길동');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setFormError('활동 상세 내용을 입력해 주세요.');
      return;
    }

    setFormError('');
    setSubmitting(true);
    try {
      await onAddActivity({
        activity_type: activityType,
        activity_date: activityDate.trim() || getDefaultActivityDateTime(),
        assignee: assignee.trim() || defaultAssignee || '영업담당자',
        content: content.trim(),
      });
      setContent('');
      setActivityDate(getDefaultActivityDateTime());
    } catch (err) {
      setFormError(err.message || '액티비티 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>📋 영업 액티비티 타임라인</span>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            총 {activities.length}건
          </span>
        </h3>
        <span className="text-xs text-slate-400">
          활동이 1건 이상 등록되면 파이프라인 삭제가 영구 보호됩니다.
        </span>
      </div>

      {/* 신규 액티비티 즉시 등록 폼 (FR-03-4) */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 활동 유형 선택 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              활동 유형
            </label>
            <div className="grid grid-cols-4 gap-1">
              {ACTIVITY_TYPES.map((type) => {
                const selected = activityType === type.code;
                return (
                  <button
                    key={type.code}
                    type="button"
                    onClick={() => setActivityType(type.code)}
                    className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 px-2 text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 활동 일시 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              활동 일시
            </label>
            <input
              type="text"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              placeholder="YYYY-MM-DD HH:mm"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 담당자 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              담당자
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="담당자 이름"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 내용 입력 + [활동 추가] 버튼 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (formError) setFormError('');
            }}
            placeholder="고객 통화/메일/미팅 결과 및 다음 액션 내용을 입력하세요..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {submitting ? '등록 중...' : '+ 활동 추가'}
          </button>
        </div>

        {formError && (
          <p className="text-xs font-medium text-rose-600">{formError}</p>
        )}
      </form>

      {/* 액티비티 목록 표 (FR-03-3: 활동일시 | 활동유형(아이콘) | 담당자 | 내용 요약) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <th className="py-2.5 px-3 w-36">활동일시</th>
              <th className="py-2.5 px-3 w-28">활동유형</th>
              <th className="py-2.5 px-3 w-24">담당자</th>
              <th className="py-2.5 px-3">내용 요약</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  액티비티 내역을 불러오는 중입니다...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  등록된 영업 액티비티가 없습니다. 위 입력창에서 첫 활동을 기록해 보세요.
                </td>
              </tr>
            ) : (
              activities.map((act) => {
                const typeInfo = ACTIVITY_TYPE_MAP[act.activity_type] || {
                  label: act.activity_type,
                  icon: '📌',
                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                };
                return (
                  <tr key={act.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {act.activity_date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeInfo.badgeClass}`}
                      >
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                      {act.assignee}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 leading-relaxed">
                      {act.content}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
