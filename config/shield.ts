import { defineConfig } from '@adonisjs/shield'
//la protection du site
//csrf: { enabled: true, methods: ['POST','PUT','PATCH','DELETE'] } : tout envoi de données doit porter un jeton secret.
//xFrame: 'DENY' : votre site ne peut pas être affiché dans l’<iframe> d’un autre site (anti-« clickjacking »).
//hsts : le navigateur force le HTTPS.
//contentTypeSniffing : le navigateur doit respecter le type de fichier annoncé.
const shieldConfig = defineConfig({
  csp: {
    enabled: false,
    directives: {},
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
