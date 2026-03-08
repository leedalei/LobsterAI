# LobsterAI Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the lobsterai-portal Vue3 SPA — a C-end web system for users to query credits/quota, view model pricing, and purchase plans/credits.

**Architecture:** Vue3 + Ant Design Vue SPA communicating with Java backend via REST API + JWT auth. Pinia for state, Vue Router with auth guards, Axios with token interceptor. Deployed as static files to CDN/Nginx.

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue 4.x, Pinia, Vue Router 4, Axios, ECharts, Vite, pnpm

---

### Task 1: Project Scaffolding

**Files:**
- Create: `lobsterai-portal/package.json`
- Create: `lobsterai-portal/vite.config.ts`
- Create: `lobsterai-portal/tsconfig.json`
- Create: `lobsterai-portal/tsconfig.node.json`
- Create: `lobsterai-portal/index.html`
- Create: `lobsterai-portal/src/main.ts`
- Create: `lobsterai-portal/src/App.vue`
- Create: `lobsterai-portal/src/env.d.ts`
- Create: `lobsterai-portal/.env`
- Create: `lobsterai-portal/.env.production`
- Create: `lobsterai-portal/.gitignore`

**Step 1: Create project directory and initialize**

```bash
mkdir -p /Users/admin/work/all_in_ai/lobsterai-portal
cd /Users/admin/work/all_in_ai/lobsterai-portal
git init
```

**Step 2: Create package.json**

```json
{
  "name": "lobsterai-portal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.vue"
  },
  "dependencies": {
    "ant-design-vue": "^4.2.0",
    "axios": "^1.7.0",
    "echarts": "^5.5.0",
    "pinia": "^2.2.0",
    "vue": "^3.5.0",
    "vue-echarts": "^7.0.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vue-tsc": "^2.1.0"
  }
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 4: Create tsconfig.json, index.html, env.d.ts, .env files, .gitignore**

- `tsconfig.json`: Standard Vue3 config with `@` path alias
- `index.html`: Entry HTML loading `src/main.ts`
- `.env`: `VITE_API_BASE_URL=http://localhost:8080`
- `.env.production`: `VITE_API_BASE_URL=https://api.lobsterai.com`
- `.gitignore`: node_modules, dist, .env.local

**Step 5: Create src/main.ts and src/App.vue**

`src/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(Antd);
app.mount('#app');
```

`src/App.vue`:
```vue
<template>
  <router-view />
</template>
```

**Step 6: Install dependencies and verify dev server starts**

```bash
cd /Users/admin/work/all_in_ai/lobsterai-portal
pnpm install
pnpm dev
```
Expected: Vite dev server starts on port 5180, blank page loads.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold lobsterai-portal project"
```

---

### Task 2: Axios Request Layer with JWT Interceptor

**Files:**
- Create: `src/api/request.ts`
- Create: `src/utils/token.ts`

**Step 1: Create token utility**

`src/utils/token.ts`:
```typescript
const TOKEN_KEY = 'lobsterai_token';
const REFRESH_TOKEN_KEY = 'lobsterai_refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
```

**Step 2: Create Axios instance with interceptors**

`src/api/request.ts`:
```typescript
import axios from 'axios';
import { getToken, setToken, getRefreshToken, clearTokens } from '@/utils/token';
import router from '@/router';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

// Request interceptor: attach JWT
request.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

request.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(request(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
          { refreshToken }
        );
        setToken(data.accessToken);
        pendingRequests.forEach((cb) => cb(data.accessToken));
        pendingRequests = [];
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return request(originalRequest);
      } catch {
        clearTokens();
        router.push('/login');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default request;
```

**Step 3: Commit**

```bash
git add src/api/request.ts src/utils/token.ts
git commit -m "feat: add Axios instance with JWT interceptor and token utils"
```

---

### Task 3: Pinia Stores (auth + user)

**Files:**
- Create: `src/stores/auth.ts`
- Create: `src/stores/user.ts`

**Step 1: Create auth store**

`src/stores/auth.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getToken, setToken, setRefreshToken, clearTokens } from '@/utils/token';
import request from '@/api/request';

export interface UserProfile {
  id: number;
  phone: string;
  nickname: string;
  avatarUrl: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  const isLoggedIn = computed(() => !!getToken());

  async function fetchProfile() {
    const { data } = await request.get('/api/user/profile');
    user.value = data;
  }

