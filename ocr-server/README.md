# EnglishSentence OCR Server

Small OCR API for the Apps in Toss web app.

## Local

```bash
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:8787/health
```

OCR endpoint:

```http
POST /api/ocr/english
Content-Type: application/json

{
  "imageDataUri": "data:image/jpeg;base64,..."
}
```

Response:

```json
{
  "text": "I would like to make a reservation."
}
```

## Deploy

Deploy `ocr-server` as a Node web service. On Render, use the root `render.yaml` blueprint or create a Web Service manually:

- Root Directory: `ocr-server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

After deployment, rebuild the `.ait` app with:

```bash
VITE_API_BASE_URL=https://your-ocr-server.example.com npm run ait:build
```
