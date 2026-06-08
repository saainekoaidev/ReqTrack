import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Claude Code CLI(claude -p)を子プロセス起動して LLM を実行する (US-036 / ADR 0010)。
// ログイン済み Claude Code の OAuth(サブスク枠)を使うため ANTHROPIC_API_KEY は不要。

let cachedPath: string | null = null;

/** claude 実行ファイルのパスを解決する: env → VSCode 拡張同梱 → PATH → 既定。 */
export function resolveClaudeCliPath(): string {
  if (cachedPath) return cachedPath;

  const fromEnv = process.env.CLAUDE_CLI_PATH;
  if (fromEnv && existsSync(fromEnv)) return (cachedPath = fromEnv);

  // VSCode 拡張同梱バイナリ(最新版を優先)
  try {
    const extRoot = join(homedir(), '.vscode', 'extensions');
    const dirs = readdirSync(extRoot)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      const exe = join(extRoot, d, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude');
      if (existsSync(exe)) return (cachedPath = exe);
    }
  } catch {
    // 拡張ディレクトリ無し
  }

  // PATH 上の claude(なければ最後の手段として 'claude')
  return (cachedPath = 'claude');
}

const activeChildren = new Set<ReturnType<typeof spawn>>();

export interface RunOptions {
  timeoutMs?: number;
  cwd?: string;
}

/**
 * claude -p をサブプロセス起動し、プロンプトを stdin で渡して stdout を返す。
 * stdin 経由にすることで OS の引数クォート問題(長文/改行/特殊文字)を回避する。
 */
export function runClaude(prompt: string, opts: RunOptions = {}): Promise<string> {
  const { timeoutMs = 300_000, cwd } = opts;
  const cli = resolveClaudeCliPath();
  const useShell = process.platform === 'win32'; // PATH/.cmd 解決のため

  return new Promise<string>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cli, ['-p'], {
        shell: useShell,
        cwd: cwd ?? process.cwd(),
        env: process.env,
      });
    } catch {
      reject(new Error('Claude Code CLI を起動できませんでした。'));
      return;
    }
    activeChildren.add(child);

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      reject(new Error('AI 処理がタイムアウトしました。'));
    }, timeoutMs);

    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      activeChildren.delete(child);
      reject(
        new Error(
          'AI 見積には claude CLI(Claude Code, ログイン済み)が必要です。claude が見つかりませんでした。' +
            '※ ReqTrack 本体の利用に VSCode の起動は不要です(AI 見積のみ claude CLI を使います)。',
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      activeChildren.delete(child);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `AI 処理が失敗しました(コード ${code})。`));
    });

    // プロンプトを stdin で渡す
    try {
      child.stdin?.write(prompt);
      child.stdin?.end();
    } catch {
      // close 側で処理
    }
  });
}

/** 実行中の claude プロセスを全てキャンセルする。 */
export function cancelAllClaude(): void {
  for (const c of activeChildren) {
    try {
      c.kill();
    } catch {
      // ignore
    }
  }
  activeChildren.clear();
}
