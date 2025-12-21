# SHYNOTE

SHYNOTE is a lightweight, web-based markdown note-taking application designed to provide an Obsidian-like experience. It features a folder-based hierarchy, split-view editing, and a clean, distraction-free interface with a beautiful Nord-themed dark mode.

## Key Features

### 1. Immersive Writing Environment
- **Flexible View Modes**: Seamlessly toggle between **Editor Only**, **Split View**, and **Preview Only** modes depending on your focus.
- **Persistent Preferences**: Your layout choice (View Mode) and Theme preference (Dark/Light) are automatically saved to your user profile and synchronized across devices.
- **Global Dark Mode**: A fully integrated, eye-friendly **Nord-themed Dark Mode** that covers the entire UI, from the sidebar to the code blocks.

### 2. Advanced Markdown Editor
- **Smart Formatting Toolbar**: Select any text to trigger a floating toolbar for quick access to Bold, Italic, Strikethrough, Inline Code, Headers, and Links.
- **Efficient Keyboard Shortcuts**:
  - `Tab` / `Shift+Tab`: Smart indentation for lists and code blocks.
  - `Alt + ↑/↓`: Move current line or selection up/down.
  - `Shift + Alt + ↑/↓`: Duplicate current line or selection up/down.
  - `Ctrl/Cmd + S`: Quick manual save (Auto-save is also active).
- **Live Status & Time**: Real-time status indicators (Typing, Saving, Saved) and **Last Edited** timestamps with second-level precision (`YYYY.MM.DD HH:MM:SS`).
- **Syntax Highlighting**: Built-in support for code block highlighting using `highlight.js`.

### 3. File Organization & Management
- **Hierarchical Tree View**: Organize your knowledge with infinite depth using nested Folders and Notes, visualized with clear connector lines.
- **Dynamic Icons**: Folder icons automatically update (`Open`/`Closed`) based on whether they contain files, providing instant visual feedback.
- **Inline Metadata**: File modification times are displayed directly in the sidebar list for quick tracking.
- **Context Actions**: Easily **Rename** (double-click) or **Delete** files and folders directly from the sidebar.

### 4. Techncial & Security
- **Google Authentication**: Secure, effortless login using Google OAuth 2.0.
- **Responsive Sidebar**: Collapsible sidebar for a distraction-free writing mode.
- **Modern Stack**: Built with **FastAPI**, **SQLAlchemy**, **Vue.js 3** (ESM), and **TailwindCSS** for performance and maintainability.

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (Dev) / PostgreSQL (Prod)
- **ORM**: SQLAlchemy
- **Runtime**: Uvicorn

### Frontend
- **Core**: Vue.js 3 (ES Modules)
- **Styling**: TailwindCSS
- **Markdown**: Marked.js + Highlight.js (Nord Theme)
- **Fonts**: JetBrains Mono (Code), Pretendard (UI/Korean)

## Installation & Setup

### Prerequisites
- Python 3.8+
- [uv](https://github.com/astral-sh/uv) (Modern Python package installer)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/shynote.git
   cd shynote
   ```

2. **Install Dependencies**
   SHYNOTE uses `uv` for fast dependency management.
   ```bash
   uv sync
   ```
   *Alternatively, you can use pip:* `pip install -r requirements.txt`

3. **Configuration**
   Create a `.env` file or set environment variables for configuration.
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `DATABASE_URL`: (Optional) Connection string for DB.

## Usage

## Usage

1. **Start the Server**
   Run the development server using the provided shell script:
   ```bash
   ./run.sh (start|stop|restart)
   # Server running at http://0.0.0.0:8000
   ```

2. **Login**
   - Open your browser and navigate to `http://localhost:8000`.
   - Sign in using your Google Account (configured via OAuth).

3. **Start Writing**
   - **Create**: Click the `+` icons in the sidebar to add Folders or Notes.
   - **Write**: Use Markdown syntax in the editor.
   - **View**: Toggle between Edit, Split, and Preview modes using the toolbar.
   - **Formatter**: Select any text to reveal the floating formatting toolbar.

## Project Structure

```
shynote/
├── api/                 # Backend (FastAPI + SQLAlchemy)
│   ├── database.py      # DB Connection & Session handling
│   ├── index.py         # API Routes & Application Entry
│   ├── models.py        # Database Models (User, Note, Folder)
│   ├── schemas.py       # Pydantic Schemas for validation
│   └── utils.py         # JWT & Auth utilities
├── static/              # Frontend (Vue 3 + Tailwind)
│   ├── icons/           # SVG Icons (Folder, Markdown)
│   ├── app.js           # Main Vue Application Logic
│   ├── index.html       # SPA Entry Point
│   └── style.css        # Global CSS & Tailwind Directives
├── docs/                # Documentation
│   ├── implementation_plan.md
│   └── walkthrough.md
├── run.sh               # Dev Server Startup Script
├── requirements.txt     # Python Dependencies
└── SHYNOTE.db           # SQLite Database (Local Dev)
```
