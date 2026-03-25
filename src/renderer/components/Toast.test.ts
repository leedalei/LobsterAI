import { expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Toast from './Toast';

test('renders toast with content-width layout and vertically centered content', () => {
  const markup = renderToStaticMarkup(
    createElement(Toast, { message: '会话导出成功', onClose: () => undefined }),
  );

  expect(markup).toContain('inline-flex');
  expect(markup).toContain('items-center');
  expect(markup).not.toContain('text-center');
  expect(markup).not.toContain('w-full max-w-md');
});
