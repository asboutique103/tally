## 🚀 Quick Start Guide

Your project is now ready to use! Follow these steps:

### 1. **Clone the repository**
```bash
git clone https://github.com/asboutique103/tally.git
cd tally
```

### 2. **Set up environment variables**
```bash
# Copy the example env file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key
```

### 3. **Install dependencies**
```bash
npm install
```

### 4. **Start development server**
```bash
npm run dev
```
Your app will run at: `http://localhost:5173`

### 5. **Build for production**
```bash
npm run build
```

---

## 📁 Project Structure

```
tally/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Modal.tsx
│   │   ├── StatCard.tsx
│   │   ├── EmptyState.tsx
│   │   └── TransactionItemsEditor.tsx
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Materials.tsx
│   │   ├── Sites.tsx
│   │   └── Settings.tsx
│   ├── lib/                 # Utilities & helpers
│   │   └── helpers.ts
│   ├── store/               # State management
│   │   └── AppContext.tsx
│   ├── data/                # Seed data
│   │   └── seed.ts
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   ├── types.ts             # TypeScript types
│   └── styles.css           # Global styles
├── supabase/
│   └── migrations/          # Database schema
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## 🛠️ Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 📚 Key Features

✅ **Dashboard** - View project overview and key metrics
✅ **Materials Management** - Track construction materials
✅ **Sites Management** - Manage project locations
✅ **Settings** - Application configuration
✅ **Transaction Editor** - Edit and manage transaction items

---

## 🔧 Tech Stack

- **React 18** - Modern UI framework
- **TypeScript** - Type-safe code
- **Vite** - Lightning-fast build tool
- **Supabase** - Backend & Database
- **CSS** - Styling

---

## 📝 Next Steps

1. **Explore the code** - Review components in `src/`
2. **Check the database** - Review migrations in `supabase/migrations/`
3. **Configure Supabase** - Set up your database connection in `.env.local`
4. **Start developing** - Begin building your features!

---

## 💡 Need Help?

- Check `README.md` for full documentation
- Review component files to understand the structure
- Look at `.env.example` for configuration options

**Happy coding! 🎉**
