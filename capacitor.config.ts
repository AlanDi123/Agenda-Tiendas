import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.importmania.agenda',
  appName: 'Dommuss Agenda',
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
    },
    LocalNotifications: {
      smallIcon: 'ic_notification_small',
      iconColor: '#FF6B35',
      sound: 'default',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2D3E50'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2D3E50',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#FF6B35',
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
