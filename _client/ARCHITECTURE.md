## 🚀 Stack

```
"Frontend": [
"React Router V7 + Vite",
"Tailwind CSS + shadcn/ui",
"TanStack Query (data fetching)",
"Zustand (state management)"
"Zod (validation)",
"React Hook Form (forms)",
"ESLint + Prettier"
],
```

## 📁 Project Structure

```
app/
├── components/          # Reusable UI Components
│ ├── ui/                # Base components (shadcn/ui หรือ custom)
│ ├── forms/             # Form controls ที่ใช้ซ้ำ
│ ├── layout/            # Header, Sidebar, Footer
│ └── common/            # Components ที่ไม่ขึ้นกับฟีเจอร์
├── features/ # แบ่งตามฟีเจอร์ (Feature-based Architecture)
│ └── auth/ # Authentication Feature
│   ├── components/ # Components เฉพาะ Auth
│   ├── hooks/ # Custom Hooks สำหรับ Auth
│   ├── services/ # API ของ Auth (Login, Register)
│   ├── stores/ # State Management ของ Auth
│   ├── validations/ # Zod Schemas
│   ├── layout/ # หน้า layout สำหรับ Login
│   ├── pages/ # หน้า Login, Register
│   └── types/
├── hooks/               # Global Custom Hooks (Tanstack Query)
├── lib/                 # Helper functions เช่น date formatter
│ └── utils.ts           # Utility functions
├── services/            # API Service กลาง (axios instance, fetcher)
├── stores/              # State Management (Zustand)
├── styles/              # Global CSS / Tailwind config
├── types/               # TypeScript types (ถ้าใช้ TS)
├── validations/         # Global Zod Schemas (ใช้หลายฟีเจอร์)
├── constants/           # Global constants, Env, constants, global settings
├── root.tsx             # Main app entry (React Router)
└── routes.ts            # Route definitions
```
