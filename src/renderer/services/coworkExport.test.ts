import { expect, test } from 'vitest';
import type { CoworkSession } from '../types/cowork';
import {
  buildSessionExportFileName,
  normalizeSessionExportFileName,
  serializeSessionToExportHtml,
  serializeSessionToMarkdown,
} from './coworkExport';

const baseSession: CoworkSession = {
  id: 'session-1',
  title: 'Release Review',
  claudeSessionId: 'claude-1',
  status: 'completed',
  pinned: false,
  cwd: '/Users/demo/project',
  systemPrompt: '',
  executionMode: 'local',
  activeSkillIds: [],
  createdAt: new Date('2026-03-24T09:00:00Z').getTime(),
  updatedAt: new Date('2026-03-24T09:30:00Z').getTime(),
  messages: [],
};

test('serializes user and assistant messages in conversation order', () => {
  const session: CoworkSession = {
    ...baseSession,
    messages: [
      {
        id: 'user-1',
        type: 'user',
        content: 'Please summarize the blockers.',
        timestamp: new Date('2026-03-24T09:01:00Z').getTime(),
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'Two blockers remain: QA sign-off and release notes.',
        timestamp: new Date('2026-03-24T09:02:00Z').getTime(),
      },
      {
        id: 'user-2',
        type: 'user',
        content: 'What should we do next?',
        timestamp: new Date('2026-03-24T09:03:00Z').getTime(),
      },
      {
        id: 'assistant-2',
        type: 'assistant',
        content: 'Finish QA sign-off, then publish the release notes.',
        timestamp: new Date('2026-03-24T09:04:00Z').getTime(),
      },
    ],
  };

  const markdown = serializeSessionToMarkdown(session);

  expect(markdown).toContain('# Release Review');
  expect(markdown).not.toContain('Exported from LobsterAI.');
  expect(markdown).not.toContain('## Conversation');
  expect(markdown).not.toContain('### Turn 1');
  expect(markdown).toContain('**用户**');
  expect(markdown).toContain('**LobsterAI**');
  expect(markdown).toContain('Please summarize the blockers.');
  expect(markdown).toContain('Two blockers remain: QA sign-off and release notes.');
  expect(markdown).toContain('What should we do next?');
  expect(markdown).toContain('Finish QA sign-off, then publish the release notes.');
  expect(markdown).not.toContain('## 附录');
  expect(markdown).not.toContain('### 文件/图片附录');
});

test('keeps system and tool messages out of the export and only appends attachments in appendix', () => {
  const session: CoworkSession = {
    ...baseSession,
    messages: [
      {
        id: 'user-1',
        type: 'user',
        content: 'Check the changelog file.',
        timestamp: new Date('2026-03-24T09:01:00Z').getTime(),
      },
      {
        id: 'tool-use-1',
        type: 'tool_use',
        content: '',
        timestamp: new Date('2026-03-24T09:01:30Z').getTime(),
        metadata: {
          toolName: 'read_file',
          toolInput: { path: 'CHANGELOG.md' },
          toolUseId: 'tool-1',
        },
      },
      {
        id: 'tool-result-1',
        type: 'tool_result',
        content: '',
        timestamp: new Date('2026-03-24T09:01:40Z').getTime(),
        metadata: {
          toolResult: 'CHANGELOG content',
          toolUseId: 'tool-1',
        },
      },
      {
        id: 'system-1',
        type: 'system',
        content: 'Permission granted.',
        timestamp: new Date('2026-03-24T09:01:50Z').getTime(),
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'The changelog has already been updated.',
        timestamp: new Date('2026-03-24T09:02:00Z').getTime(),
      },
    ],
  };

  const markdown = serializeSessionToMarkdown(session);
  const conversationSection = markdown.split('## Appendix')[0];

  expect(conversationSection).not.toContain('Permission granted.');
  expect(conversationSection).not.toContain('read_file');
  expect(conversationSection).not.toContain('CHANGELOG content');

  expect(markdown).not.toContain('## 附录');
  expect(markdown).not.toContain('### Session Info');
  expect(markdown).not.toContain('### System Messages');
  expect(markdown).not.toContain('### Tool Activity');
});

