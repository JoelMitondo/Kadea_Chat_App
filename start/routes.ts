// LES ROUTES : le "plan" du site.
// Chaque ligne relie une adresse (ex. GET /messages) à une méthode d'un contrôleur.
// Exemple : [controllers.Groups, 'donneGroupe'] = "appelle la méthode donneGroupe de groups_controller.ts".
// - GET sert à afficher, POST à enregistrer, PUT à modifier, DELETE à supprimer.
// - :id dans une adresse est une valeur variable, lue ensuite avec params.id.
// - .as('nom') donne un nom à la route : les vues et les redirections utilisent ce nom plutôt que l'adresse.
// - middleware.guest() : réservé aux visiteurs NON connectés (connexion, inscription...).
// - middleware.auth() : réservé aux personnes connectées, sinon redirection vers /login.
// - .where('id', ID_NUMERIQUE) : la route ne correspond que si :id est un nombre. Sinon, l'adresse
//   n'existe pas (404) au lieu d'une erreur 500 de PostgreSQL. Les utilisateurs ont un uuid (ID_UUID).
// - .use(limiteConnexion...) : limite le nombre d'essais (voir start/limiter.ts).

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import { limiteConnexion, limiteEnvoiEmail, limiteMotDePasseActuel } from '#start/limiter'

const ID_NUMERIQUE = router.matchers.number()
const ID_UUID = router.matchers.uuid()

//fausse requete pour laisser le serveur evillé :
router.get('/ping', [controllers.HealthChecks, 'verifieServeur']).as('health_checks.ping')
router.on('/').render('pages/home').as('home')

router
  .post('/register', [controllers.Inscriptions, 'enregistreInscription'])
  .as('inscriptions.store')
  .use(limiteEnvoiEmail)
router.get('register', [controllers.Inscriptions, 'donnePageInscription']).as('New_compte.register')

router
  .group(() => {
    router
      .get('signup/:id/:code', [controllers.NewAccount, 'donnePageCreationCompte'])
      .as('new_account.create')
    router
      .post('signup/:id/:code', [controllers.NewAccount, 'enregistreCompte'])
      .as('new_account.store')

    router.get('login', [controllers.Session, 'donnePageConnexion']).as('session.create')
    router.post('login', [controllers.Session, 'connecte']).as('session.store').use(limiteConnexion)

    router
      .get('forgoPassword', [controllers.ForgoPasswords, 'donnePageMotDePasseOublie'])
      .as('forgotPassword.get')
    router
      .post('forgoPassword', [controllers.ForgoPasswords, 'enregistreDemandeReinitialisation'])
      .as('forgoPassword.post')
      .use(limiteEnvoiEmail)
    router
      .get('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'donnePageNouveauMotDePasse'])
      .as('forgo_passwords.index_page_new_password')
    router
      .post('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'enregistreNouveauMotDePasse'])
      .as('forgot_password.reset')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'deconnecte']).as('session.destroy')
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/profile', [controllers.Profile, 'donneProfil']).as('profile')
    router.post('/profile', [controllers.Profile, 'modifieProfil']).as('profile.update')

    // ----- Conversations privées -----
    router.get('/messages', [controllers.Conversations, 'donnePageMessages']).as('messages')
    router
      .get('/conversations/:id', [controllers.Conversations, 'donneConversation'])
      .where('id', ID_NUMERIQUE)
      .as('conversations.show')
    router
      .get('/conversations/:id/messages', [controllers.Conversations, 'donneMessagesPrecedents'])
      .where('id', ID_NUMERIQUE)
      .as('conversations.messages.index')
    router
      .delete('/conversations/:id', [controllers.Conversations, 'supprimeConversation'])
      .where('id', ID_NUMERIQUE)
      .as('conversations.destroy')
    router
      .post('/conversations/:id/messages', [controllers.Messages, 'enregistreMessagePrive'])
      .where('id', ID_NUMERIQUE)
      .as('messages.store')

    // ----- Messages (privés et groupes) -----
    router
      .put('/messages/:id', [controllers.Messages, 'modifieMessage'])
      .where('id', ID_NUMERIQUE)
      .as('messages.update')
    router
      .delete('/messages/:id', [controllers.Messages, 'supprimeMessage'])
      .where('id', ID_NUMERIQUE)
      .as('messages.destroy')

    // ----- Utilisateurs -----
    router.get('/users', [controllers.Users, 'donnePageUtilisateurs']).as('users')
    router
      .post('/users/:id/chat', [controllers.Users, 'ouvreDiscussion'])
      .where('id', ID_UUID)
      .as('users.chat')
    router
      .post('/users/:id/block', [controllers.Blocks, 'bloque'])
      .where('id', ID_UUID)
      .as('users.block')
    router
      .post('/users/:id/unblock', [controllers.Blocks, 'debloque'])
      .where('id', ID_UUID)
      .as('users.unblock')

    // ----- Groupes -----
    router.get('/groups', [controllers.Groups, 'donnePageGroupes']).as('groups')
    router
      .get('/groups/:id', [controllers.Groups, 'donneGroupe'])
      .where('id', ID_NUMERIQUE)
      .as('groups.show')
    router
      .get('/groups/:id/messages', [controllers.Groups, 'donneMessagesPrecedents'])
      .where('id', ID_NUMERIQUE)
      .as('groups.messages.index')
    router.post('/groups', [controllers.Groups, 'enregistreGroupe']).as('groups.store')
    router
      .post('/groups/:id/members', [controllers.Groups, 'ajouteMembres'])
      .where('id', ID_NUMERIQUE)
      .as('groups.members.store')
    router
      .delete('/groups/:id/members/:userId', [controllers.Groups, 'retireMembre'])
      .where('id', ID_NUMERIQUE)
      .where('userId', ID_UUID)
      .as('groups.members.destroy')
    router
      .delete('/groups/:id', [controllers.Groups, 'supprimeGroupe'])
      .where('id', ID_NUMERIQUE)
      .as('groups.destroy')
    router
      .post('/groups/:id/messages', [controllers.Messages, 'enregistreMessageGroupe'])
      .where('id', ID_NUMERIQUE)
      .as('groups.messages.store')

    // ----- Temps réel : compteurs et lecture -----
    router
      .get('/unread-counts', [controllers.Realtime, 'donneCompteursNonLus'])
      .as('realtime.unread')
    router
      .post('/conversations/:id/read', [controllers.Realtime, 'marqueCommeLu'])
      .where('id', ID_NUMERIQUE)
      .as('realtime.read')

    // ----- Paramètres -----
    router.get('/settings', [controllers.Settings, 'donnePageParametres']).as('settings')
    router
      .post('/settings/password', [controllers.Settings, 'modifieMotDePasse'])
      .as('settings.password')
      .use(limiteMotDePasseActuel)
    router
      .post('/settings/password/forgot', [controllers.Settings, 'demarreChangementMotDePasse'])
      .as('settings.password.forgot')
      .use(limiteEnvoiEmail)
    router
      .post('/settings/delete-account', [controllers.Settings, 'supprimeCompte'])
      .as('settings.delete')
      .use(limiteMotDePasseActuel)

    router.get('/search', [controllers.Search, 'donnePageRecherche']).as('search')
  })
  .use(middleware.auth())

// Transmit ajoute 3 routes (/__transmit/events, subscribe, unsubscribe).
// Seules les personnes connectées peuvent ouvrir la connexion, s'abonner et se désabonner.
transmit.registerRoutes((route) => {
  route.middleware(middleware.auth())
})
