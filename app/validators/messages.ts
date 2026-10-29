/*
|--------------------------------------------------------------------------
| Messages d'erreur de validation en français
|--------------------------------------------------------------------------
|
| Sans ce fichier, VineJS et AdonisJS renvoient leurs messages par défaut en anglais
| ("The email field must be a valid email address"...), affichés tels quels à l'utilisateur.
| Ils sont branchés pour TOUS les validateurs dans start/validator.ts.
|
| {{ field }} est remplacé par le nom du champ (voir "fields" plus bas).
*/

// Messages par règle (et parfois par champ : "champ.règle" est prioritaire sur "règle")
export const validationMessages: Record<string, string> = {
  // ----- Règles générales -----
  'required': '{{ field }} est obligatoire.',
  'string': '{{ field }} doit être un texte.',
  'email': "{{ field }} n'est pas valide (exemple : nom@exemple.com).",
  'regex': "{{ field }} n'a pas un format valide.",
  'url': '{{ field }} doit être un lien valide commençant par http:// ou https://.',
  'minLength': '{{ field }} doit contenir au moins {{ min }} caractères.',
  'maxLength': '{{ field }} ne doit pas dépasser {{ max }} caractères.',
  'fixedLength': '{{ field }} doit contenir exactement {{ size }} caractères.',
  'confirmed': 'Les deux valeurs saisies ne correspondent pas.',
  'sameAs': 'Les deux valeurs saisies ne correspondent pas.',
  'notSameAs': 'Les deux valeurs doivent être différentes.',
  'uuid': "{{ field }} n'est pas un identifiant valide.",
  'in': "La valeur choisie pour {{ field }} n'est pas valide.",
  'enum': "La valeur choisie pour {{ field }} n'est pas valide.",
  'boolean': '{{ field }} doit valoir oui ou non.',
  'accepted': '{{ field }} doit être accepté.',

  // ----- Nombres -----
  'number': '{{ field }} doit être un nombre.',
  'min': '{{ field }} doit être au moins égal à {{ min }}.',
  'max': '{{ field }} ne doit pas dépasser {{ max }}.',
  'range': '{{ field }} doit être compris entre {{ min }} et {{ max }}.',
  'withoutDecimals': '{{ field }} doit être un nombre entier.',

  // ----- Listes -----
  'array': '{{ field }} doit être une liste.',
  'array.minLength': 'Sélectionnez au moins {{ min }} élément(s) pour {{ field }}.',
  'array.maxLength':
    'Vous ne pouvez pas sélectionner plus de {{ max }} élément(s) pour {{ field }}.',
  'distinct': '{{ field }} contient des doublons.',
  'notEmpty': '{{ field }} ne doit pas être vide.',

  // ----- Dates -----
  'date': "{{ field }} n'est pas une date valide.",
  'date.before': '{{ field }} doit être antérieure au {{ expectedValue }}.',
  'date.beforeOrEqual': '{{ field }} ne peut pas être dans le futur.',
  'date.after': '{{ field }} doit être postérieure au {{ expectedValue }}.',
  'date.afterOrEqual': '{{ field }} doit être postérieure ou égale au {{ expectedValue }}.',

  // ----- Fichiers envoyés (règle vine.file d'AdonisJS) -----
  'file': '{{ field }} doit être un fichier.',
  'file.size': 'Le fichier est trop lourd : {{ size }} maximum.',
  'file.extname': "Ce type de fichier n'est pas accepté. Formats autorisés : {{ extnames }}.",
  'file.fatal': "Le fichier n'a pas pu être lu. Réessayez avec un autre fichier.",

  // ----- Base de données (règles unique / exists de Lucid) -----
  'database.unique': '{{ field }} est déjà utilisé(e).',
  'database.exists': "{{ field }} n'existe pas.",

  // ----- Messages plus précis pour certains champs -----
  'email.database.unique':
    'Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».',
  'email_confirmation.sameAs': 'Les deux adresses e-mail ne correspondent pas.',
  'password.confirmed': 'Les deux mots de passe ne correspondent pas.',
  'birth_date.date.beforeOrEqual': 'La date de naissance ne peut pas être dans le futur.',
  'phone_number.regex':
    'Le numéro de téléphone doit contenir 8 à 20 chiffres (espaces, tirets et « + » autorisés).',
  'member_ids.array.minLength': 'Sélectionnez au moins {{ min }} membre(s).',
}

// Nom lisible de chaque champ, utilisé à la place de {{ field }}
export const validationFields: Record<string, string> = {
  first_name: 'Le prénom',
  last_name: 'Le nom',
  full_name: 'Le nom complet',
  email: "L'adresse e-mail",
  email_confirmation: "La confirmation de l'adresse e-mail",
  password: 'Le mot de passe',
  password_confirmation: 'La confirmation du mot de passe',
  birth_date: 'La date de naissance',
  phone_number: 'Le numéro de téléphone',
  avatar: 'La photo de profil',
  avatar_url: 'Le lien de la photo de profil',
  bio: 'La bio',
  content: 'Le message',
  attachment: 'Le fichier joint',
  image: "L'image",
  caption: 'La légende',
  name: 'Le nom du groupe',
  member_ids: 'Les membres',
  q: 'La recherche',
  page: 'Le numéro de page',
  id: "L'identifiant",
}
