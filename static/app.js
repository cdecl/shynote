const { createApp, ref, onMounted, computed, nextTick } = Vue

createApp({
	setup() {
		const notes = ref([])
		const folders = ref([])
		const selectedNote = ref(null)
		const loading = ref(false)
		const statusMessage = ref('Ready')
		const isSidebarOpen = ref(true)
		const editorRef = ref(null)
		const previewRef = ref(null)
		const viewMode = ref('split') // 'split', 'edit', 'preview'
		const isDarkMode = ref(true)
		const isAuthenticated = ref(false)

		const renameState = ref({
			id: null,
			type: null, // 'folder' | 'note'
			name: ''
		})

		let debounceTimer = null

		const checkAuth = () => {
			const token = localStorage.getItem('access_token')
			if (token) {
				isAuthenticated.value = true
				fetchFolders()
				fetchNotes()
				fetchUserProfile()
			} else {
				isAuthenticated.value = false
			}
		}


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
					localStorage.setItem('access_token', data.access_token)
					isAuthenticated.value = true
					isAuthenticated.value = true
					fetchUserProfile()
					fetchFolders()
					fetchNotes()
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

		const authenticatedFetch = async (url, options = {}) => {
			const token = localStorage.getItem('access_token')
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

		const logout = () => {
			localStorage.removeItem('access_token')
			isAuthenticated.value = false
			notes.value = []
			folders.value = []
			selectedNote.value = null
		}

		const toggleSidebar = () => {
			isSidebarOpen.value = !isSidebarOpen.value
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

		const handleScroll = (e) => {
			if (!editorRef.value || !previewRef.value) return
			const source = e.target
			const target = source === editorRef.value ? previewRef.value : editorRef.value

			const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
			target.scrollTop = percentage * (target.scrollHeight - target.clientHeight)
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

		const createFolder = async () => {
			const name = prompt("Enter folder name:")
			if (!name) return

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

		const selectNote = (note) => {
			selectedNote.value = note
			// Ensure content is string for marked
			if (selectedNote.value.content === null) selectedNote.value.content = ""
		}

		const updateNote = async () => {
			if (!selectedNote.value) return

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
					const updatedNote = await response.json()
					// Update list item
					const index = notes.value.findIndex(n => n.id === selectedNote.value.id)
					if (index !== -1) {
						notes.value[index] = updatedNote
					}
					// Update selectedNote timestamps (keep reference if possible, or update properties)
					if (selectedNote.value && selectedNote.value.id === updatedNote.id) {
						selectedNote.value.updated_at = updatedNote.updated_at
					}
					statusMessage.value = 'Saved'
				} else {
					statusMessage.value = 'Error'
				}
			} catch (e) {
				statusMessage.value = 'Error'
				console.error(e)
			}
		}

		const deleteNote = async (id) => {
			if (!confirm("Are you sure you want to delete this note?")) return

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

		const deleteFolder = async (id) => {
			if (!confirm("Are you sure you want to delete this folder and all its notes?")) return

			try {
				const response = await authenticatedFetch(`/api/folders/${id}`, { method: 'DELETE' })
				if (response && response.ok) {
					folders.value = folders.value.filter(f => f.id !== id)
					// Also remove notes that were in this folder from local state
					notes.value = notes.value.filter(n => n.folder_id !== id)
					if (selectedNote.value && selectedNote.value.folder_id === id) {
						selectedNote.value = null
					}
				}
			} catch (e) {
				console.error("Failed to delete folder", e)
			}
		}

		const handleEditorKeyDown = (e) => {
			if (e.isComposing || e.keyCode === 229) return

			const el = e.target
			const { selectionStart, selectionEnd, value } = el
			const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
			// const ctrlKey = isMac ? e.metaKey : e.ctrlKey 
			const cmdKey = isMac ? e.metaKey : e.ctrlKey

			// Helper: Insert text using execCommand to preserve Undo history
			// Fallback to setRangeText if needed
			const execReplace = (text, start, end) => {
				el.focus()
				el.setSelectionRange(start, end)
				const success = document.execCommand('insertText', false, text)
				if (!success) {
					// Fallback
					el.setRangeText(text, start, end, 'end')
					el.dispatchEvent(new Event('input', { bubbles: true }))
				}
				// execCommand automatically fires input event
			}

			// Helper: Simple insert at current cursor
			const insertText = (text) => {
				const success = document.execCommand('insertText', false, text)
				if (!success) {
					el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end')
					el.dispatchEvent(new Event('input', { bubbles: true }))
				}
			}

			// Helper: Get line info
			const getLineInfo = () => {
				const startPos = value.lastIndexOf('\n', selectionStart - 1) + 1
				let endPos = value.indexOf('\n', selectionStart)
				if (endPos === -1) endPos = value.length
				return { startPos, endPos, line: value.substring(startPos, endPos) }
			}

			// 1. Move Line Up/Down (Alt + Up/Down)
			if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault()
				const { startPos, endPos, line } = getLineInfo()

				if (e.key === 'ArrowUp') {
					if (startPos > 0) {
						const prevLineStart = value.lastIndexOf('\n', startPos - 2) + 1
						const prevLineEnd = startPos - 1
						const prevLine = value.substring(prevLineStart, prevLineEnd)
						const newLineContent = line + '\n' + prevLine

						// Perform replacement with Undo support
						execReplace(newLineContent, prevLineStart, endPos)

						// Restore selection
						const newStart = prevLineStart
						const newEnd = prevLineStart + line.length
						nextTick(() => el.setSelectionRange(newStart, newEnd))
					}
				} else if (e.key === 'ArrowDown') {
					if (endPos < value.length) {
						const nextLineStart = endPos + 1
						let nextLineEnd = value.indexOf('\n', nextLineStart)
						if (nextLineEnd === -1) nextLineEnd = value.length
						const nextLine = value.substring(nextLineStart, nextLineEnd)
						const newLineContent = nextLine + '\n' + line

						execReplace(newLineContent, startPos, nextLineEnd)

						const newStart = startPos + nextLine.length + 1
						const newEnd = newStart + line.length
						nextTick(() => el.setSelectionRange(newStart, newEnd))
					}
				}
				return
			}

			// 2. Copy Line Up/Down (Shift + Alt + Up/Down)
			if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault()
				const { startPos, endPos, line } = getLineInfo()
				const textToInsert = line + '\n'

				if (e.key === 'ArrowUp') {
					// Insert above
					// We need to insert at startPos. 
					// Ideally we want to KEEP selection on the line which moves down.
					// execInsert puts cursor after inserted text.
					// If we insert at startPos, cursor will be at end of inserted text.
					// The inserted text is `line + \n`.
					// So cursor will depend on `line` length.
					// Original content starts at `startPos + line.length + 1`?
					const originalSelectionStart = selectionStart
					const originalSelectionEnd = selectionEnd

					execReplace(textToInsert, startPos, startPos)

					// Restoration: The original text shifted by textToInsert.length
					const offset = textToInsert.length
					nextTick(() => el.setSelectionRange(originalSelectionStart + offset, originalSelectionEnd + offset))
				} else {
					// Insert below
					let insertPos = endPos + 1
					let contentToInsert = textToInsert

					if (endPos === value.length) {
						insertPos = endPos
						contentToInsert = '\n' + line
					}

					const originalSelectionStart = selectionStart
					const originalSelectionEnd = selectionEnd

					execReplace(contentToInsert, insertPos, insertPos)

					// Restore selection to original line (which didn't move)
					nextTick(() => el.setSelectionRange(originalSelectionStart, originalSelectionEnd))
				}
				return
			}

			// 3. Smart Enter (Smart Lists, Indent, Comments)
			if (e.key === 'Enter') {
				const { startPos, line } = getLineInfo()

				// Bullets: -, *, +
				const bulletMatch = line.match(/^(\s*)([-*+])\s+/)
				if (bulletMatch) {
					if (line.trim() === bulletMatch[2]) { // If only bullet, clear line
						e.preventDefault()
						execReplace('', startPos, selectionStart) // Clear up to cursor (or endPos if at end)
					} else { // Continue bullet
						e.preventDefault()
						const prefix = '\n' + bulletMatch[1] + bulletMatch[2] + ' '
						insertText(prefix)
					}
					return
				}

				// Numbered List: 1. 2.
				const numMatch = line.match(/^(\s*)(\d+)\.\s+/)
				if (numMatch) {
					e.preventDefault()
					const nextNum = parseInt(numMatch[2]) + 1
					const prefix = '\n' + numMatch[1] + nextNum + '. '
					insertText(prefix)
					return
				}

				// Comments: // or * (JSDoc)
				const commentMatch = line.match(/^(\s*)(\/\/|\*|\/\*\*?)\s*/)
				if (commentMatch) {
					e.preventDefault()
					let char = commentMatch[2]
					if (char.startsWith('/*')) char = ' *'
					const prefix = '\n' + commentMatch[1] + char + ' '
					insertText(prefix)
					return
				}

				// Smart Indent: After { or :
				if (line.trim().endsWith('{') || line.trim().endsWith(':')) {
					e.preventDefault()
					const indentMatch = line.match(/^(\s*)/)
					const currentIndent = indentMatch ? indentMatch[1] : ''

					// Use 2 spaces
					// If e.shiftKey? Unindent? No, enter just indents.
					const prefix = '\n' + currentIndent + '  '
					insertText(prefix)
					return
				}
			}

			// 3.5. Tab Key (Multi-line support)
			if (e.key === 'Tab') {
				e.preventDefault()

				const startLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
				let endLineEnd = value.indexOf('\n', selectionEnd)
				if (endLineEnd === -1) endLineEnd = value.length
				// If selection ends exactly at a newline, we might not want to indent the next empty line? 
				// VS Code behavior: if cursor is at beginning of line `\n|`, it is Line N. 
				// If selection is `Line 1\nLine 2`, endPos is after '2'.
				// If selection includes the newline at end `Line 1\n`, it usually treats as Line 1 + Line 2 start?
				// Let's stick to: if we have a range, extend to full lines.

				// However, if selectionEnd is exactly at the start of a line (after \n), that line is typically NOT included in the indent action unless it's the only line.
				// e.g. "A\n|B" -> Selection is "A\n". We indent A.
				// "A\nB|" -> Selection is "A\nB". We indent A and B.

				// Fix endLineEnd logic:
				// If selectionEnd > startLineStart and value[selectionEnd-1] === '\n', current line is one less?
				// To complicate things less, let's just grab the block spanning start to end.

				// Re-calc boundaries to include full lines
				// Start is simple:
				const blockStart = value.lastIndexOf('\n', selectionStart - 1) + 1

				// End:
				let blockEnd = value.indexOf('\n', selectionEnd)
				if (blockEnd === -1) blockEnd = value.length

				// Special case: if selectionEnd is > selectionStart and is at the very beginning of a line (val[selectionEnd-1] == '\n'),
				// we shouldn't really count that last newline's following line as "selected" for indentation purposes usually.
				// But let's verify standard behavior.
				// If I select "abc\n", I usually expect "  abc\n" if I indent. I don't expect the next empty line to be indented.

				// However, standard `substring(start, end)` usage:
				const originalText = value.substring(blockStart, blockEnd)
				const lines = originalText.split('\n')

				if (e.shiftKey) {
					// Unindent
					const newLines = lines.map(line => {
						if (line.startsWith('  ')) return line.substring(2)
						if (line.startsWith('\t')) return line.substring(1)
						if (line.startsWith(' ')) return line.substring(1)
						return line
					})
					const newText = newLines.join('\n')

					if (newText !== originalText) {
						execReplace(newText, blockStart, blockEnd)
						// Restore selection roughly
						// It's hard to exactly map selection anchors after mutation, 
						// but standard behavior is selecting the whole block.
						nextTick(() => {
							el.setSelectionRange(blockStart, blockStart + newText.length)
						})
					}
				} else {
					// Indent
					// Only if we have a selection OR it's a multi-line block.
					// If it is a caret (selectionStart === selectionEnd), simple insert.
					// UNLESS user wants "indent line" behavior even when just caret?
					// Usually Tab at caret = insert spaces. Tab with selection = indent block.

					if (selectionStart === selectionEnd) {
						insertText('  ')
						return
					}

					const newLines = lines.map(line => '  ' + line)
					const newText = newLines.join('\n')

					execReplace(newText, blockStart, blockEnd)
					nextTick(() => {
						el.setSelectionRange(blockStart, blockStart + newText.length)
					})
				}
				return
			}

			// 4. Markdown Shortcuts
			if (cmdKey) {
				if (e.key === 'b') { // Bold
					e.preventDefault()
					const selectedText = value.substring(selectionStart, selectionEnd)
					insertText(`**${selectedText}**`)
					// Cursor placement logic
					// insertText moves cursor to end.
					// We need to calculate where to put it.
					// If empty selection: `****`. Cursor should be in middle.
					// current cursor is at `selectionStart` + 4.
					// Move back 2.
					if (selectedText.length === 0) {
						// We can't rely on valid `el.selectionStart` immediately if async?
						// execCommand is synchronous.
						const newPos = el.selectionEnd - 2
						el.setSelectionRange(newPos, newPos)
					}
					// If text selected: `**text**`. Cursor at end. Correct.
				} else if (e.key === 'i') { // Italic
					e.preventDefault()
					const selectedText = value.substring(selectionStart, selectionEnd)
					insertText(`*${selectedText}*`)
					if (selectedText.length === 0) {
						const newPos = el.selectionEnd - 1
						el.setSelectionRange(newPos, newPos)
					}
				} else if (e.key === 's') { // Save
					e.preventDefault()
					updateNote()
					statusMessage.value = 'Saved'
					setTimeout(() => {
						if (statusMessage.value === 'Saved') statusMessage.value = ''
					}, 2000)
				}
			}
		}

		const debouncedUpdate = () => {
			statusMessage.value = 'Typing...'
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(updateNote, 1000)
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

		const rootNotes = computed(() => {
			return notes.value.filter(n => !n.folder_id)
		})

		const getFolderNotes = (folderId) => {
			return notes.value.filter(n => n.folder_id === folderId)
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

		// Floating Toolbar State
		const toolbar = ref({
			show: false,
			x: 0,
			y: 0
		})

		const hideToolbar = () => {
			toolbar.value.show = false
		}

		const checkSelection = (e) => {
			// Small delay to ensure selection is updated
			setTimeout(() => {
				const el = editorRef.value
				if (!el) return

				if (el.selectionStart !== el.selectionEnd) {
					// We have a selection
					// Calculate simple position based on mouse or last interaction
					// Since textarea doesn't give BBox for text, we use mouse position if available
					// or fallback to a guess? 
					// Actually, for a pure textarea, getting the caret coordinates is hard without a library.
					// We will rely on the mouseup event's clientX/Y for positioning.
					// If triggered by keyboard, we might not show it or show it in a fixed spot?
					// Let's stick to mouse interactions for the "floating" feeling.
				} else {
					hideToolbar()
				}
			}, 10)
		}

		const handleMouseUp = (e) => {
			const el = editorRef.value
			if (!el) return

			if (el.selectionStart !== el.selectionEnd) {
				const rect = el.getBoundingClientRect()
				// Basic positioning: Above the mouse cursor
				// Limit x to within bounds
				toolbar.value = {
					show: true,
					x: e.clientX,
					y: e.clientY - 50 // 50px above cursor
				}
			} else {
				hideToolbar()
			}
		}

		const formatText = (type) => {
			const el = editorRef.value
			if (!el) return

			const start = el.selectionStart
			const end = el.selectionEnd
			const text = el.value.substring(start, end)
			if (!text) return

			let newText = text
			let offset = 0

			switch (type) {
				case 'bold':
					newText = `**${text}**`
					offset = 2
					break
				case 'italic':
					newText = `*${text}*`
					offset = 1
					break
				case 'strike':
					newText = `~~${text}~~`
					offset = 2
					break
				case 'code':
					newText = `\`${text}\``
					offset = 1
					break
				case 'link':
					newText = `[${text}](url)`
					offset = 1
					break
				case 'h1':
				case 'h2':
				case 'h3':
				case 'h4':
				case 'h5':
					const level = parseInt(type.replace('h', ''))
					// We apply heading to the entire line(s)
					// Calculate full lines from range
					const blockStart = el.value.lastIndexOf('\n', start - 1) + 1
					let blockEnd = el.value.indexOf('\n', end)
					if (blockEnd === -1) blockEnd = el.value.length

					const rawBlock = el.value.substring(blockStart, blockEnd)
					const lines = rawBlock.split('\n')
					const prefix = '#'.repeat(level) + ' '

					const newLines = lines.map(line => {
						// Remove existing heading
						const clean = line.replace(/^(#+\s*)/, '')
						return prefix + clean
					})

					newText = newLines.join('\n')

					// Update range to cover the whole block for replacement
					el.focus()
					el.setSelectionRange(blockStart, blockEnd)
					document.execCommand('insertText', false, newText)
					hideToolbar()
					return // Return early as we handled the replacement manually
			}


			// Execute replacement
			el.focus()
			// Use execCommand for Undo history
			// We need to re-select exact range because focus might strictly maintain selection, but good to be safe
			el.setSelectionRange(start, end)
			document.execCommand('insertText', false, newText)

			// Restore selection to include the markers? Or just the text?
			// Usually easier to select the inner text so user can chain styles?
			// Actually standard behavior: select the whole new thing.

			// If we select inner text:
			// el.setSelectionRange(start + offset, start + offset + text.length)

			// If we select whole thing (easiest):
			// el.setSelectionRange(start, start + newText.length)

			// Let's hide toolbar after action
			hideToolbar()
		}

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
			deleteNote,
			deleteFolder,
			debouncedUpdate,
			previewContent,
			rootNotes,
			getFolderNotes,
			isSidebarOpen,
			toggleSidebar,
			editorRef,
			previewRef,
			handleScroll,
			viewMode,
			cycleViewMode,
			setViewMode,
			isDarkMode,
			isDarkMode,
			toggleDarkMode,

			initGoogleAuth,
			isAuthenticated,
			renameState,
			startRename,
			saveRename,
			handleEditorKeyDown,

			toolbar,
			handleMouseUp,
			formatText,
			formatDate: (dateStr) => {
				if (!dateStr) return ''
				// Assume server returns UTC. Append 'Z' if missing to force UTC parsing.
				// Also handle "YYYY-MM-DD HH:MM:SS" from SQLite
				let safeStr = dateStr
				if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
					safeStr = dateStr.replace(' ', 'T') + 'Z'
				}
				const date = new Date(safeStr)
				if (isNaN(date.getTime())) return dateStr

				const yyyy = date.getFullYear()
				const mm = String(date.getMonth() + 1).padStart(2, '0')
				const dd = String(date.getDate()).padStart(2, '0')
				const hh = String(date.getHours()).padStart(2, '0')
				const min = String(date.getMinutes()).padStart(2, '0')
				const ss = String(date.getSeconds()).padStart(2, '0')
				return `${yyyy}.${mm}.${dd} ${hh}:${min}:${ss}`
			}
		}
	}
}).mount('#app')
