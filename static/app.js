import { Vue, CodeMirror, openDB, marked, hljs, mermaid, polyfill, scrollBehaviourDragImageTranslateOverride, jsyaml, sha256, markdownTable } from './dist/vendor.js';
import { LocalDB } from "./local_db.js";

const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted, onBeforeUnmount } = Vue;

const { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, crosshairCursor, lineNumbers, highlightActiveLineGutter, placeholder, rectangularSelection, Decoration, ViewPlugin, StateField } = CodeMirror;
const { EditorState, Compartment, EditorSelection } = CodeMirror;
const { markdown, markdownLanguage } = CodeMirror;
const { languages } = CodeMirror;
const { defaultKeymap, history, historyKeymap } = CodeMirror;
const { vscodeKeymap } = CodeMirror;
const { search, searchKeymap, highlightSelectionMatches, setSearchQuery, SearchQuery, findNext, findPrevious, openSearchPanel, closeSearchPanel } = CodeMirror;
const { githubLight } = CodeMirror;
const { dracula, nord } = CodeMirror;
const { syntaxHighlighting, defaultHighlightStyle, bracketMatching } = CodeMirror;
const { closeBrackets, closeBracketsKeymap, autocompletion, snippet } = CodeMirror;
const { MergeView } = CodeMirror;


