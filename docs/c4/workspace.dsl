workspace "Kadea Chat" "Messagerie temps réel" {

  model {
    user = person "Utilisateur" "Échange des messages privés et de groupe"

    kadea = softwareSystem "Kadea Chat" "Application de messagerie" {
      browser = container "Interface Web" "Pages Edge + Alpine.js" "HTML/JS" {
        tags "Browser"
      }
      app = container "Application AdonisJS" "Logique métier, auth, temps réel" "Node.js 24 / AdonisJS 7" {
        ctrl = component "Controllers" "Messages, conversations, groupes, profil..." "AdonisJS"
        auth = component "Auth & Policies" "Session, middleware, Bouncer" "AdonisJS"
        svc = component "Services métier" "chat, conversation, block, deletion" "TypeScript"
        rt = component "Realtime Service" "Diffusion des événements" "Transmit (SSE)"
        orm = component "Modèles Lucid" "Accès aux données" "Lucid ORM"
      }
      db = container "Base de données" "Users, messages, conversations" "PostgreSQL" {
        tags "Database"
      }
    }

    cloudinary = softwareSystem "Cloudinary" "Stockage des médias et avatars" {
      tags "External"
    }
    brevo = softwareSystem "Brevo" "Envoi d'emails" {
      tags "External"
    }

    user -> browser "Utilise"
    browser -> ctrl "Envoie des requêtes" "HTTPS"
    rt -> browser "Pousse les nouveaux messages" "SSE (Transmit)"
    ctrl -> auth "Vérifie les droits"
    ctrl -> svc "Délègue la logique"
    svc -> rt "Publie les événements"
    svc -> orm "Lit et écrit"
    orm -> db "Requêtes SQL" "TCP 5432"
    svc -> cloudinary "Envoie les fichiers" "HTTPS"
    app -> brevo "Envoie les emails" "API HTTPS"
  }

  views {
    systemContext kadea "Contexte" {
      include *
      autolayout lr
    }

    container kadea "Conteneurs" {
      include *
      autolayout lr
    }

    component app "Composants" {
      include *
      autolayout lr
    }

    styles {
      element "Person" {
        shape Person
        background #08427b
        color #ffffff
      }
      element "Database" {
        shape Cylinder
      }
      element "Browser" {
        shape WebBrowser
      }
      element "External" {
        background #999999
        color #ffffff
      }
    }
  }
}
