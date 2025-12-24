import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, crosshairCursor, lineNumbers, highlightActiveLineGutter, placeholder } from "https://esm.sh/@codemirror/view@6.23.0?deps=@codemirror/state@6.4.0"
import { EditorState, Compartment, EditorSelection } from "https://esm.sh/@codemirror/state@6.4.0"
import { markdown, markdownLanguage } from "https://esm.sh/@codemirror/lang-markdown@6.2.3?deps=@codemirror/state@6.4.0"
import { languages } from "https://esm.sh/@codemirror/language-data@6.4.0?deps=@codemirror/state@6.4.0"
import { defaultKeymap, history, historyKeymap } from "https://esm.sh/@codemirror/commands@6.3.3?deps=@codemirror/state@6.4.0"
import { search, searchKeymap, highlightSelectionMatches, setSearchQuery, SearchQuery, findNext, findPrevious } from "https://esm.sh/@codemirror/search@6.5.5?deps=@codemirror/state@6.4.0"
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2?deps=@codemirror/state@6.4.0"
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "https://esm.sh/@codemirror/language@6.10.0?deps=@codemirror/state@6.4.0"
import { closeBrackets, closeBracketsKeymap } from "https://esm.sh/@codemirror/autocomplete@6.12.0?deps=@codemirror/state@6.4.0"
import { LocalDB } from "./local_db.js"