  function handleLoginCallback(accessToken: string, refreshToken: string) {
    setToken(accessToken);
    setRefreshToken(refreshToken);
  }

  function logout() {
    clearTokens();
    user.value = null;
  }

  return { user, isLoggedIn, fetchProfile, handleLoginCallback, logout };
});
```

**Step 2: Create user store**

`src/stores/user.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/api/request';

export interface PlanInfo {
  name: string;
  quotaCredits: number;
  usedCredits: number;
  endDate: string;
}

export interface DailyUsage {
  date: string;
  credits: number;
}

export interface CreditsSummary {
  balance: number;
  plan: PlanInfo | null;
  recentUsage: DailyUsage[];
}

export const useUserStore = defineStore('user', () => {
  const summary = ref<CreditsSummary | null>(null);

  async function fetchCreditsSummary() {
    const { data } = await request.get('/api/user/credits/summary');
    summary.value = data;
  }

  return { summary, fetchCreditsSummary };
});
```

**Step 3: Commit**

```bash
git add src/stores/
git commit -m "feat: add auth and user Pinia stores"
```

---

### Task 4: Router with Auth Guard

**Files:**
- Create: `src/router/index.ts`

**Step 1: Create router**

`src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/utils/token';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/Layout.vue'),
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
        },
        {
          path: 'pricing',
          name: 'Pricing',
          component: () => import('@/views/Pricing.vue'),
          meta: { public: true },
        },
        {
          path: 'recharge',
          name: 'Recharge',
          component: () => import('@/views/Recharge.vue'),
        },
        {
          path: 'usage',
          name: 'Usage',
          component: () => import('@/views/Usage.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (!getToken()) return { path: '/login', query: { redirect: to.fullPath } };
  return true;
});

export default router;
```

**Step 2: Commit**

```bash
git add src/router/
git commit -m "feat: add Vue Router with auth guard"
```

---

### Task 5: Layout Component (Top Navigation)

**Files:**
- Create: `src/components/Layout.vue`

**Step 1: Create Layout with top navigation bar**

`src/components/Layout.vue` — Ant Design Vue `a-layout` with:
- Header: Logo, navigation links (首页, 模型定价, 充值), user avatar dropdown (消费明细, 退出登录)
- Content: `<router-view />`
- Navigation highlights active route
- User dropdown calls `authStore.logout()` + redirect to `/login`
- Responsive: menu collapses to hamburger on mobile

**Step 2: Create placeholder views**

Create minimal `<template><div>Page Name</div></template>` for:
- `src/views/Login.vue`
- `src/views/Dashboard.vue`
- `src/views/Pricing.vue`
- `src/views/Recharge.vue`
- `src/views/Usage.vue`

**Step 3: Verify routing works**

```bash
pnpm dev
```
Expected: Nav bar renders, clicking links navigates between placeholder pages.

**Step 4: Commit**

```bash
git add src/components/Layout.vue src/views/
git commit -m "feat: add layout with top navigation and placeholder views"
```

---

### Task 6: API Modules

**Files:**
- Create: `src/api/auth.ts`
- Create: `src/api/user.ts`
- Create: `src/api/models.ts`
- Create: `src/api/orders.ts`

**Step 1: Create API modules**

`src/api/auth.ts`:
```typescript
import request from './request';

export function getLoginUrl() {
  return request.get<{ url: string }>('/api/auth/login');
}

export function refreshToken(refreshToken: string) {
  return request.post('/api/auth/refresh', { refreshToken });
}

export function logout() {
  return request.post('/api/auth/logout');
}
```

`src/api/user.ts`:
```typescript
import request from './request';

export function getProfile() {
  return request.get('/api/user/profile');
}

export function getCreditsSummary() {
  return request.get('/api/user/credits/summary');
}

export function getUsageList(params: {
  page: number;
  pageSize: number;
  model?: string;
  startDate?: string;
  endDate?: string;
}) {
  return request.get('/api/user/usage', { params });
}
```

`src/api/models.ts`:
```typescript
import request from './request';

export function getModelPricing(provider?: string) {
  return request.get('/api/models/pricing', {
    params: provider ? { provider } : undefined,
  });
}
```

`src/api/orders.ts`:
```typescript
import request from './request';

export function getPlans() {
  return request.get('/api/plans');
}

export function createOrder(data: {
  productType: 'plan' | 'credits';
  productId: number;
}) {
  return request.post('/api/orders/create', data);
}

