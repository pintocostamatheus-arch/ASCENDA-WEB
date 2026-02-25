/**
 * Profile Management Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const ProfileController = {

loadProfileForm() {
        const p = ProfileService.get();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('profile-name', p.name);
        set('profile-sex', p.sex);
        set('profile-birthdate', p.birthdate);
        set('profile-height', p.heightCm);
        set('profile-weight-goal', p.weightGoalKg);
        set('profile-drug', p.drug || 'none');
        set('profile-activity', p.activityLevel || 'sedentary');
        set('profile-renal', p.kidneyHealth || 'normal');
        set('profile-objective', p.objective || 'loss');
        set('profile-manual-protein', p.manualProteinGoal || '');
        set('profile-manual-fiber', p.manualFiberGoal || '');
        set('profile-manual-water', p.manualWaterGoal || '');

        // Load Avatar
        const imgEl = document.getElementById('profile-photo-img');
        const initialsEl = document.getElementById('avatar-initials');
        if (imgEl && initialsEl) {
            if (p.photo) {
                imgEl.src = p.photo;
                imgEl.style.display = 'block';
                initialsEl.style.display = 'none';
            } else {
                imgEl.style.display = 'none';
                initialsEl.style.display = 'block';
                initialsEl.textContent = (p.name || 'U').charAt(0).toUpperCase();
            }
        }

        // Show/hide remove photo button
        const removeBtn = document.getElementById('btn-remove-photo');
        if (removeBtn) removeBtn.style.display = p.photo ? 'inline-flex' : 'none';
    },

    handleAvatarClick(event) {
        const p = ProfileService.get();
        if (p.photo) {
            // Photo exists: show action sheet instead of file picker
            event.preventDefault();
            UI.openModal('modal-avatar-actions');
            return false;
        }
        // No photo: let the label's default behavior open the file picker
        return true;
    },

    removeProfilePhoto() {
        UI.confirmDelete({
            title: 'Remover Foto',
            message: 'Deseja remover sua foto de perfil?',
            onConfirm: () => {
                const p = ProfileService.get();
                delete p.photo;
                ProfileService.save(p);

                const imgEl = document.getElementById('profile-photo-img');
                const initialsEl = document.getElementById('avatar-initials');
                if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
                if (initialsEl) {
                    initialsEl.style.display = 'block';
                    initialsEl.textContent = (p.name || 'U').charAt(0).toUpperCase();
                }

                // Hide the remove button
                const removeBtn = document.getElementById('btn-remove-photo');
                if (removeBtn) removeBtn.style.display = 'none';

                UI.toast('Foto removida.');
            }
        });
    },

    uploadProfilePhoto(input) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];

        // Reset input immediately so the user can re-select the exact same file 
        // if they close the modal without saving
        input.value = '';

        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            const dataUrl = e.target.result;

            // Open Crop Modal
            UI.openModal('modal-crop-photo');

            // Delay initialization so modal is fully rendered and visible
            setTimeout(() => {
                const container = document.getElementById('croppie-container');
                container.innerHTML = ''; // Clear previous

                // Initialize Croppie
                const croppie = new Croppie(container, {
                    viewport: { width: 200, height: 200, type: 'circle' },
                    boundary: { width: '100%', height: '100%' },
                    showZoomer: true
                    // Removed enableOrientation as it can crash on mobile photos without exif.js
                });

                // Bind image to Croppie
                croppie.bind({
                    url: dataUrl
                }).catch(err => {
                    console.error('Croppie bind error:', err);
                    UI.toast('Erro ao carregar imagem. Tente uma foto menor.');
                });

                // Handle Save
                const saveBtn = document.getElementById('btn-crop-save');
                // Remove old listeners to prevent multiple saves
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

                newSaveBtn.addEventListener('click', () => {
                    newSaveBtn.textContent = 'Salvando...';
                    newSaveBtn.disabled = true;

                    croppie.result({
                        type: 'base64',
                        size: 'viewport',
                        format: 'jpeg',
                        circle: false // viewport creates square
                    }).then((croppedBase64) => {
                        try {
                            const p = ProfileService.get();
                            p.photo = croppedBase64;
                            ProfileService.save(p);

                            // Update UI immediately
                            const imgEl = document.getElementById('profile-photo-img');
                            const initialsEl = document.getElementById('avatar-initials');
                            if (imgEl && initialsEl) {
                                imgEl.src = croppedBase64;
                                imgEl.style.display = 'block';
                                initialsEl.style.display = 'none';
                            }

                            UI.closeModal('modal-crop-photo');
                            UI.toast('Foto de perfil atualizada!');
                        } catch (saveErr) {
                            console.error('Error saving photo:', saveErr);
                            UI.toast('Erro ao salvar. Espaço insuficiente?');
                            newSaveBtn.textContent = 'Salvar Foto';
                            newSaveBtn.disabled = false;
                        }
                    }).catch(err => {
                        console.error('Croppie result error:', err);
                        UI.toast('Erro ao processar o recorte da foto.');
                        newSaveBtn.textContent = 'Salvar Foto';
                        newSaveBtn.disabled = false;
                    });
                });
            }, 400); // Increased delay to 400ms to ensure modal animation completes
        };
        reader.readAsDataURL(file);
    },

    saveProfile() {
        const p = ProfileService.get();
        p.name = document.getElementById('profile-name').value;
        p.sex = document.getElementById('profile-sex').value;
        p.birthdate = document.getElementById('profile-birthdate').value;
        p.heightCm = parseInt(document.getElementById('profile-height').value);
        p.weightGoalKg = parseFloat(document.getElementById('profile-weight-goal').value);

        // Medication Sync
        p.drug = document.getElementById('profile-drug').value;
        p.medication = p.drug;
        p.useMedication = (p.drug !== 'none');

        p.activityLevel = document.getElementById('profile-activity').value;
        p.kidneyHealth = document.getElementById('profile-renal').value;
        p.objective = document.getElementById('profile-objective').value;

        // Manual goals
        const prot = document.getElementById('profile-manual-protein').value;
        const fib = document.getElementById('profile-manual-fiber').value;
        const water = document.getElementById('profile-manual-water').value;

        p.manualProteinGoal = prot ? parseInt(prot) : null;
        p.manualFiberGoal = fib ? parseInt(fib) : null;
        p.manualWaterGoal = water ? parseInt(water) : null;

        ProfileService.save(p);
        UI.toast('Perfil salvo!');

        // Refresh everything to reflect goal changes
        this.refreshDashboard();
        this.refreshNutritionTab();
    },

    openGoalsModal() {
        UI.openModal('modal-saude-estilo');

        // Highlight the manual goals section
        const section = document.querySelector('#modal-saude-estilo .input-row:last-of-type').parentElement;
        if (section) {
            section.classList.add('highlight-section');
            setTimeout(() => section.classList.remove('highlight-section'), 3000);
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

};

// Strangler Fig: Mixin into App
Object.assign(App, ProfileController);
