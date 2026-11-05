// LES ROUTES : le "plan" du site.
// Chaque ligne relie une adresse (ex. GET /messages) à une méthode d'un contrôleur.
// Exemple : [controllers.Groups, 'donneGroupe'] = "appelle la méthode donneGroupe de groups_controller.ts".
// - GET sert à afficher, POST à enregistrer, PUT à modifier, DELETE à supprimer.
// - :id dans une adresse est une valeur variable, lue ensuite avec params.id.
// - .as('nom') donne un nom à la route : les vues et les redirections utilisent ce nom plutôt que l'adresse.
// - middleware.guest() : réservé aux visiteurs NON connectés (connexion, inscription...).
// - middleware.auth() : réservé aux personnes connectées, sinon redirection vers /login.

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'

//fausse requete pour laisser le serveur evillé :
router.get('/ping', [controllers.HealthChecks, 'verifieServeur']).as('health_checks.ping')
router.on('/').render('pages/home').as('home')

router
  .post('/register', [controllers.Inscriptions, 'enregistreInscription'])
  .as('inscriptions.store')
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
    router.post('login', [controllers.Session, 'connecte']).as('session.store')

    router
      .get('forgoPassword', [controllers.ForgoPasswords, 'donnePageMotDePasseOublie'])
      .as('forgotPassword.get')
    router
      .post('forgoPassword', [controllers.ForgoPasswords, 'enregistreDemandeReinitialisation'])
      .as('forgoPassword.post')
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

    router.get('/messages', [controllers.Conversations, 'donnePageMessages']).as('messages')
    router
      .get('/conversations/:id', [controllers.Conversations, 'donneConversation'])
      .as('conversations.show')
    router
      .delete('/conversations/:id', [controllers.Conversations, 'supprimeConversation'])
      .as('conversations.destroy')

    router
      .post('/conversations/:id/messages', [controllers.Messages, 'enregistreMessagePrive'])
      .as('messages.store')
    router.put('/messages/:id', [controllers.Messages, 'modifieMessage']).as('messages.update')
    router.delete('/messages/:id', [controllers.Messages, 'supprimeMessage']).as('messages.destroy')

    router.get('/users', [controllers.Users, 'donnePageUtilisateurs']).as('users')
    router.post('/users/:id/chat', [controllers.Users, 'ouvreDiscussion']).as('users.chat')
    router
      .post('/settings/delete-account', [controllers.Settings, 'supprimeCompte'])
      .as('settings.delete')

    router.get('/groups', [controllers.Groups, 'donnePageGroupes']).as('groups')
    router.get('/groups/:id', [controllers.Groups, 'donneGroupe']).as('groups.show')
    router.post('/groups', [controllers.Groups, 'enregistreGroupe']).as('groups.store')
    router
      .post('/groups/:id/members', [controllers.Groups, 'ajouteMembres'])
      .as('groups.members.store')
    router
      .delete('/groups/:id/members/:userId', [controllers.Groups, 'retireMembre'])
      .as('groups.members.destroy')
    router.delete('/groups/:id', [controllers.Groups, 'supprimeGroupe']).as('groups.destroy')
    router
      .post('/groups/:id/messages', [controllers.Messages, 'enregistreMessageGroupe'])
      .as('groups.messages.store')

    router
      .get('/unread-counts', [controllers.Realtime, 'donneCompteursNonLus'])
      .as('realtime.unread')
    router
      .post('/conversations/:id/read', [controllers.Realtime, 'marqueCommeLu'])
      .as('realtime.read')

    router.get('/settings', [controllers.Settings, 'donnePageParametres']).as('settings')
    router
      .post('/settings/password', [controllers.Settings, 'modifieMotDePasse'])
      .as('settings.password')
    router
      .post('/settings/password/forgot', [controllers.Settings, 'demarreChangementMotDePasse'])
      .as('settings.password.forgot')

    router.post('/users/:id/block', [controllers.Blocks, 'bloque']).as('users.block')
    router.post('/users/:id/unblock', [controllers.Blocks, 'debloque']).as('users.unblock')

    router.get('/search', [controllers.Search, 'donnePageRecherche']).as('search')
  })
  .use(middleware.auth())

// Transmit ajoute 3 routes (/__transmit/events, subscribe, unsubscribe).
// Seules les personnes connectées peuvent ouvrir la connexion, s'abonner et se désabonner.
transmit.registerRoutes((route) => {
  route.middleware(middleware.auth())
})
