import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.importmania.agenda',
  appName: 'Dommuss Agenda',
  webDir: 'dist',
  server: {
    url: 'https://agenda-tienda.vercel.app',
    cleartext: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,          // lo manejamos manualmente para mostrar UI
      resetWhenUpdate: false,     // NO borrar bundle al actualizar APK nativo
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      appReadyTimeout: 10000,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification_small',
      iconColor: '#FF6B35',
      sound: 'default',
    },
    StatusBar: { style: 'DARK', backgroundColor: '#2D3E50' },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2D3E50',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
