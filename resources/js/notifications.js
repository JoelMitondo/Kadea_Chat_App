//  Mes Notifications

// ----- Apparence de chaque type de notification -----
let STYLES = {
  succes: {
    titre: 'Succès',
    icone: '✓',
    classesIcone: 'bg-success-soft text-success',
    classeBarre: 'bg-success',
    duree: 4500, // en millisecondes
  },
  erreur: {
    titre: 'Erreur',
    icone: '✕',
    classesIcone: 'bg-danger-soft text-danger',
    classeBarre: 'bg-danger',
    duree: 7000, // les erreurs restent plus longtemps
  },
  info: {
    titre: 'Information',
    icone: 'i',
    classesIcone: 'bg-primary-soft text-on-primary-soft',
    classeBarre: 'bg-primary',
    duree: 5000,
  },
}

//  PARTIE 1 : afficher et fermer une notification 

function fermerNotification(toast) {
  // Si la notification est déjà en train de se fermer, on ne fait rien
  if (toast.dataset.ferme === 'oui') { return }
  toast.dataset.ferme = 'oui'

  // 1. On fixe la hauteur actuelle pour pouvoir l'animer vers 0
  toast.style.maxHeight = toast.offsetHeight + 'px'
  toast.getBoundingClientRect() // force le navigateur à enregistrer cette hauteur

  // 2. La notification glisse vers la droite, disparaît et se réduit :
  //    les notifications du dessous remontent en douceur
  toast.style.maxHeight = '0px'
  toast.style.marginBottom = '0px'
  toast.classList.add('opacity-0', 'translate-x-8')

  // 3. Une fois l'animation terminée (300 ms), on supprime l'élément
  setTimeout(function () {
    toast.remove()
  }, 350)
}

function afficherNotification(type, message) {
  let conteneur = document.getElementById('kc-toasts')
  let modele = document.getElementById('kc-toast-modele')

  // Sécurité : si le composant n'est pas dans la page, on affiche une alerte simple
  if (conteneur === null || modele === null) {
    alert(message)
    return
  }

  let style = STYLES[type]

  // On copie le modèle et on remplit les textes
  // (textContent est sûr : il n'interprète jamais de HTML venant du serveur)
  let toast = modele.content.firstElementChild.cloneNode(true)
  let icone = toast.querySelector('[data-toast-icone]')
  let barre = toast.querySelector('[data-toast-barre]')

  icone.textContent = style.icone
  icone.className += ' ' + style.classesIcone
  barre.className += ' ' + style.classeBarre
  toast.querySelector('[data-toast-titre]').textContent = style.titre
  toast.querySelector('[data-toast-message]').textContent = message

  // Les lecteurs d'écran annoncent immédiatement les erreurs
  if (type === 'erreur') {
    toast.setAttribute('role', 'alert')
  }

  // État de départ : invisible et décalée vers la droite
  toast.classList.add('opacity-0', 'translate-x-8')
  conteneur.appendChild(toast)
  toast.getBoundingClientRect() // force le navigateur à dessiner l'état de départ

  // Animation d'entrée : elle glisse vers sa place en apparaissant
  toast.classList.remove('opacity-0', 'translate-x-8')

  // Animation de la barre de temps : elle se vide pendant la durée d'affichage
  barre.style.transition = 'transform ' + style.duree + 'ms linear'
  barre.getBoundingClientRect()
  barre.style.transform = 'scaleX(0)'

  // Fermeture automatique après la durée prévue
  let minuteur = setTimeout(function () {
    fermerNotification(toast)
  }, style.duree)

  // Fermeture avec le bouton ✕
  toast.querySelector('[data-toast-fermer]').addEventListener('click', function () {
    clearTimeout(minuteur)
    fermerNotification(toast)
  })
}

// Fonctions utilisables partout : kcNotifier.succes('...'), kcNotifier.erreur('...'), kcNotifier.info('...')
window.kcNotifier = {
  succes: function (message) { afficherNotification('succes', message) },
  erreur: function (message) { afficherNotification('erreur', message) },
  info: function (message) { afficherNotification('info', message) },
}

//  PARTIE 2 : afficher les messages envoyés par le serveur après une redirection 

document.addEventListener('DOMContentLoaded', function () {
  let messages = document.querySelectorAll('[data-flash]')

  messages.forEach(function (element) {
    afficherNotification(element.dataset.flash, element.dataset.message)
  })
})

//  PARTIE 3 : erreurs sous les champs du formulaire 

function viderLesErreurs(formulaire) {
  // On supprime les anciens messages d'erreur
  formulaire.querySelectorAll('.kc-erreur-champ').forEach(function (message) {
    message.remove()
  })

  // On remet la bordure normale sur les champs qui étaient en erreur
  formulaire.querySelectorAll('[aria-invalid="true"]').forEach(function (champ) {
    champ.classList.remove('border-danger')
    champ.classList.add('border-line-strong')
    champ.removeAttribute('aria-invalid')
  })
}

function afficherErreurSurChamp(formulaire, nomDuChamp, message) {
  let champ = formulaire.querySelector('[name="' + nomDuChamp + '"]')

  // Le serveur parle d'un champ qui n'existe pas dans ce formulaire
  if (champ === null) { return false }

  // Bordure rouge
  champ.classList.remove('border-line-strong')
  champ.classList.add('border-danger')
  champ.setAttribute('aria-invalid', 'true')

  // Message d'erreur sous le champ
  let texte = document.createElement('p')
  texte.className = 'kc-erreur-champ mt-1.5 text-sm text-danger'
  texte.textContent = message
  champ.insertAdjacentElement('afterend', texte)

  // Quand l'utilisateur corrige le champ, l'erreur disparaît
  champ.addEventListener('input', function () {
    texte.remove()
    champ.classList.remove('border-danger')
    champ.classList.add('border-line-strong')
    champ.removeAttribute('aria-invalid')
  }, { once: true })

  return true
}

