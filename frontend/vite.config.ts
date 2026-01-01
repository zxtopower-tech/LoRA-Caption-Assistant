import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Expose the API_KEY from the environment to the client-side code.
      // Using JSON.stringify ensures it's a valid string token or undefined.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.PROFILE_API_URL': JSON.stringify(env.PROFILE_API_URL),
      'process.env.PROFILE_API_TOKEN': JSON.stringify(env.PROFILE_API_TOKEN),
    },
    server: {
      port: 7860,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true
        },
        '/static': {
          target: 'http://localhost:8001',
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 7860,
      host: true,
      allowedHosts: true // Allow all hosts for Hugging Face proxy
    }
  };
});
