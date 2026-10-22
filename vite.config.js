import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the same build run from GitHub Pages, a sub-path, or file:// inside Electron
export default defineConfig({ base: './', plugins: [react()] })
