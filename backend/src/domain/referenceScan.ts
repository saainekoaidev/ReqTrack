// 参照資料スキャンの純粋ヘルパ (US-024)。ファイル走査自体は route 側(fs)で行う。

export const TEXT_EXTS = new Set([
  '.md', '.txt', '.csv', '.json', '.yml', '.yaml', '.xml', '.html', '.css',
  '.js', '.ts', '.tsx', '.jsx', '.java', '.py', '.sql', '.sh', '.c', '.cpp',
  '.cs', '.go', '.rb', '.php', '.kt', '.vue', '.properties', '.gradle',
]);

export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.cache', 'coverage',
  '.idea', '.vscode', '__pycache__', 'target', 'bin', 'obj',
]);

/** 拡張子(小文字、ドット付き)がテキスト系か。 */
export function isTextLike(ext: string): boolean {
  return TEXT_EXTS.has(ext.toLowerCase());
}

/** ディレクトリ名がスキャン対象外か。 */
export function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith('.');
}

/** テキスト内容の冒頭抜粋(末尾空白除去 + 連続空行畳み + トリム + 最大長)。 */
export function makeExcerpt(content: string, max = 2000): string {
  const trimmed = content.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return trimmed.length > max ? trimmed.slice(0, max) + ' ...' : trimmed;
}
