import { openDB } from "https://esm.sh/idb@7.1.1";

const DB_NAME = 'SHYNOTE_VAULT';
const DB_VERSION = 8;

export const initDB = async () => {
	return openDB(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion, newVersion, transaction) {
			console.log(`Upgrading DB from v${oldVersion} to v${newVersion}. Clearing data for schema update.`);

			// 1. Force Truncate: Delete all existing stores
			if (db.objectStoreNames.contains('notes')) db.deleteObjectStore('notes');
			if (db.objectStoreNames.contains('folders')) db.deleteObjectStore('folders');
			if (db.objectStoreNames.contains('pending_logs')) db.deleteObjectStore('pending_logs');

			// 2. Re-create Stores
			// Notes Store
			const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
			notesStore.createIndex('folder_id', 'folder_id', { unique: false });
			notesStore.createIndex('updated_at', 'updated_at', { unique: false });
			notesStore.createIndex('sync_status', 'sync_status', { unique: false });
			notesStore.createIndex('user_id', 'user_id', { unique: false });

			// Folders Store
			const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
			foldersStore.createIndex('user_id', 'user_id', { unique: false });

			// Pending Logs
			const logStore = db.createObjectStore('pending_logs', { keyPath: 'id', autoIncrement: true });
			logStore.createIndex('created_at', 'created_at');
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
			// Only overwrite if not dirty
			const existing = await store.get(folder.id);
			if (existing && existing.sync_status === 'dirty') continue;

			await store.put({
				...folder,
				sync_status: 'synced',
				local_updated_at: new Date().toISOString()
			});
		}
		await tx.done;
	},

	async saveFolder(folder, action = 'UPDATE') {
		const db = await initDB();
		const tx = db.transaction(['folders', 'pending_logs'], 'readwrite');

		// 1. Update State
		await tx.objectStore('folders').put({
			...folder,
			sync_status: 'dirty',
			local_updated_at: new Date().toISOString()
		});

		// 2. Add Log
		await tx.objectStore('pending_logs').add({
			action: action,
			entity: 'folder',
			entity_id: folder.id,
			payload: { name: folder.name },
			created_at: new Date().toISOString()
		});

		await tx.done;
	},

	async markFolderSynced(id) {
		const db = await initDB();
		const tx = db.transaction('folders', 'readwrite');
		const store = tx.objectStore('folders');
		const folder = await store.get(id);
		if (folder) {
			folder.sync_status = 'synced';
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

	async saveNote(note, action = 'UPDATE') {
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
			action: action, // 'CREATE' or 'UPDATE'
			entity: 'note',
			entity_id: note.id,
			payload: { title: note.title, content: note.content, folder_id: note.folder_id, is_pinned: note.is_pinned },
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
		const tx = db.transaction(['notes', 'pending_logs'], 'readwrite');
		await tx.objectStore('notes').delete(id);

		// Add Log
		await tx.objectStore('pending_logs').add({
			action: 'DELETE',
			entity: 'note',
			entity_id: id,
			created_at: new Date().toISOString()
		});

		await tx.done;
	},

	async deleteFolder(id) {
		const db = await initDB();
		const tx = db.transaction(['folders', 'pending_logs'], 'readwrite');
		await tx.objectStore('folders').delete(id);

		// Add Log
		await tx.objectStore('pending_logs').add({
			action: 'DELETE',
			entity: 'folder',
			entity_id: id,
			created_at: new Date().toISOString()
		});

		await tx.done;
	},

	async clearAll() {
		const db = await initDB();
		const tx = db.transaction(['notes', 'folders', 'pending_logs'], 'readwrite');
		await tx.objectStore('notes').clear();
		await tx.objectStore('folders').clear();
		await tx.objectStore('pending_logs').clear();
		await tx.done;
	}
};
