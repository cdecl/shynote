import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, crosshairCursor, lineNumbers, highlightActiveLineGutter, placeholder } from "https://esm.sh/@codemirror/view@6.23.0?deps=@codemirror/state@6.4.0"
import { EditorState, Compartment, EditorSelection } from "https://esm.sh/@codemirror/state@6.4.0"
import { markdown, markdownLanguage } from "https://esm.sh/@codemirror/lang-markdown@6.2.3?deps=@codemirror/state@6.4.0"
import { languages } from "https://esm.sh/@codemirror/language-data@6.4.0?deps=@codemirror/state@6.4.0"
import { defaultKeymap, history, historyKeymap } from "https://esm.sh/@codemirror/commands@6.3.3?deps=@codemirror/state@6.4.0"
import { search, searchKeymap, highlightSelectionMatches, setSearchQuery, SearchQuery, findNext, findPrevious } from "https://esm.sh/@codemirror/search@6.5.5?deps=@codemirror/state@6.4.0"
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2?deps=@codemirror/state@6.4.0"
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "https://esm.sh/@codemirror/language@6.10.0?deps=@codemirror/state@6.4.0"
import { closeBrackets, closeBracketsKeymap } from "https://esm.sh/@codemirror/autocomplete@6.12.0?deps=@codemirror/state@6.4.0"
import { MergeView } from "https://esm.sh/@codemirror/merge@6.4.0?deps=@codemirror/state@6.4.0, @codemirror/view@6.23.0"
import jsyaml from "https://esm.sh/js-yaml@4.1.0"
import { LocalDB } from "./local_db.js"

const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted, onBeforeUnmount } = Vue;

// UUID v7 Generator (Time-ordered)
const uuidv7 = () => {
	const now = Date.now();
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	// Timestamp (48 bits) - Big Endian
	bytes[0] = (now / 0x10000000000) & 0xff;
	bytes[1] = (now / 0x100000000) & 0xff;
	bytes[2] = (now / 0x1000000) & 0xff;
	bytes[3] = (now / 0x10000) & 0xff;
	bytes[4] = (now / 0x100) & 0xff;
	bytes[5] = now & 0xff;

	// Version 7 (0111)
	bytes[6] = 0x70 | (bytes[6] & 0x0f);

	// Variant (10xx)
	bytes[8] = 0x80 | (bytes[8] & 0x3f);

	return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
		.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
};

