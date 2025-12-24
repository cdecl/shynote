import { openDB } from "https://esm.sh/idb@7.1.1";

const DB_NAME = 'SHYNOTE_VAULT';
const DB_VERSION = 2;

export const initDB = async () => {
	return openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			// Notes Store: Mirror of Server Data + Local Edits
			if (!db.objectStoreNames.contains('notes')) {
				const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
				notesStore.createIndex('folder_id', 'folder_id', { unique: false });
				notesStore.createIndex('updated_at', 'updated_at', { unique: false });
				notesStore.createIndex('sync_status', 'sync_status', { unique: false }); // 'synced', 'dirty', 'conflict'
			}

			// Folders Store
			if (!db.objectStoreNames.contains('folders')) {
				db.createObjectStore('folders', { keyPath: 'id' });
			}

			// Pending Logs: Write-Ahead Log for mutations
			if (!db.objectStoreNames.contains('pending_logs')) {
				const logStore = db.createObjectStore('pending_logs', { keyPath: 'id', autoIncrement: true });
				logStore.createIndex('created_at', 'created_at');
			}
		},
	});
};

export const LocalDB = {
	async getNote(id) {
		const db = await initDB();
		return db.get('notes', id);
	},

	async getAllFolders() {
		const db = await initDB();
		return db.getAll('folders');
	},

	async saveFoldersBulk(folders) {
		const db = await initDB();
		const tx = db.transaction('folders', 'readwrite');
		const store = tx.objectStore('folders');
		for (const folder of folders) {
			await store.put(folder);
		}
		await tx.done;
	},

	async getAllNotes() {
		const db = await initDB();
		return db.getAll('notes');
	},

	async saveNote(note) {
		const db = await initDB();
		const tx = db.transaction(['notes', 'pending_logs'], 'readwrite');

		// 1. Update State
		await tx.objectStore('notes').put({
			...note,
			sync_status: 'dirty',
			local_updated_at: new Date().toISOString()
		});

		// 2. Add Log
		await tx.objectStore('pending_logs').add({
			action: 'UPDATE',
			entity: 'note',
			entity_id: note.id,
			payload: { title: note.title, content: note.content, folder_id: note.folder_id },
			created_at: new Date().toISOString()
		});

		await tx.done;
	},

	async saveNotesBulk(notes) {
		const db = await initDB();
		const tx = db.transaction('notes', 'readwrite');
		const store = tx.objectStore('notes');
		for (const note of notes) {
			const existing = await store.get(note.id);
			if (existing && existing.sync_status === 'dirty') {
				continue;
			}
			await store.put({
				...note,
				sync_status: 'synced',
				local_updated_at: new Date().toISOString()
			});
		}
		await tx.done;
	},

	async getPendingLogs() {
		const db = await initDB();
		return db.getAll('pending_logs');
	},

	async removeLog(logId) {
		const db = await initDB();
		await db.delete('pending_logs', logId);
	},

	async markNoteSynced(id) {
		const db = await initDB();
		const tx = db.transaction('notes', 'readwrite');
		const store = tx.objectStore('notes');
		const note = await store.get(id);
		if (note) {
			note.sync_status = 'synced';
			await store.put(note);
		}
		await tx.done;
	}
};
