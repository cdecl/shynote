import { openDB } from './dist/vendor.js';

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

	// Private Helper for Bulk Write with Conflict Protection
	async _saveBulk(storeName, items, transform = (x) => x) {
		const db = await initDB();
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		for (const item of items) {
			const existing = await store.get(item.id);
			if (existing && existing.sync_status === 'dirty') continue;
			if (existing && existing.content_hash && item.content_hash && existing.content_hash === item.content_hash) continue;

			await store.put({
				...transform(item),
				sync_status: 'synced',
				local_updated_at: new Date().toISOString()
			});
		}
		await tx.done;
	},

	async saveFoldersBulk(folders) {
		await this._saveBulk('folders', folders);
	},

	// Private Helper for Atomic Write + Log
	async _writeWithLog(stores, callback) {
		const db = await initDB();
		const tx = db.transaction(stores, 'readwrite');
		try {
			await callback(tx);
			await tx.done;
		} catch (e) {
			console.error(`[LocalDB] Transaction failed:`, e);
			throw e;
		}
	},

	async saveFolder(folder, action = 'UPDATE') {
		await this._writeWithLog(['folders', 'pending_logs'], async (tx) => {
			await tx.objectStore('folders').put({
				...folder,
				sync_status: 'dirty',
				local_updated_at: new Date().toISOString()
			});

			await tx.objectStore('pending_logs').add({
				action,
				entity: 'folder',
				entity_id: folder.id,
				payload: { name: folder.name },
				created_at: new Date().toISOString()
			});
		});
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
		return userId ? db.getAllFromIndex('notes', 'user_id', userId) : db.getAll('notes');
	},

	async saveNote(note, action = 'UPDATE') {
		await this._writeWithLog(['notes', 'pending_logs'], async (tx) => {
			await tx.objectStore('notes').put({
				...note,
				sync_status: 'dirty',
				local_updated_at: new Date().toISOString()
			});

			await tx.objectStore('pending_logs').add({
				action,
				entity: 'note',
				entity_id: note.id,
				payload: {
					title: note.title,
					content: note.content,
					folder_id: note.folder_id,
					is_pinned: note.is_pinned
				},
				created_at: new Date().toISOString()
			});
		});
	},

	async updateNoteVersion(id, newVersion) {
		const db = await initDB();
		const tx = db.transaction('notes', 'readwrite');
		const store = tx.objectStore('notes');
		const note = await store.get(id);

		if (note) {
			note.version = newVersion;
			// We do NOT change sync_status. 
			// If it was dirty, it remains dirty (re-based on new version)
			// If it was synced, it remains synced (just version bump)
			await store.put(note);
		}

		await tx.done;
	},

	async saveNotesBulk(notes) {
		await this._saveBulk('notes', notes);
	},

	async getPendingLogs() {
		const db = await initDB();
		return db.getAll('pending_logs');
	},

	async removeLog(logId) {
		const db = await initDB();
		await db.delete('pending_logs', logId);
	},

	async removeLogsBulk(logIds) {
		const db = await initDB();
		const tx = db.transaction('pending_logs', 'readwrite');
		const store = tx.objectStore('pending_logs');

		for (const id of logIds) {
			await store.delete(id);
		}

		await tx.done;
	},

	async clearPendingLogs() {
		const db = await initDB();
		const tx = db.transaction('pending_logs', 'readwrite');
		await tx.objectStore('pending_logs').clear();
		await tx.done;
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
		await this._writeWithLog(['notes', 'pending_logs'], async (tx) => {
			await tx.objectStore('notes').delete(id);
			await tx.objectStore('pending_logs').add({
				action: 'DELETE',
				entity: 'note',
				entity_id: id,
				created_at: new Date().toISOString()
			});
		});
	},

	async deleteFolder(id) {
		await this._writeWithLog(['folders', 'pending_logs'], async (tx) => {
			await tx.objectStore('folders').delete(id);
			await tx.objectStore('pending_logs').add({
				action: 'DELETE',
				entity: 'folder',
				entity_id: id,
				created_at: new Date().toISOString()
			});
		});
	},

	async deleteNotesBulk(ids) {
		const db = await initDB();
		const tx = db.transaction(['notes', 'pending_logs'], 'readwrite');
		const notesStore = tx.objectStore('notes');
		const logStore = tx.objectStore('pending_logs');
		const timestamp = new Date().toISOString();

		for (const id of ids) {
			await notesStore.delete(id);
			await logStore.add({
				action: 'DELETE',
				entity: 'note',
				entity_id: id,
				created_at: timestamp
			});
		}

		await tx.done;
	},

	async deleteFolderAndNotes(folderId, noteIds) {
		const db = await initDB();
		const tx = db.transaction(['notes', 'folders', 'pending_logs'], 'readwrite');

		// 1. Delete Notes & Add Logs
		const notesStore = tx.objectStore('notes');
		const logStore = tx.objectStore('pending_logs');

		const timestamp = new Date().toISOString();

		for (const noteId of noteIds) {
			await notesStore.delete(noteId);
			await logStore.add({
				action: 'DELETE',
				entity: 'note',
				entity_id: noteId,
				created_at: timestamp
			});
		}

		// 2. Delete Folder & Add Log
		await tx.objectStore('folders').delete(folderId);
		await logStore.add({
			action: 'DELETE',
			entity: 'folder',
			entity_id: folderId,
			created_at: timestamp
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
