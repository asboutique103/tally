# Tally - ConstructFlow Enterprise v2.0.1

A React + TypeScript application for construction project management.

## Project Structure

```
src/
├── components/      # Reusable React components
│   ├── Modal.tsx
│   ├── StatCard.tsx
│   ├── EmptyState.tsx
│   └── TransactionItemsEditor.tsx
├── pages/          # Page components
│   ├── Dashboard.tsx
│   ├── Materials.tsx
│   ├── Sites.tsx
│   └── Settings.tsx
├── lib/            # Utility functions and helpers
│   └── helpers.ts
├── store/          # State management
│   └── AppContext.tsx
├── data/           # Data and seed files
│   └── seed.ts
├── types.ts        # TypeScript type definitions
├── App.tsx         # Main application component
├── main.tsx        # Entry point
├── vite-env.d.ts   # Vite environment types
└── styles.css      # Global styles

supabase/
└── migrations/     # Database migrations
    └── 20260703_000001_constructflow_schema.sql
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file in the root directory with your configuration:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Building

```bash
npm run build
```

This creates a production-ready build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Features

- **Dashboard**: View project overview and statistics
- **Materials Management**: Track construction materials
- **Sites Management**: Manage project sites
- **Settings**: Configure application preferences
- **Transaction Editing**: Edit and manage transaction items

## Database

The project uses Supabase for backend services. Database schema is defined in:
```
supabase/migrations/20260703_000001_constructflow_schema.sql
```

## Technologies

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Supabase** - Backend as a Service

## Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make changes and test locally:
   ```bash
   npm run dev
   ```

3. Build and verify:
   ```bash
   npm run build
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin feature/your-feature-name
   ```

## License

TBD
