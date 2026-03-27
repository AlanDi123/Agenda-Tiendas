import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.importmania.agenda',
  appName: 'Dommuss Agenda',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: false,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      appReadyTimeout: 30000,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification_small',
      iconColor: '#FF6B35',
      sound: 'default',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2D3E50',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1565C0',
    },
  },
};

export default config;
