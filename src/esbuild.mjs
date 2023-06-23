// Custom build script to get around sharp missing a pure esm build
import * as esbuild from 'esbuild'


await esbuild.build({
    entryPoints: ['extension.ts'],
    bundle: true,
    outfile: '../server/extension.js',
    format: "esm",
    target: "esnext",
    platform: "node",
    banner: {
        js: `import fs from 'fs'`
    },

})
