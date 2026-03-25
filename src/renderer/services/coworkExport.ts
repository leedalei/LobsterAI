import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';
// @ts-ignore
import remarkMath from 'remark-math';
// @ts-ignore
import rehypeKatex from 'rehype-katex';
import type { CoworkImageAttachment, CoworkMessage, CoworkSession } from '../types/cowork';

export type CoworkExportFormat = 'markdown' | 'pdf';

export interface CoworkExportOptions {
  format: CoworkExportFormat;
}

type ConversationTurn = {
  userMessage: CoworkMessage | null;
  assistantMessages: CoworkMessage[];
};

type SessionExportData = {
  title: string;
  turns: ConversationTurn[];
};

const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/g;
const SAFE_URL_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'file']);

const sanitizeFileNamePart = (value: string): string => {
  const sanitized = value.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || 'cowork-session';
};

const getExportFileExtension = (format: CoworkExportFormat): 'md' | 'pdf' => (
  format === 'pdf' ? 'pdf' : 'md'
);

export const normalizeSessionExportFileName = (
  value: string,
  format: CoworkExportFormat = 'markdown',
): string => {
  const trimmed = value.trim();
  const extension = getExportFileExtension(format);
  if (!trimmed) {
    return `cowork-session.${extension}`;
  }

  const sanitizedBaseName = sanitizeFileNamePart(trimmed.replace(/(\.(md|pdf))+$/i, ''));
  return `${sanitizedBaseName}.${extension}`;
};

const formatFileNameTimestamp = (value: Date): string => {
  const pad = (num: number): string => String(num).padStart(2, '0');
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}`;
};

const getImageAttachments = (message: CoworkMessage): CoworkImageAttachment[] => {
  const attachments = message.metadata?.imageAttachments;
  return Array.isArray(attachments) ? attachments as CoworkImageAttachment[] : [];
};

const renderMessageContent = (message: CoworkMessage): string => {
  const content = message.content.trim();
  if (content) {
    return content;
  }

  if (getImageAttachments(message).length > 0) {
    return '_图片未导出。_';
  }

  const error = typeof message.metadata?.error === 'string' ? message.metadata.error.trim() : '';
  if (error) {
    return error;
  }

  return '_No text content._';
};

const collectConversationTurns = (messages: CoworkMessage[]): ConversationTurn[] => {
  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | null = null;

  const ensureTurn = (): ConversationTurn => {
    if (currentTurn) {
      return currentTurn;
    }
    currentTurn = { userMessage: null, assistantMessages: [] };
    turns.push(currentTurn);
    return currentTurn;
  };

  for (const message of messages) {
    if (message.type === 'user') {
      currentTurn = { userMessage: message, assistantMessages: [] };
      turns.push(currentTurn);
      continue;
    }

    if (message.type === 'assistant') {
      ensureTurn().assistantMessages.push(message);
    }
  }

  return turns;
};

const buildSessionExportData = (session: CoworkSession): SessionExportData => ({
  title: session.title || 'Untitled Session',
  turns: collectConversationTurns(session.messages),
});

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeDisplayMath = (content: string): string => {
  return content.replace(/\$\$([\s\S]+?)\$\$/g, (match, inner) => {
    if (!inner.includes('\n')) {
      return match;
    }
    return `$$\n${inner.trim()}\n$$`;
  });
};

const safeUrlTransform = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const match = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!match) {
    return trimmed;
  }

  const protocol = match[1].toLowerCase();
  if (SAFE_URL_PROTOCOLS.has(protocol)) {
    return trimmed;
  }

  return '';
};

const renderMarkdownHtml = (value: string, className: string): string => {
  return renderToStaticMarkup(
    createElement(
      'div',
      { className },
      createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [rehypeKatex],
          urlTransform: safeUrlTransform,
        },
        normalizeDisplayMath(value),
      ),
    ),
  );
};

export const buildSessionExportFileName = (
  sessionTitle: string,
  exportedAt = new Date(),
  format: CoworkExportFormat = 'markdown',
): string => {
  const baseName = sanitizeFileNamePart(sessionTitle || 'cowork-session');
  return normalizeSessionExportFileName(`${baseName}-${formatFileNameTimestamp(exportedAt)}`, format);
};

export const serializeSessionToMarkdown = (
  session: CoworkSession,
): string => {
  const data = buildSessionExportData(session);

  const lines: string[] = [
    `# ${data.title}`,
    '',
  ];

  if (data.turns.length === 0) {
    lines.push('_No conversation content available._', '');
  } else {
    data.turns.forEach((turn) => {
      if (turn.userMessage) {
        lines.push('**用户**', '', renderMessageContent(turn.userMessage), '');
      }

      if (turn.assistantMessages.length > 0) {
        lines.push('**LobsterAI**', '');
        lines.push(turn.assistantMessages.map(renderMessageContent).join('\n\n'), '');
      }
    });
  }

  return lines.join('\n').trimEnd() + '\n';
};

