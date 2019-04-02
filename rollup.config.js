const minify = require('uglify-es').minify;
const commonjs = require("rollup-plugin-commonjs");
const filesize = require("rollup-plugin-filesize");
const uglify = require("rollup-plugin-uglify");
const typescriptPlugin = require("rollup-plugin-typescript2");

function getConfig(dest, format) {
	return {
		input: "src/index.ts",
		output: {
			file: dest,
			format,
			name: "tChart",
			sourcemap: true
		},
		plugins: [
			typescriptPlugin({
				typescript: require("typescript"),
				tsconfigOverride: { declaration: false }
			}),
			commonjs(),
			uglify({
				warnings: true,
				toplevel: true,
				sourceMap: true,
				mangle: {
					properties: false
				}
			}, minify),
			filesize()
		]
	};
}

module.exports = [
	getConfig("dist/tchart.min.umd.js", "iife", true),
];
