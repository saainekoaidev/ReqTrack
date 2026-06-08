import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileDropField from './FileDropField';

describe('FileDropField (US-031)', () => {
  it('参照でファイルを選ぶと onFile が呼ばれ、ファイル名を表示', async () => {
    const onFile = vi.fn();
    const { rerender } = render(
      <FileDropField file={null} onFile={onFile} ariaLabel="テストファイル" />,
    );
    const input = screen.getByLabelText('テストファイル');
    const f = new File(['a,b\n1,2'], 'sample.csv', { type: 'text/csv' });
    await userEvent.upload(input, f);
    expect(onFile).toHaveBeenCalledWith(f);

    // 親が file を渡すとファイル名が出る
    rerender(<FileDropField file={f} onFile={onFile} ariaLabel="テストファイル" />);
    expect(screen.getByText('sample.csv')).toBeInTheDocument();

    // 取消ボタンで onFile(null) が呼ばれる
    onFile.mockClear();
    await userEvent.click(screen.getByLabelText('テストファイル の選択を取消'));
    expect(onFile).toHaveBeenCalledWith(null);
  });

  it('ファイル未選択時は取消ボタンを表示しない', () => {
    render(<FileDropField file={null} onFile={vi.fn()} ariaLabel="テストファイル" />);
    expect(screen.queryByLabelText('テストファイル の選択を取消')).toBeNull();
  });
});
