/* ══════════════════════════════════
   DONNÉES — PERSONNAGES
══════════════════════════════════ */

const PERSONNAGES = [
	//#region Palier 1
  //#region Ville de Départ
	{
    id: 'repreneur_butin_vdp',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1b1',
    img: '../img/compendium/montages/butin_vdp.png',
    lore: "Reprends des ingrédient basique trouvable aux abbords de la Ville de Départ, ainsi que des bourses d'argent.",
    sells: [
      { id: 'viande_de_sanglier',  price: 0.1 },
      { id: 'peau_de_sanglier', price: 2.5 },
	  	{ id: 'cristal_corrompu', price: 1.5 },
	  	{ id: 'fourrure_de_loup', price: 3 },
	  	{ id: 'crocs_de_loup', price: 4 },
	  	{ id: 'petite_bourse', price: 5 },
    ],
	},
	{
    id: 'marchand_equipement_vdp',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1m1',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
	},
  {
    id: 'marchand_etrange_vdp',
    name: "Marchand Étrange",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a4',
    img: '../img/compendium/textures/trinkets/P1/Manteau Volé.png',
    lore: "Échange un étrange manteau contre quelques petites bourses.",
    craft: [
			{ 
				id: 'manteau_vole', time: '10m',
				ingredients: [
					{ id: 'petite_bourse', qty: 128 },
				]
			}
		]
  },
	{
    id: 'marchand_outils_vdp',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1m5',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
			{ id: 'torche',  buy: 2500 },
    ],
  },
	{
    id: 'alchimiste_vdp',
    name: "Alchimiste",
    tag: 'alchimiste',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a14',
    img: '../img/compendium/textures/items/Consommable/strengthpot_3.png',
    lore: "Concocte des Potions et des Cristaux.",
    craft: [
      { id: 'potion_vie_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_vie_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_vie_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_soin', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_mana_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_mana_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_mana_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_mana', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_stamina_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_stamina_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_stamina_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_stamina', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'cristal_puissance', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
    ],
  },
	{
    id: 'bucheron_vdp',
    name: "Bucheron",
    tag: 'bucheron',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a13',
    img: '../img/compendium/textures/items/Ressources/planche_chene.png',
    lore: "Réalise des Planches de Bois et de la Poudre de Bois.",
    craft: [
      { id: 'planche_chene', time: '15s',
				ingredients: [
					{ id: 'chene', qty: 2 },
				]
			},
			{ id: 'planche_bouleau', time: '15s',
				ingredients: [
					{ id: 'bouleau', qty: 2 },
				]
			},
			{ id: 'planche_acacia', time: '15s',
				ingredients: [
					{ id: 'acacia', qty: 2 },
				]
			},
			{ id: 'planche_sapin', time: '15s',
				ingredients: [
					{ id: 'sapin', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_chene', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_bouleau', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_acacia', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_sapin', qty: 2 },
				]
			},
		]
  },
	{
    id: 'refaconneur_vdp',
    name: "Refaçonneur",
    tag: 'refaconneur',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a7',
    img: '../img/compendium/montages/refaconneur_vdp.png',
    lore: "Transforme des Ressources et des Fils d'Araignées pour réaliser des ficelles utile dans la confection d'Accessoires.",
    craft: [
			{ 
				id: 'ficelle_chene', time: '1m',
				ingredients: [
					{ id: 'chene', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_bouleau', time: '1m',
				ingredients: [
					{ id: 'bouleau', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_cuivre', time: '1m',
				ingredients: [
					{ id: 'cuivre', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			}
		]
  },
	{
    id: 'forgeron_armes_vdp',
    name: "Forgeron d'Armes",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a1',
    img: '../img/compendium/montages/armes_vdp.png',
    lore: "Permet le fabrication d'armes rudimentaires pour les novices.",
    craft: [
			{ 
				id: 'epee_fer', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 5 },
					{ id: 'lingot_cuivre', qty: 10 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'bouclier_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 12 },
					{ id: 'ecorce_de_titan', qty: 7 },
				]
			},
			{ 
				id: 'hache_double_fer', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 5 },
					{ id: 'lingot_cuivre', qty: 10 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'bouclier_pointu_bois', time: '10s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 8 },
					{ id: 'ecorce_de_titan', qty: 7 },
				]
			},
			{ 
				id: 'arc_sylvestre', time: '10s',
				ingredients: [
					{ id: 'corde_darc_sylvestre', qty: 12 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'dague_intermediaire', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 8 },
					{ id: 'lingot_cuivre', qty: 12 },
				]
			},
			{ 
				id: 'poing_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 999 },
					{ id: 'brindille_enchantee', qty: 999 },
				]
			},
			{ 
				id: 'baton_sylvestre_mage', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 15 },
					{ id: 'coeur_de_bois', qty: 1 },
				]
			},
			{ 
				id: 'grimoire_sylvestre', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 4 },
					{ id: 'fourrure_de_loup', qty: 12 },
				]
			},
			{ 
				id: 'baton_sylvestre_shaman', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 15 },
					{ id: 'coeur_de_bois', qty: 1 },
				]
			},
			{ 
				id: 'grimoire_bestial', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 4 },
					{ id: 'fourrure_de_loup', qty: 12 },
				]
			}
		]
  },
	{
    id: 'forgeron_armures_vdp',
    name: "Forgeron d'Armures",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a2',
    img: '../img/compendium/textures/armors/chestplate_tactique.png',
    lore: "Permet le fabrication d'armures rudimentaires pour les novices.",
    craft: [
			{ 
				id: 'lingot_cuivre', time: '10s',
				ingredients: [
					{ id: 'cuivre', qty: 3 },
					{ id: 'charbon', qty: 2 },
				]
			},
			{ 
				id: 'tunique_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 12 },
					{ id: 'lingot_cuivre', qty: 4 },
				]
			},
			{ 
				id: 'jambieres_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 8 },
					{ id: 'lingot_cuivre', qty: 4 },
				]
			},
			{ 
				id: 'bottes_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 5 },
					{ id: 'lingot_cuivre', qty: 2 },
				]
			},
			{ 
				id: 'tunique_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 18 },
					{ id: 'ecorce_sylvestre', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 15 },
					{ id: 'ecorce_sylvestre', qty: 8 },
				]
			},
			{ 
				id: 'bottes_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 10 },
					{ id: 'ecorce_sylvestre', qty: 5 },
				]
			},
			{ 
				id: 'tunique_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 18 },
					{ id: 'tissu_spectral', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 15 },
					{ id: 'tissu_spectral', qty: 8 },
				]
			},
			{ 
				id: 'bottes_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 10 },
					{ id: 'tissu_spectral', qty: 5 },
				]
			},
			{ 
				id: 'tunique_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 18 },
					{ id: 'gelee_de_slime', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 15 },
					{ id: 'gelee_de_slime', qty: 8 },
				]
			},
			{ 
				id: 'bottes_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 10 },
					{ id: 'gelee_de_slime', qty: 5 },
				]
			},
			{ 
				id: 'bottes_revenant', time: '10s',
				ingredients: [
					{ id: 'eclat_du_sabot_maudit', qty: 1 },
					{ id: 'carapace_dika', qty: 64 },
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fourrure_de_loup', qty: 64 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_vdp',
    name: "Forgeron d'Accessoires de Base",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a3',
    img: '../img/compendium/montages/forgeron_accessoires_vdp.png',
    lore: "Permet le fabrication d'accessoires de base.",
    craft: [
			{ 
				id: 'anneau_cuivre', time: '1m',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'anneau_fer', time: '1m',
				ingredients: [
					{ id: 'lingot_fer', qty: 16 },
				]
			},
			{ 
				id: 'collier_albal', time: '1m',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 96 },
					{ id: 'crocs_de_albal', qty: 5 },
				]
			},
			{ 
				id: 'amulette_bois', time: '1m',
				ingredients: [
					{ id: 'coeur_de_bois', qty: 32 },
					{ id: 'bouleau', qty: 64 },
				]
			},
			{ 
				id: 'gants_bandit', time: '1m',
				ingredients: [
					{ id: 'cuir_use', qty: 96 },
					{ id: 'racine_ancestrale', qty: 8 },
				]
			},
			{ 
				id: 'gants_osseux', time: '1m',
				ingredients: [
					{ id: 'poussiere_dos', qty: 64 },
					{ id: 'os_de_squelette', qty: 64 },
					{ id: 'os_de_squelette_renforce', qty: 32 },
				]
			},
			{ 
				id: 'bracelet_sylvestre', time: '1m',
				ingredients: [
					{ id: 'ecorce_de_titan', qty: 64 },
					{ id: 'brindille_enchantee', qty: 64 },
				]
			},
			{ 
				id: 'bracelet_araignee', time: '1m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 64 },
					{ id: 'spore_corrompu', qty: 64 },
				]
			},
			{ 
				id: 'gants_cerfs', time: '1m',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 32 },
				]
			},
			{ 
				id: 'bracelet_gluant', time: '1m',
				ingredients: [
					{ id: 'lingot_fer', qty: 8 },
					{ id: 'gelee_de_slime', qty: 64 },
					{ id: 'noyau_de_slime', qty: 8 },
				]
			}
		]
  },
	{
    id: 'forgeron_accessoires_cuivre_vdp',
    name: "Forgeron d'Accessoires de Cuivre",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a5',
    img: '../img/compendium/textures/trinkets/P1/Set de Cuivre/Anneau de Cuivre.png',
    lore: "Permet le fabrication d'accessoires en Cuivre.",
    craft: [
			{ 
				id: 'anneau_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'bracelet_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
			{ 
				id: 'gants_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
			{ 
				id: 'amulette_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'piece_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_fer_vdp',
    name: "Forgeron d'Accessoires de Fer",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a6',
    img: '../img/compendium/textures/trinkets/P1/Set de Fer/Anneau de Fer.png',
    lore: "Permet le fabrication d'accessoires en Fer.",
    craft: [
			{ 
				id: 'anneau_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 12 },
				]
			},
			{ 
				id: 'bracelet_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
			{ 
				id: 'gants_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
			{ 
				id: 'amulette_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 12 },
				]
			},
			{ 
				id: 'piece_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
		]
  },
	{
    id: 'forgeron_lingot_vdp',
    name: "Forgeron de Lingots de Cuivre & de Fer",
    tag: 'forgeron_lingots',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a8',
    img: '../img/compendium/montages/lingots.png',
    lore: "Permet le fabrication de Lingots de Cuivre et de Lingots de Fer.",
    craft: [
			{ 
				id: 'lingot_cuivre', time: '10s',
				ingredients: [
					{ id: 'cuivre', qty: 3 },
					{ id: 'charbon', qty: 2 },
				]
			},
			{ 
				id: 'lingot_fer', time: '15s',
				ingredients: [
					{ id: 'fer', qty: 4 },
					{ id: 'charbon', qty: 2 },
				]
			}
		]
  },
	{
    id: 'cle_vdp',
    name: "Fabicant de Clef du Donjon Mine de Geldorak",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1c1',
    img: '../img/compendium/textures/items/Donjon/key_geldo.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Mine de Geldorak.",
    craft: [
			{ 
				id: 'cle_foret', time: '3m',
				ingredients: [
					{ id: 'ecorce_sylvestre', qty: 15 },
					{ id: 'coeur_de_bois', qty: 4 },
					{ id: 'mycelium_magique', qty: 1 },
				]
			}
		]
  },
	{
    id: 'marchand_itinerant_vdp',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1m18',
    img: '../img/compendium/montages/itinerant_vdp.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'petite_bourse',  buy: 10,price: 7.5 },
      { id: 'peau_de_sanglier', buy: 5,price: 3.75 },
			{ id: 'cristal_corrompu', buy: 3,price: 2.25 },
			{ id: 'fourrure_de_loup', buy: 6,price: 4.5 },
			{ id: 'crocs_de_loup', buy: 8,price: 6 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	{
    id: 'secret_loups',
    name: "Fabicant des Gants des Loups",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Vallée des Loups',
    regionId: 'm1c11',
    img: '../img/compendium/textures/trinkets/P1/Set Loup Faiblard/Gants des Loups.png',
    lore: "Permet le fabrication de l'Accessoires Gants des Loups.",
    craft: [
			{
				id: 'gants_loups', time: '30m',
				ingredients: [
					{qty:128, id:'fourrure_de_loup'},
					{qty:5, id:'crocs_de_albal'},
					{qty:8, id:'lingot_fer'}
				]
			}
		]
  },
	//#endregion Ville de Départ
	//#region Hanaka
  {
    id: 'repreneur_butin_hanaka',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1b2',
    img: '../img/compendium/montages/butin_hanaka.png',
    lore: "Reprends des ingrédient forêstié trouvable aux abbords de Hanaka, dans les Marécages Putrides.",
    sells: [
      { id: 'pousse_de_sylve',  price: 3 },
      { id: 'eclat_de_bois_magique', price: 4 },
			{ id: 'racine_ancestrale', price: 150 },
			{ id: 'ecorce_de_titan', price: 5 },
			{ id: 'ecorce_sylvestre', price: 4 },
			{ id: 'corde_darc_sylvestre', price: 5 },
			{ id: 'brindille_enchantee', price: 4 },
			{ id: 'coeur_de_bois', price: 10 },
			{ id: 'tissu_spectral', price: 4 },
			{ id: 'mycelium_magique', price: 300 },
    ],
  },
  {
    id: 'marchand_equipement_hanaka',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1m2',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
  },
  {
    id: 'repreneur_arme_hanaka',
    name: "Repreneur d'Armes Niveau 5",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1b8',
    img: '../img/compendium/montages/revendeur_armes_hanaka.png',
    lore: "Reprends les Armes de Niveau 5 obtenable sur les monstres du Palier 1.",
    sells: [
      { id: 'bouclier_sylvestre',  price: 50 },
			{ id: 'marteau_colosse', price: 50 },
			{ id: 'epee_osseuse', price: 50 },
			{ id: 'dague_bandit', price: 50 },
			{ id: 'arbalete_bandit', price: 50 },
			{ id: 'baton_squelette_mage', price: 50 },
			{ id: 'baton_squelette_shaman', price: 50 },
			{ id: 'baton_squelette_maudit_mage', price: 150 },
			{ id: 'baton_squelette_maudit_shaman', price: 150 },
    ],
  },
	{
    id: 'marchand_itinerant_hanaka',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1m15',
    img: '../img/compendium/montages/itinerant_hanaka.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'pousse_de_sylve',  buy: 6, price: 5 },
			{ id: 'eclat_de_bois_magique',  buy: 8, price: 6 },
			{ id: 'ecorce_sylvestre',  buy: 8, price: 6 },
			{ id: 'corde_darc_sylvestre',  buy: 10, price: 8 },
			{ id: 'brindille_enchantee',  buy: 8, price: 6 },
			{ id: 'coeur_de_bois',  buy: 20, price: 15 },
			{ id: 'ecorce_de_titan',  buy: 10, price: 8 },
			{ id: 'mycelium_magique',  buy: 600, price: 450 },
			{ id: 'racine_ancestrale',  buy: 300, price: 225 },
			{ id: 'tissu_spectral',  buy: 8, price: 6 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	{
    id: 'secret_cyclorim',
    name: "Fabicant du Crâne de Squelette",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Cyclorim',
    regionId: 'm1c12',
    img: '../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Crane de Squelette.png',
    lore: "Permet le fabrication de l'Accessoires Crâne de Squelette.",
    craft: [
			{
				id: 'crane_squelette', time: '30m',
				ingredients: [
					{qty:64, id:'ames_des_ruines'},
					{qty:5, id:'coeur_putrefie'},
					{qty:32, id:'os_de_squelette'}
				]
			}
		]
  },
	//#endregion Hanaka
	//#region Mizunari
  {
    id: 'repreneur_butin_mizunari',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Mizunari',
		regionId: 'm1b3',
    img: '../img/compendium/montages/butin_mizunari.png',
    lore: "Reprends des ingrédient champêtre trouvable dans les champs à l'Est de Mizunari.",
    sells: [
      { id: 'cuir_use',  price: 5 },
      { id: 'carapace_dika', price: 6 },
			{ id: 'spore_corrompu', price: 5 },
			{ id: 'fragment_de_feuille', price: 6 },
    ],
  },
	{
    id: 'marchand_outils_mizunari',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Mizunari',
    regionId: 'm1m11',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
			{ id: 'torche',  buy: 2500 },
    ],
  },
	{
    id: 'marchand_itinerant_mizunari',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Mizunari',
    regionId: 'm1m14',
    img: '../img/compendium/montages/itinerant_mizunari.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'cuir_use',  buy: 10, price: 7.5 },
			{ id: 'carapace_dika',  buy: 12, price: 9 },
			{ id: 'spore_corrompu',  buy: 10, price: 7.5 },
			{ id: 'fragment_de_feuille',  buy: 12, price: 9 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	//#endregion Mizunari
	//#region Mine de Geldorak
	{
    id: 'cle_mine_geldorak',
    name: "Fabicant de Clef du Donjon Mine de Geldorak",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Mine de Geldorak',
    regionId: 'm1c2',
    img: '../img/compendium/textures/items/Donjon/key_geldo.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Mine de Geldorak.",
    craft: [
			{ 
				id: 'cle_foret', time: '3m',
				ingredients: [
					{ id: 'ecorce_sylvestre', qty: 15 },
					{ id: 'coeur_de_bois', qty: 4 },
					{ id: 'mycelium_magique', qty: 1 },
				]
			}
		]
  },
	//#endregion Mine de Geldorak
	//#region Vallhat
  {
    id: 'repreneur_butin_vallhat',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Vallhat',
		regionId: 'm1b4',
    img: '../img/compendium/montages/butin_vallhat.png',
    lore: "Reprends des ingrédient gluant trouvable dans les marécages en bas de Vallhat.",
    sells: [
      { id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 10 },
			{ id: 'potion_stamina_1',  buy: 10 },
      { id: 'pousse_de_sylve',  price: 3 },
      { id: 'eclat_de_bois_magique', price: 4 },
			{ id: 'racine_ancestrale', price: 150 },
			{ id: 'ecorce_de_titan', price: 5 },
			{ id: 'ecorce_sylvestre', price: 4 },
			{ id: 'corde_darc_sylvestre', price: 5 },
			{ id: 'brindille_enchantee', price: 4 },
			{ id: 'coeur_de_bois', price: 10 },
			{ id: 'tissu_spectral', price: 4 },
			{ id: 'mycelium_magique', price: 300 },
			{ id: 'gelee_de_slime', price: 5 },
			{ id: 'noyau_de_slime', price: 100 },
			{ id: 'essence_de_gorbel', price: 1500 },
    ],
  },
  {
    id: 'marchand_accessoire_vallhat',
    name: "Marchand d'Accessoires",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Vallhat',
    regionId: 'm1m3',
    img: '../img/compendium/montages/accessoires_vallhat.png',
    lore: "Vends des Accessoires à base de slime de Vallhat.",
    sells: [
      { id: 'bague_gluante',  price: 1000 },
      { id: 'amulette_gluante', price: 1000 },
    ],
  },
	{
    id: 'secret_vallhat',
    name: "Fabicant de l'Anneau Gluant",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Vallhat',
    regionId: 'm1c8',
    img: '../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Anneau Gluant.png',
    lore: "Permet le fabrication de l'Accessoires Anneau Gluant.",
    craft: [
			{ 
				id: 'anneau_gluant', time: '30m',
				ingredients: [
					{ id: 'gelee_de_slime', qty: 40 },
					{ id: 'noyau_de_slime', qty: 32 },
					{ id: 'essence_de_gorbel', qty: 1 },
				]
			}
		]
  },
	{
    id: 'marchand_itinerant_vallhat',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Vallhat',
    regionId: 'm1m16',
    img: '../img/compendium/montages/itinerant_vallhat.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'pousse_de_sylve',  buy: 6,price: 4.5 },
      { id: 'eclat_de_bois_magique', buy: 8,price: 6 },
			{ id: 'ecorce_sylvestre', buy: 8,price: 6 },
			{ id: 'corde_darc_sylvestre', buy: 10,price: 7.5 },
			{ id: 'coeur_de_bois', buy: 20,price: 15 },
			{ id: 'ecorce_de_titan', buy: 10,price: 7.5 },
			{ id: 'brindille_enchantee', buy: 8,price: 6 },
			{ id: 'racine_ancestrale', buy: 300,price: 225 },
			{ id: 'mycelium_magique', price: 450 },
			{ id: 'gelee_de_slime', buy: 10,price: 7.5 },
			{ id: 'noyau_de_slime', buy: 200,price: 150 },
			{ id: 'essence_de_gorbel', price: 2250 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	//#endregion Vallhat
	//#region Chateau Abandonne
  {
    id: 'repreneur_butin_chateau_abandonne',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Château Abandonné',
		regionId: 'm1b5',
    img: '../img/compendium/montages/butin_chateau.png',
    lore: "Reprends des ingrédient des Squelettes trouvable dans les Ruines Maudites et son Donjon.",
    sells: [
      { id: 'os_de_squelette',  price: 4.5 },
      { id: 'poussiere_dos', price: 4 },
			{ id: 'os_de_squelette_renforce', price: 5 },
			{ id: 'tissu_maudit', price: 6 },
			{ id: 'morceau_de_criniere_spectrale', price: 5000 },
			{ id: 'coeur_putrefie', price: 50 },
    ],
  },
	//#endregion Chateau Abandonne
	//#region Virelune
  {
    id: 'repreneur_butin_virelune',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Virelune',
		regionId: 'm1b6',
    img: '../img/compendium/montages/butin_virelune.png',
    lore: "Reprends des ingrédient d'Arachnides et du Lac environant.",
    sells: [
      { id: 'fil_araignee',  price: 7 },
      { id: 'tissu_araignee', price: 6 },
			{ id: 'carapace_requin', price: 6.5 },
			{ id: 'coeur_nymbrea', price: 500 },
			{ id: 'venin_araignee', price: 750 },
    ],
  },
	{
    id: 'marchand_outils_virelune',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Virelune',
    regionId: 'm1m6',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
			{ id: 'torche',  buy: 2500 },
    ],
  },
	{
    id: 'secret_antre_aepep',
    name: "Fabicant de l'Anneau de Léviathan",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Antre de Aepep',
    regionId: 'm1c7',
    img: '../img/compendium/textures/trinkets/P1/Anneau de Léviathan.png',
    lore: "Permet le fabrication de l'Accessoires Anneau de Léviathan.",
    craft: [
			{ 
				id: 'anneau_leviathan', time: '30m',
				ingredients: [
					{ id: 'carapace_requin', qty: 96 },
					{ id: 'coeur_nymbrea', qty: 5 },
				]
			}
		]
  },
	{
    id: 'marchand_itinerant_virelune',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Virelune',
    regionId: 'm1m17',
    img: '../img/compendium/montages/itinerant_virelune.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'tissu_araignee',  buy: 12,price: 9 },
      { id: 'fil_araignee', buy: 14,price: 10.5 },
			{ id: 'carapace_requin', buy: 13,price: 9.75 },
			{ id: 'coeur_nymbrea', price: 750 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	//#endregion Virelune
	//#region Tolbana
  {
    id: 'repreneur_butin_tolbana',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Tolbana',
		regionId: 'm1b7',
    img: '../img/compendium/montages/butin_tolbana.png',
    lore: "Reprends des gelés et de la faune locale.",
    sells: [
      { id: 'peau_dur_glacial',  price: 10 },
      { id: 'eclat_magique_glacial', price: 8 },
			{ id: 'poussiere_givre', price: 6 },
			{ id: 'carapace_requin', price: 6.5 },
			{ id: 'fil_araignee', price: 6 },
			{ id: 'tissu_araignee', price: 7 },
			{ id: 'peau_cerf_montagnes', price: 6 },
			{ id: 'fragment_ame_ours', price: 3500 },
    ],
  },
  {
    id: 'marchand_equipement_tolbana',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m9',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
  },
  {
    id: 'marchand_accessoire_tolbana',
    name: "Marchand d'Accessoires",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m4',
    img: '../img/compendium/montages/accessoires_tolbana.png',
    lore: "Vends des Accessoires pour aventuriers agguéris.",
    sells: [
      { id: 'bague_squelette',  price: 1000 },
      { id: 'bracelet_cerf', price: 2500 },
    ],
  },
	{
    id: 'marchand_consommable_tolbana',
    name: "Marchand de Consommable",
    tag: 'marchand_consommable',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m4',
    img: '../img/compendium/textures/items/Consommable/strengthpot_1.png',
    lore: "Vends des Consommable pour Aventuriers.",
    sells: [
      { id: 'potion_vie_1',  price: 20 },
      { id: 'potion_vie_2',  price: 40 },
			{ id: 'potion_mana_1',  price: 20 },
      { id: 'potion_mana_2',  price: 40 },
			{ id: 'potion_stamina_1',  price: 20 },
      { id: 'potion_stamina_2',  price: 40 },
			{ id: 'parchemin_changement',  price: 1500 },
			{ id: 'parchemin_reallocation',  price: 750 },
			{ id: 'parchemin_maitrise',  price: 750 },
    ],
  },
	{
    id: 'alchimiste_tolbana',
    name: "Alchimiste",
    tag: 'alchimiste',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a15',
    img: '../img/compendium/textures/items/Consommable/strengthpot_3.png',
    lore: "Concocte des Potions et des Cristaux.",
    craft: [
      { id: 'potion_vie_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_vie_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_vie_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_soin', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_mana_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_mana_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_mana_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_mana', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_stamina_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_stamina_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_stamina_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_stamina', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'cristal_puissance', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
    ],
  },
	{
    id: 'marchand_outils_tolbana',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m7',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
			{ id: 'torche',  buy: 2500 },
    ],
  },
	{
    id: 'marchand_itinerant_tolbana',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m13',
    img: '../img/compendium/montages/itinerant_tolbana.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'peau_dur_glacial',  buy: 20, price: 15 },
			{ id: 'eclat_magique_glacial',  buy: 16, price: 12 },
			{ id: 'poussiere_givre',  buy: 12, price: 9 },
			{ id: 'fragment_ame_ours',  price: 5250 },
			{ id: 'peau_cerf_montagnes',  buy: 12, price: 9 },
			{ id: 'tissu_araignee',  buy: 14, price: 10.5 },
			{ id: 'fil_araignee',  buy: 12, price: 9 },
			{ id: 'carapace_requin',  buy: 13, price: 9.75 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	{
    id: 'secret_cerfs',
    name: "Fabricant de la Ceinture des Cerfs",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1c10',
    img: '../img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Ceinture des Cerfs.png',
    lore: "Permet le fabrication de l'Accessoires Ceinture des Cerfs.",
    craft: [
			{ 
				id: 'ceinture_cerfs', time: '30m',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 96 },
				]
			}
		]
  },
	{
    id: 'forgeron_armes_tolbana',
    name: "Forgeron d'Armes de Tolbana",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a9',
    img: '../img/compendium/montages/armes_tolbana.png',
    lore: "Permet le fabrication d'armes pour les aventuriers aggueris.",
    craft: [
      { id: 'epee_magique', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'marteau_magique', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'bouclier_resistant_tolbana', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 24 },
					{ id: 'peau_dur_glacial', qty: 30 },
				]
			},
			{ id: 'bouclier_puissant_tolbana', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 24 },
					{ id: 'peau_dur_glacial', qty: 30 },
				]
			},
			{ id: 'dague_sombre', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 24 },
				]
			},
			{ id: 'longue_dague_sombre', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 24 },
				]
			},
			{ id: 'arc_chasse', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'arbalete_chasse', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'baton_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'baton_magicien_puissant', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'grimoire_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 20 },
					{ id: 'poussiere_givre', qty: 20 },
				]
			},
			{ id: 'baton_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'baton_sorcier_puissant', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'grimoire_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 20 },
					{ id: 'poussiere_givre', qty: 20 },
				]
			},
    ],
  },
	{
    id: 'forgeron_armures_tolbana',
    name: "Forgeron d'Armures de Tolbana",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a10',
    img: '../img/compendium/textures/armors/helmet_titan.png',
    lore: "Permet le fabrication d'armures pour les aventuriers aggueris.",
    craft: [
      { id: 'tunique_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 12 },
				]
			},
			{ id: 'robe_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 20 },
				]
			},
			{ id: 'pantalon_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 15 },
				]
			},
			{ id: 'sandales_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 12 },
				]
			},
			{ id: 'casque_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 15 },
					{ id: 'peau_dur_glacial', qty: 25 },
				]
			},
			{ id: 'plastron_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 12 },
				]
			},
			{ id: 'robe_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 20 },
				]
			},
			{ id: 'pantalon_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 15 },
				]
			},
			{ id: 'sandales_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 12 },
				]
			},
			{ id: 'tunique_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 12 },
				]
			},
    ],
  },
	//#endregion Tolbana
	//#region Candelia
	{
    id: 'marchand_outils_candelia',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Candelia',
    regionId: 'm1m10',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
			{ id: 'torche',  buy: 2500 },
    ],
  },
  {
    id: 'marchand_itinerant_candelia',
    name: "Marchand Itinérant",
    tag: 'marchand_itinerant',
    palier: 1,
    region: 'Forêt d\'Arakh\'Nol',
    regionId: 'm1m11',
    img: '../img/compendium/montages/itinerant_virelune.png',
    lore: "Vends & Achète nombreux objets locaux et originaire du Palier 1",
    sells: [
      { id: 'tissu_araignee',  buy: 12, price: 9 },
			{ id: 'fil_araignee',  buy: 14, price: 10.5 },
			{ id: 'carapace_requin',  buy: 13, price: 9.75 },
			{ id: 'coeur_nymbrea',  price: 750 },
			{ id: 'bouillon_sanglier',  buy: 15 },
			{ id: 'sandwich_nephentes',  buy: 35 },
			{ id: 'potion_vie_1',  buy: 30, quality:true },
			{ id: 'potion_vie_2',  buy: 55, quality:true },
			{ id: 'potion_vie_3',  buy: 85, quality:true },
    ],
  },
	{
    id: 'cle_candelia',
    name: "Fabicant de Clef du Donjon Sanctuaire de Xal'Zirith",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Candelia',
    regionId: 'm1c5',
    img: '../img/compendium/textures/items/Donjon/key_xal.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Sanctuaire de Xal'Zirtih.",
    craft: [
			{ 
				id: 'cle_xal', time: '3m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 20 },
					{ id: 'fil_araignee', qty: 25 },
				]
			}
		]
  },
	{
    id: 'cle_xal',
    name: "Fabicant de Clef du Donjon Sanctuaire de Xal'Zirith",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Sanctuaire de Xal\'Zirith',
    regionId: 'm1c4',
    img: '../img/compendium/textures/items/Donjon/key_xal.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Sanctuaire de Xal'Zirtih.",
    craft: [
			{ 
				id: 'cle_xal', time: '3m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 20 },
					{ id: 'fil_araignee', qty: 25 },
				]
			}
		]
  },
	{
    id: 'secret_citadelle_neiges',
    name: "Fabricant du Bracelet de Glace",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Citdelle des Neiges',
    regionId: 'm1c6',
    img: '../img/compendium/textures/trinkets/P1/Bracelet de Glace.png',
    lore: "Permet le fabrication de l'Accessoires Bracelet de Glace.",
    craft: [
			{ 
				id: 'bracelet_glace', time: '30m',
				ingredients: [
					{ id: 'poussiere_givre', qty: 32 },
					{ id: 'eclat_magique_glacial', qty: 32 },
					{ id: 'peau_dur_glacial', qty: 32 },
					{ id: 'fragment_ame_ours', qty: 1 },
				]
			}
		]
  },
	{
    id: 'secret_arakh\'nol',
    name: "Fabicant du Collier d'Aragorn",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Forêt d\'Arakh\'Nol',
    regionId: 'm1c9',
    img: '../img/compendium/textures/trinkets/P1/Collier de Aragorn.png',
    lore: "Permet le fabrication de l'Accessoires Bracelet de Glace.",
    craft: [
			{ 
				id: 'collier_aragorn', time: '30m',
				ingredients: [
					{ id: 'fil_araignee', qty: 64 },
					{ id: 'fil_araignee_renforce', qty: 32 },
					{ id: 'venin_araignee', qty: 1 },
				]
			}
		]
  },
	//#endregion Candelia
	//#region Labyrinthe des Déchus
	{
    id: 'forgeron_armes_labyrinthe',
    name: "Forgeron d'Armes du Labyrinthe",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1a11',
    img: '../img/compendium/montages/armes_labyrinthe.png',
    lore: "Permet le fabrication d'armes pour les aventuriers expérimentés.",
    craft: [
      { id: 'lingot_ame_metal', time: '10s',
				ingredients: [
					{ id: 'piece_ame_metal', qty: 10 },
					{ id: 'fer', qty: 5 },
					{ id: 'charbon', qty: 3 },
				]
			},
			{ id: 'lingot_metal_enchante', time: '10s',
				ingredients: [
					{ id: 'piece_metal_enchante', qty: 10 },
					{ id: 'fer', qty: 5 },
					{ id: 'charbon', qty: 3 },
				]
			},
			{ id: 'fil_araignee_renforce', time: '10s',
				ingredients: [
					{ id: 'fil_araignee', qty: 3 },
					{ id: 'piece_metal_enchante', qty: 6 },
				]
			},
			{ id: 'ame_reaper', time: '3m',
				ingredients: [
					{ id: 'eclat_fusionne', qty: 3 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'ame_warden', time: '3m',
				ingredients: [
					{ id: 'fragment_casse_rouge', qty: 25 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'ame_herald', time: '3m',
				ingredients: [
					{ id: 'fragment_casse_jaune', qty: 25 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'pioche_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'hache_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 22 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'houe_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'epee_gardien', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_jaune', qty: 30 },
					{ id: 'ame_herald', qty: 1 },
				]
			},
			{ id: 'dague_heroique', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_violet', qty: 21 },
					{ id: 'lingot_ame_metal', qty: 5 },
				]
			},
			{ id: 'katana_heroique', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_violet', qty: 21 },
					{ id: 'lingot_ame_metal', qty: 5 },
				]
			},
			{ id: 'arc_fallen', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 12 },
					{ id: 'fil_araignee_renforce', qty: 7 },
				]
			},
			{ id: 'baton_obscur_mage', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'baton_obscur_puissant_mage', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'grimoire_obscur', time: '5m',
				ingredients: [
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fragment_casse_violet', qty: 12 },
					{ id: 'brindille_enchantee', qty: 16 },
				]
			},
			{ id: 'baton_obscur_shaman', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'baton_obscur_puissant_shaman', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'grimoire_fantomatique', time: '5m',
				ingredients: [
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fragment_casse_violet', qty: 12 },
					{ id: 'brindille_enchantee', qty: 16 },
				]
			},
    ],
  },
	{
    id: 'forgeron_armures_labyrinthe',
    name: "Forgeron d'Armures du Labyrinthe",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1a12',
    img: '../img/compendium/textures/armors/helmet_gardien.png',
    lore: "Permet le fabrication d'armures pour les aventuriers expérimentés.",
    craft: [
			{ id: 'eclat_fusionne', time: '10s',
				ingredients: [
					{ id: 'fragment_casse_violet', qty: 5 },
				]
			},
			{ id: 'casque_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 10 },
				]
			},
			{ id: 'plastron_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 24 },
					{ id: 'fragment_casse_rouge', qty: 14 },
				]
			},
      { id: 'jambieres_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 10 },
				]
			},
			{ id: 'bottes_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 9 },
				]
			},

			{ id: 'casque_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 10 },
				]
			},
			{ id: 'plastron_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 24 },
					{ id: 'fragment_casse_jaune', qty: 14 },
				]
			},
      { id: 'jambieres_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 10 },
				]
			},
			{ id: 'bottes_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 9 },
				]
			},

			{ id: 'casque_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 3 },
				]
			},
			{ id: 'plastron_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 24 },
					{ id: 'eclat_fusionne', qty: 6 },
				]
			},
      { id: 'jambieres_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 4 },
				]
			},
			{ id: 'bottes_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 5 },
				]
			},
    ],
  },
	{
    id: 'cle_labyrinthe',
    name: "Fabicant de Clef du Donjon Labyrinthe des Déchus",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Labyrinthe des Déchus',
    regionId: 'm1c3',
    img: '../img/compendium/textures/items/Donjon/key_laby.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Labyrinthe des Déchus.",
    craft: [
			{ 
				id: 'cle_dechu', time: '3m',
				ingredients: [
					{ id: 'fragment_de_feuille', qty: 20 },
					{ id: 'tissu_maudit', qty: 15 },
					{ id: 'ames_des_ruines', qty: 10 },
				]
			}
		]
  },
	//#endregion Labyrinthe des Déchus
	//#endregion Palier 1
	//#region Palier 2
	//#region Urbus
	{
    id: 'repreneur_butin_urbus',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 2,
    region: 'Urbus',
		regionId: 'm2b1',
    img: '../img/compendium/montages/butin_urbus.png',
    lore: "Reprends des objets de Taureaux et d'Ours.",
    sells: [
      { id: 'peau_epaisse',  price: 10 },
      { id: 'corne_taureau', price: 12 },
			{ id: 'griffe_ours', price: 8 },
			{ id: 'peau_ours', price: 8 },
			{ id: 'residu_miel', price: 8 },
			{ id: 'graisse_ours', price: 15 },
    ],
  },
	{
    id: 'refaconneur_urbus',
    name: "Refaçonneur",
    tag: 'refaconneur',
    palier: 2,
    region: 'Urbus',
    regionId: 'm2a3',
    img: '../img/compendium/montages/refaconneur_urbus.png',
    lore: "Transforme des Ressources et des Fils d'Araignées pour réaliser des ficelles utile dans la confection d'Accessoires.",
    craft: [
			{ 
				id: 'ficelle_acacia', time: '1m',
				ingredients: [
					{ id: 'acacia', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_ferraille', time: '1m',
				ingredients: [
					{ id: 'fer', qty: 1 },
					{ id: 'ferraille', qty: 1 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_bauxite', time: '1m',
				ingredients: [
					{ id: 'bauxite', qty: 1 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_onyx_impur', time: '1m',
				ingredients: [
					{ id: 'onyx_impur', qty: 2 },
					{ id: 'fil_araignee', qty: 8 },
				]
			},
			{ 
				id: 'ficelle_onyx_pur', time: '1m',
				ingredients: [
					{ id: 'onyx_pur', qty: 2 },
					{ id: 'fil_araignee', qty: 8 },
				]
			}
		]
  },
	{
    id: 'forgeron_accessoires_urbus',
    name: "Forgeron d'Accessoires",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Urbus',
    regionId: 'm2a4',
    img: '../img/compendium/montages/forgeron_accessoires_urbus.png',
    lore: "Permet la création d'Accessoires puissant.",
    craft: [
			{ 
				id: 'bague_bouleau', time: '15m',
				ingredients: [
					{ id: 'lingot_fer', qty: 16 },
					{ id: 'bouleau', qty: 32 },
				]
			},
			{ 
				id: 'anneau_acacia', time: '15m',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 32 },
					{ id: 'planche_acacia', qty: 32 },
				]
			},
			{ 
				id: 'bracelet_mielleux', time: '15m',
				ingredients: [
					{ id: 'residu_miel', qty: 64 },
					{ id: 'carapace_abeille', qty: 16 },
				]
			},
			{ 
				id: 'bracelet_runimiel', time: '15m',
				ingredients: [
					{ id: 'residu_miel', qty: 48 },
					{ id: 'lingot_fer', qty: 16 },
				]
			},
			{ 
				id: 'collier_tricolore', time: '15m',
				ingredients: [
					{ id: 'plume_enflammee', qty: 32 },
					{ id: 'plume_ondoyante', qty: 32 },
					{ id: 'plume_terreuse', qty: 32 },
					{ id: 'lingot_fer', qty: 8 },
				]
			},
			{ 
				id: 'collier_acamiel', time: '15m',
				ingredients: [
					{ id: 'residu_miel', qty: 16 },
					{ id: 'planche_acacia', qty: 32 },
					{ id: 'ficelle_ferraille', qty: 8 },
				]
			},
			{ 
				id: 'gants_ours', time: '15m',
				ingredients: [
					{ id: 'peau_ours', qty: 48 },
					{ id: 'graisse_ours', qty: 16 },
				]
			}
		]
  },
	{
    id: 'forgeron_lingots_urbus',
    name: "Forgeron de Lingots de Bauxite & d'Onyx Impur",
    tag: 'forgeron_lingots',
    palier: 2,
    region: 'Urbus',
    regionId: 'm2a5',
    img: '../img/compendium/montages/lingots_urbus.png',
    lore: "Permet le fabrication de Lingots de Bauxite et de Lingots d'Onyx Impur.",
    craft: [
			{ 
				id: 'lingot_bauxite', time: '15s',
				ingredients: [
					{ id: 'bauxite', qty: 4 },
					{ id: 'charbon', qty: 3 },
				]
			},
			{ 
				id: 'lingot_onyx_impur', time: '30s',
				ingredients: [
					{ id: 'onyx_impur', qty: 10 },
					{ id: 'charbon', qty: 5 },
				]
			},
		]
  },
	//#endregion Urbus
	//#region Kaelor
	{
    id: 'repreneur_butin_kaelor',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 2,
    region: 'Kaelor',
		regionId: 'm2b2',
    img: '../img/compendium/montages/butin_kaelor.png',
    lore: "Reprends des objets des Harpies et des Loups au Nord de Kaelor.",
    sells: [
      { id: 'plume_terreuse',  price: 9 },
      { id: 'plume_enflammee', price: 9 },
			{ id: 'plume_ondoyante', price: 9 },
			{ id: 'oeuf_harpie_eau', price: 11 },
			{ id: 'fourrure_loup_p2', price: 8 },
			{ id: 'ecaille_fulgurante', price: 10 },
    ],
  },
	{
    id: 'marchand_equipement_kaelor',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2m1',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
	},
	{
    id: 'marchand_accessoires_kaelor',
    name: "Marchand d'Accessoires",
    tag: 'marchand_accessoires',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2m2',
    img: '../img/compendium/montages/marchand_accessoires_kaelor.png',
    lore: "Vends des Accessoires simple mais efficace pour commencer son aventure du Palier 2.",
    sells: [
      { id: 'bracelet_loups',  buy: 5000 },
			{ id: 'simple_ceinture',  buy: 5000 },
			{ id: 'anneau_mielleux',  buy: 5000 },
			{ id: 'gants_taureaux',  buy: 5000 },
    ],
	},
	{
    id: 'marchand_outils_kaelor',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2m3',
    img: '',
    lore: "Vends des Outils du Palier 2; outils de la Savane.",
    sells: [
      { id: 'pioche_savane',  buy: 250 },
			{ id: 'hache_savane',  buy: 250 },
			{ id: 'houe_savane',  buy: 250 },
    ],
	},
	{
    id: 'bucheron_kaelor',
    name: "Bucheron",
    tag: 'bucheron',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2a2',
    img: '../img/compendium/textures/items/Ressources/planche_acacia.png',
    lore: "Réalise des Planches de Bois et de la Poudre de Bois.",
    craft: [
      { id: 'planche_chene', time: '15s',
				ingredients: [
					{ id: 'chene', qty: 2 },
				]
			},
			{ id: 'planche_bouleau', time: '15s',
				ingredients: [
					{ id: 'bouleau', qty: 2 },
				]
			},
			{ id: 'planche_acacia', time: '15s',
				ingredients: [
					{ id: 'acacia', qty: 2 },
				]
			},
			{ id: 'planche_sapin', time: '15s',
				ingredients: [
					{ id: 'sapin', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_chene', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_bouleau', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_acacia', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_sapin', qty: 2 },
				]
			},
		]
  },
	{
    id: 'alchimiste_kaelor',
    name: "Alchimiste",
    tag: 'alchimiste',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2a1',
    img: '../img/compendium/textures/items/Consommable/strengthpot_3.png',
    lore: "Concocte des Potions et des Cristaux.",
    craft: [
      { id: 'potion_vie_1', time: '10s',
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_vie_2', time: '15s',
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_vie_3', time: '20s',
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'potion_mana_1', time: '10s',
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_mana_2', time: '15s',
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_mana_3', time: '20s',
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'potion_stamina_1', time: '10s',
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_stamina_2', time: '15s',
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_stamina_3', time: '20s',
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_soin', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
    ],
  },
	{
    id: 'forgeron_accessoires_kaelor',
    name: "Forgeron d'Accessoires",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Kaelor',
    regionId: 'm2a7',
    img: '../img/compendium/montages/forgeron_accessoires_kaelor.png',
    lore: "Permet le fabrication d'Accessoires à base de Taureaux & d'Ours.",
    craft: [
			{ 
				id: 'collier_taureaux', time: '15m',
				ingredients: [
					{ id: 'corne_taureau', qty: 12 },
					{ id: 'peau_epaisse', qty: 12 },
					{ id: 'ficelle_bouleau', qty: 6 },
				]
			},
			{ 
				id: 'anneau_taureau', time: '15m',
				ingredients: [
					{ id: 'corne_taureau', qty: 16 },
					{ id: 'peau_epaisse', qty: 16 },
				]
			},
			{ 
				id: 'ceinture_taureau', time: '15m',
				ingredients: [
					{ id: 'corne_taureau', qty: 8 },
					{ id: 'peau_epaisse', qty: 24 },
				]
			},
			{ 
				id: 'anneau_ours', time: '15m',
				ingredients: [
					{ id: 'peau_ours', qty: 24 },
					{ id: 'graisse_ours', qty: 4 },
					{ id: 'griffe_ours', qty: 8 },
				]
			},
			{ 
				id: 'ceinture_ours', time: '15m',
				ingredients: [
					{ id: 'peau_ours', qty: 48 },
					{ id: 'graisse_ours', qty: 16 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_ferraille',
    name: "Forgeron d'Accessoires de Ferraille",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Baie des Monstres Ondoyante',
    regionId: 'm2a8',
    img: '../img/compendium/textures/trinkets/P2/Set de Ferraille/Anneau de Ferraille.png',
    lore: "Permet le fabrication d'Accessoires de Ferraille.",
    craft: [
			{ 
				id: 'anneau_ferraille', time: '5m',
				ingredients: [
					{ id: 'lingot_fer', qty: 4 },
					{ id: 'morceau_ferraille', qty: 24 },
				]
			},
			{ 
				id: 'bracelet_ferraille', time: '5m',
				ingredients: [
					{ id: 'lingot_fer', qty: 8 },
					{ id: 'morceau_ferraille', qty: 32 },
				]
			},
			{ 
				id: 'gants_ferraille', time: '5m',
				ingredients: [
					{ id: 'lingot_fer', qty: 8 },
					{ id: 'morceau_ferraille', qty: 32 },
				]
			},
			{ 
				id: 'amulette_ferraille', time: '5m',
				ingredients: [
					{ id: 'lingot_fer', qty: 4 },
					{ id: 'morceau_ferraille', qty: 24 },
				]
			},
			{ 
				id: 'piece_ferraille', time: '5m',
				ingredients: [
					{ id: 'lingot_fer', qty: 8 },
					{ id: 'morceau_ferraille', qty: 32 },
				]
			},
		]
  },
	//#endregion Kaelor
	//#region Marome
	{
    id: 'repreneur_butin_marome',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 2,
    region: 'Marome',
		regionId: 'm2b3',
    img: '../img/compendium/montages/butin_marome.png',
    lore: "Reprends des objets du Sanctuaire de Khesûn.",
    sells: [
      { id: 'vetement_dechire',  price: 10 },
      { id: 'chaine_spectrale', price: 10 },
			{ id: 'pierre_runique', price: 20 },
			{ id: 'poudre_moelle', price: 9 },
			{ id: 'morceau_ferraille', price: 10 },
    ],
  },
	{
    id: 'forgeron_lingots_marome',
    name: "Forgeron de Lingots d'Onyx Pur",
    tag: 'forgeron_lingots',
    palier: 2,
    region: 'Marome',
    regionId: 'm2a6',
    img: '../img/compendium/textures/items/Ressources/bar_onyx_pur.png',
    lore: "Permet le fabrication de Lingots d'Onyx Pur.",
    craft: [
			{ 
				id: 'lingot_onyx_impur', time: '1m',
				ingredients: [
					{ id: 'onyx_pur', qty: 10 },
					{ id: 'charbon', qty: 5 },
				]
			},
		]
  },
	//#endregion Marome
	//#region Taran
	{
    id: 'forgeron_accessoires_bauxite',
    name: "Forgeron d'Accessoires de Bauxite",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Baobab Millénaire',
    regionId: 'm2a9',
    img: '../img/compendium/textures/trinkets/P2/Set de Bauxite/Anneau de Bauxite.png',
    lore: "Permet le fabrication d'Accessoires de Bauxite.",
    craft: [
			{ 
				id: 'anneau_bauxite', time: '5m',
				ingredients: [
					{ id: 'lingot_bauxite', qty: 16 },
				]
			},
			{ 
				id: 'bracelet_bauxite', time: '5m',
				ingredients: [
					{ id: 'lingot_bauxite', qty: 24 },
				]
			},
			{ 
				id: 'gants_bauxite', time: '5m',
				ingredients: [
					{ id: 'lingot_bauxite', qty: 24 },
				]
			},
			{ 
				id: 'amulette_bauxite', time: '5m',
				ingredients: [
					{ id: 'lingot_bauxite', qty: 16 },
				]
			},
			{ 
				id: 'piece_bauxite', time: '5m',
				ingredients: [
					{ id: 'lingot_bauxite', qty: 24 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_onyx_impur',
    name: "Forgeron d'Accessoires d'Onyx Impur",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Taran',
    regionId: 'm2a10',
    img: '../img/compendium/textures/trinkets/P2/Set d\'Onyx Impur/Anneau d\'Onyx Impur.png',
    lore: "Permet le fabrication d'Accessoires d'Onyx Impur.",
    craft: [
			{ 
				id: 'anneau_onyx_impur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_impur', qty: 16 },
				]
			},
			{ 
				id: 'bracelet_onyx_impur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_impur', qty: 24 },
				]
			},
			{ 
				id: 'gants_onyx_impur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_impur', qty: 24 },
				]
			},
			{ 
				id: 'amulette_onyx_impur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_impur', qty: 16 },
					{ id: 'ficelle_acacia', qty: 8 },
				]
			},
			{ 
				id: 'piece_onyx_impur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_impur', qty: 24 },
				]
			},
		]
  },
	//#endregion Taran
	//#region Faille
	{
    id: 'forgeron_accessoires_onyx_pur',
    name: "Forgeron d'Accessoires d'Onyx Pur",
    tag: 'forgeron_accessoires',
    palier: 2,
    region: 'Grottes de la Faille du Sud-Est',
    regionId: 'm2a1u1',
    img: '../img/compendium/textures/trinkets/P2/Set d\'Onyx Pur/Anneau d\'Onyx Pur.png',
    lore: "Permet le fabrication d'Accessoires d'Onyx Pur.",
    craft: [
			{ 
				id: 'anneau_onyx_pur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_pur', qty: 8 },
				]
			},
			{ 
				id: 'bracelet_onyx_pur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_pur', qty: 12 },
				]
			},
			{ 
				id: 'gants_onyx_pur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_pur', qty: 12 },
				]
			},
			{ 
				id: 'amulette_onyx_pur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_pur', qty: 8 },
					{ id: 'ficelle_bouleau', qty: 8 },
				]
			},
			{ 
				id: 'piece_onyx_pur', time: '10m',
				ingredients: [
					{ id: 'lingot_onyx_pur', qty: 12 },
				]
			},
		]
  },
	//#endregion Faille
	//#endregion Palier 2
];

