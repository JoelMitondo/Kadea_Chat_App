// Bouton clair / sombre (présent dans les layouts app, auth et landing).
// Le thème choisi est gardé dans le navigateur (localStorage) ; il est appliqué avant l'affichage
// de la page par resources/views/partials/head-script.edge.
let bouton = document.getElementById('theme-toggle')

if (bouton !== null) {
  bouton.addEventListener('click', function () {
    let html = document.documentElement
    let nouveauTheme = html.dataset.theme === 'dark' ? 'light' : 'dark'

    html.dataset.theme = nouveauTheme
    try { localStorage.setItem('theme', nouveauTheme) } catch (erreur) {}
  })
}
