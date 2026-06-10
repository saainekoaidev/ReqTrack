// 表示サイズ(フォントスケール)設定 (US-056)。クライアント保存(localStorage)。
// html 要素のクラスで rem 基準サイズを切り替え、全体のフォント/図形が連動する。
export type UiScale = 'small' | 'medium' | 'large';

const KEY = 'reqtrack.uiScale';
const CLASSES: Record<UiScale, string> = {
  small: 'fs-small',
  medium: 'fs-medium',
  large: 'fs-large',
};

export function getUiScale(): UiScale {
  const v = localStorage.getItem(KEY);
  return v === 'small' || v === 'large' ? v : 'medium';
}

export function applyUiScale(scale: UiScale = getUiScale()): void {
  const el = document.documentElement;
  el.classList.remove('fs-small', 'fs-medium', 'fs-large');
  el.classList.add(CLASSES[scale]);
}

export function setUiScale(scale: UiScale): void {
  localStorage.setItem(KEY, scale);
  applyUiScale(scale);
}
