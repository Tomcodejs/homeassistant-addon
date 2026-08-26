# House Comms — messagerie intégrée à Home Assistant

Messagerie auto-hébergée qui s'affiche directement dans un dashboard Home
Assistant, utilise les **vrais comptes HA** (nom + statut administrateur en
temps réel), et ajoute un mode maintenance pour la messagerie elle-même.

Ce que HA gère déjà nativement (rien à faire) :
- Activer/désactiver le rôle Administrateur d'un utilisateur
- Désactiver complètement un compte (l'empêche de se connecter à HA)
→ Réglages → Personnes → Utilisateurs.

Ce que ce projet ajoute :
- Un fil de discussion partagé, visible dans un dashboard HA
- Un mode "maintenance" pour la messagerie (bloque l'envoi pour tout le
  monde sauf les admins), activable par un admin HA
- Un "accès révoqué" local à la messagerie uniquement (sans toucher au
  compte HA), utile si tu veux couper juste le chat sans désactiver
  tout le compte de la personne

## 0. Si tu es sur Home Assistant OS : installe-le comme un vrai Add-on

Pas besoin de Docker Compose séparé. Une fois le repo publié sur GitHub
(voir section "Publier sur GitHub" plus bas) :

1. Dans HA : **Réglages → Modules complémentaires → Boutique**
2. Menu **⋮** (en haut à droite) → **Dépôts**
3. Colle l'URL de ton repo GitHub, ex. `https://github.com/Tomcodejs/homeassitanr-addon`
   → **Ajouter**
4. Un nouvel add-on **"House Comms"** apparaît dans la boutique (parfois
   après un rafraîchissement de la page). Clique dessus → **Installer**.
5. Une fois installé, clique **Démarrer**, active si tu veux **"Démarrer
   au lancement"**.
6. L'add-on tourne maintenant sur `http://homeassistant.local:8091`
   (même machine que HA, donc pas besoin d'IP séparée).
7. Passe directement à l'étape 6 de la section suivante (copier la carte
   Lovelace) — tu peux ignorer tout ce qui concerne Docker Compose.

Le stockage des messages est automatiquement persistant : le Supervisor
gère le dossier `/data` de l'add-on tout seul, pas de volume à configurer.

⚠️ Le fichier `repository.yaml` et le dossier `house_comms_addon/`
doivent rester à la racine du repo GitHub pour que HA les détecte — ne
les déplace pas.

## 1. Lancer le serveur (Docker, si tu n'es PAS sur Home Assistant OS)

Sur la machine qui héberge Home Assistant (ou une machine du même réseau) :

```bash
cd house-comms
docker compose up -d --build
```

Le serveur écoute sur le port `8091`. Vérifie qu'il tourne :

```bash
curl http://localhost:8091/health
# {"ok":true}
```

Les données (messages, statut maintenance, accès révoqués) sont stockées
dans `./data/house-comms.json` sur l'hôte — persistant entre redémarrages.

Une fois que tu connais l'URL de ton HA (ex. `http://homeassistant.local:8123`),
édite `docker-compose.yml` et remplace `ALLOWED_ORIGIN=*` par cette URL exacte,
puis `docker compose up -d --build` à nouveau. Ça évite que n'importe quel
site web puisse appeler ton serveur de messagerie.

## 2. Ajouter la carte à Home Assistant

1. Copie `www/house-comms-card.js` dans le dossier `config/www/` de ton
   installation HA (via l'add-on File editor, Samba, ou SCP).
2. Réglages → Tableaux de bord → menu ⋮ (en haut à droite) → Ressources
   → Ajouter une ressource :
   - URL : `/local/house-comms-card.js`
   - Type : Module JavaScript
3. Édite un dashboard, ajoute une carte manuelle (YAML) :

```yaml
type: custom:house-comms-card
api_url: http://<ip-ou-nom-de-ta-machine-docker>:8091
```

Remplace `api_url` par l'adresse réelle où tourne le conteneur (ex.
`http://homeassistant.local:8091` si Docker tourne sur la même machine que HA).

## 3. Utilisation

- N'importe quel utilisateur HA connecté peut écrire dans le fil.
- Si `hass.user.is_admin` est vrai (compte Administrateur dans HA), un
  bouton **Admin** apparaît sur la carte, donnant accès à :
  - Activer/désactiver le mode maintenance (avec motif optionnel)
  - Révoquer/réactiver l'accès au chat pour un utilisateur HA précis
    (sans toucher à son compte HA global)

## Publier sur GitHub (recommandé)

Ça te permet de faire `git pull` pour mettre à jour au lieu de recopier des
fichiers, et de laisser GitHub Actions construire l'image Docker à ta place.

1. Crée un dépôt vide sur github.com (ne coche ni README ni .gitignore).
2. **Important** : remplace `OWNER` par ton pseudo GitHub dans ces 3 fichiers
   avant de commit : `repository.yaml`, `house_comms_addon/config.yaml`,
   `docker-compose.image.yml`.
2. Sur ta machine, dans le dossier `house-comms/` :
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<ton-user>/house-comms.git
git push -u origin main
```
3. Le workflow `.github/workflows/docker-publish.yml` se déclenche
   automatiquement et construit une image, publiée sur
   `ghcr.io/<ton-user>/house-comms`. Vérifie l'onglet **Actions** du repo
   pour voir si le build passe (première fois : peut prendre 1-2 min).
4. Sur la machine qui doit héberger le service, au lieu de `docker-compose.yml`,
   utilise `docker-compose.image.yml` (remplace `OWNER` par ton
   pseudo GitHub dedans), puis :
```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```
Plus besoin de compiler quoi que ce soit sur la machine cible — elle
télécharge juste l'image déjà construite.

**Pour mettre à jour plus tard** (après avoir modifié le code et fait `git push`) :
```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Si tu préfères rester en local sans GitHub, `docker-compose.yml`
(le fichier avec `build: ./server`) continue de fonctionner tel quel —
les deux options coexistent dans le projet.

## Sécurité — à lire avant d'exposer ça sur Internet

Ce serveur fait confiance aux informations envoyées par la carte
(nom, id utilisateur, statut admin). C'est raisonnable **sur un réseau
local fermé** derrière ton HA, mais si tu exposes ton HA sur Internet
(Nabu Casa, reverse proxy, etc.), n'expose **pas** le port 8091
publiquement — garde-le accessible uniquement en local, ou ajoute une
authentification par jeton entre la carte et le serveur avant d'aller
plus loin. Dis-moi si tu veux cette version renforcée, je peux l'ajouter.
