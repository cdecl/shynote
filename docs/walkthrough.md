# Walkthrough - Sync with GEMINI.md

I have updated the project to align with `GEMINI.md` requirements, introducing Folder support, Split View editor, and **Google JWT Authentication**.

## Changes

### Authentication
- **Google Sign-In**: Implemented JWT-based authentication using Google OAuth 2.0.
- **Data Isolation**: Notes and Folders are now strictly isolated per user.
- **Configurable**: Client ID is managed via `config.json`, separating secrets from code.

### Documentation
- Created `docs/` directory.
- Populated `docs/` with project artifacts.

### Sidebar & Folders
- **Folders**: Implemented folder creation and management.
- **Organization**: Notes can now be created within folders or at the root level.
- **UI**: Sidebar displaying folders and their contents hierarchically.

### Editor
- **Split View**: Implemented a side-by-side Editor and Markdown Preview.
- **Markdown**: Integrated `marked.js` for real-time markdown rendering.

### UI Improvements
- **Material Icons**: Integrated genuine **VS Code Material Icon Theme** SVGs for directories and Markdown files, providing a familiar and high-quality visual hierarchy.
- **Sidebar Toggle**: Added a collapsible sidebar feature with smooth transitions, controllable via a toggle button in the editor toolbar.

## Authentication Setup (Google OAuth)
To enable Google Sign-In, you need to configure a Google Cloud Project:

1.  **Go to Google Cloud Console**:
    -   Visit [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2.  **Create Credentials**:
    -   Click **Create Credentials** > **OAuth client ID**.
    -   Application type: **Web application**.
    -   Name: `Shynotes Local` (or any name).
3.  **Configure Origins**:
    -   Under **Authorized JavaScript origins**, add:
        -   `http://localhost:8000`
        -   `http://127.0.0.1:8000`
    -   Click **CREATE**.
4.  **Update Configuration**:
    -   Copy the **Client ID** (e.g., `12345...apps.googleusercontent.com`).
    -   Open `config.json` in the project root.
    -   Paste your ID:
        ```json
        {
          "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID_HERE"
        }
        ```
    -   Restart the server: `./run.sh restart`.

## Verification

### User Interaction
1.  **Sidebar Actions**:
    -   **Toggle**: Click the double-arrow icon in the toolbar to collapse/expand the sidebar.
    -   **Delete**: Hover over any folder or note in the sidebar to reveal the **Trash** icon. Click to delete (with confirmation for folders).
    -   **Create**: Use the styled icons in the header to create new Folders or Notes.

### Browser Automation
I verified the following workflows:
1.  **Folder Creation**: Created "Projects" and "Ideas" folders.
2.  **Note Creation**: Created "ProjectPlan" inside "Projects".
3.  **Editing**: Verified markdown content (Headers, Lists, Bold text).
4.  **Preview**: Confirmed the Preview pane renders markdown correctly.
5.  **Navigation**: Verified sidebar structure matches the folder hierarchy.

![Folder and Split View Verification](file:///Users/cdecl/.gemini/antigravity/brain/1d220aa3-893b-4506-aa3f-6ff27a9e7687/folder_split_feature_verification_retry_1766207215745.webp)
*Figure 1: Verification of Folders and Split View.*

## How to Run

The `run.sh` script has been updated to run as a background service.

### Start Server
```bash
./run.sh start
```
*   Starts the server in the background (Port 8000).
*   Logs are written to `SHYNOTE.log`.

### Stop Server
```bash
./run.sh stop
```

### Restart Server
```bash
./run.sh restart
```

**Note**: The database schema has been updated. If you encounter errors, you may need to reset the database:
```bash
rm SHYNOTE.db
./run.sh start
```
