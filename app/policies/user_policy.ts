import type User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

export default class UserPolicy extends BasePolicy {
  // pour envoyer les données user a la page profile
  show(connected: User, data: User) {
    return connected.id === data.id
  }

  // authorisation pour la modification
  update(connected: User, data: User) {
    return connected.id === data.id
  }
}
