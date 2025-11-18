# Task Manager Frontend

A React + TypeScript frontend for the Solana Task Manager dApp.

## Features

- Connect Solana wallet (Phantom, Solflare)
- Initialize your personal task list
- Add, complete, and delete tasks
- View all your tasks in a clean interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update the program ID in `src/components/TaskManager.tsx` after deploying your program:
```typescript
const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
```

3. Copy the IDL file to the public directory (already done):
```bash
cp ../anchor_project/target/idl/task_manager.json public/
```

## Development

Run the development server:
```bash
npm run dev
```

## Build

Build for production:
```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment to Vercel, Netlify, or any static hosting service.

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in this directory
3. Follow the prompts

### Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run `netlify deploy` for a draft, or `netlify deploy --prod` for production

## Configuration

The app is configured to use Solana Devnet by default. To change the network, edit `src/App.tsx`:

```typescript
const network = WalletAdapterNetwork.Mainnet; // or Devnet, Testnet
```