export function payWithWechat(orderNo: string) {
  return request.post('/api/orders/pay/wechat', { orderNo });
}

export function payWithAlipay(orderNo: string) {
  return request.post('/api/orders/pay/alipay', { orderNo });
}
```

**Step 2: Commit**

```bash
git add src/api/
git commit -m "feat: add API modules for auth, user, models, and orders"
```

---

### Task 7: Login Page

**Files:**
- Modify: `src/views/Login.vue`

**Step 1: Implement Login.vue**

- Logo + app name centered
- "使用网易账号登录" button — calls `getLoginUrl()`, redirects to URS OAuth
- OAuth callback handling: parse `token` and `refreshToken` from URL query params after redirect
- On success: `authStore.handleLoginCallback()`, then redirect to `query.redirect` or `/dashboard`
- Already logged in: auto-redirect to `/dashboard`

**Step 2: Verify login flow with mock**

Visit `/login`, verify button renders and redirect logic works with a mock token in URL.

**Step 3: Commit**

```bash
git add src/views/Login.vue
git commit -m "feat: implement login page with OAuth redirect flow"
```

---

### Task 8: Credits Calculation Utility

**Files:**
- Create: `src/utils/credits.ts`

**Step 1: Create credits utility**

```typescript
/**
 * Calculate credits consumed for a single API call.
 *
 * Formula: (inputTokens × modelRate) + (outputTokens × modelRate × completionRate)
 *
 * Where: 1 USD = 500,000 credits.
 * modelRate = credits per 1 token (input).
 * completionRate = output price / input price ratio.
 */
export function calculateCredits(
  inputTokens: number,
  outputTokens: number,
  modelRate: number,
  completionRate: number
): number {
  return inputTokens * modelRate + outputTokens * modelRate * completionRate;
}

/**
 * Format credits number with comma separators.
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString('zh-CN');
}

/**
 * Calculate per-1k-token cost in credits.
 */
