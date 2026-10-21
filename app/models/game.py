# app/models/game.py
from typing import List, Optional, Dict, Any

class Game:
    def __init__(self, player_count: int, buy_in: float = 0.0):
        self.player_count = player_count
        self.buy_in = buy_in
        self.total_pot = buy_in * player_count
        self.prize_winner = self.total_pot * 0.70
        self.prize_kotariw = self.total_pot * 0.20
        self.prize_game = self.total_pot * 0.10
        self.valid_numbers = list(range(3, 16))
        self.used_numbers = []
        self.game_over = False
        self.current_player_index = 0  # Track whose turn it is
        
        # Initialize players based on count
        if player_count == 2:
            self.players = {
                "P1": {"history": [], "total_score": 0},
                "P2": {"history": [], "total_score": 0},
            }
            self.player_list = ["P1", "P2"]  # For turn tracking
        else:
            self.players = [
                {"id": f"P{i+1}", "score": 0, "history": []} 
                for i in range(player_count)
            ]
            self.player_list = [f"P{i+1}" for i in range(player_count)]

    def display_remaining_numbers(self) -> List[int]:
        return [n for n in self.valid_numbers if n not in self.used_numbers]

    def get_current_player(self) -> str:
        """Get the ID of the current player"""
        return self.player_list[self.current_player_index]

    def next_turn(self):
        """Move to the next player's turn"""
        self.current_player_index = (self.current_player_index + 1) % self.player_count

    def calculate_score(self, number: int, is_two_player: bool = False) -> int:
        """Calculate score based on game rules"""
        return number

    def add_score(self, player_id: str, number: int):
        """Add score for a player"""
        if self.game_over:
            raise ValueError("Game is already over")
        if number not in self.valid_numbers or number in self.used_numbers:
            raise ValueError("Invalid or already used number")
        
        # Verify it's the player's turn
        if player_id.upper() != self.get_current_player():
            raise ValueError(f"It's {self.get_current_player()}'s turn, not {player_id}")

        pid = player_id.upper()
        is_two_player = (self.player_count == 2)
        points = self.calculate_score(number, is_two_player)

        if self.player_count == 2:
            other = "P1" if pid == "P2" else "P2"
            net_balance = self.players[pid]["total_score"] - self.players[other]["total_score"]
            self.players[pid]["history"].append(f"+{number}")
            new_balance = net_balance + points
            if new_balance >= 0:
                self.players[pid]["total_score"] = new_balance
                self.players[other]["total_score"] = 0
            else:
                self.players[pid]["total_score"] = 0
                self.players[other]["total_score"] = -new_balance
        else:
            player = next(p for p in self.players if p["id"] == pid)
            player["history"].append(f"+{number}")
            player["score"] += points

        self.used_numbers.append(number)
        
        if self.player_count > 2:
            # In 3-4 players, player retains turn on add, turn passes only on loss/manual
            pass
        else:
            # Player continues playing after an add
            pass

    def subtract_score(self, player_id: str, number: int):
        """Subtract score for a player (ends their turn)"""
        if self.game_over:
            raise ValueError("Game is already over")
        
        # Verify it's the player's turn
        if player_id.upper() != self.get_current_player():
            raise ValueError(f"It's {self.get_current_player()}'s turn, not {player_id}")

        pid = player_id.upper()
        is_two_player = (self.player_count == 2)
        points = self.calculate_score(number, is_two_player)

        if self.player_count == 2:
            other = "P1" if pid == "P2" else "P2"
            net_balance = self.players[pid]["total_score"] - self.players[other]["total_score"]
            self.players[pid]["history"].append(f"-{number}")
            new_balance = net_balance - points
            if new_balance >= 0:
                self.players[pid]["total_score"] = new_balance
                self.players[other]["total_score"] = 0
            else:
                self.players[pid]["total_score"] = 0
                self.players[other]["total_score"] = -new_balance
        else:
            player = next(p for p in self.players if p["id"] == pid)
            player["history"].append(f"-{number}")
            player["score"] -= points

        # Ball remains on table when penalized, only scores change
        # Player's turn ends after a subtract
        self.next_turn()

    def check_winner(self) -> Optional[Dict[str, Any]]:
        """Check if game is over and determine winner"""
        remaining = self.display_remaining_numbers()
        
        if not remaining:  # No numbers left, game is over
            self.game_over = True
            
            if self.player_count == 2:
                winner_id = max(self.players, key=lambda p: self.players[p]["total_score"])
                winner_score = self.players[winner_id]["total_score"]
                all_scores = {pid: data["total_score"] for pid, data in self.players.items()}
            else:
                winner = max(self.players, key=lambda p: p["score"])
                winner_id = winner["id"]
                winner_score = winner["score"]
                all_scores = {p["id"]: p["score"] for p in self.players}

            return {
                "winner_id": winner_id,
                "winner_score": winner_score,
                "all_scores": all_scores,
                "buy_in": self.buy_in,
                "total_pot": self.total_pot,
                "prize_winner": self.prize_winner,
                "prize_kotariw": self.prize_kotariw,
                "prize_game": self.prize_game
            }
        
        return None  # Game not over yet

    def get_status(self) -> Dict[str, Any]:
        """Get current game status"""
        return {
            "players": self.players,
            "remaining_numbers": self.display_remaining_numbers(),
            "used_numbers": self.used_numbers,
            "game_over": self.game_over,
            "current_player": self.get_current_player(),
            "player_count": self.player_count,
            "buy_in": self.buy_in,
            "total_pot": self.total_pot
        }