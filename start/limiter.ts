// RÈGLES DE LIMITATION, appliquées aux routes sensibles dans start/routes.ts.
// Au-delà de la limite, la requête est refusée avec le code 429 (« trop de requêtes ») :
// le message français est défini dans app/exceptions/handler.ts.

import limiter from '@adonisjs/limiter/services/main'

// Connexion : 5 essais par minute pour un même e-mail depuis une même adresse IP,
// puis blocage de 5 minutes. Deviner un mot de passe devient beaucoup trop lent.
export const limiteConnexion = limiter.define('connexion', (ctx) => {
  const email = String(ctx.request.input('email', '')).toLowerCase()
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('5 minutes')
    .usingKey(`connexion_${ctx.request.ip()}_${email}`)
})

// Routes qui ENVOIENT un e-mail (inscription, mot de passe oublié) : 5 envois par quart d'heure
// et par adresse IP. Sans cela, un script pourrait épuiser le quota d'e-mails Brevo.
export const limiteEnvoiEmail = limiter.define('envoi_email', (ctx) => {
  return limiter.allowRequests(5).every('15 minutes').usingKey(`email_${ctx.request.ip()}`)
})

// Actions des paramètres qui vérifient le mot de passe actuel (changement, suppression du compte) :
// 5 essais par minute et par compte, puis blocage de 5 minutes.
export const limiteMotDePasseActuel = limiter.define('mot_de_passe_actuel', (ctx) => {
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('5 minutes')
    .usingKey(`mot_de_passe_${ctx.auth.user?.id ?? ctx.request.ip()}`)
})
