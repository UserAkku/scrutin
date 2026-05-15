# Scrutin 🔍

Scrutin is a web application designed to perform comprehensive Website SEO and Auditing, generating detailed insights using the Google Generative AI (Gemini). It features user authentication, a dashboard to manage audits, real-time website scraping using Puppeteer, and PDF report generation.

## 🌟 Key Features

- **Website Auditing**: Perform in-depth SEO, accessibility, and performance audits.
- **AI-Powered Insights**: Integrates `@google/generative-ai` to generate actionable recommendations based on website audits.
- **Web Scraping**: Built-in website fetching and parsing utilizing `puppeteer` and `node-html-parser`.
- **User Authentication**: Secure signup and login workflows utilizing NextAuth v5 (Beta) and `bcryptjs` with Prisma Adapaters.
- **PDF Generation**: Export robust audit reports to PDF using `@react-pdf/renderer`.
- **Modern Dashboard**: Manage previous website audits comfortably in an authenticated dashboard area.
- **Form Management & Validation**: Type-safe forms built with `react-hook-form` and `zod`.
- **Dark Mode Support**: Themed with `next-themes` and styled beautifully using Tailwind CSS and Radix UI primitives.

## 🛠️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **UI Library**: [React 18](https://react.dev/)
- **Styling**: Tailwind CSS, class-variance-authority, clsx, tailwind-merge
- **Components**: [Radix UI](https://www.radix-ui.com/) (Accordion, Progress, Slot, Switch) + Lucide Icons
- **Database & ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [NextAuth.js v5 Beta](https://authjs.dev/)
- **AI Engine**: Google Gemini API (`@google/generative-ai`)
- **Web Parsing/Scraping**: Puppeteer, node-html-parser
- **PDF Generation**: @react-pdf/renderer

## 📁 Project Structure

```bash
scrutin/
├── app/                  # Next.js App Router Next.js pages
│   ├── (auth)/           # Authentication routes (login, register)
│   ├── (dashboard)/      # Dashboard & history
│   ├── api/              # API endpoints (Gemini, fetching, etc)
│   ├── audit/            # Core auditing logic and UI
│   ├── reset-password/   # Password reset flow
│   └── ...
├── components/           # Reusable UI React components
├── lib/                  # Utility functions
├── prisma/               # Prisma ORM schema and migrations
├── public/               # Static assets
└── types/                # TypeScript definitions
```

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js (v20+) and your preferred package manager (`npm`, `yarn`, or `pnpm`) installed.

### 1. Clone the repository

```bash
git clone git@github.com:UserAkku/scrutin.git
cd scrutin
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Setup Environment Variables

Copy the `.env.example` file to `.env` in the root of the project and update the variables (Database URL, NextAuth secrets, Google Gemini API Key):

```bash
cp .env.example .env
```

```env
DATABASE_URL="your_database_connection_string"
AUTH_SECRET="your_nextauth_secret"
GOOGLE_GEMINI_API_KEY="your_api_key_here"
```

### 4. Setup the Database

Generate the Prisma client and push the schema to your database. Note: A `postinstall` script automatically runs `prisma generate`, but pushing the schema is necessary for the first run:

```bash
npx prisma db push
```

### 5. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 📦 Build for Production

To create an optimized production build:

```bash
npm run build
npm start
```
