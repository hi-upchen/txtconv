# txtconv

A web service to convert text files from Simplified Chinese to Traditional Chinese.

## Version 2.0

Built with modern web technologies for better performance and scalability:

- **Next.js 14** with App Router
- **OpenCC** for Chinese text conversion
- **Vercel Blob** for storing each user's custom dictionary (nothing else is written there)
- **TypeScript** for type safety
- **Bulma CSS** for styling

## Features

- Drag-and-drop file upload
- Real-time conversion progress with SSE
- Multiple file processing with sequential downloads
- File validation (25MB limit, blocks non-text files)
- Conversion runs in the browser; uploaded files are never stored on a server
- Character encoding detection

## Getting Started

### Prerequisites

- Node.js 20+
- Vercel Blob token (for custom dictionary storage)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

## Deployment

This application is optimized for deployment on Vercel:

1. Connect your repository to Vercel
2. Add `BLOB_READ_WRITE_TOKEN` to environment variables
3. Deploy

### Blob storage policy

Only `app/api/dictionary/route.ts` may write to Vercel Blob. Uploaded files
used to be archived there, which grew the store to 174 GB of user data. The
test `__tests__/guards/blob-write-guard.test.ts` fails if any other file
imports a Blob write API, so a new write path cannot land unnoticed.

## License

MIT License - see LICENSE file for details
