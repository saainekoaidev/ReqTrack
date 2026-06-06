import { defineConfig } from 'vitest/config';

// PrismaClient のインスタンス化に DATABASE_URL が必要なため、未設定ならテスト用の既定値を入れる。
// (health/validation のテストは実際には DB へ接続しない)
process.env.DATABASE_URL ??= 'file:./test.db';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
