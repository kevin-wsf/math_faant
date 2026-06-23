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

        // Matriz de recompensas ajustada conforme regras:
        // - Cooperar e ser cooperado: BOM (+3)
        // - Cooperar e ser traído: RUIM (-3)
        // - Trair e ser cooperado: BOM (+3)
        // - Trair e ser traído: BOM (+2) — ela evitou ser enganada
        const recompensas = {
            'C': { 'C': 3, 'T': -3 },   // Cooperar: mútuo(3=bom), traído(-3=ruim)
            'T': { 'C': 3, 'T': 2 }     // Trair: vs cooperador(3=bom), mútuo(2=bom)
        };

        return recompensas[acaoIA]?.[acaoJ1] ?? 0;
    }

    numeroParaAcao(numero) {
        return { 1: 'C', 2: 'T' }[numero];
    }

    acaoParaNumero(acao) {
        return { 'C': 1, 'T': 2 }[acao];
    }

    // Detector de padrões do oponente
    detectOpponentPattern() {
        const minSamples = 8;
        if (this.opponentHistory.length < minSamples) {
            return { type: 'unknown', confidence: 0 };
        }

        const recent = this.opponentHistory.slice(-10);
        const actions = ['C', 'T'];
        const counts = { C: 0, T: 0 };
        recent.forEach(a => counts[a]++);
        const total = recent.length;

        // Always-C ou Always-T em janela recente
        for (const action of actions) {
            const freq = counts[action] / total;
            if (freq > 0.75) {
                return { type: `always-${action}`, confidence: freq };
            }
        }

        // Tit-for-Tat (retaliação: oponente copia minha ação anterior)
        if (this.myHistory.length >= 2) {
            let tftMatches = 0;
            const window = Math.min(this.myHistory.length, this.opponentHistory.length);
            for (let i = 1; i < window; i++) {
                if (this.opponentHistory[i] === this.myHistory[i - 1]) {
                    tftMatches++;
                }
            }
            const tftRate = tftMatches / Math.max(1, window - 1);
            if (tftRate > 0.7) {
                return { type: 'tit-for-tat', confidence: tftRate };
            }
        }

        // Grudger (após primeira traição, oponente retalia fortemente)
        const betrayed = this.myHistory.indexOf('T');
        if (betrayed >= 0 && betrayed < this.opponentHistory.length - 3) {
            const afterBetrayal = this.opponentHistory.slice(betrayed + 1);
            if (afterBetrayal.length >= 3) {
                const betrayalRate = afterBetrayal.filter(a => a === 'T').length / afterBetrayal.length;
                if (betrayalRate > 0.75) {
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
        const mySecondLast = this.myHistory.length > 1 ? this.myHistory[this.myHistory.length - 2] : '-';
        const oppLast = oppLastAction || '-';
        const oppSecondLast = this.opponentHistory.length > 1 ? this.opponentHistory[this.opponentHistory.length - 2] : '-';
        const pattern = patternType && patternType !== 'unknown' ? patternType : 'mixed';
        return `${mySecondLast}${myLast}|${oppSecondLast}${oppLast}|${pattern}`;
    }

    // Calcular acurácia real da IA baseada em decisões ótimas (taxa de acerto)
    calculateAccuracy(qTable) {
        if (this.myHistory.length < 5) return 0;

        let correctDecisions = 0;
        let totalDecisions = 0;

        for (let i = 1; i < this.myHistory.length; i++) {
            const myLast = this.myHistory[i - 1];
            const oppLast = this.opponentHistory[i - 1];
            const pattern = this.detectOpponentPattern();
            const state = this.buildState(myLast, oppLast, pattern.type);

            if (qTable[state]) {
                const bestActions = Object.keys(qTable[state]).filter(action => qTable[state][action] === Math.max(...Object.values(qTable[state])));

                // Verifica se a ação tomada pela IA foi uma das melhores
                if (bestActions.includes(this.myHistory[i])) {
                    correctDecisions++;
                }
                totalDecisions++;
            }
        }

        return totalDecisions > 0 ? correctDecisions / totalDecisions : 0;
    }

    // Debug: mostrar estado da Q-table
    debugQTable(qTable) {
        console.log('[DEBUG] === ESTADO DA Q-TABLE ===');
        const states = Object.keys(qTable);
        console.log(`Total de estados aprendidos: ${states.length}`);

        if (states.length > 0) {
            console.log('Amostra de estados:');
            states.slice(0, 3).forEach(state => {
                const actions = qTable[state];
                const qValues = Object.values(actions);
                const maxQ = Math.max(...qValues);
                const minQ = Math.min(...qValues);
                const range = maxQ - minQ;
                console.log(`  ${state}: ${JSON.stringify(actions)} (range: ${range.toFixed(3)})`);
            });
        }
        console.log('[DEBUG] ================================');
    }

    // Calcular tendência de melhoria
    calculateTrend(rewards) {
        if (rewards.length < 10) return 'insuficiente_historico';

        const mid = Math.floor(rewards.length / 2);
        const firstHalf = rewards.slice(0, mid);
        const secondHalf = rewards.slice(mid);

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const improvement = ((avgSecond - avgFirst) / Math.abs(avgFirst || 1)) * 100;

        if (improvement > 10) return 'melhorando_forte';
        if (improvement > 0) return 'melhorando';
        if (improvement < -10) return 'piorando_forte';
        if (improvement < 0) return 'piorando';
        return 'estável';
    }

    // Prever próxima ação do oponente baseada no histórico
    predictNextOpponentAction() {
        if (this.opponentHistory.length < 3) {
            return { 'C': 0.5, 'T': 0.5 }; // Probabilidade uniforme se pouco histórico
        }

        const pattern = this.detectOpponentPattern();
        const recent = this.opponentHistory.slice(-5);

        // Probabilidades baseadas no padrão detectado
        if (pattern.type === 'always-C') {
            return { 'C': 0.9, 'T': 0.1 };
        } else if (pattern.type === 'always-T') {
            return { 'C': 0.1, 'T': 0.9 };
        } else if (pattern.type === 'tit-for-tat') {
            // Tende a copiar a última ação da IA
            const lastMyAction = this.myHistory[this.myHistory.length - 1];
            return lastMyAction === 'C' ? { 'C': 0.8, 'T': 0.2 } : { 'C': 0.2, 'T': 0.8 };
        }

        // Para padrões mistos, usa frequência recente
        const cCount = recent.filter(a => a === 'C').length;
        const tCount = recent.filter(a => a === 'T').length;
        const total = recent.length;

        return {
            'C': cCount / total,
            'T': tCount / total
        };
    }
}

module.exports = StateManager;