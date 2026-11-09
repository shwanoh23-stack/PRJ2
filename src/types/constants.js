// 6단계 영업 파이프라인 칸반 컬럼 정의 (FD.md FR-01-1)
export const PIPELINE_STAGES = [
  {
    code: 'LEAD',
    label: '1. 리드',
    shortLabel: '리드',
    description: '초기 발굴 및 접촉',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    headerAccent: 'border-t-slate-500',
    dotClass: 'bg-slate-500',
  },
  {
    code: 'PROPOSAL',
    label: '2. 제안',
    shortLabel: '제안',
    description: '솔루션 및 견적 제안',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headerAccent: 'border-t-blue-500',
    dotClass: 'bg-blue-500',
  },
  {
    code: 'MEETING',
    label: '3. 미팅',
    shortLabel: '미팅',
    description: '대면/온라인 미팅 및 데모',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    headerAccent: 'border-t-indigo-500',
    dotClass: 'bg-indigo-500',
  },
  {
    code: 'NEGOTIATION',
    label: '4. 협상',
    shortLabel: '협상',
    description: '조건 및 단가 실무 협상',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headerAccent: 'border-t-amber-500',
    dotClass: 'bg-amber-500',
  },
  {
    code: 'WON',
    label: '5. 마무리',
    shortLabel: '마무리(수주)',
    description: '수주 성공 및 계약 완료',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerAccent: 'border-t-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  {
    code: 'CANCELED',
    label: '6. 취소',
    shortLabel: '취소(실패)',
    description: '딜 실패 또는 잠정 보류',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    headerAccent: 'border-t-rose-500',
    dotClass: 'bg-rose-500',
  },
];

export const STAGE_MAP = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.code, stage])
);

// 액티비티 4종 정의 (FD.md FR-03-4)
export const ACTIVITY_TYPES = [
  { code: 'CALL', label: '전화', icon: '📞', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { code: 'EMAIL', label: '메일', icon: '✉️', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { code: 'SMS', label: '문자', icon: '💬', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { code: 'OTHER', label: '기타', icon: '📌', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

export const ACTIVITY_TYPE_MAP = {
  CALL: { code: 'CALL', label: '전화', icon: '📞', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EMAIL: { code: 'EMAIL', label: '메일', icon: '✉️', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  SMS: { code: 'SMS', label: '문자', icon: '💬', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  OTHER: { code: 'OTHER', label: '기타', icon: '📌', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  MEETING: { code: 'MEETING', label: '미팅(기타)', icon: '📌', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
};

// 원화(₩) 천단위 콤마 포맷터 (FR-01-2, FR-01-4)
export function formatKRW(amount) {
  const num = Number(amount || 0);
  if (Number.isNaN(num)) return '₩0';
  return `₩${num.toLocaleString('ko-KR')}`;
}

// 현재 일시 기본값 문자열 (YYYY-MM-DD HH:mm)
export function getDefaultActivityDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