test('records image attachments as placeholders without leaking base64 data', () => {
  const session: CoworkSession = {
    ...baseSession,
    messages: [
      {
        id: 'user-1',
        type: 'user',
        content: '',
        timestamp: new Date('2026-03-24T09:01:00Z').getTime(),
        metadata: {
          imageAttachments: [
            {
              name: 'wireframe.png',
              mimeType: 'image/png',
              base64Data: 'super-secret-base64',
            },
          ],
        },
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'I reviewed the image and found alignment issues.',
        timestamp: new Date('2026-03-24T09:02:00Z').getTime(),
      },
    ],
  };

  const markdown = serializeSessionToMarkdown(session);

  expect(markdown).toContain('图片未导出。');
  expect(markdown).not.toContain('## 附录');
  expect(markdown).not.toContain('wireframe.png');
  expect(markdown).not.toContain('image/png');
  expect(markdown).not.toContain('super-secret-base64');
});

test('builds a sanitized default markdown file name', () => {
  const fileName = buildSessionExportFileName(
    'Sprint Review: API/UI',
    new Date('2026-03-24T17:08:55'),
  );

  expect(fileName).toBe('Sprint Review API UI-20260324-1708.md');
});

test('builds a sanitized default pdf file name', () => {
  const fileName = buildSessionExportFileName(
    'Sprint Review: API/UI',
    new Date('2026-03-24T17:08:55'),
    'pdf',
  );

  expect(fileName).toBe('Sprint Review API UI-20260324-1708.pdf');
});

test('normalizes chained export extensions to the selected format', () => {
  expect(normalizeSessionExportFileName('exported-session.pdf.md', 'pdf')).toBe('exported-session.pdf');
  expect(normalizeSessionExportFileName('exported-session.pdf', 'markdown')).toBe('exported-session.md');
});

test('serializes session export html for pdf without leaking base64 data', () => {
  const session: CoworkSession = {
    ...baseSession,
    messages: [
      {
        id: 'system-1',
        type: 'system',
        content: 'System guidance.',
        timestamp: new Date('2026-03-24T09:00:30Z').getTime(),
      },
      {
        id: 'user-1',
        type: 'user',
        content: 'Please review the attached **UI**.',
        timestamp: new Date('2026-03-24T09:01:00Z').getTime(),
        metadata: {
          imageAttachments: [
            {
              name: 'wireframe.png',
              mimeType: 'image/png',
              base64Data: 'super-secret-base64',
            },
          ],
        },
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'The primary CTA needs more spacing.\n\n- Increase top padding',
        timestamp: new Date('2026-03-24T09:02:00Z').getTime(),
      },
      {
        id: 'tool-use-1',
        type: 'tool_use',
        content: '',
        timestamp: new Date('2026-03-24T09:02:30Z').getTime(),
        metadata: {
          toolName: 'read_file',
          toolInput: { path: 'notes.md' },
          toolUseId: 'tool-1',
        },
      },
      {
        id: 'tool-result-1',
        type: 'tool_result',
        content: '',
        timestamp: new Date('2026-03-24T09:02:40Z').getTime(),
        metadata: {
          toolResult: 'notes content',
          toolUseId: 'tool-1',
        },
      },
    ],
  };

  const html = serializeSessionToExportHtml(session);

  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('Release Review');
  expect(html).toContain('chat-shell');
  expect(html).toContain('user-bubble');
  expect(html).toContain('assistant-message');
  expect(html).toContain('Please review the attached');
  expect(html).toContain('<strong>UI</strong>');
  expect(html).toContain('The primary CTA needs more spacing.');
  expect(html).toContain('<ul>');
  expect(html).toContain('<li>Increase top padding</li>');
  expect(html).toContain('用户');
  expect(html).toContain('LobsterAI');
  expect(html).not.toContain('Turn 1');
  expect(html).not.toContain('文件/图片附录');
  expect(html).not.toContain('Exported from LobsterAI');
  expect(html).not.toContain('hero');
  expect(html).not.toContain('wireframe.png');
  expect(html).not.toContain('image/png');
  expect(html).not.toContain('super-secret-base64');
});
