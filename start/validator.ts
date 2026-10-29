/*
|--------------------------------------------------------------------------
| Validator file
|--------------------------------------------------------------------------
|
| The validator file is used for configuring global transforms for VineJS.
| The transform below converts all VineJS date outputs from JavaScript
| Date objects to Luxon DateTime instances, so that validated dates are
| ready to use with Lucid models and other parts of the app that expect
| Luxon DateTime.
|
*/

import { DateTime } from 'luxon'
import vine, { SimpleMessagesProvider, VineDate } from '@vinejs/vine'
import { validationFields, validationMessages } from '#validators/messages'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

// Messages d'erreur en français pour TOUS les validateurs (voir app/validators/messages.ts).
// Sans cela, l'utilisateur voit les messages par défaut en anglais de VineJS.
vine.messagesProvider = new SimpleMessagesProvider(validationMessages, validationFields)
