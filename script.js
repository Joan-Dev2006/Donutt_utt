// =========================================================================
// 1. ARCHITECTURE DES DONNÉES ET MOTEUR DE CALCUL (Agnostique)
// Ce script utilise la constante BASE_REFERENCE chargée via index.html
// =========================================================================

class SystemeSocioTechnique {
    constructor(nom) {
        this.nom = nom;
        this.modeleRaworth = { plafondEcologique: [], plancherSocial: [] };
    }
}

// Dictionnaire de traduction Anglais -> Français pour les indicateurs
const TRADUCTIONS = {
    // Écologique
    "CO2 Emissions": "Émissions CO2",
    "Phosphorus": "Phosphore",
    "Nitrogen": "Azote",
    "Blue Water": "Conso. Eau",
    "eHANPP": "Usage des Sols",
    "Ecological Footprint": "Empreinte Éco.",
    "Material Footprint": "Empreinte Mat.",
    // Social
    "Life Satisfaction": "Satisfaction Vie",
    "Healthy Life Expect.": "Espérance Vie",
    "Nutrition": "Nutrition",
    "Sanitation": "Assainissement",
    "Income": "Revenu",
    "Access to Energy": "Accès Énergie",
    "Education": "Éducation",
    "Social Support": "Lien Social",
    "Democratic Quality": "Qualité Démoc.",
    "Equality": "Égalité",
    "Employment": "Emploi"
};

// Fonction utilitaire pour traduire (et raccourcir si besoin pour le graphe)
function traduire(texteAnglais) {
    return TRADUCTIONS[texteAnglais] || texteAnglais;
}


let systemeA = null;
let systemeB = null;

// Moteur d'Analyse (Traduction mathématique de l'article)
function analyserCycleDeVie(dataCSV, systemName) {
    
    // Vérification de sécurité : la base est-elle bien chargée par le HTML ?
    if (typeof BASE_REFERENCE === 'undefined') {
        alert("Erreur critique : La base de données de référence est introuvable. Avez-vous bien inclus base_reference.js dans index.html ?");
        return null;
    }

    let systeme = new SystemeSocioTechnique(systemName);
    const seuilsEco = BASE_REFERENCE.SEUILS_ECO_PER_CAPITA;
    const bddPays = BASE_REFERENCE.BDD_PAYS;
    
    // 1. Calcul du total des Equivalent Persons
    let sumNbEqPers = 0;
    dataCSV.forEach(row => { sumNbEqPers += parseFloat(row.per_eq); });

    // 2. Calcul du Plafond Écologique (Overshoot)
    for (let indicateur in seuilsEco) {
        let impactTotal = 0;
        dataCSV.forEach(row => {
            let pays = row.pays.toUpperCase().trim();
            if (bddPays[pays] && bddPays[pays].eco[indicateur] !== undefined) {
                impactTotal += parseFloat(row.per_eq) * bddPays[pays].eco[indicateur];
            }
        });
        
        let seuilTotal = sumNbEqPers * seuilsEco[indicateur];
        let ratio = seuilTotal > 0 ? (impactTotal / seuilTotal) : 1; 
        
        systeme.modeleRaworth.plafondEcologique.push({
            dimension: indicateur, type: "Ecologique",
            valeur_mesure: impactTotal, seuil_reference: seuilTotal, unite: "total", ratio: ratio
        });
    }

    // 3. Calcul du Plancher Social (Shortfall)
    const indSociaux = Object.keys(bddPays["FRANCE"].soc);
    for (let indicateur of indSociaux) {
        let scorePondere = 0;
        dataCSV.forEach(row => {
            let pays = row.pays.toUpperCase().trim();
            if (bddPays[pays] && bddPays[pays].soc[indicateur] !== undefined) {
                scorePondere += (parseFloat(row.per_eq) / sumNbEqPers) * bddPays[pays].soc[indicateur];
            }
        });
        
        let ratio = scorePondere > 0 ? (1.0 / scorePondere) : 1; 
        
        systeme.modeleRaworth.plancherSocial.push({
            dimension: indicateur, type: "Social",
            valeur_mesure: scorePondere, seuil_reference: 1.0, unite: "score", ratio: ratio
        });
    }

    return systeme;
}

