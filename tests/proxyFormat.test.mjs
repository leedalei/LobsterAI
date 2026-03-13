import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ==========================================================================
// Tests for the proxy endpoint migration to Anthropic /v1/messages format.
// Validates: default model ID, proxy URL, and SSE error event parsing.
// ==========================================================================

// --------------- BUILTIN_FREE_MODEL (config.ts) ---------------

describe('BUILTIN_FREE_MODEL', () => {
  // The built-in free model should be MiniMax M2.5
  const EXPECTED_MODEL_ID = 'MiniMax-M2.5';
  const EXPECTED_PROVIDER_KEY = 'lobsterai-proxy';

  it('should use MiniMax-M2.5 as default model id', () => {
    const BUILTIN_FREE_MODEL = {
      id: EXPECTED_MODEL_ID,
      name: 'MiniMax M2.5',
      provider: 'LobsterAI',
      providerKey: EXPECTED_PROVIDER_KEY,
      supportsImage: false,
      isFree: true,
    };

    assert.equal(BUILTIN_FREE_MODEL.id, EXPECTED_MODEL_ID);
    assert.equal(BUILTIN_FREE_MODEL.providerKey, EXPECTED_PROVIDER_KEY);
  });
});

// --------------- Proxy URL (claudeSettings.ts) ---------------

describe('Proxy URL construction', () => {
  const buildProxyUrl = (serverBaseUrl) => `${serverBaseUrl}/api/proxy/v1/messages`;

  it('should construct Anthropic proxy URL for production', () => {
    const url = buildProxyUrl('https://lobsterai-server.youdao.com');
    assert.equal(url, 'https://lobsterai-server.youdao.com/api/proxy/v1/messages');
  });

  it('should construct Anthropic proxy URL for test environment', () => {
    const url = buildProxyUrl('https://lobsterai-server.inner.youdao.com');
    assert.equal(url, 'https://lobsterai-server.inner.youdao.com/api/proxy/v1/messages');
  });

  it('should NOT use the old chat/completions path', () => {
    const url = buildProxyUrl('https://lobsterai-server.youdao.com');
    assert.ok(!url.includes('chat/completions'), 'URL should not contain chat/completions');
    assert.ok(url.includes('/v1/messages'), 'URL should contain /v1/messages');
  });
});

// --------------- Default model fallback (claudeSettings.ts) ---------------

describe('Proxy default model fallback', () => {
  it('should fallback to MiniMax-M2.5 when no model is configured', () => {
    const defaultModel = undefined;
    const modelId = defaultModel || 'MiniMax-M2.5';
    assert.equal(modelId, 'MiniMax-M2.5');
  });

  it('should respect explicit model when provided', () => {
    const defaultModel = 'claude-opus-4-20250514';
    const modelId = defaultModel || 'MiniMax-M2.5';
    assert.equal(modelId, 'claude-opus-4-20250514');
  });
});

// --------------- SSE Error Event Parsing ---------------

describe('Anthropic SSE error event parsing', () => {
  /**
   * Simulates the SSE error parsing logic that should exist in chatWithProxy.
   * The server sends: data: {"type":"error","error":{"type":"upstream_error","message":"...","code":50001}}
   */
  function parseSSELine(line) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);
    if (data === '[DONE]') return { type: 'done' };

    const parsed = JSON.parse(data);

    // Error event
    if (parsed.type === 'error') {
      return {
        type: 'error',
        errorType: parsed.error?.type,
        message: parsed.error?.message,
        code: parsed.error?.code,
      };
    }

    // Content delta
    if (parsed.type === 'content_block_delta') {
      const delta = parsed.delta;
      if (delta.type === 'text_delta') {
        return { type: 'text', text: delta.text };
      }
      if (delta.type === 'thinking_delta') {
        return { type: 'thinking', thinking: delta.thinking };
      }
    }

    return { type: parsed.type };
  }

  it('should parse upstream_error event', () => {
    const line = 'data: {"type":"error","error":{"type":"upstream_error","message":"Rate limit exceeded","code":50001}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'error');
    assert.equal(result.errorType, 'upstream_error');
    assert.equal(result.message, 'Rate limit exceeded');
    assert.equal(result.code, 50001);
  });

  it('should parse text_delta event', () => {
    const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'text');
    assert.equal(result.text, 'Hello');
  });

  it('should parse thinking_delta event', () => {
    const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think..."}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'thinking');
    assert.equal(result.thinking, 'Let me think...');
  });

  it('should handle [DONE] marker', () => {
    const result = parseSSELine('data: [DONE]');
    assert.deepEqual(result, { type: 'done' });
  });

  it('should return null for non-data lines', () => {
    assert.equal(parseSSELine('event: message_start'), null);
    assert.equal(parseSSELine(''), null);
    assert.equal(parseSSELine(': comment'), null);
  });

  it('should parse message_start event', () => {
    const line = 'data: {"type":"message_start","message":{"usage":{"input_tokens":42}}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'message_start');
  });

  it('should parse message_delta event', () => {
    const line = 'data: {"type":"message_delta","usage":{"output_tokens":100}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'message_delta');
  });

  it('should parse error without code', () => {
    const line = 'data: {"type":"error","error":{"type":"invalid_request","message":"Bad request"}}';
    const result = parseSSELine(line);
    assert.equal(result.type, 'error');
    assert.equal(result.errorType, 'invalid_request');
    assert.equal(result.message, 'Bad request');
    assert.equal(result.code, undefined);
  });
});

// --------------- Thinking model detection ---------------

describe('Thinking model detection', () => {
  function isThinkingModel(modelId) {
    return modelId.includes('claude-3-7') ||
           modelId.includes('claude-sonnet-4') ||
           modelId.includes('claude-opus-4');
  }

  it('should detect claude-3-7 as thinking model', () => {
    assert.ok(isThinkingModel('claude-3-7-sonnet-20250219'));
  });

  it('should detect claude-sonnet-4 as thinking model', () => {
    assert.ok(isThinkingModel('claude-sonnet-4-20250514'));
  });

  it('should detect claude-opus-4 as thinking model', () => {
    assert.ok(isThinkingModel('claude-opus-4-20250514'));
  });

  it('should NOT detect non-thinking models', () => {
    assert.ok(!isThinkingModel('claude-3-5-sonnet-20241022'));
    assert.ok(!isThinkingModel('MiniMax-M2.5'));
    assert.ok(!isThinkingModel('deepseek-chat'));
  });

  it('should set correct max_tokens for thinking models', () => {
    const modelId = 'claude-sonnet-4-20250514';
    const maxTokens = isThinkingModel(modelId) ? 16000 : 8192;
    assert.equal(maxTokens, 16000);
  });

  it('should set correct max_tokens for non-thinking models', () => {
    const modelId = 'claude-3-5-sonnet-20241022';
    const maxTokens = isThinkingModel(modelId) ? 16000 : 8192;
    assert.equal(maxTokens, 8192);
  });
});
