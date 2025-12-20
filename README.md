# SHYNOTE

SHYNOTE is a lightweight, web-based markdown note-taking application designed to provide an Obsidian-like experience. It features a folder-based hierarchy, split-view editing, and a clean, distraction-free interface with a beautiful Nord-themed dark mode.

## Key Features

- **Split-View Editor**: Real-time Markdown preview alongside your editor.
- **Folder Management**: Organize notes into nested folders.
- **Dark Mode**: Built-in Nord theme for a comfortable writing experience at night.
- **Smart Editing**: (Mock) AI-assisted proofreading and summarization features.
- **Google Authentication**: Secure login via Google OAuth.
- **Responsive Design**: Optimized for both desktop and tablet use.

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

To start the development server, simply run the provided script:

```bash
./run.sh
```

The application will be available at `http://0.0.0.0:8000`.

## Project Structure

- `src/`: Backend source code (FastAPI app, models, schemas).
- `static/`: Frontend assets (HTML, JS, CSS, Icons).
- `docs/`: Project documentation and artifacts.
- `tests/`: Test suite.
