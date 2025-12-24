import { openDB } from "https://esm.sh/idb@7.1.1";

const DB_NAME = 'SHYNOTE_VAULT';
const DB_VERSION = 4;

export const initDB = async () => {
	return openDB(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion, newVersion, transaction) {
			// Notes Store: Mirror of Server Data + Local Edits
			let notesStore;
			if (!db.objectStoreNames.contains('notes')) {
				notesStore = db.createObjectStore('notes', { keyPath: 'id' });
				notesStore.createIndex('folder_id', 'folder_id', { unique: false });
				notesStore.createIndex('updated_at', 'updated_at', { unique: false });
				notesStore.createIndex('sync_status', 'sync_status', { unique: false }); // 'synced', 'dirty', 'conflict'
				notesStore.createIndex('user_id', 'user_id', { unique: false });
			} else {
				notesStore = transaction.objectStore('notes');
				if (!notesStore.indexNames.contains('user_id')) {
					notesStore.createIndex('user_id', 'user_id', { unique: false });
				}
			}

			// Folders Store
			let foldersStore;
			if (!db.objectStoreNames.contains('folders')) {
				foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
				foldersStore.createIndex('user_id', 'user_id', { unique: false });
			} else {
				foldersStore = transaction.objectStore('folders');
				if (!foldersStore.indexNames.contains('user_id')) {
					foldersStore.createIndex('user_id', 'user_id', { unique: false });
				}
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

	async getAllFolders(userId) {
		const db = await initDB();
		if (userId) {
			return db.getAllFromIndex('folders', 'user_id', userId);
		}
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

	async getAllNotes(userId) {
		const db = await initDB();
		if (userId) {
			return db.getAllFromIndex('notes', 'user_id', userId);
		}
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

			// 1. Conflict Protection: If Local is Dirty, NEVER overwrite.
			if (existing && existing.sync_status === 'dirty') {
				continue;
			}

			// 2. Optimization: If Hash matches, SKIP overwrite (No change).
			// Note: We need to store content_hash in DB for this to work.
			// If existing has no hash (migration), we update.
			if (existing && existing.content_hash && existing.content_hash === note.content_hash) {
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
	},

	async deleteNote(id) {
		const db = await initDB();
		const tx = db.transaction(['notes'], 'readwrite');
		await tx.objectStore('notes').delete(id);
		await tx.done;
	},

	async deleteFolder(id) {
		const db = await initDB();
		await db.delete('folders', id);
	}
};
