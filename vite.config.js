import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	build: {
		lib: {
			entry: path.resolve(__dirname, 'src/vendor.js'),
			name: 'Vendor',
			fileName: 'vendor',
			formats: ['es']
		},
		outDir: 'static/dist',
		emptyOutDir: true
	},
	resolve: {
		alias: {
			vue: 'vue/dist/vue.esm-bundler.js',
		},
	},
	define: {
		'process.env.NODE_ENV': '"production"'
	}
});
