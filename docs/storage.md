# LocalStorage Configuration Specs

SHYNOTE uses `localStorage` to persist user preferences and session state on the client side. This allows for a consistent experience even in Guest Mode or when settings aren't synced to the server.

## 1. Authentication & Session
| Key | Type | Description |
| :--- | :--- | :--- |
| `access_token` | `string` | Stores the JWT for authenticated sessions or the string `"guest"` for Guest Mode. |
| `shynote_last_note_id` | `number` | The ID of the note last viewed by the user. Used for auto-loading on startup. |

## 2. Interface Settings
| Key | Type | Description |
| :--- | :--- | :--- |
| `shynote_dark_mode` | `boolean` | Stores the theme preference (`true` for dark mode, `false` for light mode). |
| `shynote_sidebar_pinned` | `boolean` | Whether the sidebar is pinned open (`true`) or auto-collapses (`false`). |
| `shynote_font_size` | `string` | The preferred font size for the editor (e.g., `"14"`, `"16"`). |
| `shynote_collapsed_folders` | `object` | A JSON-serialized dictionary mapping folder IDs to their collapsed state (boolean). |

## 3. Sort Preferences
| Key | Type | Description |
| :--- | :--- | :--- |
| `shynote_sort_field` | `string` | The field used for sorting notes/folders (`"title"`, `"updated_at"`, `"created_at"`). |
| `shynote_sort_direction` | `string` | The sort order (`"asc"` for ascending, `"desc"` for descending). |

---

## Behavior at Loading
1. **Initial Load**: The app checks `access_token`. If present, it fetches data.
2. **Auto-Select**: 
   - After fetching notes, it looks for `shynote_last_note_id`.
   - If the note exists, it opens it.
   - If not, it opens the first note in the first sorted folder, or the first root note.
3. **Theme Detection**:
   - If `shynote_dark_mode` is missing, the app detects system preference (`prefers-color-scheme: dark`).
   - The result is then saved to `localStorage` for subsequent visits.
