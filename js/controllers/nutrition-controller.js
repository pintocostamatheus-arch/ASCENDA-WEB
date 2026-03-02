/**
 * Nutrition & Food Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const NutritionController = {

refreshNutritionTab() {

        const nutrition = NutritionService.getToday();

        const profile = ProfileService.get();

        const protGoal = nutrition.proteinTarget || 100;

        const fiberGoal = nutrition.fiberTarget || 28;

        const waterGoal = nutrition.waterMlTarget || 2500;



        const setWidth = (id, cur, goal) => {

            const bar = document.getElementById(id);

            if (bar) bar.style.width = Math.min(100, (cur / goal) * 100) + '%';

        };



        setWidth('protein-bar', nutrition.proteinConsumed || 0, protGoal);

        setWidth('fiber-bar', nutrition.fiberG || 0, fiberGoal);

        setWidth('water-bar', nutrition.waterMl || 0, waterGoal);



        // Update Labels

        const setLabel = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };



        setLabel('nutrition-protein-consumed', Math.round(nutrition.proteinConsumed || 0));

        setLabel('nutrition-protein-goal', protGoal);

        setLabel('protein-remaining', `Faltam ${Math.max(0, protGoal - Math.round(nutrition.proteinConsumed || 0))}g`);



        setLabel('nutrition-fiber-consumed', Math.round(nutrition.fiberG || 0));

        setLabel('nutrition-fiber-goal', fiberGoal);

        setLabel('fiber-remaining', `Faltam ${Math.max(0, fiberGoal - Math.round(nutrition.fiberG || 0))}g`);



        setLabel('nutrition-water-consumed', nutrition.waterMl || 0);

        setLabel('nutrition-water-goal', waterGoal);



        this.renderMealsList(nutrition.meals);

        this.renderCustomFoods();

    },



    addMeal() {

        if (!this.selectedFood) return UI.toast('Selecione um alimento', 'error');

        const qty = parseFloat(document.getElementById('meal-quantity').value);

        const unit = document.getElementById('meal-unit').value;



        NutritionService.addMeal({

            foodName: this.selectedFood.name,

            quantity: qty,

            unit: unit,

            proteinG: Math.round(NutritionService.calculateProtein(this.selectedFood, qty, unit) * 10) / 10,

            fiberG: Math.round(NutritionService.calculateFiber(this.selectedFood, qty, unit) * 10) / 10

        });



        this.selectedFood = null;

        document.getElementById('meal-food').value = '';

        this.refreshNutritionTab();

    },



    updateProteinPreview() {

        if (!this.selectedFood) return;

        const qty = parseFloat(document.getElementById('meal-quantity').value) || 0;

        const unit = document.getElementById('meal-unit').value;

        const prot = NutritionService.calculateProtein(this.selectedFood, qty, unit);

        const fib = NutritionService.calculateFiber(this.selectedFood, qty, unit);

        const preview = document.getElementById('protein-preview');

        if (preview) {

            preview.hidden = false;

            const estimateEl = document.getElementById('protein-estimate');

            if (estimateEl) estimateEl.textContent = Math.round(prot);

        }

    },



    addWater(amount) {

        NutritionService.addWater(amount);

        this.refreshNutritionTab();

        UI.toast(`+ ${amount}ml Água`);

    },



    undoWater() {

        NutritionService.addWater(-250);

        this.refreshNutritionTab();

    },



    quickAddProtein(amount, name) {

        NutritionService.addMeal({

            foodName: name || 'Rápido',

            quantity: 1,

            unit: 'unidade',

            proteinG: amount,

            fiberG: 0

        });

        this.refreshNutritionTab();

        UI.toast(`+ ${amount}g Proteína`);

    },



    quickAddFiber(amount, name) {

        NutritionService.addMeal({

            foodName: name || 'Rápido',

            quantity: 1,

            unit: 'unidade',

            proteinG: 0,

            fiberG: amount

        });

        this.refreshNutritionTab();

        UI.toast(`+ ${amount}g Fibra`);

    },




handleFoodSearch(q) {

    const results = NutritionService.searchFoods(q);

    const list = document.getElementById('food-autocomplete');

    if (!list) return;

    if (results.length === 0) return list.classList.remove('show');



    list.innerHTML = results.map(f => `<div class="autocomplete-item" onclick = "App.selectFood(${f.id})"> ${f.name}</div> `).join('');

    list.classList.add('show');

},



selectFood(id) {

    const food = NutritionService.getAllFoods().find(f => f.id === id);

    if (!food) return;



    this.selectedFood = food;

    document.getElementById('meal-food').value = food.name;

    document.getElementById('food-autocomplete').classList.remove('show');



    // Automatic Unit Selection

    const unitEl = document.getElementById('meal-unit');

    if (unitEl && food.defaultUnit) {

        unitEl.value = food.defaultUnit;

    }



    this.updateProteinPreview();

},



renderMealsList(meals) {

    const list = document.getElementById('meals-today-list');

    if (!list) return;

    list.innerHTML = (meals || []).map(m => `

    <div class="meal-item">

                <span>${m.foodName}</span>

                <span>${(+m.proteinG || 0).toFixed(1)}g P / ${(+m.fiberG || 0).toFixed(1)}g F</span>

                <button onclick="App.deleteMeal(${m.id})">🗑️</button>

            </div>

    `).join('');

},



deleteMeal(id) {

    UI.confirmDelete({

        message: 'Deseja remover esta refeição do registro?',

        onConfirm: () => {

            NutritionService.deleteMeal(id);

            this.refreshNutritionTab();

            UI.toast('Refeição removida');

        }

    });

},




renderCustomFoods() {

    const custom = StorageService.getSafe(StorageService.KEYS.CUSTOM_FOODS, []);

    const list = document.getElementById('custom-foods-list');

    if (!list) return;

    if (custom.length === 0) { list.innerHTML = '<div class="empty-state">Nenhum alimento personalizado</div>'; return; }



    list.innerHTML = custom.map(f => {

        let info = [];

        if (f.proteinPerUnit !== undefined) info.push(`P: ${f.proteinPerUnit} g / un`);

        else if (f.proteinPerScoop !== undefined) info.push(`P: ${f.proteinPerScoop} g / scoop`);

        else if (f.defaultUnit === 'ml') info.push(`P: ${f.proteinPer100g} g / 100ml`);

        else info.push(`P: ${f.proteinPer100g} g / 100g`);



        if (f.fiberPerUnit !== undefined) info.push(`F: ${f.fiberPerUnit} g / un`);

        else if (f.fiberPerScoop !== undefined) info.push(`F: ${f.fiberPerScoop} g / scoop`);

        else if (f.fiberPer100g !== undefined) info.push(`F: ${f.fiberPer100g} g / 100`);



        return `

    <div class="meal-item" style = "cursor: pointer;" data-id="${f.id}">

                    <div class="meal-info">

                        <div class="meal-name">${f.name}</div>

                        <div class="meal-details">${info.join(' | ')}</div>

                    </div>

                    <button class="btn-icon table-btn-delete" data-id="${f.id}">🗑️</button>

                </div> `;

    }).join('');



    // Selection Listener

    list.querySelectorAll('.meal-item').forEach(item => {

        item.onclick = (e) => {

            if (e.target.closest('.table-btn-delete')) return;

            const food = custom.find(f => f.id == item.dataset.id);

            if (food) {

                this.selectedFood = food;

                document.getElementById('meal-food').value = food.name;



                const unitEl = document.getElementById('meal-unit');

                if (unitEl) {

                    if (food.proteinPerUnit !== undefined || food.fiberPerUnit !== undefined) unitEl.value = 'unidade';

                    else if (food.proteinPerScoop !== undefined || food.fiberPerScoop !== undefined) unitEl.value = 'scoop';

                    else if (food.defaultUnit === 'ml') unitEl.value = 'ml';

                    else unitEl.value = 'g';

                }

                this.updateProteinPreview();

                UI.toast('Alimento selecionado: ' + food.name);

            }

        };

    });



    // Delete Listener

    list.querySelectorAll('.table-btn-delete').forEach(btn => {

        btn.onclick = (e) => {

            e.stopPropagation();

            NutritionService.deleteCustomFood(btn.dataset.id); // string — suporta UUID e timestamp

            this.renderCustomFoods();

            UI.toast('Alimento removido');

        };

    });

},



showAddFoodModal() {

    const content = `

    <div class="input-group">

                <label>Nome do Alimento</label>

                <input type="text" id="custom-food-name" class="input-field premium-input" placeholder="Ex: Ovo Cozido">

            </div>

            <div class="input-group">

                <label>Tipo de Medida</label>

                <select id="custom-food-unit-type" class="input-field premium-input">

                    <option value="g">Gramas (100g)</option>

                    <option value="ml">Mililitros (100ml)</option>

                    <option value="un">Unidade</option>

                    <option value="scoop">Scoop</option>

                </select>

            </div>

            <div class="input-row-compact" style="gap: 12px; margin-bottom: 12px;">

                <div class="input-group" style="flex: 1;">

                    <label id="label-protein-value">Proteína (por 100g)</label>

                    <input type="number" id="custom-food-protein" class="input-field premium-input" placeholder="0" step="0.1">

                </div>

                <div class="input-group" style="flex: 1;">

                    <label id="label-fiber-value">Fibra (por 100g)</label>

                    <input type="number" id="custom-food-fiber" class="input-field premium-input" placeholder="0" step="0.1">

                </div>

            </div>

            <div class="input-group">

               <label>Categoria</label>

               <select id="custom-food-category" class="input-field premium-input">

                   <option value="suplemento">Suplemento</option>

                   <option value="carne">Carne</option>

                   <option value="ovo">Ovos/Laticínios</option>

                   <option value="fruta_veggie">Frutas/Vegetais</option>

                   <option value="outro">Outro</option>

               </select>

            </div>

`;

    UI.showModal('Adicionar Alimento', content, [

        { text: 'Cancelar', class: 'btn-secondary', onClick: () => { } },

        {

            text: 'Salvar', class: 'btn-primary', onClick: () => {

                const name = document.getElementById('custom-food-name').value.trim();

                const protein = parseFloat(document.getElementById('custom-food-protein').value) || 0;

                const fiber = parseFloat(document.getElementById('custom-food-fiber').value) || 0;

                const unitType = document.getElementById('custom-food-unit-type').value;

                const category = document.getElementById('custom-food-category').value;



                if (!name || (isNaN(protein) && isNaN(fiber))) { UI.toast('Preencha os campos corretamente', 'error'); return; }



                const foodData = { name, category };



                if (unitType === 'un') {

                    foodData.proteinPerUnit = protein;

                    foodData.fiberPerUnit = fiber;

                    foodData.defaultUnit = 'unidade';

                } else if (unitType === 'scoop') {

                    foodData.proteinPerScoop = protein;

                    foodData.fiberPerScoop = fiber;

                    foodData.defaultUnit = 'scoop';

                } else if (unitType === 'ml') {

                    foodData.proteinPer100g = protein;

                    foodData.fiberPer100g = fiber;

                    foodData.defaultUnit = 'ml';

                } else {

                    foodData.proteinPer100g = protein;

                    foodData.fiberPer100g = fiber;

                    foodData.defaultUnit = 'g';

                }



                NutritionService.addCustomFood(foodData);

                this.renderCustomFoods();

                UI.toast('Alimento salvo!');

                UI.hideModal();

            }, closeOnClick: false

        }

    ], () => {

        // Modal OnRender Callback

        const select = document.getElementById('custom-food-unit-type');

        const labelProt = document.getElementById('label-protein-value');

        const labelFib = document.getElementById('label-fiber-value');

        if (select && labelProt && labelFib) {

            const updateLabels = () => {

                let suffix = '(por 100g)';

                if (select.value === 'un') suffix = '(por Unidade)';

                else if (select.value === 'scoop') suffix = '(por Scoop)';

                else if (select.value === 'ml') suffix = '(por 100ml)';



                labelProt.textContent = `Proteína ${suffix} `;

                labelFib.textContent = `Fibra ${suffix} `;

            };

            select.addEventListener('input', updateLabels);

            select.addEventListener('change', updateLabels);

            updateLabels();

        }

    });

},

};

// Strangler Fig: Mixin into App
Object.assign(App, NutritionController);
