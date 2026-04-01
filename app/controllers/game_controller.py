# app/controllers/game_controller.py
from fastapi import APIRouter, HTTPException
from app.models.game import Game
from app.models.schemas import StartGameRequest, ActionRequest

# Note: The router now uses prefix="/api" from main.py
# So endpoints will be: /api/start, /api/action, etc.
router = APIRouter()
game_state = None

def ensure_game():
    if not game_state:
        raise HTTPException(status_code=400, detail="No game in progress")

@router.post("/start")
def start_game(req: StartGameRequest):
    """Start a new game with specified number of players (2-4)"""
    global game_state
    game_state = Game(req.player_count, req.buy_in)
    return game_state.get_status()

@router.post("/action")
def game_action(req: ActionRequest):
    """Perform an action (add/subtract) for the current player"""
    ensure_game()
    
    try:
        if req.action == "add":
            game_state.add_score(req.player_id, req.number)
        else:  # subtract
            game_state.subtract_score(req.player_id, req.number)
        
        # Check for winner after the action
        winner = game_state.check_winner()
        
        response = {
            "status": game_state.get_status(),
            "message": f"Action successful. It's now {game_state.get_current_player()}'s turn."
        }
        
        if winner:
            response["winner"] = winner
            response["message"] = f"Game Over! {winner['winner_id']} wins with {winner['winner_score']} points!"
        
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status")
def status():
    """Get current game status"""
    ensure_game()
    return game_state.get_status()

@router.get("/current-player")
def current_player():
    """Get the current player's turn"""
    ensure_game()
    return {"current_player": game_state.get_current_player()}

@router.post("/reset")
def reset_game():
    """Reset the current game"""
    global game_state
    game_state = None
    return {"message": "Game reset successfully"}

@router.get("/rules")
def game_rules():
    """Get the game rules"""
    return {
        "player_count": "2 to 4 players",
        "ball_numbers": "3 to 15",
        "scoring": {
            "two_players": "Ball number 3 gives 6 points, otherwise number equals points",
            "three_four_players": "Ball number gives points equal to its number"
        },
        "turn_rules": "Players continue playing until they choose to subtract",
        "winning": "Player with highest score when all balls are used wins"
    }