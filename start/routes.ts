import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')

router.post('/register', [controllers.Inscriptions, 'store'])
router.get('register', [controllers.Inscriptions, 'show']).as('New_compte.register')

router
  .group(() => {
    router.get('signup/:id/:code', [controllers.NewAccount, 'create'])
    router.post('signup/:id/:code', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])

    router.get('forgoPassword', [controllers.ForgoPasswords, 'index']).as('forgotPassword.get')
    router
      .post('forgoPassword', [controllers.ForgoPasswords, 'storeForgoPassword'])
      .as('forgoPassword.post')
    router.get('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'indexPageNewPassword'])
    router
      .post('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'storeNewPassword'])
      .as('forgot_password.reset')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/profile', [controllers.Profile, 'show']).as('profile')
    router.post('/profile', [controllers.Profile, 'update']).as('profile.update')

    router.get('/messages', [controllers.Conversations, 'index']).as('messages')
    router.get('/conversations/:id', [controllers.Conversations, 'show']).as('conversations.show')
    router
      .delete('/conversations/:id', [controllers.Conversations, 'destroy'])
      .as('conversations.destroy')

    router.post('/conversations/:id/messages', [controllers.Messages, 'store']).as('messages.store')
    router.put('/messages/:id', [controllers.Messages, 'update']).as('messages.update')
    router.delete('/messages/:id', [controllers.Messages, 'destroy']).as('messages.destroy')

    router.get('/users', [controllers.Users, 'index']).as('users')
    router.post('/users/:id/chat', [controllers.Users, 'chat']).as('users.chat')

    router.get('/groups', [controllers.Groups, 'index']).as('groups')
    router.get('/groups/:id', [controllers.Groups, 'show']).as('groups.show')
    router.post('/groups', [controllers.Groups, 'store']).as('groups.store')
    router
      .post('/groups/:id/members', [controllers.Groups, 'addMembers'])
      .as('groups.members.store')
    router
      .post('/groups/:id/messages', [controllers.Messages, 'storeInGroup'])
      .as('groups.messages.store')
  })
  .use(middleware.auth())
