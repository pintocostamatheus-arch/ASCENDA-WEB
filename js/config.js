/* ============================================
   CONFIGURATION & CONSTANTS
   ============================================ */
window.CONFIG = {
    VERSION: '1.0.0',
    STORAGE_PREFIX: 'monjaro_',
    // Fatores de proteína por nível de atividade (g/kg)
    PROTEIN_FACTORS: {
        sedentary: 1.3,
        moderate: 1.5,
        'gym2-4': 1.7,
        'gym5+': 1.9
    }
};

// Banco de alimentos embutido (Foco em Densidade Proteica & Nutrição Profissional)
window.FOODS_BUILTIN = [
    { id: 1, name: "Peito de Frango Grelhado", proteinPer100g: 31, defaultUnit: "g" },
    { id: 2, name: "Patinho Moído (Carne Magra)", proteinPer100g: 26, defaultUnit: "g" },
    { id: 3, name: "Fígado de Boi (Grelhado)", proteinPer100g: 29, defaultUnit: "g" },
    { id: 4, name: "Moela de Frango (Cozida)", proteinPer100g: 25, defaultUnit: "g" },
    { id: 5, name: "Fígado de Frango (Cozido)", proteinPer100g: 25, defaultUnit: "g" },
    { id: 6, name: "Coração de Boi (Grelhado)", proteinPer100g: 28, defaultUnit: "g" },
    { id: 7, name: "Lombo Suíno Grelhado", proteinPer100g: 27, defaultUnit: "g" },
    { id: 8, name: "Filé de Tilápia / Peixe Branco", proteinPer100g: 26, defaultUnit: "g" },
    { id: 9, name: "Atum em Lata (em Água)", proteinPer100g: 26, defaultUnit: "g" },
    { id: 10, name: "Filé de Truta Grelhado", proteinPer100g: 21, defaultUnit: "g" },
    { id: 11, name: "Salmão Grelhado", proteinPer100g: 22, defaultUnit: "g" },
    { id: 12, name: "Camarão Grelhado", proteinPer100g: 24, defaultUnit: "g" },
    { id: 13, name: "Peito de Peru Defumado", proteinPer100g: 29, defaultUnit: "g" },
    { id: 14, name: "Codornas (Cozidas)", proteinPer100g: 25, defaultUnit: "g" },
    { id: 15, name: "Ovo Inteiro", proteinPer100g: 13, proteinPerUnit: 6.5, defaultUnit: "unidade" },
    { id: 16, name: "Clara de Ovo", proteinPer100g: 11, defaultUnit: "ml" },
    { id: 17, name: "Whey Protein (Pó)", proteinPer100g: 80, proteinPerScoop: 24, defaultUnit: "scoop" },
    { id: 18, name: "Caseína (Pó)", proteinPer100g: 80, proteinPerScoop: 24, defaultUnit: "scoop" },
    { id: 19, name: "Iogurte Skyr Natural", proteinPer100g: 11, defaultUnit: "g" },
    { id: 20, name: "Iogurte Grego High Protein", proteinPer100g: 10, defaultUnit: "g" },
    { id: 21, name: "Queijo Cottage", proteinPer100g: 11, defaultUnit: "g" },
    { id: 22, name: "Queijo Minas Frescal Light", proteinPer100g: 17, defaultUnit: "g" },
    { id: 23, name: "Ricota", proteinPer100g: 11, defaultUnit: "g" },
    { id: 24, name: "Tofu Firme", proteinPer100g: 10, fiberPer100g: 1, defaultUnit: "g" },
    { id: 25, name: "Seitan (Glúten)", proteinPer100g: 75, fiberPer100g: 2, defaultUnit: "g" },
    { id: 26, name: "Tempeh", proteinPer100g: 19, fiberPer100g: 5, defaultUnit: "g" },
    { id: 27, name: "Proteína de Ervilha (Pó)", proteinPer100g: 78, fiberPer100g: 2, defaultUnit: "g" },
    { id: 28, name: "Edamame Cozido", proteinPer100g: 11, fiberPer100g: 5, defaultUnit: "g" },
    { id: 29, name: "Lentilha Cozida", proteinPer100g: 9, fiberPer100g: 8, defaultUnit: "g" },
    { id: 30, name: "Grão de Bico Cozido", proteinPer100g: 9, fiberPer100g: 7, defaultUnit: "g" },
    { id: 31, name: "Aveia em Flocos", proteinPer100g: 14, fiberPer100g: 10, defaultUnit: "g" },
    { id: 32, name: "Psyllium (Casca)", proteinPer100g: 2, fiberPer100g: 70, defaultUnit: "g" },
    { id: 33, name: "Semente de Chia", proteinPer100g: 17, fiberPer100g: 34, defaultUnit: "g" },
    { id: 34, name: "Brócolis Cozido", proteinPer100g: 2.8, fiberPer100g: 3.3, defaultUnit: "g" },

    // Fiber Expansion
    { id: 35, name: "Feijão Preto (Cozido)", proteinPer100g: 9, fiberPer100g: 8.7, defaultUnit: "g" },
    { id: 36, name: "Feijão Carioca (Cozido)", proteinPer100g: 5, fiberPer100g: 8.5, defaultUnit: "g" },
    { id: 37, name: "Abacate", proteinPer100g: 2, fiberPer100g: 7, defaultUnit: "g" },
    { id: 38, name: "Maçã (com Casca)", proteinPer100g: 0.3, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 39, name: "Pera (com Casca)", proteinPer100g: 0.4, fiberPer100g: 3.1, defaultUnit: "g" },
    { id: 40, name: "Mamão", proteinPer100g: 0.5, fiberPer100g: 1.7, defaultUnit: "g" },
    { id: 41, name: "Laranja", proteinPer100g: 0.9, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 42, name: "Banana", proteinPer100g: 1.1, fiberPer100g: 2.6, defaultUnit: "g" },
    { id: 43, name: "Espinfre (Cozido)", proteinPer100g: 3, fiberPer100g: 2.4, defaultUnit: "g" },
    { id: 44, name: "Cenoura (Cozida)", proteinPer100g: 0.8, fiberPer100g: 2.8, defaultUnit: "g" },
    { id: 45, name: "Abóbora Cabotiá", proteinPer100g: 0.7, fiberPer100g: 2.5, defaultUnit: "g" },
    { id: 46, name: "Semente de Linhaça", proteinPer100g: 18, fiberPer100g: 27, defaultUnit: "g" },
    { id: 47, name: "Quinoa (Cozida)", proteinPer100g: 4.4, fiberPer100g: 2.8, defaultUnit: "g" }
];