/* ══════════════════════════════════
   CONSTANTES D'AFFICHAGE
══════════════════════════════════ */
const PNJ_TAG_LABELS = {
  forgeron_armes:       "Forgeron d'Armes",
  forgeron_armures:     "Forgeron d'Armures",
  forgeron_accessoires: "Forgeron d'Accessoires",
  forgeron_lingots:     "Forgeron de Lingots",
  fabricant_cles:       "Fabricant de Clés",
  fabricant_secrets:    "Fabricant Secrets",
  refaconneur:          "Refaçonneur",
  marchand_equipement:  "Marchand d'Équipement",
  marchand_consommable: "Marchand de Consommable",
  marchand_outils:      "Marchand d'Outils",
  marchand_accessoires: "Marchand d'Accessoires",
	marchand_itinerant: 	"Marchand Itinérant",
  repreneur_butin:      "Repreneur de Butin",
  bucheron:             "Bûcheron",
  alchimiste:           "Alchimiste",
  quetes:               "Quêtes",
  autre:                "Autre",
};
const PNJ_TAG_COLORS = {
  forgeron_armes:       '#c8783c',
  forgeron_armures:     '#f15e1a',
  forgeron_accessoires: '#f1b586',
  forgeron_lingots:     '#eed4a4',
  fabricant_cles:       '#f5ac4d',
  fabricant_secrets:    '#8b3c00',
  refaconneur:          '#6e543f',
  marchand_equipement:  '#c9a84c',
  marchand_consommable: '#b19b5f',
  marchand_outils:      '#a09472',
  marchand_accessoires: '#a8b34c',
	marchand_itinerant: 	'#1b4d1f',
  repreneur_butin:      '#8eb155',
  bucheron:             '#5aad64',
  alchimiste:           '#9b6bc9',
  quetes:               '#5899e0',
  autre:                '#7888a0',
};

const TYPE_LABELS     = { boss: 'Boss', mini_boss: 'Mini-Boss', monstre: 'Monstre', sbire: 'Sbire' };
const BEHAVIOR_LABELS = { passif: 'Passif', neutre: 'Neutre', agressif: 'Agressif' };
const DIFF_LABELS     = ['', 'Très facile', 'Facile', 'Moyen', 'Difficile', 'Très difficile'];

const TYPE_COLORS = {
  boss:    { bg: 'rgba(180,40,40,.85)',  text: '#ffc8c8', border: '#c0404055' },
  mini_boss:    { bg: 'rgba(212, 95, 60, 0.85)',  text: '#ffc8c8', border: '#c0404055' },
  monstre: { bg: 'rgba(160,80,20,.85)', text: '#ffd9a0', border: '#c06c2055' },
  sbire:   { bg: 'rgba(50,50,70,.85)',  text: '#b0b8d0', border: '#5055a055' },
};
const BEHAVIOR_COLORS = {
  passif:   '#346f2e',
  neutre:   '#d4c07a',
  agressif: '#df6262',
};
