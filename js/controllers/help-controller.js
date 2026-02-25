/**
 * Help & Boas Práticas Controller
 * Extracted from app.js — Strangler Fig Pattern
 * Manages: Help tab, Boas Práticas tab (accordion rendering, filtering, toggling)
 */
const HelpController = {

    // ==========================================
    // BOAS PRÁTICAS TAB
    // ==========================================
    BOAS_PRATICAS_CONTENT: [
        {
            icon: '👨‍⚕️',
            title: 'Acompanhamento Médico',
            steps: [
                'Não faça automedicação ou altere sua dose por conta própria. Isso aumenta severamente o risco de efeitos gastrointestinais graves.',
                'O uso de GLP-1/GIP exige exames de rotina (função do rim, fígado, tireoide, etc.) para garantir que seu corpo está lidando bem com a medicação.',
                'Siga o escalonamento de dose (subir a dose aos poucos) prescrito pelo seu médico. A pressa é inimiga da adaptação.'
            ],
            tip: '💡 Mulheres: o emagrecimento rápido aumenta a fertilidade. Se usa anticoncepcional oral, converse com seu médico sobre métodos de barreira, pois a absorção da pílula pode cair.'
        },
        {
            icon: '🥩',
            title: 'Nutrição & Sarcopenia',
            steps: [
                'Bater a meta diária de proteína é <strong>inegociável</strong>. O emagrecimento rápido promovido pela medicação pode consumir sua massa muscular (sarcopenia) e massa óssea.',
                'Acompanhamento com nutricionista clínico é fundamental. O app te dá uma estimativa, mas um profissional planeja sua absorção.',
                'Se não conseguir atingir a meta comida, converse sobre suplementação (como Whey Protein).'
            ],
            tip: '💡 Comer pouca proteína pode deixar você com fraqueza, queda de cabelo intensa e muita flacidez corporal pós-emagrecimento.'
        },
        {
            icon: '💧',
            title: 'Hidratação Diária',
            steps: [
                'As medicações GLP-1/GIP diminuem o reflexo da sede no cérebro e lentificam a digestão.',
                'A consequência número um disso é a <strong>constipação intestinal severa</strong>. Água é o "óleo" que faz o motor funcionar.',
                'Beba sua meta de água todos os dias. Ela é calculada com base no seu peso e atualizada conforme você emagrece.'
            ],
            tip: '💡 A falta de água constante durante grande perda de peso aumenta o risco de desenvolver pedras na vesícula ou sobrecarregar os rins.'
        },
        {
            icon: '🏃‍♂️',
            title: 'Exercício Físico',
            steps: [
                'Seu foco #1 deve ser o <strong>treino de força</strong> (musculação/pilates intenso). O aeróbio (caminhada/corrida) é excelente para o coração, mas sozinho agrava a perda muscular.',
                'A musculação avisa ao corpo que ele "ainda precisa dos músculos" e que a queima de combustível deve focar na gordura.',
                'Consistência é melhor que intensidade extrema esporádica.'
            ],
            tip: '💡 Sem acompanhamento e força física, o reganho de peso pós-tratamento costuma ser na forma de grande volume de gordura, mudando totalmente a composição corporal para pior.'
        },
        {
            icon: '🤢',
            title: 'Manejo de Sintomas',
            steps: [
                '<strong>Náusea Leve:</strong> fracione suas refeições, evite frituras, gorduras e doces excessivos. Não deite logo de barriga cheia.',
                'A medicação atrasa o esvaziamento gástrico, então uma refeição pesada vai ficar muito mais tempo parada no seu estômago.',
                'Monitore seus sintomas diários usando a escala de 0 a 10 no app.'
            ],
            tip: '🚨 ALERTA VERMELHO: Se sentir dor abdominal <strong>muito forte</strong> que irradia para as costas, ou vômitos e diarreia prolongados que não cessam, vá à emergência médica (risco de pancreatite ou obstrução).'
        },
        {
            icon: '💉',
            title: 'Rodízio de Local',
            steps: [
                'Injetar a caneta/seringa toda semana no exato mesmo lugar da barriga pode causar Lipohipertrofia (nódulos duros de gordura debaixo da pele).',
                'O grande perigo do nódulo é que <strong>ele prejudica a absorção</strong>. A medicação fica presa ali e o efeito emagrecedor cai drasticamente.',
                'Siga sempre a Sugestão de Rodízio exibida no dashboard do aplicativo para aplicar em pontos diferentes a cada semana.'
            ],
            tip: '💡 Se for usar a coxa ou braço em vez da barriga, converse com seu médico — a velocidade de absorção da medicação nessas áreas pode ser levemente diferente.'
        }
    ],

    refreshBoasPraticasTab() {
        const accordion = document.getElementById('boaspraticas-accordion');
        if (!accordion || accordion.dataset.loaded) return;
        accordion.dataset.loaded = '1';

        accordion.innerHTML = this.BOAS_PRATICAS_CONTENT.map((section, idx) => `
            <div class="help-section" id="bp-sec-${idx}">
                <button class="help-section-header" onclick="App.toggleBoasPraticas(${idx})" aria-expanded="false">
                    <span class="help-icon">${section.icon}</span>
                    <span class="help-title">${section.title}</span>
                    <span class="help-arrow">▼</span>
                </button>
                <div class="help-section-body">
                    <ul class="help-steps">
                        ${section.steps.map((s, i) => `
                            <li>
                                <span class="help-step-num" style="background:var(--color-primary);color:var(--bg-card);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                                <span>${s}</span>
                            </li>`).join('')}
                    </ul>
                    ${section.tip ? `<div class="help-tip">${section.tip}</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    toggleBoasPraticas(idx) {
        const sec = document.getElementById(`bp-sec-${idx}`);
        if (!sec) return;
        const isOpen = sec.classList.toggle('open');
        const btn = sec.querySelector('.help-section-header');
        const body = sec.querySelector('.help-section-body');

        if (btn) btn.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
            body.style.maxHeight = body.scrollHeight + 'px';
        } else {
            body.style.maxHeight = '0px';
        }
    },

    filterBoasPraticas(query) {
        const q = (query || '').toLowerCase().trim();
        document.querySelectorAll('#boaspraticas-accordion .help-section').forEach((sec, idx) => {
            const content = this.BOAS_PRATICAS_CONTENT[idx];
            if (!content) return;
            const text = (content.title + ' ' + content.steps.join(' ') + ' ' + (content.tip || '')).toLowerCase();
            sec.classList.toggle('help-hidden', q.length > 1 && !text.includes(q));
        });
    },

    // ==========================================
    // HELP TAB
    // ==========================================
    HELP_CONTENT: [
        {
            icon: '🚀',
            title: 'Primeiros Passos',
            steps: [
                'Ao abrir o app pela primeira vez, preencha o <strong>Onboarding</strong> com seus dados pessoais.',
                'Acesse <strong>+</strong> na barra inferior → <strong>Perfil</strong> para revisar suas informações a qualquer momento.',
                'Quanto mais completo o perfil, mais precisas serão as metas de proteína, fibra e água calculadas para você.'
            ],
            tip: '💡 Se o médico mudou sua dose ou medicamento, atualize o campo <strong>Medicamento</strong> no Perfil para que a Calculadora funcione corretamente.'
        },
        {
            icon: '⚖️',
            title: 'Registrar Peso',
            steps: [
                'Toque na aba <strong>Peso</strong> na barra inferior.',
                'Toque em <strong>Registrar Peso</strong> e informe seu peso atual.',
                'O app calcula automaticamente seu <strong>IMC</strong> e atualiza o gráfico de evolução.',
                'Para excluir um registro, toque no ícone de lixeira ao lado do peso no histórico.'
            ],
            tip: '💡 Registre sempre no mesmo horário — de manhã, em jejum e após o banheiro — para comparações mais justas ao longo do tempo.'
        },
        {
            icon: '🥩',
            title: 'Nutrição & Proteína',
            steps: [
                'Acesse a aba <strong>Nutrição</strong> na barra inferior.',
                'Toque em <strong>Adicionar Alimento</strong> para registrar o que você comeu.',
                'O app soma automaticamente proteína, fibra e calorias com base no alimento escolhido.',
                '<strong>Meta personalizada:</strong> se seu nutricionista passou um valor específico, vá em <strong>+ → Perfil → Meta Manual de Proteína</strong>.'
            ],
            tip: '💡 Usuários com GLP-1 têm metas de proteína mais elevadas para preservar músculo durante o emagrecimento.'
        },
        {
            icon: '💧',
            title: 'Hidratação',
            steps: [
                'Na aba <strong>Nutrição</strong>, toque em <strong>Registrar Água</strong>.',
                'Informe a quantidade em ml (Ex: 300ml = um copo grande).',
                'O anel de progresso no <strong>Início</strong> mostrará seu % de hidratação no dia.'
            ],
            tip: '💡 A meta de água é calculada com base no seu peso. Personalize em <strong>Perfil → Meta Manual de Água</strong>.'
        },
        {
            icon: '💉',
            title: 'Injeções & Medicamento',
            steps: [
                'Toque em <strong>+</strong> → <strong>Registrar Injeção</strong> para registrar uma aplicação.',
                'Preencha data, hora, medicamento, dose e local de aplicação.',
                '<strong>Calculadora de UI/Cliques:</strong> na aba Injeções, converte sua dose (mg) em UI ou cliques da caneta.',
                'A <strong>Rotação de Local</strong> sugere o ponto do corpo ideal para a próxima aplicação.',
                'O gráfico de <strong>Nível de Medicação</strong> estima a concentração do medicamento no sangue.'
            ],
            tip: '💡 O rodízio de local é essencial para evitar nódulos sob a pele. O app sugere automaticamente o local que está há mais tempo sem uso.'
        },
        {
            icon: '😷',
            title: 'Registrar Sintomas',
            steps: [
                'Acesse <strong>+ → Sintomas</strong>.',
                'Para cada sintoma, use <strong>-</strong> e <strong>+</strong> para ajustar a intensidade de 0 a 10.',
                'Toque em <strong>Salvar Sintomas do Dia</strong>.',
                'O app analisa padrões e pode emitir <strong>alertas clínicos</strong> se detectar combinações preocupantes.',
                'Para adicionar um sintoma fora da lista, toque em <strong>Adicionar Sintoma</strong>.'
            ],
            tip: '💡 Registre sintomas com frequência. O app usa os últimos 30 dias para detectar padrões — um único registro não gera alertas precisos.'
        },
        {
            icon: '📸',
            title: 'Jornada (Fotos & Marcos)',
            steps: [
                'Acesse <strong>+ → Jornada</strong>.',
                'Toque em <strong>Adicionar Foto</strong> para registrar uma foto de evolução com data e peso.',
                'Toque em <strong>Marco</strong> para registrar conquistas como "Perdi 5kg!".',
                'Em <strong>Medidas Corporais</strong>, registre cintura, abdômen e outros para monitorar a recomposição.',
                'Em <strong>Galeria</strong>, compare todas as fotos para ver o antes e depois.'
            ],
            tip: '💡 Tire fotos sempre com as mesmas condições — mesma roupa, mesma luz, mesmo ângulo — para que a comparação seja justa e motivadora.'
        },
        {
            icon: '📊',
            title: 'Relatórios',
            steps: [
                'Acesse <strong>+ → Relatórios</strong>.',
                'Escolha o período (30, 60, 90 dias ou personalizado).',
                'Toque em <strong>Gerar Relatório PDF</strong>.',
                'O PDF inclui: evolução de peso, injeções, nutrição e sintomas registrados.',
                'Compartilhe com seu médico ou nutricionista pelo WhatsApp, e-mail, etc.'
            ],
            tip: '💡 Gere o relatório antes de cada consulta. Ele ajuda o profissional a ajustar sua dose ou protocolo com base em dados reais.'
        },
        {
            icon: '🔔',
            title: 'Notificações & Lembretes',
            steps: [
                'Acesse <strong>+ → Notificações</strong> (ou através da aba Perfil).',
                'Ative <strong>Lembrete de Água</strong> para receber avisos de hora em hora (ou conforme o intervalo e horário configurados).',
                'Ative <strong>Lembrete de Injeção</strong> para ser avisado 1 dia antes e no próprio dia da sua aplicação.',
                'Importante: o seu navegador ou celular pedirá <strong>permissão</strong> para exibir notificações. Você deve clicar em <strong>Permitir</strong>.'
            ],
            tip: '💡 No iPhone (iOS), notificações de sites (PWA) só funcionam se você adicionar o aplicativo à Tela de Início (opção Compartilhar → Adicionar à Tela de Início).'
        },
        {
            icon: '🔒',
            title: 'Seus Dados & Privacidade',
            steps: [
                'Todos os dados ficam salvos <strong>somente no seu aparelho</strong>. Nada é enviado para a nuvem.',
                'Para <strong>backup</strong>: <strong>+ → Perfil → Exportar Dados</strong> e salve o arquivo JSON.',
                'Para <strong>restaurar</strong> em outro dispositivo, use <strong>Importar Dados</strong> com o arquivo salvo.',
                '<strong>Atenção:</strong> limpar o cache do navegador ou desinstalar o app apaga todos os dados.'
            ],
            tip: '⚠️ Não use <strong>modo aba anônima/privada</strong> — os dados não serão salvos entre sessões.'
        }
    ],

    refreshHelpTab() {
        const accordion = document.getElementById('help-accordion');
        if (!accordion || accordion.dataset.loaded) return;
        accordion.dataset.loaded = '1';

        accordion.innerHTML = this.HELP_CONTENT.map((section, idx) => `
            <div class="help-section" id="help-sec-${idx}">
                <button class="help-section-header" onclick="App.toggleHelp(${idx})" aria-expanded="false">
                    <span class="help-icon">${section.icon}</span>
                    <span class="help-title">${section.title}</span>
                    <span class="help-arrow">▼</span>
                </button>
                <div class="help-section-body">
                    <ul class="help-steps">
                        ${section.steps.map((s, i) => `
                            <li>
                                <span class="help-step-num">${i + 1}</span>
                                <span>${s}</span>
                            </li>`).join('')}
                    </ul>
                    ${section.tip ? `<div class="help-tip">${section.tip}</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    toggleHelp(idx) {
        const sec = document.getElementById(`help-sec-${idx}`);
        if (!sec) return;
        const isOpen = sec.classList.toggle('open');
        const btn = sec.querySelector('.help-section-header');
        const body = sec.querySelector('.help-section-body');

        if (btn) btn.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
            body.style.maxHeight = body.scrollHeight + 'px';
        } else {
            body.style.maxHeight = '0px';
        }
    },

    filterHelp(query) {
        const q = (query || '').toLowerCase().trim();
        document.querySelectorAll('.help-section').forEach((sec, idx) => {
            const content = this.HELP_CONTENT[idx];
            if (!content) return;
            const text = (content.title + ' ' + content.steps.join(' ') + ' ' + (content.tip || '')).toLowerCase();
            sec.classList.toggle('help-hidden', q.length > 1 && !text.includes(q));
        });
    }
};

// Strangler Fig: Mixin into App
Object.assign(App, HelpController);
