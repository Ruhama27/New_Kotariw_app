export class GameEngine {
    constructor(playersData, pricingOptions = { pctWinner: 80, pctTable: 0, pctKotariw: 20 }) {
        // playersData is [{name: 'Alex', bet: 100}, {name: 'Sarah', bet: 50}]
        this.player_count = playersData.length;
        this.total_pot = playersData.reduce((sum, p) => sum + Number(p.bet), 0);
        
        const wPct = Number(pricingOptions.pctWinner !== undefined ? pricingOptions.pctWinner : 80) / 100;
        const tPct = Number(pricingOptions.pctTable !== undefined ? pricingOptions.pctTable : 0) / 100;
        const kPct = Number(pricingOptions.pctKotariw !== undefined ? pricingOptions.pctKotariw : 20) / 100;

        this.prize_winner = this.total_pot * wPct;
        this.prize_table = this.total_pot * tPct;
        this.prize_kotariw = this.total_pot * kPct;
        
        this.valid_numbers = [3,4,5,6,7,8,9,10,11,12,13,14,15];
        this.used_numbers = [];
        this.game_over = false;
        this.current_player_index = 0;
        this.action_history = [];
        
        this.player_list = playersData.map(p => p.name || `Player ${playersData.indexOf(p)+1}`);
        
        if (this.player_count === 2) {
            this.players = {
                [this.player_list[0]]: { history: [], total_score: 0, bet: Number(playersData[0].bet) },
                [this.player_list[1]]: { history: [], total_score: 0, bet: Number(playersData[1].bet) }
            };
        } else {
            this.players = playersData.map((p, i) => ({
                id: this.player_list[i],
                score: 0,
                history: [],
                bet: Number(p.bet)
            }));
        }
    }

    get remaining_numbers() {
        return this.valid_numbers.filter(n => !this.used_numbers.includes(n));
    }

    get current_player() {
        return this.player_list[this.current_player_index];
    }

    nextTurn() {
        this.current_player_index = (this.current_player_index + 1) % this.player_count;
    }

    calculateScore(number, isTwoPlayer) {
        if (isTwoPlayer && number === 3) return 6;
        return number;
    }

    addScore(playerId, number) {
        if (this.game_over) throw new Error("Game is already over");
        if (!this.valid_numbers.includes(number) || this.used_numbers.includes(number)) {
            throw new Error("Invalid or already used number");
        }
        if (playerId !== this.current_player) {
            throw new Error(`It's ${this.current_player}'s turn, not ${playerId}`);
        }

        const pid = playerId;
        const isTwoPlayer = (this.player_count === 2);
        const points = this.calculateScore(number, isTwoPlayer);
        const prevPlayerIndex = this.current_player_index;

        if (isTwoPlayer) {
            this.players[pid].history.push(`+${number}`);
            this.players[pid].total_score += points;
        } else {
            const p = this.players.find(p => p.id === pid);
            p.history.push(`+${number}`);
            p.score += points;
        }

        this.used_numbers.push(number);
        this.action_history.push({
            type: 'add',
            player: pid,
            number,
            previous_player_index: prevPlayerIndex
        });

        if (this.player_count > 2) {
            this.nextTurn();
        }
    }

    subtractScore(playerId, number) {
        if (this.game_over) throw new Error("Game is already over");
        if (playerId !== this.current_player) throw new Error(`Not your turn`);

        const pid = playerId;
        const isTwoPlayer = (this.player_count === 2);
        const points = this.calculateScore(number, isTwoPlayer);
        const prevPlayerIndex = this.current_player_index;

        if (isTwoPlayer) {
            const other = pid === this.player_list[1] ? this.player_list[0] : this.player_list[1];
            this.players[pid].history.push(`-${number}`);
            this.players[other].total_score += points; 
        } else {
            const p = this.players.find(p => p.id === pid);
            p.history.push(`-${number}`);
            p.score -= points;
        }

        // The ball remains on the table when penalized; only scores are updated.
        // It will only be removed when later scored via addScore.
        this.action_history.push({
            type: 'subtract',
            player: pid,
            number,
            previous_player_index: prevPlayerIndex
        });
        
        this.nextTurn();
    }

    undo() {
        if (this.action_history.length === 0) return false;
        
        const lastAction = this.action_history.pop();
        const { type, player, number, previous_player_index } = lastAction;
        
        // Only remove number from used_numbers if it was pocketed during an 'add'
        if (type === 'add') {
            this.used_numbers = this.used_numbers.filter(n => n !== number);
        }
        
        // Restore player index
        this.current_player_index = previous_player_index;
        
        const isTwoPlayer = (this.player_count === 2);
        const points = this.calculateScore(number, isTwoPlayer);
        
        if (type === 'add') {
            if (isTwoPlayer) {
                this.players[player].history.pop();
                this.players[player].total_score -= points;
            } else {
                const p = this.players.find(p => p.id === player);
                p.history.pop();
                p.score -= points;
            }
        } else if (type === 'subtract') {
            if (isTwoPlayer) {
                const other = player === this.player_list[1] ? this.player_list[0] : this.player_list[1];
                this.players[player].history.pop();
                this.players[other].total_score -= points;
            } else {
                const p = this.players.find(p => p.id === player);
                p.history.pop();
                p.score += points;
            }
        }
        
        this.game_over = false;
        return true;
    }

    checkWinner() {
        const isTwoPlayer = (this.player_count === 2);
        
        // Calculate reserved ball points (points of balls that have not been played yet)
        const reserved_ball_points = this.remaining_numbers.reduce(
            (sum, num) => sum + this.calculateScore(num, isTwoPlayer), 
            0
        );

        // Get current scores for all players in a unified format
        const all_scores = {};
        if (isTwoPlayer) {
            for (const pid of this.player_list) {
                all_scores[pid] = this.players[pid].total_score;
            }
        } else {
            this.players.forEach(p => {
                all_scores[p.id] = p.score;
            });
        }

        // Check if there is a player who has already secured the win
        let winner_id = null;
        for (const pid of this.player_list) {
            const pScore = all_scores[pid];
            
            // Find the maximum score among all OTHER players
            let max_other_score = -Infinity;
            for (const other_id of this.player_list) {
                if (other_id !== pid) {
                    if (all_scores[other_id] > max_other_score) {
                        max_other_score = all_scores[other_id];
                    }
                }
            }
            
            // A player wins early if their points are strictly greater than the next highest player's score + reserved ball points
            if (pScore > max_other_score + reserved_ball_points) {
                winner_id = pid;
                break;
            }
        }

        // If we found a winner, or if all balls are played, finalize the game
        if (winner_id !== null || this.remaining_numbers.length === 0) {
            this.game_over = true;
            
            // If the game ended because remaining_numbers === 0 but no player strictly satisfied the early win condition 
            // (e.g. in case of a tie or close final scores), we find the player with the absolute highest score.
            if (winner_id === null) {
                winner_id = this.player_list.reduce((a, b) => all_scores[a] >= all_scores[b] ? a : b);
            }

            const winner_score = all_scores[winner_id];

            return {
                winner_id,
                winner_score,
                all_scores,
                total_pot: this.total_pot,
                prize_winner: this.prize_winner,
                prize_table: this.prize_table,
                prize_kotariw: this.prize_kotariw
            };
        }

        return null;
    }

    getStatus() {
        return {
            players: this.players,
            remaining_numbers: this.remaining_numbers,
            used_numbers: this.used_numbers,
            game_over: this.game_over,
            current_player: this.current_player,
            player_count: this.player_count,
            total_pot: this.total_pot,
            can_undo: this.action_history.length > 0
        };
    }
}
