import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.pomodere.focus',
  appName: 'Pomodere',
  webDir: 'dist',
  backgroundColor: '#f9f8f4',
  loggingBehavior: 'debug',
  zoomEnabled: true,
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    scrollEnabled: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    hostname: 'localhost',
    iosScheme: 'capacitor',
  },
  plugins: {
    Keyboard: { resize: KeyboardResize.Native, style: KeyboardStyle.Light, autoBackdropColor: 'auto' },
    StatusBar: { style: 'LIGHT', overlaysWebView: true },
    LocalNotifications: { presentationOptions: [] },
  },
};

export default config;