//  PARTIE 4 : envoi des formulaires sans quitter la page 

// Cherche un message lisible dans la réponse du serveur
function trouverMessage(donnees, messageParDefaut) {
  if (donnees.message) { return donnees.message }

  if (donnees.errors && donnees.errors.length > 0 && donnees.errors[0].message) {
    return donnees.errors[0].message
  }

  return messageParDefaut
}

// Le "true" à la fin = la capture : notre code passe AVANT celui du chargeur,
// ce qui évite d'afficher le chargeur plein écran si on gère déjà l'envoi.
// Ce code gère tous les formulaires qui portent l'attribut data-ajax :
// ils s'envoient sans changer de page, et la réponse du serveur devient une notification.
document.addEventListener('submit', async function (evenement) {
  let formulaire = evenement.target

  // Seuls les formulaires qui portent l'attribut data-ajax sont concernés
  if (!formulaire.hasAttribute('data-ajax')) { return }

  // On empêche le comportement normal (changement de page)
  evenement.preventDefault()

  let bouton = formulaire.querySelector('[type="submit"]')
  let texteDuBouton = bouton.textContent

  // On bloque le bouton pendant l'envoi pour éviter un double clic
  bouton.disabled = true
  bouton.textContent = formulaire.dataset.loadingText || 'Envoi en cours…'
  viderLesErreurs(formulaire)

  try {
    let reponse = await fetch(formulaire.action, {
      method: formulaire.method.toUpperCase(),
      body: new FormData(formulaire),
      headers: { Accept: 'application/json' }, // on demande une réponse JSON, pas une page HTML
    })

    // On lit la réponse JSON (si elle est vide ou invalide, on continue avec un objet vide)
    let donnees = {}
    try {
      donnees = await reponse.json()
    } catch (erreurLecture) {
      donnees = {}
    }

    // ----- Cas 1 : succès -----
    if (reponse.ok) {
      // Priorité : message écrit dans le formulaire (data-success), puis message du serveur
      let messageSucces = formulaire.dataset.success || donnees.message || 'Action réussie.'
      kcNotifier.succes(messageSucces)

      // Le formulaire est vidé, sauf si on ajoute l'attribut data-no-reset
      if (!formulaire.hasAttribute('data-no-reset')) {
        formulaire.reset()
      }

      // Redirection facultative après 1,5 seconde (attribut data-redirect="/login")
      let adresse = formulaire.dataset.redirect
      if (adresse) {
        setTimeout(function () { window.location.href = adresse }, 1500)
      }
      return
    }

    // ----- Cas 2 : erreurs de validation (code 422) -----
    if (reponse.status === 422) {
      let erreursSansChamp = []
      let premierChampEnErreur = null

      let liste = donnees.errors || []
      liste.forEach(function (erreur) {
        let affichee = afficherErreurSurChamp(formulaire, erreur.field, erreur.message)

        if (affichee && premierChampEnErreur === null) {
          premierChampEnErreur = formulaire.querySelector('[name="' + erreur.field + '"]')
        }
        if (!affichee) {
          erreursSansChamp.push(erreur.message)
        }
      })

      if (premierChampEnErreur !== null) { premierChampEnErreur.focus() }

      if (erreursSansChamp.length > 0) {
        kcNotifier.erreur(erreursSansChamp.join(' '))
      } else {
        kcNotifier.erreur('Veuillez corriger les champs signalés en rouge.')
      }
      return
    }

    // ----- Cas 3 : les autres erreurs -----
    if (reponse.status === 419) {
      kcNotifier.erreur('Votre session a expiré. Rechargez la page, puis réessayez.')
    } else if (reponse.status === 429) {
      kcNotifier.erreur('Trop de tentatives. Patientez un instant, puis réessayez.')
    } else if (reponse.status === 401) {
      kcNotifier.erreur(trouverMessage(donnees, 'Votre session a expiré. Veuillez vous reconnecter.'))
      setTimeout(function () { window.location.href = '/login' }, 2000)
    } else if (reponse.status === 403) {
      kcNotifier.erreur(trouverMessage(donnees, "Vous n'avez pas l'autorisation d'effectuer cette action."))
    } else if (reponse.status === 404 || reponse.status === 410) {
      kcNotifier.erreur(trouverMessage(donnees, "Ce lien n'est plus valide ou l'élément demandé a été supprimé."))
    } else if (reponse.status === 413) {
      kcNotifier.erreur(trouverMessage(donnees, 'Le fichier envoyé est trop lourd.'))
    } else if (reponse.status >= 500) {
      kcNotifier.erreur('Une erreur est survenue sur le serveur. Réessayez dans un instant.')
    } else {
      kcNotifier.erreur(trouverMessage(donnees, 'Une erreur est survenue. Veuillez réessayer.'))
    }

  } catch (erreurReseau) {
    // Le serveur n'a pas pu être contacté (pas de connexion, serveur arrêté...)
    kcNotifier.erreur('Impossible de contacter le serveur. Vérifiez votre connexion internet.')

  } finally {
    // Dans tous les cas, on réactive le bouton
    bouton.disabled = false
    bouton.textContent = texteDuBouton
  }
}, true)