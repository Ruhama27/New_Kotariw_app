import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';

// Set this to 10.0.2.2 for Android Emulator, or your computer's local IP (e.g. 192.168.1.5) for physical devices
const API_BASE = "http://192.168.142.28:8000/api";

export default function App() {
  const [gameActive, setGameActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Setup State
  const [playerCount, setPlayerCount] = useState(2);
  const [buyIn, setBuyIn] = useState('50');
  
  // Game State
  const [status, setStatus] = useState(null);
  const [selectedBall, setSelectedBall] = useState(null);
  const [winner, setWinner] = useState(null);

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    setLoading(true);
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "API request failed");
      }
      return data;
    } catch (error) {
      Alert.alert("Error", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    const buyInNum = Number(buyIn);
    if (isNaN(buyInNum) || buyInNum < 50) {
      Alert.alert("Invalid Buy-in", "Minimum buy-in is 50 Birr!");
      return;
    }
    
    try {
      const data = await apiCall("/start", "POST", { player_count: playerCount, buy_in: buyInNum });
      setGameActive(true);
      setWinner(null);
      setStatus(data);
    } catch (e) { console.error(e); }
  };

  const sendAction = async (actionType) => {
    if (!gameActive) return;
    if (!selectedBall) {
      Alert.alert("Select a Ball", "Please select a pool ball first!");
      return;
    }
    
    try {
      const data = await apiCall("/action", "POST", {
        player_id: status.current_player,
        number: selectedBall,
        action: actionType
      });
      
      setStatus(data.status);
      setSelectedBall(null);
      
      if (data.winner) {
        setWinner(data.winner);
        setGameActive(false);
      }
    } catch (e) { console.error(e); }
  };

  const resetGame = async () => {
    try {
      await apiCall("/reset", "POST");
      setGameActive(false);
      setStatus(null);
      setWinner(null);
      setSelectedBall(null);
    } catch (e) { console.error(e); }
  };

  const renderPoolBalls = () => {
    const balls = [];
    const used = status?.used_numbers || [];
    
    for (let i = 3; i <= 15; i++) {
      const isUsed = used.includes(i);
      const isSelected = selectedBall === i;
      
      balls.push(
        <TouchableOpacity
          key={i}
          disabled={isUsed || !gameActive}
          style={[
            styles.poolBall,
            isUsed && styles.poolBallUsed,
            isSelected && styles.poolBallSelected
          ]}
          onPress={() => setSelectedBall(i)}
        >
          <View style={styles.poolBallInner}>
            <Text style={styles.poolBallText}>{i}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return <View style={styles.ballsContainer}>{balls}</View>;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Score Game</Text>
      <Text style={styles.subtitle}>Multiplayer Number Challenge</Text>

      {/* GAME SETUP */}
      {!gameActive && !winner && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Start Game</Text>
          
          <Text style={styles.label}>Players (2-4):</Text>
          <View style={styles.row}>
            {[2,3,4].map(num => (
              <TouchableOpacity 
                key={num} 
                style={[styles.btnToggle, playerCount === num && styles.btnToggleActive]}
                onPress={() => setPlayerCount(num)}
              >
                <Text style={[styles.btnToggleText, playerCount === num && styles.btnToggleTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Buy-in per Player (Birr):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={buyIn}
            onChangeText={setBuyIn}
          />

          <TouchableOpacity style={styles.btnPrimary} onPress={startGame} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Start Game</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* WINNER BOX */}
      {winner && (
        <View style={[styles.card, { borderColor: '#f8c300', borderWidth: 2 }]}>
          <Text style={styles.cardTitle}>🏆 Winner: {winner.winner_id}</Text>
          <Text style={styles.winnerText}>Wins with {winner.winner_score} points!</Text>
          
          <View style={styles.prizeBox}>
            <Text style={styles.prizeTitle}>💰 Prize Distribution (Pot: {winner.total_pot} Birr)</Text>
            <Text style={styles.prizeStat}>➤ Paid to {winner.winner_id} (70%): {winner.prize_winner.toFixed(2)} Birr</Text>
            <Text style={styles.prizeStat}>➤ Paid to Kotariw (20%): {winner.prize_kotariw.toFixed(2)} Birr</Text>
            <Text style={styles.prizeStat}>➤ Game Fee (10%): {winner.prize_game.toFixed(2)} Birr</Text>
          </View>
          
          <TouchableOpacity style={[styles.btnPrimary, {marginTop: 20}]} onPress={resetGame}>
            <Text style={styles.btnPrimaryText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ACTIVE GAME */}
      {gameActive && status && (
        <View style={styles.activeContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Player Action</Text>
            <Text style={styles.turnText}>Current Turn: {status.current_player}</Text>
            
            <Text style={styles.label}>Select a Pool Ball:</Text>
            {renderPoolBalls()}

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.btnAction, styles.btnAdd, !selectedBall && styles.btnDisabled]} 
                onPress={() => sendAction('add')}
                disabled={!selectedBall || loading}
              >
                <Text style={styles.btnActionText}>Add</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btnAction, styles.btnSub, !selectedBall && styles.btnDisabled]} 
                onPress={() => sendAction('subtract')}
                disabled={!selectedBall || loading}
              >
                <Text style={styles.btnActionText}>Subtract</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Game Status</Text>
            <Text style={styles.statusText}>🎯 Balls Remaining: {status.remaining_numbers?.length || 0}/13</Text>
            
            <View style={styles.scoresContainer}>
              {status.player_count === 2 
                ? Object.keys(status.players).map(pid => (
                    <Text key={pid} style={styles.scoreText}>{pid}: {status.players[pid].total_score} pts</Text>
                  ))
                : status.players.map(p => (
                    <Text key={p.id} style={styles.scoreText}>{p.id}: {p.score} pts</Text>
                  ))
              }
            </View>
            
            <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#e74c3c'}]} onPress={resetGame}>
              <Text style={styles.btnPrimaryText}>Reset Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a3d2f' },
  content: { padding: 20, alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#f8c300', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#b8e0d5', marginBottom: 30 },
  card: { width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#f8c300', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(248, 195, 0, 0.3)', paddingBottom: 10 },
  label: { fontSize: 16, color: '#b8e0d5', marginBottom: 10, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  btnToggle: { flex: 1, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, marginHorizontal: 5, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnToggleActive: { backgroundColor: '#f8c300', borderColor: '#f8c300' },
  btnToggleText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnToggleTextActive: { color: '#333' },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(248,195,0,0.3)' },
  btnPrimary: { backgroundColor: '#f8c300', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#333', fontSize: 18, fontWeight: 'bold' },
  activeContainer: { width: '100%' },
  turnText: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 15, textAlign: 'center', backgroundColor: 'rgba(248,195,0,0.2)', padding: 10, borderRadius: 8 },
  ballsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20 },
  poolBall: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#d32f2f', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  poolBallInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  poolBallText: { fontWeight: 'bold', color: '#000', fontSize: 12 },
  poolBallUsed: { opacity: 0.3 },
  poolBallSelected: { transform: [{scale: 1.2}], borderColor: '#f8c300', borderWidth: 3 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnAction: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  btnAdd: { backgroundColor: '#2ecc71' },
  btnSub: { backgroundColor: '#e74c3c' },
  btnActionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.5 },
  statusText: { fontSize: 16, color: '#fff', marginBottom: 10 },
  scoresContainer: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 8, marginBottom: 20 },
  scoreText: { color: '#f8c300', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  winnerText: { fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 20 },
  prizeBox: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 15, borderRadius: 10 },
  prizeTitle: { color: '#f8c300', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'center' },
  prizeStat: { color: '#b8e0d5', fontSize: 14, marginBottom: 5 }
});