// UUID v7 Generator (Time-ordered)
export const uuidv7 = () => {
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

// Table Editor Utilities
const TableUtils = {
	parse(markdownText) {
		if (!markdownText) return null;
		const lines = markdownText.trim().split('\n').filter(line => line.includes('|'));
		if (lines.length < 2) return null;

		const allRows = lines.map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
		const separatorRowIndex = allRows.findIndex(row => row.every(cell => /^[:\-\s]+$/.test(cell)));
		let alignments = [];

		if (separatorRowIndex !== -1) {
			alignments = allRows[separatorRowIndex].map(cell => {
				const hasLeft = cell.startsWith(':');
				const hasRight = cell.endsWith(':');
				if (hasLeft && hasRight) return 'c';
				return hasRight ? 'r' : (hasLeft ? 'l' : 'c');
			});
		}

		const dataRows = allRows.filter((_, idx) => idx !== separatorRowIndex);
		if (dataRows.length === 0) return null;
		if (alignments.length === 0) alignments = dataRows[0].map(() => 'c');

		return { rows: dataRows, alignments };
	},

	format(markdownText, forcedAlignments = null) {
		const parsed = TableUtils.parse(markdownText);
		if (!parsed) return markdownText;

		const { rows: dataRows, alignments: originalAlignments } = parsed;
		const alignments = forcedAlignments || originalAlignments;

		// Calculate max width for each column
		const colWidths = dataRows[0].map((_, c) => {
			return Math.max(3, ...dataRows.map(row => (row[c] ? row[c].length : 0)));
		});

		// Format data rows
		const formattedDataLines = dataRows.map(row => {
			const cells = row.map((cell, c) => {
				const w = colWidths[c];
				const align = alignments[c];
				if (align === 'c') {
					const left = Math.floor((w - cell.length) / 2);
					return ' '.repeat(left) + cell + ' '.repeat(w - cell.length - left);
				}
				return align === 'r' ? cell.padStart(w, ' ') : cell.padEnd(w, ' ');
			});
			return '| ' + cells.join(' | ') + ' |';
		});

		// Format separator row
		const sepCells = colWidths.map((w, c) => {
			const align = alignments[c];
			if (align === 'c') return ':' + '-'.repeat(w - 2) + ':';
			return align === 'r' ? '-'.repeat(w - 1) + ':' : ':' + '-'.repeat(w - 1);
		});
		const sepLine = '| ' + sepCells.join(' | ') + ' |';

		return [formattedDataLines[0], sepLine, ...formattedDataLines.slice(1)].join('\n');
	},

	generate(rows, alignments = null) {
		if (!rows || rows.length === 0) return '';
		const headers = rows[0];
		let md = `| ${headers.join(' | ')} |\n`;
		md += `| ${headers.map((_, i) => {
			const a = alignments ? alignments[i] : 'c';
			if (a === 'c' || a === 'center') return ':---:';
			if (a === 'r' || a === 'right') return '---:';
			return ':---';
		}).join(' | ')} |\n`;
		for (const row of rows.slice(1)) {
			md += `| ${row.join(' | ')} |\n`;
		}
		return md;
	},

	findBounds(doc, position) {
		const text = doc.toString();
		const lines = text.split('\n');
		const lineNo = doc.lineAt(position).number;

		if (!lines[lineNo - 1].includes('|')) return null;

		let start = lineNo, end = lineNo;
		while (start > 1 && lines[start - 2].includes('|')) start--;
		while (end < lines.length && lines[end].includes('|')) end++;

		const from = doc.line(start).from;
		const to = doc.line(end).to;
		return { from, to, text: text.substring(from, to) };
	}
};

// Compatibility Exports
export const parseMarkdownTable = TableUtils.parse;
export const generateMarkdownTable = TableUtils.generate;
export const formatMarkdownTable = TableUtils.format;
export const findTableBounds = TableUtils.findBounds;

// Search & Highlight Utilities
const SearchUtils = {
	getRegex(query, options = {}) {
		if (!query) return null;
		const { caseSensitive = false, useRegex = false } = options;
		try {
			const flags = caseSensitive ? 'g' : 'gi';
			const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			return new RegExp(pattern, flags);
		} catch (e) { return null; }
	},

	highlight(text, query, options = {}) {
		if (!text || !query) return text;
		const regex = this.getRegex(query, options);
		if (!regex) return text;

		const capRegex = new RegExp(`(${regex.source})`, regex.flags);
		const parts = text.split(capRegex);
		const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		return parts.map(part => {
			if (part && new RegExp('^' + regex.source + '$', regex.flags.replace('g', '')).test(part)) {
				return `<span class="search-highlight">${esc(part)}</span>`;
			}
			return esc(part);
		}).join('');
	}
};

// UI Utilities
const UIUtils = {
	createResizeHandler({ onResize, onStop, isHorizontal = true }) {
		let isResizing = false;
		const start = (e) => {
			isResizing = true;
			document.addEventListener('mousemove', move);
			document.addEventListener('mouseup', stop);
			document.body.style.userSelect = 'none';
			if (!isHorizontal) document.body.style.cursor = 'col-resize';
		};
		const move = (e) => { if (isResizing) onResize(e); };
		const stop = () => {
			isResizing = false;
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', stop);
			document.body.style.userSelect = '';
			document.body.style.cursor = '';
			if (onStop) onStop();
		};
		return { start };
	}
};

// Simple Fuzzy Matching with Scoring
export const fuzzyScore = (text, query) => {
	if (!query) return 1;
	const t = text.toLowerCase();
	const q = query.toLowerCase();

	if (t === q) return 1000;
	if (t.startsWith(q)) return 800;
	// if (t.includes(q)) return 600; // Removed to allow more detailed scoring

	let score = 0;
	if (t.includes(q)) score += 600; // Base score for inclusion
	let queryIdx = 0;
	let lastMatchIdx = -1;

	for (let i = 0; i < t.length; i++) {
		if (t[i] === q[queryIdx]) {
			// Base match
			score += 10;

			// Consecutive match bonus
			if (lastMatchIdx === i - 1) score += 20;

			// Start of word bonus
			if (i === 0 || t[i - 1] === ' ' || t[i - 1] === '_' || t[i - 1] === '-' || t[i - 1] === '/') {
				score += 30;
			}

			lastMatchIdx = i;
			queryIdx++;

			if (queryIdx === q.length) {
				// Bonus for shorter text (more specific match)
				return score + (100 / t.length);
			}
		}
	}
	return 0; // No match
};

export const normalizeRecentTabIds = (ids, maxCount = 10) => {
	if (!Array.isArray(ids)) return [];
	const seen = new Set();
	const normalized = [];
	for (const id of ids) {
		if (id === null || id === undefined) continue;
		const key = String(id);
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(key);
		if (normalized.length >= maxCount) break;
	}
	return normalized;
};

export const upsertRecentTabIds = (ids, nextId, maxCount = 10) => {
	if (nextId === null || nextId === undefined) return normalizeRecentTabIds(ids, maxCount);
	const nextKey = String(nextId);
	const base = normalizeRecentTabIds(ids, maxCount).filter(id => id !== nextKey);
	return [nextKey, ...base].slice(0, maxCount);
};

export const closeRecentTab = (ids, activeId, closingId) => {
	const normalized = normalizeRecentTabIds(ids, Number.MAX_SAFE_INTEGER);
	const closingKey = closingId === null || closingId === undefined ? null : String(closingId);
	if (!closingKey) {
		return {
			tabIds: normalized,
			activeTabId: activeId === null || activeId === undefined ? null : String(activeId)
		};
	}

	const activeKey = activeId === null || activeId === undefined ? null : String(activeId);
	const closeIndex = normalized.indexOf(closingKey);
	if (closeIndex === -1) {
		return { tabIds: normalized, activeTabId: activeKey };
	}

	const nextTabs = normalized.filter(id => id !== closingKey);
	let nextActive = activeKey;
	if (activeKey === closingKey) {
		nextActive = nextTabs[closeIndex] || nextTabs[closeIndex - 1] || nextTabs[0] || null;
	}
	return { tabIds: nextTabs, activeTabId: nextActive };
};

export const App = {
	setup() {
		const STORAGE_KEYS = {
			TOKEN: 'access_token',
			DARK_MODE: 'shynote_dark_mode',
			FONT_SIZE: 'shynote_font_size',
			SORT_FIELD: 'shynote_sort_field',
			SORT_DIRECTION: 'shynote_sort_direction',
			LAST_NOTE_ID: 'shynote_last_note_id',
			USER_ID: 'shynote_user_id',

			SPLIT_RATIO: 'shynote_split_ratio',
			LAST_FOLDER_ID: 'shynote_last_folder_id',
			LAST_PANEL_MODE: 'shynote_last_panel_mode',
			NOTE_USAGE_DATA: 'shynote_note_usage_v1',
			SIDEBAR_WIDTH: 'shynote_sidebar_width',
			RECENT_TAB_IDS: 'shynote_recent_tab_ids',
			ACTIVE_TAB_ID: 'shynote_active_tab_id'
		}

		const MAX_RECENT_TABS = 10

		const sidebarWidth = ref(320)
		const isResizingSidebar = ref(false)
		const currentUserId = ref(null)
		const sidebarViewMode = ref(localStorage.getItem('shynote_sidebar_view_mode') || 'simple')
		const sidebarPanelMode = ref('explorer') // 'explorer' | 'search'
		const listViewMode = ref(localStorage.getItem('shynote_list_view_mode') || 'grid')
		const rightPanelMode = ref('list')
		const currentFolderId = ref(null)
		const isSharing = ref(false)
		const isSortMenuOpen = ref(false)
		const searchQuery = ref('')
		const searchOptions = ref({ caseSensitive: false, useRegex: false })
		const isSearchOpen = ref(false)
		const splitRatio = ref(50)
		const isDarkMode = ref(true) // Initialized from localStorage later or below
		const isAuthenticated = ref(false)
		const fontSize = ref('14')
		const sortOption = ref({ field: 'title', direction: 'asc' })
		const appVersion = ref('')
		const changelogContent = ref('')
		const modalState = ref({
			isOpen: false,
			type: null,
			title: '',
			message: '',
			inputValue: '',
			inputPlaceholder: '',
			targetId: null,
			confirmText: 'Confirm',
			cancelText: 'Cancel',
			data: null
		})
		const tableEditorState = ref({
			isOpen: false,
			tableData: [],
			alignments: [],
			tableFrom: 0,
			tableTo: 0,
			rowCount: 0,
			colCount: 0,
			activeRow: 0,
			activeCol: 0
		})
		const hasIDB = typeof window !== 'undefined' && 'indexedDB' in window

		const getDarkTheme = () => (dracula || nord || githubLight);

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
			if (crypto && crypto.subtle) {
				const encoder = new TextEncoder();
				const data = encoder.encode(text);
				const hashBuffer = await crypto.subtle.digest('SHA-256', data);
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
			} else {
				// Fallback for secure context requirement (HTTP/Mobile LAN)
				return sha256(text).toString();
			}
		}

		// Clear Pending Logs Helper
		const clearPendingLogs = async () => {
			if (hasIDB && LocalDB.clearPendingLogs) {
				await LocalDB.clearPendingLogs();
			}
		}

		// User Settings Helper
		const getUserStorageKey = (key) => {
			const prefix = currentUserId.value ? `${currentUserId.value}_` : 'guest_';
			return `${prefix}${key}`;
		}

		const saveUserSetting = (key, value) => {
			localStorage.setItem(getUserStorageKey(key), String(value))
		}

		const trackNoteUsage = (id) => {
			if (!id) return;
			try {
				const key = STORAGE_KEYS.NOTE_USAGE_DATA;
				const dataStr = localStorage.getItem(getUserStorageKey(key)) || '{}';
				const data = JSON.parse(dataStr);
				if (!data[id]) data[id] = { count: 0, lastUsed: 0 };
				data[id].count += 1;
				data[id].lastUsed = Date.now();
				localStorage.setItem(getUserStorageKey(key), JSON.stringify(data));
			} catch (e) { console.error("Tracking error", e); }
		};

		const getNoteUsage = (id) => {
			try {
				const key = STORAGE_KEYS.NOTE_USAGE_DATA;
				const dataStr = localStorage.getItem(getUserStorageKey(key)) || '{}';
				const data = JSON.parse(dataStr);
				return data[id] || { count: 0, lastUsed: 0 };
			} catch (e) { return { count: 0, lastUsed: 0 }; }
		};

		const loadUserSettings = () => {
			// Settings that depend on user
			fontSize.value = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.FONT_SIZE)) || '14'

			const field = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SORT_FIELD)) || 'title'
			const dir = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SORT_DIRECTION)) || 'asc'
			sortOption.value = { field, direction: dir }

			const ratio = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SPLIT_RATIO))
			splitRatio.value = Number(ratio) || 50

			const sWidth = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.SIDEBAR_WIDTH))
			sidebarWidth.value = Number(sWidth) || 320

			// Dark Mode (Local Preference override before DB)
			const localDark = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.DARK_MODE))
			if (localDark !== null) {
				isDarkMode.value = localDark === 'true'
				applyTheme()
			}
		}

		const TRASH_FOLDER_ID = computed(() => {
			const uid = currentUserId.value;
			return uid ? `trash-${uid}` : "trash-guest";
		});
		const notes = ref([])
		const trashNotesCount = computed(() => {
			if (!notes.value) return 0;
			const tid = TRASH_FOLDER_ID.value;
			return notes.value.filter(n =>
				n && (n.folder_id == tid ||
					(typeof n.folder_id === 'string' && n.folder_id.startsWith('trash-')))
			).length;
		});
		const pinnedNotes = ref([])
		const folders = ref([])
		const selectedNote = ref(null)
		const openTabIds = ref([])
		const activeTabId = ref(null)

		const openTabs = computed(() => {
			const map = new Map(notes.value.map(n => [String(n.id), n]));
			return openTabIds.value
				.map(id => {
					const key = String(id);
					const note = map.get(key);
					return note ? { id: key, title: note.title || 'Untitled', note } : null;
				})
				.filter(Boolean);
		})

		const persistTabs = () => {
			saveUserSetting(STORAGE_KEYS.RECENT_TAB_IDS, JSON.stringify(openTabIds.value));
			saveUserSetting(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId.value || '');
		}

		const openOrActivateTab = (noteId) => {
			if (noteId === null || noteId === undefined) return;
			openTabIds.value = upsertRecentTabIds(openTabIds.value, noteId, MAX_RECENT_TABS);
			activeTabId.value = String(noteId);
			persistTabs();
		}

		const resolveSelectedNoteByTab = (tabId) => {
			if (!tabId) {
				selectedNote.value = null;
				return;
			}
			const note = notes.value.find(n => String(n.id) === String(tabId));
			selectedNote.value = note || null;
		}

		const activateTab = async (tabId) => {
			if (tabId === null || tabId === undefined) return;
			const note = notes.value.find(n => String(n.id) === String(tabId));
			if (!note) return;
			await selectNote(note);
		}

		const closeTab = (tabId) => {
			const next = closeRecentTab(openTabIds.value, activeTabId.value, tabId);
			openTabIds.value = next.tabIds;
			activeTabId.value = next.activeTabId;
			resolveSelectedNoteByTab(activeTabId.value);
			if (!activeTabId.value) {
				rightPanelMode.value = 'edit';
				saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'edit');
			}
			persistTabs();
		}

		const closeAllTabs = () => {
			openTabIds.value = [];
			activeTabId.value = null;
			selectedNote.value = null;
			rightPanelMode.value = 'edit';
			saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'edit');
			persistTabs();
		}

		const pruneTabsWithNotes = () => {
			const validIds = new Set(notes.value.map(n => String(n.id)));
			const pruned = openTabIds.value.filter(id => validIds.has(String(id)));
			const changedTabs = pruned.length !== openTabIds.value.length;
			const prevActive = activeTabId.value;
			if (changedTabs) {
				openTabIds.value = pruned;
			}

			if (activeTabId.value && !validIds.has(String(activeTabId.value))) {
				activeTabId.value = openTabIds.value[0] || null;
			}

			if (selectedNote.value && !validIds.has(String(selectedNote.value.id))) {
				selectedNote.value = null;
			}

			if (!activeTabId.value && openTabIds.value.length === 0 && rightPanelMode.value === 'edit') {
				selectedNote.value = null;
			}

			if (changedTabs || prevActive !== activeTabId.value) {
				persistTabs();
			}
		}

		const loading = ref(false)
		const isSyncing = ref(false)
		const lastSyncTime = ref(null)
		const syncQueueCount = ref(0)
		const conflictState = ref({ isConflict: false, localNote: null, serverNote: null })
		const conflictMap = ref({}) // { noteId: { local: Note, server: Note } }
		const statusMessage = ref('Ready')

		const shortStatusMessage = computed(() => {
			const msg = statusMessage.value === 'Ready' ? 'Save Complete' : statusMessage.value;
			const map = {
				'Save Complete': 'Saved',
				'Typing...': 'Typing',
				'Saving...': 'Saving',
				'Error saving': 'Save Err',
				'Push Complete': 'Pushed',
			};
			// Handle "Pushing (N)..." -> "Push(N)"
			if (msg.startsWith('Pushing')) {
				return msg.replace('Pushing ', 'Push').replace('...', '');
			}
			// Handle "Imported N files" -> "Import(N)"
			if (msg.startsWith('Imported')) {
				const match = msg.match(/Imported (\d+) files/);
				if (match) return `Import(${match[1]})`;
			}
			return map[msg] || msg.replace('...', '');
		});

		const shortLoadingMessage = computed(() => {
			const msg = loadingState.value.message;
			const map = {
				'Idle': '-',
				'Authenticating...': 'Auth...',
				'Login successful': 'Hello',
				'Load Complete': 'Loaded',
				'Local Cache': 'Cache',
				'Syncing...': 'Syncing',
				'Pull Complete': 'Pulled',
				'Sync Complete': 'Synced',
				'Sync Failed': 'Sync Err',
			};
			return map[msg] || msg;
		});
		const loadingState = ref({ source: 'NONE', message: 'Idle' }) // NEW: Data Source Tracking
		const isSidebarOpen = ref(true)
		const editorRef = ref(null)
		const previewRef = ref(null)
		const currentUserEmail = ref(null) // Added for UI
		const signpost = ref({ show: false, text: '', opacity: 0.5 }) // For general signpost messages

		// Multi-Select State
		const isSelectionMode = ref(false)
		const selectedNoteIds = ref(new Set())
		const viewMode = ref(localStorage.getItem('shynote_view_mode') || 'edit')
		watch(viewMode, (newVal) => {
			localStorage.setItem('shynote_view_mode', newVal)
		})

		// Dark mode is global/device specific usually, but code requested "User Info". 
		// Let's keep dark mode global for now as per industry standard? 
		// Or user profile has 'is_dark_mode' so it syncs from DB actually!
		// But local fallback:

		isAuthenticated.value = false // reset explicitly if needed or remove redunant
		isDarkMode.value = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === null ? true : localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true'


		const serverDbType = ref(null) // Added for DB Type Logic

		const isMobile = ref(window.innerWidth < 768)
		const showCommandPalette = ref(false)
		const paletteMode = ref('commands') // 'commands', 'notes', 'folders', 'move-dest'
		const paletteQuery = ref('')
		const paletteIndex = ref(0)
		const paletteInput = ref(null)
		const paletteList = ref(null)
		const isEditModeActive = ref(false)

		const handleWindowResize = () => {
			isMobile.value = window.innerWidth < 768
		}


		const initMobileDragDrop = () => {
			if (!polyfill) return

			var mobileDragDropOptions = {
				dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
				holdToDrag: 500,
				startThreshold: 15,
				ignoreSelector: 'input, textarea, .cm-content, .cm-scroller, .cm-editor',
				dragStartClass: 'drag-starting',
				elementDragClass: 'element-dragging'
			};

			// Enhanced text selection detection
			window.addEventListener('touchstart', function (e) {
				if (!e.touches.length) return;
				const touch = e.touches[0];
				const target = document.elementFromPoint(touch.clientX, touch.clientY);

				if (target && target.closest('.cm-editor')) {
					const draggables = document.querySelectorAll('.draggable-touch');
					draggables.forEach(el => {
						if (el.contains(target)) return;
						el.setAttribute('data-selection-mode', 'true');
					});
				}
			}, { passive: true, capture: true });

			window.addEventListener('touchend', function () {
				setTimeout(() => {
					document.querySelectorAll('[data-selection-mode="true"]').forEach(el => {
						el.removeAttribute('data-selection-mode');
					});
				}, 200);
			}, { passive: true });

			polyfill(mobileDragDropOptions);
		}

		onMounted(() => {
			window.addEventListener('resize', handleWindowResize)
			initMobileDragDrop()

			const sidebarSearchInput = document.getElementById('sidebar-search-input')
			if (sidebarSearchInput) {
				setupSearchHistoryNavigation(sidebarSearchInput)
			}

			searchHistoryObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === 1) {
							const searchInput = node.querySelector?.('.cm-search input[name="search"]')
							if (searchInput) {
								setupSearchHistoryNavigation(searchInput)
							} else if (node.classList?.contains('cm-panel') && node.classList?.contains('cm-search')) {
								const nestedSearchInput = node.querySelector('input[name="search"]')
								if (nestedSearchInput) {
									setupSearchHistoryNavigation(nestedSearchInput)
								}
							}
						}
					}
				}
			})

			if (editorRef.value) {
				searchHistoryObserver.observe(editorRef.value, {
					childList: true,
					subtree: true
				})
			} else {
				searchHistoryObserver.observe(document.body, {
					childList: true,
					subtree: true
				})
			}

			// Backlink click handler for preview + Close menus on outside click
			document.addEventListener('click', (e) => {
				// Handle preview backlinks
				const link = e.target.closest('.backlink');
				if (link) {
					e.preventDefault();
					const noteId = link.dataset.noteId;
					if (noteId) {
						selectNoteById(noteId);
					}
				}

				// Close backlinks menu when clicking outside
				if (showBacklinksMenu.value) {
					const inBacklinksMenu = e.target.closest('.z-50') && e.target.closest('.max-h-80');
					const isIdClick = e.target.classList.contains('font-mono') && e.target.closest('.relative');
					if (!inBacklinksMenu && !isIdClick) {
						showBacklinksMenu.value = false;
					}
				}
			});
		})

		onUnmounted(() => {
			window.removeEventListener('resize', handleWindowResize)
			if (searchHistoryObserver) {
				searchHistoryObserver.disconnect()
			}
		})

		const setFontSize = (size) => {
			fontSize.value = size
			saveUserSetting(STORAGE_KEYS.FONT_SIZE, size)
		}

		const searchHistory = ref(JSON.parse(localStorage.getItem('shynote_search_history') || '[]'))
		const searchInputStates = new WeakMap()
		let searchHistoryObserver = null
		const showSearchHistoryDropdown = ref(false)
		const searchHistoryDropdownIndex = ref(-1)

		const hideSearchHistoryDropdown = () => {
			setTimeout(() => {
				showSearchHistoryDropdown.value = false
				searchHistoryDropdownIndex.value = -1
			}, 200)
		}

		const selectSearchHistoryItem = (item) => {
			searchQuery.value = item
			showSearchHistoryDropdown.value = false
			searchHistoryDropdownIndex.value = -1
			const sidebarSearchInput = document.getElementById('sidebar-search-input')
			if (sidebarSearchInput) {
				sidebarSearchInput.value = item
				sidebarSearchInput.dispatchEvent(new Event('input'))
			}
		}

		const saveSearchHistory = (query) => {
			if (!query || query.trim() === '') return

			const trimmed = query.trim()
			const history = [...searchHistory.value]

			const filtered = history.filter(h => h !== trimmed)
			filtered.unshift(trimmed)

			searchHistory.value = filtered.slice(0, 10)
			localStorage.setItem('shynote_search_history', JSON.stringify(searchHistory.value))
		}




		const setupSearchHistoryNavigation = (searchInput) => {
			if (!searchInput) return

			if (searchInputStates.has(searchInput)) return

			const state = {
				index: searchHistory.value.length,
				currentQuery: '',
				isDropdownVisible: false
			}

			searchInputStates.set(searchInput, state)

			const keydownHandler = (e) => {
				if (e.key === 'ArrowUp' && state.index > 0) {
					e.preventDefault()
					state.index--
					searchInput.value = searchHistory.value[state.index]
					if (searchInput.id === 'sidebar-search-input') {
						searchQuery.value = searchInput.value
					}
				} else if (e.key === 'ArrowDown') {
					e.preventDefault()
					if (state.index < searchHistory.value.length - 1) {
						state.index++
						searchInput.value = searchHistory.value[state.index]
						if (searchInput.id === 'sidebar-search-input') {
							searchQuery.value = searchInput.value
						}
					} else if (state.index === searchHistory.value.length - 1) {
						state.index = searchHistory.value.length
						searchInput.value = state.currentQuery
						if (searchInput.id === 'sidebar-search-input') {
							searchQuery.value = searchInput.value
						}
					}
				} else if (e.key === 'Enter' && searchInput.value.trim()) {
					saveSearchHistory(searchInput.value)
					state.index = searchHistory.value.length
					state.currentQuery = ''
					if (searchInput.id === 'sidebar-search-input') {
						showSearchHistoryDropdown.value = false
						searchHistoryDropdownIndex.value = -1
					}
				} else if (e.key === 'Escape') {
					if (searchInput.id === 'sidebar-search-input') {
						showSearchHistoryDropdown.value = false
						searchHistoryDropdownIndex.value = -1
					}
				}
			}

			const inputHandler = (e) => {
				if (state.index === searchHistory.value.length) {
					state.currentQuery = e.target.value
				}
			}

			const focusHandler = () => {
				state.index = searchHistory.value.length
				state.currentQuery = searchInput.value
				if (searchInput.id === 'sidebar-search-input') {
					showSearchHistoryDropdown.value = true
					searchHistoryDropdownIndex.value = -1
				}
			}

			const cleanup = () => {
				searchInput.removeEventListener('keydown', keydownHandler)
				searchInput.removeEventListener('input', inputHandler)
				searchInput.removeEventListener('focus', focusHandler)
				searchInput.removeEventListener('blur', cleanup)
			}

			searchInput.addEventListener('keydown', keydownHandler)
			searchInput.addEventListener('input', inputHandler)
			searchInput.addEventListener('focus', focusHandler)
			searchInput.addEventListener('blur', cleanup)
		}


		const setSidebarViewMode = (mode) => {
			sidebarViewMode.value = mode
			localStorage.setItem('shynote_sidebar_view_mode', mode)
		}

		const setSidebarPanelMode = (mode) => {
			if (sidebarPanelMode.value === mode && isSidebarOpen.value) {
				isSidebarOpen.value = false
			} else {
				sidebarPanelMode.value = mode
				isSidebarOpen.value = true
				if (mode === 'search') {
					setTimeout(() => {
						const searchInput = document.getElementById('sidebar-search-input')
						if (searchInput) searchInput.focus()
					}, 300)
				}
			}
		}
		// List View Mode (Grid vs List)

		const toggleListViewMode = () => {
			listViewMode.value = listViewMode.value === 'grid' ? 'list' : 'grid'
			localStorage.setItem('shynote_list_view_mode', listViewMode.value)
		}

		// New 2-Column Layout State



		const searchResults = computed(() => {
			if (!searchQuery.value) return []

			const regex = SearchUtils.getRegex(searchQuery.value, searchOptions.value)
			if (!regex) return []

			const results = []
			for (const note of notes.value) {
				let noteMatched = false
				const matchedLines = []

				regex.lastIndex = 0
				if (regex.test(note.title)) noteMatched = true

				regex.lastIndex = 0
				const content = note.content || ''
				let match

				while ((match = regex.exec(content)) !== null) {
					const lineStart = content.lastIndexOf('\n', match.index) + 1
					let lineEnd = content.indexOf('\n', match.index)
					if (lineEnd === -1) lineEnd = content.length

					const line = content.substring(lineStart, lineEnd).trim()
					if (line) matchedLines.push(line)
					noteMatched = true

					if (match.index === regex.lastIndex) regex.lastIndex++
					if (matchedLines.length >= 4) break
				}

				if (noteMatched) {
					const uniqueLines = [...new Set(matchedLines)]
					results.push({ note, snippet: uniqueLines.join(' ... ') })
				}
				if (results.length > 50) break
			}
			return results
		})

		const selectSearchResult = (note) => {
			selectNote(note)
			if (window.innerWidth < 768) isSidebarOpen.value = false
		}

		const getHighlightedText = (text) => SearchUtils.highlight(text, searchQuery.value, searchOptions.value)

		const dbType = computed(() => {
			if (currentUserId.value === 'guest') {
				return hasIDB ? 'IndexedDB' : 'Memory'
			}
			return serverDbType.value || 'Memory'
		})


		// New UI States


		// Split Resize Logic
		const { start: startResize } = UIUtils.createResizeHandler({
			onResize: (e) => {
				const container = document.querySelector('.split-container')
				if (!container) return
				const containerRect = container.getBoundingClientRect()
				const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100
				if (newRatio > 20 && newRatio < 80) splitRatio.value = newRatio
			},
			onStop: () => saveUserSetting(STORAGE_KEYS.SPLIT_RATIO, splitRatio.value)
		})

		const { start: startSidebarResize } = UIUtils.createResizeHandler({
			onResize: (e) => {
				const newWidth = e.clientX
				if (newWidth > 200 && newWidth < 600) sidebarWidth.value = newWidth
			},
			onStop: () => saveUserSetting(STORAGE_KEYS.SIDEBAR_WIDTH, sidebarWidth.value),
			isHorizontal: false
		})



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
			currentUserEmail.value = null
			notes.value = []
			folders.value = []
			selectedNote.value = null
		}

		// Handle Logout with confirmation and cache clearing
		const handleLogout = () => {
			modalState.value = {
				isOpen: true,
				type: 'logout',
				title: 'Logout',
				message: 'Are you sure you want to logout? Local data will be cleared and app will return to Guest Mode.',
				confirmText: 'Logout',
				cancelText: 'Cancel',
				inputValue: '',
				inputPlaceholder: '',
				targetId: null,
				data: null
			}
		}

		// Show login modal
		const showLoginModal = () => {
			logout() // Clear any existing auth state
		}

		const cancelLogin = async () => {
			await checkAuth()
		}

		const GuestHandlers = {
			handle(url, method, body) {
				const ok = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })
				const bad = (msg = 'Bad Request') => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: msg }) })

				// 1. Auth
				if (url.includes('/auth/me')) {
					if (method === 'GET') return ok(guestStore.user)
					if (method === 'PATCH') return Object.assign(guestStore.user, body), ok(guestStore.user)
				}

				// 2. Folders
				if (url.includes('/api/folders')) {
					if (method === 'GET') return ok([...guestStore.folders])
					if (method === 'POST') {
						const f = { id: Date.now(), name: body.name, user_id: 'guest', created_at: new Date().toISOString() }
						guestStore.folders.push(f)
						return ok(f)
					}
					const id = parseInt(url.match(/\/api\/folders\/(\d+)/)?.[1])
					if (id) {
						const f = guestStore.folders.find(x => x.id === id)
						if (method === 'PUT' && f) return f.name = body.name, ok(f)
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
						const n = { id: Date.now(), title: body.title || 'Untitled', content: body.content || '', folder_id: body.folder_id, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
						guestStore.notes.unshift(n)
						return ok(n)
					}
					const id = parseInt(url.match(/\/api\/notes\/(\d+)/)?.[1])
					if (id) {
						const n = guestStore.notes.find(x => x.id === id)
						if (!n) return bad('Not Found')
						if (method === 'PUT') {
							if (body.title !== undefined) n.title = body.title
							if (body.content !== undefined) n.content = body.content
							if (body.folder_id !== undefined) n.folder_id = body.folder_id
							n.updated_at = new Date().toISOString()
							return ok(n)
						}
						if (method === 'DELETE') return guestStore.notes = guestStore.notes.filter(x => x.id !== id), ok({ success: true })
					}
				}
				return ok({})
			}
		}

		const authenticatedFetch = async (url, options = {}) => {
			const token = localStorage.getItem('access_token')

			if (token === 'guest') {
				await new Promise(r => setTimeout(r, 50))
				const method = options.method || 'GET'
				let body = {}
				if (options.body) {
					try {
						body = options.body instanceof FormData ? Object.fromEntries(options.body) : JSON.parse(options.body)
					} catch (e) { }
				}
				return GuestHandlers.handle(url, method, body)
			}

			if (!token) return null

			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 30000)

			try {
				const res = await fetch(url, { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${token}` }, signal: controller.signal })
				clearTimeout(timeoutId)
				if (res.status === 401) return logout(), null
				return res
			} catch (e) {
				clearTimeout(timeoutId)
				if (e.name === 'AbortError') throw new Error('Network timeout')
				throw e
			}
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

			// FIX: Mark as dirty IMMEDIATELY in memory so pullSync/fetchNotes 
			// can protect this note before the 1s debounce timer fires.
			if (selectedNote.value) {
				selectedNote.value.sync_status = 'dirty'

				// Ensure the list also reflects the dirty state immediately
				const idx = notes.value.findIndex(n => n.id === selectedNote.value.id)
				if (idx !== -1) {
					notes.value[idx].sync_status = 'dirty'
				}
			}

			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(async () => {
				if (!selectedNote.value) return
				selectedNote.value.updated_at = new Date().toISOString()

				if (hasIDB) {
					try {
						const rawNote = JSON.parse(JSON.stringify(selectedNote.value))
						if (!rawNote.user_id) {
							rawNote.user_id = currentUserId.value || 'guest'
						}
						await LocalDB.saveNote(rawNote)
						statusMessage.value = 'Save Complete' // Renamed from 'Saved locally'

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
					if (!rawNote.user_id) rawNote.user_id = currentUserId.value || 'guest'

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


		let isSyncingProcess = false
		// --- Sync Helpers ---
		const pullSync = async () => {
			if (!hasIDB || !isAuthenticated.value || currentUserId.value === 'guest') return;

			try {
				await syncWorker();
				await Promise.all([fetchFolders(false), fetchNotes(false)]);

				loadingState.value = { source: 'CLOUD', message: 'Sync Complete' };
				showSignpost('🔄 Pull Sync Complete');
				setTimeout(() => loadingState.value = { source: 'NONE', message: 'Idle' }, 2000);

			} catch (error) {
				console.error('Pull sync failed:', error);
				loadingState.value = { source: 'CLOUD', message: 'Sync Failed' };
			}
		}

		const buildRequest = (log) => {
			const isCreate = log.action === 'CREATE'
			const isDelete = log.action === 'DELETE'
			const type = log.entity === 'folder' ? 'folders' : 'notes'

			let url, method, body

			if (isDelete) {
				url = `/api/${type}/${log.entity_id}`
				method = 'DELETE'
			} else {
				// CREATE or UPDATE
				url = isCreate ? `/api/${type}` : `/api/${type}/${log.entity_id}`
				method = isCreate ? 'POST' : 'PUT'

				// Safe Body Construction
				const rawBody = isCreate ? { id: log.entity_id, ...log.payload } : log.payload
				body = { ...rawBody }

				// Sanitize & Remap fields
				const LEGACY_TRASH_ID = 'trash-0000-0000-0000-000000000000'

				if (body.folder_id === 'null' || body.folder_id === '') {
					body.folder_id = null
				} else if (body.folder_id === LEGACY_TRASH_ID || (typeof body.folder_id === 'string' && body.folder_id.startsWith('trash-'))) {
					// Remap ANY trash folder ID to the CURRENT user's trash ID during sync
					if (typeof TRASH_FOLDER_ID !== 'undefined' && TRASH_FOLDER_ID.value) {
						body.folder_id = TRASH_FOLDER_ID.value
					}
				}
			}
			return { url, method, body, isDelete, isCreate }
		}
		const syncWithRetry = async (url, options, retries = 0) => {
			const MAX_RETRIES = 2
			const DELAY = 1000

			try {
				const response = await authenticatedFetch(url, options)
				// If server error or rate limit, retry
				if (!response.ok && (htmlStatus(response.status).serverError || response.status === 429) && retries < MAX_RETRIES) {
					console.warn(`Sync retry ${retries + 1}/${MAX_RETRIES} for ${url}`)
					await new Promise(r => setTimeout(r, DELAY * (retries + 1)))
					return syncWithRetry(url, options, retries + 1)
				}
				return response
			} catch (e) {
				if (retries < MAX_RETRIES) {
					// Network error, retry
					console.warn(`Sync retry ${retries + 1}/${MAX_RETRIES} (Network) for ${url}`)
					await new Promise(r => setTimeout(r, DELAY * (retries + 1)))
					return syncWithRetry(url, options, retries + 1)
				}
				throw e
			}
		}

		// Helper since we don't have a global htmlStatus helper yet in this scope
		const htmlStatus = (s) => ({ serverError: s >= 500 && s < 600 })


		// Sync Queue Logic (Sequential Folders, Parallel Notes)
		const saveToLog = (type, id, data = {}) => {
			if (!isAuthenticated.value || currentUserId.value === 'guest') return // Guest Mode Limit

			const change = {
				type,
				id,
				timestamp: Date.now(),
				...data
			}
			changeLog.value.push(change)
			debouncedSync()
		}

		// Helper: Debounce
		const debounce = (func, wait) => {
			let timeout
			return (...args) => {
				clearTimeout(timeout)
				timeout = setTimeout(() => func(...args), wait)
			}
		}

		const debouncedSync = debounce(() => {
			syncWorker()
		}, 2000)

		const syncWorker = async () => {
			if (!hasIDB || isSyncing.value || !isAuthenticated.value || currentUserId.value === 'guest') return
			if (isSyncingProcess) return
			isSyncingProcess = true
			isSyncing.value = true

			// ✅ Track actual work performed
			let didWork = false

			try {
				const allLogs = await LocalDB.getPendingLogs()

				// Filter out known conflicts
				const logs = allLogs ? allLogs.filter(log =>
					!conflictMap.value[log.entity_id] &&
					!(conflictState.value.isConflict && conflictState.value.localNote?.id === log.entity_id)
				) : []

				// Update Queue Count (Show total or actionable? Let's show all pending for now so user knows something is unsynced)
				// Actually, if we want to stop "Pushing...", we should probably show actionable count or handling this UI wise.
				// Let's use actionable logs for sync, but maybe keep total count visible if we want?
				// For now, let's just drive logic with filtered logs.
				syncQueueCount.value = logs.length

				if (logs && logs.length > 0) {
					// ✅ Mark that we attempted work
					didWork = true

					// Leader Election:
					// Using navigator.locks ensures that across all Tabs, Windows, and PWAs (sharing the same Origin),
					// only ONE instance will process the sync queue at a time.
					// This prevents "Double Sync" where the Web App and Browser both try to push the same data.
					if (navigator.locks) {
						await navigator.locks.request('shynote_sync_lock', { ifAvailable: true }, async (lock) => {
							if (!lock) {
								// console.log('[Sync] Skipped (Another instance is leader)')
								return
							}

							// --- We are the Leader ---
							// console.log('[Sync] Acquired lock, starting sync...')

							// 1. Dedup: Collapse multiple updates
							const latestUpdates = {}
							for (const log of logs) {
								const existing = latestUpdates[log.entity_id]
								if (existing && existing.action === 'CREATE' && log.action === 'UPDATE') {
									latestUpdates[log.entity_id] = { ...log, action: 'CREATE', payload: { ...existing.payload, ...log.payload } }
								} else {
									latestUpdates[log.entity_id] = log
								}
							}

							if (statusMessage.value !== 'Typing...') {
								statusMessage.value = `Pushing (${logs.length})...`
							}

							// Split Folders / Notes
							const folderUpdates = []
							const noteUpdates = []
							Object.values(latestUpdates).forEach(log => {
								if (log.entity === 'folder') folderUpdates.push(log)
								else noteUpdates.push(log)
							})

							let successCount = 0

							// --- Phase 1: Folders (Sequential) ---
							for (const log of folderUpdates) {
								// SKIP syncing Trash folders to server (System reserved)
								if (log.entity_id === TRASH_FOLDER_ID.value ||
									(typeof log.entity_id === 'string' && log.entity_id.startsWith('trash-')) ||
									(log.payload && log.payload.name === 'Trash')) {

									const processedLogIds = logs.filter(l => l.entity === 'folder' && l.entity_id === log.entity_id).map(l => l.id)
									await LocalDB.removeLogsBulk(processedLogIds)
									await LocalDB.markFolderSynced(log.entity_id)
									syncQueueCount.value = Math.max(0, syncQueueCount.value - processedLogIds.length)
									continue
								}

								const { url, method, body, isDelete } = buildRequest(log)

								try {
									const response = await syncWithRetry(url, {
										method,
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify(body)
									})

									if (response.ok || (isDelete && response.status === 404)) {
										// Transactional cleanup - Safe Bulk Delete
										// Only delete logs that match the ID we actually processed
										const processedLogIds = logs
											.filter(l => l.entity === log.entity && l.entity_id === log.entity_id)
											.map(l => l.id)

										await LocalDB.removeLogsBulk(processedLogIds)
										await LocalDB.markFolderSynced(log.entity_id)

										syncQueueCount.value = Math.max(0, syncQueueCount.value - processedLogIds.length)
										statusMessage.value = `Pushing (${syncQueueCount.value})...`
										successCount++
									} else {
										console.error(`Sync Failed for folder ${log.entity_id}:`, response.status)
									}
								} catch (e) {
									console.error(`Sync Error folder ${log.entity_id}:`, e)
								}
							}

							// --- Phase 2: Notes (Parallel Batches) ---
							const BATCH_SIZE = 10
							let needsPull = false;

							for (let i = 0; i < noteUpdates.length; i += BATCH_SIZE) {
								const batch = noteUpdates.slice(i, i + BATCH_SIZE)

								await Promise.all(batch.map(async (log) => {
									// Skip if known conflict
									if (conflictMap.value[log.entity_id] || conflictState.value.isConflict && conflictState.value.localNote?.id === log.entity_id) {
										return
									}

									const { url, method, body, isDelete } = buildRequest(log)

									// Optimistic Locking: Always inject current Memory Version for Updates
									if (!isDelete && method === 'PUT') {
										const currentNote = notes.value.find(n => n.id === log.entity_id);
										if (currentNote && currentNote.version) {
											body.version = currentNote.version;
										} else {
											// Fallback: If not in memory (rare), try to fetch from IDB? 
											// Or just let it fail if missing. Usually partial updates need version.
										}
									}

									try {
										let response = await syncWithRetry(url, {
											method,
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify(body)
										})

										// Recovery: PUT 404 -> POST
										if (!response.ok && response.status === 404 && method === 'PUT') {
											console.warn(`[Sync Recovery] Note ${log.entity_id} missing. Attempting re-creation...`)
											const recoveryBody = { id: log.entity_id, ...log.payload }
											response = await syncWithRetry('/api/notes', {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify(recoveryBody)
											})
										}

										// Optimistic Locking: Handle Conflict (409)
										if (response.status === 409) {
											console.warn(`[Sync] Conflict 409 for Note ${log.entity_id}. Server version mismatch.`);
											needsPull = true;
											return; // Stop processing this note
										}

										if (response.ok || (isDelete && response.status === 404)) {
											// Success: Delete processed logs from snapshot

											if (response.ok && method !== 'DELETE') {
												const data = await response.json();
												if (data && data.version) {
													// 1. Update IDB
													await LocalDB.updateNoteVersion(log.entity_id, data.version);

													// 2. Update Memory (Reactive State)
													const updateInMemory = (nid, ver) => {
														// Update List
														const n = notes.value.find(n => n.id === nid);
														if (n) n.version = ver;

														// Update Selected Note
														if (selectedNote.value && selectedNote.value.id === nid) {
															selectedNote.value.version = ver;
														}
													}
													updateInMemory(log.entity_id, data.version);
												}
											}

											const processedLogIds = logs
												.filter(l => l.entity === log.entity && l.entity_id === log.entity_id)
												.map(l => l.id)

											await LocalDB.removeLogsBulk(processedLogIds)
											await LocalDB.markNoteSynced(log.entity_id)

											syncQueueCount.value = Math.max(0, syncQueueCount.value - processedLogIds.length)
											statusMessage.value = `Pushing (${syncQueueCount.value})...`
											successCount++
										} else {
											console.error(`Sync Failed for note ${log.entity_id}:`, response.status)
										}
									} catch (e) {
										console.error(`Sync Error note ${log.entity_id}:`, e)
									}
								}))
							}

							if (needsPull) {
								console.log('[Sync] Conflicts detected. Triggering Pull...');
								fetchNotes(true);
							}

							if (successCount > 0) {
								lastSyncTime.value = new Date()
							}

							// Re-check
							const remaining = await LocalDB.getPendingLogs()
							syncQueueCount.value = remaining ? remaining.length : 0
							// console.log('[Sync] Lock releasing...')
						})
					} else {
						// ✅ Fallback for browsers without Web Lock API
						console.warn('[Sync] Web Lock API not supported, proceeding without lock')

						// 1. Dedup: Collapse multiple updates
						const latestUpdates = {}
						for (const log of logs) {
							const existing = latestUpdates[log.entity_id]
							if (existing && existing.action === 'CREATE' && log.action === 'UPDATE') {
								latestUpdates[log.entity_id] = { ...log, action: 'CREATE', payload: { ...existing.payload, ...log.payload } }
							} else {
								latestUpdates[log.entity_id] = log
							}
						}

						if (statusMessage.value !== 'Typing...') {
							statusMessage.value = `Pushing (${logs.length})...`
						}

						// Split Folders / Notes
						const folderUpdates = []
						const noteUpdates = []
						Object.values(latestUpdates).forEach(log => {
							if (log.entity === 'folder') folderUpdates.push(log)
							else noteUpdates.push(log)
						})

						let successCount = 0

						// --- Phase 1: Folders (Sequential) ---
						for (const log of folderUpdates) {
							const { url, method, body, isDelete } = buildRequest(log)

							try {
								const response = await syncWithRetry(url, {
									method,
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(body)
								})

								if (response.ok || (isDelete && response.status === 404)) {
									// Transactional cleanup - Safe Bulk Delete
									const processedLogIds = logs
										.filter(l => l.entity === log.entity && l.entity_id === log.entity_id)
										.map(l => l.id)

									await LocalDB.removeLogsBulk(processedLogIds)
									await LocalDB.markFolderSynced(log.entity_id)

									syncQueueCount.value = Math.max(0, syncQueueCount.value - processedLogIds.length)
									statusMessage.value = `Pushing (${syncQueueCount.value})...`
									successCount++
								} else {
									console.error(`Sync Failed for folder ${log.entity_id}:`, response.status)
								}
							} catch (e) {
								console.error(`Sync Error folder ${log.entity_id}:`, e)
							}
						}

						// --- Phase 2: Notes (Parallel Batches) ---
						const BATCH_SIZE = 10
						for (let i = 0; i < noteUpdates.length; i += BATCH_SIZE) {
							const batch = noteUpdates.slice(i, i + BATCH_SIZE)

							await Promise.all(batch.map(async (log) => {
								const { url, method, body, isDelete } = buildRequest(log)

								try {
									let response = await syncWithRetry(url, {
										method,
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify(body)
									})

									// Recovery: PUT 404 -> POST
									if (!response.ok && response.status === 404 && method === 'PUT') {
										console.warn(`[Sync Recovery] Note ${log.entity_id} missing. Attempting re-creation...`)
										const recoveryBody = { id: log.entity_id, ...log.payload }
										response = await syncWithRetry('/api/notes', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify(recoveryBody)
										})
									}

									if (response.ok || (isDelete && response.status === 404)) {
										// Success: Delete processed logs from snapshot
										const processedLogIds = logs
											.filter(l => l.entity === log.entity && l.entity_id === log.entity_id)
											.map(l => l.id)

										await LocalDB.removeLogsBulk(processedLogIds)
										await LocalDB.markNoteSynced(log.entity_id)

										syncQueueCount.value = Math.max(0, syncQueueCount.value - processedLogIds.length)
										statusMessage.value = `Pushing (${syncQueueCount.value})...`
										successCount++
									} else {
										console.error(`Sync Failed for note ${log.entity_id}:`, response.status)
									}
								} catch (e) {
									console.error(`Sync Error note ${log.entity_id}:`, e)
								}
							}))
						}

						if (successCount > 0) {
							lastSyncTime.value = new Date()
						}

						// Re-check
						const remaining = await LocalDB.getPendingLogs()
						syncQueueCount.value = remaining ? remaining.length : 0
					}
				}
			} catch (e) {
				console.error("Sync Error", e)
			} finally {
				isSyncingProcess = false
				isSyncing.value = false

				// ✅ Only show completion message if we actually did work
				if (didWork && statusMessage.value.startsWith('Pushing')) {
					statusMessage.value = 'Push Complete'
				} else if (!didWork && statusMessage.value.startsWith('Pushing')) {
					statusMessage.value = 'Ready'  // Reset if no work was done
				}
			}
		}


		// --- Smart Sync Logic ---
		// Initialize isOnline carefully. 
		// Note: navigator.onLine is true by default in some contexts if undefined.
		const isOnline = ref(true)

		if (typeof navigator !== 'undefined') {
			isOnline.value = navigator.onLine
		}

		let syncInterval = null

		const startSync = () => {
			if (syncInterval) clearInterval(syncInterval)
			// Check isOnline again just in case
			if (isOnline.value && hasIDB) {
				// console.log('[Smart Sync] Online detected. Starting sync loop.')
				syncWorker() // Run immediately
				syncInterval = setInterval(syncWorker, 5000)
			}
		}

		const stopSync = () => {
			if (syncInterval) {
				// console.log('[Smart Sync] Offline detected. Pausing sync loop.')
				clearInterval(syncInterval)
				syncInterval = null
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				isOnline.value = true
				startSync()
				if (isAuthenticated.value) {
					pullSync()
				}
			})

			window.addEventListener('offline', () => {
				isOnline.value = false
				stopSync()
			})

			// Initial Start
			if (hasIDB) {
				startSync()
			}
		}







		const editorView = ref(null)

		// --- Image Upload Logic ---
		const uploadImage = async (file) => {
			const formData = new FormData();
			formData.append('file', file);

			// Note: Do not set Content-Type header for FormData, let browser set boundary
			const response = await authenticatedFetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (response && response.ok) {
				const data = await response.json();
				return data.url;
			}
			throw new Error('Upload failed');
		}

		const processImageUpload = async (view, file) => {
			if (!view) return;
			// 1. Insert Placeholder
			const id = uuidv7();
			// Use a transparent 1x1 pixel data URI as the placeholder URL to avoid 404s in preview
			const safePlaceholderUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
			const placeholder = `![Uploading ${file.name}...](${safePlaceholderUrl}#${id})`;

			// Use replaceSelection directly in dispatch for freshness
			try {
				view.dispatch(view.state.replaceSelection(placeholder));
			} catch (e) {
				console.error("Initial placeholder dispatch failed", e);
				return;
			}

			try {
				const url = await uploadImage(file);

				// 2. Replace Placeholder with Real Image
				const currentDoc = view.state.doc.toString();
				const idx = currentDoc.indexOf(placeholder);
				if (idx !== -1) {
					view.dispatch({
						changes: {
							from: idx,
							to: idx + placeholder.length,
							insert: `![${file.name}](${url})`
						}
					});
				}
			} catch (e) {
				console.error("Image upload failed", e);
				const currentDoc = view.state.doc.toString();
				const idx = currentDoc.indexOf(placeholder);
				if (idx !== -1) {
					view.dispatch({
						changes: {
							from: idx,
							to: idx + placeholder.length,
							insert: `[Upload Failed: ${file.name}]`
						}
					});
				}
				alert("Image upload failed. Please try again.");
			}
		}

		// --- Direct Paste Logic (No Preview) ---

		const handlePaste = (event, view) => {
			const items = event.clipboardData?.items;
			if (!items) return;

			// Check for Images
			for (const item of items) {
				if (item.type.indexOf('image') !== -1) {
					event.preventDefault(); // Stop default paste
					const file = item.getAsFile();
					if (file) processImageUpload(view, file);
					return;
				}
			}
			// If no image, let default behavior handle text paste
		}

		const pasteContent = async () => {
			const view = editorView.value
			if (!view) return
			view.focus()

			try {
				// 1. Try reading clipboard items (for Images)
				if (navigator.clipboard.read) {
					const items = await navigator.clipboard.read()
					for (const item of items) {
						if (item.types && item.types.some(t => t.startsWith('image/'))) {
							const blob = await item.getType(item.types.find(t => t.startsWith('image/')))
							// Re-use logic: Blob is File-like
							processImageUpload(view, blob)
							return
						}
					}
				}

				// 2. Fallback / Standard Text Paste
				const text = await navigator.clipboard.readText()
				if (text) {
					view.dispatch(view.state.replaceSelection(text))
				}
			} catch (err) {
				console.error('Paste failed:', err)
				alert('Paste failed. Please check clipboard permissions.')
			}
		}

		const handleEditorDrop = (event, view) => {
			const files = event.dataTransfer?.files;
			if (files && files.length > 0) {
				const file = files[0];
				if (file.type.startsWith('image/')) {
					event.preventDefault();
					processImageUpload(view, file);
				}
			}
		}

		const themeCompartment = new Compartment()
		const wordWrapCompartment = new Compartment()

		const initEditor = () => { // Gemini was here
			if (!editorRef.value) return
			if (editorView.value) editorView.value.destroy()

			// console.log(`[InitEditor] Called. ConflictMode=${conflictState.value.isConflict}`)

			// Merge View Mode
			if (conflictState.value.isConflict) {
				const { localNote, serverNote } = conflictState.value
				// console.log("[InitEditor] Initializing MergeView", localNote, serverNote)

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

			const variableCompletion = (context) => {
				let word = context.matchBefore(/\/(\w*)$/)
				if (!word) return null
				if (word.from == word.to && !context.explicit) return null

				return {
					from: word.from,
					options: [
						{
							label: "/date",
							detail: "Current Date",
							apply: (view, completion, from, to) => {
								const now = new Date()
								const offset = now.getTimezoneOffset() * 60000
								const localDate = new Date(now - offset).toISOString().split('T')[0]
								view.dispatch({ changes: { from, to, insert: localDate } })
							}
						},
						{
							label: "/time",
							detail: "Current Time",
							apply: (view, completion, from, to) => {
								const time = new Date().toTimeString().split(' ')[0].substring(0, 5)
								view.dispatch({ changes: { from, to, insert: time } })
							}
						},
						{
							label: "/datetime",
							detail: "Local Datetime",
							apply: (view, completion, from, to) => {
								const now = new Date()
								const offset = now.getTimezoneOffset() * 60000
								const localDt = new Date(now - offset).toISOString().replace('T', ' ').substring(0, 19)
								view.dispatch({ changes: { from, to, insert: localDt } })
							}
						},
						{
							label: "/file",
							detail: "File Name",
							apply: (view, completion, from, to) => {
								const title = selectedNote.value ? selectedNote.value.title : 'Untitled'
								view.dispatch({ changes: { from, to, insert: title } })
							}
						},
						{
							label: "/code",
							detail: "Code Block",
							apply: snippet("```${1:lang}\n${2:code}\n```")
						},
						{
							label: "/table-new",
							detail: "Create New Table",
							apply: (view, completion, from, to) => {
								triggerTableEditor();
							}
						}
					]
				}
			}



			const backlinkCompletion = (context) => {
				let before = context.matchBefore(/\[\[([^\]]*)$/);
				if (!before) return null;

				// IME 조합 중에도 [[ 가 감지되면 자동 완성 표시
				// IME가 끝나면 matchBefore가 올바르게 작동하므로 항상 표시
				const query = before.text.slice(2);
				const hasOpeningBrackets = before.text.startsWith('[[');

				let options = notes.value.map(note => {
					const score = query ? fuzzyScore(note.title || 'Untitled', query) : 1;
					return {
						label: note.title || "Untitled",
						apply: `${note.title || "Untitled"}|id:${note.id}`,
						type: "link",
						detail: `id: ${note.id.slice(0, 8)}...`,
						score: score
					};
				})
					.filter(option => option.score > 0)
					.sort((a, b) => {
						if (query) return b.score - a.score;
						return 0;
					});

				return {
					from: before.from + (hasOpeningBrackets ? 2 : 0),
					options: options,
					validFor: /^[^\]]*$/
				};
			};

			// Backlink Decorator for Editor Highlighting
			const backlinkPlugin = (() => {
				const backlinkRegex = /\[\[([^\]]*)\]\]/g;

				return ViewPlugin.fromClass(class {
					constructor(view) {
						this.decorations = this.matchBacklinks(view);
					}
					matchBacklinks(view) {
						const decorations = [];
						const { doc } = view.state;
						const text = doc.toString();
						let match;

						backlinkRegex.lastIndex = 0;

						// Get notes from global shynoteData
						const allNotes = window.shynoteData?.notes?.value || [];

						while ((match = backlinkRegex.exec(text)) !== null) {
							const fullMatch = match[0];
							const content = match[1];
							const from = match.index;
							const to = match.index + fullMatch.length;

							let isValid = true;
							let noteId = null;

							if (content.includes('|id:')) {
								const parts = content.split('|id:');
								noteId = parts[1].trim();
								const note = allNotes.find(n => n.id === noteId);
								isValid = !!note;
							} else {
								const note = allNotes.find(n => n.title === content);
								isValid = !!note;
								noteId = note?.id || null;
							}

							const className = isValid ? 'cm-backlink' : 'cm-backlink-broken';
							const attrs = isValid
								? { 'data-note-id': noteId, title: 'Click to navigate' }
								: { title: 'Broken link - note not found' };

							decorations.push(Decoration.mark({
								class: className,
								attributes: attrs
							}).range(from, to));
						}
						return Decoration.set(decorations.sort((a, b) => a.from - b.from));
					}
					update(update) {
						if (update.docChanged || update.viewportChanged) {
							this.decorations = this.matchBacklinks(update.view);
						}
					}
				}, {
					decorations: v => v.decorations
				});
			})();




			const startState = EditorState.create({
				doc: selectedNote.value ? (selectedNote.value.content || '') : '',
				extensions: [
					history(),
					rectangularSelection(),
					crosshairCursor(),
					drawSelection(),
					search({ top: true }), // Move to Top
					dropCursor(),
					EditorState.allowMultipleSelections.of(true),
					markdown({ base: markdownLanguage, codeLanguages: languages }), // Markdown logic
					// syntaxHighlighting(defaultHighlightStyle, { fallback: true }), // Removed to favor Theme's highlighting
					bracketMatching(),
					closeBrackets(),
					autocompletion({ override: [variableCompletion, backlinkCompletion] }),
					backlinkPlugin,
					highlightActiveLineGutter(),
					highlightSpecialChars(),
					placeholder('Start typing...'),
					// Base Theme Compartment (Nord for Dark / GitHub Light)
					themeCompartment.of(isDarkMode.value ? getDarkTheme() : githubLight),
					// Custom Theme Compartment (Colors, Fonts, Overrides)
					customThemeCompartment.of(getCustomTheme(isDarkMode.value)),
					// Word Wrap Compartment
					wordWrapCompartment.of(EditorView.lineWrapping),

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
						scroll: handleScroll,
						paste: (event, view) => handlePaste(event, view),
						drop: (event, view) => handleEditorDrop(event, view),
						focus: () => { isEditModeActive.value = true },
						blur: () => { isEditModeActive.value = false },
						dblclick: (event, view) => handleEditorDoubleClick(view, event),
						// Tap handler for mobile - treat as double-click after delay
						tap: (event, view) => {
							// Let single tap pass through for text selection
							// Table editing via tap is handled by long-press logic
							return false
						}
					}),
					// Keymaps
					keymap.of([
						{ key: "Mod-s", run: () => { manualSave(); return true } },
						{ key: "Mod-b", run: () => { formatText('bold'); return true } },
						{ key: "Mod-i", run: () => { formatText('italic'); return true } },
						{ key: "Mod-k", run: () => { formatText('link'); return true } },
						{ key: "Mod-f", run: () => { openSearchPanel(editorView.value); return true } }
					]),
					keymap.of(vscodeKeymap.filter(k => !k.key?.startsWith("Mod-k"))), // VS Code Keymap Priority
					keymap.of(closeBracketsKeymap),
					keymap.of(historyKeymap),
					keymap.of(searchKeymap),
					keymap.of(defaultKeymap)
				]
			})

			editorView.value = new EditorView({
				state: startState,
				parent: editorRef.value
			})
			window.tableEditorView = editorView.value
		}

		// --- Theme Logic ---
		const customThemeCompartment = new Compartment()



		const getCustomTheme = (isDark) => {
			return EditorView.theme({
				"&": { fontSize: "inherit" },
				".cm-scroller": { fontFamily: "'Pretendard', monospace" },
				".cm-content": {
					fontFamily: "'Pretendard', monospace",
					padding: "5px 10px !important"
				},
				// Autocomplete Tooltip Font
				".cm-tooltip, .cm-tooltip-autocomplete": {
					fontFamily: "'Pretendard', 'Inter', sans-serif !important"
				},
				".cm-completionLabel": {
					fontFamily: "'Pretendard', 'Inter', sans-serif !important",
					fontSize: "13px"
				},
				".cm-completionDetail": {
					fontFamily: "'Pretendard', 'Inter', sans-serif !important",
					fontStyle: "normal",
					opacity: "0.6"
				},
				// Cursor Color (Dracula for Dark, GitHub Like for Light)
				".cm-cursor, .cm-dropCursor": { borderLeftColor: isDark ? "#8be9fd" : "#0969da" },
				"&.cm-focused .cm-cursor": { borderLeftColor: isDark ? "#8be9fd" : "#0969da" },
				"&.cm-focused .cm-selectionBackground, ::selection": {
					backgroundColor: isDark ? "rgba(68, 71, 90, 0.6) !important" : "#b6e3ff !important" // Dracula selection for Dark
				},

				// Search Match Colors (Dracula)
				".cm-searchMatch": {
					backgroundColor: isDark ? "rgba(241, 250, 140, 0.45) !important" : "#fff8c5 !important",
					color: "inherit !important"
				},
				".cm-searchMatch-selected": {
					backgroundColor: isDark ? "rgba(241, 250, 140, 1) !important" : "#f2cc60 !important",
					color: "#282a36 !important",
					outline: isDark ? "1px solid #ffb86c" : "1px solid #7D4E00",
					fontWeight: "bold"
				},
				".cm-selectionMatch": {
					backgroundColor: isDark ? "rgba(139, 233, 253, 0.25) !important" : "rgba(182, 227, 255, 0.5) !important"
				},

				// Search Panel Styles
				".cm-panels": {
					zIndex: "99999 !important",
					position: "sticky !important",
					top: "0 !important",
					bottom: "auto !important"
				},
				".cm-panel.cm-search": {
					// Nord / GitHub Bg Colors
					background: isDark ? "#282a36 !important" : "#ffffff !important",
					color: isDark ? "#f8f8f2 !important" : "#24292f !important",
					borderBottom: isDark ? "1px solid #44475a" : "1px solid #e1e4e8",
					borderTop: "none",
					padding: "8px 12px",
					// Robust 2-Row Grid
					display: "grid !important",
					// Force items to pack to the left
					gridTemplateColumns: "max-content max-content max-content max-content max-content max-content max-content max-content",
					gridTemplateRows: "auto auto", // Row 1, Row 2
					columnGap: "6px",
					rowGap: "8px",
					alignItems: "center",
					justifyContent: "start"
				},

				// Generic Button/Label Reset for Search
				".cm-search button, .cm-search label": {
					margin: "0 !important",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				},

				// --- ROW 1: SEARCH ---
				".cm-search input[name='search']": {
					gridColumn: "1",
					gridRow: "1",
					background: isDark ? "#2f3242 !important" : "#f6f8fa !important",
					color: isDark ? "#f8f8f2 !important" : "#24292f !important",
					border: isDark ? "1px solid #44475a" : "1px solid #d1d5da",
					borderRadius: "6px",
					padding: "4px 8px",
					width: "240px",
					minWidth: "240px"
				},
				// Auto-flow items in Row 1 (Labels + Nav)
				".cm-search label": { gridRow: "1", gridColumn: "auto" },
				".cm-search button[name='next']": { gridRow: "1", gridColumn: "auto" },
				".cm-search button[name='prev']": { gridRow: "1", gridColumn: "auto" },
				".cm-search button[name='close']": { gridRow: "1", gridColumn: "auto" },

				// --- ROW 2: REPLACE ---
				".cm-search input[name='replace']": {
					gridColumn: "1",
					gridRow: "2",
					background: isDark ? "#2f3242 !important" : "#f6f8fa !important",
					color: isDark ? "#f8f8f2 !important" : "#24292f !important",
					border: isDark ? "1px solid #44475a" : "1px solid #d1d5da",
					borderRadius: "6px",
					padding: "4px 8px",
					width: "240px",
					minWidth: "240px"
				},
				// Auto-flow items in Row 2
				".cm-search button[name='replace']": { gridRow: "2", gridColumn: "auto" },
				".cm-search button[name='replaceAll']": { gridRow: "2", gridColumn: "auto" },

				// Hide problematic buttons
				".cm-search button[name='select']": { display: "none !important" },

				// Button Base
				".cm-search button": {
					color: isDark ? "#8b949e !important" : "#57606a !important",
					cursor: "pointer",
					padding: "4px 4px",
					textTransform: "uppercase",
					whiteSpace: "nowrap",
					border: "1px solid transparent", // Hover border
					borderRadius: "6px",
					background: "transparent",
					// Iconize Logic
					fontSize: "0 !important",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "24px",
					height: "24px"
				},
				".cm-search button::after": {
					fontFamily: "'Material Symbols Rounded'",
					fontSize: "18px",
					fontWeight: "normal",
					lineHeight: "1"
				},

				// Button Icons
				".cm-search button[name='next']::after": { content: "'arrow_downward'" },
				".cm-search button[name='prev']::after": { content: "'arrow_upward'" },
				".cm-search button[name='close']::after": { content: "'close'" },
				".cm-search button[name='replace']::after": { content: "'find_replace'" },
				".cm-search button[name='replaceAll']::after": { content: "'done_all'" },

				".cm-search button:hover": {
					background: isDark ? "rgba(177,186,196,0.12)" : "rgba(209,213,218,0.5)",
					opacity: "1"
				},

				// Toggle Badges (Aa, .*, \b)
				".cm-search label": {
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: "0 !important", // Force hide text
					lineHeight: "1",
					color: "transparent !important", // Ensure text is invisible
					textTransform: "none",
					cursor: "pointer",
					width: "24px",
					height: "24px",
					borderRadius: "4px",
					border: "1px solid transparent",
					marginRight: "2px"
				},
				".cm-search label input": { display: "none" },

				// Badge Content (restoring distinct text)
				".cm-search label::after": {
					fontSize: "13px !important",
					fontWeight: "bold",
					color: isDark ? "#8b949e" : "#57606a",
					visibility: "visible"
				},

				".cm-search label:has(input[name='case'])::after": { content: "'Aa'" },
				".cm-search label:has(input[name='whole'])::after": { content: "'\\\\b'" },
				".cm-search label:has(input[name='re'])::after": { content: "'.*'" },

				// Active State
				".cm-search label:has(input:checked)": {
					background: isDark ? "rgba(56,139,253,0.15)" : "#ddf4ff",
					border: isDark ? "1px solid rgba(56,139,253,0.4)" : "1px solid #0969da"
				},
				".cm-search label:has(input:checked)::after": {
					color: isDark ? "#58a6ff" : "#0969da"
				},

				".cm-search label:hover": {
					background: isDark ? "rgba(177,186,196,0.12)" : "rgba(209,213,218,0.5)"
				}
			})
		}

		// Watch for Dark Mode changes to update theme
		watch(isDarkMode, (newVal) => {
			if (editorView.value) {
				editorView.value.dispatch({
					effects: [
						themeCompartment.reconfigure(newVal ? getDarkTheme() : githubLight),
						customThemeCompartment.reconfigure(getCustomTheme(newVal))
					]
				})
			}
		})

		// Conflict Logic
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
				// Rebase or Restore
				if (serverNote.is_deleted) {
					// RESTORE: Server deleted, but we want to keep it.
					// We just mark it dirty so it pushes again (Resurrection).
					// Version? We can keep local version or increment.
					// saveNote will mark it dirty.
					await LocalDB.saveNote(localNote);
				} else {
					// UPDATE CONFLICT:
					// Rebase: We are keeping local content, BUT we must adopt the server's version number
					// so that our next Push attempts to increment FROM that version (e.g. v8 -> v9), not v1 -> v2.
					localNote.version = serverNote.version;

					// Force a save to update LocalDB and trigger a dirty push
					if (hasIDB) {
						// We use saveNote to trigger the log and dirty status
						await LocalDB.saveNote(localNote);
					}
				}

				// updateNote() is called by saveNote debounce, but we can call manualSave or just let triggers handle it.
			} else if (action === 'use_server') {
				if (serverNote.is_deleted) {
					// ACCEPT DELETION:
					if (hasIDB) {
						await LocalDB.deleteNote(localNote.id);
					}
					// Remove from memory
					if (selectedNote.value && selectedNote.value.id === localNote.id) {
						selectedNote.value = null; // Close editor or go to inbox
						rightPanelMode.value = 'list';
					}
					const idx = notes.value.findIndex(n => n.id === localNote.id);
					if (idx !== -1) notes.value.splice(idx, 1);
				} else {
					// Overwrite local with server content AND version
					localNote.title = serverNote.title
					localNote.content = serverNote.content
					localNote.folder_id = serverNote.folder_id
					localNote.content_hash = serverNote.content_hash
					localNote.version = serverNote.version
					localNote.updated_at = serverNote.updated_at

					// Save as synced (Clean)
					if (hasIDB) {
						// Mark as synced immediately
						const cleanNote = { ...localNote, sync_status: 'synced', local_updated_at: new Date().toISOString() };

						// Actually LocalDB.saveNotesBulk handles saving as-is.
						await LocalDB.saveNotesBulk([cleanNote]);

						// Also remove any pending logs for this note, as we accepted server state
						const logs = await LocalDB.getPendingLogs();
						const noteLogs = logs.filter(l => l.entity_id === localNote.id).map(l => l.id);
						if (noteLogs.length > 0) await LocalDB.removeLogsBulk(noteLogs);
					}
					// Update Memory
					if (selectedNote.value && selectedNote.value.id === localNote.id) {
						// Deep copy to reactive ref
						Object.assign(selectedNote.value, localNote);
					}
					// Update List in Memory
					const idx = notes.value.findIndex(n => n.id === localNote.id);
					if (idx !== -1) notes.value[idx] = { ...localNote };
				}
			}

			conflictState.value.isConflict = false
			// Clear from Map
			if (localNote && conflictMap.value[localNote.id]) {
				delete conflictMap.value[localNote.id]
			}
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
					} else if (type === 'quote') {
						if (lineText.match(/^> /)) {
							lineText = lineText.replace(/^> /, '')
						} else {
							lineText = '> ' + lineText
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

		const toggleCode = () => {
			const view = editorView.value
			if (!view) return
			view.focus()

			// Check if selection spans multiple lines
			const range = view.state.selection.main
			const doc = view.state.doc
			const startLine = doc.lineAt(range.from).number
			const endLine = doc.lineAt(range.to).number

			if (startLine !== endLine) {
				formatText('codeblock')
			} else {
				formatText('code')
			}
		}


		// console.log('Setup functions defined')

		const focusEditor = () => {
			if (editorView.value) {
				editorView.value.focus()
			}
		}

		// --- Custom Search Removed - Using CodeMirror Native Search ---
		// Use Cmd+F to open search panel

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
			if (!source) return

			if (previewRef.value && viewMode.value !== 'edit') {
				if (source === scrollDOM || (source.classList && source.classList.contains('cm-scroller'))) {
					// CM -> Preview
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
					previewRef.value.scrollTop = percentage * (previewRef.value.scrollHeight - previewRef.value.clientHeight)
				} else if (source === previewRef.value && scrollDOM) {
					// Preview -> CM
					const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight)
				}
			}
		}

		// App Version & Config

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
		const apiKeyValue = ref(null)
		const apiKeyError = ref('')
		const apiKeyLoading = ref(false)

		const openSettingsModal = () => {
			isSettingsModalOpen.value = true;
			loadApiKey()
		}

		const closeSettingsModal = () => {
			isSettingsModalOpen.value = false;
		}

		const loadApiKey = async () => {
			if (!currentUserId.value || currentUserId.value === 'guest') {
				apiKeyValue.value = null
				return
			}
			apiKeyLoading.value = true
			apiKeyError.value = ''
			try {
				const response = await authenticatedFetch('/api/api-key')
				if (response && response.ok) {
					const data = await response.json()
					apiKeyValue.value = data.api_key || null
				} else {
					apiKeyError.value = 'API Key를 불러오지 못했습니다.'
				}
			} catch (e) {
				console.error('API Key load failed', e)
				apiKeyError.value = 'API Key 요청 중 오류가 발생했습니다.'
			} finally {
				apiKeyLoading.value = false
			}
		}

		const generateApiKey = async () => {
			if (!currentUserId.value || currentUserId.value === 'guest') return
			openModal('api-key-generate')
		}

		const generateApiKeyImpl = async () => {
			apiKeyLoading.value = true
			apiKeyError.value = ''
			try {
				const response = await authenticatedFetch('/api/api-key', { method: 'POST' })
				if (response && response.ok) {
					const data = await response.json()
					apiKeyValue.value = data.api_key || null
				} else {
					apiKeyError.value = 'API Key 생성에 실패했습니다.'
				}
			} catch (e) {
				console.error('API Key create failed', e)
				apiKeyError.value = 'API Key 생성 중 오류가 발생했습니다.'
			} finally {
				apiKeyLoading.value = false
			}
		}

		const deleteApiKey = async () => {
			if (!currentUserId.value || currentUserId.value === 'guest' || !apiKeyValue.value) return
			if (!confirm('API Key를 삭제할까요? 외부 공유 API는 동작하지 않습니다.')) return
			apiKeyLoading.value = true
			apiKeyError.value = ''
			try {
				const response = await authenticatedFetch('/api/api-key', { method: 'DELETE' })
				if (response && response.ok) {
					apiKeyValue.value = null
				} else {
					apiKeyError.value = 'API Key 삭제에 실패했습니다.'
				}
			} catch (e) {
				console.error('API Key delete failed', e)
				apiKeyError.value = 'API Key 삭제 중 오류가 발생했습니다.'
			} finally {
				apiKeyLoading.value = false
			}
		}

		const copyApiKey = async () => {
			if (!apiKeyValue.value) return
			try {
				await navigator.clipboard.writeText(apiKeyValue.value)
				signpost.value = { show: true, text: 'API Key 복사 완료', opacity: 0.9 }
				setTimeout(() => (signpost.value.show = false), 1200)
			} catch (e) {
				console.error('API Key copy failed', e)
				apiKeyError.value = '클립보드 복사에 실패했습니다.'
			}
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

					// Validate backup format
					if (!backupData.folders || !backupData.notes) {
						throw new Error('Invalid backup file format. Missing folders or notes.');
					}

					// Validate backup version
					if (backupData.backup_version && backupData.backup_version > 1) {
						alert(`This backup was created with a newer version of the app (v${backupData.backup_version}). Some features may not be restored correctly.`);
					}

					// Clear local data before restore to avoid sync conflicts
					if (hasIDB) {
						await LocalDB.clearAll();
					}
					// Clear pending logs
					if (typeof clearPendingLogs === 'function') {
						await clearPendingLogs();
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

						// Reload page to get clean state
						window.location.reload();
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


		// Table Editor State


		const openModal = (type, targetId = null, data = null) => {
			modalState.value.type = type
			modalState.value.targetId = targetId
			modalState.value.data = data // Pass custom data
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
			} else if (type === 'file-info') {
				modalState.value.title = 'File Info'
				modalState.value.confirmText = null // No action button needed
				modalState.value.cancelText = 'Close'
			} else if (type === 'api-key-generate') {
				modalState.value.title = 'API Key 생성'
				modalState.value.message = '새 API Key를 생성할까요?\n기존 키는 즉시 폐기됩니다.'
				modalState.value.confirmText = '생성'
				modalState.value.cancelText = '취소'
			}


			if (['create-folder', 'factory-reset'].includes(type)) {
				nextTick(() => {
					const input = document.getElementById('modal-input')
					if (input) input.focus()
				})
			} else {
				nextTick(() => {
					const btn = document.getElementById('modal-confirm-btn')
					if (btn) btn.focus()
				})
			}
		}

		// ... (skipping unchanged parts)

		const showFileInfo = () => {
			if (!selectedNote.value) return
			const n = selectedNote.value
			const content = n.content || ''

			// Find Folder Name
			const folder = folders.value.find(f => f.id === n.folder_id)
			const folderName = folder ? folder.name : (n.folder_id === TRASH_FOLDER_ID.value ? 'Trash' : 'Root')

			const stats = {
				title: n.title || 'Untitled',
				folder: folderName,
				created: formatDate(n.created_at),
				updated: formatDate(n.updated_at),
				version: `v${n.version || 1}`,
				size: `${content.length} chars`,
				lines: `${content.split('\n').length} lines`,
				words: `${content.trim().split(/\s+/).length} words`
			}
			openModal('file-info', null, stats)
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
						// console.log('Service Worker caches cleared:', cacheNames);
					}

					// Unregister service worker (optional - will re-register on reload)
					if ('serviceWorker' in navigator) {
						const registrations = await navigator.serviceWorker.getRegistrations();
						await Promise.all(registrations.map(reg => reg.unregister()));
						// console.log('Service Workers unregistered');
					}

					window.location.reload();
				} catch (e) { console.error(e); alert(e.message); }
			} else if (type === 'logout') {
				try {
					// Clear localStorage (including auth tokens for full logout)
					for (let i = localStorage.length - 1; i >= 0; i--) {
						const key = localStorage.key(i);
						if (key && (key.startsWith('shynote_') || key === 'access_token' || key === 'shynote_user_id')) {
							localStorage.removeItem(key);
						}
					}

					// Clear IndexedDB
					if (typeof LocalDB !== 'undefined') await LocalDB.clearAll();

					// Clear Service Worker caches
					if ('caches' in window) {
						const cacheNames = await caches.keys();
						await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
					}

					// Unregister service worker
					if ('serviceWorker' in navigator) {
						const registrations = await navigator.serviceWorker.getRegistrations();
						await Promise.all(registrations.map(reg => reg.unregister()));
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
			} else if (type === 'api-key-generate') {
				await generateApiKeyImpl()
			}
			closeModal()
		}

		// Table Editor Methods
		const openTableEditor = (tableData, alignments, from, to) => {
			tableEditorState.value = {
				isOpen: true,
				tableData: tableData,
				alignments: alignments,
				tableFrom: from,
				tableTo: to,
				rowCount: tableData.length,
				colCount: tableData[0] ? tableData[0].length : 0,
				activeRow: 0,
				activeCol: 0
			}
		}

		const closeTableEditor = () => {
			tableEditorState.value.isOpen = false
		}

		const saveTableEditor = (editedData) => {
			if (typeof window.tableEditorView !== 'undefined' && window.tableEditorView) {
				// Pass alignments to TableUtils.format to ensure markers are generated
				const markdown = TableUtils.format(TableUtils.generate(editedData, tableEditorState.value.alignments), tableEditorState.value.alignments)
				window.tableEditorView.dispatch({
					changes: {
						from: tableEditorState.value.tableFrom,
						to: tableEditorState.value.tableTo,
						insert: markdown
					}
				})
			}
			closeTableEditor()
		}

		const deleteTableRow = (rowIndex) => {
			if (tableEditorState.value.tableData.length <= 2) {
				alert('Cannot delete: table must have at least one data row')
				return
			}
			tableEditorState.value.tableData.splice(rowIndex, 1)
			tableEditorState.value.rowCount--
			tableEditorState.value.activeRow = Math.min(tableEditorState.value.activeRow, tableEditorState.value.tableData.length - 1)
		}

		const deleteTableCol = (colIndex) => {
			if (tableEditorState.value.colCount <= 1) {
				alert('Cannot delete: table must have at least one column')
				return
			}
			tableEditorState.value.tableData.forEach(row => row.splice(colIndex, 1))
			tableEditorState.value.alignments.splice(colIndex, 1)
			tableEditorState.value.colCount--
			tableEditorState.value.activeCol = Math.min(tableEditorState.value.activeCol, tableEditorState.value.colCount - 1)
		}

		const setColumnAlignment = (colIndex, align) => {
			if (tableEditorState.value.alignments) {
				tableEditorState.value.alignments[colIndex] = align
			}
		}

		const deleteActiveRow = () => {
			deleteTableRow(tableEditorState.value.activeRow)
		}

		const addTableRow = () => {
			tableEditorState.value.tableData.push(new Array(tableEditorState.value.colCount).fill(''))
			tableEditorState.value.rowCount++
		}

		const addTableCol = () => {
			tableEditorState.value.colCount++
			tableEditorState.value.tableData.forEach(row => row.push(''))
			tableEditorState.value.alignments.push('l')
		}

		const deleteActiveCol = () => {
			deleteTableCol(tableEditorState.value.activeCol)
		}

		const triggerTableEditor = () => {
			const view = editorView.value;
			if (!view) return;

			const pos = view.state.selection.main.head;
			const bounds = TableUtils.findBounds(view.state.doc, pos);
			if (bounds && bounds.text) {
				const parsed = TableUtils.parse(bounds.text);
				if (parsed) {
					openTableEditor(parsed.rows, parsed.alignments, bounds.from, bounds.to);
					return;
				}
			}

			// Fallback to New Table
			const emptyTable = [
				['Header 1', 'Header 2'],
				['Value 1', 'Value 2']
			];
			openTableEditor(emptyTable, ['c', 'c'], pos, pos);
		};

		const handleEditorDoubleClick = (view, event) => {
			const position = view.posAtDOM(event.target)
			if (position === null) return

			const { from, to, text } = TableUtils.findBounds(view.state.doc, position)
			if (text) {
				const parsedTable = TableUtils.parse(text)
				if (parsedTable) {
					openTableEditor(parsedTable.rows, parsedTable.alignments, from, to)
					return true
				}
			}
			return false
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
				restoreState()
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
					await pullSync()
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
					// console.log('User ID changed, refetching data...')
					loadUserSettings() // Ensure settings are loaded for new ID
					await pullSync()
					restoreState()
				} else if (!didOptimisticLoad) {
					// If we didn't do optimistic load (no cached ID), fetch now
					await pullSync()
					restoreState()
				}

				// autoSelectNote(); // Disabled: Default to Inbox list view
			} else {
				// Auto-create guest session when no token is present
				localStorage.setItem(STORAGE_KEYS.TOKEN, 'guest');
				isAuthenticated.value = true;
				currentUserId.value = 'guest';
				await fetchUserProfile();
				await fetchFolders();
				await fetchNotes();
				restoreState()
			}
		}

		const restoreState = () => {
			try {
				console.log('[RestoreState] Started')
				const savedFolderId = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_FOLDER_ID))
				const savedNoteId = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_NOTE_ID))
				const savedPanelMode = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.LAST_PANEL_MODE))
				const savedTabIdsRaw = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.RECENT_TAB_IDS))
				const savedActiveTabIdRaw = localStorage.getItem(getUserStorageKey(STORAGE_KEYS.ACTIVE_TAB_ID))

				console.log('[RestoreState] Restoring...', { savedFolderId, savedNoteId, savedPanelMode, savedTabIdsRaw, savedActiveTabIdRaw })

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

				let savedTabIds = []
				try {
					savedTabIds = normalizeRecentTabIds(JSON.parse(savedTabIdsRaw || '[]'), MAX_RECENT_TABS)
				} catch (e) {
					savedTabIds = []
				}
				const existingIds = new Set(notes.value.map(n => String(n.id)))
				openTabIds.value = savedTabIds.filter(id => existingIds.has(String(id)))

				if (openTabIds.value.length === 0 && savedPanelMode === 'edit' && savedNoteId) {
					const nid = String(savedNoteId)
					if (existingIds.has(nid)) {
						openTabIds.value = [nid]
					}
				}

				const savedActive = savedActiveTabIdRaw ? String(savedActiveTabIdRaw) : null
				if (savedActive && openTabIds.value.includes(savedActive)) {
					activeTabId.value = savedActive
				} else if (savedNoteId && openTabIds.value.includes(String(savedNoteId))) {
					activeTabId.value = String(savedNoteId)
				} else {
					activeTabId.value = openTabIds.value[0] || null
				}

				if (savedPanelMode === 'edit' && activeTabId.value) {
					const note = notes.value.find(n => String(n.id) === String(activeTabId.value))
					if (note) {
						selectedNote.value = note
						if (note.folder_id !== undefined) {
							currentFolderId.value = note.folder_id
						}
					}
				} else if (savedPanelMode === 'edit' && !activeTabId.value) {
					selectedNote.value = null
				}

				pruneTabsWithNotes()
				persistTabs()
				// console.log('[RestoreState] Completed.')
			} catch (e) {
				console.error('[RestoreState] Failed', e)
			}
		}

		// Define Touch Handlers outside onMounted
		let touchStartX = 0
		let touchStartY = 0
		let touchEndX = 0
		let touchEndY = 0

		const handleTouchStart = (e) => {
			if (isEditModeActive.value) return
			if (e.touches.length > 1) return
			touchStartX = e.changedTouches[0].screenX
			touchStartY = e.changedTouches[0].screenY
		}

		const handleTouchEnd = (e) => {
			if (isEditModeActive.value) return
			touchEndX = e.changedTouches[0].screenX
			touchEndY = e.changedTouches[0].screenY
			handleSwipe()
		}

		const handleSwipe = () => {
			const deltaX = touchEndX - touchStartX
			const deltaY = touchEndY - touchStartY
			const minSwipeDistance = 50

			if (Math.abs(deltaY) > Math.abs(deltaX)) return

			if (deltaX > minSwipeDistance) {
				if (rightPanelMode.value === 'edit' && selectedNote.value) {
					backToList()
					if (navigator.vibrate && isMobile.value) {
						navigator.vibrate(50)
					}
				} else if (rightPanelMode.value === 'list' && !isSidebarOpen.value) {
					toggleSidebar()
				}
			} else if (deltaX < -minSwipeDistance) {
				if (isSidebarOpen.value) {
					toggleSidebar()
				}
			}
		}

		onMounted(async () => {
			// PC View Mode Shortcuts (Cmd+1, 2, 3)
			window.addEventListener('keydown', (e) => {
				// Ignore if modal is open (except global shortcuts if needed)
				if (modalState.value.isOpen || showCommandPalette.value) return

				if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
					switch (e.key) {
						case '1':
							e.preventDefault()
							setViewMode('edit')
							break
						case '2':
							e.preventDefault()
							setViewMode('preview')
							break
						case '3':
							e.preventDefault()
							setViewMode('split')
							break
						case 'p': // Cmd+P for Command Palette
							e.preventDefault()
							openCommandPalette()
							break
					}
				}
			})

			isSidebarOpen.value = true // Force sidebar open on startup

			// OAuth callback check
			if (window.location.search.includes('code=')) {
				handleOAuthCallback();
				return;
			}

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
				if (modalState.value.isOpen) {
					if (e.key === 'Escape') {
						closeModal()
					} else if (e.key === 'Enter') {
						const hasInput = ['create-folder', 'factory-reset'].includes(modalState.value.type)
						// Check if Cancel button is focused
						const activeId = document.activeElement ? document.activeElement.id : ''
						const isCancelFocused = activeId === 'modal-cancel-btn'

						if (!hasInput && !isCancelFocused) {
							// For confirm dialogs (no input), ALWAYS trigger confirm on Enter,
							// UNLESS user is specifically on Cancel.
							// Prevents requiring exact focus on Confirm button.
							e.preventDefault()
							confirmAction()
						}
					}
				}
			})

			// Add Listeners using the functions defined above
			document.addEventListener('touchstart', handleTouchStart, { passive: true })
			document.addEventListener('touchend', handleTouchEnd, { passive: true })


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


		// ===== OAuth 2.0 Redirect Flow =====

		const useRedirectFlow = ref(false);

		// CSRF
		const generateRandomState = () => {
			const array = new Uint8Array(32);
			crypto.getRandomValues(array);
			return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
		};

		// Google OAuth Redirect Flow
		const loginWithGoogleRedirect = async () => {
			try {
				const res = await fetch('/auth/config');
				if (!res.ok) throw new Error('Failed to fetch config');
				const config = await res.json();

				const clientId = config.google_client_id;
				const redirectUri = encodeURIComponent(window.location.origin + '/auth/google/callback');
				const scope = encodeURIComponent('openid email profile');
				const state = generateRandomState();

				sessionStorage.setItem('oauth_state', state);
				sessionStorage.setItem('oauth_redirect_time', Date.now().toString());

				const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
					`client_id=${clientId}&` +
					`redirect_uri=${redirectUri}&` +
					`response_type=code&` +
					`scope=${scope}&` +
					`state=${state}&` +
					`access_type=offline&` +
					`prompt=select_account`;

				window.location.href = authUrl;
			} catch (error) {
				console.error('Failed to start OAuth flow:', error);
				alert('Login failed to start.');
			}
		};

		// OAuth Callback Handler
		const handleOAuthCallback = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const code = urlParams.get('code');
			const state = urlParams.get('state');
			const error = urlParams.get('error');

			if (error) {
				console.error('OAuth error:', error);
				alert('Login Error: ' + error);
				window.location.href = '/';
				return;
			}

			const savedState = sessionStorage.getItem('oauth_state');
			if (!code || !state || state !== savedState) {
				console.error('Invalid OAuth callback');
				window.location.href = '/';
				return;
			}

			sessionStorage.removeItem('oauth_state');
			sessionStorage.removeItem('oauth_redirect_time');

			try {
				loading.value = true;
				loadingState.value = { message: 'Authenticating...' };

				const response = await fetch('/auth/google/callback', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ code })
				});

				if (!response.ok) {
					throw new Error('Authentication failed');
				}

				const data = await response.json();

				localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
				currentUserId.value = data.user.id;
				isAuthenticated.value = true;

				await Promise.all([fetchUserProfile(), fetchFolders(), fetchNotes()]);

				window.history.replaceState({}, document.title, '/');
				loadingState.value = { message: 'Login successful' };

			} catch (error) {
				console.error('OAuth callback error:', error);
				alert('Login Error: ' + error.message);
				localStorage.removeItem(STORAGE_KEYS.TOKEN);
				window.location.href = '/';
			} finally {
				loading.value = false;
			}
		};

		const initGoogleAuth = async () => {
			try {
				const res = await fetch('/auth/config')
				if (!res.ok) return
				const config = await res.json()
				// config.db_type is server side.
				if (config.db_type) { serverDbType.value = config.db_type }

				// Unified Auth Flow: Always use Redirect Flow
				// This guarantees functionality across Mobile, Private Mode, and IP-based access
				console.log('Using Global Redirect Flow');
				useRedirectFlow.value = true;

				/* Legacy One Tap Logic Removed for Consistency
				if (window.google) {
					window.google.accounts.id.initialize({
						client_id: config.google_client_id,
						callback: window.handleCredentialResponse,
						auto_select: false,
						cancel_on_tap_outside: false
					});
					if (!isAuthenticated.value) renderGoogleButton()
				}
				*/
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
					? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/dracula.min.css'
					: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
			}

			// Tailwind Dark Mode Support
			if (isDarkMode.value) {
				document.documentElement.classList.add('dark')
			} else {
				document.documentElement.classList.remove('dark')
			}

			// Update CodeMirror Theme
			if (editorView.value) {
				editorView.value.dispatch({
					effects: [
						themeCompartment.reconfigure(isDarkMode.value ? getDarkTheme() : githubLight),
						customThemeCompartment.reconfigure(getCustomTheme(isDarkMode.value))
					]
				})
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

		const handlePreviewDoubleClick = (event) => {
			// Only switch to editor mode if currently in preview mode
			if (viewMode.value === 'preview') {
				setViewMode('edit')
				// Focus the editor after switching
				nextTick(() => {
					const editorViewInstance = editorView.value
					if (editorViewInstance) {
						editorViewInstance.focus()
					}
				})
			}
		}


		// Show signpost with custom text, opacity, and fade animation
		const showSignpost = (text, duration = 1500, opacity = 0.5) => {
			// Replace newlines with <br> tags for multi-line support
			const formattedText = text.replace(/\n/g, '<br>')
			signpost.value = { show: true, text: formattedText, opacity: opacity }
			// Hide after specified duration
			setTimeout(() => {
				signpost.value = { show: false, text: '', opacity: 0.5 }
			}, duration)
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
			// console.log('[fetchFolders] Started')
			// if (!isAuthenticated.value) return // Removed to allow LocalDB load for Guest

			const uid = currentUserId.value || 'guest';

			try {
				// 1. Load from LocalDB first (if available)
				if (hasIDB) {
					const localFolders = await LocalDB.getAllFolders(uid)
					if (localFolders && localFolders.length > 0) {
						folders.value = localFolders
					}

					// Ensure Trash Folder Exists (Idempotent)
					const trashExists = localFolders && localFolders.some(f => f.id === TRASH_FOLDER_ID.value || f.name === "Trash")
					if (!trashExists) {
						// console.log("Initializing Trash Folder...")
						const trashFolder = {
							id: TRASH_FOLDER_ID.value,
							name: 'Trash',
							user_id: uid
						}
						// Save Local & Sync will pick it up to create on server
						await LocalDB.saveFolder(trashFolder, 'CREATE')
						// Optimistically add to list (though filtered out by UI usually)
						folders.value.push(trashFolder)
					}

					// --- MIGRATION: Fix Legacy Trash (trash-0000...) ---
					const LEGACY_TRASH_ID = 'trash-0000-0000-0000-000000000000';
					const newTrashId = TRASH_FOLDER_ID.value;

					const legacyTrashIndex = folders.value.findIndex(f => f.id === LEGACY_TRASH_ID);
					if (legacyTrashIndex !== -1 && newTrashId !== LEGACY_TRASH_ID) {
						console.log('[Migration] Found Legacy Trash Folder. Migrating...');

						// 1. Move notes from Old Trash -> New Trash
						const legacyNotes = notes.value.filter(n => n.folder_id === LEGACY_TRASH_ID);
						if (legacyNotes.length > 0) {
							console.log(`[Migration] Moving ${legacyNotes.length} notes to new Trash.`);
							legacyNotes.forEach(note => {
								note.folder_id = newTrashId;
								note.updated_at = new Date().toISOString();
								if (hasIDB) LocalDB.saveNote(note);
								saveToLog('note', note.id, { folder_id: newTrashId }); // Sync change
							});
						}

						// 2. Remove Legacy Folder from UI and IDB
						folders.value.splice(legacyTrashIndex, 1);
						if (hasIDB) LocalDB.deleteFolder(LEGACY_TRASH_ID);
						console.log('[Migration] Legacy Trash removed locally.');
					}
					// ---------------------------------------------------
				}

				// 2. Fetch from Server (Background if we have local data)
				// If waitForRemote is false, we don't await the fetch, just fire it.
				const remoteFetch = async () => {
					try {
						if (!isAuthenticated.value || currentUserId.value === 'guest') return // Guest Mode: Skip Remote

						const response = await authenticatedFetch('/api/folders')
						if (response && response.ok) {
							const serverFolders = await response.json()

							if (hasIDB) {
								const currentUid = currentUserId.value || uid;

								// A. Identify Deletions (Server Side Deletion)
								const localFoldersAll = await LocalDB.getAllFolders(currentUid)
								const serverIds = new Set(serverFolders.map(f => f.id))

								for (const lf of localFoldersAll) {
									if (!serverIds.has(lf.id) && lf.sync_status !== 'dirty') {
										await LocalDB.deleteFolder(lf.id)
									}
								}

								// B. Save Server Folders (Bulk Save respects dirty flags)
								// Ensure user_id is set
								serverFolders.forEach(f => {
									f.user_id = f.user_id || currentUid
								})
								await LocalDB.saveFoldersBulk(serverFolders)

								// C. Merge for UI Display
								// We want to show: Server Data + Local Dirty Data
								// Re-read from LocalDB which now has the merged state
								const mergedFolders = await LocalDB.getAllFolders(currentUid)
								folders.value = mergedFolders
							} else {
								folders.value = serverFolders
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
				// console.log('[fetchFolders] Completed')
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
					if (user.email) {
						currentUserEmail.value = user.email;
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
			// console.log('[fetchNotes] Started')
			loading.value = true
			const uid = currentUserId.value || 'guest';

			// 1. Instant Load from LocalDB
			if (hasIDB && uid) {
				try {
					const localNotes = await LocalDB.getAllNotes(uid)
					if (localNotes && localNotes.length > 0) {
						notes.value = localNotes
						pinnedNotes.value = localNotes.filter(n => n.is_pinned)
						loading.value = false // <--- SHOW CONTENT IMMEDIATELY (Optimistic UI)
						loadingState.value = { source: 'IDB', message: 'Load Complete' } // Renamed from Loaded from Local DB
					}
				} catch (e) { console.error("Local Load Error", e) }
			}

			// Show syncing status if we successfully loaded local data
			if (!loading.value) {
				loadingState.value = { source: 'SYNC', message: 'Syncing...' }
			}

			const remotePromise = (async () => {
				try {
					if (!isAuthenticated.value || currentUserId.value === 'guest') return // Guest Mode

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
								if (!serverIds.has(ln.id)) {
									// Strict Safety: NEVER delete automatically. Treat as Conflict.
									console.log(`[Sync] Note ${ln.id} missing on server. Marking as Conflict (Deleted on Server).`);

									// Register Virtual Server Note (Deleted)
									const virtualServerNote = {
										...ln, // Copy basics
										content: '', // Empty content for MergeView
										version: (ln.version || 1) + 1, // Force version mismatch
										updated_at: new Date().toISOString(),
										is_deleted: true // Marker for UI
									};

									conflictMap.value[ln.id] = { local: ln, server: virtualServerNote };

									// If this note is currently selected, trigger UI update immediately if needed
									// (Logic handled below in Step 3 Conflict Check loop? 
									//  No, Step 3 iterates 'currentLocalNotes' matching 'notesToSave'.
									//  Since this note is NOT in 'notesToSave' (server list), Step 3 won't touch it.
									//  So we must handle active selection trigger here if needed?
									//  Actually, if we add to conflictMap, the UI will update when 'selectNote' is called or if we force reactivity.)

									if (selectedNote.value && selectedNote.value.id === ln.id) {
										if (!conflictState.value.isConflict) {
											enterConflictMode(ln, virtualServerNote);
										}
									}
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

							// 3. Check for Conflicts (Dirty vs Server Version Mismatch)
							const currentLocalNotes = await LocalDB.getAllNotes(currentUid)
							for (const ln of currentLocalNotes) {
								const serverNote = notesToSave.find(sn => sn.id === ln.id)
								if (!serverNote) continue

								// REFINED SEARCH: Check both IDB 'dirty' status AND Memory 'dirty' status/Editor state
								let isDirty = ln.sync_status === 'dirty'
								let localContent = ln.content

								// If this is the currently selected note, it might have memory-only changes
								if (selectedNote.value && selectedNote.value.id === ln.id) {
									const isEditorDirty = editorView.value && editorView.value.state.doc.toString() !== selectedNote.value.content
									if (selectedNote.value.sync_status === 'dirty' || isEditorDirty) {
										isDirty = true
										// Use the LATEST memory/editor content for comparison
										localContent = editorView.value ? editorView.value.state.doc.toString() : selectedNote.value.content
									}
								}

								if (isDirty) {
									// Use Version Check for Optimistic Locking OR Content Check if version is same but data differs
									const versionMismatch = serverNote.version !== ln.version
									const contentMismatch = serverNote.content !== localContent

									if (versionMismatch || contentMismatch) {
										console.log(`[Sync Info] Conflict Detected: ${ln.title} (Reason: ${versionMismatch ? 'Version' : 'Content'})`)

										// Add to Conflict Map (Use Memory Content if it was newer)
										const localObj = { ...ln, content: localContent }
										conflictMap.value[ln.id] = { local: localObj, server: serverNote }

										// If currently selected, trigger UI immediately
										if (selectedNote.value && selectedNote.value.id === ln.id) {
											if (!conflictState.value.isConflict) {
												enterConflictMode(localObj, serverNote)
											}
										}
									}
								}
							}

							// Reload merged state
							// Reload merged state
							notes.value = currentLocalNotes
							pinnedNotes.value = currentLocalNotes.filter(n => n.is_pinned)

							// FIX: Update active editor to point to the new Reactive Object in notes.value
							if (selectedNote.value) {
								const freshReactiveNote = notes.value.find(n => n.id === selectedNote.value.id);
								if (freshReactiveNote && !conflictMap.value[freshReactiveNote.id]) {
									// We only swap the reference if the note is NOT in a conflict state.
									// Our enhanced conflict detection loop (Step 3) already protected dirty/unsaved notes.
									// So if it's NOT in conflictMap, it's safe to align the selectedNote reference.
									selectedNote.value = freshReactiveNote;

									// Force Editor Refresh if content changed (Vue watcher optimization might skip same-ID updates)
									nextTick(() => {
										if (editorView.value) {
											const currentDoc = editorView.value.state.doc.toString();
											if (currentDoc !== freshReactiveNote.content) {
												console.log('[Sync] Active content changed. Refreshing Editor.');
												initEditor();
											}
										}
									});
								}
							}
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
			loadingState.value = { source: 'CLOUD', message: 'Pull Complete' } // Renamed from Synced with Server
			// console.log('[fetchNotes] Completed')
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
					user_id: currentUserId.value || 'guest',
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
				const nowObj = new Date()
				const now = nowObj.toISOString()

				const pad = (n) => String(n).padStart(2, '0')
				const initialTitle = `Draft ${nowObj.getFullYear()}-${pad(nowObj.getMonth() + 1)}-${pad(nowObj.getDate())} ${pad(nowObj.getHours())}:${pad(nowObj.getMinutes())}`
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
					user_id: currentUserId.value || 'guest',
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
				selectNote(newNote) // Use the unified selectNote function

				// Switch to Edit Mode (New Layout)
				rightPanelMode.value = 'edit'
				viewMode.value = 'edit' // Reset to Editor Tab

				// Close sidebar on mobile for better UX
				if (window.innerWidth < 768) {
					isSidebarOpen.value = false
				}

				// Auto-focus and select title for immediate renaming
				nextTick(() => {
					if (titleInputRef.value) {
						titleInputRef.value.focus()
						titleInputRef.value.select()
					}
				})


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

			// Fallback: Select note with best usage score (frequency + recency)
			let bestNote = null
			let bestScore = -1

			for (const note of notes.value) {
				const usage = getNoteUsage(note.id)
				// Score = frequency * 100 + recency bonus (max 1000 points for recent usage)
				const recencyBonus = usage.lastUsed > 0 ? Math.max(0, 1000 - (Date.now() - usage.lastUsed) / 86400000) : 0
				const score = usage.count * 100 + recencyBonus

				if (score > bestScore) {
					bestScore = score
					bestNote = note
				}
			}

			if (bestNote) {
				selectNote(bestNote)
				return
			}

			// Final fallback: first note in sorted order
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

		const deselectNote = () => {
			// console.log("Navigating to About Shynote page...");
			selectedNote.value = null
			// cmEditor.value = null // Clear editor reference to force re-init on fresh DOM
			if (isSidebarOpen.value) {
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
			saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'list')
		}

		const toggleRightPanelMode = () => {
			if (rightPanelMode.value === 'list') {
				if (selectedNote.value) {
					rightPanelMode.value = 'edit'
					saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'edit')
				} else {
					// Optional: Shake or warn if no note selected?
					console.warn('Cannot switch to edit mode: No note selected')
				}
			} else {
				rightPanelMode.value = 'list'
				saveUserSetting(STORAGE_KEYS.LAST_PANEL_MODE, 'list')
			}
		}

		const selectFolder = (folderId) => {
			// console.log('selectFolder', folderId)
			currentFolderId.value = folderId
			rightPanelMode.value = 'list'
			// console.log('rightPanelMode set to', rightPanelMode.value)

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

		// Select note by ID (for backlink navigation)
		const selectNoteById = async (noteId) => {
			if (!noteId) return
			const note = notes.value.find(n => n.id === noteId)
			if (note) {
				await selectNote(note)
			}
		}

		// Safe backlink click handler for Vue templates
		const onBacklinkClick = async (noteId) => {
			const note = notes.value.find(n => n.id === noteId);
			if (note) {
				await selectNote(note);
			}
			showBacklinksMenu.value = false;
		};


		const selectNote = async (note) => {
			if (!note) return

			// Conflict Check
			if (conflictMap.value[note.id]) {
				const { local, server } = conflictMap.value[note.id]
				selectedNote.value = note;
				openOrActivateTab(note.id)
				enterConflictMode(local, server)
				// Mobile Logic (sidebar close) handled below or by sidebar logic?
				if (window.innerWidth < 768) {
					isSidebarOpen.value = false
				}
				// Don't continue to load from IDB/Server if conflict
				return;
			}

			// Track Usage
			if (note && note.id) trackNoteUsage(note.id);

			// Mobile: Close sidebar when note is selected
			if (window.innerWidth < 768) {
				isSidebarOpen.value = false
			}

			// Switch to Edit Mode
			rightPanelMode.value = 'edit'

			// 1. Immediate selection for instant UI
			selectedNote.value = note
			activeTabId.value = String(note.id)
			openOrActivateTab(note.id)
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
						loadingState.value = { source: 'IDB', message: 'Local Cache' }
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
								loadingState.value = { source: 'CLOUD', message: 'Pull Complete' }
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



		const handleDeleteOutsideClick = (e) => {
			// Check if click target is inside a validation box or button
			// Since we use @click.stop on the box itself in HTML, 
			// any click that reaches document is by definition "outside" or "unhandled".
			// However, to be safe, we can just cancel.
			// But we must ensure this listener doesn't fire for the *triggering* click.
			// console.log('Outside click detected, canceling delete')
			cancelDelete()
		}

		const requestDelete = (id, type) => {
			if (deleteConfirmation.value.id) cancelDelete() // Close existing if any

			if (type === 'note') {
				const note = notes.value.find(n => n.id === id)
				// Outside Trash: delete immediately without ASK step.
				if (note && note.folder_id !== TRASH_FOLDER_ID.value) {
					deleteNote(id)
					return
				}
			}

			deleteConfirmation.value = { id, type }

			// Add listener on next tick to avoid immediate trigger by the button click itself
			setTimeout(() => {
				document.addEventListener('click', handleDeleteOutsideClick)
			}, 0)
		}



		// Trash Feature Constants
		// Trash Feature Constants
		// Use computed to generate unique Trash ID per user to prevent DB Primary Key collisions

		const confirmDelete = async () => {
			document.removeEventListener('click', handleDeleteOutsideClick)
			const { id, type } = deleteConfirmation.value
			if (!id || !type) return

			if (type === 'note') {
				await deleteNote(id)
			} else if (type === 'folder') {
				await deleteFolderImpl(id)
			} else if (type === 'trash') {
				await emptyTrash()
			}
			deleteConfirmation.value = { id: null, type: null }
		}

		const cancelDelete = () => {
			document.removeEventListener('click', handleDeleteOutsideClick)
			deleteConfirmation.value = { id: null, type: null }
		}

		const deleteNote = async (id) => {
			try {
				const note = notes.value.find(n => n.id === id)
				if (!note) return

				// Case 1: Already in Trash -> Permanent Delete
				if (note.folder_id === TRASH_FOLDER_ID.value) {
					// 1. Check if pinned
					if (note.is_pinned) {
						pinnedNotes.value = pinnedNotes.value.filter(n => n.id !== id)
					}
					// 2. Update UI
					notes.value = notes.value.filter(n => n.id !== id)
					closeTab(id)

					// 3. Local-First Delete
					if (hasIDB) {
						await LocalDB.deleteNote(id)
					}
				}
				// Case 2: Move to Trash
				else {
					note.folder_id = TRASH_FOLDER_ID.value
					note.updated_at = new Date().toISOString()
					note.is_pinned = false // Unpin when moving to trash

					// Update UI (Remove from current view if not Trash view)
					if (currentFolderId.value !== TRASH_FOLDER_ID.value) {
						closeTab(id)
					}

					if (hasIDB) {
						await LocalDB.saveNote(JSON.parse(JSON.stringify(note)), 'UPDATE')
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
			// const prevNotes = notes.value // Not needed if we mutate in place

			// 1. Move all notes in folder to Trash
			const folderNotes = notes.value.filter(n => n.folder_id === id)
			for (const note of folderNotes) {
				note.folder_id = TRASH_FOLDER_ID.value
				note.updated_at = new Date().toISOString()
				note.is_pinned = false
				if (hasIDB) {
					await LocalDB.saveNote(JSON.parse(JSON.stringify(note)), 'UPDATE')
				}
			}

			// 2. Remove folder from UI
			folders.value = folders.value.filter(f => f.id !== id)

			// 3. Delete folder locally
			try {
				if (hasIDB) {
					// Just delete the folder, notes are already updated to Trash ID
					await LocalDB.deleteFolder(id) // We need a simple deleteFolder method without cascading notes
				} else {
					// Server side logic might be different, but for now we follow local first
					const response = await authenticatedFetch(`/api/folders/${id}`, { method: 'DELETE' })
					if (!response || !response.ok) {
						throw new Error("Server deletion failed")
					}
				}
			} catch (e) {
				console.error("Delete folder failed", e)
				// Revert UI on failure (Simplified: Reload page recommended)
				alert("Failed to delete folder")
			}
		}

		const emptyTrash = async () => {
			const trashNotes = notes.value.filter(n => n.folder_id === TRASH_FOLDER_ID.value)
			const trashIds = new Set(trashNotes.map(n => String(n.id)))

			// 1. Clear from UI
			notes.value = notes.value.filter(n => n.folder_id !== TRASH_FOLDER_ID.value)
			openTabIds.value = openTabIds.value.filter(id => !trashIds.has(String(id)))
			if (activeTabId.value && trashIds.has(String(activeTabId.value))) {
				activeTabId.value = openTabIds.value[0] || null
				resolveSelectedNoteByTab(activeTabId.value)
			}
			persistTabs()

			// 2. Delete locally
			if (hasIDB) {
				const ids = trashNotes.map(n => n.id)
				await LocalDB.deleteNotesBulk(ids) // Need to implement bulk delete or loop
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
			if (isSelectionMode.value && selectedNoteIds.value.has(note.id)) {
				// Multi-Select Drag
				draggedNoteId.value = null // Clear single drag
				if (event && event.dataTransfer) {
					event.dataTransfer.effectAllowed = 'move'
					const ids = Array.from(selectedNoteIds.value) // Keep user defined selection
					event.dataTransfer.setData('application/shynote-ids', JSON.stringify(ids))
					event.dataTransfer.setData('text/plain', `Moving ${ids.length} notes`)
				}
			} else {
				// Single Drag (Standard)
				draggedNoteId.value = note.id
				if (event && event.dataTransfer) {
					event.dataTransfer.effectAllowed = 'move'
					event.dataTransfer.setData('text/plain', String(note.id))
				}
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
						user_id: currentUserId.value || 'guest',
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

		const handleFileInput = async (event) => {
			const files = Array.from(event.target.files || [])
			if (files.length > 0) {
				await handleFiles(files)
			}
			event.target.value = null // Reset input
		}

		const handleDrop = async (targetFolderId, event) => {
			// 0. Check for Multi-Select Notes
			if (event.dataTransfer && event.dataTransfer.types.includes('application/shynote-ids')) {
				const rawIds = event.dataTransfer.getData('application/shynote-ids')
				if (rawIds) {
					const ids = JSON.parse(rawIds)
					// console.log("Dropping Multiple Notes:", ids, "to", targetFolderId)

					// Iterate and Move
					for (const id of ids) {
						const note = notes.value.find(n => n.id === id)
						if (!note || note.folder_id === targetFolderId) continue

						// Optimistic Update (Copy of Single Logic)
						const originalFolderId = note.folder_id
						note.folder_id = targetFolderId

						try {
							if (hasIDB) {
								const base = `${note.id}:${note.title}:${note.content}:${targetFolderId || 'null'}`
								const hash = await shynote_hash(base)
								note.content_hash = hash
								await LocalDB.saveNote({ ...note }, 'UPDATE')
							}
						} catch (e) {
							console.error("Bulk move failed for", id, e)
							note.folder_id = originalFolderId
						}
					}

					// Clear Selection after successful drop? 
					// User might want to keep selection if moving to multiple folders? 
					// Standard behavior usually clears selection on move.
					selectedNoteIds.value.clear()
					isSelectionMode.value = false

					dropTargetId.value = null
					return
				}
			}

			// 1. Check for Files
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
		renderer.link = function (href, title, text) {
			// Open external links in new tab with security attributes
			return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`
		}
		renderer.code = function (code, language) {
			if (language === 'mermaid') {
				return `<div class="mermaid my-4 flex justify-center bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">${code}</div>`
			}
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

			// Frontmatter Regex
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
			if (fmMatch) {
				try {
					const yamlContent = fmMatch[1]
					const metadata = jsyaml.load(yamlContent)
					content = content.replace(fmMatch[0], '')
					if (metadata && typeof metadata === 'object') {
						let rows = ''
						for (const [key, value] of Object.entries(metadata)) {
							let displayValue = value
							if (Array.isArray(value)) displayValue = value.join(', ')
							else if (typeof value === 'object') displayValue = JSON.stringify(value)
							rows += `<tr><td class="fm-key">${key}</td><td class="fm-val">${displayValue}</td></tr>`
						}
						frontmatterHtml = `<div class="frontmatter-container"><table class="frontmatter-table"><tbody>${rows}</tbody></table></div>`
					}
				} catch (e) {
					console.warn('Frontmatter parsing failed', e)
				}
			}

			// Markdown pre-processing

			// 1. Remove empty list items (e.g., lines with only "- " or "* ")
			// This prevents broken styles when user is in the middle of typing a list
			content = content.replace(/\n\s*[-*+]\s*(\n|$)/g, '\n')

			// 2. GFM Table Fix: Ensure tables are surrounded by newlines
			content = content.replace(/([^\n])\n(\s*\|.*?\|.*?)\n(\s*\|[:\s-]+\|)/g, '$1\n\n$2\n$3')

			// 3. Fix empty first columns in tables
			content = content.replace(/^\s+(\|.*\|)\s*$/gm, '$1')

			// Backlink Processing
			content = content.replace(/\[\[([^\]]*)\]\]/g, (match, content) => {
				let title = content;
				let noteId = null;
				if (content.includes('|id:')) {
					const parts = content.split('|id:');
					title = parts[0].trim();
					noteId = parts[1].trim();
				} else {
					title = content.trim();
					const note = notes.value.find(n => n.title === title);
					noteId = note?.id || null;
				}
				if (noteId) {
					return `<a href="#${noteId}" class="backlink" data-note-id="${noteId}"><span class="material-symbols-rounded text-[14px] align-middle mr-0.5">description</span>${title}</a>`;
				} else {
					return `<span class="backlink-broken" data-title="${title}" title="Note not found">⚠️ ${title}</span>`;
				}
			});

			const parsedMarkdown = marked.parse(content, {
				renderer: renderer,
				gfm: true,
				breaks: true // Enable single line breaks
			})

			return frontmatterHtml + parsedMarkdown
		})
		watch(previewContent, () => {
			nextTick(async () => {
				const nodes = document.querySelectorAll('.mermaid')
				if (window.mermaid && nodes.length > 0) {
					try {
						await mermaid.run({
							nodes: nodes,
							suppressErrors: true
						})
					} catch (err) {
						console.warn('Mermaid rendering failed:', err)
					}
				}
			})
		})

		const sortedRootNotes = computed(() => {
			const root = notes.value.filter(n => !n.folder_id)
			return sortItems(root)
		})

		const sortedFolders = computed(() => {
			const uid = currentUserId.value || 'guest';
			const regularFolders = folders.value.filter(f => {
				if (!f) return false;
				// 1. Ownership Check (Guard)
				if (f.user_id !== uid) return false;
				// 2. System Trash Exclusion
				if (f.id === TRASH_FOLDER_ID.value) return false;
				if (typeof f.id === 'string' && f.id.startsWith('trash-')) return false;
				if (f.name && f.name.toLowerCase() === 'trash') return false;
				return true;
			})
			return sortItems(regularFolders)
		})


		const getFolderNotes = (folderId) => {
			// Use loose equality (==) to handle mix of string/number IDs
			return notes.value.filter(n => n.folder_id == folderId)
		}

		const getSortedFolderNotes = (folderId) => {
			const folderNotes = getFolderNotes(folderId)
			return sortItems(folderNotes)
		}

		const sortedNotes = computed(() => {
			return sortItems(notes.value)
		})

		// Backlinks for current note - notes that reference this note
		const currentNoteBacklinks = computed(() => {
			if (!selectedNote.value || !selectedNote.value.id) return [];

			const currentId = selectedNote.value.id;
			const currentTitle = selectedNote.value.title || '';

			const backlinks = [];

			notes.value.forEach(note => {
				if (!note.content) return;
				if (note.id === currentId) return;

				let isValid = false;
				let isBroken = false;

				// Pattern 1: [[title|id:currentId]]
				const backlinkPattern = new RegExp(`\\[\\[([^\\]|]*)\\|id:${currentId}\\]\\]`, 'g');
				if (backlinkPattern.test(note.content)) {
					isValid = true;
				}

				// Pattern 2: [[currentTitle]] - match by title
				if (!isValid && currentTitle) {
					const escapedTitle = currentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const titlePattern = new RegExp(`\\[\\[${escapedTitle}\\]\\]`, 'g');
					if (titlePattern.test(note.content)) {
						isValid = true;
					}
				}

				// Pattern 3: Find broken links to this note (using ID only, no title)
				// [[|id:currentId]] - ID only format
				const idOnlyPattern = new RegExp(`\\[\\|id:${currentId}\\]\\]`, 'g');
				if (idOnlyPattern.test(note.content)) {
					isBroken = true;
				}

				if (isValid || isBroken) {
					backlinks.push({
						...note,
						_isBroken: isBroken
					});
				}
			});

			return backlinks.sort((a, b) => {
				// Sort: broken links last, then by updated date (newest first)
				if (a._isBroken && !b._isBroken) return 1;
				if (!a._isBroken && b._isBroken) return -1;
				return new Date(b.updated_at) - new Date(a.updated_at);
			});
		});

		const recentNotes = computed(() => {
			const allUsage = {};
			const key = STORAGE_KEYS.NOTE_USAGE_DATA;
			try {
				const dataStr = localStorage.getItem(getUserStorageKey(key)) || '{}';
				Object.assign(allUsage, JSON.parse(dataStr));
			} catch (e) { }

			return notes.value
				.filter(note => {
					const usage = allUsage[note.id];
					return usage && usage.lastUsed > 0;
				})
				.map(note => ({
					...note,
					lastUsed: allUsage[note.id].lastUsed,
					count: allUsage[note.id].count
				}))
				.sort((a, b) => b.lastUsed - a.lastUsed)
				.slice(0, 5);
		});

		const showBacklinksMenu = ref(false);


		// Watch authentication state to re-render button if logout
		Vue.watch(isAuthenticated, (newVal) => {
			if (!newVal) {
				setTimeout(renderGoogleButton, 100)
			}
		})

		// Note List Swipe Logic
		const swipeState = ref({
			id: null,
			startX: 0,
			startY: 0,
			currentX: 0,
			offset: 0,
			isSwiping: false
		})

		const SWIPE_THRESHOLD = 50 // px

		const handleNoteTouchStart = (note, e) => {
			// Don't start swipe if we are in selection mode
			if (isSelectionMode.value) return
			if (e.touches.length > 1) return // Ignore multi-touch

			swipeState.value.id = note.id
			swipeState.value.startX = e.touches[0].clientX
			swipeState.value.startY = e.touches[0].clientY // Capture Start Y
			swipeState.value.currentX = e.touches[0].clientX
			swipeState.value.offset = 0
			swipeState.value.isSwiping = true

			// Stop propagation to prevent global swipe
			e.stopPropagation()
		}

		const handleNoteTouchMove = (e) => {
			if (!swipeState.value.isSwiping) return
			if (e.touches.length > 1) return // Ignore multi-touch

			const currentX = e.touches[0].clientX
			const currentY = e.touches[0].clientY

			const deltaX = currentX - swipeState.value.startX
			const deltaY = currentY - swipeState.value.startY

			// If vertical scroll is dominant, cancel swipe
			if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
				swipeState.value.isSwiping = false
				swipeState.value.id = null
				return
			}

			swipeState.value.currentX = currentX
			swipeState.value.offset = deltaX

			// Prevent default ONLY if horizontal swipe is detected to stop browser nav
			if (Math.abs(deltaX) > 10) {
				if (e.cancelable) e.preventDefault()
			}
		}

		const handleNoteTouchEnd = (e) => {
			if (!swipeState.value.isSwiping) return

			const offset = swipeState.value.offset
			const noteId = swipeState.value.id

			if (offset < -SWIPE_THRESHOLD) {
				// Swipe Left -> Delete
				const note = notes.value.find(n => n.id === noteId)
				if (note) {
					if (note.folder_id === TRASH_FOLDER_ID.value) {
						if (confirm('Delete this note permanently?')) {
							deleteNote(note.id)
						}
					} else {
						deleteNote(note.id)
					}
				}
			} else if (offset > SWIPE_THRESHOLD) {
				// Swipe Right -> Pin
				// togglePin is defined in scope
				const note = notes.value.find(n => n.id === noteId)
				if (note) togglePin(note)
			}

			// Reset
			swipeState.value = {
				id: null,
				startX: 0,
				currentX: 0,
				offset: 0,
				isSwiping: false
			}
		}








		// Watchers
		// Watchers
		watch(notes, () => {
			pruneTabsWithNotes()
		})

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

		// Update Title
		watch(selectedNote, (newNote) => {
			if (newNote && newNote.title) {
				document.title = `${newNote.title} - SHYNOTE`
			} else {
				document.title = 'SHYNOTE'
			}
		}, { deep: true })

		watch(isDarkMode, (val) => {
			if (editorView.value) {
				editorView.value.dispatch({
					effects: themeCompartment.reconfigure(val ? getDarkTheme() : [])
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

		// Multi-Select Logic
		const toggleSelectionMode = () => {
			isSelectionMode.value = !isSelectionMode.value
			if (!isSelectionMode.value) {
				selectedNoteIds.value.clear()
			}
		}

		const toggleNoteSelection = (noteId) => {
			if (selectedNoteIds.value.has(noteId)) {
				selectedNoteIds.value.delete(noteId)
			} else {
				selectedNoteIds.value.add(noteId)
			}
		}

		// Section Selection Logic
		const getVisibleNotes = () => {
			return (currentFolderId.value === null ? sortedRootNotes.value : getSortedFolderNotes(currentFolderId.value))
		}

		const isSectionSelected = (type) => { // type: 'pinned' | 'regular'
			const notes = getVisibleNotes().filter(n => type === 'pinned' ? n.is_pinned : !n.is_pinned)
			if (notes.length === 0) return false
			return notes.every(n => selectedNoteIds.value.has(n.id))
		}

		const toggleSectionSelection = (type) => {
			const notes = getVisibleNotes().filter(n => type === 'pinned' ? n.is_pinned : !n.is_pinned)
			const allSelected = notes.every(n => selectedNoteIds.value.has(n.id))

			if (allSelected) {
				// Deselect all in section
				notes.forEach(n => selectedNoteIds.value.delete(n.id))
			} else {
				// Select all in section
				notes.forEach(n => selectedNoteIds.value.add(n.id))
			}
		}

		// Drag Selection (Rubberband) Logic
		const isSelecting = ref(false)
		const selectionStart = ref({ x: 0, y: 0 })
		const selectionCurrent = ref({ x: 0, y: 0 })
		const marqueeEl = ref(null)

		onMounted(() => {
			marqueeEl.value = document.getElementById('selection-marquee')
			window.addEventListener('mousemove', updateDragSelection)
			window.addEventListener('mouseup', endDragSelection)
			window.addEventListener('keydown', handleKeydown)
		})

		onBeforeUnmount(() => {
			window.removeEventListener('mousemove', updateDragSelection)
			window.removeEventListener('mouseup', endDragSelection)
			window.removeEventListener('keydown', handleKeydown)
		})

		const handleKeydown = (event) => {
			// Cmd+A or Ctrl+A
			if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
				// Ignore if focus is in input/textarea/contenteditable
				const tag = event.target.tagName
				if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return

				event.preventDefault()

				// Enter Selection Mode
				isSelectionMode.value = true

				// Select All Visible Notes
				const visible = getVisibleNotes()
				visible.forEach(n => selectedNoteIds.value.add(n.id))
			}

			// Escape to Cancel Selection
			if (event.key === 'Escape' && isSelectionMode.value) {
				isSelectionMode.value = false
				selectedNoteIds.value.clear()
			}
		}

		const startDragSelection = (event) => {
			const target = event.target
			// 2. Ignore elements
			const tag = event.target.tagName
			if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A' || event.target.closest('button') || event.target.closest('.note-item')) return

			// 3. Ignore Sidebar (New)
			if (event.target.closest('#app-sidebar')) return

			// Left click only
			if (event.button !== 0) return

			isSelecting.value = true
			// Don't enable selection mode immediately. Wait for drag.
			// isSelectionMode.value = true 
			selectionStart.value = { x: event.clientX, y: event.clientY }
			selectionCurrent.value = { x: event.clientX, y: event.clientY }

			// if (marqueeEl.value) {
			// 	updateMarqueeStyle()
			// 	marqueeEl.value.classList.remove('hidden')
			// }
		}

		const updateDragSelection = (event) => {
			if (!isSelecting.value) return
			selectionCurrent.value = { x: event.clientX, y: event.clientY }

			// Calculate distance to determine if it's a drag
			if (!isSelectionMode.value) {
				const dx = Math.abs(event.clientX - selectionStart.value.x)
				const dy = Math.abs(event.clientY - selectionStart.value.y)
				if (dx > 5 || dy > 5) {
					isSelectionMode.value = true
					if (marqueeEl.value) marqueeEl.value.classList.remove('hidden')
				}
			}

			if (isSelectionMode.value) {
				updateMarqueeStyle()
			}
		}

		const updateMarqueeStyle = () => {
			if (!marqueeEl.value) return
			const x = Math.min(selectionStart.value.x, selectionCurrent.value.x)
			const y = Math.min(selectionStart.value.y, selectionCurrent.value.y)
			const width = Math.abs(selectionCurrent.value.x - selectionStart.value.x)
			const height = Math.abs(selectionCurrent.value.y - selectionStart.value.y)

			marqueeEl.value.style.left = `${x}px`
			marqueeEl.value.style.top = `${y}px`
			marqueeEl.value.style.width = `${width}px`
			marqueeEl.value.style.height = `${height}px`
		}

		const endDragSelection = (event) => {
			if (!isSelecting.value) return

			// Calculate Final Selection
			const marqueeRect = {
				left: Math.min(selectionStart.value.x, selectionCurrent.value.x),
				top: Math.min(selectionStart.value.y, selectionCurrent.value.y),
				right: Math.max(selectionStart.value.x, selectionCurrent.value.x),
				bottom: Math.max(selectionStart.value.y, selectionCurrent.value.y)
			}

			// Threshold to treat as click (ignore small jitter)
			if (Math.abs(marqueeRect.right - marqueeRect.left) > 5 || Math.abs(marqueeRect.bottom - marqueeRect.top) > 5) {
				const noteEls = document.querySelectorAll('.note-item')
				noteEls.forEach(el => {
					const rect = el.getBoundingClientRect()
					if (rect.left < marqueeRect.right &&
						rect.right > marqueeRect.left &&
						rect.top < marqueeRect.bottom &&
						rect.bottom > marqueeRect.top) {
						const id = el.getAttribute('data-id')
						if (id) selectedNoteIds.value.add(id)
					}
				})
			}

			isSelecting.value = false
			if (marqueeEl.value) marqueeEl.value.classList.add('hidden')
		}

		// REVISED endDragSelection to be cleaner once data-id is added
		// const finalizeSelection = () => {
		// 	const marqueeRect = {
		// 		left: Math.min(selectionStart.value.x, selectionCurrent.value.x),
		// 		top: Math.min(selectionStart.value.y, selectionCurrent.value.y),
		// 		right: Math.max(selectionStart.value.x, selectionCurrent.value.x),
		// 		bottom: Math.max(selectionStart.value.y, selectionCurrent.value.y)
		// 	}

		// 	// Small drag threshold to avoid accidental clears on click
		// 	if (marqueeRect.right - marqueeRect.left < 5 && marqueeRect.bottom - marqueeRect.top < 5) return

		// 	const noteEls = document.querySelectorAll('.note-item') // I will add this class
		// 	noteEls.forEach(el => {
		// 		const rect = el.getBoundingClientRect()
		// 		if (rect.left < marqueeRect.right &&
		// 			rect.right > marqueeRect.left &&
		// 			rect.top < marqueeRect.bottom &&
		// 			rect.bottom > marqueeRect.top) {
		// 			const id = el.getAttribute('data-id')
		// 			if (id) selectedNoteIds.value.add(id)
		// 		}
		// 	})
		// }

		// --- Command Palette Logic ---

		const commands = computed(() => {
			const list = [
				// Basic Commands (All Modes)
				{ id: 'nav.note', title: 'Go to Note...', icon: 'search', desc: '파일 검색 및 이동', handler: () => setPaletteMode('notes'), shortcut: 'Cmd+P' },
				{ id: 'nav.folder', title: 'Go to Folder...', icon: 'folder_open', desc: '폴더 이동', handler: () => setPaletteMode('folders') },
				{ id: 'note.new', title: 'Create New Note', icon: 'add_circle', desc: '새 노트 생성', handler: () => { createNote(); closeCommandPalette() }, shortcut: 'Cmd+Shift+N' },
				{ id: 'view.zen', title: 'Toggle Sidebar', icon: 'menu_open', desc: '사이드바 토글 On/Off', handler: () => { toggleSidebar(); closeCommandPalette() } },
				{ id: 'view.dark', title: 'Toggle Dark Mode', icon: 'dark_mode', desc: '다크 모드 전환', handler: () => { toggleDarkMode(); closeCommandPalette() } },
				{ id: 'sys.sync', title: 'Sync Now', icon: 'sync', desc: '강제 동기화 수행', handler: async () => { await pullSync(); closeCommandPalette() } },
				{ id: 'sys.clearCache', title: 'Clear Local Cache', icon: 'delete_sweep', desc: '캐시 및 데이터 초기화', handler: () => { clearLocalCache(); closeCommandPalette() } },
				{ id: 'sys.reload', title: 'Reload App', icon: 'refresh', desc: '앱 새로고침', handler: () => window.location.reload() }
			]

			// Contextual Commands (Editor Mode Only)
			if (rightPanelMode.value === 'edit' && openTabIds.value.length > 0) {
				list.push(
					{ id: 'tabs.closeAll', title: 'Close All Tabs', icon: 'tab_close', desc: '열린 탭 전체 닫기', handler: () => { closeAllTabs(); closeCommandPalette() } }
				)
			}

			if (rightPanelMode.value === 'edit' && selectedNote.value) {
				list.push(
					{
						id: 'note.rename', title: 'Rename Note', icon: 'edit', desc: '제목 수정', handler: () => {
							closeCommandPalette()
							nextTick(() => {
								if (titleInputRef.value) {
									titleInputRef.value.focus()
									titleInputRef.value.select()
								}
							})
						}, shortcut: 'F2'
					},
					{ id: 'note.move', title: 'Move Note', icon: 'drive_file_move', desc: '폴더 이동', handler: () => setPaletteMode('move-dest') },
					{ id: 'note.delete', title: 'Delete Note', icon: 'delete', desc: '파일 삭제', handler: () => { requestDelete(selectedNote.value.id, 'note'); closeCommandPalette() }, shortcut: 'Cmd+Backspace' },
					{ id: 'view.mode', title: 'Switch View Mode', icon: 'view_agenda', desc: '보기 모드 전환 (Split / Edit / Preview)', handler: () => { cycleViewMode(); closeCommandPalette() } },
					{
						id: 'note.editTable', title: 'Edit Table', icon: 'table_chart', desc: '현재 표 편집 또는 신규 생성', handler: () => {
							triggerTableEditor();
							closeCommandPalette();
						}
					},
					{ id: 'sys.info', title: 'Show File Info', icon: 'info', desc: '글자수, 수정일 등 상세 정보', handler: () => { closeCommandPalette(); setTimeout(() => showFileInfo(), 100) } }
				)
			}

			return list
		})

		const palettePlaceholder = computed(() => {
			if (paletteMode.value === 'notes') return 'Search files...'
			if (paletteMode.value === 'folders') return 'Go to folder...'
			if (paletteMode.value === 'move-dest') return 'Move to folder...'
			return 'Type a command...' // commands
		})

		const filteredPaletteItems = computed(() => {
			const query = paletteQuery.value.trim().toLowerCase()

			if (paletteMode.value === 'commands') {
				return commands.value.filter(c =>
					c.title.toLowerCase().includes(query) ||
					(c.desc && c.desc.toLowerCase().includes(query))
				)
			}

			if (paletteMode.value === 'notes') {
				const results = notes.value.map(n => {
					const usage = getNoteUsage(n.id);
					const score = query ? fuzzyScore(n.title, query) : 0;
					return {
						note: n,
						score,
						count: usage.count,
						lastUsed: usage.lastUsed
					};
				});

				// If no query, show recently/frequently used notes
				// If query, filter by score > 0
				const filtered = query
					? results.filter(r => r.score > 0)
					: results.sort((a, b) => b.lastUsed - a.lastUsed || b.count - a.count).slice(0, 10);

				if (query) {
					filtered.sort((a, b) => {
						// 1. Fuzzy Score Priority
						if (Math.abs(b.score - a.score) > 5) return b.score - a.score;
						// 2. Usage Frequency
						if (b.count !== a.count) return b.count - a.count;
						// 3. Recency
						return b.lastUsed - a.lastUsed;
					});
				}

				return filtered.map(r => ({
					id: r.note.id,
					title: r.note.title || 'Untitled',
					icon: 'description',
					desc: r.note.folder_id ? folders.value.find(f => f.id === r.note.folder_id)?.name : 'Inbox',
					handler: () => { selectNote(r.note); closeCommandPalette() }
				}))
			}

			if (paletteMode.value === 'folders' || paletteMode.value === 'move-dest') {
				const list = [{ id: null, name: 'Inbox', icon: 'inbox' }, ...sortedFolders.value]
				return list.filter(f => f.name.toLowerCase().includes(query)).map(f => ({
					id: f.id, title: f.name, icon: f.icon || (f.id ? 'folder' : 'inbox'), desc: '',
					handler: () => {
						if (paletteMode.value === 'move-dest') {
							if (selectedNote.value) moveSelectedNote(f.id)
						} else {
							selectFolder(f.id)
						}
						closeCommandPalette()
					}
				}))
			}
			return []
		})

		// Reset selection when results change
		watch(filteredPaletteItems, () => {
			paletteIndex.value = 0
		})

		const openCommandPalette = () => {
			showCommandPalette.value = true
			paletteMode.value = 'commands'
			paletteQuery.value = ''
			paletteIndex.value = 0
			nextTick(() => paletteInput.value?.focus())
		}

		const closeCommandPalette = () => {
			showCommandPalette.value = false
			paletteMode.value = 'commands'
			// optional: focus editor
			const view = editorView.value
			if (view) view.focus()
		}

		const setPaletteMode = (mode) => {
			paletteMode.value = mode
			paletteQuery.value = ''
			paletteIndex.value = 0
			nextTick(() => paletteInput.value?.focus())
		}

		const handlePaletteKeydown = (e) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault()
				paletteIndex.value = (paletteIndex.value + 1) % filteredPaletteItems.value.length
				// Scroll into view logic if needed
				if (paletteList.value && paletteIndex.value >= 0) {
					const itemEl = paletteList.value.children[paletteIndex.value]
					itemEl?.scrollIntoView({ block: 'nearest' })
				}
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				paletteIndex.value = (paletteIndex.value - 1 + filteredPaletteItems.value.length) % filteredPaletteItems.value.length
				if (paletteList.value && paletteIndex.value >= 0) {
					const itemEl = paletteList.value.children[paletteIndex.value]
					itemEl?.scrollIntoView({ block: 'nearest' })
				}
			} else if (e.key === 'Enter') {
				e.preventDefault()
				const item = filteredPaletteItems.value[paletteIndex.value]
				if (item) executePaletteItem(item)
			} else if (e.key === 'Escape') {
				if (paletteMode.value !== 'commands' && !paletteQuery.value) {
					setPaletteMode('commands')
				} else {
					closeCommandPalette()
				}
			}
		}

		const executePaletteItem = (item) => {
			if (item.handler) item.handler()
		}

		// --- Helper Actions ---
		const insertDate = () => {
			const now = new Date()
			const str = now.getFullYear() + '-' +
				String(now.getMonth() + 1).padStart(2, '0') + '-' +
				String(now.getDate()).padStart(2, '0') + ' ' +
				String(now.getHours()).padStart(2, '0') + ':' +
				String(now.getMinutes()).padStart(2, '0');

			const view = editorView.value
			if (view) {
				const range = view.state.selection.main
				view.dispatch({
					changes: { from: range.from, to: range.to, insert: str },
					selection: { anchor: range.from + str.length }
				})
			}
		}

		const toggleZenMode = () => {
			// Need to implement zen mode state or class toggle
			document.body.classList.toggle('zen-mode')
			// Also force sidebar close
			if (document.body.classList.contains('zen-mode')) {
				isSidebarOpen.value = false
			}
		}

		const adjustZoom = (delta) => {
			const currentSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
			const newSize = Math.max(12, Math.min(24, currentSize + delta))
			document.documentElement.style.fontSize = newSize + 'px'
			saveUserSetting(STORAGE_KEYS.FONT_SIZE, newSize) // Save new font size
		}




		const formatDate = (dateStr) => {
			const date = parseSafeDate(dateStr)
			if (!date) return dateStr || ''

			const yyyy = date.getFullYear()
			const mm = String(date.getMonth() + 1).padStart(2, '0')
			const dd = String(date.getDate()).padStart(2, '0')
			const hh = String(date.getHours()).padStart(2, '0')
			const min = String(date.getMinutes()).padStart(2, '0')
			const ss = String(date.getSeconds()).padStart(2, '0')
			return `${yyyy}.${mm}.${dd} ${hh}:${min}:${ss}`
		}

		const formatDateParts = (dateStr) => {
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
		}

		return {
			notes,
			folders,
			selectedNote,
			openTabs,
			activeTabId,
			// Palette State & Methods
			showCommandPalette,
			paletteMode,
			paletteQuery,
			paletteIndex,
			paletteInput,
			paletteList,
			palettePlaceholder,
			filteredPaletteItems,
			openCommandPalette,
			closeCommandPalette,
			handlePaletteKeydown,
			executePaletteItem,
			setPaletteMode,
			isSelectionMode,
			selectedNoteIds,
			toggleSelectionMode,
			toggleNoteSelection,
			isSectionSelected,
			toggleSectionSelection,
			startDragSelection, // Expose for @mousedown
			loading,
			statusMessage,
			shortStatusMessage,
			shortLoadingMessage,
			loadingState, // NEW
			createFolder,
			createNote,
			createNoteInFolder,
			selectNote,
			selectNoteById,
			activateTab,
			closeTab,
			onBacklinkClick,
			deselectNote,
			deleteNote,
			deleteFolder,
			debouncedUpdate,
			previewContent,
			isSidebarOpen,

			toggleSidebar,
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
			handleLogout,
			showLoginModal,
			currentUserId,
			currentUserEmail,
			renameState,
			startRename,
			saveRename,

			isSettingsModalOpen,
			openSettingsModal,
			closeSettingsModal,
			apiKeyValue,
			apiKeyError,
			apiKeyLoading,
			generateApiKey,
			deleteApiKey,
			copyApiKey,
			backupData,
			restoreData,
			clearLocalCache,
			factoryReset,
			deleteConfirmation,
			requestDelete,
			confirmDelete,
			cancelDelete,
			showToolbarDeleteConfirm: computed(() => {
				return deleteConfirmation.value.id === selectedNote.value?.id &&
					deleteConfirmation.value.type === 'note' &&
					rightPanelMode.value === 'edit'
			}),
			deleteButtonLabel: computed(() => {
				return currentFolderId.value === TRASH_FOLDER_ID.value ? 'Delete Permanently?' : 'Move to Trash?'
			}),

			titleInputRef,
			pasteContent,

			formatText,
			toggleCode,
			triggerSearch: () => {
				if (editorView.value) {
					const panel = document.querySelector('.cm-panel.cm-search')
					if (panel) {
						closeSearchPanel(editorView.value)
						editorView.value.focus()
					} else {
						openSearchPanel(editorView.value)
						setTimeout(() => {
							const searchInput = document.querySelector('.cm-search input[name="search"]')
							if (searchInput) {
								searchInput.focus()
							}
						}, 50)
					}
				}
			},
			formatDate,
			formatDateParts,
			modalState,
			closeModal,
			confirmAction,
			tableEditorState,
			openTableEditor,
			closeTableEditor,
			saveTableEditor,
			deleteTableRow,
			deleteTableCol,
			deleteActiveRow,
			deleteActiveCol,
			addTableRow,
			addTableCol,
			setColumnAlignment,
			handleEditorDoubleClick,
			handlePreviewDoubleClick,
			showSignpost,
			signpost,
			// Sort exports
			sortOption,
			setSortOption,
			sortedRootNotes,
			sortedFolders,
			getSortedFolderNotes,
			currentNoteBacklinks,
			recentNotes,
			showBacklinksMenu,
			showSortMenu,
			toggleSortMenu,
			closeSortMenu,
			sortLabel,
			fontSize,
			setFontSize,
			appVersion,
			homeUrl,

			draggedNoteId,
			handleDragStart,
			handleDrop,
			dropTargetId,
			handleDragEnter,
			handleDragLeave,
			moveSelectedNote,
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
			lastSyncTime,
			syncQueueCount,
			manualSync: syncWorker,
			pullSync,
			fetchNotes,

			rightPanelMode,
			listViewMode,
			toggleListViewMode,
			currentFolderId,
			toggleRightPanelMode,
			selectFolder,
			backToList,

			// Edit
			hasSelection,
			checkSelection,
			getPlainContent,
			guestMode: computed(() => !isAuthenticated.value),
			// Config
			splitRatio,
			sidebarWidth,
			startSidebarResize,
			startResize,
			hasIDB,
			isSyncing,
			conflictState,
			resolveConflict,
			dbType,
			sidebarViewMode,
			setSidebarViewMode,
			sidebarPanelMode,
			setSidebarPanelMode,
			showNewItemMenu,
			toggleNewItemMenu,
			closeNewItemMenu,
			isSharing,
			isSortMenuOpen,
			// Search
			searchQuery,
			searchOptions,
			searchResults,
			showSearchHistoryDropdown,
			searchHistoryDropdownIndex,
			selectSearchHistoryItem,
			hideSearchHistoryDropdown,
			isSearchOpen,
			selectSearchResult,
			getHighlightedText,
			searchHistory,
			trashNotesCount,

			TRASH_FOLDER_ID,
			emptyTrash,
			handleFileInput,
			isOnline,
			useRedirectFlow,
			loginWithGoogleRedirect,
			cancelLogin,
			swipeState,
			handleNoteTouchStart,
			handleNoteTouchMove,
			handleNoteTouchEnd,
			isMobile,
			isEditModeActive,
			conflictMap,
			triggerTableEditor
		}
	}
};

if (typeof window !== 'undefined' && document.getElementById('app')) {
	createApp(App).mount('#app');
}

window.shynoteData = {
	notes: null,
	selectNote: null
};

const appElement = document.getElementById('app');
if (appElement && appElement.__vue_app__) {
	const vm = appElement.__vue_app__.config.globalProperties;
	window.shynoteData.notes = vm.notes;
	window.shynoteData.selectNote = vm.selectNote;

	window.selectNoteById = async (noteId) => {
		const notes = vm.notes?.value;
		const note = notes?.find(n => n.id === noteId);
		if (note) {
			await vm.selectNote(note);
		}
	};
}
