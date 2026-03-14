# Multi-Model Proxy & Free Models API

**Date:** 2026-03-13
**Server Branch:** main

## 1. Change Summary

lobsterai-server 代理层从单模型改为多模型架构：

- **`POST /api/proxy/v1/messages`** 不再由服务端硬编码模型，改为客户端通过 `model` 字段指定目标模型，服务端匹配配置后路由到对应上游 API。
- **新增 `GET /api/models/free`**（无需鉴权）返回当前可用的免费模型 ID 列表。
- **新增错误码 `MODEL_NOT_SUPPORTED`（40300）** 当客户端指定了不支持的模型时返回。

## 2. Endpoint Details

### 2.1 获取免费模型列表（新增）

```
GET /api/models/free
```

**Auth:** 无需鉴权

**Response:**

```json
{
  "code": 0,
  "message": "success",
  "data": ["MiniMax-M2.5", "glm-4.7"]
}
```

`data` 为字符串数组，每个元素是一个可用的免费模型 ID。列表由服务端 Overmind 动态配置控制，可能随时变化。

### 2.2 代理聊天（Breaking Change）

```
POST /api/proxy/v1/messages
```

**Auth:** JWT Bearer（`Authorization: Bearer <accessToken>`）

**Request Body（变更点）：**

`model` 字段**必须**由客户端提供，且值必须是 `/api/models/free` 返回的模型 ID 之一。服务端不再使用默认模型。

```json
{
  "model": "MiniMax-M2.5",
  "max_tokens": 8192,
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

**Success Response:** SSE stream（与之前格式一致）

**Error Responses（SSE event type = `error`）：**

未提供 `model` 或模型不支持时：

```
event: error
data: {"type":"error","error":{"type":"proxy_error","message":"不支持的模型: unknown-model，可用模型: [MiniMax-M2.5, glm-4.7]","code":40300}}
```

额度用尽（与之前一致）：

```
event: error
data: {"type":"error","error":{"type":"proxy_error","message":"今日免费额度已用完","code":40200}}
```

## 3. Frontend Action Items

### 3.1 启动/初始化时拉取免费模型列表

客户端应在启动时（或模型选择面板打开时）调用 `GET /api/models/free` 获取可用模型列表，用于：
- 渲染模型选择 UI
- 校验用户选择的模型是否有效

该接口无需登录即可调用，可在鉴权流程完成前预加载。

建议定期刷新（如每次打开模型选择器时重新拉取），因服务端可能动态增减模型。

### 3.2 发送聊天请求时携带 model 字段

之前客户端可能不传 `model` 或传任意值（服务端会覆盖为配置模型）。**现在 `model` 是必填字段**，必须是服务端支持的模型 ID。

```typescript
// Before (服务端会覆盖 model)
const body = {
  messages: [...],
  max_tokens: 8192
};

// After (客户端必须指定 model)
const body = {
  model: selectedModelId,  // e.g. "MiniMax-M2.5"
  messages: [...],
  max_tokens: 8192
};
```

### 3.3 处理 MODEL_NOT_SUPPORTED 错误

在 SSE error 事件处理中增加对 code `40300` 的识别：

```typescript
if (errorCode === 40300) {
  // 模型不支持，提示用户重新选择模型
  // error message 中包含可用模型列表
}
```

建议在收到此错误时自动刷新模型列表（可能服务端已下线了某个模型）。

## 4. Auth Requirements

| Endpoint | Auth |
|----------|------|
| `GET /api/models/free` | 无需鉴权 |
| `POST /api/proxy/v1/messages` | JWT Bearer（不变） |

## 5. Notes & Caveats

- **Breaking Change:** `POST /api/proxy/v1/messages` 不再接受缺少 `model` 或不支持的模型，会返回 40300 错误。客户端必须在此次更新后携带有效的 `model` 字段。
- 多模型共享同一个 `daily_free_credits` 额度池，不按模型分别计算。
- 不同模型有各自的积分消耗倍率（`model_multiplier` / `completion_multiplier`），但这对客户端透明，客户端只需关心总剩余额度（`GET /api/user/quota`）。
- 模型列表是动态的，由服务端 Overmind 配置中心管理，可能随时增减模型，客户端不应硬编码模型 ID。
