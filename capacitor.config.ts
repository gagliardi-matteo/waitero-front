import type { CapacitorConfig } from '@capacitor/cli';

const mobileChannel = process.env.WAITERO_MOBILE_CHANNEL === 'dev' ? 'dev' : 'prod';
const isLanMobileBuild = process.env.WAITERO_MOBILE_LAN === 'true';
const isDevMobileBuild = mobileChannel === 'dev';

const config: CapacitorConfig = {
  appId: isDevMobileBuild ? 'com.waitero.app.dev' : 'com.waitero.app',
  appName: isDevMobileBuild ? 'waitero - dev' : 'waitero',
  webDir: 'dist/front/browser',
  bundledWebRuntime: false,
  server: {
    androidScheme: isLanMobileBuild ? 'http' : 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#fbf8f3',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#fbf8f3',
      overlaysWebView: false
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  },
  android: {
    allowMixedContent: isLanMobileBuild,
    captureInput: true
  }
};

export default config;
