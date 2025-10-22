// index.js
const mineflayer = require('mineflayer');
const StateManager = require('./statemanager');
const QLearning = require('./qlearning');

// --- Configurações do Bot ---
const botConfig = {
    host: '172.19.195.170',
    port: 59437,
    username: 'IAConfianca',
    version: '1.20.1'
};

// --- Configurações da IA ---
const actions = ['C', 'T', 'D']; // Cooperar, Trair, Desconfiar
let ql = new QLearning(actions, 0.15, 0.85, 0.2, 0.0, 0.05, 0.995);
const stateManager = new StateManager();

// Estado e Curva de Aprendizado
let botLastAction = null;
let botLastState = null;
let pending = null;          // { state, action } para correção temporal
let pendingReward = null;    // Recompensa pendente
let learningCurve = [];
let roundCount = 0;

console.log('[BOT] Iniciando conexão...');
const bot = mineflayer.createBot(botConfig);

// ... (Mantenha os eventos do bot: error, end, kicked, spawn) ...
bot.on('error', err => console.error('[ERRO] Falha ao conectar:', err));
bot.on('end', reason => console.log(`[BOT] Conexão encerrada. Motivo: ${reason}`));
bot.on('kicked', reason => console.log(`[BOT] Kicked: ${reason}`));
bot.once('spawn', () => console.log('[BOT] Entrou no mundo Minecraft. IA pronta!'));

// --- Evento Único para todas as mensagens ---
bot.on('message', async (msg) => {
    const message = msg.toString();

    // Reiniciar aprendizado
    if (message.includes('Sistema reiniciado!')) {
        console.log('[IA] Reiniciando o aprendizado...');
        ql = new QLearning(actions, 0.15, 0.85, 0.2, 0.0, 0.05, 0.995);
        botLastAction = null;
        botLastState = null;
        pending = null;
        pendingReward = null;
        stateManager.opponentHistory = [];
        stateManager.myHistory = [];
        learningCurve = [];
        roundCount = 0;
        console.log('[IA] Aprendizado reiniciado com sucesso.');
        return;
    }

    // Gatilho da jogada
    if (/Jogador jogou!/i.test(message)) {
        console.log(`[IA] Gatilho recebido!`);

        const { playerName, actionValue } = await findPlayerWithAction('acao');

        if (actionValue > 0) {
            const opponentAction = stateManager.numeroParaAcao(actionValue);
            stateManager.atualizarAcaoJogador1(opponentAction);

            // 1. Atualiza Q-Table com transição pendente (correção temporal)
            const oppLast = stateManager.opponentHistory.length > 0
                ? stateManager.opponentHistory[stateManager.opponentHistory.length - 1]
                : null;
            const pattern = stateManager.detectOpponentPattern();
            const currentState = stateManager.buildState(botLastAction, oppLast, pattern.type);

            if (pending && pendingReward !== null) {
                ql.updateQTable(pending.state, pending.action, pendingReward, currentState);
                ql.decayEpsilon();
                pending = null;
                pendingReward = null;
            }

            // 2. Escolhe Ação baseado no estado atual
            botLastState = currentState;
            botLastAction = ql.chooseAction(botLastState);

            // 3. Armazena transição pendente
            pending = { state: botLastState, action: botLastAction };
            stateManager.atualizarMinhaAcao(botLastAction);

            console.log(`[IA] Padrão: ${pattern.type} (${(pattern.confidence * 100).toFixed(0)}%) | Estado: ${botLastState} -> Ação: ${botLastAction}`);
            bot.chat(`/tellraw @a {"text":"IA jogou: ${botLastAction}"}`);
            bot.chat(`/scoreboard players set ${bot.username} acao ${stateManager.acaoParaNumero(botLastAction)}`);
        }
    }

    // Final da rodada
    if (message.includes('A pontuação foi atualizada!')) {
        console.log('[IA] Rodada finalizada. Calculando recompensa...');

        if (botLastAction && botLastState) {
            roundCount++;
            const reward = stateManager.getReward(botLastAction);
            learningCurve.push(reward);
            pendingReward = reward;

            console.log(`[IA] Recompensa recebida: ${reward}`);

            // Geração de gráficos
            printCharts(stateManager.opponentHistory, learningCurve, roundCount, ql.getExplorationRate());
        }
    }
});

// --- Funções auxiliares (Mantenha inalteradas) ---
async function findPlayerWithAction(objective) {
    const players = Object.keys(bot.players);
    for (const playerName of players) {
        if (playerName === bot.username) continue;

        const value = await getScoreboardValue(playerName, objective);
        if (value > 0) {
            return { playerName, actionValue: value };
        }
    }
    return { playerName: null, actionValue: 0 };
}

async function getScoreboardValue(playerName, objective) {
    return new Promise((resolve) => {
        bot.chat(`/scoreboard players get ${playerName} ${objective}`);
        const listener = (msg) => {
            const regex = new RegExp(`${playerName} has (\\d+) \\[.*?\\]`);
            const match = msg.toString().match(regex);
            if (match) {
                bot.off('message', listener);
                resolve(parseInt(match[1]));
            }
        };
        bot.on('message', listener);
        setTimeout(() => {
            bot.off('message', listener);
            resolve(0);
        }, 2000);
    });
}

