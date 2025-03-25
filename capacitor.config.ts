import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuo.dominio.emotify',
  appName: 'Emotify',
  webDir: 'dist/dalai-lama/browser',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorApp: {
      deepLinking: {
        customScheme: 'myapp'
      }
    },
    SplashScreen: {
      launchShowDuration: 3000,       // Durata in ms della splash screen
      launchAutoHide: true,
      backgroundColor: "#ffffffff",     // Colore di background (opzionale)
      androidSplashResourceName: "splash", // Nome della risorsa per Android
      iosSplashResourceName: "Splash",     // Nome della risorsa per iOS (se usi questo)
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
