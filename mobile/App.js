import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, ImageBackground } from 'react-native';
import { GameEngine } from './game';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('HOME'); // 'HOME' | 'SETUP' | 'GAME'
  
  // Setup State
  const [playerCount, setPlayerCount] = useState(2);
  const [playersData, setPlayersData] = useState([
    { name: '', bet: '50' },
    { name: '', bet: '50' }
  ]);
  
  // Game State
  const [gameEngine, setGameEngine] = useState(null);
  const [status, setStatus] = useState(null);
  const [selectedBall, setSelectedBall] = useState(null);
  const [winner, setWinner] = useState(null);

  const handlePlayerCountChange = (count) => {
    setPlayerCount(count);
    const newData = [];
    for (let i = 0; i < count; i++) {
       newData.push(playersData[i] || { name: '', bet: '50' });
    }
    setPlayersData(newData);
  };

  const updatePlayerData = (index, field, value) => {
    const newData = [...playersData];
    newData[index][field] = value;
    setPlayersData(newData);
  };

  const startGame = () => {
    // Validate inputs
    for (const p of playersData) {
      if (!p.name || !p.name.trim()) return Alert.alert("Error", "All players must have a name!");
      const betVal = Number(p.bet);
      if (isNaN(betVal) || betVal < 50) return Alert.alert("Invalid Bet", `${p.name || 'A player'} must bet at least 50 Birr!`);
    }
    
    // Duplicate Name check
    const names = playersData.map(p => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return Alert.alert("Error", "All players must have unique names!");
    }

    const engine = new GameEngine(playersData);
    setGameEngine(engine);
    setWinner(null);
    setStatus(engine.getStatus());
    setCurrentScreen('GAME');
  };

  const sendAction = (actionType) => {
    if (!gameEngine) return;
    if (!selectedBall) return Alert.alert("Select a Ball", "Please select a pool ball first!");
    
    try {
      if (actionType === 'add') {
         gameEngine.addScore(status.current_player, selectedBall);
      } else {
         gameEngine.subtractScore(status.current_player, selectedBall);
      }
      
      setStatus({ ...gameEngine.getStatus() });
      setSelectedBall(null);
      
      const winnerData = gameEngine.checkWinner();
      if (winnerData) {
        setWinner(winnerData);
      }
    } catch (e) {
      Alert.alert("Action Error", e.message);
    }
  };

  const resetToHome = () => {
    setGameEngine(null);
    setStatus(null);
    setWinner(null);
    setSelectedBall(null);
    setCurrentScreen('HOME');
  };

  // UI Renderers
  const renderHome = () => (
    <ImageBackground source={require('./assets/splash_bg.png')} style={styles.homeBackground}>
      <View style={styles.homeOverlay}>
        <Text style={styles.titleLogo}>KOTARIW</Text>
        <Text style={styles.subtitleLogo}>SCORE TRACKER</Text>
        
        <TouchableOpacity style={styles.playButton} onPress={() => setCurrentScreen('SETUP')}>
          <Text style={styles.playButtonText}>START GAME</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );

  const renderSetup = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Game Setup</Text>
      
      <View style={styles.setupCard}>
        <Text style={styles.label}>Number of Players:</Text>
        <View style={styles.buttonGroup}>
          {[2, 3, 4].map(num => (
            <TouchableOpacity 
              key={num} 
              style={[styles.countButton, playerCount === num && styles.activeButton]}
              onPress={() => handlePlayerCountChange(num)}
            >
              <Text style={[styles.buttonText, playerCount === num && styles.activeButtonText]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, {marginTop: 20}]}>Player Settings:</Text>
        <ScrollView style={{maxHeight: 350}} showsVerticalScrollIndicator={false}>
          {playersData.map((p, i) => (
             <View key={i} style={styles.playerSetupRow}>
                <TextInput 
                   style={styles.nameInput}
                   value={p.name}
                   onChangeText={(v) => updatePlayerData(i, 'name', v)}
                   placeholder={`Name ${i+1}`}
                   placeholderTextColor="#888"
                />
                <TextInput 
                   style={styles.betInput}
                   value={p.bet}
                   onChangeText={(v) => updatePlayerData(i, 'bet', v)}
                   keyboardType="numeric"
                   placeholder="Bet"
                   placeholderTextColor="#888"
                />
                <Text style={styles.currencyTag}>Birr</Text>
             </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={startGame}>
         <Text style={styles.startButtonText}>Lets Go!</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{marginTop:20}} onPress={resetToHome}>
         <Text style={{color: '#999', fontSize: 16}}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGame = () => {
    if (!status) return null;

    if (winner) {
       return (
         <View style={styles.winnerContainer}>
           <Text style={styles.winnerText}>🏆 {winner.winner_id} Wins!</Text>
           <Text style={styles.scoreText}>Final Score: {winner.winner_score}</Text>
           
           <View style={styles.financialCard}>
             <Text style={styles.financialTitle}>Prize Breakdown</Text>
             <Text style={styles.financialText}>Total Pot: {winner.total_pot.toFixed(2)} Birr</Text>
             <View style={styles.divider} />
             <Text style={styles.financialText}>🥇 Winner ({winner.winner_id}): {(winner.prize_winner).toFixed(2)}</Text>
             <Text style={styles.financialText}>🏠 Kotariw (Host): {(winner.prize_kotariw).toFixed(2)}</Text>
             <Text style={styles.financialText}>🎲 Game Fee: {(winner.prize_game).toFixed(2)}</Text>
           </View>

           <TouchableOpacity style={styles.startButton} onPress={resetToHome}>
              <Text style={styles.startButtonText}>Main Menu</Text>
           </TouchableOpacity>
         </View>
       );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>Turn: {status.current_player}</Text>
        <Text style={styles.potText}>Total Pot: {status.total_pot} Birr</Text>
        
        {/* Render Players Data dynamically */}
        <View style={styles.scoresWrap}>
          {Object.keys(status.players).length > 0 && Array.isArray(status.players) ? (
            status.players.map(p => (
              <View key={p.id} style={[styles.playerCard, status.current_player === p.id && styles.activePlayerCard]}>
                <Text numberOfLines={1} style={styles.playerName}>{p.id}</Text>
                <Text style={styles.playerScore}>{p.score}</Text>
              </View>
            ))
          ) : (
             Object.keys(status.players).map(pid => (
              <View key={pid} style={[styles.playerCard, status.current_player === pid && styles.activePlayerCard]}>
                <Text numberOfLines={1} style={styles.playerName}>{pid}</Text>
                <Text style={styles.playerScore}>{status.players[pid].total_score}</Text>
              </View>
             ))
          )}
        </View>

        {/* Selection Grid */}
        <View style={styles.grid}>
          {status.remaining_numbers.map(num => (
            <TouchableOpacity 
              key={num}
              style={[styles.ballButton, selectedBall === num && styles.selectedBall]}
              onPress={() => setSelectedBall(num)}
            >
              <Text style={styles.ballText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
           <TouchableOpacity style={[styles.actionBtn, styles.addBtn]} onPress={() => sendAction('add')}>
              <Text style={styles.actionBtnText}>Add ➕</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.actionBtn, styles.subBtn]} onPress={() => sendAction('subtract')}>
              <Text style={styles.actionBtnText}>Penalize ➖</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{flex:1}}>
      {currentScreen === 'HOME' && renderHome()}
      {currentScreen === 'SETUP' && renderSetup()}
      {currentScreen === 'GAME' && renderGame()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e1e1e', alignItems: 'center', paddingTop: 60, paddingHorizontal: 15 },
  homeBackground: { flex: 1, resizeMode: 'cover', justifyContent: 'center', alignItems: 'center' },
  homeOverlay: { backgroundColor: 'rgba(0,0,0,0.65)', padding: 40, borderRadius: 20, alignItems: 'center', width: '90%' },
  titleLogo: { fontSize: 44, fontWeight: '900', color: '#00ff88', fontStyle: 'italic', textShadowColor: '#000', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 10 },
  subtitleLogo: { fontSize: 18, color: '#fff', letterSpacing: 5, marginBottom: 60 },
  playButton: { backgroundColor: '#ffcc00', paddingVertical: 18, paddingHorizontal: 55, borderRadius: 40, elevation: 5 },
  playButtonText: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 20 },
  setupCard: { backgroundColor: '#2a2a2a', width: '100%', padding: 20, borderRadius: 15, marginBottom: 20 },
  label: { color: '#ccc', fontSize: 16, marginBottom: 12 },
  buttonGroup: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  countButton: { backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 },
  activeButton: { backgroundColor: '#00ff88' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeButtonText: { color: '#111' },
  playerSetupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nameInput: { flex: 2, backgroundColor: '#111', color: '#00ff88', padding: 14, borderRadius: 10, marginRight: 10, fontSize: 16 },
  betInput: { flex: 1, backgroundColor: '#111', color: '#ffcc00', padding: 14, borderRadius: 10, fontSize: 16, textAlign: 'center' },
  currencyTag: { color: '#888', marginLeft: 8, fontSize: 14 },
  startButton: { backgroundColor: '#ffcc00', paddingVertical: 18, width: '100%', borderRadius: 12, alignItems: 'center' },
  startButtonText: { color: '#111', fontSize: 22, fontWeight: 'bold' },
  infoText: { color: '#00ff88', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  potText: { color: '#ffcc00', fontSize: 18, marginBottom: 20 },
  scoresWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%', marginBottom: 30 },
  playerCard: { backgroundColor: '#333', padding: 12, borderRadius: 12, alignItems: 'center', width: '45%' },
  activePlayerCard: { borderColor: '#00ff88', borderWidth: 2, backgroundColor: '#224422' },
  playerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  playerScore: { color: '#00ff88', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', rowGap: 12, columnGap: 12 },
  ballButton: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#555' },
  selectedBall: { borderColor: '#00ff88', backgroundColor: '#333' },
  ballText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 30 },
  actionBtn: { flex: 1, paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginHorizontal: 10 },
  addBtn: { backgroundColor: '#00ff88' },
  subBtn: { backgroundColor: '#ff4444' },
  actionBtnText: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  winnerContainer: { flex: 1, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', padding: 20 },
  winnerText: { fontSize: 40, color: '#00ff88', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  scoreText: { fontSize: 24, color: '#fff', marginBottom: 40 },
  financialCard: { backgroundColor: '#2a2a2a', width: '100%', padding: 25, borderRadius: 15, marginBottom: 40 },
  financialTitle: { color: '#ffcc00', fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  financialText: { color: '#fff', fontSize: 18, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#555', marginVertical: 15 }
});
