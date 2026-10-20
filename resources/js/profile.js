// Modale "Modifier le profil"
// L'état (ouverte / fermée) est géré par l'élément <dialog> lui-même : modale.open vaut true ou false.

let modale = document.getElementById('profile-modal')

if (modale !== null) {
  let boutonsOuvrir = document.querySelectorAll('[data-modal-open="profile-modal"]')
  let boutonsFermer = modale.querySelectorAll('[data-modal-close]')
  let formulaire = modale.querySelector('form')

  // Éléments de la photo de profil
  let champPhoto = document.getElementById('avatar')
  let apercu = document.getElementById('avatar-preview')

  const TAILLE_MAX = 5 * 1024 * 1024 // 5 Mo
  const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp']

  function ouvrirModale() {
    modale.showModal()
  }

  // Remet l'aperçu sur la photo actuellement enregistrée
  function restaurerApercu() {
    let photoActuelle = apercu.dataset.current

    if (photoActuelle) {
      apercu.src = photoActuelle
      apercu.classList.remove('hidden')
    } else {
      apercu.removeAttribute('src')
      apercu.classList.add('hidden')
    }
  }

  function fermerModale() {
    // Les modifications non enregistrées sont annulées
    formulaire.reset()
    restaurerApercu()
    modale.close()
  }

  boutonsOuvrir.forEach(function (bouton) {
    bouton.addEventListener('click', ouvrirModale)
  })

  boutonsFermer.forEach(function (bouton) {
    bouton.addEventListener('click', fermerModale)
  })

  // Clic sur le fond sombre (en dehors de la carte) : on ferme
  modale.addEventListener('click', function (evenement) {
    if (evenement.target === modale) {
      fermerModale()
    }
  })

  // Une nouvelle photo est choisie : on la vérifie puis on l'affiche en aperçu
  champPhoto.addEventListener('change', function () {
    let fichier = champPhoto.files[0]

    if (fichier === undefined) {
      restaurerApercu()
      return
    }

    if (TYPES_ACCEPTES.indexOf(fichier.type) === -1) {
      kcNotifier.erreur('Format non accepté. Choisissez une image JPG, PNG ou WebP.')
      champPhoto.value = ''
      restaurerApercu()
      return
    }

    if (fichier.size > TAILLE_MAX) {
      kcNotifier.erreur("L'image est trop lourde : 5 Mo maximum.")
      champPhoto.value = ''
      restaurerApercu()
      return
    }

    apercu.src = URL.createObjectURL(fichier)
    apercu.classList.remove('hidden')
  })
}