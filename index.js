// index.js
const mineflayer = require('mineflayer');
const StateManager = require('./statemanager');
const QLearning = require('./qlearning');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Configurações do Bot ---
const botConfig = {
    host: '192.168.0.39',
    port: 59437,
    username: 'IAConfianca',
    version: '1.20.1'
};

// --- Configurações da IA --- 
const actions = ['C', 'T']; // Cooperar, Trair
const QTABLE_FILE = path.join(__dirname, 'qtable.json');
const SAVE_INTERVAL = 5;
const TERMINAL_STATE = 'TERMINAL';
let ql = new QLearning(actions, 0.35, 0.85, 0.3, 0.0, 0.05, 0.97);
const stateManager = new StateManager();

loadQTable();

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
bot.once('spawn', () => {
    console.log('[BOT] Entrou no mundo Minecraft. IA pronta!');
    setTimeout(() => {
        bot.chat('/tp IAConfianca 9 -47 -27');
        console.log('[BOT] Teleportado para posição inicial (9, -47, -27)');
    }, 1000);
});

// --- Evento Único para todas as mensagens ---
bot.on('message', async (msg) => {
    const message = msg.toString();
    console.log(`[DEBUG] Mensagem recebida: "${message}"`);

    // Reiniciar aprendizado
    if (message.includes('Sistema reiniciado!')) {
        console.log('[IA] Reiniciando o aprendizado...');
        ql = new QLearning(actions, 0.35, 0.85, 0.3, 0.0, 0.05, 0.97);
        botLastAction = null;
        botLastState = null;
        pending = null;
        pendingReward = null;
        stateManager.opponentHistory = [];
        stateManager.myHistory = [];
        learningCurve = [];
        roundCount = 0;
        if (fs.existsSync(QTABLE_FILE)) {
            fs.unlinkSync(QTABLE_FILE);
            console.log('[IA] Q-table persistente removida. Reinício completo.');
        }
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

            // 2. Escolhe a ação usando Q-Learning
            botLastState = currentState;
            botLastAction = ql.chooseAction(currentState);

            // 3. Armazena transição pendente para próxima atualização
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

        // Pequeno delay para garantir que o scoreboard foi atualizado
        await new Promise(resolve => setTimeout(resolve, 500));

        if (botLastAction && botLastState) {
            roundCount++;

            // Usa a matriz de recompensas definida (Dilema do Prisioneiro)
            // Isso garante recompensas consistentes com a regra de aprendizado
            const reward = stateManager.getReward(botLastAction);
            
            // Log detalhado do resultado
            const opponentLastAction = stateManager.opponentHistory.length > 0 
                ? stateManager.opponentHistory[stateManager.opponentHistory.length - 1]
                : 'desconhecido';
            const outcome = `(IA: ${botLastAction} vs Oponente: ${opponentLastAction})`;
            const rewardType = reward > 0 ? '✅ BOM' : (reward < 0 ? '❌ RUIM' : '⚪ NEUTRO');
            console.log(`[IA] Recompensa: ${reward} ${rewardType} ${outcome}`);

            learningCurve.push(reward);
            pendingReward = reward;

            // Salva a Q-table periodicamente para manter aprendizado entre sessões
            if (roundCount % SAVE_INTERVAL === 0) {
                saveQTable();
            }

            // Geração de gráficos
            printCharts(stateManager.opponentHistory, learningCurve, roundCount, ql.getExplorationRate());
        }
    }
});

// --- Funções de persistência ---
function loadQTable() {
    if (ql.loadQTable(QTABLE_FILE)) {
        console.log('[IA] Q-table carregada de', QTABLE_FILE);
    } else {
        console.log('[IA] Nenhuma Q-table antiga encontrada, iniciando novo aprendizado.');
    }
}

function saveQTable() {
    try {
        ql.saveQTable(QTABLE_FILE);
        console.log('[IA] Q-table salva em', QTABLE_FILE);
    } catch (err) {
        console.error('[IA] Falha ao salvar Q-table:', err.message);
    }
}

function setupExitHandlers() {
    process.on('exit', () => saveQTable());
    process.on('SIGINT', () => {
        saveQTable();
        process.exit();
    });
    process.on('SIGTERM', () => {
        saveQTable();
        process.exit();
    });
}

setupExitHandlers();

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

// --- Função Principal: Gerar Gráficos com Matplotlib ---
function printCharts(history, rewards, currentRound, epsilon) {
    console.log(`[📊] Gerando gráficos com ${history.length} ações e ${rewards.length} recompensas...`);
    generateMatplotlibGraphs(history, rewards, currentRound, epsilon);
}