const { createApp, ref, onMounted, computed, nextTick, watch, onBeforeUnmount } = Vue

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

			SPLIT_RATIO: 'shynote_split_ratio'
		}

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
		const folders = ref([])
		const selectedNote = ref(null)
		const loading = ref(false)
		const statusMessage = ref('Ready')
		const isSidebarOpen = ref(true)
		const isSidebarPinned = ref(false) // Init defaults
		const editorRef = ref(null)
		const previewRef = ref(null)
		const viewMode = ref('split')

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

		const currentUserId = ref(null)

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
					} catch (e) {
						console.error("Local save failed", e)
						statusMessage.value = 'Error saving'
					}
				} else {
					await updateNote()
				}
			}, 1000)
		}

		const syncWorker = async () => {
			if (!hasIDB || isSyncing.value || !isAuthenticated.value) return
			isSyncing.value = true
			try {
				const logs = await LocalDB.getPendingLogs()
				if (logs && logs.length > 0) {
					const latestUpdates = {}
					for (const log of logs) {
						if (log.entity === 'note') latestUpdates[log.entity_id] = log
					}

					for (const log of Object.values(latestUpdates)) {
						const { title, content, folder_id } = log.payload
						const response = await authenticatedFetch(`/api/notes/${log.entity_id}`, {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ title, content, folder_id })
						})

						if (response && response.ok) {
							const processedLogs = logs.filter(l => l.entity_id === log.entity_id && l.id <= log.id)
							for (const pl of processedLogs) {
								await LocalDB.removeLog(pl.id)
							}
							await LocalDB.markNoteSynced(log.entity_id)
							if (statusMessage.value === 'Saved locally') {
								statusMessage.value = 'Synced'
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

			const startState = EditorState.create({
				doc: selectedNote.value ? (selectedNote.value.content || '') : '',
				extensions: [
					keymap.of([...defaultKeymap, ...historyKeymap]), // Standard keys
					history(),
					drawSelection(),
					search({ top: true }),
					dropCursor(),
					EditorState.allowMultipleSelections.of(true),
					markdown({ base: markdownLanguage }), // Markdown logic
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
						{ key: "Mod-s", run: () => { updateNote(); return true } },
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
				default:
					// Fallback to more complex logic below
					break;
			}

			if (wrap) {
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					// Simple Toggle Logic (check outer)
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

			// Headings
			if (type.startsWith('h')) {
				const level = parseInt(type.replace('h', ''))
				const prefix = '#'.repeat(level) + ' '

				const transaction = view.state.changeByRange(range => {
					const line = view.state.doc.lineAt(range.from)
					// Check if already has heading
					const match = line.text.match(/^#+ /)
					let newText = prefix + line.text.replace(/^#+ /, '')
					if (match && match[0] === prefix) {
						// Toggle off if same level? Or just keep? Let's just set it ensures it is that level.
						// If same, maybe remove? 
						if (line.text.startsWith(prefix)) newText = line.text.substring(prefix.length)
					}

					return {
						changes: { from: line.from, to: line.to, insert: newText },
						range: EditorSelection.range(range.from + (newText.length - line.text.length), range.to + (newText.length - line.text.length))
					}
				})
				view.dispatch(transaction)
				return
			}

			if (type === 'codeblock') {
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					return {
						changes: { from: range.from, to: range.to, insert: "```\n" + slice + "\n```" },
						range: EditorSelection.range(range.from + 4, range.from + 4 + slice.length)
					}
				})
				view.dispatch(transaction)
			}

			if (type === 'link') {
				const url = prompt('Link URL:', 'https://')
				if (!url) return
				const transaction = view.state.changeByRange(range => {
					const slice = view.state.sliceDoc(range.from, range.to)
					const insert = `[${slice}](${url})`
					return {
						changes: { from: range.from, to: range.to, insert: insert },
						range: EditorSelection.range(range.from + insert.length, range.from + insert.length)
					}
				})
				view.dispatch(transaction)
			}
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
				const res = await fetch('/static/config.json?v=' + Date.now())
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

		// Modal State
		const modalState = ref({
			isOpen: false,
			type: null,
			title: '',
			message: '',
			inputValue: '',
			targetId: null,
			confirmText: 'Confirm',
			cancelText: 'Cancel'
		})

		const openModal = (type, targetId = null) => {
			modalState.value.type = type
			modalState.value.targetId = targetId
			modalState.value.isOpen = true
			modalState.value.inputValue = ''

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
			}

			if (type === 'create-folder') {
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
				await deleteNoteImpl(targetId)
			} else if (type === 'delete-folder') {
				await deleteFolderImpl(targetId)
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
				autoSelectNote();
			} else if (storedToken === 'guest' && !isGuestMode) {
				logout();
			} else if (storedToken) {
				isAuthenticated.value = true;
				await fetchUserProfile(); // Fetches and sets currentUserId
				await fetchFolders();
				await fetchNotes();
				autoSelectNote();
			} else {
				isAuthenticated.value = false;
			}
		}

		onMounted(async () => {
			await checkAuth()
			fetchAppConfig()
			fetchChangelog()
			initGoogleAuth()

			// Global Esc Key Listener for Modals
			window.addEventListener('keydown', (e) => {
				if (e.key === 'Escape' && modalState.value.isOpen) {
					closeModal()
				}
			})

			if (localStorage.getItem(STORAGE_KEYS.DARK_MODE) === null) {
				if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
					isDarkMode.value = true
					localStorage.setItem(STORAGE_KEYS.DARK_MODE, 'true')
				}
			}
			if (isDarkMode.value) document.documentElement.classList.add('dark')
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
					autoSelectNote()
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
					? 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-dark.min.css'
					: 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css'
			}
			if (highlightLink) {
				highlightLink.href = isDarkMode.value
					? 'https://unpkg.com/nord-highlightjs@0.1/dist/nord.css'
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



		const fetchFolders = async () => {
			const uid = currentUserId.value;
			if (hasIDB && uid) {
				try {
					const local = await LocalDB.getAllFolders(uid)
					if (local && local.length > 0) folders.value = local
				} catch (e) { console.error("Local Folders Error", e) }
			}
			try {
				const response = await authenticatedFetch('/api/folders')
				if (response && response.ok) {
					const data = await response.json()
					folders.value = data

					// Inject user_id if missing (e.g. from server)
					if (hasIDB && uid) {
						const foldersToSave = data.map(f => ({ ...f, user_id: f.user_id || uid }))
						await LocalDB.saveFoldersBulk(foldersToSave)
					}
				}
			} catch (e) {
				console.error("Failed to fetch folders", e)
			}
		}

		const fetchUserProfile = async () => {
			try {
				const response = await authenticatedFetch('/auth/me')
				if (response && response.ok) {
					const user = await response.json()
					if (user.id) currentUserId.value = user.id; // Set ID
					if (user.is_dark_mode !== undefined) {
						isDarkMode.value = user.is_dark_mode
						applyTheme()
					}
					if (user.view_mode) {
						viewMode.value = user.view_mode
					}
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

		const fetchNotes = async () => {
			loading.value = true
			const uid = currentUserId.value;

			// 1. Instant Load from LocalDB
			if (hasIDB && uid) {
				try {
					const localNotes = await LocalDB.getAllNotes(uid)
					if (localNotes && localNotes.length > 0) {
						notes.value = localNotes
					}
				} catch (e) { console.error("Local Load Error", e) }
			}

			try {
				const response = await authenticatedFetch('/api/notes')
				if (response && response.ok) {
					const serverNotes = await response.json()

					if (hasIDB && uid) {
						// Inject user_id if missing
						const notesToSave = serverNotes.map(n => ({ ...n, user_id: n.user_id || uid }))
						await LocalDB.saveNotesBulk(notesToSave)

						// Reload merged state strictly for this user
						notes.value = await LocalDB.getAllNotes(uid)
					} else {
						notes.value = serverNotes
					}
				}
			} catch (e) {
				console.error("Failed to fetch notes", e)
			} finally {
				loading.value = false
			}
		}

		const createFolder = () => {
			openModal('create-folder')
		}

		const createFolderImpl = async (name) => {
			try {
				const response = await authenticatedFetch('/api/folders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name })
				})
				if (response && response.ok) {
					fetchFolders()
				}
			} catch (e) {
				console.error("Failed to create folder", e)
			}
		}

		const createNote = async () => {
			createNoteInFolder(null)
		}

		const createNoteInFolder = async (folderId) => {
			try {
				const response = await authenticatedFetch('/api/notes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: '', content: '', folder_id: folderId })
				})
				if (response && response.ok) {
					const newNote = await response.json()
					// Ensure user_id is locally present if server didn't send it back (though it usually does)
					if (!newNote.user_id && currentUserId.value) newNote.user_id = currentUserId.value;

					notes.value.unshift(newNote)
					selectedNote.value = newNote

					// Persist new note locally
					if (hasIDB) {
						await LocalDB.saveNote(newNote)
					}
				}
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

		const selectNote = (note) => {
			selectedNote.value = note
			if (note && note.id) {
				saveUserSetting(STORAGE_KEYS.LAST_NOTE_ID, note.id)
			}
			// Ensure content is string for marked
			if (selectedNote.value.content === null) selectedNote.value.content = ""

			// Auto collapse sidebar on selection (User Request) - Only if NOT pinned
			if (isSidebarOpen.value && !isSidebarPinned.value) {
				setTimeout(() => {
					isSidebarOpen.value = false
				}, 50)
			}
		}



		const deleteNote = (id) => {
			openModal('delete-note', id)
		}

		const deleteNoteImpl = async (id) => {
			try {
				const response = await authenticatedFetch(`/api/notes/${id}`, { method: 'DELETE' })
				if (response && response.ok) {
					notes.value = notes.value.filter(n => n.id !== id)
					selectedNote.value = null
					if (hasIDB) {
						await LocalDB.deleteNote(id)
					}
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
				if (input) input.focus()
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
					await authenticatedFetch(`/api/folders/${id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name: name })
					})
					// Update local
					const f = folders.value.find(f => f.id === id)
					if (f) f.name = name
				} else {
					// Update note
					const n = notes.value.find(n => n.id === id)
					if (n) {
						await authenticatedFetch(`/api/notes/${id}`, {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								title: name,
								content: n.content,
								folder_id: n.folder_id
							})
						})
						n.title = name
						if (selectedNote.value && selectedNote.value.id === id) {
							selectedNote.value.title = name
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
			openModal('delete-folder', id)
		}

		const deleteFolderImpl = async (id) => {
			try {
				const response = await authenticatedFetch(`/api/folders/${id}`, { method: 'DELETE' })
				if (response && response.ok) {
					if (hasIDB) {
						// Delete local notes in this folder first to prevent resurrection
						const folderNotes = notes.value.filter(n => n.folder_id === id)
						for (const n of folderNotes) {
							await LocalDB.deleteNote(n.id)
						}
						await LocalDB.deleteFolder(id)
					}

					folders.value = folders.value.filter(f => f.id !== id)
					// Also remove notes or move them? Currently notes cascade delete or stay orphan?
					// Backend usually handles cascade. But frontend should refresh notes.
					fetchNotes()
				}
			} catch (e) {
				console.error("Failed to delete folder", e)
			}
		}

		// Sharing Logic
		const toggleShare = async () => {
			if (!selectedNote.value) return
			const note = selectedNote.value

			// If already shared, open the management modal
			if (note.is_shared) {
				openShareModal(note)
			} else {
				// Enable sharing first
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

			// Optimistic UI update
			const originalState = note.is_pinned
			note.is_pinned = !originalState

			// If selected note is the one being toggled, ensure reactivity if needed (though object mutates)

			try {
				const response = await authenticatedFetch(`/api/notes/${note.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						is_pinned: note.is_pinned
					})
				})

				if (!response || !response.ok) {
					// Revert on failure
					note.is_pinned = originalState
					alert("Failed to update pin status")
				}
			} catch (e) {
				note.is_pinned = originalState
				console.error("Pin toggle failed", e)
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


		const handleDrop = async (targetFolderId, event) => {
			// Prevent default just to be safe if event is passed (though Vue handles modifiers)
			// But here we might receive event as second arg if we update template

			const noteId = draggedNoteId.value
			if (!noteId) return

			const note = notes.value.find(n => n.id === noteId)
			// Check if we are really moving it
			// If targetFolderId is null, and note.folder_id is string 'null' or null, we might have issues?
			// Typically note.folder_id comes from DB as null or int.
			// Let's coerce for safety: (note.folder_id || null) !== (targetFolderId || null) ?
			// But note.folder_id could be 0? 0 is falsy. ID should be > 0.

			const currentIds = note.folder_id
			const targetIds = targetFolderId

			if (note && currentIds !== targetIds) {
				// Optimistic Update
				const originalFolderId = note.folder_id
				note.folder_id = targetFolderId

				try {
					const response = await authenticatedFetch(`/api/notes/${noteId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							title: note.title,
							content: note.content,
							folder_id: targetFolderId
						})
					})

					if (!response || !response.ok) {
						throw new Error("Failed to move note")
					}

					if (hasIDB) {
						await LocalDB.saveNote(note)
					}

				} catch (e) {
					console.error("Move failed", e)
					// Revert
					note.folder_id = originalFolderId
					if (hasIDB) {
						await LocalDB.saveNote(note)
					}
					alert("Failed to move note")
				}
			}
			draggedNoteId.value = null
			dropTargetId.value = null
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
			return marked.parse(selectedNote.value.content, {
				renderer: renderer,
				gfm: true,
				breaks: true
			})
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
			return notes.value.filter(n => n.folder_id === folderId)
		}

		const getSortedFolderNotes = (folderId) => {
			const folderNotes = getFolderNotes(folderId)
			return sortItems(folderNotes)
		}

		onMounted(async () => {
			checkAuth()
			// Init Dark Mode class
			if (isDarkMode.value) document.documentElement.classList.add('dark')

			// Wait a bit for Google Script to load if async
			setTimeout(initGoogleAuth, 500)

			// Editor initialized via watcher generally, but we can ensure cleanup
			onBeforeUnmount(() => {
				if (editorView.value) editorView.value.destroy()
			})
		})

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
				nextTick(() => {
					initEditor()
				})
			} else {
				// Destroy if no note
				if (editorView.value) {
					editorView.value.destroy()
					editorView.value = null
				}
			}
		}, { flush: 'post', immediate: true })

		watch(isDarkMode, (val) => {
			if (editorView.value) {
				editorView.value.dispatch({
					effects: themeCompartment.reconfigure(val ? oneDark : [])
				})
			}
		})

		// Other watchers (fontSize, darkMode, viewMode) handled via CSS binding in template

		watch(fontSize, (val) => {
			// Optional: could manually resize if needed, but style binding handles it.
		})

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
			handleDragLeave,

			focusEditor,

			// Share
			toggleShare,
			copyShareLink,
			stopSharing,
			togglePin,

			changelogContent,

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
			guestMode: computed(() => !isAuthenticated.value),
			// Config

			splitRatio,
			startResize,
			hasIDB,
			isSyncing
		}
	}
}).mount('#app')
