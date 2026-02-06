# Document technique — Tournées (Validation + Toast + Suivi)

## 1. Objectif

Mettre en place :

- Une **validation obligatoire** empêchant la clôture/validation d’une tournée si le chauffeur n’a pas sélectionné **toutes** les expéditions/commandes de la tournée.
- Un affichage **non bloquant** via **toast** (au lieu de `alert()` navigateur).
- Une amélioration de lisibilité de l’écran **Suivi des tournées**.
- Simplification des actions : utilisation de **Signature (POD)** uniquement (suppression de l’action/bouton Scanner sur le suivi).

## 2. Périmètre fonctionnel

### 2.1 Validation de tournée (écran Tournées)

- Page : `/regions-planning`
- Règle : lors de l’action **Valider tournée**
  - Si aucune commande n’est sélectionnée ou chauffeur/camion manquants : avertissement via toast.
  - Si **toutes** les commandes de la tournée ne sont pas sélectionnées : **blocage** + toast d’erreur.

### 2.2 Suivi des tournées (écran Suivi)

- Page : `/suivi-tournees`
- Amélioration UI : meilleure lisibilité des infos chauffeur/camion, badges, et lignes expédition.
- Action : **Scanner supprimé** sur le suivi.
- Action : **Signature (POD)** conservée, activable uniquement si statut = `Livré`.

## 3. Implémentation technique

## 3.1 Système de toast (sans dépendance)

### Fichier ajouté

- `app/components/ToastProvider.tsx`

### Responsabilités

- Fournit un `ToastProvider` (context) pour stocker les toasts.
- Fournit un hook `useToast()` :
  - `toast.error(message)`
  - `toast.warning(message)`
  - `toast.success(message)`
  - `toast.info(message)`
- Fournit `ToastViewport` pour afficher les notifications.

### Comportement

- Les toasts sont empilés en haut à droite.
- Durée par défaut : ~3.5s.
- Clique sur le toast = fermeture.
- Max affiché simultanément : 4 (les plus récents).

## 3.2 Injection globale du toaster

### Fichier modifié

- `app/layout.tsx`

### Changement

- L’application (hors page login `/`) est enveloppée dans :
  - `<ToastProvider>`
  - `<ToastViewport />`

## 3.3 Validation « sélectionner toutes les expéditions »

### Fichier modifié

- `app/regions-planning/page.tsx`

### Emplacement

- Fonction `validateTour(city, list)`

### Logique

- Construction de `selectedOrders` depuis `t.selectedOrders`.
- Vérifications :

1) **Pré-requis**

- `selectedOrders.length === 0` ou chauffeur/camion vide
- Action : `toast.warning(...)` puis `return`

2) **Sélection complète obligatoire**

- Si `selectedOrders.length !== list.length`
- Action : `toast.error('Veuillez sélectionner toutes les expéditions...')` puis `return`

3) Sinon : poursuite de la clôture (planning mock + persistance + navigation vers `/suivi-tournees`).

## 3.4 Améliorations UI — Suivi des tournées

### Fichier modifié

- `app/suivi-tournees/SuiviTourneesComponent.tsx`

### Améliorations principales

- **Header carte tournée**
  - Affichage chauffeur/camion en grille (labels alignés)
  - Badge `Occupé` si le nom chauffeur contient `occupé/occupée`
  - Nettoyage du texte chauffeur (suppression du `(occupé)` du texte principal)

- **Lignes expédition**
  - Mise en page en grille : infos à gauche / actions à droite
  - Badges (ETA, statut, POD/retours manquants) groupés
  - Actions :
    - Select `statut` (non démarré / en cours / livré)
    - Bouton `Signature` (désactivé si statut != `Livré`)

### Suppression Scanner

- Le bouton `Scanner` a été retiré des lignes expédition.
- La fonction `openScanner(...)` a été supprimée car devenue inutilisée.

## 4. Fichiers impactés (récap)

- **Ajout**
  - `app/components/ToastProvider.tsx`

- **Modifiés**
  - `app/layout.tsx`
  - `app/regions-planning/page.tsx`
  - `app/suivi-tournees/SuiviTourneesComponent.tsx`

## 5. Points d’attention / limites

- Le toast ajouté est un composant interne simple (pas de dépendance externe). Si vous souhaitez des toasts plus avancés (actions, multi-lignes, icônes, etc.), prévoir une lib type `sonner`/`react-hot-toast`.
- La règle « sélection complète » est appliquée sur `/regions-planning`. Si une validation de tournée existe sur d’autres écrans, elle devra être harmonisée (non détectée dans ce scope).

## 6. Tests manuels recommandés

### 6.1 Regions planning

- Cas 1 : sélectionner 0 commande + cliquer `Valider tournée`
  - Attendu : toast warning, pas de validation.

- Cas 2 : sélectionner N-1 commandes sur N + cliquer `Valider tournée`
  - Attendu : toast error « sélectionner toutes les expéditions... », pas de validation.

- Cas 3 : sélectionner N/N + chauffeur + camion + cliquer `Valider tournée`
  - Attendu : validation OK + redirection vers `/suivi-tournees`.

### 6.2 Suivi tournées

- Vérifier lisibilité header + badges.
- Vérifier que `Scanner` n’apparaît plus.
- Vérifier que `Signature` n’est cliquable que si statut = `Livré`.

---

Fin du document.
