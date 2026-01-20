import * as Vue from 'vue';
import { openDB } from 'idb';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import jsyaml from 'js-yaml';
import sha256 from 'crypto-js/sha256';
import { markdownTable } from 'markdown-table';

import * as CodeMirror from './codemirror-deps.js';

export {
	Vue,
	openDB,
	marked,
	hljs,
	mermaid,
	polyfill,
	scrollBehaviourDragImageTranslateOverride,
	jsyaml,
	sha256,
	markdownTable,
	CodeMirror
};
