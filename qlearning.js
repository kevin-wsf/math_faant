// qlearning.js
class QLearning {
    constructor(actions, alpha = 0.15, gamma = 0.85, epsilon = 0.2, initialQ = 0.0, epsilonMin = 0.05, epsilonDecay = 0.995) {
        this.actions = actions;
        this.alpha = alpha;
        this.gamma = gamma;
        this.epsilon = epsilon;
        this.epsilonInit = epsilon;
        this.epsilonMin = epsilonMin;
        this.epsilonDecay = epsilonDecay;
        this.initialQ = initialQ;
        this.qTable = {};
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
        const newQ = oldQ + this.alpha * (reward + this.gamma * nextMax - oldQ);
        this.qTable[state][action] = newQ;
        console.log(`[IA] Q(${state}, ${action}) = ${newQ.toFixed(3)} (ε=${this.epsilon.toFixed(3)})`);
    }

    decayEpsilon() {
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    }

    getExplorationRate() {
        return this.epsilon;
    }
}

module.exports = QLearning;