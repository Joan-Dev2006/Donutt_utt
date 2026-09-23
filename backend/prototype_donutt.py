import json

def calculer_niveau_risque(valeur, cible, type_indicateur, id_ind):
    """
    Calcule l'écart relatif et attribue un palier de risque (1 à 5).
    """
    # 1. Gestion de la division par zéro (Qualité de l'air)
    if cible == 0:
        if valeur <= 0:
            return 1, 0.0
        else:
            ecart_pct = 100.0 if valeur > 10 else 50.0 
    else:
        # 2. Logique Overshoot (Plafond) vs Shortfall (Plancher)
        # Exception pour la Biodiversité (Indice positif : être sous la cible est mauvais)
        if type_indicateur == "Ecologique" and id_ind != "BIO_01":
            ecart_pct = ((valeur - cible) / cible) * 100
        else:
            # S'applique au Social et à la Biodiversité (Manque)
            ecart_pct = ((cible - valeur) / cible) * 100

    # 3. Attribution du palier de risque (Modèle UTT)
    if ecart_pct <= 0:
        return 1, round(ecart_pct, 1)  # Espace sûr
    elif 0 < ecart_pct <= 20:
        return 2, round(ecart_pct, 1)  # Proche de la cible
    elif 20 < ecart_pct <= 50:
        return 3, round(ecart_pct, 1)  # Risque modéré
    elif 50 < ecart_pct <= 100:
        return 4, round(ecart_pct, 1)  # Risque élevé
    else:
        return 5, round(ecart_pct, 1)  # Risque critique


# Données basées sur les rapports de Maël Jambou et Matéo Lemonnier
donnees_brutes = [
    # --- PLAFOND ÉCOLOGIQUE ---
    {"id": "GES_01", "type": "Ecologique", "dimension": "Changement climatique", "valeur": 1.4, "cible": 0.4, "unite": "tCO2eq/usager/an"},
    {"id": "AIR_01", "type": "Ecologique", "dimension": "Qualité de l'air", "valeur": 67, "cible": 0, "unite": "jours dégradés"},
    {"id": "SOL_01", "type": "Ecologique", "dimension": "Usage des sols", "valeur": 54, "cible": 20, "unite": "% artificialisation"},
    {"id": "BIO_01", "type": "Ecologique", "dimension": "Perte de biodiversité", "valeur": 2.5, "cible": 3.0, "unite": "IBC / 5"},
    {"id": "EAU_01", "type": "Ecologique", "dimension": "Eau douce", "valeur": 6000, "cible": 10000, "unite": "m3/an"},
    
    # --- PLANCHER SOCIAL ---
    {"id": "SAN_01", "type": "Social", "dimension": "Santé humaine", "valeur": 2.8, "cible": 3.0, "unite": "score / 5"},
    {"id": "COH_01", "type": "Social", "dimension": "Cohésion sociale", "valeur": 3.3, "cible": 3.0, "unite": "score / 5"},
    {"id": "JUS_01", "type": "Social", "dimension": "Justice sociale", "valeur": 3.2, "cible": 3.0, "unite": "score / 5"},
    {"id": "TRA_01", "type": "Social", "dimension": "Conditions de travail et d'études", "valeur": 3.4, "cible": 3.0, "unite": "score / 5"}
]

# Dictionnaire formaté pour le contrat D3.js
donnees_traitees = {
    "etablissement": "UTT",
    "annee": 2026,
    "indicateurs": []
}

for item in donnees_brutes:
    niveau, delta = calculer_niveau_risque(item["valeur"], item["cible"], item["type"], item["id"])
    
    indicateur_traite = {
        "id": item["id"],
        "dimension": item["dimension"],
        "type": item["type"],
        "valeur_mesure": item["valeur"],
        "unite": item["unite"],
        "seuil_reference": item["cible"],
        "niveau_risque": niveau,
        "ecart_relatif_pct": delta
    }
    donnees_traitees["indicateurs"].append(indicateur_traite)

# Exportation JSON
with open("data/donutt_prototype.json", "w", encoding="utf-8") as f:
    json.dump(donnees_traitees, f, indent=4, ensure_ascii=False)

print("Traitement terminé ! Le fichier 'donutt_prototype.json' a été mis à jour.")
for ind in donnees_traitees["indicateurs"]:
    print(f"- {ind['dimension']} : Écart de {ind['ecart_relatif_pct']}% -> Risque {ind['niveau_risque']}")