let modale = document.getElementById('profile-modal')

if (modale !== null) {
  let boutonsOuvrir = document.querySelectorAll('[data-modal-open="profile-modal"]')
  let boutonsFermer = modale.querySelectorAll('[data-modal-close]')
  let formulaire = modale.querySelector('form')

  function ouvrirModale() {
    modale.showModal()
  }

  function fermerModale() {
    // On remet les champs comme à l'ouverture : les modifications non enregistrées sont annulées
    formulaire.reset()
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
}