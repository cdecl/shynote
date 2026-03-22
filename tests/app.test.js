import { describe, it, expect, vi } from 'vitest';
import {
	uuidv7,
	normalizeViewMode,
	toggleViewMode,
	fuzzyScore,
	normalizeRecentTabIds,
	upsertRecentTabIds,
	closeRecentTab
} from '../static/app.js';

describe('app.js Utilities', () => {

	describe('uuidv7', () => {
		it('should generate a valid UUID v7 format', () => {
			// Mock crypto.getRandomValues for fixed bytes
			const mockCrypto = {
				getRandomValues: (bytes) => {
					for (let i = 0; i < bytes.length; i++) bytes[i] = i;
					return bytes;
				}
			};
			vi.stubGlobal('crypto', mockCrypto);

			const uuid = uuidv7();
			// Expected pattern: 8-4-4-4-12 hex chars
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

			vi.unstubAllGlobals();
		});

		it('should be time-ordered', () => {
			const uuid1 = uuidv7();
			// Wait a bit to ensure timestamp changes (though granularity is ms)
			const uuid2 = uuidv7();
			expect(uuid1 < uuid2).toBe(true);
		});
	});

	describe('view mode helpers', () => {
		it('normalizeViewMode should coerce legacy values', () => {
			expect(normalizeViewMode('preview')).toBe('view');
			expect(normalizeViewMode('view')).toBe('view');
			expect(normalizeViewMode('edit')).toBe('live');
			expect(normalizeViewMode(undefined)).toBe('live');
		});

		it('toggleViewMode should swap live/view', () => {
			expect(toggleViewMode('live')).toBe('view');
			expect(toggleViewMode('view')).toBe('live');
			expect(toggleViewMode('preview')).toBe('live');
		});
	});

	describe('fuzzyScore', () => {
		it('should return higher score for exact match', () => {
			const score1 = fuzzyScore('apple', 'apple');
			const score2 = fuzzyScore('pineapple', 'apple');
			expect(score1).toBeGreaterThan(score2);
		});

		it('should return 0 for no match', () => {
			const score = fuzzyScore('apple', 'xyz');
			expect(score).toBe(0);
		});

		it('should give bonus for word start matches', () => {
			const score1 = fuzzyScore('hello world', 'world');
			const score2 = fuzzyScore('helloworld', 'world');
			expect(score1).toBeGreaterThan(score2);
		});
	});

	describe('recent tab helpers', () => {
		it('normalizeRecentTabIds should deduplicate and cap length', () => {
			const result = normalizeRecentTabIds(['a', 'b', 'a', 3, '4', '5'], 4);
			expect(result).toEqual(['a', 'b', '3', '4']);
		});

		it('upsertRecentTabIds should move existing id to front', () => {
			const result = upsertRecentTabIds(['1', '2', '3'], '2', 10);
			expect(result).toEqual(['2', '1', '3']);
		});

		it('upsertRecentTabIds should insert new id and respect max count', () => {
			const result = upsertRecentTabIds(['1', '2', '3'], '4', 3);
			expect(result).toEqual(['4', '1', '2']);
		});

		it('closeRecentTab should keep active tab when closing inactive tab', () => {
			const result = closeRecentTab(['a', 'b', 'c'], 'a', 'b');
			expect(result.tabIds).toEqual(['a', 'c']);
			expect(result.activeTabId).toBe('a');
		});

		it('closeRecentTab should select neighbor when closing active tab', () => {
			const result = closeRecentTab(['a', 'b', 'c'], 'b', 'b');
			expect(result.tabIds).toEqual(['a', 'c']);
			expect(result.activeTabId).toBe('c');
		});

		it('closeRecentTab should clear active tab when last tab closes', () => {
			const result = closeRecentTab(['a'], 'a', 'a');
			expect(result.tabIds).toEqual([]);
			expect(result.activeTabId).toBeNull();
		});
	});
});