// Fonction appelée par le bouton d'importation HTML
function chargerFichierCSV(file, cible) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const contenu = e.target.result;
        let data = d3.csvParse(contenu);
        if(data.length === 0 || !data[0].pays) data = d3.dsvFormat(";").parse(contenu); 

        // Vérification du format d'export SysML 
        if (data.length === 0 || !data[0].pays || !data[0].per_eq || !data[0].composant) {
            alert("Format incorrect. Importez un export SysML valide avec les colonnes : composant, phase, pays, per_eq");
            return;
        }

        // Lancement du moteur de calcul
        let systemeCalcule = analyserCycleDeVie(data, file.name.replace(".csv", ""));
        
        if (!systemeCalcule) return; // Arrêt si erreur dans le calcul

        if(cible === 'A') systemeA = systemeCalcule;
        if(cible === 'B') systemeB = systemeCalcule;
        
        document.getElementById("nom-systeme-" + cible).innerText = systemeCalcule.nom.toUpperCase();
        dessinerDonut(systemeCalcule.modeleRaworth, "#chart-" + cible);
    };
    reader.readAsText(file);
}

// =========================================================================
// 2. INITIALISATION AU DÉMARRAGE
// =========================================================================

window.onload = function() {
    let modeleVide = { plafondEcologique: [], plancherSocial: [] };
    for(let i=0; i<7; i++) modeleVide.plafondEcologique.push({dimension: "En attente...", type: "Ecologique", ratio: 0, valeur_mesure: 0, seuil_reference: 0});
    for(let i=0; i<11; i++) modeleVide.plancherSocial.push({dimension: "En attente...", type: "Social", ratio: 0, valeur_mesure: 0, seuil_reference: 0});
    
    dessinerDonut(modeleVide, "#chart-A");
    dessinerDonut(modeleVide, "#chart-B");
};

// =========================================================================
// 3. MOTEUR DE DESSIN D3.JS (Optimisé : Superposition, Textes Traduits et Interactions Pro)
// =========================================================================

