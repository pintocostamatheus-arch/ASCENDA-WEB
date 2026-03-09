/* ============================================
   CONFIGURATION & CONSTANTS
   ============================================ */
window.CONFIG = {
    VERSION: '1.0.0',
    STORAGE_PREFIX: 'monjaro_'
};

// Banco de alimentos embutido (Cardápio Brasileiro Completo — Proteína & Fibra)
window.FOODS_BUILTIN = [

    // ── CARNES ─────────────────────────────────────────────
    { id: 1, name: "Peito de Frango Grelhado", proteinPer100g: 31, fiberPer100g: 0, defaultUnit: "g" },
    { id: 2, name: "Patinho Moído (Carne Magra)", proteinPer100g: 26, fiberPer100g: 0, defaultUnit: "g" },
    { id: 3, name: "Fígado de Boi (Grelhado)", proteinPer100g: 29, fiberPer100g: 0, defaultUnit: "g" },
    { id: 4, name: "Moela de Frango (Cozida)", proteinPer100g: 25, fiberPer100g: 0, defaultUnit: "g" },
    { id: 5, name: "Fígado de Frango (Cozido)", proteinPer100g: 25, fiberPer100g: 0, defaultUnit: "g" },
    { id: 6, name: "Coração de Boi (Grelhado)", proteinPer100g: 28, fiberPer100g: 0, defaultUnit: "g" },
    { id: 7, name: "Lombo Suíno Grelhado", proteinPer100g: 27, fiberPer100g: 0, defaultUnit: "g" },
    { id: 13, name: "Peito de Peru Defumado", proteinPer100g: 29, fiberPer100g: 0, defaultUnit: "g" },
    { id: 14, name: "Codornas (Cozidas)", proteinPer100g: 25, fiberPer100g: 0, defaultUnit: "g" },
    { id: 66, name: "Alcatra Grelhada", proteinPer100g: 28, fiberPer100g: 0, defaultUnit: "g" },
    { id: 67, name: "Fraldinha Grelhada", proteinPer100g: 26, fiberPer100g: 0, defaultUnit: "g" },
    { id: 68, name: "Filé Mignon", proteinPer100g: 27, fiberPer100g: 0, defaultUnit: "g" },
    { id: 69, name: "Costela de Porco (Assada)", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 70, name: "Frango a Passarinho (Assado)", proteinPer100g: 26, fiberPer100g: 0, defaultUnit: "g" },
    { id: 71, name: "Sobrecoxa de Frango (sem pele)", proteinPer100g: 23, fiberPer100g: 0, defaultUnit: "g" },
    { id: 74, name: "Carne Seca (Dessalgada)", proteinPer100g: 32, fiberPer100g: 0, defaultUnit: "g" },
    { id: 75, name: "Linguiça de Frango (Grelhada)", proteinPer100g: 20, fiberPer100g: 0, defaultUnit: "g" },

    // ── PEIXES E FRUTOS DO MAR ─────────────────────────────
    { id: 8, name: "Filé de Tilápia / Peixe Branco", proteinPer100g: 26, fiberPer100g: 0, defaultUnit: "g" },
    { id: 9, name: "Atum em Lata (em Água)", proteinPer100g: 26, fiberPer100g: 0, defaultUnit: "g" },
    { id: 10, name: "Filé de Truta Grelhado", proteinPer100g: 21, fiberPer100g: 0, defaultUnit: "g" },
    { id: 11, name: "Salmão Grelhado", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 12, name: "Camarão Grelhado", proteinPer100g: 24, fiberPer100g: 0, defaultUnit: "g" },
    { id: 72, name: "Sardinha em Lata (em Água)", proteinPer100g: 25, fiberPer100g: 0, defaultUnit: "g" },
    { id: 73, name: "Bacalhau (Cozido)", proteinPer100g: 23, fiberPer100g: 0, defaultUnit: "g" },

    // ── OVOS ──────────────────────────────────────────────
    { id: 15, name: "Ovo Inteiro", proteinPer100g: 13, fiberPer100g: 0, proteinPerUnit: 6.5, fiberPerUnit: 0, defaultUnit: "unidade" },
    { id: 16, name: "Clara de Ovo", proteinPer100g: 11, fiberPer100g: 0, defaultUnit: "ml" },

    // ── LATICÍNIOS ────────────────────────────────────────
    { id: 19, name: "Iogurte Skyr Natural", proteinPer100g: 11, fiberPer100g: 0, defaultUnit: "g" },
    { id: 20, name: "Iogurte Grego High Protein", proteinPer100g: 10, fiberPer100g: 0, defaultUnit: "g" },
    { id: 21, name: "Queijo Cottage", proteinPer100g: 11, fiberPer100g: 0, defaultUnit: "g" },
    { id: 22, name: "Queijo Minas Frescal Light", proteinPer100g: 17, fiberPer100g: 0, defaultUnit: "g" },
    { id: 23, name: "Ricota", proteinPer100g: 11, fiberPer100g: 0, defaultUnit: "g" },
    { id: 76, name: "Leite Desnatado", proteinPer100g: 3.4, fiberPer100g: 0, defaultUnit: "ml" },
    { id: 77, name: "Leite Integral", proteinPer100g: 3.2, fiberPer100g: 0, defaultUnit: "ml" },
    { id: 78, name: "Queijo Mussarela", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 79, name: "Queijo Parmesão Ralado", proteinPer100g: 35, fiberPer100g: 0, defaultUnit: "g" },
    { id: 80, name: "Requeijão Light", proteinPer100g: 7, fiberPer100g: 0, defaultUnit: "g" },
    { id: 81, name: "Iogurte Natural Integral", proteinPer100g: 3.7, fiberPer100g: 0, defaultUnit: "g" },
    { id: 130, name: "Kefir Líquido", proteinPer100g: 3.5, fiberPer100g: 0, defaultUnit: "ml" },

    // ── SUPLEMENTOS ───────────────────────────────────────
    { id: 17, name: "Whey Protein (Pó)", proteinPer100g: 80, fiberPer100g: 0, proteinPerScoop: 24, fiberPerScoop: 0, defaultUnit: "scoop" },
    { id: 18, name: "Caseína (Pó)", proteinPer100g: 80, fiberPer100g: 0, proteinPerScoop: 24, fiberPerScoop: 0, defaultUnit: "scoop" },
    { id: 126, name: "Colágeno Hidrolisado (Pó)", proteinPer100g: 90, fiberPer100g: 0, proteinPerScoop: 10, fiberPerScoop: 0, defaultUnit: "scoop" },
    { id: 127, name: "Albumina (Pó)", proteinPer100g: 82, fiberPer100g: 0, proteinPerScoop: 24, fiberPerScoop: 0, defaultUnit: "scoop" },
    { id: 128, name: "Proteína Vegana em Pó (Mix)", proteinPer100g: 75, fiberPer100g: 3, proteinPerScoop: 22, fiberPerScoop: 1, defaultUnit: "scoop" },
    { id: 27, name: "Proteína de Ervilha (Pó)", proteinPer100g: 78, fiberPer100g: 2, defaultUnit: "g" },

    // ── LEGUMINOSAS ───────────────────────────────────────
    { id: 29, name: "Lentilha Cozida", proteinPer100g: 9, fiberPer100g: 8, defaultUnit: "g" },
    { id: 30, name: "Grão de Bico Cozido", proteinPer100g: 9, fiberPer100g: 7, defaultUnit: "g" },
    { id: 35, name: "Feijão Preto (Cozido)", proteinPer100g: 9, fiberPer100g: 8.7, defaultUnit: "g" },
    { id: 36, name: "Feijão Carioca (Cozido)", proteinPer100g: 5, fiberPer100g: 8.5, defaultUnit: "g" },
    { id: 65, name: "Ervilha (em lata/sachê)", proteinPer100g: 5, fiberPer100g: 4.5, defaultUnit: "g" },
    { id: 82, name: "Feijão Fradinho (Cozido)", proteinPer100g: 8, fiberPer100g: 6.5, defaultUnit: "g" },
    { id: 83, name: "Soja em Grão (Cozida)", proteinPer100g: 17, fiberPer100g: 6, defaultUnit: "g" },
    { id: 84, name: "PTS — Proteína de Soja Texturizada", proteinPer100g: 52, fiberPer100g: 12, defaultUnit: "g" },
    { id: 85, name: "Vagem Cozida", proteinPer100g: 1.8, fiberPer100g: 3.4, defaultUnit: "g" },
    { id: 28, name: "Edamame Cozido", proteinPer100g: 11, fiberPer100g: 5, defaultUnit: "g" },

    // ── PROTEÍNAS VEGETAIS ────────────────────────────────
    { id: 24, name: "Tofu Firme", proteinPer100g: 10, fiberPer100g: 1, defaultUnit: "g" },
    { id: 25, name: "Seitan (Glúten, Cozido)", proteinPer100g: 25, fiberPer100g: 2, defaultUnit: "g" },
    { id: 26, name: "Tempeh", proteinPer100g: 19, fiberPer100g: 5, defaultUnit: "g" },

    // ── CEREAIS, GRÃOS E SEMENTES ─────────────────────────
    { id: 31, name: "Aveia em Flocos", proteinPer100g: 14, fiberPer100g: 10, defaultUnit: "g" },
    { id: 90, name: "Farinha de Aveia", proteinPer100g: 13, fiberPer100g: 9, defaultUnit: "g" },
    { id: 91, name: "Farelo de Aveia", proteinPer100g: 17, fiberPer100g: 15, defaultUnit: "g" },
    { id: 32, name: "Psyllium (Casca)", proteinPer100g: 2, fiberPer100g: 70, defaultUnit: "g" },
    { id: 33, name: "Semente de Chia", proteinPer100g: 17, fiberPer100g: 34, defaultUnit: "g" },
    { id: 46, name: "Semente de Linhaça", proteinPer100g: 18, fiberPer100g: 27, defaultUnit: "g" },
    { id: 92, name: "Semente de Abóbora (Torrada)", proteinPer100g: 30, fiberPer100g: 6, defaultUnit: "g" },
    { id: 93, name: "Gergelim", proteinPer100g: 18, fiberPer100g: 12, defaultUnit: "g" },
    { id: 47, name: "Quinoa (Cozida)", proteinPer100g: 4.4, fiberPer100g: 2.8, defaultUnit: "g" },
    { id: 86, name: "Arroz Branco (Cozido)", proteinPer100g: 2.5, fiberPer100g: 1.4, defaultUnit: "g" },
    { id: 87, name: "Arroz Integral (Cozido)", proteinPer100g: 2.6, fiberPer100g: 1.8, defaultUnit: "g" },
    { id: 88, name: "Macarrão Integral (Cozido)", proteinPer100g: 5, fiberPer100g: 4.5, defaultUnit: "g" },
    { id: 89, name: "Macarrão Comum (Cozido)", proteinPer100g: 4.5, fiberPer100g: 1.8, defaultUnit: "g" },
    { id: 94, name: "Pipoca Integral (sem manteiga)", proteinPer100g: 11, fiberPer100g: 14.5, defaultUnit: "g" },

    // ── VEGETAIS E TUBÉRCULOS ─────────────────────────────
    { id: 34, name: "Brócolis Cozido", proteinPer100g: 2.8, fiberPer100g: 3.3, defaultUnit: "g" },
    { id: 43, name: "Espinafre (Cozido)", proteinPer100g: 3, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 44, name: "Cenoura (Cozida)", proteinPer100g: 0.8, fiberPer100g: 2.8, defaultUnit: "g" },
    { id: 45, name: "Abóbora Cabotiá", proteinPer100g: 0.7, fiberPer100g: 2.5, defaultUnit: "g" },
    { id: 95, name: "Couve Refogada", proteinPer100g: 3.3, fiberPer100g: 2.0, defaultUnit: "g" },
    { id: 96, name: "Alface", proteinPer100g: 1.2, fiberPer100g: 1.3, defaultUnit: "g" },
    { id: 97, name: "Tomate", proteinPer100g: 0.9, fiberPer100g: 1.2, defaultUnit: "g" },
    { id: 98, name: "Chuchu (Cozido)", proteinPer100g: 0.8, fiberPer100g: 1.7, defaultUnit: "g" },
    { id: 99, name: "Berinjela (Grelhada)", proteinPer100g: 1.0, fiberPer100g: 2.5, defaultUnit: "g" },
    { id: 100, name: "Abobrinha (Refogada)", proteinPer100g: 1.2, fiberPer100g: 1.0, defaultUnit: "g" },
    { id: 101, name: "Repolho (Cru/Cozido)", proteinPer100g: 1.3, fiberPer100g: 2.5, defaultUnit: "g" },
    { id: 102, name: "Beterraba (Cozida)", proteinPer100g: 1.7, fiberPer100g: 2.8, defaultUnit: "g" },
    { id: 103, name: "Batata Doce (Cozida)", proteinPer100g: 1.6, fiberPer100g: 3.3, defaultUnit: "g" },
    { id: 104, name: "Batata Inglesa (Cozida)", proteinPer100g: 2.0, fiberPer100g: 1.8, defaultUnit: "g" },
    { id: 105, name: "Mandioca / Aipim (Cozida)", proteinPer100g: 1.2, fiberPer100g: 1.9, defaultUnit: "g" },
    { id: 106, name: "Inhame (Cozido)", proteinPer100g: 1.5, fiberPer100g: 4.1, defaultUnit: "g" },
    { id: 107, name: "Milho Verde (Cozido)", proteinPer100g: 3.3, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 108, name: "Pepino", proteinPer100g: 0.7, fiberPer100g: 0.5, defaultUnit: "g" },
    { id: 109, name: "Pimentão (Cru)", proteinPer100g: 1.0, fiberPer100g: 1.7, defaultUnit: "g" },
    { id: 110, name: "Quiabo (Cozido)", proteinPer100g: 2.0, fiberPer100g: 3.2, defaultUnit: "g" },

    // ── FRUTAS ────────────────────────────────────────────
    { id: 37, name: "Abacate", proteinPer100g: 2, fiberPer100g: 7, defaultUnit: "g" },
    { id: 38, name: "Maçã (com Casca)", proteinPer100g: 0.3, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 39, name: "Pera (com Casca)", proteinPer100g: 0.4, fiberPer100g: 3.1, defaultUnit: "g" },
    { id: 40, name: "Mamão", proteinPer100g: 0.5, fiberPer100g: 1.7, defaultUnit: "g" },
    { id: 41, name: "Laranja", proteinPer100g: 0.9, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 42, name: "Banana", proteinPer100g: 1.1, fiberPer100g: 2.6, defaultUnit: "g" },
    { id: 48, name: "Goiaba", proteinPer100g: 2.6, fiberPer100g: 5.4, defaultUnit: "g" },
    { id: 49, name: "Morango", proteinPer100g: 0.7, fiberPer100g: 2.0, defaultUnit: "g" },
    { id: 50, name: "Kiwi", proteinPer100g: 1.1, fiberPer100g: 3.0, defaultUnit: "g" },
    { id: 51, name: "Manga", proteinPer100g: 0.8, fiberPer100g: 1.8, defaultUnit: "g" },
    { id: 52, name: "Abacaxi", proteinPer100g: 0.5, fiberPer100g: 1.4, defaultUnit: "g" },
    { id: 53, name: "Ameixa Seca", proteinPer100g: 2.2, fiberPer100g: 7.1, defaultUnit: "g" },
    { id: 54, name: "Figo Seco", proteinPer100g: 3.3, fiberPer100g: 9.8, defaultUnit: "g" },
    { id: 55, name: "Melancia", proteinPer100g: 0.6, fiberPer100g: 0.4, defaultUnit: "g" },
    { id: 56, name: "Uva (com Casca)", proteinPer100g: 0.7, fiberPer100g: 0.9, defaultUnit: "g" },
    { id: 57, name: "Framboesa", proteinPer100g: 1.2, fiberPer100g: 6.5, defaultUnit: "g" },
    { id: 111, name: "Melão", proteinPer100g: 0.5, fiberPer100g: 0.9, defaultUnit: "g" },
    { id: 112, name: "Caju", proteinPer100g: 1.3, fiberPer100g: 1.7, defaultUnit: "g" },
    { id: 113, name: "Maracujá (Polpa)", proteinPer100g: 2.4, fiberPer100g: 1.9, defaultUnit: "g" },
    { id: 114, name: "Graviola", proteinPer100g: 1.0, fiberPer100g: 3.3, defaultUnit: "g" },
    { id: 115, name: "Tamarindo", proteinPer100g: 2.8, fiberPer100g: 5.1, defaultUnit: "g" },

    // ── OLEAGINOSAS ───────────────────────────────────────
    { id: 116, name: "Amendoim (Torrado sem sal)", proteinPer100g: 26, fiberPer100g: 8.5, defaultUnit: "g" },
    { id: 117, name: "Pasta de Amendoim Natural", proteinPer100g: 25, fiberPer100g: 6, defaultUnit: "g" },
    { id: 118, name: "Castanha-do-Pará", proteinPer100g: 14, fiberPer100g: 7.5, defaultUnit: "g" },
    { id: 119, name: "Castanha de Caju (Torrada)", proteinPer100g: 18, fiberPer100g: 3.3, defaultUnit: "g" },
    { id: 120, name: "Nozes", proteinPer100g: 15, fiberPer100g: 6.7, defaultUnit: "g" },
    { id: 121, name: "Amêndoas", proteinPer100g: 21, fiberPer100g: 12.5, defaultUnit: "g" },

    // ── PÃES, MASSAS E CEREAIS FUNCIONAIS ─────────────────
    { id: 58, name: "Pão Integral (Fatia)", proteinPer100g: 9.0, fiberPer100g: 6.0, proteinPerUnit: 3.5, fiberPerUnit: 2.5, defaultUnit: "unidade" },
    { id: 59, name: "Rap 10 Integral (Disco)", proteinPer100g: 8.5, fiberPer100g: 5.5, proteinPerUnit: 2.5, fiberPerUnit: 1.6, defaultUnit: "unidade" },
    { id: 60, name: "Rap 10 Fit / Chia (Disco)", proteinPer100g: 9.0, fiberPer100g: 7.0, proteinPerUnit: 2.7, fiberPerUnit: 2.1, defaultUnit: "unidade" },
    { id: 61, name: "Pão Francês (Unidade)", proteinPer100g: 8.0, fiberPer100g: 2.3, proteinPerUnit: 4.0, fiberPerUnit: 1.1, defaultUnit: "unidade" },
    { id: 62, name: "Tapioca (Massa)", proteinPer100g: 0.2, fiberPer100g: 0.9, defaultUnit: "g" },
    { id: 63, name: "Granola Sem Açúcar", proteinPer100g: 12.0, fiberPer100g: 9.0, defaultUnit: "g" },
    { id: 122, name: "Biscoito de Arroz (Unidade)", proteinPer100g: 8.0, fiberPer100g: 1.5, proteinPerUnit: 0.5, fiberPerUnit: 0.1, defaultUnit: "unidade" },
    { id: 123, name: "Cuscuz de Milho (Cozido)", proteinPer100g: 1.5, fiberPer100g: 1.4, defaultUnit: "g" },
    { id: 124, name: "Beiju / Tapioca Seca", proteinPer100g: 0.3, fiberPer100g: 0.7, defaultUnit: "g" },
    { id: 125, name: "Pão de Queijo (Unidade ~30g)", proteinPer100g: 6.0, fiberPer100g: 0.5, proteinPerUnit: 1.8, fiberPerUnit: 0.2, defaultUnit: "unidade" },

    // ── PEIXES BRASILEIROS (expansão) ────────────────────
    { id: 131, name: "Merluza Grelhada", proteinPer100g: 18, fiberPer100g: 0, defaultUnit: "g" },
    { id: 132, name: "Corvina Grelhada", proteinPer100g: 20, fiberPer100g: 0, defaultUnit: "g" },
    { id: 133, name: "Pintado / Surubim (Grelhado)", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 134, name: "Tambaqui (Assado)", proteinPer100g: 19, fiberPer100g: 0, defaultUnit: "g" },
    { id: 135, name: "Robalo Grelhado", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 136, name: "Pescada Amarela (Cozida)", proteinPer100g: 20, fiberPer100g: 0, defaultUnit: "g" },
    { id: 137, name: "Tucunaré (Assado)", proteinPer100g: 21, fiberPer100g: 0, defaultUnit: "g" },
    { id: 138, name: "Cação / Tubarão (Grelhado)", proteinPer100g: 22, fiberPer100g: 0, defaultUnit: "g" },
    { id: 139, name: "Pirarucu (Assado)", proteinPer100g: 25, fiberPer100g: 0, defaultUnit: "g" },
    { id: 140, name: "Lula (Grelhada)", proteinPer100g: 18, fiberPer100g: 0, defaultUnit: "g" },
    { id: 141, name: "Polvo (Cozido)", proteinPer100g: 15, fiberPer100g: 0, defaultUnit: "g" },
    { id: 142, name: "Mexilhão (Cozido)", proteinPer100g: 12, fiberPer100g: 0, defaultUnit: "g" },

    // ── FRIOS E EMBUTIDOS ─────────────────────────────────
    { id: 143, name: "Presunto Magro (Fatiado)", proteinPer100g: 16, fiberPer100g: 0, defaultUnit: "g" },
    { id: 144, name: "Ovo de Codorna (Unidade)", proteinPer100g: 13, fiberPer100g: 0, proteinPerUnit: 1.6, fiberPerUnit: 0, defaultUnit: "unidade" },
    { id: 145, name: "Frango Desfiado (Sem Pele)", proteinPer100g: 29, fiberPer100g: 0, defaultUnit: "g" },
    { id: 146, name: "Queijo Prato", proteinPer100g: 21, fiberPer100g: 0, defaultUnit: "g" },

    // ── SUPERALIMENTOS / FUNCIONAIS ───────────────────────
    { id: 147, name: "Levedo de Cerveja (Pó)", proteinPer100g: 45, fiberPer100g: 7, defaultUnit: "g" },
    { id: 148, name: "Spirulina (Pó)", proteinPer100g: 57, fiberPer100g: 3, defaultUnit: "g" },
    { id: 149, name: "Farinha de Linhaça Dourada", proteinPer100g: 20, fiberPer100g: 25, defaultUnit: "g" },

    // ── BEBIDAS ───────────────────────────────────────────
    { id: 150, name: "Leite de Aveia", proteinPer100g: 1.0, fiberPer100g: 0.5, defaultUnit: "ml" },
    { id: 151, name: "Leite de Amêndoa (Sem Açúcar)", proteinPer100g: 0.5, fiberPer100g: 0.4, defaultUnit: "ml" },
    { id: 152, name: "Suco de Laranja Natural", proteinPer100g: 0.7, fiberPer100g: 0.4, defaultUnit: "ml" },
    { id: 153, name: "Vitamina de Banana com Leite", proteinPer100g: 2.5, fiberPer100g: 1.0, defaultUnit: "ml" },
];
