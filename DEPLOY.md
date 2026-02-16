# AI Agora — Cloudflare Pages + Railway 배포 가이드

## 1단계: GitHub 리포 생성

```bash
# 프로젝트 디렉토리에서
git init
git add .
git commit -m "feat: initial AI Agora full-stack application"
git remote add origin https://github.com/<your-username>/ai-agora.git
git branch -M main
git push -u origin main
```

## 2단계: Railway 백엔드 배포

1. [railway.app](https://railway.app) 로그인 (GitHub 계정 연동)
2. **New Project** → **Deploy from GitHub repo** → `ai-agora` 선택
3. **Settings** 탭에서:
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm start`
4. **Variables** 탭에서 환경변수 추가:
   - `GEMINI_API_KEY` = 실제 API 키
   - `JWT_SECRET` = 랜덤 문자열 (32자 이상)
   - `CORS_ORIGIN` = `https://ai-agora.pages.dev` (Cloudflare Pages URL)
   - `PORT` = `3001` (Railway가 자동으로 설정)
5. 배포 후 Railway URL 복사 (예: `https://ai-agora-production.up.railway.app`)

## 3단계: Cloudflare Pages 프론트엔드 배포

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. **Connect to Git** → GitHub 연동 → `ai-agora` 리포 선택
3. **Build settings**:
   - **Framework preset**: `None`
   - **Build command**: `npm run build:client`
   - **Build output directory**: `dist/client`
4. **Environment variables** 추가:
   - `VITE_API_URL` = Railway 백엔드 URL (예: `https://ai-agora-production.up.railway.app`)
5. **Save and Deploy** 클릭

## 또는: GitHub Actions 자동 배포 (선택)

GitHub Actions로 자동 배포하려면:

1. **Cloudflare 대시보드** → **API Tokens** → **Create Token**
   - Permissions: `Cloudflare Pages: Edit`
   - Account ID 복사
2. **GitHub repo** → **Settings** → **Secrets** → 추가:
   - `CLOUDFLARE_API_TOKEN` = Cloudflare API 토큰
   - `CLOUDFLARE_ACCOUNT_ID` = Cloudflare Account ID
   - `VITE_API_URL` = Railway 백엔드 URL

이후 `main` 브랜치에 push하면 자동으로 배포됩니다.

## 환경변수 정리

| 변수 | 위치 | 값 |
|------|------|-----|
| `GEMINI_API_KEY` | Railway | Gemini API 키 |
| `JWT_SECRET` | Railway | 랜덤 비밀키 |
| `CORS_ORIGIN` | Railway | Cloudflare Pages URL |
| `VITE_API_URL` | Cloudflare Pages / GitHub Secrets | Railway 백엔드 URL |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Cloudflare API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | Cloudflare Account ID |
