import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.importmania.agenda',
  appName: 'Dommuss',
  webDir: 'dist',
  server: {
    // URL de producción en Vercel
    url: 'https://agenda-tienda.vercel.app',
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
