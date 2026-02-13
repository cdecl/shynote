import { describe, it, expect, vi } from 'vitest';
import {
	uuidv7,
	parseMarkdownTable,
	generateMarkdownTable,
	formatMarkdownTable,
	findTableBounds,
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

	describe('Table Editor Utilities', () => {
		const sampleTable = `
| Header 1 | Header 2 |
| :--- | :---: |
| Row 1 Col 1 | Row 1 Col 2 |
| Row 2 Col 1 | Row 2 Col 2 |
`.trim();

		it('parseMarkdownTable should parse valid table', () => {
			const parsed = parseMarkdownTable(sampleTable);
			expect(parsed).not.toBeNull();
			expect(parsed.rows.length).toBe(3); // Headers are included in dataRows logic if not specifically filtered?
			// Actually app.js: dataRows = allRows.filter((row, idx) => idx !== separatorRowIndex);
			// In sampleTable: idx 0=Header, 1=Separator, 2=Row1, 3=Row2
			// So dataRows will have [Header, Row1, Row2]
			expect(parsed.rows[0]).toEqual(['Header 1', 'Header 2']);
			expect(parsed.alignments).toEqual(['l', 'c']);
		});

		it('generateMarkdownTable should create markdown string', () => {
			const rows = [['A', 'B'], ['C', 'D']];
			const alignments = ['l', 'r'];
			// This relies on vendor.js markdownTable, which might be hard to test without full environment
			// But let's check if it returns a string with pipes
			const md = generateMarkdownTable(rows, alignments);
			expect(typeof md).toBe('string');
			expect(md).toContain('|');
		});

		it('formatMarkdownTable should align columns correctly', () => {
			const messyTable = `
| Alpha | Beta |
|---|---|
| 1 | 2222 |
| 3333 | 4 |
`.trim();
			const formatted = formatMarkdownTable(messyTable);
			const lines = formatted.split('\n');
			// Check if column widths are consistent (padding added)
			// Alpha (5) vs 3333 (4) -> Alpha + space?
			expect(lines[0]).toContain('Alpha');
			expect(lines[2]).toContain(' 1 ');
			expect(lines[3]).toContain('3333');
		});

		it('formatMarkdownTable should not depend on this binding', () => {
			const input = `
| A | B |
|---|---|
| 1 | 22 |
`.trim();
			const formatted = formatMarkdownTable.call(null, input);
			expect(formatted).toContain('|');
			expect(formatted).toContain('A');
		});

		it('formatMarkdownTable should return input when no table is detected', () => {
			const input = 'no table here';
			const formatted = formatMarkdownTable(input);
			expect(formatted).toBe(input);
		});

		it('parseMarkdownTable should default alignments when separator missing', () => {
			const noSeparator = `
| A | B |
| 1 | 2 |
| 3 | 4 |
`.trim();
			const parsed = parseMarkdownTable(noSeparator);
			expect(parsed).not.toBeNull();
			expect(parsed.alignments).toEqual(['c', 'c']);
		});

		it('formatMarkdownTable should honor forced alignments', () => {
			const table = `
| A | B |
|---|---|
| 1 | 2 |
`.trim();
			const formatted = formatMarkdownTable(table, ['l', 'r']);
			const lines = formatted.split('\n');
			expect(lines[1]).toContain(':');
			expect(lines[1]).toMatch(/:\s*-{2,}\s*\|\s*-{2,}:\s*\|/);
		});

		it('findTableBounds should return null when not in table', () => {
			const text = 'no table here\njust text';
			const doc = {
				toString: () => text,
				lineAt: () => ({ number: 1 }),
				line: (n) => {
					const lines = text.split('\n');
					const from = n === 1 ? 0 : lines[0].length + 1;
					return { from, to: from + lines[n - 1].length };
				}
			};
			const bounds = findTableBounds(doc, 0);
			expect(bounds).toBeNull();
		});

		it('findTableBounds should return bounds for table block', () => {
			const text = [
				'Intro',
				'| A | B |',
				'|---|---|',
				'| 1 | 2 |',
				'Outro'
			].join('\n');
			const lineOffsets = [];
			let offset = 0;
			for (const line of text.split('\n')) {
				lineOffsets.push(offset);
				offset += line.length + 1;
			}
			const doc = {
				toString: () => text,
				lineAt: () => ({ number: 3 }),
				line: (n) => {
					const lines = text.split('\n');
					const from = lineOffsets[n - 1];
					return { from, to: from + lines[n - 1].length };
				}
			};
			const bounds = findTableBounds(doc, lineOffsets[2]);
			expect(bounds).not.toBeNull();
			expect(bounds.text).toContain('| A | B |');
			expect(bounds.text).toContain('| 1 | 2 |');
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
