import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/shield'
//la protection du site
//csrf: { enabled: true, methods: ['POST','PUT','PATCH','DELETE'] } : tout envoi de données doit porter un jeton secret.
//xFrame: 'DENY' : votre site ne peut pas être affiché dans l’<iframe> d’un autre site (anti-« clickjacking »).
//hsts : le navigateur force le HTTPS.
//contentTypeSniffing : le navigateur doit respecter le type de fichier annoncé.
//csp (Content Security Policy) : liste des sources autorisées. Même si un attaquant réussissait
//à glisser du HTML dans une page, le navigateur refuserait d'exécuter son script.
const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      // Scripts : nos fichiers (Vite) + les scripts en ligne qui portent le nonce de la requête
      scriptSrc: [`'self'`, '@nonce'],
      // Styles : nos fichiers + les attributs style="" (délais d'animation, chargeur)
      styleSrc: [`'self'`, `'unsafe-inline'`],
      // Images : les nôtres, les photos et fichiers sur Cloudinary, le logo hébergé sur i.ibb.co
      imgSrc: [`'self'`, 'data:', 'blob:', 'https://res.cloudinary.com', 'https://i.ibb.co'],
      // fetch et temps réel (Transmit) : uniquement notre serveur.
      // En développement seulement : le rechargement à chaud de Vite (WebSocket sur le port 24678).
      connectSrc: [`'self'`, ...(app.inProduction ? [] : ['ws://localhost:24678'])],
      fontSrc: [`'self'`, 'data:'],
      objectSrc: [`'none'`],
      baseUri: [`'self'`],
      formAction: [`'self'`],
      frameAncestors: [`'none'`],
    },
    reportOnly: false,
  },
  csrf: {
    enabled: true,
    exceptRoutes: [],
    enableXsrfCookie: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
  xFrame: {
    enabled: true,
    action: 'DENY',
  },
  hsts: {
    enabled: true,
    maxAge: '180 days',
  },
  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