export const serializeSessionToExportHtml = (
  session: CoworkSession,
): string => {
  const data = buildSessionExportData(session);

  const conversationHtml = data.turns.length === 0
    ? '<div class="empty-state">No conversation content available.</div>'
    : data.turns.map((turn) => {
      const blocks: string[] = ['<section class="turn">'];

      if (turn.userMessage) {
        blocks.push(
          '<div class="chat-row user-row">',
          '<div class="message-column user-column">',
          '<div class="message-role">用户</div>',
          renderMarkdownHtml(renderMessageContent(turn.userMessage), 'user-bubble markdown-body'),
          '</div>',
          '</div>',
        );
      }

      if (turn.assistantMessages.length > 0) {
        blocks.push(
          '<div class="chat-row assistant-row">',
          '<div class="message-column assistant-column">',
          '<div class="message-role assistant-role">LobsterAI</div>',
        );
        turn.assistantMessages.forEach((message) => {
          blocks.push(renderMarkdownHtml(renderMessageContent(message), 'assistant-message markdown-body'));
        });
        blocks.push('</div>', '</div>');
      }

      blocks.push('</section>');
      return blocks.join('');
    }).join('');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(data.title)}</title>`,
    '<style>',
    '  @page { size: A4; margin: 14mm 12mm; }',
    '  :root { color-scheme: light; }',
    '  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", sans-serif; color: #1A1D23; background: #FFFFFF; }',
    '  .chat-shell { max-width: 48rem; margin: 0 auto; padding: 10px 0 0; }',
    '  .chat-header { padding: 0 16px 16px; }',
    '  .chat-title { font-size: 18px; font-weight: 700; color: #374151; }',
    '  .chat-list { display: flex; flex-direction: column; gap: 4px; }',
    '  .turn { padding: 0 16px; }',
    '  .chat-row { display: flex; align-items: flex-start; }',
    '  .user-row { justify-content: flex-end; }',
    '  .assistant-row { justify-content: flex-start; }',
    '  .message-column { min-width: 0; display: flex; flex-direction: column; }',
    '  .user-column { width: 100%; align-items: flex-end; }',
    '  .assistant-column { width: 100%; align-items: flex-start; padding: 12px 16px; }',
    '  .message-role { margin-bottom: 6px; font-size: 11px; font-weight: 600; color: #6B7280; }',
    '  .assistant-role { margin-bottom: 10px; }',
    '  .user-bubble { width: fit-content; max-width: 42rem; padding: 10px 16px; border-radius: 16px; background: #ECEFF4; color: #1A1D23; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }',
    '  .assistant-message { max-width: 42rem; color: #1A1D23; }',
    '  .markdown-body > :first-child { margin-top: 0; }',
    '  .markdown-body > :last-child { margin-bottom: 0; }',
    '  .markdown-body p { margin: 0 0 0.85em; line-height: 1.7; }',
    '  .markdown-body ul, .markdown-body ol { margin: 0 0 0.85em; padding-left: 1.35em; line-height: 1.7; }',
    '  .markdown-body li + li { margin-top: 0.2em; }',
    '  .markdown-body strong { font-weight: 700; }',
    '  .markdown-body em { font-style: italic; }',
    '  .markdown-body code { font-family: "SF Mono", "Fira Code", Menlo, Monaco, monospace; font-size: 0.92em; background: rgba(15, 23, 42, 0.06); padding: 0.1em 0.35em; border-radius: 6px; }',
    '  .markdown-body pre { margin: 0 0 0.85em; white-space: pre-wrap; word-break: break-word; font-family: "SF Mono", "Fira Code", Menlo, Monaco, monospace; font-size: 13px; line-height: 1.65; background: #F3F4F6; padding: 12px 14px; border-radius: 12px; overflow: hidden; }',
    '  .markdown-body pre code { background: transparent; padding: 0; border-radius: 0; }',
    '  .markdown-body blockquote { margin: 0 0 0.85em; padding-left: 12px; border-left: 3px solid #3B82F6; color: #6B7280; }',
    '  .markdown-body table { width: 100%; border-collapse: collapse; margin: 0 0 0.85em; }',
    '  .markdown-body th, .markdown-body td { border: 1px solid #E5E7EB; padding: 6px 8px; text-align: left; }',
    '  .empty-state { color: #6B7280; font-size: 12px; padding: 0 16px; }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="chat-shell">',
    '<header class="chat-header">',
    `<div class="chat-title">${escapeHtml(data.title)}</div>`,
    '</header>',
    '<section class="chat-list">',
    conversationHtml,
    '</section>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
};
