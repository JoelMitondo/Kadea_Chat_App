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
    router.on('/messages').render('pages/message').as('messages')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/profile', [controllers.Profile, 'show']).as('profile')
    router.post('/profile', [controllers.Profile, 'update']).as('profile.update')
  })
  .use(middleware.auth())
