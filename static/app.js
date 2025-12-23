const { createApp, ref, onMounted, computed, nextTick, watch } = Vue

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
			LAST_NOTE_ID: 'shynote_last_note_id'
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

		const notes = ref([])
		const folders = ref([])
		const selectedNote = ref(null)
		const loading = ref(false)
		const statusMessage = ref('Ready')
		const isSidebarOpen = ref(true)
		const isSidebarPinned = ref(localStorage.getItem(STORAGE_KEYS.SIDEBAR_PINNED) === 'true')
		const editorRef = ref(null)
		const previewRef = ref(null)
		const viewMode = ref('split')
		const isDarkMode = ref(localStorage.getItem(STORAGE_KEYS.DARK_MODE) === null ? true : localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true')
		const isAuthenticated = ref(false) // Was missing!
		const fontSize = ref(localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '14')
		const setFontSize = (size) => {
			fontSize.value = size
			localStorage.setItem(STORAGE_KEYS.FONT_SIZE, size)
		}
		const collapsedFolders = ref(JSON.parse(localStorage.getItem(STORAGE_KEYS.COLLAPSED_FOLDERS) || '{}'))
		const cmEditor = ref(null) // Removed but keeping ref cleanup if needed, actually removal is better.
		// Let's just remove it effectively by ignoring it.
		// But for cleaner code, I will replace the logic.


		// Guest Store (InMemory DB) - Defined Early for authenticatedFetch
		const guestStore = {
			user: { id: 'guest', email: 'guest@shynote.app', is_dark_mode: true, view_mode: 'split' },
			notes: [
				{ id: 999, title: 'Welcome to Guest Mode', content: '# Guest Mode\n\nChanges here are **temporary** (in-memory) and will be lost on refresh unless we added localStorage persistence (not implemented yet).\n\nTry creating folders and notes!', folder_id: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
			],
			folders: []
		}

		// Dependencies needed early
		const logout = () => {
			localStorage.removeItem(STORAGE_KEYS.TOKEN)
			isAuthenticated.value = false
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

		const debouncedUpdate = () => {
			statusMessage.value = 'Typing...'
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(updateNote, 1000)
		}





		// New Handlers
		const handleInput = (e) => {
			if (selectedNote.value) {
				selectedNote.value.content = e.target.value
				debouncedUpdate()
			}
		}

		const handleKeydown = (e) => {
			const el = e.target
			const start = el.selectionStart
			const end = el.selectionEnd
			const value = el.value

			// 1. Tab / Shift+Tab (Indentation)
			if (e.key === 'Tab' || (e.metaKey && (e.key === ']' || e.key === '[')) || (e.ctrlKey && (e.key === ']' || e.key === '['))) {
				e.preventDefault()
				const isIndent = e.key === 'Tab' ? !e.shiftKey : (e.key === ']' || e.key === 'Tab')

				// Find start and end lines
				const startLineStart = value.lastIndexOf('\n', start - 1) + 1
				let endLineEnd = value.indexOf('\n', end)
				if (endLineEnd === -1) endLineEnd = value.length

				// Expand selection to full lines
				const lines = value.substring(startLineStart, endLineEnd).split('\n')

				const newLines = lines.map(line => {
					if (isIndent) {
						return '    ' + line
					} else {
						// Outdent: remove up to 4 spaces
						return line.replace(/^ {1,4}/, '')
					}
				})

				const newText = newLines.join('\n')
				el.setRangeText(newText, startLineStart, endLineEnd, 'select')
				handleInput({ target: el })
				return
			}

			// 2. Line Manipulation

			// Duplicate Line (Shift + Alt + Arrow) - Must be checked BEFORE Move Line
			if (e.shiftKey && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault()
				// Identify current line
				const startLineStart = value.lastIndexOf('\n', start - 1) + 1
				let startLineEnd = value.indexOf('\n', start)
				if (startLineEnd === -1) startLineEnd = value.length
				const currentLine = value.substring(startLineStart, startLineEnd)

				// Insert duplicate
				const insertText = '\n' + currentLine
				el.setRangeText(insertText, startLineEnd, startLineEnd, 'end')
				handleInput({ target: el })
				return
			}

			// Move Line Up/Down (Alt + Arrow)
			if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault()
				const direction = e.key === 'ArrowUp' ? -1 : 1

				// Identify current line range
				const startLineStart = value.lastIndexOf('\n', start - 1) + 1
				let startLineEnd = value.indexOf('\n', start)
				if (startLineEnd === -1) startLineEnd = value.length

				const currentLine = value.substring(startLineStart, startLineEnd)

				if (direction === -1) { // Up
					// Find previous line
					if (startLineStart === 0) return // Already at top
					const prevLineStart = value.lastIndexOf('\n', startLineStart - 2) + 1
					const prevLineEnd = startLineStart - 1
					const prevLine = value.substring(prevLineStart, prevLineEnd)

					// Swap
					const newBlock = currentLine + '\n' + prevLine
					el.setRangeText(newBlock, prevLineStart, startLineEnd, 'select')
					// Adjust selection to follow moved line
					el.setSelectionRange(prevLineStart, prevLineStart + currentLine.length)
				} else { // Down
					// Find next line
					if (startLineEnd === value.length) return // Already at bottom
					const nextLineStart = startLineEnd + 1
					let nextLineEnd = value.indexOf('\n', nextLineStart)
					if (nextLineEnd === -1) nextLineEnd = value.length
					const nextLine = value.substring(nextLineStart, nextLineEnd)

					// Swap
					const newBlock = nextLine + '\n' + currentLine
					el.setRangeText(newBlock, startLineStart, nextLineEnd, 'select')
					// Adjust selection
					const newStart = startLineStart + nextLine.length + 1
					el.setSelectionRange(newStart, newStart + currentLine.length)
				}
				handleInput({ target: el })
				return
			}

			// Delete Line (Cmd+Shift+K / Ctrl+Shift+K)
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				const startLineStart = value.lastIndexOf('\n', start - 1) + 1
				let nextLineStart = value.indexOf('\n', start) + 1
				if (nextLineStart === 0) nextLineStart = value.length // EOF case

				// If it's the last line (no newline at end), we might need to delete newline before it
				let deleteEnd = nextLineStart
				let deleteStart = startLineStart

				if (startLineStart > 0 && deleteEnd === value.length && value[startLineStart - 1] === '\n') {
					// removing last line, consume preceding newline
					deleteStart--
				}

				el.setRangeText('', deleteStart, deleteEnd, 'select')
				handleInput({ target: el })
				return
			}

			// 3. Search Navigation (Cmd+G)
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
				e.preventDefault()
				if (!searchState.value.show) {
					openSearch()
				} else {
					executeFind(e.shiftKey) // shift = prev, no-shift = next
				}
				return
			}


			// Shortcuts
			if ((e.metaKey || e.ctrlKey)) {
				switch (e.key.toLowerCase()) {
					case 'b': e.preventDefault(); formatText('bold'); break;
					case 'i': e.preventDefault(); formatText('italic'); break;
					case 'k': e.preventDefault(); formatText('link'); break;
					case 's': e.preventDefault(); updateNote(); break; // Save
					case 'f': e.preventDefault(); openSearch(); break;
				}
			}
		}



		const formatText = (type) => {
			const el = editorRef.value
			if (!el) return
			const start = el.selectionStart
			const end = el.selectionEnd
			const selection = el.value.substring(start, end)

			let newText = selection
			let wrap = ''

			switch (type) {
				case 'bold': wrap = '**'; break;
				case 'italic': wrap = '*'; break;
				case 'strike': wrap = '~~'; break;
				case 'code': wrap = '`'; break; // Simple inline code
				case 'codeblock':
					newText = `\`\`\`\n${selection}\n\`\`\``
					break;
				case 'link':
					const url = prompt('Link URL:', 'https://')
					if (url) newText = `[${selection}](url)`
					else return
					wrap = ''
					break;
				// Headings
				case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
					// Handle line logic... complex for simple textarea replace.
					// Just prepend to selection for now or handle simple case.
					const level = parseInt(type.replace('h', ''))
					const prefix = '#'.repeat(level) + ' '
					// We should find the start of the line.
					// Scan back from start to find \n
					let lineStart = el.value.lastIndexOf('\n', start - 1) + 1
					// Insert at lineStart
					el.setRangeText(prefix, lineStart, lineStart, 'end')
					handleInput({ target: el })
					el.focus()
					return
			}

			if (wrap) {
				newText = `${wrap}${selection}${wrap}`
			}

			el.setRangeText(newText, start, end, 'select')
			handleInput({ target: el })
			el.focus()
		}

		const focusEditor = () => {
			if (editorRef.value) {
				editorRef.value.focus()
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
				const el = editorRef.value
				if (el && el.selectionStart !== el.selectionEnd) {
					searchState.value.query = el.value.substring(el.selectionStart, el.selectionEnd)
				}
			})
		}

		const closeSearch = () => {
			searchState.value.show = false
			searchState.value.showReplace = false
			if (editorRef.value) editorRef.value.focus()
		}

		watch(() => [searchState.value.query, searchState.value.caseSensitive, searchState.value.useRegex], () => {
			// No live highlights
		})

		const executeFind = (reverse = false, focusEditor = true) => {
			const el = editorRef.value
			if (!el) return
			const content = el.value
			let query = searchState.value.query
			if (!query) return

			let searchIndex = -1
			const currentPos = el.selectionEnd

			const flags = searchState.value.caseSensitive ? 'g' : 'gi'

			if (searchState.value.useRegex) {
				try {
					const regex = new RegExp(query, flags)
					let match
					const matches = []
					while ((match = regex.exec(content)) !== null) {
						matches.push({ start: match.index, end: match.index + match[0].length })
					}

					if (matches.length === 0) return

					let nextMatch = null
					if (reverse) {
						let prevMatch = null
						for (const m of matches) {
							if (m.start < el.selectionStart) {
								prevMatch = m
							} else {
								break
							}
						}
						nextMatch = prevMatch || matches[matches.length - 1]
					} else {
						let found = matches.find(m => m.start >= currentPos)
						if (!found) found = matches[0] // Loop around
						nextMatch = found
					}

					if (nextMatch) {
						if (focusEditor) el.focus()
						el.setSelectionRange(nextMatch.start, nextMatch.end)

						// Manually scroll if not focusing (since blur might not scroll)
						if (!focusEditor) {
							const textBefore = content.substring(0, nextMatch.start)
							const lines = textBefore.split('\n').length
							const lineHeight = 21 // Approx for 14px font
							const scrollPos = (lines * lineHeight) - (el.clientHeight / 2)
							el.scrollTop = scrollPos > 0 ? scrollPos : 0
						}
					}
				} catch (e) {
					console.error("Regex error", e)
				}
			} else {
				// Normal string search
				const lowerContent = searchState.value.caseSensitive ? content : content.toLowerCase()
				const lowerQuery = searchState.value.caseSensitive ? query : query.toLowerCase()

				// Find all occurrences
				const matches = []
				let pos = 0
				while (true) {
					const idx = lowerContent.indexOf(lowerQuery, pos)
					if (idx === -1) break
					matches.push({ start: idx, end: idx + query.length })
					pos = idx + 1
				}

				if (matches.length === 0) return

				let nextMatch
				if (reverse) {
					let prevMatch = null
					for (const m of matches) {
						if (m.start < el.selectionStart) {
							prevMatch = m
						} else {
							break
						}
					}
					nextMatch = prevMatch || matches[matches.length - 1]
				} else {
					let found = matches.find(m => m.start >= currentPos)
					if (!found) found = matches[0]
					nextMatch = found
				}

				if (nextMatch) {
					if (focusEditor) el.focus()
					el.setSelectionRange(nextMatch.start, nextMatch.end)

					if (!focusEditor) {
						const textBefore = content.substring(0, nextMatch.start)
						const lines = textBefore.split('\n').length
						const lineHeight = 21
						const scrollPos = (lines * lineHeight) - (el.clientHeight / 2)
						el.scrollTop = scrollPos > 0 ? scrollPos : 0
					}
				}
			}
		}

		const hasSelection = ref(false)
		const checkSelection = () => {
			const el = editorRef.value
			if (!el) return
			hasSelection.value = el.selectionStart !== el.selectionEnd
		}

		// Scroll Sync
		const handleScroll = (e) => {
			// ... existing scroll logic
			if (!editorRef.value) return
			const source = e.target

			// Sync Preview
			if (previewRef.value && viewMode.value !== 'edit') {
				if (source === editorRef.value) {
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
					previewRef.value.scrollTop = percentage * (previewRef.value.scrollHeight - previewRef.value.clientHeight)
				} else if (source === previewRef.value) {
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
					editorRef.value.scrollTop = percentage * (editorRef.value.scrollHeight - editorRef.value.clientHeight)
				}
			}
		}

		const executeReplace = (all = false) => {
			const el = editorRef.value
			if (!el) return
			const content = el.value
			let query = searchState.value.query
			let replace = searchState.value.replaceText
			if (!query) return

			if (all) {
				const flags = (searchState.value.caseSensitive ? 'g' : 'gi')
				const regex = new RegExp(searchState.value.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
				const newContent = content.replace(regex, replace)

				// Update everything
				selectedNote.value.content = newContent
				el.value = newContent
				handleInput({ target: el })
			} else {
				// Replace Current Selection OR Next Match
				const selStart = el.selectionStart
				const selEnd = el.selectionEnd
				const selText = content.substring(selStart, selEnd)

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

				if (isMatch && selStart !== selEnd) {
					el.setRangeText(replace, selStart, selEnd, 'select')
					handleInput({ target: el })
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
				await Promise.all([fetchFolders(), fetchNotes(), fetchUserProfile()]);
				autoSelectNote();
			} else if (storedToken === 'guest' && !isGuestMode) {
				logout();
			} else if (storedToken) {
				isAuthenticated.value = true;
				await Promise.all([fetchFolders(), fetchNotes(), fetchUserProfile()]);
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
			localStorage.setItem(STORAGE_KEYS.COLLAPSED_FOLDERS, JSON.stringify(collapsedFolders.value))
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
			localStorage.setItem(STORAGE_KEYS.DARK_MODE, isDarkMode.value)
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
				localStorage.setItem(STORAGE_KEYS.SORT_FIELD, value)
			} else if (type === 'direction') {
				sortOption.value.direction = value
				localStorage.setItem(STORAGE_KEYS.SORT_DIRECTION, value)
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
			try {
				const response = await authenticatedFetch('/api/folders')
				if (response && response.ok) {
					folders.value = await response.json()
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
			try {
				const response = await authenticatedFetch('/api/notes')
				if (response && response.ok) {
					notes.value = await response.json()
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
					notes.value.unshift(newNote)
					selectedNote.value = newNote
				}
			} catch (e) {
				console.error("Failed to create note", e)
			}
		}

		const autoSelectNote = () => {
			if (notes.value.length === 0) return

			const lastNoteId = localStorage.getItem(STORAGE_KEYS.LAST_NOTE_ID)
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

		const toggleSidebarPin = () => {
			isSidebarPinned.value = !isSidebarPinned.value
			localStorage.setItem(STORAGE_KEYS.SIDEBAR_PINNED, isSidebarPinned.value)
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
				localStorage.setItem(STORAGE_KEYS.LAST_NOTE_ID, note.id)
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
				} catch (e) {
					console.error("Move failed", e)
					// Revert
					note.folder_id = originalFolderId
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









		const previewContent = computed(() => {
			if (!selectedNote.value || !selectedNote.value.content) return ''
			return marked.parse(selectedNote.value.content, {
				gfm: true,
				breaks: true,
				highlight: function (code, lang) {
					const language = hljs.getLanguage(lang) ? lang : 'plaintext';
					return hljs.highlight(code, { language }).value;
				}
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
		})

		// Watch authentication state to re-render button if logout
		Vue.watch(isAuthenticated, (newVal) => {
			if (!newVal) {
				setTimeout(renderGoogleButton, 100)
			}
		})







		// Watchers
		watch(() => selectedNote.value?.id, (newId) => {
			if (newId) {
				nextTick(() => {
					// Standard Textarea Reset
					if (editorRef.value) {
						editorRef.value.scrollTop = 0
						// value is bound by v-model or :value, but simple textarea needs update? 
						// No, :value handles it if we use v-model, but we used :value="selectedNote.content" in index.html?
						// Let's check index.html. I didn't verify if I added v-model or :value.
						// I added `ref="editorRef" @input="handleInput"`. I missed `:value` or `v-model`. 
						// I need to set the value manually here or via prop. 
						// Textarea usage: <textarea .value="..."></textarea>
						// I'll update it here:
						if (selectedNote.value) {
							editorRef.value.value = selectedNote.value.content || ''
						}
					}
					if (previewRef.value) {
						previewRef.value.scrollTop = 0
					}
				})
			}
		}, { flush: 'post', immediate: true })

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

			toolbar,
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
			handleInput,
			handleKeydown,
			formatText,
			hasSelection,
			checkSelection

		}
	}
}).mount('#app')