export function creditsPer1k(modelRate: number, completionRate?: number): number {
  const rate = completionRate ? modelRate * completionRate : modelRate;
  return Math.round(rate * 1000 * 10000) / 10000;
}
```

**Step 2: Commit**

```bash
git add src/utils/credits.ts
git commit -m "feat: add credits calculation utility"
```

---

### Task 9: Dashboard Page

**Files:**
- Modify: `src/views/Dashboard.vue`
- Create: `src/components/CreditCard.vue`
- Create: `src/components/PlanCard.vue`
- Create: `src/components/UsageTrend.vue`

**Step 1: Create CreditCard component**

Ant Design Vue `a-card` displaying:
- Title: "积分余额"
- Large number: formatted balance
- "充值" button linking to `/recharge`

**Step 2: Create PlanCard component**

Ant Design Vue `a-card` displaying:
- Plan name badge (Lite/Pro or "无套餐")
- Progress bar: usedCredits / quotaCredits
- Expiry date
- "升级" or "购买套餐" button linking to `/recharge`

**Step 3: Create UsageTrend component**

ECharts bar chart via `vue-echarts`:
- X-axis: recent 7 days
- Y-axis: daily credits consumed
- Data from `summary.recentUsage`

**Step 4: Implement Dashboard.vue**

- On mount: call `userStore.fetchCreditsSummary()`
- Layout: `a-row` with `a-col` grid
  - Row 1: PlanCard (span 12) + CreditCard (span 12)
  - Row 2: UsageTrend (span 24)
  - Row 3: Quick links — 模型定价, 消费明细

**Step 5: Verify with mock data**

Start dev server, navigate to `/dashboard`, verify cards and chart render with mock/empty state.

**Step 6: Commit**

```bash
git add src/views/Dashboard.vue src/components/CreditCard.vue src/components/PlanCard.vue src/components/UsageTrend.vue
git commit -m "feat: implement dashboard with credits, plan cards and usage trend"
```

---

### Task 10: Pricing Page

**Files:**
- Modify: `src/views/Pricing.vue`

**Step 1: Implement Pricing.vue**

- On mount: call `getModelPricing()`
- Provider filter: `a-select` with all providers, "全部" default
- Table columns (`a-table`):
  - 模型名称 (modelName)
  - 厂商 (provider) — with tag/badge
  - 模型倍率 (modelRate)
  - 补全倍率 (completionRate)
  - 输入 / 千 tokens (computed: modelRate × 1000)
  - 输出 / 千 tokens (computed: modelRate × completionRate × 1000)
- No login required (public page)

**Step 2: Verify with mock data**

**Step 3: Commit**

```bash
git add src/views/Pricing.vue
git commit -m "feat: implement model pricing page with provider filter"
```

---

### Task 11: Recharge Page

**Files:**
- Modify: `src/views/Recharge.vue`

**Step 1: Implement Recharge.vue**

- On mount: call `getPlans()` to load available plans
- **Plan section**: Card grid showing Lite / Pro plans
  - Monthly / yearly toggle (`a-segmented`)
  - Price, quota credits, allowed models list
  - "订阅" button
- **Credits pack section**: Card grid with credit packs (e.g. 1000/5000/20000 积分)
  - Price per pack
  - "购买" button
- On purchase click:
  1. Call `createOrder({ productType, productId })`
  2. Show payment method selector (微信 / 支付宝)
  3. Call `payWithWechat(orderNo)` or `payWithAlipay(orderNo)`
  4. Handle redirect to payment or display QR code

**Step 2: Verify layout and button interactions**

**Step 3: Commit**

```bash
git add src/views/Recharge.vue
git commit -m "feat: implement recharge page with plan and credits pack purchase"
```

---

### Task 12: Usage Page

**Files:**
- Modify: `src/views/Usage.vue`

**Step 1: Implement Usage.vue**

- Filter bar: date range picker (`a-range-picker`) + model select (`a-select`)
- Table (`a-table` with pagination):
  - 时间 (createdAt)
  - 模型 (model)
  - 输入 Tokens (inputTokens)
  - 输出 Tokens (outputTokens)
  - 消耗积分 (costCredits) — formatted
  - 扣费来源 (source) — tag: 套餐/积分
- Server-side pagination: page, pageSize params
- On filter change: reload data

**Step 2: Verify table rendering and pagination**

**Step 3: Commit**

```bash
git add src/views/Usage.vue
git commit -m "feat: implement usage history page with filters and pagination"
```

---

### Task 13: Mock API for Development

**Files:**
- Create: `src/api/mock.ts`
- Modify: `vite.config.ts` (add mock plugin or manual mock setup)

**Step 1: Create mock data**

`src/api/mock.ts` — export mock response data for all API endpoints:
- Mock model pricing list (5-8 popular models with real rates)
- Mock credits summary (balance, plan info, 7-day usage)
- Mock usage list (20 records with varied models)
- Mock plans list (Lite, Pro)

**Step 2: Wire mock into dev mode**

Use Axios interceptor in dev mode or `vite-plugin-mock` to return mock data when backend is unavailable.

**Step 3: Full end-to-end verification**

```bash
pnpm dev
```
Navigate through all pages, verify:
- Dashboard: cards + chart render
- Pricing: table with filter
- Recharge: plan cards + purchase flow
- Usage: table with pagination + filters

**Step 4: Commit**

```bash
git add src/api/mock.ts vite.config.ts
git commit -m "feat: add mock API data for development"
```

---

### Task 14: Responsive Design and Polish

**Files:**
- Modify: `src/components/Layout.vue`
- Modify: `src/views/Dashboard.vue`
- Modify: all views as needed

**Step 1: Mobile responsive adjustments**

- Layout: hamburger menu on `< 768px`
- Dashboard: stack cards vertically on mobile
- Tables: horizontal scroll on small screens
- Recharge: single column card layout on mobile

**Step 2: Visual polish**

- Loading states: `a-spin` on data fetch
- Empty states: `a-empty` when no data
- Error handling: `a-message.error()` on API failure

**Step 3: Verify on mobile viewport**

Use browser dev tools to check 375px, 768px, 1024px viewports.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add responsive design and loading/error states"
```

---

### Task 15: Build and Deployment Config

**Files:**
- Create: `nginx.conf` (reference)
- Modify: `package.json` (verify build script)

**Step 1: Verify production build**

```bash
pnpm build
```
Expected: `dist/` folder with index.html + static assets.

**Step 2: Create Nginx config reference**

```nginx
server {
    listen 80;
    server_name portal.lobsterai.com;
    root /var/www/lobsterai-portal/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Step 3: Commit**

```bash
git add nginx.conf
git commit -m "chore: add nginx deployment config reference"
```
