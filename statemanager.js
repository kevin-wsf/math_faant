// statemanager.js
class StateManager {
    constructor() {
        this.estadoJogador1 = 'C';
        this.opponentHistory = [];
        this.myHistory = [];
        this.transitionCounts = {}; // Para detecção de padrões
    }

    atualizarAcaoJogador1(acao) {
        this.estadoJogador1 = acao;
        this.opponentHistory.push(acao);
    }

    atualizarMinhaAcao(acao) {
        this.myHistory.push(acao);
    }

    getReward(acaoIA) {
        const acaoJ1 = this.estadoJogador1 || 'C';

        // Matriz de recompensas do jogo real (baseada no sistema de pontuação do servidor)
        // Formato: IA joga X, Jogador joga Y → Recompensa da IA
        const recompensas = {
            'C': { 'C': 1, 'T': 0, 'D': 2 },  // Cooperar: mútuo(1), traído(0), contra D(2)
            'T': { 'C': 3, 'T': 0, 'D': 0 },  // Trair: vs cooperador(3), mútuo(0), bloqueado(0)
            'D': { 'C': 0, 'T': 3, 'D': 0 }   // Desconfiar: desperdiçado(0), defesa(3), mútuo(0)
        };

        return recompensas[acaoIA]?.[acaoJ1] ?? 0;
    }

    numeroParaAcao(numero) {
        return { 1: 'C', 2: 'T', 3: 'D' }[numero];
    }

    acaoParaNumero(acao) {
        return { 'C': 1, 'T': 2, 'D': 3 }[acao];
    }

    // Detector de padrões do oponente
    detectOpponentPattern() {
        const minSamples = 10;
        if (this.opponentHistory.length < minSamples) {
            return { type: 'unknown', confidence: 0 };
        }

        const actions = ['C', 'T', 'D'];
        const counts = { C: 0, T: 0, D: 0 };

        this.opponentHistory.forEach(a => counts[a]++);
        const total = this.opponentHistory.length;

        // Always-C ou Always-T
        for (const action of actions) {
            const freq = counts[action] / total;
            if (freq > 0.8) {
                return { type: `always-${action}`, confidence: freq };
            }
        }

        // Tit-for-Tat (retaliação: oponente copia minha ação anterior)
        if (this.myHistory.length >= minSamples) {
            let tftMatches = 0;
            for (let i = 1; i < Math.min(this.myHistory.length, this.opponentHistory.length); i++) {
                if (this.opponentHistory[i] === this.myHistory[i - 1]) {
                    tftMatches++;
                }
            }
            const tftRate = tftMatches / (Math.min(this.myHistory.length, this.opponentHistory.length) - 1);
            if (tftRate > 0.7) {
                return { type: 'tit-for-tat', confidence: tftRate };
            }
        }

        // Grudger (após primeira traição, sempre trai)
        if (this.myHistory.includes('T')) {
            const firstBetrayalIdx = this.myHistory.indexOf('T');
            if (firstBetrayalIdx < this.opponentHistory.length - 5) {
                const afterBetrayal = this.opponentHistory.slice(firstBetrayalIdx + 1);
                const betrayalRate = afterBetrayal.filter(a => a === 'T').length / afterBetrayal.length;
                if (betrayalRate > 0.8) {
                    return { type: 'grudger', confidence: betrayalRate };
                }
            }
        }

        // Random/Mixed
        return { type: 'mixed', confidence: 0.5 };
    }

    // Construir estado melhorado
    buildState(myLastAction, oppLastAction, patternType = null) {
        const myLast = myLastAction || '-';
        const oppLast = oppLastAction || '-';
        let state = `${myLast}|${oppLast}`;

        if (patternType && patternType !== 'unknown' && patternType !== 'mixed') {
            state += `|${patternType}`;
        }

        return state;
    }
}

module.exports = StateManager;