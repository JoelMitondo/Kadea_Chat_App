// ===== Temps réel Kadea Chat =====
//
// Rôle de ce fichier :
//   1. ouvrir la connexion permanente avec le serveur (Transmit) ;
//   2. s'abonner à deux "canaux" : le nôtre (messages, groupes...) et "presence" (qui est en ligne) ;
//   3. réagir à ce que le serveur envoie.
//
// Ce fichier est un "module" (il utilise import) : il passe par Vite.
// Il s'exécute APRÈS les autres scripts de la page, mais avant DOMContentLoaded.

import { Transmit } from '@adonisjs/transmit-client'

// L'identifiant de l'utilisateur est écrit dans la balise <body> par le layout app.edge
const idUtilisateur = document.body.dataset.userId

// Le jeton de sécurité (CSRF) est dans une balise <meta> du layout
const jetonCsrf = document.querySelector('meta[name="csrf-token"]').content

// ===== 1. Connexion au serveur =====

const transmit = new Transmit({
  baseUrl: window.location.origin,

  // Génère l'identifiant de cette connexion. crypto.randomUUID() n'existe pas en http
  // (hors localhost) : sur un téléphone testé via l'adresse IP, on utilise une solution de secours.
  uidGenerator: function () {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID()
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
  },

  // Avant chaque abonnement à un canal, on ajoute le jeton de sécurité (le serveur l'exige pour un POST)
  beforeSubscribe: function (requete) {
    requete.headers.set('X-CSRF-TOKEN', jetonCsrf)
  },

  onSubscribeFailed: function (reponse) {
    console.error("Abonnement au temps réel refusé (code " + reponse.status + ")")
  },
})

// Si la connexion est coupée puis rétablie (réseau coupé, ordinateur en veille...),
// on a pu rater des événements : on prévient les pages pour qu'elles se remettent à jour.
let dejaConnecte = false

transmit.on('connected', function () {
  if (dejaConnecte) {
    document.dispatchEvent(new CustomEvent('kc:reconnecte'))
    programmerRafraichissement()
  }
  dejaConnecte = true
})

// ===== 2. Abonnement aux canaux =====

async function demarrer() {
  // Notre canal personnel. Le nom est "users/" + notre identifiant SANS les tirets
  // (c'est la même règle que côté serveur, dans realtime_service.ts).
  let canalPersonnel = transmit.subscription('users/' + idUtilisateur.replaceAll('-', ''))
  await canalPersonnel.create()
  canalPersonnel.onMessage(traiterEvenement)

  // Le canal de présence, commun à tous
  let canalPresence = transmit.subscription('presence')
  await canalPresence.create()
  canalPresence.onMessage(traiterEvenement)

  // Le canal des stories
  let canalStories = transmit.subscription('stories')
  await canalStories.create()
  canalStories.onMessage(traiterEvenement)
}

demarrer()

// ===== 3. Réaction aux événements du serveur =====

function traiterEvenement(donnees) {
  // Les pages Messages et Groupes (messages.js) écoutent cet événement du navigateur
  document.dispatchEvent(new CustomEvent('kc:evenement', { detail: donnees }))

  if (donnees.type === 'presence') {
    appliquerPresence(donnees.userId, donnees.isOnline)
  }

  if (donnees.type === 'message:new') {
    // Si on regarde déjà cette conversation, la page s'en occupe : pas de notification
    if (!conversationOuverte(donnees.conversationId)) {
      afficherNotification(donnees)
    }
    programmerRafraichissement()
  }

  if (donnees.type === 'message:updated') {
    programmerRafraichissement() // un message supprimé ne compte plus comme non lu
  }

  if (donnees.type === 'conversation:added') {
    kcNotifier.info('Vous avez été ajouté au groupe « ' + donnees.conversationName + ' ».')
  }

    if (donnees.type === 'story:new') {
    // Sur la page Stories, stories.js met la liste à jour tout seul.
    // Ailleurs, on prévient simplement (sauf pour sa propre story).
    let surPageStories = document.getElementById('stories-page') !== null
    if (!surPageStories && donnees.userId !== idUtilisateur) {
      kcNotifier.info(donnees.authorName + ' a ajouté une story.')
    }
  }
    if (donnees.type === 'conversation:removed') {
    // Une conversation ou un groupe vient d'être supprimé : on explique pourquoi
    kcNotifier.info(donnees.message)
    programmerRafraichissement() // les pastilles de messages non lus changent peut-être
  }
}

