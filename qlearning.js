// qlearning.js
class QLearning {
    constructor(actions, alpha = 0.35, gamma = 0.85, epsilon = 0.3, initialQ = 0.0, epsilonMin = 0.05, epsilonDecay = 0.97) {
        this.actions = actions;
        this.alpha = alpha; // taxa de aprendizado
        this.gamma = gamma; // fator de desconto
        this.epsilon = epsilon; // taxa de exploração inicial
        this.epsilonInit = epsilon; // taxa de exploração inicial
        this.epsilonMin = epsilonMin; // taxa de exploração mínima
        this.epsilonDecay = epsilonDecay; // decaimento da taxa de exploração
        this.initialQ = initialQ; // recompensa inicial (evitar escolha imparcial inicialmente)
        this.qTable = {}; // tabela Q
    }

    getQValue(state, action) {
        if (!this.qTable[state]) this.qTable[state] = {};
        if (!this.qTable[state][action]) this.qTable[state][action] = this.initialQ;
        return this.qTable[state][action];
    }

    chooseAction(state) {
        if (Math.random() < this.epsilon) {
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        } else {
            const qValues = this.actions.map(action => this.getQValue(state, action));
            const maxQ = Math.max(...qValues);
            const bestActions = this.actions.filter((_, idx) => qValues[idx] === maxQ);
            return bestActions[Math.floor(Math.random() * bestActions.length)];
        }
    }

    updateQTable(state, action, reward, nextState) {
        const oldQ = this.getQValue(state, action);
        const nextMax = Math.max(...this.actions.map(a => this.getQValue(nextState, a)));

        const newQ = oldQ + this.alpha * (reward + this.gamma * nextMax - oldQ);  // Função de atualização Q-learning
        
        this.qTable[state][action] = newQ;
        console.log(`[IA] Q(${state}, ${action}) = ${newQ.toFixed(3)} (ε=${this.epsilon.toFixed(3)})`);
    }

    decayEpsilon() {
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    }

    getExplorationRate() {
        return this.epsilon;
    }

    saveQTable(filePath) {
        const data = {
            qTable: this.qTable,
            epsilon: this.epsilon
        };
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    loadQTable(filePath) {
        const fs = require('fs');
        if (!fs.existsSync(filePath)) return false;

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                this.qTable = parsed.qTable || {};
                if (typeof parsed.epsilon === 'number') {
                    this.epsilon = parsed.epsilon;
                }
                return true;
            }
        } catch (err) {
            console.warn('[IA] Falha ao carregar Q-table:', err.message);
        }
        return false;
    }
}

module.exports = QLearning;