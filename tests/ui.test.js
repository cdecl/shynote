// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { App } from '../static/app.js';

// Mock vendor.js imports
vi.mock('../static/dist/vendor.js', async () => {
	const ActualVue = await vi.importActual('vue');
	return {
		Vue: ActualVue,
		CodeMirror: {
			EditorView: vi.fn(function () { return { destroy: vi.fn(), dispatch: vi.fn() }; }),
			EditorState: {
				Compartment: vi.fn(function () { return { reconfigure: vi.fn() }; }),
				EditorSelection: vi.fn()
			},
			Compartment: vi.fn(function () { return { reconfigure: vi.fn() }; }),
			keymap: vi.fn(),
			placeholder: vi.fn(),
			syntaxHighlighting: vi.fn(),
			bracketMatching: vi.fn(),
			closeBrackets: vi.fn(),
			autocompletion: vi.fn(),
			MergeView: vi.fn(function () { return { destroy: vi.fn() }; }),
		},
		LocalDB: {
			getNote: vi.fn(),
			getAllNotes: vi.fn(),
			getAllFolders: vi.fn(),
			saveNote: vi.fn(),
			clearPendingLogs: vi.fn(),
		},
		marked: {
			parse: vi.fn(),
			Renderer: vi.fn(function () { return {}; })
		},
		hljs: { highlightAuto: vi.fn() },
		mermaid: { initialize: vi.fn() },
		jsyaml: { load: vi.fn() },
		sha256: vi.fn(() => ({ toString: () => 'hash' })),
		markdownTable: vi.fn(),
		polyfill: vi.fn(),
		openDB: vi.fn(),
		scrollBehaviourDragImageTranslateOverride: vi.fn(),
	};
});

// Mock local_db.js
vi.mock('../static/local_db.js', () => ({
	LocalDB: {
		getNote: vi.fn(),
		getAllNotes: vi.fn(() => Promise.resolve([])),
		getAllFolders: vi.fn(() => Promise.resolve([])),
		saveNote: vi.fn(),
		clearPendingLogs: vi.fn(),
	}
}));

// Mock global browser APIs
vi.stubGlobal('crypto', {
	getRandomValues: (bytes) => bytes,
	subtle: { digest: vi.fn() }
});

describe('App.js UI Module Functions', () => {
	let wrapper;

	beforeEach(() => {
		// Mock innerWidth for mobile/desktop detection
		vi.stubGlobal('innerWidth', 1024);

		// Mock localStorage
		const localStorageMock = (() => {
			let store = {};
			return {
				getItem: (key) => store[key] || null,
				setItem: (key, value) => { store[key] = value.toString(); },
				clear: () => { store = {}; },
				removeItem: (key) => { delete store[key]; }
			};
		})();
		vi.stubGlobal('localStorage', localStorageMock);
	});

	it('should expose core UI functions in setup()', async () => {
		// App contains setup() which returns an object with all reactive variables and functions
		// We can test the setup logic directly or mount it.
		// Since app.js is a large single file, we mount carefully.

		const wrapper = mount(App);
		const vm = wrapper.vm;

		// Verify exposed functions and state
		expect(vm.fetchNotes).toBeDefined();
		expect(vm.selectNote).toBeDefined();
		expect(vm.createNoteInFolder).toBeDefined();
		expect(vm.notes).toBeDefined();
		expect(Array.isArray(vm.notes)).toBe(true);
		expect(vm.isSidebarOpen).toBe(true);
	});

	it('should toggle sidebar state', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		expect(vm.isSidebarOpen).toBe(true);

		// sidebarPanelMode toggle logic
		// setSidebarPanelMode('explorer') -> if already explorer and open, close.
		vm.setSidebarPanelMode('explorer');
		expect(vm.isSidebarOpen).toBe(false);

		vm.setSidebarPanelMode('explorer');
		expect(vm.isSidebarOpen).toBe(true);
	});

	it('should handle search query updates and results', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		vm.searchQuery = 'test';
		// searchResults is a computed property
		expect(vm.searchResults).toBeDefined();
	});

	it('should toggle sidebar from main panel in desktop mode', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		vm.isMobile = false;
		vm.isSidebarOpen = true;
		vm.openSidebarFromMainPanel();
		expect(vm.isSidebarOpen).toBe(false);

		vm.openSidebarFromMainPanel();
		expect(vm.isSidebarOpen).toBe(true);
	});

	it('should open explorer sidebar from main panel in mobile mode', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		vm.isMobile = true;
		vm.isSidebarOpen = false;
		vm.sidebarPanelMode = 'search';

		vm.openSidebarFromMainPanel();

		expect(vm.isSidebarOpen).toBe(true);
		expect(vm.sidebarPanelMode).toBe('explorer');
	});

	it('should return sidebar toggle icon based on open state', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		vm.isSidebarOpen = true;
		expect(vm.getSidebarToggleIcon()).toBe('left_panel_close');

		vm.isSidebarOpen = false;
		expect(vm.getSidebarToggleIcon()).toBe('left_panel_open');
	});

	it('should keep recent notes up to 10 and include folder names', async () => {
		const wrapper = mount(App);
		const vm = wrapper.vm;

		const usage = {};
		for (let i = 1; i <= 12; i++) {
			usage[`n${i}`] = { count: i, lastUsed: i };
		}
		localStorage.setItem('guest_shynote_note_usage_v1', JSON.stringify(usage));

		vm.folders = [{ id: 'f1', name: 'Work' }];
		vm.notes = Array.from({ length: 12 }, (_, idx) => {
			const n = idx + 1;
			let folder_id = null;
			if (n === 11) folder_id = 'f1';
			if (n === 10) folder_id = 'trash-guest';
			if (n === 9) folder_id = 'unknown-folder';
			return { id: `n${n}`, title: `Note ${n}`, folder_id };
		});

		const recent = vm.recentNotes;
		expect(recent.length).toBe(10);
		expect(recent[0].id).toBe('n12');
		expect(recent[0].folderName).toBe('INBOX');
		expect(recent.find(n => n.id === 'n11')?.folderName).toBe('Work');
		expect(recent.find(n => n.id === 'n10')?.folderName).toBe('TRASH');
		expect(recent.find(n => n.id === 'n9')?.folderName).toBe('Folder');
	});
});