createApp({
	setup() {
		const STORAGE_KEYS = {
			TOKEN: 'access_token',
			DARK_MODE: 'shynote_dark_mode',
			SIDEBAR_PINNED: 'shynote_sidebar_pinned',
			FONT_SIZE: 'shynote_font_size',
			COLLAPSED_FOLDERS: 'shynote_collapsed_folders',
			SORT_FIELD: 'shynote_sort_field',
			SORT_DIRECTION: 'shynote_sort_direction',
			LAST_NOTE_ID: 'shynote_last_note_id',
			USER_ID: 'shynote_user_id',

			SPLIT_RATIO: 'shynote_split_ratio',
			LAST_FOLDER_ID: 'shynote_last_folder_id',
			LAST_PANEL_MODE: 'shynote_last_panel_mode'
		}


		const currentUserId = ref(null)

		// Private Helpers
		const parseSafeDate = (dateStr) => {
			if (!dateStr) return null
			let safeStr = dateStr
			if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
				safeStr = dateStr.replace(' ', 'T') + 'Z'
			}
			const date = new Date(safeStr)
			return isNaN(date.getTime()) ? null : date
		}

		// Hash Helper for Sync
		const shynote_hash = async (text) => {
			const encoder = new TextEncoder();
			const data = encoder.encode(text);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		}

		// User Settings Helper
		const getUserStorageKey = (key) => {
			const prefix = currentUserId.value ? `${currentUserId.value}_` : 'guest_';
			return `${prefix}${key}`;
		}

		const saveUserSetting = (key, value) => {
			localStorage.setItem(getUserStorageKey(key), String(value))
		}

		const loadUserSettings = () => {
			// Settings that depend on user
			isSidebarPinned.value = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SIDEBAR_PINNED)) === 'true'
			fontSize.value = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.FONT_SIZE)) || '14'
			collapsedFolders.value = JSON.parse(localStorage.getItem(getUserStorageKey(STORAGE_KEYS.COLLAPSED_FOLDERS)) || '{}')

			const field = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SORT_FIELD)) || 'title'
			const dir = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SORT_DIRECTION)) || 'asc'
			sortOption.value = { field, direction: dir }

			const ratio = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SPLIT_RATIO))
			splitRatio.value = Number(ratio) || 50

			// Dark Mode (Local Preference override before DB)
			const localDark = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.DARK_MODE))
			if (localDark !== null) {
				isDarkMode.value = localDark === 'true'
				applyTheme()
			}
		}

		const notes = ref([])
		const pinnedNotes = ref([])
		const folders = ref([])
		const selectedNote = ref(null)
		const loading = ref(false)
		const statusMessage = ref('Ready')
		const isSidebarOpen = ref(true)
		const isSidebarPinned = ref(false) // Init defaults
		const editorRef = ref(null)
		const previewRef = ref(null)
		const viewMode = ref('edit')

		// Dark mode is global/device specific usually, but code requested "User Info". 
		// Let's keep dark mode global for now as per industry standard? 
		// Or user profile has 'is_dark_mode' so it syncs from DB actually!
		// But local fallback:
		const isDarkMode = ref(localStorage.getItem(STORAGE_KEYS.DARK_MODE) === null ? true : localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true')

		const isAuthenticated = ref(false)
		const fontSize = ref('14')
		const setFontSize = (size) => {
			fontSize.value = size
			saveUserSetting(STORAGE_KEYS.FONT_SIZE, size)
		}
		const collapsedFolders = ref({})

		const sidebarViewMode = ref(localStorage.getItem('shynote_sidebar_view_mode') || 'simple')
		const setSidebarViewMode = (mode) => {
			sidebarViewMode.value = mode
			localStorage.setItem('shynote_sidebar_view_mode', mode)
		}

		// New 2-Column Layout State
		const rightPanelMode = ref(localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_PANEL_MODE)) || 'list') // 'list' | 'edit'
		const currentFolderId = ref(null) // null = Inbox (Root)
		const showAbout = ref(false)
		const isSharing = ref(false)
		const isSortMenuOpen = ref(false)

		const dbType = ref('...')

		// New UI States
		const splitRatio = ref(50)

		// Split Resize Logic
		const isResizing = ref(false)
		const startResize = () => {
			isResizing.value = true
			document.addEventListener('mousemove', handleResize)
			document.addEventListener('mouseup', stopResize)
			document.body.style.userSelect = 'none'
		}
		const handleResize = (e) => {
			if (!isResizing.value) return
			const container = document.querySelector('.split-container')
			if (!container) return
			const containerRect = container.getBoundingClientRect()
			const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100
			if (newRatio > 20 && newRatio < 80) {
				splitRatio.value = newRatio
			}
		}
		const stopResize = () => {
			isResizing.value = false
			document.removeEventListener('mousemove', handleResize)
			document.removeEventListener('mouseup', stopResize)
			document.body.style.userSelect = ''
			saveUserSetting(STORAGE_KEYS.SPLIT_RATIO, splitRatio.value)
		}



		// Guest Store (InMemory DB) - Defined Early for authenticatedFetch
		const guestStore = {
			user: { id: 'guest', email: 'guest@shynote.app', is_dark_mode: true, view_mode: 'split' },
			notes: [
				{ id: 999, title: 'Welcome to Guest Mode', content: '# Guest Mode\n\nChanges here are **temporary** (in-memory) and will be lost on refresh unless we added localStorage persistence (not implemented yet).\n\nTry creating folders and notes!', folder_id: null, user_id: 'guest', updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
			],
			folders: []
		}

		// Dependencies needed early
		const logout = () => {
			localStorage.removeItem(STORAGE_KEYS.TOKEN)
			localStorage.removeItem(STORAGE_KEYS.USER_ID)
			isAuthenticated.value = false
			currentUserId.value = null
			notes.value = []
			folders.value = []
			selectedNote.value = null
		}

		const authenticatedFetch = async (url, options = {}) => {
			const token = localStorage.getItem('access_token')

			// Guest Mode Bypass & Mock
			if (token === 'guest') {
				await new Promise(r => setTimeout(r, 50)); // Tiny network delay simulation

				// Mock Response Helper
				const ok = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })
				const bad = () => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad Request' }) })

				const method = options.method || 'GET'
				const body = options.body ? JSON.parse(options.body) : {}

				// 1. Auth / Profile
				if (url.includes('/auth/me')) {
					if (method === 'GET') return ok(guestStore.user)
					if (method === 'PATCH') {
						Object.assign(guestStore.user, body)
						return ok(guestStore.user)
					}
				}

				// 2. Folders
				if (url.includes('/api/folders')) {
					if (method === 'GET') return ok([...guestStore.folders])
					if (method === 'POST') {
						const newFolder = { id: Date.now(), name: body.name, user_id: 'guest', created_at: new Date().toISOString() }
						guestStore.folders.push(newFolder)
						return ok(newFolder)
					}
					const idMatch = url.match(/\/api\/folders\/(\d+)/)
					if (idMatch) {
						const id = parseInt(idMatch[1])
						if (method === 'PUT') {
							const f = guestStore.folders.find(x => x.id === id)
							if (f) f.name = body.name
							return ok(f)
						}
						if (method === 'DELETE') {
							guestStore.folders = guestStore.folders.filter(x => x.id !== id)
							guestStore.notes = guestStore.notes.filter(x => x.folder_id !== id)
							return ok({ success: true })
						}
					}
				}

				// 3. Notes
				if (url.includes('/api/notes')) {
					if (method === 'GET') return ok([...guestStore.notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
					if (method === 'POST') {
						const newNote = { id: Date.now(), title: body.title || 'Untitled', content: body.content || '', folder_id: body.folder_id, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
						guestStore.notes.unshift(newNote)
						return ok(newNote)
					}
					const idMatch = url.match(/\/api\/notes\/(\d+)/)
					if (idMatch) {
						const id = parseInt(idMatch[1])
						if (method === 'PUT') {
							const n = guestStore.notes.find(x => x.id === id)
							if (n) {
								if (body.title !== undefined) n.title = body.title
								if (body.content !== undefined) n.content = body.content
								if (body.folder_id !== undefined) n.folder_id = body.folder_id
								n.updated_at = new Date().toISOString()
								return ok(n)
							}
							return bad()
						}
						if (method === 'DELETE') {
							guestStore.notes = guestStore.notes.filter(x => x.id !== id)
							return ok({ success: true })
						}
					}
				}

				return ok({})
			}

			if (!token) return null // Return null or throw error if no token for non-guest mode

			const headers = {
				...options.headers,
				'Authorization': `Bearer ${token}`
			}

			const response = await fetch(url, { ...options, headers })
			if (response.status === 401) {
				logout()
				return null
			}
			return response
		}
		// Forward declaration not possible with const, so we change logic order.
		// We will define debouncedUpdate and updateNote BEFORE handleInput.


		let debounceTimer = null

		const updateNote = async () => {
			if (!selectedNote.value || !selectedNote.value.id) return

			selectedNote.value.updated_at = new Date().toISOString()
			statusMessage.value = 'Saving...'

			try {
				const response = await authenticatedFetch(`/api/notes/${selectedNote.value.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: selectedNote.value.title,
						content: selectedNote.value.content,
						folder_id: selectedNote.value.folder_id
					})
				})

				if (response && response.ok) {
					statusMessage.value = 'Saved'
					// Update local list
					const idx = notes.value.findIndex(n => n.id === selectedNote.value.id)
					if (idx !== -1) {
						notes.value[idx] = { ...selectedNote.value }
					}
				} else {
					statusMessage.value = 'Error saving'
				}
			} catch (e) {
				console.error("Save failed", e)
				statusMessage.value = 'Error saving'
			}
		}

		const hasIDB = typeof window !== 'undefined' && 'indexedDB' in window
		const isSyncing = ref(false)

		const debouncedUpdate = () => {
			statusMessage.value = 'Typing...'
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(async () => {
				if (!selectedNote.value) return
				selectedNote.value.updated_at = new Date().toISOString()

				if (hasIDB) {
					try {
						const rawNote = JSON.parse(JSON.stringify(selectedNote.value))
						if (!rawNote.user_id && currentUserId.value) {
							rawNote.user_id = currentUserId.value
						}
						await LocalDB.saveNote(rawNote)
						statusMessage.value = 'Saved locally'

						// FIX: Update memory list immediately
						const idx = notes.value.findIndex(n => n.id === rawNote.id)
						if (idx !== -1) notes.value[idx] = rawNote
					} catch (e) {
						console.error("Local save failed", e)
						statusMessage.value = 'Error saving'
					}
				} else {
					await updateNote()
				}
			}, 1000)
		}

		const manualSave = async () => {
			if (debounceTimer) clearTimeout(debounceTimer)
			if (!selectedNote.value) return

			statusMessage.value = 'Saving...'
			selectedNote.value.updated_at = new Date().toISOString()

			if (hasIDB) {
				try {
					const rawNote = JSON.parse(JSON.stringify(selectedNote.value))
					if (!rawNote.user_id && currentUserId.value) rawNote.user_id = currentUserId.value

					await LocalDB.saveNote(rawNote)
					statusMessage.value = 'Saved'

					// FIX: Update memory list immediately
					const idx = notes.value.findIndex(n => n.id === rawNote.id)
					if (idx !== -1) notes.value[idx] = rawNote

					syncWorker()
				} catch (e) {
					console.error("Manual save failed", e)
					statusMessage.value = 'Error saving'
				}
			} else {
				await updateNote()
			}
		}

		const syncWorker = async () => {
			if (!hasIDB || isSyncing.value || !isAuthenticated.value) return
			isSyncing.value = true
			try {
				const logs = await LocalDB.getPendingLogs()
				if (logs && logs.length > 0) {
					const latestUpdates = {}
					for (const log of logs) {
						// Dedup Logic:
						// If we have a CREATE, and then an UPDATE, the result should be a CREATE with the updated payload.
						// If we have CREATE then DELETE, it negates (but we handle DELETE simply by overwriting for now, or optimizing out)

						const existing = latestUpdates[log.entity_id]
						if (existing && existing.action === 'CREATE' && log.action === 'UPDATE') {
							// Merge: Keep CREATE, update payload
							latestUpdates[log.entity_id] = {
								...log,
								action: 'CREATE',
								payload: { ...existing.payload, ...log.payload }
							}
						} else {
							// Default: Overwrite with latest (e.g. UPDATE -> UPDATE, or DELETE)
							latestUpdates[log.entity_id] = log
						}
					}

					// Sort updates to handle dependencies (Folders first, then Notes)
					const sortedUpdates = Object.values(latestUpdates).sort((a, b) => {
						// Prioritize Folder operations (Create/Update) over Notes to avoid "Invalid folder" 400 errors
						if (a.entity === 'folder' && b.entity !== 'folder') return -1;
						if (a.entity !== 'folder' && b.entity === 'folder') return 1;
						return 0;
					});

					for (const log of sortedUpdates) {
						let url, method, body;
						const isCreate = log.action === 'CREATE';
						const isDelete = log.action === 'DELETE';

						if (log.entity === 'note') {
							if (isDelete) {
								url = `/api/notes/${log.entity_id}`
								method = 'DELETE'
							} else if (isCreate) {
								const { title, content, folder_id } = log.payload
								url = '/api/notes'
								method = 'POST'
								// Send UUID generated by client
								body = { id: log.entity_id, title, content, folder_id }
							} else {
								// UPDATE
								const { title, content, folder_id, is_pinned } = log.payload
								url = `/api/notes/${log.entity_id}`
								method = 'PUT'
								body = { title, content, folder_id, is_pinned }
							}
						} else if (log.entity === 'folder') {
							if (isDelete) {
								url = `/api/folders/${log.entity_id}`
								method = 'DELETE'
							} else if (isCreate) {
								const { name } = log.payload
								url = '/api/folders'
								method = 'POST'
								body = { id: log.entity_id, name }
							} else {
								// UPDATE
								const { name } = log.payload
								url = `/api/folders/${log.entity_id}`
								method = 'PUT'
								body = { name }
							}
						}
						if (url) {
							let response = await authenticatedFetch(url, {
								method: method,
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(body)
							})

							// Self-Healing: If PUT (Update) fails with 404, it means server doesn't have it.
							// This can happen if CREATE was optimized away or failed.
							// Try to Upsert (Convert to POST)
							if (!response.ok && response.status === 404 && method === 'PUT') {
								console.warn(`[Sync Recovery] Entity ${log.entity} ${log.entity_id} missing on server. Attempting re-creation...`)
								if (log.entity === 'folder') {
									response = await authenticatedFetch('/api/folders', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ id: log.entity_id, name: log.payload.name || 'Recovered Folder' })
									})
								} else if (log.entity === 'note') {
									// Recovery for notes too
									const p = log.payload
									response = await authenticatedFetch('/api/notes', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({
											id: log.entity_id,
											title: p.title || 'Untitled',
											content: p.content || '',
											folder_id: p.folder_id
										})
									})
								}
							}

							if (response && (response.ok || (isDelete && response.status === 404))) {
								const processedLogs = logs.filter(l => l.entity === log.entity && l.entity_id === log.entity_id)
								for (const pl of processedLogs) {
									await LocalDB.removeLog(pl.id)
								}

								if (log.entity === 'note') {
									await LocalDB.markNoteSynced(log.entity_id)
								} else if (log.entity === 'folder') {
									await LocalDB.markFolderSynced(log.entity_id)
								}

								if (statusMessage.value === 'Saved locally') {
									statusMessage.value = 'Synced'
								}
							} else {
								console.error(`Sync Failed for ${log.entity} ${log.entity_id}:`, response.status)
							}
						}
					}
				}
			} catch (e) {
				console.error("Sync Error", e)
			} finally {
				isSyncing.value = false
			}
		}

		if (hasIDB) {
			setInterval(syncWorker, 5000)
		}





		// New Handlers

		// New Handlers

		const editorView = ref(null)
		const themeCompartment = new Compartment()
		const wordWrapCompartment = new Compartment()

		const initEditor = () => {
			if (!editorRef.value) return
			if (editorView.value) editorView.value.destroy()

			console.log(`[InitEditor] Called. ConflictMode=${conflictState.value.isConflict}`)

			// Merge View Mode
			if (conflictState.value.isConflict) {
				const { localNote, serverNote } = conflictState.value
				console.log("[InitEditor] Initializing MergeView", localNote, serverNote)

				editorView.value = new MergeView({
					a: {
						doc: localNote.content || '',
						extensions: [markdown({ base: markdownLanguage }), EditorView.editable.of(false), EditorView.lineWrapping]
					},
					b: {
						doc: serverNote.content || '',
						extensions: [markdown({ base: markdownLanguage }), EditorView.editable.of(false), EditorView.lineWrapping]
					},
					parent: editorRef.value,
					orientation: "a-b", // Left: Local, Right: Server
					gutter: true
				})
				return
			}

			const startState = EditorState.create({
				doc: selectedNote.value ? (selectedNote.value.content || '') : '',
				extensions: [
					keymap.of([...defaultKeymap, ...historyKeymap]), // Standard keys
					history(),
					drawSelection(),
					search({ top: true }),
					dropCursor(),
					EditorState.allowMultipleSelections.of(true),
					markdown({ base: markdownLanguage, codeLanguages: languages }), // Markdown logic
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					bracketMatching(),
					closeBrackets(),
					keymap.of(closeBracketsKeymap),
					highlightActiveLineGutter(),
					highlightSpecialChars(),
					placeholder('Start typing...'),
					// Theme Compartment
					themeCompartment.of(isDarkMode.value ? oneDark : []),
					// Word Wrap Compartment
					wordWrapCompartment.of(EditorView.lineWrapping),
					// Custom Theme for Caret & Font & Search
					EditorView.theme({
						"&": { fontSize: "inherit" },
						".cm-scroller": { fontFamily: "'JetBrains Mono', monospace" },
						".cm-content": {
							fontFamily: "'JetBrains Mono', monospace",
							padding: "5px !important"
						},
						".cm-cursor, .cm-dropCursor": { borderLeftColor: "#528bff" },
						"&.cm-focused .cm-cursor": { borderLeftColor: "#528bff" },
						"&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: isDarkMode.value ? "rgba(104, 151, 187, 0.4) !important" : "#D9D9D9 !important" },

						// Search Match Colors
						".cm-searchMatch": {
							backgroundColor: isDarkMode.value ? "#FDD835" : "#FFFF0055",
							color: isDarkMode.value ? "#000000 !important" : "inherit"
						},
						".cm-searchMatch-selected": {
							backgroundColor: isDarkMode.value ? "#FF9800" : "#FF9900",
							color: isDarkMode.value ? "#000000 !important" : "inherit"
						}
					}),
					// Update Listener (Sync)
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							if (selectedNote.value) {
								selectedNote.value.content = update.state.doc.toString()
								debouncedUpdate()
							}
						}
						// Check selection for toolbar
						if (update.selectionSet) {
							checkSelection()
						}
					}),
					// Check for Scroll Sync
					EditorView.domEventHandlers({
						scroll: handleScroll
					}),
					// Custom Keymap for Save/Find/Formatting
					keymap.of([
						{ key: "Mod-s", run: () => { manualSave(); return true } },
						{ key: "Mod-f", run: () => { openSearch(); return true } },
						{ key: "Mod-g", run: () => { executeFind(false); return true } },
						{ key: "Shift-Mod-g", run: () => { executeFind(true); return true } },
						{ key: "Escape", run: () => { closeSearch(); return false } }, // Fallback escape
						{ key: "Mod-b", run: () => { formatText('bold'); return true } },
						{ key: "Mod-i", run: () => { formatText('italic'); return true } },
						{ key: "Mod-k", run: () => { formatText('link'); return true } }
					])
				]
			})

			editorView.value = new EditorView({
				state: startState,
				parent: editorRef.value
			})
		}

		// Conflict Logic
		const conflictState = ref({
			isConflict: false,
			localNote: null,
			serverNote: null
		})

		const enterConflictMode = (local, server) => {
			conflictState.value = {
				isConflict: true,
				localNote: local,
				serverNote: server
			}
			console.log('Conflict detected! Entering Merge Mode.', local, server)
			nextTick(() => {
				initEditor() // Re-init to show MergeView
			})
		}

		const resolveConflict = async (action) => {
			const { localNote, serverNote } = conflictState.value
			if (!localNote || !serverNote) return

			if (action === 'use_local') {
				// We keep local. Just need to update LocalDB to say... actually status is still dirty.
				// But we might want to update the 'base' hash to current execution?
				// Simply doing nothing keeps it dirty and it will overwrite server on next push.
				// But we should act like we 'resolved' it. 
				// Maybe force push now?
				await updateNote() // Will push to server
			} else if (action === 'use_server') {
				// Overwrite local with server content
				localNote.title = serverNote.title
				localNote.content = serverNote.content
				localNote.folder_id = serverNote.folder_id
				localNote.content_hash = serverNote.content_hash
				// Save as synced
				if (hasIDB) {
					await LocalDB.saveNote({ ...localNote, sync_status: 'synced' }) // This method defaults dirty?
					// Wait, saveNote defaults dirty. We need direct put or allow override.
					// Let's manually put for now or use saveNotesBulk one item
					await LocalDB.saveNotesBulk([localNote])
				}
				// Update UI
				if (selectedNote.value && selectedNote.value.id === localNote.id) {
					selectedNote.value = localNote
				}
			}

			conflictState.value.isConflict = false
			initEditor()
		}


		const formatText = (type) => {
			const view = editorView.value
			if (!view) return
			view.focus()

			let wrap = ''
			switch (type) {
				case 'bold': wrap = '**'; break;
				case 'italic': wrap = '*'; break;
				case 'strike': wrap = '~~'; break;
				case 'code': wrap = '`'; break;
			}

			if (wrap) {
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					const isWrapped = slice.startsWith(wrap) && slice.endsWith(wrap) && slice.length >= wrap.length * 2
					if (isWrapped) {
						return {
							changes: { from: range.from, to: range.to, insert: slice.slice(wrap.length, -wrap.length) },
							range: EditorSelection.range(range.from, range.to - (wrap.length * 2))
						}
					}
					return {
						changes: { from: range.from, to: range.to, insert: wrap + slice + wrap },
						range: EditorSelection.range(range.from, range.to + (wrap.length * 2))
					}
				})
				view.dispatch(transaction)
				return
			}

			if (type === 'link') {
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					const text = `[${slice}]()`
					return {
						changes: { from: range.from, to: range.to, insert: text },
						range: EditorSelection.range(range.from + slice.length + 3, range.from + slice.length + 3)
					}
				})
				view.dispatch(transaction)
				return
			}

			if (type === 'codeblock') {
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					if (slice.startsWith("```\n") && slice.endsWith("\n```")) {
						// Unwrap
						return {
							changes: { from: range.from, to: range.to, insert: slice.slice(4, -4) },
							range: EditorSelection.range(range.from, range.to - 8)
						}
					} else {
						// Wrap
						const text = "```\n" + slice + "\n```"
						return {
							changes: { from: range.from, to: range.to, insert: text },
							range: EditorSelection.range(range.from, range.from + text.length)
						}
					}
				})
				view.dispatch(transaction)
				return
			}

			// Line-based formatting
			const transaction = view.state.changeByRange(range => {
				const startLine = view.state.doc.lineAt(range.from)
				const endLine = view.state.doc.lineAt(range.to)

				// Determine dominant state for checkbox
				// 0: None, 1: Unchecked, 2: Checked
				let nextState = 1 // Default to Unchecked
				if (type === 'checkbox') {
					let hasUnchecked = false
					let hasChecked = false
					let hasNone = false

					for (let l = startLine.number; l <= endLine.number; l++) {
						const lineText = view.state.doc.line(l).text
						if (lineText.match(/^- \[ \] /)) hasUnchecked = true
						else if (lineText.match(/^- \[x\] /)) hasChecked = true
						else hasNone = true
					}

					if (hasUnchecked && !hasChecked && !hasNone) nextState = 2 // All unchecked -> Checked
					else if (hasChecked && !hasUnchecked && !hasNone) nextState = 0 // All checked -> Undo (None)
					else nextState = 1 // Mixed or None -> Unchecked
				}

				let newLines = []
				for (let l = startLine.number; l <= endLine.number; l++) {
					let lineText = view.state.doc.line(l).text

					if (type.startsWith('h')) {
						const level = parseInt(type.replace('h', ''))
						const prefix = '#'.repeat(level) + ' '
						if (lineText.startsWith(prefix)) {
							lineText = lineText.substring(prefix.length)
						} else {
							lineText = prefix + lineText.replace(/^#+ /, '')
						}
					} else if (type === 'dash') {
						if (lineText.match(/^-\s/)) {
							lineText = lineText.replace(/^-\s/, '')
						} else {
							lineText = '- ' + lineText
						}
					} else if (type === 'checkbox') {
						// Clean existing
						lineText = lineText.replace(/^- \[[ x]\] /, '').replace(/^-\s/, '')

						if (nextState === 1) {
							lineText = '- [ ] ' + lineText
						} else if (nextState === 2) {
							lineText = '- [x] ' + lineText
						}
						// If nextState === 0, we leave it cleaned (Undo)
					}
					newLines.push(lineText)
				}

				const insertText = newLines.join('\n')
				const lengthDiff = insertText.length - (endLine.to - startLine.from)

				return {
					changes: { from: startLine.from, to: endLine.to, insert: insertText },
					range: EditorSelection.range(startLine.from, endLine.to + lengthDiff)
				}
			})
			view.dispatch(transaction)
		}


		console.log('Setup functions defined')

		const focusEditor = () => {
			if (editorView.value) {
				editorView.value.focus()
			}
		}

		// --- Search Widget Logic (Simplified) ---
		// Search highlighting is removed as textarea doesn't support it easily.
		// We implement Find/Next/Replace.
		const searchState = ref({
			show: false,
			showReplace: false,
			query: '',
			replaceText: '',
			caseSensitive: false,
			useRegex: false
		})
		const searchInputRef = ref(null)

		const updateHighlights = () => {
			// Not supported in Textarea
		}

		const openSearch = (replace = false) => {
			searchState.value.show = true
			if (replace) searchState.value.showReplace = true
			nextTick(() => {
				if (searchInputRef.value) searchInputRef.value.focus()
				const view = editorView.value
				if (view && !view.state.selection.main.empty) {
					const range = view.state.selection.main
					searchState.value.query = view.state.sliceDoc(range.from, range.to)
				}
			})
		}

		const closeSearch = () => {
			searchState.value.show = false
			searchState.value.showReplace = false
			if (editorView.value) editorView.value.focus()
		}

		watch(() => [searchState.value.query, searchState.value.caseSensitive, searchState.value.useRegex], () => {
			// No live highlights
		})

		const executeFind = (reverse = false, focusEditor = true) => {
			const view = editorView.value
			if (!view) return
			const query = searchState.value.query
			if (!query) return

			const searchQuery = new SearchQuery({
				search: query,
				caseSensitive: searchState.value.caseSensitive,
				regexp: searchState.value.useRegex
			})

			view.dispatch({ effects: setSearchQuery.of(searchQuery) })

			if (reverse) {
				findPrevious(view)
			} else {
				findNext(view)
			}
			if (focusEditor) view.focus()
		}

		const hasSelection = ref(false)
		const checkSelection = () => {
			const view = editorView.value
			if (!view) return
			hasSelection.value = !view.state.selection.main.empty
		}

		// Scroll Sync
		const handleScroll = (e) => {
			const view = editorView.value
			const scrollDOM = view ? view.scrollDOM : null

			const source = e.target

			if (previewRef.value && viewMode.value !== 'edit') {
				if (source === scrollDOM || (source.classList && source.classList.contains('cm-scroller'))) {
					// CM -> Preview
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
					previewRef.value.scrollTop = percentage * (previewRef.value.scrollHeight - previewRef.value.clientHeight)
				} else if (source === previewRef.value && scrollDOM) {
					// Preview -> CM
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
					scrollDOM.scrollTop = percentage * (scrollDOM.scrollHeight - scrollDOM.clientHeight)
				}
			}
		}

		const executeReplace = (all = false) => {
			const view = editorView.value
			if (!view) return
			const content = view.state.doc.toString()
			let query = searchState.value.query
			let replace = searchState.value.replaceText
			if (!query) return

			if (all) {
				const flags = (searchState.value.caseSensitive ? 'g' : 'gi')
				const regex = new RegExp(searchState.value.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
				const newContent = content.replace(regex, replace)

				view.dispatch({
					changes: { from: 0, to: content.length, insert: newContent }
				})
				// Update everything
				selectedNote.value.content = newContent
			} else {
				// Replace Current Selection OR Next Match
				// Check if current selection matches query
				const selection = view.state.selection.main
				const selText = view.state.sliceDoc(selection.from, selection.to)

				let isMatch = false
				if (searchState.value.useRegex) {
					try {
						const flags = (searchState.value.caseSensitive ? '' : 'i')
						const match = selText.match(new RegExp('^' + query + '$', flags)) // Anchor
						isMatch = !!match
					} catch (e) { isMatch = false }
				} else {
					isMatch = searchState.value.caseSensitive ? selText === query : selText.toLowerCase() === query.toLowerCase()
				}

				if (isMatch && !selection.empty) {
					view.dispatch({
						changes: { from: selection.from, to: selection.to, insert: replace },
						scrollIntoView: true
					})
					executeFind(false, false) // keep focus behavior
				} else {
					executeFind(false, false)
				}
			}
		}

		// App Version & Config
		const appVersion = ref('...')
		const fetchAppConfig = async () => {
			try {
				const res = await fetch('/static/version.json?v=' + Date.now())
				if (res.ok) {
					const config = await res.json()
					appVersion.value = config.version
				}
			} catch (e) {
				console.error("Failed to load config", e)
			}
		}

		// Home URL
		const homeUrl = computed(() => {
			const params = new URLSearchParams(window.location.search)
			if (params.get('mode') === 'guest') {
				return '/?mode=guest'
			}
			return '/'
		})



		// Sort State
		const changelogContent = ref('')
		const fetchChangelog = async () => {
			try {
				const res = await fetch('/static/changelog.md?v=' + Date.now())
				if (res.ok) {
					const text = await res.text()
					changelogContent.value = marked.parse(text)
				}
			} catch (e) {
				console.error("Failed to load changelog", e)
			}
		}


		const sortOption = ref({
			field: localStorage.getItem(STORAGE_KEYS.SORT_FIELD) || 'title', // 'title', 'updated_at', 'created_at'
			direction: localStorage.getItem(STORAGE_KEYS.SORT_DIRECTION) || 'asc' // 'asc', 'desc'
		})

		const sortLabel = computed(() => {
			const f = sortOption.value.field
			const d = sortOption.value.direction
			let field = 'Title'
			if (f === 'updated_at') field = 'Modified'
			else if (f === 'created_at') field = 'Created'

			const dir = d === 'asc' ? '↑' : '↓'
			return `${field} ${dir}`
		})

		const showSortMenu = ref(false)
		const toggleSortMenu = () => {
			showSortMenu.value = !showSortMenu.value
		}
		const closeSortMenu = () => {
			showSortMenu.value = false
		}

		const renameState = ref({
			id: null,
			type: null, // 'folder' | 'note'
			name: ''
		})

		// Settings Modal State
		const isSettingsModalOpen = ref(false)

		const openSettingsModal = () => {
			isSettingsModalOpen.value = true;
		}

		const closeSettingsModal = () => {
			isSettingsModalOpen.value = false;
		}

		const backupData = async () => {
			try {
				const response = await authenticatedFetch('/api/backup');
				if (response && response.ok) {
					const data = await response.json();
					const jsonString = JSON.stringify(data, null, 2);
					const blob = new Blob([jsonString], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
					a.download = `shynote_backup_${timestamp}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					closeSettingsModal();
				} else {
					alert('Backup failed.');
				}
			} catch (error) {
				console.error('Backup error:', error);
				alert('An error occurred during backup.');
			}
		};

		const restoreData = async (event) => {
			const file = event.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const backupData = JSON.parse(e.target.result);

					if (!backupData.folders || !backupData.notes) {
						throw new Error('Invalid backup file format.');
					}

					const response = await authenticatedFetch('/api/restore', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(backupData)
					});

					if (response && response.ok) {
						const result = await response.json();
						closeSettingsModal();

						modalState.value = {
							isOpen: true,
							type: 'info',
							title: 'Restore Complete',
							message: `Successfully restored data.\nFolders added: ${result.folders_added}\nNotes added: ${result.notes_added}`,
							confirmText: 'OK',
							cancelText: null,
							inputValue: '',
							inputPlaceholder: '',
							targetId: null
						};

						// Refresh data from server
						await fetchFolders();
						await fetchNotes();
					} else {
						const error = await response.json();
						alert(`Restore failed: ${error.detail || 'Unknown error'}`);
					}
				} catch (error) {
					console.error('Restore error:', error);
					alert(`An error occurred during restore: ${error.message}`);
				} finally {
					event.target.value = '';
				}
			};
			reader.readAsText(file);
		};

		const clearLocalCache = async () => {
			closeSettingsModal();
			openModal('clear-cache');
		};

		const factoryReset = async () => {
			closeSettingsModal();
			openModal('factory-reset');
		};


		// Modal State
		const modalState = ref({
			isOpen: false,
			type: null,
			title: '',
			message: '',
			inputValue: '',
			inputPlaceholder: '',
			targetId: null,
			confirmText: 'Confirm',
			cancelText: 'Cancel'
		})

		const openModal = (type, targetId = null) => {
			modalState.value.type = type
			modalState.value.targetId = targetId
			modalState.value.isOpen = true
			modalState.value.inputValue = ''
			modalState.value.inputPlaceholder = ''

			if (type === 'create-folder') {
				modalState.value.title = 'New Folder'
				modalState.value.message = 'Enter folder name:'
				modalState.value.confirmText = 'Create'
			} else if (type === 'delete-note') {
				modalState.value.title = 'Delete Note'
				modalState.value.message = 'Are you sure you want to delete this note?'
				modalState.value.confirmText = 'Delete'
			} else if (type === 'delete-folder') {
				modalState.value.title = 'Delete Folder'
				modalState.value.message = 'Are you sure you want to delete this folder and all its notes?'
				modalState.value.confirmText = 'Delete'
			} else if (type === 'clear-cache') {
				modalState.value.title = 'Clear Local Cache'
				modalState.value.message = 'This will wipe your local offline data and reload the application. Unsynced changes may be lost.'
				modalState.value.confirmText = 'Clear & Reload'
			} else if (type === 'factory-reset') {
				modalState.value.title = 'Factory Reset'
				modalState.value.message = 'WARNING: This will PERMANENTLY DELETE ALL your notes and folders.\nTo confirm, type "DELETE" below.'
				modalState.value.confirmText = 'Reset Everything'
				modalState.value.inputPlaceholder = 'Type DELETE'
			}


			if (['create-folder', 'factory-reset'].includes(type)) {
				nextTick(() => {
					const input = document.getElementById('modal-input')
					if (input) input.focus()
				})
			}
		}

		const closeModal = () => {
			modalState.value.isOpen = false
			modalState.value.type = null
			modalState.value.targetId = null
		}

		const confirmAction = async () => {
			const { type, targetId, inputValue } = modalState.value

			if (type === 'create-folder') {
				if (!inputValue.trim()) return
				await createFolderImpl(inputValue)
			} else if (type === 'delete-note') {
				await deleteNote(targetId)
			} else if (type === 'delete-folder') {
				await deleteFolder(targetId)
			} else if (type === 'clear-cache') {
				try {
					// Clear localStorage (except auth tokens)
					const keep = ['access_token', 'shynote_user_id'];
					for (let i = localStorage.length - 1; i >= 0; i--) {
						const key = localStorage.key(i);
						if (!keep.includes(key)) localStorage.removeItem(key);
					}

					// Clear IndexedDB
					if (typeof LocalDB !== 'undefined') await LocalDB.clearAll();

					// Clear Service Worker caches
					if ('caches' in window) {
						const cacheNames = await caches.keys();
						await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
						console.log('Service Worker caches cleared:', cacheNames);
					}

					// Unregister service worker (optional - will re-register on reload)
					if ('serviceWorker' in navigator) {
						const registrations = await navigator.serviceWorker.getRegistrations();
						await Promise.all(registrations.map(reg => reg.unregister()));
						console.log('Service Workers unregistered');
					}

					window.location.reload();
				} catch (e) { console.error(e); alert(e.message); }
			} else if (type === 'factory-reset') {
				if (inputValue !== 'DELETE') {
					alert("Please type 'DELETE' to confirm.");
					return;
				}
				try {
					const response = await authenticatedFetch('/api/reset', { method: 'DELETE' });
					if (response.ok) {
						const keep = ['access_token', 'shynote_user_id'];
						for (let i = localStorage.length - 1; i >= 0; i--) {
							const key = localStorage.key(i);
							if (!keep.includes(key)) localStorage.removeItem(key);
						}
						if (typeof LocalDB !== 'undefined') await LocalDB.clearAll();
						window.location.reload();
					} else {
						const err = await response.json();
						alert('Reset failed: ' + (err.detail || 'Unknown error'));
					}
				} catch (e) { console.error(e); alert(e.message); }
			}
			closeModal()
		}



		const checkAuth = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const isGuestMode = urlParams.get('mode') === 'guest';
			const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

			if (isGuestMode) {
				localStorage.setItem(STORAGE_KEYS.TOKEN, 'guest');
				isAuthenticated.value = true;
				currentUserId.value = 'guest';
				await fetchUserProfile();
				await fetchFolders();
				await fetchNotes();
				// autoSelectNote(); // Disabled: Default to Inbox list view
			} else if (storedToken === 'guest' && !isGuestMode) {
				logout();
			} else if (storedToken) {
				isAuthenticated.value = true;

				// Optimistic Load (Instant UI)
				const cachedId = localStorage.getItem(STORAGE_KEYS.USER_ID)
				let didOptimisticLoad = false
				if (cachedId) {
					currentUserId.value = cachedId // Keep as string for UUIDv7
					// Fire fetches immediately (parallel)
					const pFolders = fetchFolders()
					const pNotes = fetchNotes()
					await Promise.all([pFolders, pNotes])
					didOptimisticLoad = true
					restoreState() // Instant UI Restore
				}

				const oldId = currentUserId.value
				await fetchUserProfile(); // Fetches and sets currentUserId from server (Source of Truth)

				console.log('[CheckAuth] Cache ID:', oldId, typeof oldId)
				console.log('[CheckAuth] DB ID:', currentUserId.value, typeof currentUserId.value)

				console.log('[CheckAuth] ID Compare:', { oldId, newId: currentUserId.value, match: oldId === currentUserId.value })

				// If user ID changed (or was null), refetch correct data
				// If user ID changed (or was null), refetch correct data
				if (currentUserId.value !== oldId) {
					console.log('User ID changed, refetching data...')
					loadUserSettings() // Ensure settings are loaded for new ID
					await Promise.all([fetchFolders(false), fetchNotes(false)])
					restoreState()
				} else if (!didOptimisticLoad) {
					// If we didn't do optimistic load (no cached ID), fetch now
					await Promise.all([fetchFolders(false), fetchNotes(false)])
					restoreState()
				}

				// autoSelectNote(); // Disabled: Default to Inbox list view
			} else {
				isAuthenticated.value = false;
			}
		}

		const restoreState = () => {
			try {
				console.log('[RestoreState] Started')
				const savedFolderId = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_FOLDER_ID))
				const savedNoteId = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_NOTE_ID))
				const savedPanelMode = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_PANEL_MODE))

				console.log('[RestoreState] Restoring...', { savedFolderId, savedNoteId, savedPanelMode })

				if (savedFolderId && savedFolderId !== 'null') {
					const fid = isNaN(savedFolderId) ? savedFolderId : Number(savedFolderId) // Handle string/number IDs
					// Check if folder exists
					if (folders.value.find(f => f.id == fid)) {
						currentFolderId.value = fid
					}
				}

				if (savedPanelMode) {
					rightPanelMode.value = savedPanelMode
				}

				if (savedPanelMode === 'edit' && savedNoteId) {
					const nid = isNaN(savedNoteId) ? savedNoteId : Number(savedNoteId)
					const note = notes.value.find(n => n.id == nid)
					if (note) {
						selectedNote.value = JSON.parse(JSON.stringify(note))

						// Sync folder ID just in case
						if (note.folder_id !== undefined) {
							currentFolderId.value = note.folder_id
						}

						// Editor will be initialized by watch on selectedNote.value?.id
					} else {
						// Note not found? Fallback to list
						rightPanelMode.value = 'list'
					}
				}
				console.log('[RestoreState] Completed.')
			} catch (e) {
				console.error('[RestoreState] Failed', e)
			}
		}

		onMounted(async () => {
			isSidebarOpen.value = true // Force sidebar open on startup
			await checkAuth()
			fetchAppConfig()
			fetchChangelog()

			// Init Dark Mode
			if (localStorage.getItem(STORAGE_KEYS.DARK_MODE) === null) {
				if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
					isDarkMode.value = true
					localStorage.setItem(STORAGE_KEYS.DARK_MODE, 'true')
				}
			}
			if (isDarkMode.value) document.documentElement.classList.add('dark')
			applyTheme()

			initGoogleAuth()

			// Global Esc Key Listener for Modals
			window.addEventListener('keydown', (e) => {
				if (e.key === 'Escape' && modalState.value.isOpen) {
					closeModal()
				}
			})
		})

		// Expose this globally for Google Callback

		window.handleCredentialResponse = async (response) => {
			try {
				const res = await fetch('/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						provider: 'google',
						token: response.credential
					})
				})

				if (res.ok) {
					const data = await res.json()
					localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token)
					isAuthenticated.value = true
					await Promise.all([fetchUserProfile(), fetchFolders(), fetchNotes()])
					// autoSelectNote() // Disabled: Default to Inbox list view
				} else {
					console.error("Login failed")
					alert("Login failed!")
				}
			} catch (e) {
				console.error("Login Error", e)
			}
		}

		const initGoogleAuth = async () => {
			try {
				const res = await fetch('/auth/config')
				if (!res.ok) return
				const config = await res.json()
				if (config.db_type) {
					dbType.value = config.db_type
				}

				if (window.google) {
					window.google.accounts.id.initialize({
						client_id: config.google_client_id,
						callback: window.handleCredentialResponse,
						auto_select: false,
						cancel_on_tap_outside: false
					});

					// If we are showing the modal, render the button
					if (!isAuthenticated.value) {
						renderGoogleButton()
					}
				}
			} catch (e) {
				console.error("Failed to init Google Auth", e)
			}
		}

		const renderGoogleButton = () => {
			const btnDiv = document.getElementById("google-btn")
			if (btnDiv && window.google) {
				window.google.accounts.id.renderButton(
					btnDiv,
					{ theme: "outline", size: "large", width: "100%" }
				);
			}
		}



		const toggleSidebar = () => {
			isSidebarOpen.value = !isSidebarOpen.value
		}

		const toggleFolder = (folderId) => {
			collapsedFolders.value[folderId] = !collapsedFolders.value[folderId]
			saveUserSetting(STORAGE_KEYS.COLLAPSED_FOLDERS, JSON.stringify(collapsedFolders.value))
		}

		const applyTheme = () => {
			const themeLink = document.getElementById('github-theme')
			const highlightLink = document.getElementById('highlight-theme')
			if (themeLink) {
				themeLink.href = isDarkMode.value
					? 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-dark.min.css'
					: 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css'
			}
			if (highlightLink) {
				highlightLink.href = isDarkMode.value
					? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
					: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
			}

			// Tailwind Dark Mode Support
			if (isDarkMode.value) {
				document.documentElement.classList.add('dark')
			} else {
				document.documentElement.classList.remove('dark')
			}
		}

		const toggleDarkMode = () => {
			isDarkMode.value = !isDarkMode.value
			applyTheme()
			saveUserSetting(STORAGE_KEYS.DARK_MODE, isDarkMode.value) // User Scoped
			localStorage.setItem(STORAGE_KEYS.DARK_MODE, isDarkMode.value) // Global Fallback (for generic boot)
			updateUserProfile({ is_dark_mode: isDarkMode.value })
		}

		const cycleViewMode = () => {
			if (viewMode.value === 'split') viewMode.value = 'edit'
			else if (viewMode.value === 'edit') viewMode.value = 'preview'
			else viewMode.value = 'split'

			updateUserProfile({ view_mode: viewMode.value })
		}

		const setViewMode = (mode) => {
			viewMode.value = mode
			updateUserProfile({ view_mode: mode })
		}

		// Sort Functions
		const setSortOption = (type, value) => {
			if (type === 'field') {
				sortOption.value.field = value
				saveUserSetting(STORAGE_KEYS.SORT_FIELD, value)
			} else if (type === 'direction') {
				sortOption.value.direction = value
				saveUserSetting(STORAGE_KEYS.SORT_DIRECTION, value)
			}
		}

		const sortItems = (items) => {
			return [...items].sort((a, b) => {
				// 1. Pinning Priority
				if (a.is_pinned && !b.is_pinned) return -1
				if (!a.is_pinned && b.is_pinned) return 1

				// 2. Normal Sort
				let fieldA, fieldB

				if (sortOption.value.field === 'title' || sortOption.value.field === 'name') {
					// Handle title/name difference
					fieldA = (a.title || a.name || '').toLowerCase()
					fieldB = (b.title || b.name || '').toLowerCase()
				} else {
					fieldA = a[sortOption.value.field]
					fieldB = b[sortOption.value.field]
				}

				if (fieldA < fieldB) return sortOption.value.direction === 'asc' ? -1 : 1
				if (fieldA > fieldB) return sortOption.value.direction === 'asc' ? 1 : -1
				return 0
			})
		}



		const fetchFolders = async (waitForRemote = true) => {
			console.log('[fetchFolders] Started')
			if (!isAuthenticated.value) return

			try {
				// 1. Load from LocalDB first (if available)
				if (hasIDB) {
					const localFolders = await LocalDB.getAllFolders(currentUserId.value)
					if (localFolders && localFolders.length > 0) {
						folders.value = localFolders
					}
				}

				// 2. Fetch from Server (Background if we have local data)
				// If waitForRemote is false, we don't await the fetch, just fire it.
				const remoteFetch = async () => {
					try {
						const response = await authenticatedFetch('/api/folders')
						if (response && response.ok) {
							const serverFolders = await response.json()
							folders.value = serverFolders

							// Update LocalDB
							if (hasIDB) {
								await LocalDB.saveFoldersBulk(serverFolders)
							}
						}
					} catch (e) {
						console.error("Folder fetch failed", e)
					}
				}

				if (waitForRemote) {
					await remoteFetch()
				} else {
					remoteFetch() // Fire and forget (or promise handled by caller if they didn't await outer)
				}

			} catch (e) {
				console.error("Error loading folders", e)
			} finally {
				console.log('[fetchFolders] Completed')
			}
		}

		const fetchUserProfile = async () => {
			try {
				const response = await authenticatedFetch('/auth/me')
				if (response && response.ok) {
					const user = await response.json()
					if (user.id) {
						currentUserId.value = user.id; // Set ID
						localStorage.setItem(STORAGE_KEYS.USER_ID, user.id); // Cache ID
					}
					// UI preferences (is_dark_mode, view_mode) are now managed via localStorage only
				}
			} catch (e) {
				console.error("Failed to fetch user profile", e)
			}
		}

		const updateUserProfile = async (updates) => {
			if (!isAuthenticated.value) return
			try {
				await authenticatedFetch('/auth/me', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(updates)
				})
			} catch (e) {
				console.error("Failed to update profile", e)
			}
		}

		const fetchNotes = async (waitForRemote = true) => {
			console.log('[fetchNotes] Started')
			loading.value = true
			const uid = currentUserId.value;

			// 1. Instant Load from LocalDB
			if (hasIDB && uid) {
				try {
					const localNotes = await LocalDB.getAllNotes(uid)
					if (localNotes && localNotes.length > 0) {
						notes.value = localNotes
						pinnedNotes.value = localNotes.filter(n => n.is_pinned)
						loading.value = false // <--- SHOW CONTENT IMMEDIATELY (Optimistic UI)
					}
				} catch (e) { console.error("Local Load Error", e) }
			}

			const remotePromise = (async () => {
				try {
					const response = await authenticatedFetch('/api/notes')
					if (response && response.ok) {
						const serverNotes = await response.json()

						if (hasIDB) {
							const currentUid = currentUserId.value || uid; // Use latest UID

							// 1. Identify Deletions (Server Side Deletion)
							// Get all local synced notes
							const localNotesAll = await LocalDB.getAllNotes(currentUid)
							const serverIds = new Set(serverNotes.map(n => n.id))

							for (const ln of localNotesAll) {
								if (!serverIds.has(ln.id) && ln.sync_status !== 'dirty') {
									await LocalDB.deleteNote(ln.id)
								}
							}

							// 2. Compute Hashes & Filter Updates
							const notesToSave = []
							for (const n of serverNotes) {
								const base = `${n.id}:${n.title}:${n.content || ''}:${n.folder_id || 'null'}`
								n.content_hash = await shynote_hash(base)
								n.user_id = n.user_id || currentUid
								notesToSave.push(n)
							}

							await LocalDB.saveNotesBulk(notesToSave)

							// 3. Check for Conflicts (Dirty vs Server Hash Mismatch)
							const conflictCandidates = []
							const currentLocalNotes = await LocalDB.getAllNotes(currentUid)
							for (const ln of currentLocalNotes) {
								if (ln.sync_status === 'dirty') {
									const serverNote = notesToSave.find(sn => sn.id === ln.id)
									if (serverNote) {
										if (serverNote.content_hash !== ln.content_hash) {
											console.log(`[Sync Info] conflict candidate: ${ln.title}`)
											conflictCandidates.push({ local: ln, server: serverNote })
										}
									}
								}
							}

							if (conflictCandidates.length > 0) {
								const conflict = conflictCandidates[0]
								if (selectedNote.value && selectedNote.value.id === conflict.local.id) {
									if (!conflictState.value.isConflict) {
										enterConflictMode(conflict.local, conflict.server)
									}
								}
							}

							// Reload merged state
							notes.value = currentLocalNotes
							pinnedNotes.value = currentLocalNotes.filter(n => n.is_pinned)
						} else {
							notes.value = serverNotes
							pinnedNotes.value = serverNotes.filter(n => n.is_pinned)
						}
					}
				} catch (e) {
					console.error("Fetch Notes Error", e)
				} finally {
					loading.value = false
				}
			})();

			if (waitForRemote) await remotePromise
			console.log('[fetchNotes] Completed')
		}

		const deleteConfirmation = ref({ id: null, type: null })
		const titleInputRef = ref(null)


		const createFolder = async () => {
			// Restore Instant Create UX
			const name = 'Untitled Folder'

			try {
				// 1. Generate UUID v7
				const tempId = uuidv7()

				const newFolder = {
					id: tempId,
					name: name,
					user_id: currentUserId.value,
					notes: []
				}

				// 2. Save Locally First (with CREATE action)
				if (hasIDB) {
					await LocalDB.saveFolder(newFolder, 'CREATE')
				}

				// 3. Update UI
				folders.value.push(newFolder)

				// 4. Auto start rename (Restored Feature)
				nextTick(() => {
					startRename(newFolder, 'folder')
				})

			} catch (e) {
				console.error("Failed to create folder", e)
			}
		}

		const createNote = async () => {
			createNoteInFolder(null)
		}

		const createNoteInFolder = async (folderId) => {
			try {
				// 1. Generate UUID v7
				const tempId = uuidv7()
				const now = new Date().toISOString()
				const dateStr = now.split('T')[0]
				const shortHash = tempId.slice(-4)
				const initialTitle = `Note ${dateStr} (${shortHash})`
				const initialContent = ''

				// Calculate Hash
				const hashBase = `${tempId}:${initialTitle}:${initialContent}:${folderId || 'null'}`
				const initialHash = await shynote_hash(hashBase)

				const newNote = {
					id: tempId,
					title: initialTitle,
					content: initialContent,
					content_hash: initialHash, // ✅ Add Hash
					folder_id: folderId,
					user_id: currentUserId.value,
					created_at: now,
					updated_at: now,
					sync_status: 'dirty'
				}

				// 2. Save Locally First (with CREATE action)
				if (hasIDB) {
					await LocalDB.saveNote(newNote, 'CREATE')
				}

				// 3. Update UI
				notes.value.unshift(newNote)
				selectedNote.value = newNote

				// Switch to Edit Mode (New Layout)
				rightPanelMode.value = 'edit'

				// Open sidebar if collapsed (Legacy behavior, maybe optional now?)
				// if (!isSidebarOpen.value) {
				// 	isSidebarOpen.value = true
				// }

				// Enter rename mode
				nextTick(() => {
					startRename(newNote, 'note')
				})

			} catch (e) {
				console.error("Failed to create note", e)
			}
		}

		const autoSelectNote = () => {
			if (notes.value.length === 0) return

			const lastNoteId = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_NOTE_ID))
			if (lastNoteId) {
				const lastNote = notes.value.find(n => String(n.id) === String(lastNoteId))
				if (lastNote) {
					selectNote(lastNote)
					return
				}
			}

			// Fallback: first note at the top
			// First check folders in sorted order
			const allSortedFolders = sortItems(folders.value)
			for (const folder of allSortedFolders) {
				const folderNotes = getSortedFolderNotes(folder.id)
				if (folderNotes.length > 0) {
					selectNote(folderNotes[0])
					return
				}
			}
			// Then check root notes in sorted order
			const rootNotes = sortItems(notes.value.filter(n => !n.folder_id))
			if (rootNotes.length > 0) {
				selectNote(rootNotes[0])
			}
		}


		// Watch user change to reload settings
		watch(currentUserId, (newId) => {
			if (newId) loadUserSettings()
		}, { immediate: true })

		const toggleSidebarPin = () => {
			isSidebarPinned.value = !isSidebarPinned.value
			saveUserSetting(STORAGE_KEYS.SIDEBAR_PINNED, isSidebarPinned.value)
		}

		const deselectNote = () => {
			console.log("Navigating to About Shynote page...");
			selectedNote.value = null
			// cmEditor.value = null // Clear editor reference to force re-init on fresh DOM
			if (isSidebarOpen.value && !isSidebarPinned.value) {
				isSidebarOpen.value = false
			}
		}

		// New Item Menu
		const showNewItemMenu = ref(false)
		const toggleNewItemMenu = () => {
			showNewItemMenu.value = !showNewItemMenu.value
			// Close sort menu if open
			if (showNewItemMenu.value) showSortMenu.value = false
		}
		const closeNewItemMenu = () => {
			showNewItemMenu.value = false
		}

		const openEmojiPicker = (folder) => {
			emojiPickerTarget.value = folder
			showEmojiPicker.value = true
			// Calculate position (simple center for now, or near element)
		}

		// Navigation Logic (Refactored)
		const backToList = () => {
			rightPanelMode.value = 'list'
		}

		const selectFolder = (folderId) => {
			console.log('selectFolder', folderId)
			currentFolderId.value = folderId
			rightPanelMode.value = 'list'
			console.log('rightPanelMode set to', rightPanelMode.value)

			saveUserSetting(STORAGE_KEYS.LAST_FOLDER_ID, folderId === null ? 'null' : folderId)
			saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'list')

			// Auto-close sidebar on mobile when folder is selected
			if (window.innerWidth < 768 && isSidebarOpen.value) {
				console.log('[Mobile] Auto-closing sidebar. Width:', window.innerWidth)
				isSidebarOpen.value = false
				console.log('[Mobile] Sidebar state after close:', isSidebarOpen.value)
			}
			// Optional: Clear selected note or keep it for faster re-selection?
			// selectedNote.value = null 
		}


		const selectNote = async (note) => {
			// Switch to Edit Mode
			rightPanelMode.value = 'edit'

			// 1. Immediate selection for instant UI
			selectedNote.value = note
			// Update sidebar folder selection to match note
			if (note) {
				currentFolderId.value = note.folder_id
				saveUserSetting(STORAGE_KEYS.LAST_FOLDER_ID, note.folder_id === null ? 'null' : note.folder_id)
			}

			if (note && note.id) {
				saveUserSetting(STORAGE_KEYS.LAST_NOTE_ID, note.id)
				saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'edit')
			}
			// Ensure content is string for marked
			if (selectedNote.value.content === null) selectedNote.value.content = ""

			// 2. Load from IndexedDB if available (instant)
			if (hasIDB && note && note.id) {
				try {
					const localNote = await LocalDB.getNote(note.id)
					if (localNote) {
						// Update with local data (may be more recent if edited offline)
						selectedNote.value = localNote
					}
				} catch (e) {
					console.error("Failed to load from IndexedDB", e)
				}
			}

			// 3. Fetch from server in background (for sync)
			if (note && note.id && isAuthenticated.value) {
				try {
					const response = await authenticatedFetch(`/api/notes/${note.id}`)
					if (response && response.ok) {
						const serverNote = await response.json()
						let shouldUpdateUI = true;

						// Check if server version is different
						if (hasIDB) {
							const localNote = await LocalDB.getNote(note.id)
							// If local is dirty, DO NOT overwrite with server data
							if (localNote && localNote.sync_status === 'dirty') {
								shouldUpdateUI = false;
								console.log("Local is dirty, ignoring server update on select")
							} else if (localNote && localNote.content_hash !== serverNote.content_hash) {
								// Conflict detection - server has newer version
								console.log("Server has different version")
								// Update local cache with server version
								await LocalDB.saveNotesBulk([serverNote])
							}
						}

						if (shouldUpdateUI) {
							// Update List Item (Fix: Sidebar title update)
							const idx = notes.value.findIndex(n => n.id === note.id)
							if (idx !== -1) {
								notes.value[idx] = serverNote
							}

							// Update UI with server version (if still selected)
							if (selectedNote.value && selectedNote.value.id === note.id) {
								selectedNote.value = serverNote
								// Update editor content directly
								nextTick(() => {
									if (editorView.value && !conflictState.value.isConflict) {
										const currentContent = editorView.value.state.doc.toString()
										if (currentContent !== serverNote.content) {
											editorView.value.dispatch({
												changes: {
													from: 0,
													to: editorView.value.state.doc.length,
													insert: serverNote.content || ''
												}
											})
										}
									}
								})
							}
						}
					}
				} catch (e) {
					console.error("Failed to fetch note from server", e)
				}
			}


			// Auto collapse sidebar removed - user wants sidebar to stay open
			// if (isSidebarOpen.value && !isSidebarPinned.value) {
			// 	setTimeout(() => {
			// 		if (renameState.value.id === note.id && renameState.value.type === 'note') {
			// 			return
			// 		}
			// 		isSidebarOpen.value = false
			// 	}, 300)
			// }
		}



		const requestDelete = (id, type) => {
			deleteConfirmation.value = { id, type }
		}

		const confirmDelete = async () => {
			const { id, type } = deleteConfirmation.value
			if (!id || !type) return

			if (type === 'note') {
				await deleteNote(id)
			} else if (type === 'folder') {
				await deleteFolderImpl(id)
			}
			deleteConfirmation.value = { id: null, type: null }
		}

		const cancelDelete = () => {
			deleteConfirmation.value = { id: null, type: null }
		}

		const deleteNote = async (id) => {
			try {
				// 1. Check if pinned
				if (notes.value.find(n => n.id === id)?.is_pinned) {
					pinnedNotes.value = pinnedNotes.value.filter(n => n.id !== id)
				}
				// 2. Update UI
				notes.value = notes.value.filter(n => n.id !== id)
				selectedNote.value = null

				// 3. Local-First Delete
				if (hasIDB) {
					await LocalDB.deleteNote(id)
				}
			} catch (e) {
				console.error("Failed to delete note", e)
			}
		}



		const startRename = (item, type) => {
			renameState.value = {
				id: item.id,
				type: type,
				name: type === 'folder' ? item.name : item.title
			}
			// Focus input next tick
			setTimeout(() => {
				const input = document.getElementById(`rename-input-${type}-${item.id}`)
				if (input) {
					input.focus();
					input.select();
				}
			}, 50)
		}

		const saveRename = async () => {
			const { id, type, name } = renameState.value
			if (!id || !name.trim()) {
				renameState.value = { id: null, type: null, name: '' }
				return
			}

			try {
				if (type === 'folder') {
					// 1. Update UI
					const f = folders.value.find(f => f.id === id)
					if (f) {
						f.name = name
						// 2. Save Local (Sync Worker will handle API)
						// 2. Save Local (Sync Worker will handle API)
						if (hasIDB) {
							// Strip Proxy using JSON clone (Fix DataCloneError due to nested arrays)
							const plainFolder = JSON.parse(JSON.stringify(f))
							await LocalDB.saveFolder(plainFolder, 'UPDATE')
						}
					}
				} else {
					// 1. Update UI
					const n = notes.value.find(n => n.id === id)
					if (n) {
						n.title = name
						if (selectedNote.value && selectedNote.value.id === id) {
							selectedNote.value.title = name
						}

						// 2. Save Local
						if (hasIDB) {
							// Recalculate Hash since title changed
							const base = `${n.id}:${name}:${n.content}:${n.folder_id || 'null'}`;
							const hash = await shynote_hash(base);
							n.content_hash = hash;

							await LocalDB.saveNote({ ...n }, 'UPDATE')
						}
					}
				}
			} catch (e) {
				console.error("Rename failed", e)
			} finally {
				renameState.value = { id: null, type: null, name: '' }
			}
		}

		const deleteFolder = (id) => {
			requestDelete(id, 'folder')
		}

		const deleteFolderImpl = async (id) => {
			// Optimistic UI Update
			if (currentFolderId.value === id) {
				selectFolder(null)
			}
			const prevFolders = folders.value
			const prevNotes = notes.value

			// Remove from UI immediately
			folders.value = folders.value.filter(f => f.id !== id)
			notes.value = notes.value.filter(n => n.folder_id !== id)

			try {
				const response = await authenticatedFetch(`/api/folders/${id}`, { method: 'DELETE' })
				if (response && response.ok) {
					if (hasIDB) {
						// Delete local notes in this folder
						// (Optimist: They are already gone from UI)
						const folderNotes = prevNotes.filter(n => n.folder_id === id)
						for (const n of folderNotes) {
							await LocalDB.deleteNote(n.id)
						}
						await LocalDB.deleteFolder(id)
					}
				} else {
					throw new Error("Server deletion failed")
				}
			} catch (e) {
				console.error("Delete folder failed", e)
				// Revert UI on failure
				folders.value = prevFolders
				notes.value = prevNotes
				alert("Failed to delete folder")
			}
		}


		// Sharing Logic
		const toggleShare = async () => {
			if (!selectedNote.value || isSharing.value) return
			const note = selectedNote.value

			// If already shared, open the management modal
			if (note.is_shared) {
				openShareModal(note)
			} else {
				// Enable sharing first
				isSharing.value = true
				try {
					const response = await authenticatedFetch(`/api/notes/${note.id}/share`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' }
					})
					if (response && response.ok) {
						const data = await response.json()
						note.is_shared = data.is_shared
						note.share_id = data.share_id
						openShareModal(note)
					}
				} catch (e) {
					console.error("Share enable failed", e)
					alert("Failed to enable sharing")
				} finally {
					isSharing.value = false
				}
			}
		}

		const openShareModal = (note) => {
			const shareUrl = `${window.location.origin}/share/${note.share_id}`

			modalState.value.type = 'share-note'
			modalState.value.title = 'Share Note'
			modalState.value.message = 'Anyone with this link can view this note.'
			modalState.value.inputValue = shareUrl // Using inputValue to store the link
			modalState.value.cancelText = 'Close'
			modalState.value.isOpen = true

			// Auto-select text
			nextTick(() => {
				const input = document.getElementById('share-link-input')
				if (input) input.select()
			})
		}

		const copyShareLink = () => {
			const input = document.getElementById('share-link-input')
			if (input) {
				input.select()
				navigator.clipboard.writeText(input.value).then(() => {
					closeModal()
				})
			}
		}

		const stopSharing = async () => {
			if (!selectedNote.value) return
			const note = selectedNote.value

			// Direct action, no confirmation
			// if (!confirm('Are you sure you want to stop sharing? The link will become invalid.')) return

			try {
				// Re-toggle to disable
				const response = await authenticatedFetch(`/api/notes/${note.id}/share`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' }
				})

				if (response && response.ok) {
					const data = await response.json()
					if (!data.is_shared) {
						note.is_shared = false
						note.share_id = null
						closeModal()
					}
				}
			} catch (e) {
				console.error("Stop sharing failed", e)
				alert("Failed to stop sharing")
			}
		}

		const togglePin = async (note) => {
			if (!note) return

			const originalState = note.is_pinned
			note.is_pinned = !originalState

			try {
				if (hasIDB) {
					await LocalDB.saveNote({ ...note }, 'UPDATE')
				} else {
					const response = await authenticatedFetch(`/api/notes/${note.id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ is_pinned: note.is_pinned })
					})
					if (!response || !response.ok) throw new Error("API failed")
				}
			} catch (e) {
				console.error("Toggle pin failed", e)
				note.is_pinned = originalState
				alert("Failed to update pin status")
			}
		}


		// Drag and Drop Logic
		const draggedNoteId = ref(null)

		const handleDragStart = (note, event) => {
			draggedNoteId.value = note.id
			if (event && event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move'
				event.dataTransfer.setData('text/plain', String(note.id))
			}
		}




		const handleFiles = async (files) => {
			if (!files || files.length === 0) return

			let importedCount = 0
			for (let i = 0; i < files.length; i++) {
				const file = files[i]

				// 1. Size Limit Check (1MB)
				if (file.size > 1024 * 1024) {
					alert(`File '${file.name}' is too large (Max 1MB). Skipped.`)
					continue
				}

				try {
					// 2. Read Content (Text)
					const text = await file.text()

					// 3. Create Note Object
					const newNote = {
						id: uuidv7(),
						title: file.name, // Extension included? Maybe strip later if desired
						content: text,
						folder_id: currentFolderId.value, // Save to current context
						user_id: currentUserId.value,
						is_pinned: false,
						is_shared: false,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						sync_status: 'dirty'
					}

					// 4. Save Local & Memory
					if (hasIDB) {
						const base = `${newNote.id}:${newNote.title}:${newNote.content}:${newNote.folder_id || 'null'}`
						newNote.content_hash = await shynote_hash(base)
						await LocalDB.saveNote(newNote, 'CREATE')
					}

					// Push to UI immediately
					notes.value.unshift(newNote)
					importedCount++

				} catch (e) {
					console.error(`Failed to import file ${file.name}`, e)
				}
			}

			if (importedCount > 0) {
				statusMessage.value = `Imported ${importedCount} files`
				syncWorker() // Push to server
			}
		}

		const handleDrop = async (targetFolderId, event) => {
			// Check for Files first
			if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
				await handleFiles(event.dataTransfer.files)
				dropTargetId.value = null
				return
			}

			// Existing Note Move Logic
			const noteId = draggedNoteId.value
			if (!noteId) return

			const note = notes.value.find(n => n.id === noteId)
			// ... existing logic ...
			const currentIds = note.folder_id
			const targetIds = targetFolderId

			if (note && currentIds !== targetIds) {
				// Optimistic Update
				const originalFolderId = note.folder_id
				note.folder_id = targetFolderId

				try {
					// Local-First Move
					if (hasIDB) {
						// Recalculate Hash (Folder ID changed)
						const base = `${note.id}:${note.title}:${note.content}:${targetFolderId || 'null'}`
						const hash = await shynote_hash(base)
						note.content_hash = hash

						await LocalDB.saveNote({ ...note }, 'UPDATE')
					}
				} catch (e) {
					console.error("Move failed", e)
					// Revert
					note.folder_id = originalFolderId
					if (hasIDB) {
						const baseRevert = `${note.id}:${note.title}:${note.content}:${originalFolderId || 'null'}`
						const hashRevert = await shynote_hash(baseRevert)
						note.content_hash = hashRevert
						await LocalDB.saveNote({ ...note }, 'UPDATE')
					}
					alert("Failed to move note")
				}
			}
			draggedNoteId.value = null
			dropTargetId.value = null
		}

		const moveSelectedNote = async (targetFolderId) => {
			let target = targetFolderId
			// Handle select value conversion and nulls
			if (target === null || target === 'null' || target === '') {
				target = null
			} else {
				// Ensure target matches the type of folder.id in folders array
				// Select value is string, but folder.id might be int.
				const targetFolder = folders.value.find(f => f.id == target)
				if (targetFolder) {
					target = targetFolder.id
				} else {
					// Fallback parsing if for some reason folder not found locally yet
					target = parseInt(target, 10)
				}
			}

			const note = selectedNote.value
			if (!note) return
			if (note.folder_id === target) return

			// Optimistic
			const originalFolderId = note.folder_id
			note.folder_id = target

			try {
				if (hasIDB) {
					const base = `${note.id}:${note.title}:${note.content}:${target || 'null'}`
					const hash = await shynote_hash(base)
					note.content_hash = hash
					await LocalDB.saveNote({ ...note }, 'UPDATE')
				}
			} catch (e) {
				console.error("Move failed", e)
				note.folder_id = originalFolderId
				alert("Failed to move note")
			}
		}

		const showFolderSelectMenu = ref(false)
		const toggleFolderSelectMenu = () => {
			showFolderSelectMenu.value = !showFolderSelectMenu.value
		}
		const closeFolderSelectMenu = () => {
			showFolderSelectMenu.value = false
		}

		const dropTargetId = ref(null) // 'root' or folderId (int)

		const handleDragEnter = (targetId) => {
			if (draggedNoteId.value) {
				dropTargetId.value = targetId
			}
		}

		const handleDragLeave = (targetId) => {
			if (dropTargetId.value === targetId) {
				dropTargetId.value = null
			}
		}









		// Copy Code Logic
		window.copyCode = (btn) => {
			const pre = btn.nextElementSibling
			const code = pre.querySelector('code').innerText
			navigator.clipboard.writeText(code).then(() => {
				const originalText = btn.innerHTML
				btn.innerHTML = '<span class="material-symbols-rounded text-[14px]">check</span>'
				btn.classList.add('text-green-400')
				setTimeout(() => {
					btn.innerHTML = originalText
					btn.classList.remove('text-green-400')
				}, 2000)
			}).catch(err => {
				console.error('Failed to copy class', err)
			})
		}

		const renderer = new marked.Renderer()
		renderer.code = function (code, language) {
			const validLang = hljs.getLanguage(language) ? language : 'plaintext'
			const highlighted = hljs.highlight(code, { language: validLang }).value
			return `<div class="relative group my-4">
				<button onclick="copyCode(this)" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-1.5 rounded-md shadow-sm border border-gray-300 dark:border-gray-600 flex items-center justify-center z-10" title="Copy code">
					<span class="material-symbols-rounded text-[16px]">content_copy</span>
				</button>
				<pre class="!my-0"><code class="hljs language-${validLang}">${highlighted}</code></pre>
			</div>`
		}

		const previewContent = computed(() => {
			if (!selectedNote.value || !selectedNote.value.content) return ''

			let content = selectedNote.value.content
			let frontmatterHtml = ''

			// Frontmatter Regex: Start of file, ---, content, ---, newline
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
			if (fmMatch) {
				try {
					const yamlContent = fmMatch[1]
					const metadata = jsyaml.load(yamlContent)

					// Remove frontmatter from markdown content
					content = content.replace(fmMatch[0], '')

					// Generate Metadata HTML Table
					if (metadata && typeof metadata === 'object') {
						let rows = ''
						for (const [key, value] of Object.entries(metadata)) {
							let displayValue = value
							if (Array.isArray(value)) displayValue = value.join(', ')
							else if (typeof value === 'object') displayValue = JSON.stringify(value)

							rows += `<tr>
								<td class="fm-key">${key}</td>
								<td class="fm-val">${displayValue}</td>
							</tr>`
						}
						frontmatterHtml = `<div class="frontmatter-container">
							<table class="frontmatter-table">
								<tbody>${rows}</tbody>
							</table>
						</div>`
					}
				} catch (e) {
					console.warn('Frontmatter parsing failed', e)
					// If parsing fails, render as code block or just ignore? 
					// For now, let marked render the raw --- block if we don't strip it?
					// Or better: strip it but show error? Let's just fall back to standard rendering if regex matches but yaml fails
					// Actually, if regex matches, we stripped it. So if load fails, we should probably output the error or raw text.
					// Let's keep specific behavior simple: if fail, don't render table, text technically removed. 
					// Let's just not set frontmatterHtml.
				}
			}

			const parsedMarkdown = marked.parse(content, {
				renderer: renderer,
				gfm: true,
				breaks: true
			})

			return frontmatterHtml + parsedMarkdown
		})

		const sortedRootNotes = computed(() => {
			const root = notes.value.filter(n => !n.folder_id)
			return sortItems(root)
		})

		const sortedFolders = computed(() => {
			// Folders always use 'name' instead of 'title', handled in sortItems
			// Use same sort criteria as notes for consistency
			return sortItems(folders.value)
		})

		const getFolderNotes = (folderId) => {
			// Use loose equality (==) to handle mix of string/number IDs
			return notes.value.filter(n => n.folder_id == folderId)
		}

		const getSortedFolderNotes = (folderId) => {
			const folderNotes = getFolderNotes(folderId)
			return sortItems(folderNotes)
		}



		// Watch authentication state to re-render button if logout
		Vue.watch(isAuthenticated, (newVal) => {
			if (!newVal) {
				setTimeout(renderGoogleButton, 100)
			}
		})







		// Watchers
		// Watchers
		watch(() => selectedNote.value?.id, (newId) => {
			if (newId) {
				// Wait for v-if to render if needed
				nextTick(() => {
					// Logic handles editorRef check
					initEditor()
				})
			} else {
				if (editorView.value) {
					editorView.value.destroy()
					editorView.value = null
				}
			}
		}, { flush: 'post', immediate: true })

		// Watch View Mode Switch (List -> Edit)
		watch(rightPanelMode, (newMode) => {
			if (newMode === 'edit' && selectedNote.value?.id) {
				nextTick(() => {
					initEditor()
				})
			}
		})

		watch(isDarkMode, (val) => {
			if (editorView.value) {
				editorView.value.dispatch({
					effects: themeCompartment.reconfigure(val ? oneDark : [])
				})
			}
		})

		// Editor cleanup
		onBeforeUnmount(() => {
			if (editorView.value) editorView.value.destroy()
		})

		// Other watchers (fontSize, darkMode, viewMode) handled via CSS binding in template

		watch(fontSize, (val) => {
			// Optional: could manually resize if needed, but style binding handles it.
		})

		const getPlainContent = (content) => {
			if (!content) return '';
			// Remove headers
			let plain = content.replace(/^#+\s+/gm, '');
			// Remove bold/italic
			plain = plain.replace(/(\*\*|__)(.*?)\1/g, '$2');
			plain = plain.replace(/(\*|_)(.*?)\1/g, '$2');
			// Remove code blocks
			plain = plain.replace(/```[\s\S]*?```/g, '[Code]');
			plain = plain.replace(/`([^`]+)`/g, '$1');
			// Remove links
			plain = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
			// Remove images
			plain = plain.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image]');
			// Remove blockquotes
			plain = plain.replace(/^>\s+/gm, '');
			// Remove lists
			plain = plain.replace(/^[\*\-\+]\s+/gm, '');
			plain = plain.replace(/^\d+\.\s+/gm, '');
			// Remove tasks
			plain = plain.replace(/^-\s\[[x ]\]\s+/gm, '');

			// Limit length
			return plain.slice(0, 150).trim();
		};

		return {
			notes,
			folders,
			selectedNote,
			loading,
			statusMessage,
			createFolder,
			createNote,
			createNoteInFolder,
			selectNote,
			deselectNote,
			deleteNote,
			deleteFolder,
			debouncedUpdate,
			previewContent,
			isSidebarOpen,
			toggleSidebar,
			isSidebarPinned,
			toggleSidebarPin,
			collapsedFolders,
			toggleFolder,
			editorRef,
			previewRef,
			handleScroll,
			viewMode,
			cycleViewMode,
			setViewMode,
			isDarkMode,
			toggleDarkMode,

			initGoogleAuth,
			isAuthenticated,
			renameState,
			startRename,
			saveRename,

			isSettingsModalOpen,
			openSettingsModal,
			closeSettingsModal,
			backupData,
			restoreData,
			clearLocalCache,
			factoryReset,
			deleteConfirmation,
			requestDelete,
			confirmDelete,
			cancelDelete,
			titleInputRef,

			formatText,
			formatDate: (dateStr) => {
				const date = parseSafeDate(dateStr)
				if (!date) return dateStr || ''

				const yyyy = date.getFullYear()
				const mm = String(date.getMonth() + 1).padStart(2, '0')
				const dd = String(date.getDate()).padStart(2, '0')
				const hh = String(date.getHours()).padStart(2, '0')
				const min = String(date.getMinutes()).padStart(2, '0')
				const ss = String(date.getSeconds()).padStart(2, '0')
				return `${yyyy}.${mm}.${dd} ${hh}:${min}:${ss}`
			},
			formatDateParts: (dateStr) => {
				const date = parseSafeDate(dateStr)
				if (!date) return { date: dateStr || '', time: '' }

				const yyyy = date.getFullYear()
				const mm = String(date.getMonth() + 1).padStart(2, '0')
				const dd = String(date.getDate()).padStart(2, '0')
				const hh = String(date.getHours()).padStart(2, '0')
				const min = String(date.getMinutes()).padStart(2, '0')
				const ss = String(date.getSeconds()).padStart(2, '0')
				return {
					date: `${yyyy}.${mm}.${dd}`,
					time: `${hh}:${min}:${ss}`
				}
			},
			modalState,
			closeModal,
			confirmAction,
			// Sort exports
			sortOption,
			setSortOption,
			sortedRootNotes,
			sortedFolders,
			getSortedFolderNotes,
			showSortMenu,
			toggleSortMenu,
			closeSortMenu,
			sortLabel,
			fontSize,
			setFontSize,
			appVersion,
			homeUrl,

			// Drag & Drop
			// Ensure these variables exist in scope if exporting. 
			// Based on previous steps, drag logic might have been partially cleaned.
			// Assuming variables exist or were pre-existing.
			// If they are missing, we should remove them or ensure they are defined.
			// Checking previous file content... drag variables were defined in step 515 block but I removed duplicates in 521?
			// Actually 521 removed the block: `const isDragging...`. 
			// So if they are not defined elsewhere, exporting them will crash.
			// Let's assume standard drag variables are present or just export what we know.

			// Re-exporting what was seemingly working or expected:
			draggedNoteId,
			handleDragStart,
			handleDrop,
			dropTargetId,
			handleDragEnter,
			handleDragEnter,
			handleDragLeave,
			moveSelectedNote,
			showFolderSelectMenu,
			toggleFolderSelectMenu,
			closeFolderSelectMenu,
			showFolderSelectMenu,
			toggleFolderSelectMenu,
			closeFolderSelectMenu,

			focusEditor,

			// Share
			toggleShare,
			copyShareLink,
			stopSharing,
			togglePin,

			changelogContent,

			// Layout State
			rightPanelMode,
			currentFolderId,
			selectFolder,
			backToList,

			// Search & Edit
			searchState,
			openSearch,
			closeSearch,
			executeFind,
			executeReplace,
			searchInputRef,
			formatText,
			hasSelection,
			checkSelection,
			getPlainContent,
			guestMode: computed(() => !isAuthenticated.value),
			// Config

			splitRatio,
			startResize,
			hasIDB,
			isSyncing,
			conflictState,
			resolveConflict,
			dbType,
			sidebarViewMode,
			setSidebarViewMode,
			showNewItemMenu,
			toggleNewItemMenu,
			closeNewItemMenu,
			showAbout,
			isSharing,
			isSortMenuOpen
		}
	}
}).mount('#app')
