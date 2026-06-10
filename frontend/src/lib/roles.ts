import type { Member } from '../api/client';

// 要員の役割 (US-043)。
// - プロジェクト管理者(pm): レビュワー可。チームリーダー兼務可。原則 作業者にはならない(1人運用時のみ可)。
// - チームリーダー(leader): レビュワー可 かつ 作業者にもなれる。
// - 担当者(member): ガント上のタスクの作業者。
export type Role = 'pm' | 'leader' | 'member';

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'pm', label: 'プロジェクト管理者' },
  { value: 'leader', label: 'チームリーダー' },
  { value: 'member', label: '担当者' },
];

export function roleLabel(role: string | null | undefined): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? (role || '担当者');
}

export function canReview(role: string | null | undefined): boolean {
  return role === 'pm' || role === 'leader';
}

export function canWork(role: string | null | undefined): boolean {
  // 担当者・チームリーダーは作業者。PM は原則不可。
  return role === 'member' || role === 'leader';
}

/** 作業者(タスク担当)候補。原則は担当者+リーダー。該当が居なければ全員(1人運用などのフォールバック)。 */
export function workerCandidates(members: Member[]): Member[] {
  const workers = members.filter((m) => canWork(m.role));
  return workers.length > 0 ? workers : members;
}

/** レビュワー候補。PM を先頭(最上位)に、続いてリーダー。 */
export function reviewerCandidates(members: Member[]): Member[] {
  const pms = members.filter((m) => m.role === 'pm');
  const leaders = members.filter((m) => m.role === 'leader');
  return [...pms, ...leaders];
}