// --- Funções de Geração de Gráficos (Estilo Matplotlib) ---
function printCharts(history, rewards, currentRound, epsilon) {
    const BAR_WIDTH = 40;
    const CHART_HEIGHT = 15;
    const CHART_WIDTH = 50;
    const actionsMap = { 'C': 'Cooperar', 'T': 'Trair', 'D': 'Desconfiar' };
    const actionsColor = { 'C': '█', 'T': '▓', 'D': '▒' };

    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log(`║           ANÁLISE DE DESEMPENHO - RODADA ${currentRound.toString().padStart(3, '0')}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    // --- [1] DISTRIBUIÇÃO DE AÇÕES DO OPONENTE ---
    console.log('\n┌─ Distribuição de Ações do Oponente ────────────────────────────────┐');

    const counts = history.reduce((acc, action) => {
        acc[action] = (acc[action] || 0) + 1;
        return acc;
    }, {});

    const total = history.length;
    const maxCount = Math.max(...Object.values(counts), 1);

    ['C', 'T', 'D'].forEach(action => {
        const count = counts[action] || 0;
        const percent = total > 0 ? (count / total * 100) : 0;
        const barLength = Math.round((count / maxCount) * BAR_WIDTH);
        const bar = actionsColor[action].repeat(barLength).padEnd(BAR_WIDTH, '░');
        console.log(`│ ${actionsMap[action].padEnd(12)} │${bar}│ ${percent.toFixed(1)}%`);
    });
    console.log('└────────────────────────────────────────────────────────────────────┘');

    // --- [2] CURVA DE APRENDIZADO (Estilo Matplotlib) ---
    console.log('\n┌─ Curva de Aprendizado (Recompensa Média Móvel) ────────────────────┐');

    if (rewards.length === 0) {
        console.log('│  Dados insuficientes                                               │');
        console.log('└────────────────────────────────────────────────────────────────────┘');
        return;
    }

    // Calcula Média Móvel
    const windowSize = Math.min(10, rewards.length);
    let movingAvg = [];
    for (let i = 0; i < rewards.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = rewards.slice(start, i + 1);
        const sum = window.reduce((a, b) => a + b, 0);
        movingAvg.push(sum / window.length);
    }

    // Normalização para o gráfico
    const maxReward = 3.0;
    const minReward = 0.0;

    // Amostragem dos dados se houver muitos pontos
    const dataPoints = movingAvg.length > CHART_WIDTH
        ? movingAvg.filter((_, i) => i % Math.ceil(movingAvg.length / CHART_WIDTH) === 0)
        : movingAvg;

    // Desenha gráfico estilo matplotlib
    console.log(`│ ${maxReward.toFixed(1)} ┤`);

    for (let y = CHART_HEIGHT; y >= 0; y--) {
        const targetValue = minReward + (y / CHART_HEIGHT) * (maxReward - minReward);
        let line = '│';

        if (y === CHART_HEIGHT) line += ' ┌';
        else if (y === 0) line += ' └';
        else line += '  ';

        for (let x = 0; x < dataPoints.length; x++) {
            const value = dataPoints[x];
            const nextValue = x < dataPoints.length - 1 ? dataPoints[x + 1] : value;

            const threshold = (maxReward - minReward) / (CHART_HEIGHT * 2);

            // Desenha a linha
            if (Math.abs(value - targetValue) < threshold) {
                if (x === dataPoints.length - 1) {
                    line += '●'; // Ponto atual
                } else if (nextValue > value) {
                    line += '╱'; // Subindo
                } else if (nextValue < value) {
                    line += '╲'; // Descendo
                } else {
                    line += '─'; // Estável
                }
            } else if (value > targetValue && (value - threshold) < targetValue) {
                line += '▀'; // Acima
            } else if (value < targetValue && (value + threshold) > targetValue) {
                line += '▄'; // Abaixo
            } else {
                line += ' ';
            }
        }

        const label = y === CHART_HEIGHT || y === 0 ? '' : ' ';
        console.log(line);
    }

    console.log(`│ ${minReward.toFixed(1)} └${'─'.repeat(dataPoints.length)}`);
    console.log('└────────────────────────────────────────────────────────────────────┘');

    // --- [3] ESTATÍSTICAS ---
    console.log('\n┌─ Estatísticas de Aprendizado ──────────────────────────────────────┐');
    const currentAvg = movingAvg[movingAvg.length - 1];
    const totalReward = rewards.reduce((sum, r) => sum + r, 0);
    const overallAvg = totalReward / rewards.length;
    const maxRewardObtained = Math.max(...rewards);
    const minRewardObtained = Math.min(...rewards);

    console.log(`│ Rodadas Jogadas      : ${currentRound.toString().padStart(6)}                               │`);
    console.log(`│ Taxa de Exploração   : ${(epsilon * 100).toFixed(1)}%                                   │`);
    console.log(`│ Média Móvel Atual    : ${currentAvg.toFixed(3).padStart(6)}                               │`);
    console.log(`│ Média Geral          : ${overallAvg.toFixed(3).padStart(6)}                               │`);
    console.log(`│ Melhor Recompensa    : ${maxRewardObtained.toString().padStart(6)}                               │`);
    console.log(`│ Pior Recompensa      : ${minRewardObtained.toString().padStart(6)}                               │`);
    console.log('└────────────────────────────────────────────────────────────────────┘\n');
}

