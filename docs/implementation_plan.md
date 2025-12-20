# implementation_plan.md

# Goal Description
Implement an extensible JWT Authentication system (starting with Google, but designed for future providers) and enforce strict data isolation where Folders and Notes are stored and retrieved based on the authenticated User's ID.

## User Review Required
> [!IMPORTANT]
> **Google Client ID**: You will need a Google Cloud Project with OAuth 2.0 credentials. You must replace `YOUR_GOOGLE_CLIENT_ID` in both the frontend code and backend configuration with your actual generic Client ID.

> [!WARNING]
> **Database Migration**: Adding `user_id` to existing `notes` and `folders` tables in SQLite requires a schema change. Existing data will need to be either assigned to a default user or the database will need to be reset. This plan assumes we will **attempt to preserve data** by adding the column as nullable initially, or the user can choose to delete `SHYNOTE.db` for valid clean slate.

## Proposed Changes

### Configuration & Dependencies
#### [MODIFY] pyproject.toml
- Add dependencies:
    - `google-auth` (to verify Google ID tokens)
    - `python-jose[cryptography]` (to generate internal session JWTs)
    - `python-multipart` (for form parsing if needed)

### Database & Models
#### [MODIFY] src/models.py
- **New `User` Model**:
    - `id` (Integer, Primary Key)
    - `email` (String, Unique, Index)
    - `provider` (String, e.g., 'google') - *Supports multiple providers*
    - `provider_id` (String, Index) - *The unique ID from the provider (e.g., Google 'sub')*
    - `created_at` (DateTime)
- **Update `Folder` and `Note` Models**:
    - Add `user_id` (Integer, ForeignKey("users.id"), Index=True)
    - Enforce relationship so notes/folders belong to a user.

#### [MODIFY] src/schemas.py
- Add `UserCreate`, `UserResponse` schemas.
- Update `Note` and `Folder` schemas to include `user_id`.
- Add `AuthRequest` (provider, token) and `Token` (access_token, token_type) schemas.

#### [NEW] src/auth/
- Refactor auth logic into a package or module to support multiple providers.
- `src/auth/manager.py`: Handles generic login logic (get_user_by_provider -> create_if_missing -> mint_token).
- `src/auth/providers/google.py`: Specific logic to verify Google ID tokens.
- `src/auth/utils.py`: JWT utilities (create_access_token, decode_token).

### API Implementation
#### [MODIFY] src/main.py
- **New Auth Endpoint**: `POST /auth/login`
    - Accepts `{ "provider": "google", "token": "..." }`
    - Verifies token via provider specific logic.
    - Returns internal JWT access token.
- **Dependency**: `get_current_user`
    - Validates internal JWT from `Authorization` header.
    - Returns `User` model instance.
- **Protect Routes**:
    - Apply `Depends(get_current_user)` to all Note/Folder CRUD endpoints.
    - **Crucial**: All DB queries must filter by `user.id`.
        - `db.query(Note).filter(Note.user_id == current_user.id, ...)`

### Frontend
#### [MODIFY] static/index.html
- Add Google Sign-In script (GIS).
- Add a generic Login UI that can be expanded for other providers later.

#### [MODIFY] static/app.js
- **Auth State Management**:
    - Check for `access_token` in `localStorage`.
    - If missing or invalid, show Login UI.
- **Login Flow**:
    - On Google Sign-In success, send ID token to `POST /auth/login`.
    - Receive internal `access_token` and store it.
    - Fetch initial data.
- **API Requests**:
    - Add `Authorization: Bearer <token>` header to all backend calls.
    - Handle 401 response (auto-logout).

## Verification Plan

### Manual Verification
1.  **Multi-Provider Design Check**: Verify code structure allows adding a 'github' provider easily in `src/auth/providers/`.
2.  **Login Flow**: Test Google Sign-In. Verify backend returns internal JWT.
3.  **Data Isolation**:
    - Login as User A. Create "Secret Note A".
    - Logout. Login as User B. Should NOT see "Secret Note A".
    - Create "Secret Note B".
    - Check DB: Ensure `user_id` columns match respective users.