// --- Geração de Gráficos com Python/Matplotlib ---
function generateMatplotlibGraphs(history, rewards, currentRound, epsilon) {
    const accuracy = stateManager.calculateAccuracy(ql.qTable);
    const trend = stateManager.calculateTrend(rewards);
    const opponentPrediction = stateManager.predictNextOpponentAction();

    console.log(`[IA] Acurácia Real - Taxa de Acerto: ${(accuracy * 100).toFixed(1)}% | Tendência: ${trend}`);
    console.log(`[DEBUG] Histórico IA: [${stateManager.myHistory.slice(-5).join(',')}] | Oponente: [${stateManager.opponentHistory.slice(-5).join(',')}]`);

    // Debug Q-table a cada 10 rodadas
    if (currentRound % 10 === 0) {
        stateManager.debugQTable(ql.qTable);
    }

    const data = {
        history: history,
        rewards: rewards,
        round: currentRound,
        epsilon: epsilon,
        accuracy: accuracy,
        trend: trend,
        opponentPrediction: opponentPrediction,
        myHistory: stateManager.myHistory
    };

    const jsonData = JSON.stringify(data);
    const pythonScript = path.join(__dirname, 'plot_charts.py');

    console.log('\n[📊 MATPLOTLIB] Gerando gráficos...');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const pythonProcess = spawn(pythonCmd, [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.stdin.write(jsonData);
    pythonProcess.stdin.end();

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            try {
                const lines = outputData.trim().split('\n');
                const lastLine = lines[lines.length - 1];

                let result;
                try {
                    result = JSON.parse(lastLine);
                } catch (e) {
                    console.log(outputData);
                    return;
                }

                if (result.success) {
                    console.log(`[✓ MATPLOTLIB] Gráficos salvos: ${path.basename(result.filepath)}`);
                    console.log(`[✓ MATPLOTLIB] Acesse: charts/latest.png\n`);
                } else {
                    console.log(`[✗ MATPLOTLIB] Erro: ${result.message}`);
                }
            } catch (e) {
                console.log(outputData);
            }
        } else {
            console.log(`[✗ MATPLOTLIB] Python não disponível`);
            console.log(`[INFO] Instale: pip install matplotlib\n`);
            // Fallback para gráfico ASCII
            printChartsASCII(history, rewards, currentRound, epsilon);
        }
    });

    pythonProcess.on('error', (err) => {
        console.log('[✗ MATPLOTLIB] Python não encontrado');
        console.log('[INFO] Instale Python 3 e execute: pip install matplotlib\n');
        // Fallback para gráfico ASCII
        printChartsASCII(history, rewards, currentRound, epsilon);
    });
}

// --- Fallback: Gráficos ASCII (se Python não disponível) ---
function printChartsASCII(history, rewards, currentRound, epsilon) {
    const BAR_WIDTH = 40;
    const actionsMap = { 'C': 'Cooperar', 'T': 'Trair' };
    const actionsColor = { 'C': '█', 'T': '▓' };

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

    ['C', 'T'].forEach(action => {
        const count = counts[action] || 0;
        const percent = total > 0 ? (count / total * 100) : 0;
        const barLength = Math.round((count / maxCount) * BAR_WIDTH);
        const bar = actionsColor[action].repeat(barLength).padEnd(BAR_WIDTH, '░');
        console.log(`│ ${actionsMap[action].padEnd(12)} │${bar}│ ${percent.toFixed(1)}%`);
    });
    console.log('└────────────────────────────────────────────────────────────────────┘');

    // --- [2] ACURÁCIA DA IA (Taxa de Acerto Real) ---
    const accuracy = stateManager.calculateAccuracy(ql.qTable);
    const trend = stateManager.calculateTrend(rewards);
    console.log('\n┌─ Acurácia Real da IA (Taxa de Acerto) ──────────────────────────────┐');
    const accBar = '█'.repeat(Math.round(accuracy * BAR_WIDTH)).padEnd(BAR_WIDTH, '░');
    console.log(`│ Taxa de Acerto: ${accBar}│ ${(accuracy * 100).toFixed(1)}%`);
    console.log(`│ Tendência: ${trend.padEnd(BAR_WIDTH - 12)}`);
    console.log('└────────────────────────────────────────────────────────────────────┘');

    // --- [3] PREVISÃO PRÓXIMA AÇÃO OPONENTE ---
    const prediction = stateManager.predictNextOpponentAction();
    console.log('\n┌─ Previsão: Próxima Ação do Oponente ────────────────────────────────┐');
    ['C', 'T'].forEach(action => {
        const prob = prediction[action] || 0;
        const barLength = Math.round(prob * BAR_WIDTH);
        const bar = actionsColor[action].repeat(barLength).padEnd(BAR_WIDTH, '░');
        console.log(`│ ${actionsMap[action].padEnd(12)} │${bar}│ ${(prob * 100).toFixed(1)}%`);
    });
    console.log('└────────────────────────────────────────────────────────────────────┘');

    // Estatísticas simples
    if (rewards.length > 0) {
        console.log('\n┌─ Estatísticas ─────────────────────────────────────────────────────┐');
        const windowSize = Math.min(10, rewards.length);
        let sum = 0;
        for (let i = Math.max(0, rewards.length - windowSize); i < rewards.length; i++) {
            sum += rewards[i];
        }
        const currentAvg = sum / Math.min(windowSize, rewards.length);
        const totalReward = rewards.reduce((s, r) => s + r, 0);
        const overallAvg = totalReward / rewards.length;

        console.log(`│ Rodadas: ${currentRound} | Epsilon: ${(epsilon * 100).toFixed(1)}% | Acurácia: ${(accuracy * 100).toFixed(1)}% │`);
        console.log(`│ Recompensa Total: ${totalReward.toFixed(2)} | Média: ${overallAvg.toFixed(2)} | Recente: ${currentAvg.toFixed(2)} │`);
        console.log('└────────────────────────────────────────────────────────────────────┘');
    }

    // Histórico recente
    if (history.length > 0 && stateManager.myHistory.length > 0) {
        console.log('\n┌─ Histórico Recente (últimas 10 rodadas) ───────────────────────────┐');
        const recentOpp = history.slice(-10);
        const recentMy = stateManager.myHistory.slice(-10);
        const minLen = Math.min(recentOpp.length, recentMy.length);

        for (let i = 0; i < minLen; i++) {
            console.log(`│ Rodada ${String(currentRound - minLen + i + 1).padStart(3, '0')}: IA=${recentMy[i]} | Oponente=${recentOpp[i]} │`);
        }
        console.log('└────────────────────────────────────────────────────────────────────┘');
    }

    console.log('[INFO] Gráficos ASCII (modo fallback)\n');
}