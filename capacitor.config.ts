import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.importmania.agenda',
  appName: 'Dommuss',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // ⚠️ IMPORTANTE: Reemplaza esta URL con la de tu proyecto en Vercel
    url: 'https://TU-URL-DE-VERCEL.vercel.app',
    cleartext: true
  },
  plugins: {
    CapacitorUpdater: {
      autoDeleteBundles: true,
      immediate: true
    }
  }
};

export default config;