// La conversation (ou le groupe) est-elle ouverte à l'écran en ce moment ?
function conversationOuverte(idConversation) {
  let page = document.getElementById('messages-page')
  return page !== null && page.dataset.activeId === String(idConversation)
}

// Petite fenêtre en haut de l'écran (les "toasts" de notifications.js)
function afficherNotification(donnees) {
  if (donnees.kind === 'group') {
    kcNotifier.info(donnees.conversationName + ' — ' + donnees.preview)
  } else {
    kcNotifier.info(donnees.senderName + ' : ' + donnees.preview)
  }
}

// ===== 4. Statut en ligne / hors ligne =====
// Dans le HTML, tout ce qui concerne la présence d'un utilisateur porte son identifiant :
//   data-presence-user="..."  → les avatars (puce verte ou grise) et les boutons
//   data-presence-label="..." → les textes "En ligne" / "Hors ligne"

function appliquerPresence(idPersonne, enLigne) {
  // Les avatars
  let elements = document.querySelectorAll('[data-presence-user="' + idPersonne + '"]')

  elements.forEach(function (element) {
    element.dataset.online = enLigne ? 'true' : 'false'

    let puceEnLigne = element.querySelector('[data-presence-online]')
    let puceHorsLigne = element.querySelector('[data-presence-offline]')

    if (puceEnLigne !== null) {
      puceEnLigne.classList.toggle('hidden', !enLigne)
    }
    if (puceHorsLigne !== null) {
      // La puce grise n'existe que pour les avatars qui ont demandé "showOffline"
      let afficherGrise = !enLigne && element.dataset.showOffline === 'true'
      puceHorsLigne.classList.toggle('hidden', !afficherGrise)
    }
  })

  // Les textes "En ligne" / "Hors ligne"
  let libelles = document.querySelectorAll('[data-presence-label="' + idPersonne + '"]')

  libelles.forEach(function (libelle) {
    let texte = libelle.querySelector('[data-presence-text]')
    let puceClignotante = libelle.querySelector('[data-presence-pulse]')

    if (texte !== null) {
      texte.textContent = enLigne ? 'En ligne' : 'Hors ligne'
    }
    if (puceClignotante !== null) {
      puceClignotante.classList.toggle('hidden', !enLigne)
    }
    libelle.classList.toggle('font-medium', enLigne)
    libelle.classList.toggle('text-success', enLigne)
    libelle.classList.toggle('text-fg-subtle', !enLigne)
  })
}

// ===== 5. Pastilles de messages non lus (barre de navigation) =====

let minuteurRafraichissement = null

// On demande les vrais chiffres au serveur. Le minuteur regroupe plusieurs demandes proches
// (si 5 messages arrivent d'un coup, on ne fait qu'une seule requête).
function programmerRafraichissement() {
  clearTimeout(minuteurRafraichissement)
  minuteurRafraichissement = setTimeout(rafraichirCompteurs, 300)
}

async function rafraichirCompteurs() {
  try {
    // noLoader : pas de chargeur plein écran pour cette petite requête (voir loader.js)
    let reponse = await fetch('/unread-counts', {
      noLoader: true,
      headers: { Accept: 'application/json' },
    })
    if (!reponse.ok) { return }

    let compteurs = await reponse.json()
    afficherPastille('private', compteurs.private)
    afficherPastille('group', compteurs.group)
  } catch (erreurReseau) {
    // Pas de connexion : on réessaiera au prochain événement
  }
}

function afficherPastille(type, nombre) {
  document.querySelectorAll('[data-nav-badge="' + type + '"]').forEach(function (pastille) {
    pastille.textContent = nombre > 99 ? '99+' : String(nombre)
    pastille.classList.toggle('hidden', nombre === 0)
  })
}

// Les pages (messages.js) demandent un rafraîchissement après avoir lu des messages
document.addEventListener('kc:rafraichir-compteurs', programmerRafraichissement)

// Au chargement de chaque page
programmerRafraichissement()