function dessinerDonut(donneesModele, selecteurDiv) {
    
    d3.select(selecteurDiv).selectAll("*").remove();

    const width = 600; 
    const height = 600;
    const center = width / 2;

    const rLogo = 35;          
    const rSocInner = 130;     
    const rEcoOuter = 205;     
    const rEcoMax = 280;       

    const colCyan = "#00b4e8";      
    const colDarkBlue = "#0c2340";  // Bleu foncé pour meilleur contraste
    const colLightBg = "#f4fbfe";   
    const colRed = "#e62e2d"; 
    const colScale = "rgba(30, 55, 90, 0.25)";      

    const svg = d3.select(selecteurDiv).append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${center}, ${center})`);

    const defs = svg.append("defs");
    const uniqueIdSuffix = selecteurDiv.replace("#", ""); 
    
    const ecoGrad = defs.append("radialGradient").attr("id", "gradEco" + uniqueIdSuffix).attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", rEcoMax);
    ecoGrad.append("stop").attr("offset", (rEcoOuter / rEcoMax) * 100 + "%").attr("stop-color", colRed);
    ecoGrad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255, 255, 255, 0)");

    const socGrad = defs.append("radialGradient").attr("id", "gradSoc" + uniqueIdSuffix).attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", rSocInner);
    socGrad.append("stop").attr("offset", "15%").attr("stop-color", "rgba(255, 255, 255, 0)");
    socGrad.append("stop").attr("offset", "100%").attr("stop-color", colRed);

    function getTextPath(d, radius) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const isBottom = angle > Math.PI / 2 && angle < 3 * Math.PI / 2;
        let start = d.startAngle, end = d.endAngle;
        if (isBottom) {
            return `M ${Math.sin(end)*radius} ${-Math.cos(end)*radius} A ${radius} ${radius} 0 0 0 ${Math.sin(start)*radius} ${-Math.cos(start)*radius}`;
        } else {
            return `M ${Math.sin(start)*radius} ${-Math.cos(start)*radius} A ${radius} ${radius} 0 0 1 ${Math.sin(end)*radius} ${-Math.cos(end)*radius}`;
        }
    }

    const pie = d3.pie().value(1).sort(null).padAngle(0); 
    const arcsEco = pie(donneesModele.plafondEcologique);
    const arcsSoc = pie(donneesModele.plancherSocial);

    // Chemins pour les textes
    defs.selectAll(".textPathEco").data(arcsEco).join("path")
        .attr("id", (d, i) => "text-path-eco-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rEcoMax + 10));

    // Création de DEUX chemins pour les textes sociaux (gestion des textes longs sur 2 lignes)
    defs.selectAll(".textPathSoc1").data(arcsSoc).join("path")
        .attr("id", (d, i) => "text-path-soc1-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rSocInner - 10)); // Ligne inférieure

    defs.selectAll(".textPathSoc2").data(arcsSoc).join("path")
        .attr("id", (d, i) => "text-path-soc2-" + uniqueIdSuffix + "-" + i)
        .attr("d", d => getTextPath(d, rSocInner - 22)); // Ligne supérieure

    // Fonds de base
    svg.selectAll(".bg-eco").data(arcsEco).join("path").attr("d", d3.arc().innerRadius(rEcoOuter).outerRadius(rEcoMax)).attr("fill", colLightBg);
    svg.selectAll(".bg-soc").data(arcsSoc).join("path").attr("d", d3.arc().innerRadius(rLogo).outerRadius(rSocInner)).attr("fill", colLightBg);

    // Echelles grisées (zones neutres)
    const maxSafeThickness = 20; 
    const gap = 0.03; 
    svg.selectAll(".scale-soc").data(arcsSoc).join("path").attr("d", d => d3.arc().innerRadius(rSocInner).outerRadius(rSocInner + maxSafeThickness).startAngle(d.startAngle + gap).endAngle(d.endAngle - gap)()).attr("fill", colScale);
    svg.selectAll(".scale-eco").data(arcsEco).join("path").attr("d", d => d3.arc().innerRadius(rEcoOuter - maxSafeThickness).outerRadius(rEcoOuter).startAngle(d.startAngle + gap).endAngle(d.endAngle - gap)()).attr("fill", colScale);

    // 1. CORRECTION DU CHEVAUCHEMENT : Lignes blanches tracées en premier
    arcsSoc.forEach(d => { svg.append("line").attr("x1", Math.sin(d.startAngle)*rLogo).attr("y1", -Math.cos(d.startAngle)*rLogo).attr("x2", Math.sin(d.startAngle)*rSocInner).attr("y2", -Math.cos(d.startAngle)*rSocInner).attr("stroke", "white").attr("stroke-width", 4); });
    arcsEco.forEach(d => { svg.append("line").attr("x1", Math.sin(d.startAngle)*rEcoOuter).attr("y1", -Math.cos(d.startAngle)*rEcoOuter).attr("x2", Math.sin(d.startAngle)*rEcoMax).attr("y2", -Math.cos(d.startAngle)*rEcoMax).attr("stroke", "white").attr("stroke-width", 4); });

    // 2. Tracé des pétales rouges (recouvrent les lignes)
    function drawPetals(arcs, isEco) {
        const petalGap = 0.015; // Écart réduit pour un meilleur rendu
        svg.selectAll(isEco ? ".red-eco" : ".red-soc").data(arcs).join("path")
            .attr("d", d => {
                let depassement = d.data.ratio - 1; 
                if (depassement <= 0) return ""; 
                let intensite = Math.min(depassement, 1.5) / 1.5; 
                
                if (isEco) {
                    let thickness = (rEcoMax - rEcoOuter) * intensite; 
                    return d3.arc().innerRadius(rEcoOuter).outerRadius(rEcoOuter + thickness).startAngle(d.startAngle + petalGap).endAngle(d.endAngle - petalGap)();  
                } else {
                    let thickness = (rSocInner - rLogo) * intensite;
                    return d3.arc().innerRadius(rSocInner - thickness).outerRadius(rSocInner).startAngle(d.startAngle + petalGap).endAngle(d.endAngle - petalGap)(); 
                }
            }).attr("fill", isEco ? `url(#gradEco${uniqueIdSuffix})` : `url(#gradSoc${uniqueIdSuffix})`);
    }
    
    drawPetals(arcsEco, true);
    drawPetals(arcsSoc, false);

    // 3. Cercles bleus de démarcation
    svg.append("circle").attr("r", rSocInner + ((rEcoOuter - rSocInner)/2)).attr("fill", "none").attr("stroke", colCyan).attr("stroke-width", rEcoOuter - rSocInner);
    svg.append("circle").attr("r", rSocInner).attr("fill", "none").attr("stroke", colDarkBlue).attr("stroke-width", "3px");
    svg.append("circle").attr("r", rEcoOuter).attr("fill", "none").attr("stroke", colDarkBlue).attr("stroke-width", "3px");

    // TEXTES ÉCOLOGIQUES (Traduits)
    svg.selectAll(".curved-text-eco").data(arcsEco).join("text")
        .attr("dy", d => {
            const angle = (d.startAngle + d.endAngle) / 2;
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? 12 : -2; 
        })
        .append("textPath").attr("href", (d, i) => "#text-path-eco-" + uniqueIdSuffix + "-" + i).attr("startOffset", "50%")
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold").style("fill", colDarkBlue).style("letter-spacing", "1px")
        .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
        .text(d => {
            let label = traduire(d.data.dimension).toUpperCase();
            return label.length > 22 ? label.substring(0, 20) + "." : label;
        });

    // TEXTES SOCIAUX (Traduits) : Rétablis sur 2 lignes pour éviter qu'ils ne se superposent
    const socTextGroups = svg.selectAll(".curved-text-soc").data(arcsSoc).join("g");
    socTextGroups.each(function(d, i) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const isBottom = angle > Math.PI / 2 && angle < 3 * Math.PI / 2;
        let dyVal = isBottom ? 10 : -2;

        let mots = traduire(d.data.dimension).toUpperCase().trim().split(/\s+/);
        const group = d3.select(this);

        if (mots.length === 1) {
            // Un seul mot : centré
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc1-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(mots[0].substring(0, 14));
        } else {
            // Deux lignes pour éviter le chevauchement (ex: "QUALITÉ" et "DÉMOC.")
            let ligne1 = mots[0];
            let ligne2 = mots.slice(1).join(" ");
            
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc2-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(ligne1.substring(0, 14));
                
            group.append("text").attr("dy", dyVal).append("textPath").attr("href", "#text-path-soc1-" + uniqueIdSuffix + "-" + i)
                .attr("startOffset", "50%").style("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold").style("fill", colDarkBlue)
                .style("font-family", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
                .text(ligne2.substring(0, 14) + (ligne2.length > 14 ? "." : ""));
        }
    });

    // LOGO CENTRAL
    const logoGroup = svg.append("g");
    logoGroup.append("rect").attr("x", -20).attr("y", -20).attr("width", 40).attr("height", 40).attr("fill", colDarkBlue).attr("rx", 5);
    logoGroup.append("ellipse").attr("cx", 0).attr("cy", 0).attr("rx", 12).attr("ry", 5).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 2).attr("transform", "rotate(-20)");
    logoGroup.append("circle").attr("cx", -2).attr("cy", 1).attr("r", 2).attr("fill", "white");

    // HITBOX, INFO-BULLE ET MODALE
    const tooltip = d3.select("#tooltip");
    svg.selectAll(".hitbox").data([...arcsSoc, ...arcsEco]).join("path")
        .attr("d", d => d3.arc().innerRadius(d.data.type === "Social" ? rLogo : rSocInner).outerRadius(d.data.type === "Social" ? rEcoOuter : rEcoMax).startAngle(d.startAngle).endAngle(d.endAngle)())
        .attr("fill", "transparent").style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "rgba(0,0,0,0.05)");
            
            // Tooltip enrichi (Traduit)
            let dimTraduit = traduire(d.data.dimension);
            let etat = d.data.ratio > 1 ? "⚠️ Dépassement" : "✅ Respecté";
            let couleurEtat = d.data.ratio > 1 ? "#ffcc00" : "#00ff00";
            
            tooltip.style("opacity", 1).html(`
                <strong style="font-size:14px;">${dimTraduit}</strong><br><br>
                Mesure : ${d.data.valeur_mesure.toLocaleString('fr-FR', {maximumFractionDigits: 2})}<br>
                Seuil : ${d.data.seuil_reference.toLocaleString('fr-FR', {maximumFractionDigits: 2})}<br>
                <span style="color:${couleurEtat}; font-weight:bold; margin-top:5px; display:block;">${etat}</span>
            `);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY + 15) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "transparent");
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            
            // --- NOUVELLE LOGIQUE POUR LA MODALE "DASHBOARD" ---
            let dimTraduit = traduire(d.data.dimension);
            let isEco = d.data.type === "Ecologique";
            let ratio = d.data.ratio;

            // 1. Textes de base
            document.getElementById('m-title').innerHTML = dimTraduit;
            document.getElementById('m-unite').innerHTML = isEco ? "Impact Total" : "Score Social Pondéré";
            document.getElementById('m-valeur-mesure').innerHTML = d.data.valeur_mesure.toLocaleString('fr-FR', {maximumFractionDigits: 2});
            document.getElementById('m-seuil-ref').innerHTML = d.data.seuil_reference.toLocaleString('fr-FR', {maximumFractionDigits: 2});

            // 2. Gestion des statuts et explications (Image 2)
            if (isEco) {
                if (ratio > 1) {
                    document.getElementById('m-status-text').innerHTML = "⚠️ DÉPASSEMENT";
                    document.getElementById('m-status-text').style.color = "#ffcccc"; // Rouge clair pour contraster sur le vert
                    let depass = ((ratio - 1) * 100).toFixed(0);
                    document.getElementById('m-explication').innerHTML = `L'impact de ce système est <strong>${depass}% supérieur</strong> à la limite écologique autorisée pour cette population. Il participe au dépassement planétaire.`;
                } else {
                    document.getElementById('m-status-text').innerHTML = "✅ ZONE SÛRE";
                    document.getElementById('m-status-text').style.color = "white";
                    document.getElementById('m-explication').innerHTML = `L'impact de ce système respecte parfaitement le plafond écologique autorisé.`;
                }
            } else { // Social
                if (ratio > 1) {
                    document.getElementById('m-status-text').innerHTML = "⚠️ DÉFICIT";
                    document.getElementById('m-status-text').style.color = "#ffcccc";
                    document.getElementById('m-explication').innerHTML = `Ce système ne permet pas d'atteindre le plancher social minimal requis pour le bien-être de la population.`;
                } else {
                    document.getElementById('m-status-text').innerHTML = "✅ ATTEINT";
                    document.getElementById('m-status-text').style.color = "white";
                    document.getElementById('m-explication').innerHTML = `Ce système contribue positivement et satisfait les besoins sociaux de base sur cet indicateur.`;
                }
            }

            // 3. Animation de la Jauge (Image 1)
            // On veut que 50% de la jauge (au milieu) représente le seuil de 1.
            let positionJauge = 50; 
            
            if (isEco) {
                document.getElementById('m-jauge-gauche').innerHTML = "Sûr (0)";
                document.getElementById('m-jauge-centre').innerHTML = "Plafond (1)";
                document.getElementById('m-jauge-droite').innerHTML = "Dépassement (>1)";
                
                if (ratio > 1) {
                    positionJauge = Math.min(100, 50 + ((ratio - 1) * 25)); // Va vers la droite (rouge)
                } else {
                    positionJauge = Math.max(0, ratio * 50); // Va vers la gauche (vert)
                }
            } else {
                document.getElementById('m-jauge-gauche').innerHTML = "Atteint (0)";
                document.getElementById('m-jauge-centre').innerHTML = "Plancher (1)";
                document.getElementById('m-jauge-droite').innerHTML = "Déficit (>1)";
                
                if (ratio > 1) {
                    positionJauge = Math.min(100, 50 + ((ratio - 1) * 25)); // Déficit (rouge)
                } else {
                    positionJauge = Math.max(0, ratio * 50); // Atteint (vert)
                }
            }

            // Déplace le triangle sur la barre
            document.getElementById('m-jauge-curseur').style.left = `${positionJauge}%`;

            // Affiche la modale
            document.getElementById('modal-overlay').style.display = 'flex';
        });
}