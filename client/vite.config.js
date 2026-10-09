import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'dfpro-offline-shell',
    generateBundle(_, bundle) {
      const assets = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', ...Object.keys(bundle).filter(p=>p.startsWith('assets/')).map(p=>'/'+p)];
      const version = Object.keys(bundle).filter(p=>p.endsWith('.js')).join('|');
      this.emitFile({type:'asset',fileName:'sw.js',source:`
const CACHE='dfpro-shell-'+${JSON.stringify(version)},FILES=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dfpro-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api')||u.pathname.startsWith('/uploads')||u.pathname.startsWith('/public'))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return;}
 if(FILES.includes(u.pathname))e.respondWith(caches.match(e.request).then(saved=>saved||fetch(e.request)));
});`});
    }
  }],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
