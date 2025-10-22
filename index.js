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
let ql = new QLearning(actions, 0.1, 0.9, 0.2);
const stateManager = new StateManager();

// Histórico
let botLastAction = null;
let opponentHistory = []; // armazena TODAS as jogadas do oponente

console.log('[BOT] Iniciando conexão...');
const bot = mineflayer.createBot(botConfig);

// --- Eventos do Bot ---
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
    ql = new QLearning(actions, 0.1, 0.9, 0.2);
    botLastAction = null;
    opponentHistory = [];
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

      // Atualiza histórico do oponente (sem limite)
      opponentHistory.push(opponentAction);

      // Estado = (última ação IA) + "-" + (todas as ações do oponente)
      const state = `${botLastAction || 'C'}-${opponentHistory.join('-')}`;

      botLastAction = ql.chooseAction(state);

      console.log(`[IA] Estado: ${state} -> Ação escolhida: ${botLastAction}`);
      bot.chat(`/tellraw @a {"text":"IA jogou: ${botLastAction}"}`);
      bot.chat(`/scoreboard players set ${bot.username} acao ${stateManager.acaoParaNumero(botLastAction)}`);
    }
  }

  // Final da rodada
  if (message.includes('A pontuação foi atualizada!')) {
    console.log('[IA] Rodada finalizada. Calculando recompensa...');
    if (botLastAction && opponentHistory.length > 0) {
      const reward = stateManager.getReward(botLastAction);

      const currentState = `${botLastAction}-${opponentHistory.join('-')}`;
      const nextState = `${botLastAction}-${opponentHistory.join('-')}`;

      ql.updateQTable(currentState, botLastAction, reward, nextState);
      console.log(`[IA] Recompensa recebida: ${reward}`);
    }
  }
});

// --- Funções auxiliares ---
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
