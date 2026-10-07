/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

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

    router.get('forgoPassword', [controllers.ForgoPasswords, 'index'])
    router.post('forgoPassword', [controllers.ForgoPasswords, 'storeForgoPassword'])
    router.get('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'indexPageNewPassword'])
    router.post('forgoPassword/:id/:code', [controllers.ForgoPasswords, 'storeNewPasswoed'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.on('/dashboard').render('pages/dashboard').as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
