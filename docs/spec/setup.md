# 프로젝트 셋업 스펙

## 빌드 도구: electron-vite

https://electron-vite.org

main / preload / renderer 각각 Vite로 번들. HMR + TypeScript 기본 지원.

---

## 프로젝트 초기화

```bash
npm create @quick-start/electron@latest NAtlas
# 선택: React + TypeScript
cd NAtlas
npm install
```

---

## 의존성 목록

### 프로덕션 의존성

```bash
# UI
npm install @radix-ui/react-icons lucide-react
npm install tailwindcss @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge

# 상태 관리
npm install @tanstack/react-query
npm install zustand

# 유틸
npm install electron-updater   # Phase 3
```

### 개발 의존성 (이미 포함됨)

```bash
# electron-vite 템플릿에 포함
electron
electron-builder
@electron-toolkit/preload
@electron-toolkit/utils
vite
@vitejs/plugin-react
typescript
```

### Shadcn/ui 초기화

```bash
npx shadcn init
# ✔ Style: Default
# ✔ Base color: Slate
# ✔ CSS variables: Yes
```

Phase 1에서 사용할 컴포넌트:
```bash
npx shadcn add button
npx shadcn add input
npx shadcn add table
npx shadcn add badge
npx shadcn add scroll-area
npx shadcn add separator
npx shadcn add tooltip
```

### Python 의존성 (`src/python/requirements.txt`)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
```

---

## 최종 파일 구조 (electron-vite 기준)

```
NAtlas/
├── src/
│   ├── main/                        # Electron main process
│   │   └── index.ts                 # BrowserWindow + sidecar + IPC
│   │
│   ├── preload/                      # contextBridge 노출
│   │   └── index.ts                 # window.electron API 정의
│   │
│   └── renderer/                    # React 앱
│       ├── index.html
│       └── src/
│           ├── main.tsx             # React 진입점
│           ├── App.tsx              # 탭 라우팅 + Layout
│           ├── store/
│           │   └── ui.ts            # Zustand store
│           ├── pages/
│           │   ├── Documents.tsx
│           │   ├── Update.tsx
│           │   └── Settings.tsx
│           ├── components/
│           │   ├── ui/              # Shadcn/ui (자동 생성)
│           │   ├── Layout.tsx       # 사이드바 + 탭 레이아웃
│           │   ├── StatusBadge.tsx
│           │   └── LogViewer.tsx
│           └── lib/
│               ├── api.ts           # FastAPI 호출 함수
│               └── utils.ts         # cn() 유틸 (Shadcn)
│
├── src/python/
│   ├── main.py
│   ├── routers/
│   │   ├── documents.py
│   │   ├── graphify.py
│   │   └── settings.py
│   └── requirements.txt
│
├── electron.vite.config.ts          # electron-vite 설정
├── electron-builder.yml             # 패키징 설정
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json               # main/preload용
├── tsconfig.web.json                # renderer용
└── package.json
```

---

## package.json scripts

```json
{
  "scripts": {
    "dev":       "electron-vite dev",
    "build":     "electron-vite build",
    "preview":   "electron-vite preview",
    "build:mac": "npm run build && electron-builder --mac",
    "build:win": "npm run build && electron-builder --win"
  }
}
```

---

## electron.vite.config.ts

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

---

## electron-builder.yml

```yaml
appId: com.nsoftamerica.natlas
productName: NAtlas
directories:
  buildResources: assets
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.*'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
asarUnpack:
  - resources/**
mac:
  target:
    - dmg
  icon: assets/icon.icns
win:
  target:
    - nsis
  icon: assets/icon.ico
```

---

## preload/index.ts (contextBridge)

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// IPC 채널 목록 (main/index.ts와 반드시 일치)
const IPC = {
  OPEN_FOLDER_DIALOG: 'open-folder-dialog',
} as const

contextBridge.exposeInMainWorld('electron', {
  ...electronAPI,
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.OPEN_FOLDER_DIALOG),
})
```

## main/index.ts IPC 핸들러

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'

ipcMain.handle('open-folder-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return canceled ? null : filePaths[0]
})
```

## renderer에서 IPC 호출

```typescript
// window.electron은 preload에서 contextBridge로 노출됨
const path = await window.electron.openFolderDialog()
```

---

## 타입 선언 (`src/renderer/src/env.d.ts`)

```typescript
interface Window {
  electron: {
    openFolderDialog: () => Promise<string | null>
  }
}
```
