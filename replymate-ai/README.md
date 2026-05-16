# TupuChat

TupuChat is an Android-ready Expo React Native app that generates smart replies and rewrites messages for WhatsApp, SMS, email, and social messages. The mobile app calls your own Node.js backend, and the backend calls NVIDIA NIM using an OpenAI-compatible API.

```
Expo React Native Android App
        ↓
Node.js Express Backend on Render
        ↓
NVIDIA NIM API
```

The NVIDIA API key is never stored in the mobile app.

## Project Structure

```
replymate-ai/
  mobile/
    app/
    components/
    services/
    storage/
    constants/
    package.json
    eas.json
  backend/
    src/
      index.ts
      routes/
      services/
      schemas/
      utils/
    package.json
    tsconfig.json
    .env.example
    render.yaml
  README.md
```

## Screenshots

Add your screenshots here after running the app:

| Home | History | Favorites | Settings |
| --- | --- | --- | --- |
| `docs/screenshots/home.png` | `docs/screenshots/history.png` | `docs/screenshots/favorites.png` | `docs/screenshots/settings.png` |

## Backend Local Setup

1. Go to the backend folder:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your environment file:

   ```bash
   cp .env.example .env
   ```

4. Optional: add your NVIDIA key in `.env`.

   ```bash
   NVIDIA_API_KEY=your_key_here
   NVIDIA_MODEL=meta/llama-3.1-8b-instruct
   NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
   PORT=4000
   ```

   If `NVIDIA_API_KEY` is empty, the backend returns mock replies so you can develop locally.

5. Start the backend:

   ```bash
   npm run dev
   ```

6. Test health:

   ```bash
   curl http://localhost:4000/health
   ```

## Backend API

### `GET /health`

Returns service status and whether mock mode is active.

### `POST /api/replies/generate`

Request:

```json
{
  "message": "Can we reschedule today's meeting?",
  "tone": "professional"
}
```

Response:

```json
{
  "replies": [
    "Of course, what time works best for you?",
    "Sure, please share a suitable time and I will adjust.",
    "No problem. Let me know your preferred slot.",
    "That works. We can reschedule to a more convenient time.",
    "Absolutely, I am flexible. Please suggest a new time."
  ]
}
```

Allowed tones:

`polite`, `professional`, `funny`, `romantic`, `short`, `Hinglish`, `Hindi`, `English`

## Mobile Local Setup

1. Go to the mobile folder:

   ```bash
   cd mobile
   ```

2. Use Node 22 LTS or Node 20 LTS. This project uses Expo SDK 55, which requires Node `20.19.x` or newer. Node 22 LTS is a good choice.

   ```bash
   nvm use
   ```

   If Node 22 is not installed:

   ```bash
   nvm install 22
   nvm use 22
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start Expo:

   ```bash
   npx expo start
   ```

5. Open the app on Android. The production backend is already built in:

   ```text
   https://myaiapps.onrender.com
   ```

6. Paste a message, choose a tone, and generate replies.

## Install On Android Phone

### Option A: Expo Go

1. Install Expo Go from the Play Store.
2. In the `mobile` folder, run:

   ```bash
   npx expo start
   ```

3. Scan the QR code with Expo Go.
4. The Render backend URL is already built in.

### Option B: Build APK With EAS

1. Install EAS CLI:

   ```bash
   npm install -g eas-cli
   ```

2. Log in:

   ```bash
   eas login
   ```

3. Configure EAS:

   ```bash
   eas build:configure
   ```

4. Build a preview APK:

   ```bash
   eas build -p android --profile preview
   ```

5. Download and install the APK from the EAS build link.

## Deploy Backend To Render Free Tier

1. Push this project to GitHub.
2. Open Render and create a new Web Service.
3. Connect your GitHub repository.
4. Use these settings:

   - Root directory: `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Plan: Free

5. Add environment variables in Render:

   ```text
   NVIDIA_API_KEY=your_nvidia_key
   NVIDIA_MODEL=meta/llama-3.1-8b-instruct
   NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
   ```

   Render provides `PORT` automatically.

6. Deploy.
7. If your Render URL changes, update `DEFAULT_BACKEND_URL` in `mobile/constants/api.ts`.
8. Open TupuChat on your phone.

## NVIDIA NIM Notes

The backend uses:

```text
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
POST /chat/completions
Authorization: Bearer NVIDIA_API_KEY
```

The model is controlled by `NVIDIA_MODEL`, so you can switch to another NVIDIA-hosted OpenAI-compatible chat model without changing mobile code.

## Security

- Do not put `NVIDIA_API_KEY` in the mobile app.
- Do not commit `.env`.
- Store `NVIDIA_API_KEY` only in backend `.env` locally or Render environment variables.
- The mobile app stores only history and favorites in AsyncStorage.

## Troubleshooting

### Android cannot reach local backend

- If using Android emulator, use `http://10.0.2.2:4000`.
- If using a real phone, phone and computer must be on the same Wi-Fi.
- Use your computer IP, for example `http://192.168.1.25:4000`.
- Make sure the backend is running with `npm run dev`.

### Expo says `expo-asset` cannot be found

Run this from the `mobile` folder:

```bash
npm install
```

If it still fails, install the Expo SDK-compatible package directly:

```bash
npx expo install expo-asset
```

### Expo Go says the SDK version is incompatible

This mobile app is configured for Expo SDK 55. Make sure your Expo Go app supports SDK 55, then refresh dependencies:

```bash
cd mobile
nvm use
npm install
npx expo start --clear
```

### Expo fails with `ERR_SOCKET_BAD_PORT` on Node 25

Use Node 22 LTS:

```bash
cd mobile
nvm install 22
nvm use 22
npm install
npx expo start
```

### Render backend is sleeping

Render free services can sleep after inactivity. The first request may take a little longer. Try again after the service wakes up.

### CORS errors

The backend enables CORS for development. If you add stricter CORS later, allow your Expo and production app origins.

### NVIDIA API errors

- Check `NVIDIA_API_KEY` is set in Render.
- Check `NVIDIA_BASE_URL` is `https://integrate.api.nvidia.com/v1`.
- Check `NVIDIA_MODEL` is a model your NVIDIA account can access.
- Look at Render logs for the backend error message.

### Mock replies appear

Mock mode is active when `NVIDIA_API_KEY` is missing. Add the key to `.env` locally or Render environment variables.

## Useful Commands

Backend:

```bash
cd backend
npm run dev
npm run build
npm start
```

Mobile:

```bash
cd mobile
npm install
npx expo start
eas build -p android --profile preview
```
