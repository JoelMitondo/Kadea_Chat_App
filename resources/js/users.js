// Beaucoup de petites requêtes pendant la frappe : pas de chargeur plein écran
document.body.dataset.loaderFetch = 'off'

let formulaire = document.getElementById('users-search-form')
let champ = document.getElementById('users-search')
let resultats = document.getElementById('users-results')
let modale = document.getElementById('user-modal')

// Recherche en direct

// Technique du "debounce" : à chaque touche, on annule le minuteur et on le relance.
// La recherche ne part que 300 ms après la dernière touche, au lieu d'une requête par lettre.
// numeroRecherche sert à ignorer une ancienne réponse qui arriverait après une plus récente.
let minuteur = null
let numeroRecherche = 0 // sert à ignorer une réponse arrivée en retard

async function rechercher() {
  let texte = champ.value.trim()

  numeroRecherche = numeroRecherche + 1
  let monNumero = numeroRecherche

  let reponse
  try {
    //par x-Requested-With on indique au navigateur qu'il s'agit d'une requete Ajax
    reponse = await fetch('/users?q=' + encodeURIComponent(texte), {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  } catch (erreurReseau) {
    kcNotifier.erreur('Impossible de contacter le serveur. Vérifiez votre connexion.')
    return
  }

  if (!reponse.ok) {
    kcNotifier.erreur('La recherche a échoué. Veuillez réessayer.')
    return
  }

  let html = await reponse.text()

  // Une recherche plus récente a été lancée entre-temps : on ignore cette réponse
  if (monNumero !== numeroRecherche) { return }

  resultats.innerHTML = html

  // L'adresse reflète la recherche (on peut recharger ou partager la page)
  history.replaceState(null, '', texte === '' ? '/users' : '/users?q=' + encodeURIComponent(texte))
}

// On attend 300 ms après la dernière touche pour ne pas envoyer une requête par lettre
champ.addEventListener('input', function () {
  clearTimeout(minuteur)
  minuteur = setTimeout(rechercher, 300)
})

// Touche Entrée : recherche immédiate, sans recharger la page
formulaire.addEventListener('submit', function (evenement) {
  evenement.preventDefault()
  clearTimeout(minuteur)
  rechercher()
})

// Popup Voir plus

let imageAvatar = document.getElementById('user-modal-avatar')

// Si la photo ne se charge pas, on la cache : les initiales restent visibles
imageAvatar.addEventListener('error', function () {
  imageAvatar.classList.add('hidden')
})

function ouvrirDetails(bouton) {
  document.getElementById('user-modal-name').textContent = bouton.dataset.name
  document.getElementById('user-modal-email').textContent = bouton.dataset.email
  document.getElementById('user-modal-created').textContent = bouton.dataset.created
  document.getElementById('user-modal-initials').textContent = bouton.dataset.initials

  // Photo de profil (ou initiales si l'utilisateur n'en a pas)
  if (bouton.dataset.avatar) {
    imageAvatar.src = bouton.dataset.avatar
    imageAvatar.classList.remove('hidden')
  } else {
    imageAvatar.removeAttribute('src')
    imageAvatar.classList.add('hidden')
  }

  // Statut de présence
  let statut = document.getElementById('user-modal-status')
  if (bouton.dataset.online === 'true') {
    statut.textContent = 'En ligne'
    statut.className = 'mt-1 text-sm font-medium text-success'
  } else {
    statut.textContent = 'Hors ligne'
    statut.className = 'mt-1 text-sm text-fg-subtle'
  }

  modale.showModal()
}

// Délégation : fonctionne aussi pour les lignes ajoutées par la recherche
document.addEventListener('click', function (evenement) {
  let boutonDetails = evenement.target.closest('[data-user-details]')
  if (boutonDetails !== null) {
    ouvrirDetails(boutonDetails)
    return
  }

  if (evenement.target.closest('#user-modal [data-modal-close]') !== null) {
    modale.close()
    return
  }

  // Clic sur le fond sombre, en dehors de la carte
  if (evenement.target === modale) {
    modale.close()
  }
})