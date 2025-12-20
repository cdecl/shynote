const { createApp, ref, onMounted, computed } = Vue

createApp({
	setup() {
		const notes = ref([])
		const folders = ref([])
		const selectedNote = ref(null)
		const loading = ref(false)
		const statusMessage = ref('Ready')
		let debounceTimer = null

		const fetchFolders = async () => {
			try {
				const response = await fetch('/api/folders')
				if (response.ok) {
					folders.value = await response.json()
				}
			} catch (e) {
				console.error("Failed to fetch folders", e)
			}
		}

		const fetchNotes = async () => {
			loading.value = true
			try {
				const response = await fetch('/api/notes')
				if (response.ok) {
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
				const response = await fetch('/api/folders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name })
				})
				if (response.ok) {
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
				const response = await fetch('/api/notes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: '', content: '', folder_id: folderId })
				})
				if (response.ok) {
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
				const response = await fetch(`/api/notes/${selectedNote.value.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: selectedNote.value.title,
						content: selectedNote.value.content,
						folder_id: selectedNote.value.folder_id
					})
				})

				if (response.ok) {
					// Update list item
					const index = notes.value.findIndex(n => n.id === selectedNote.value.id)
					if (index !== -1) {
						notes.value[index] = { ...notes.value[index], ...selectedNote.value }
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
				const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
				if (response.ok) {
					notes.value = notes.value.filter(n => n.id !== id)
					selectedNote.value = null
				}
			} catch (e) {
				console.error("Failed to delete note", e)
			}
		}

		const debouncedUpdate = () => {
			statusMessage.value = 'Typing...'
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(updateNote, 1000)
		}

		const previewContent = computed(() => {
			if (!selectedNote.value || !selectedNote.value.content) return ''
			return marked.parse(selectedNote.value.content)
		})

		const rootNotes = computed(() => {
			return notes.value.filter(n => !n.folder_id)
		})

		const getFolderNotes = (folderId) => {
			return notes.value.filter(n => n.folder_id === folderId)
		}

		onMounted(() => {
			fetchFolders()
			fetchNotes()
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
			deleteNote,
			debouncedUpdate,
			previewContent,
			rootNotes,
			getFolderNotes
		}
	}
}).mount('#app')
