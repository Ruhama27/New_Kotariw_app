import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, ImageBackground, Modal, StatusBar, KeyboardAvoidingView, Platform, Vibration, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameEngine } from './game';
import { translations } from './i18n';
import { loadSounds, unloadSounds, playSound, setSoundEnabled, playBackgroundMusic, stopBackgroundMusic } from './sounds';
import * as WebBrowser from 'expo-web-browser';
import { initializeChapaPayment, verifyChapaPayment, getChapaSecretKey, getChapaPublicKey, saveChapaKeys } from './payment';

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getFormattedTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Realistic Billiard Ball Themes matching standard tournament pool balls (Image 2)
const BALL_THEMES = {
  1:  { solid: '#F6C400', gradient: ['#FFEA75', '#F6C400', '#B58B00'], stripe: false },
  2:  { solid: '#0047BB', gradient: ['#4E82F4', '#0047BB', '#002574'], stripe: false },
  3:  { solid: '#D92525', gradient: ['#FF6666', '#D92525', '#800C0C'], stripe: false },
  4:  { solid: '#532785', gradient: ['#925CD9', '#532785', '#2C0D4F'], stripe: false },
  5:  { solid: '#E95B0C', gradient: ['#FF924D', '#E95B0C', '#993400'], stripe: false },
  6:  { solid: '#0D6B38', gradient: ['#2EB868', '#0D6B38', '#033B1C'], stripe: false, underline: true },
  7:  { solid: '#632A19', gradient: ['#A34E35', '#632A19', '#381206'], stripe: false },
  8:  { solid: '#161616', gradient: ['#484848', '#1A1A1A', '#050505'], stripe: false },
  9:  { solid: '#F6C400', gradient: ['#FFEA75', '#F6C400', '#B58B00'], stripe: true,  underline: true },
  10: { solid: '#0047BB', gradient: ['#4E82F4', '#0047BB', '#002574'], stripe: true },
  11: { solid: '#D92525', gradient: ['#FF6666', '#D92525', '#800C0C'], stripe: true },
  12: { solid: '#532785', gradient: ['#925CD9', '#532785', '#2C0D4F'], stripe: true },
  13: { solid: '#E95B0C', gradient: ['#FF924D', '#E95B0C', '#993400'], stripe: true },
  14: { solid: '#0D6B38', gradient: ['#2EB868', '#0D6B38', '#033B1C'], stripe: true },
  15: { solid: '#632A19', gradient: ['#A34E35', '#632A19', '#381206'], stripe: true },
};

const getBallColor = (num) => {
  return BALL_THEMES[num]?.solid || '#888888';
};

const MiniatureBall = ({ item }) => {
  const isScore = item.startsWith('+');
  const num = parseInt(item.slice(1), 10);
  const theme = BALL_THEMES[num] || { solid: '#666', gradient: ['#888', '#666', '#444'], stripe: false };
  const isStripe = isScore && theme.stripe;

  return (
    <View style={styles.miniBall}>
      {isStripe ? (
        <LinearGradient
          colors={['#ffffff', '#ececec', '#c8c8c8']}
          style={styles.miniBallBase}
        >
          <View style={[styles.miniBallStripe, { backgroundColor: theme.solid }]} />
          <View style={styles.miniBallInner}>
            <Text style={styles.miniBallText}>{num}</Text>
            {theme.underline && <View style={styles.miniBallUnderline} />}
          </View>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={isScore ? theme.gradient : ['#666666', '#444444', '#222222']}
          style={styles.miniBallBase}
        >
          <View style={styles.miniBallInner}>
            <Text style={styles.miniBallText}>{num}</Text>
            {theme.underline && <View style={styles.miniBallUnderline} />}
          </View>
        </LinearGradient>
      )}
    </View>
  );
};

const triggerHaptic = (type = 'light') => {
  try {
    if (type === 'light') {
      Vibration.vibrate(12);
    } else if (type === 'medium') {
      Vibration.vibrate(35);
    } else if (type === 'heavy') {
      Vibration.vibrate(75);
    } else if (type === 'double') {
      Vibration.vibrate([0, 40, 60, 40]);
    }
  } catch (e) {
    console.warn('Haptic feedback error:', e);
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('HOME');
  const [setupVisible, setSetupVisible] = useState(false);

  // Language & Sound
  const [lang, setLang] = useState('en');
  const [soundOn, setSoundOn] = useState(true);
  const t = translations[lang];
  const toggleLang = () => {
    triggerHaptic('light');
    setLang(l => l === 'en' ? 'am' : 'en');
  };
  const toggleSound = () => {
    triggerHaptic('medium');
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  // Economy State
  const [coins, setCoins] = useState(null);
  const [storeVisible, setStoreVisible] = useState(false);

  // Payment States
  const [paymentStep, setPaymentStep] = useState('packages'); // packages, method, manual, processing, settings
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [currentTxRef, setCurrentTxRef] = useState('');
  const [pubKeyInput, setPubKeyInput] = useState('');
  const [secKeyInput, setSecKeyInput] = useState('');

  useEffect(() => {
    if (storeVisible) {
      const loadKeys = async () => {
        const pub = await getChapaPublicKey();
        const sec = await getChapaSecretKey();
        setPubKeyInput(pub);
        setSecKeyInput(sec);
      };
      loadKeys();
    } else {
      setPaymentStep('packages');
      setSelectedPackage(null);
      setVerifyingTx(false);
    }
  }, [storeVisible]);

  // Session State
  const [operator, setOperator] = useState('Operator 1');
  const [tableNumber, setTableNumber] = useState('1');
  const [sessionGamesCount, setSessionGamesCount] = useState(0);
  const [sessionTotalPot, setSessionTotalPot] = useState(0);
  
  // Players database state (frequent players)
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [playerPickerVisible, setPlayerPickerVisible] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState(null);

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
  const [gameStartTime, setGameStartTime] = useState(null);

  // Game History State
  const [gameHistory, setGameHistory] = useState([]);

  // History Tab State (must be at component level — not inside renderHistory)
  const [historyTab, setHistoryTab] = useState('matches');

  // Pricing rules states (percentages)
  const [pctWinner, setPctWinner] = useState(80);
  const [pctTable, setPctTable] = useState(0);
  const [pctKotariw, setPctKotariw] = useState(20);

  // Dashboard Form inputs
  const [winnerInput, setWinnerInput] = useState('80');
  const [tableInput, setTableInput] = useState('0');
  const [kotariwInput, setKotariwInput] = useState('20');

  // Menu and Dashboard visibility states
  const [menuVisible, setMenuVisible] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // Operator Profiles
  const [operatorProfiles, setOperatorProfiles] = useState([]);
  const [activeOperatorId, setActiveOperatorId] = useState(null);
  const [operatorModalVisible, setOperatorModalVisible] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [editingOperatorId, setEditingOperatorId] = useState(null);
  const [shiftData, setShiftData] = useState(null); // { operatorId, startTime, startDate, games, earnings }

  useEffect(() => {
    const initSounds = async () => {
      await loadSounds();
      playBackgroundMusic();
    };
    initSounds();
    return () => { unloadSounds(); };
  }, []);

  useEffect(() => {
    const initializeAppData = async () => {
       try {
         // Load Coins
         const storedCoins = await AsyncStorage.getItem('kotariw_coins');
         if (storedCoins === null) {
             await AsyncStorage.setItem('kotariw_coins', '10'); // 10 Free initially
             setCoins(10);
         } else {
             setCoins(parseInt(storedCoins));
         }

         // Load Saved Players
         const storedPlayers = await AsyncStorage.getItem('kotariw_players');
         if (storedPlayers !== null) {
             setSavedPlayers(JSON.parse(storedPlayers));
         }

         // Load Game History
         const storedHistory = await AsyncStorage.getItem('kotariw_history');
         if (storedHistory !== null) {
             setGameHistory(JSON.parse(storedHistory));
         }

         // Load Operator Profiles
         const storedProfiles = await AsyncStorage.getItem('kotariw_operators');
         if (storedProfiles !== null) {
           const profiles = JSON.parse(storedProfiles);
           setOperatorProfiles(profiles);
         }
         const storedActiveOp = await AsyncStorage.getItem('kotariw_active_operator_id');
         if (storedActiveOp !== null) setActiveOperatorId(storedActiveOp);
         const storedShift = await AsyncStorage.getItem('kotariw_shift');
         if (storedShift !== null) setShiftData(JSON.parse(storedShift));

         // Load / Initialize Session
         const today = getTodayDateString();
         const storedSession = await AsyncStorage.getItem('kotariw_session');
         if (storedSession !== null) {
             const sessionData = JSON.parse(storedSession);
             if (sessionData.date === today) {
                 setSessionGamesCount(sessionData.gamesCount || 0);
                 setSessionTotalPot(sessionData.totalPot || 0);
                 setOperator(sessionData.operator || 'Operator 1');
                 setTableNumber(sessionData.tableNumber || '1');
             } else {
                 // Reset at midnight
                 const newSession = { date: today, gamesCount: 0, totalPot: 0, operator: 'Operator 1', tableNumber: '1' };
                 await AsyncStorage.setItem('kotariw_session', JSON.stringify(newSession));
                 setSessionGamesCount(0);
                 setSessionTotalPot(0);
             }
         } else {
             const newSession = { date: today, gamesCount: 0, totalPot: 0, operator: 'Operator 1', tableNumber: '1' };
             await AsyncStorage.setItem('kotariw_session', JSON.stringify(newSession));
         }

       } catch (e) { console.error(e); }
    };
    // Load Pricing Settings
    const loadPricingSettings = async () => {
      try {
        const storedPctWinner = await AsyncStorage.getItem('kotariw_pct_winner');
        const storedPctTable = await AsyncStorage.getItem('kotariw_pct_table');
        const storedPctKotariw = await AsyncStorage.getItem('kotariw_pct_kotariw');

        if (storedPctWinner !== null) {
          setPctWinner(Number(storedPctWinner));
          setWinnerInput(storedPctWinner);
        }
        if (storedPctTable !== null) {
          setPctTable(Number(storedPctTable));
          setTableInput(storedPctTable);
        }
        if (storedPctKotariw !== null) {
          setPctKotariw(Number(storedPctKotariw));
          setKotariwInput(storedPctKotariw);
        }
      } catch (err) {
        console.error('Failed to load pricing:', err);
      }
    };

    loadPricingSettings().then(() => {
      initializeAppData();
    });
  }, []);

  const saveSessionState = async (newGamesCount, newTotalPot, currentOp = operator, currentTable = tableNumber) => {
    try {
      const today = getTodayDateString();
      const sessionData = {
        date: today,
        gamesCount: newGamesCount,
        totalPot: newTotalPot,
        operator: currentOp,
        tableNumber: currentTable
      };
      await AsyncStorage.setItem('kotariw_session', JSON.stringify(sessionData));
    } catch (e) {
      console.error("Error saving session state", e);
    }
  };

  const deductGameCoin = async () => {
    if (coins <= 0) {
       Alert.alert("Out of Coins!", "Please buy more coins to start a new game.");
       setSetupVisible(false);
       setStoreVisible(true);
       return false;
    }
    const newVal = coins - 1;
    await AsyncStorage.setItem('kotariw_coins', newVal.toString());
    setCoins(newVal);
    return true;
  };

  const startChapaPayment = async () => {
    if (!selectedPackage) return;
    setPaymentStep('processing');
    setVerifyingTx(true);
    const ref = 'kotariw-tx-' + Date.now();
    setCurrentTxRef(ref);
    try {
      const res = await initializeChapaPayment(
        selectedPackage.price,
        ref,
        'operator@kotariw.com',
        operator || 'Operator'
      );
      if (res.success && res.checkoutUrl) {
        await WebBrowser.openBrowserAsync(res.checkoutUrl);
        await verifyChapaTransaction(ref);
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t.paymentFailedTitle, e.message || t.paymentFailedMsg);
      setPaymentStep('packages');
      setVerifyingTx(false);
    }
  };

  const verifyChapaTransaction = async (ref) => {
    setPaymentStep('processing');
    setVerifyingTx(true);
    try {
      const res = await verifyChapaPayment(ref);
      if (res.success && res.data.status === 'success') {
        const addedCoins = selectedPackage.amount;
        const newVal = coins + addedCoins;
        await AsyncStorage.setItem('kotariw_coins', newVal.toString());
        setCoins(newVal);
        Alert.alert(t.paymentSuccessTitle, t.paymentSuccessMsg(addedCoins));
        setStoreVisible(false);
      } else {
        Alert.alert(t.paymentFailedTitle, t.paymentFailedMsg);
        setPaymentStep('packages');
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t.paymentFailedTitle, t.paymentFailedMsg);
      setPaymentStep('packages');
    } finally {
      setVerifyingTx(false);
    }
  };

  const handleSaveChapaKeys = async () => {
    const success = await saveChapaKeys(pubKeyInput, secKeyInput);
    if (success) {
      Alert.alert(t.settingsSaved, t.settingsSaved);
      setPaymentStep('packages');
    } else {
      Alert.alert(t.error, 'Failed to save API keys.');
    }
  };

  const handleConfirmManualTransfer = () => {
    Alert.alert(t.manualSubmitTitle, t.manualSubmitMsg);
    setStoreVisible(false);
  };

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

  const openPlayerPicker = (index) => {
    setActivePlayerIndex(index);
    setPlayerPickerVisible(true);
  };

  const selectFrequentPlayer = (playerName) => {
    if (activePlayerIndex !== null) {
      updatePlayerData(activePlayerIndex, 'name', playerName);
    }
    setPlayerPickerVisible(false);
    setActivePlayerIndex(null);
  };

  const startGame = async () => {
    triggerHaptic('medium');
    for (const p of playersData) {
      if (!p.name || !p.name.trim()) return Alert.alert(t.error, t.allNamesRequired);
      const betVal = Number(p.bet);
      if (isNaN(betVal) || betVal < 50) return Alert.alert(t.invalidBet, t.minBet(p.name));
    }
    
    const names = playersData.map(p => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return Alert.alert(t.error, t.uniqueNames);
    }

    if (!await deductGameCoin()) return;

    // Save newly entered player names to frequent players list
    try {
      let updatedList = [...savedPlayers];
      playersData.forEach(p => {
        const trimmedName = p.name.trim();
        if (!updatedList.includes(trimmedName)) {
          updatedList.push(trimmedName);
        }
      });
      setSavedPlayers(updatedList);
      await AsyncStorage.setItem('kotariw_players', JSON.stringify(updatedList));
    } catch (e) {
      console.error(e);
    }

    // Save session config details to persist operator/table fields
    await saveSessionState(sessionGamesCount, sessionTotalPot, operator, tableNumber);

    const engine = new GameEngine(playersData, { pctWinner, pctTable, pctKotariw });
    setGameEngine(engine);
    setWinner(null);
    setStatus(engine.getStatus());
    setGameStartTime(getFormattedTime());
    setSetupVisible(false);
    setCurrentScreen('GAME');
  };

  const sendAction = (actionType) => {
    if (!gameEngine) return;
    if (!selectedBall) return Alert.alert(t.selectBall, t.selectBallMsg);
    try {
      if (actionType === 'add') {
         triggerHaptic('heavy');
         gameEngine.addScore(status.current_player, selectedBall);
         playSound('score_add');
      } else {
         triggerHaptic('double');
         gameEngine.subtractScore(status.current_player, selectedBall);
         playSound('score_add');
      }
      setStatus({ ...gameEngine.getStatus() });
      setSelectedBall(null);
      const winnerData = gameEngine.checkWinner();
      if (winnerData) { handleGameFinished(winnerData); }
    } catch (e) {
      Alert.alert(t.actionError, e.message);
    }
  };

  const handleUndo = () => {
    if (!gameEngine) return;
    triggerHaptic('medium');
    try {
      const undone = gameEngine.undo();
      if (undone) {
        setStatus({ ...gameEngine.getStatus() });
        setSelectedBall(null);
      } else {
        Alert.alert(t.undoError, t.undoErrorMsg);
      }
    } catch (e) {
      Alert.alert(t.undoError, e.message);
    }
  };

  const handlePassTurn = () => {
    if (!gameEngine) return;
    triggerHaptic('light');
    try {
      gameEngine.nextTurn();
      setStatus({ ...gameEngine.getStatus() });
      setSelectedBall(null);
    } catch (e) {
      console.warn('Could not pass turn:', e);
    }
  };

  const handleGameFinished = async (winnerData) => {
    setWinner(winnerData);
    playSound('winner');
    
    const endTime = getFormattedTime();
    const today = getTodayDateString();
    
    const newEntry = {
      id: Date.now().toString(),
      date: today,
      startTime: gameStartTime,
      endTime: endTime,
      table: tableNumber,
      operator: operator,
      totalPot: winnerData.total_pot,
      winnerId: winnerData.winner_id,
      winnerScore: winnerData.winner_score,
      prizeWinner: winnerData.prize_winner,
      prizeTable: winnerData.prize_table,
      prizeKotariw: winnerData.prize_kotariw,
      pctWinner,
      pctTable,
      pctKotariw,
      players: playersData.map(p => {
        return {
          name: p.name.trim(),
          bet: p.bet,
          score: winnerData.all_scores[p.name.trim().toLowerCase()] || 0
        };
      })
    };

    // Update history, keeping only the last 100 games
    let updatedHistory = [newEntry, ...gameHistory];
    if (updatedHistory.length > 100) {
      updatedHistory = updatedHistory.slice(0, 100);
    }
    setGameHistory(updatedHistory);
    await AsyncStorage.setItem('kotariw_history', JSON.stringify(updatedHistory));

    // Update daily session statistics
    const newGamesCount = sessionGamesCount + 1;
    const newTotalPot = sessionTotalPot + winnerData.total_pot;
    setSessionGamesCount(newGamesCount);
    setSessionTotalPot(newTotalPot);
    await saveSessionState(newGamesCount, newTotalPot, operator, tableNumber);

    // Update active shift data
    if (shiftData && shiftData.operatorId === activeOperatorId) {
      const updatedShift = {
        ...shiftData,
        games: (shiftData.games || 0) + 1,
        earnings: (shiftData.earnings || 0) + winnerData.total_pot,
        commission: ((shiftData.earnings || 0) + winnerData.total_pot) * (pctKotariw / 100),
      };
      setShiftData(updatedShift);
      await AsyncStorage.setItem('kotariw_shift', JSON.stringify(updatedShift));
    }
  };

  const handleQuitGame = () => {
    triggerHaptic('medium');
    Alert.alert(
      t.quit,
      t.confirmQuit,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.quit, style: 'destructive', onPress: () => resetToHome() }
      ]
    );
  };

  const resetToHome = () => {
    triggerHaptic('medium');
    setGameEngine(null);
    setStatus(null);
    setWinner(null);
    setSelectedBall(null);
    setCurrentScreen('HOME');
  };

  // ---------------- UI COMPONENTS ----------------

  const renderGameHeader = () => (
    <View style={styles.headerContainer}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <TouchableOpacity style={styles.quitBtnHeader} onPress={handleQuitGame}>
          <Ionicons name="arrow-back" size={20} color="#ff6b6b" />
        </TouchableOpacity>
        <View style={styles.tableBadge}>
          <Text style={styles.tableBadgeText}>TABLE {tableNumber}</Text>
        </View>
      </View>

      <View style={styles.headerCenterWrap}>
        <Text style={styles.headerNeonTitle}>POOL SCORER</Text>
        <View style={styles.potPillBadge}>
          <Text style={styles.potPillText}>POT: {status ? status.total_pot : 0} Birr</Text>
        </View>
      </View>

      <View style={styles.headerRightWrap}>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.language}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.langBtn} onPress={toggleSound}>
          <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={18} color={soundOn ? '#00e676' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.gearBtn} onPress={() => { triggerHaptic('light'); setMenuVisible(true); }}>
          <Ionicons name="settings-sharp" size={18} color="#00f2fe" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── OPERATOR PROFILE HELPERS ──────────────────────────────────────────
  const saveOperatorProfiles = async (profiles) => {
    setOperatorProfiles(profiles);
    await AsyncStorage.setItem('kotariw_operators', JSON.stringify(profiles));
  };

  const handleAddOrEditOperator = async () => {
    const name = newOperatorName.trim();
    if (!name) return Alert.alert(t.error, t.operatorName + ' required');
    if (editingOperatorId) {
      // Edit existing
      const updated = operatorProfiles.map(op =>
        op.id === editingOperatorId ? { ...op, name } : op
      );
      await saveOperatorProfiles(updated);
      if (activeOperatorId === editingOperatorId) setOperator(name);
    } else {
      // Add new
      if (operatorProfiles.find(op => op.name.toLowerCase() === name.toLowerCase())) {
        return Alert.alert(t.error, t.operatorExists);
      }
      const newOp = { id: Date.now().toString(), name };
      await saveOperatorProfiles([...operatorProfiles, newOp]);
    }
    setNewOperatorName('');
    setEditingOperatorId(null);
  };

  const handleSelectOperator = async (op) => {
    setActiveOperatorId(op.id);
    setOperator(op.name);
    await AsyncStorage.setItem('kotariw_active_operator_id', op.id);
  };

  const handleDeleteOperator = (op) => {
    Alert.alert(t.deleteOperator, t.confirmDeleteOp, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteOperator, style: 'destructive', onPress: async () => {
        const updated = operatorProfiles.filter(o => o.id !== op.id);
        await saveOperatorProfiles(updated);
        if (activeOperatorId === op.id) {
          setActiveOperatorId(null);
          setOperator('Operator 1');
          await AsyncStorage.removeItem('kotariw_active_operator_id');
        }
      }}
    ]);
  };

  const handleStartShift = async () => {
    const now = new Date();
    const shift = {
      operatorId: activeOperatorId,
      operatorName: operator,
      startTime: getFormattedTime(),
      startDate: getTodayDateString(),
      games: 0,
      earnings: 0,
      commission: 0,
    };
    setShiftData(shift);
    await AsyncStorage.setItem('kotariw_shift', JSON.stringify(shift));
    triggerHaptic('medium');
    Alert.alert(t.shiftStart, `${operator} - ${shift.startTime}`);
  };

  const handleEndShift = async () => {
    if (!shiftData) return;
    const commission = (shiftData.earnings * pctKotariw) / 100;
    Alert.alert(
      t.shiftReport,
      `${t.activeOperator}: ${shiftData.operatorName}\n` +
      `${t.shiftStart}: ${shiftData.startTime}\n` +
      `${t.shiftGames}: ${shiftData.games}\n` +
      `${t.shiftEarnings}: ${shiftData.earnings.toFixed(0)} Birr\n` +
      `${t.shiftCommission}: ${commission.toFixed(0)} Birr`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.shiftEnd, style: 'destructive', onPress: async () => {
          setShiftData(null);
          await AsyncStorage.removeItem('kotariw_shift');
        }}
      ]
    );
  };

  const renderOperatorModal = () => {
    const activeOp = operatorProfiles.find(op => op.id === activeOperatorId);
    const isShiftActive = shiftData && shiftData.operatorId === activeOperatorId;

    return (
      <Modal visible={operatorModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a1a2e', '#0f0f1c']} style={styles.modalDarkGradient}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.operatorProfiles}</Text>
                <TouchableOpacity onPress={() => { setOperatorModalVisible(false); setNewOperatorName(''); setEditingOperatorId(null); }}>
                  <Ionicons name="close-circle" size={32} color="#ff4444" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Active Operator + Shift */}
                <LinearGradient colors={['#1a3a1a','#0d2010']} style={{ borderRadius: 14, padding: 15, marginBottom: 18, borderWidth: 1, borderColor: '#00e676' }}>
                  <Text style={{ color: '#aab', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>{t.activeOperator}</Text>
                  <Text style={{ color: '#00e676', fontSize: 18, fontWeight: 'bold' }}>{activeOp ? activeOp.name : '—'}</Text>
                  {isShiftActive ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: '#ffcc00', fontSize: 12 }}>
                        ⏱ {t.shiftStart}: {shiftData.startTime}  |  🎱 {t.shiftGames}: {shiftData.games}  |  💰 {shiftData.earnings.toFixed(0)} Birr
                      </Text>
                      <TouchableOpacity onPress={handleEndShift} style={{ marginTop: 10 }}>
                        <LinearGradient colors={['#ff4444','#cc0000']} style={{ padding: 10, borderRadius: 10, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.shiftEnd}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    activeOp && (
                      <TouchableOpacity onPress={handleStartShift} style={{ marginTop: 10 }}>
                        <LinearGradient colors={['#00e676','#00a855']} style={{ padding: 10, borderRadius: 10, alignItems: 'center' }}>
                          <Text style={{ color: '#111', fontWeight: 'bold' }}>{t.startShift}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )
                  )}
                </LinearGradient>

                {/* Operator List */}
                <Text style={{ color: '#aab', fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>{t.selectOperator}</Text>
                {operatorProfiles.length === 0 ? (
                  <Text style={{ color: '#556', textAlign: 'center', marginVertical: 15 }}>{t.noOperators}</Text>
                ) : (
                  operatorProfiles.map(op => {
                    const isActive = op.id === activeOperatorId;
                    return (
                      <TouchableOpacity key={op.id} onPress={() => handleSelectOperator(op)}>
                        <LinearGradient
                          colors={isActive ? ['#1a6b3a','#0d3d1f'] : ['#2a2a3e','#1a1a2e']}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: isActive ? '#00e676' : '#334' }}
                        >
                          <Ionicons name={isActive ? 'person' : 'person-outline'} size={22} color={isActive ? '#00e676' : '#aab'} />
                          <Text style={{ flex: 1, color: isActive ? '#00e676' : '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 12 }}>{op.name}</Text>
                          {isActive && <View style={{ backgroundColor: '#00e676', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 }}><Text style={{ color: '#111', fontSize: 10, fontWeight: 'bold' }}>ACTIVE</Text></View>}
                          <TouchableOpacity onPress={() => { setEditingOperatorId(op.id); setNewOperatorName(op.name); }} style={{ padding: 6, marginRight: 4 }}>
                            <Ionicons name="pencil" size={16} color="#ffcc00" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteOperator(op)} style={{ padding: 6 }}>
                            <Ionicons name="trash" size={16} color="#ff4444" />
                          </TouchableOpacity>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Add / Edit Form */}
                <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#334', paddingTop: 16 }}>
                  <Text style={{ color: '#aab', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>
                    {editingOperatorId ? t.editOperator : t.addOperator}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#445', fontSize: 15, marginRight: 10 }}
                      value={newOperatorName}
                      onChangeText={setNewOperatorName}
                      placeholder={t.operatorName}
                      placeholderTextColor="#556"
                    />
                    <TouchableOpacity onPress={handleAddOrEditOperator}>
                      <LinearGradient colors={['#ffcc00','#e6a800']} style={{ padding: 12, borderRadius: 10 }}>
                        <Ionicons name={editingOperatorId ? 'checkmark' : 'add'} size={22} color="#111" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  {editingOperatorId && (
                    <TouchableOpacity onPress={() => { setEditingOperatorId(null); setNewOperatorName(''); }} style={{ marginTop: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#889', fontSize: 13 }}>{t.cancel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const renderMenuModal = () => {
    return (
      <Modal visible={menuVisible} animationType="fade" transparent={true}>
        <TouchableOpacity 
          style={styles.modalBg} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuModalContent}>
            <LinearGradient colors={['#2a1a3e', '#1a0f2c']} style={styles.modalDarkGradient}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.menuTitle}</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Ionicons name="close-circle" size={30} color="#ff4444" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.menuOptionRow} 
                onPress={() => {
                  triggerHaptic('light');
                  setMenuVisible(false);
                  setCurrentScreen('HISTORY');
                }}
              >
                <Ionicons name="trophy" size={24} color="#ffcc00" />
                <Text style={styles.menuOptionText}>{t.gameHistory} (100)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuOptionRow} 
                onPress={() => {
                  triggerHaptic('light');
                  setMenuVisible(false);
                  setOperatorModalVisible(true);
                }}
              >
                <Ionicons name="people" size={24} color="#00cfff" />
                <Text style={styles.menuOptionText}>{t.operatorProfiles}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuOptionRow} 
                onPress={() => {
                  triggerHaptic('light');
                  setMenuVisible(false);
                  setDashboardVisible(true);
                }}
              >
                <Ionicons name="settings" size={24} color="#00e676" />
                <Text style={styles.menuOptionText}>{t.kotariwDashboard}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderKotariwDashboardModal = () => {
    const wVal = Number(winnerInput || 0);
    const tVal = Number(tableInput || 0);
    const kVal = Number(kotariwInput || 0);
    const totalSum = wVal + tVal + kVal;
    const isValid = totalSum === 100;

    const handleSavePricing = async () => {
      triggerHaptic('medium');
      if (!isValid) {
        Alert.alert(t.error, t.invalidPercentages);
        return;
      }
      try {
        setPctWinner(wVal);
        setPctTable(tVal);
        setPctKotariw(kVal);

        await AsyncStorage.setItem('kotariw_pct_winner', winnerInput);
        await AsyncStorage.setItem('kotariw_pct_table', tableInput);
        await AsyncStorage.setItem('kotariw_pct_kotariw', kotariwInput);

        playSound('payment_success'); // success chime
        Alert.alert(t.kotariwDashboard, t.pricingSaved);
        setDashboardVisible(false);
      } catch (err) {
        console.error(err);
        Alert.alert(t.error, err.message);
      }
    };

    return (
      <Modal visible={dashboardVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBg}
        >
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a1a2e', '#0f0f1c']} style={styles.modalDarkGradient}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.kotariwDashboard}</Text>
                <TouchableOpacity onPress={() => setDashboardVisible(false)}>
                  <Ionicons name="close-circle" size={32} color="#ff4444" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.storeSubtitle, { marginBottom: 20 }]}>{t.pricingSettings}</Text>

                {/* Winner Share Input */}
                <View style={styles.dashboardInputRow}>
                  <Text style={styles.dashboardInputLabel}>{t.winnerSharePct}:</Text>
                  <TextInput
                    style={styles.dashboardInput}
                    value={winnerInput}
                    onChangeText={setWinnerInput}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.dashboardPctSign}>%</Text>
                </View>

                {/* Table Share Input */}
                <View style={styles.dashboardInputRow}>
                  <Text style={styles.dashboardInputLabel}>{t.tableSharePct}:</Text>
                  <TextInput
                    style={styles.dashboardInput}
                    value={tableInput}
                    onChangeText={setTableInput}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.dashboardPctSign}>%</Text>
                </View>

                {/* Kotariw Share Input */}
                <View style={styles.dashboardInputRow}>
                  <Text style={styles.dashboardInputLabel}>{t.hostSharePct}:</Text>
                  <TextInput
                    style={styles.dashboardInput}
                    value={kotariwInput}
                    onChangeText={setKotariwInput}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.dashboardPctSign}>%</Text>
                </View>

                {/* Validation Indicator */}
                <View style={[
                  styles.dashboardValidationContainer, 
                  { backgroundColor: isValid ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 68, 68, 0.12)' }
                ]}>
                  <Text style={[
                    styles.dashboardValidationText, 
                    { color: isValid ? '#00e676' : '#ff4444' }
                  ]}>
                    {isValid 
                      ? `Total: ${totalSum}% (${t.savePricing})` 
                      : `Total: ${totalSum}% (${t.totalShareWarning})`
                    }
                  </Text>
                </View>

                {/* Save Button */}
                <TouchableOpacity 
                  style={[styles.startBtnOuter, { opacity: isValid ? 1 : 0.5 }]} 
                  onPress={handleSavePricing}
                  disabled={!isValid}
                >
                  <LinearGradient colors={['#00e676', '#00a855']} style={styles.startBtnInner}>
                    <Text style={styles.startBtnText}>{t.savePricing}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

const renderStore = () => {
    return (
      <Modal visible={storeVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#2a1a3e', '#1a0f2c']} style={styles.modalDarkGradient}>
              
              {/* HEADER ROW */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {paymentStep !== 'packages' && (
                    <TouchableOpacity 
                      onPress={() => {
                        triggerHaptic('light');
                        if (paymentStep === 'method') setPaymentStep('packages');
                        else if (paymentStep === 'manual') setPaymentStep('method');
                        else if (paymentStep === 'settings') setPaymentStep('packages');
                      }}
                      style={{ marginRight: 10 }}
                    >
                      <Ionicons name="arrow-back" size={24} color="#00e676" />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.modalTitle}>
                    {paymentStep === 'settings' ? t.chapaApiSettings : t.coinStore}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {paymentStep === 'packages' && (
                    <TouchableOpacity onPress={() => { triggerHaptic('light'); setPaymentStep('settings'); }}>
                      <Ionicons name="settings-outline" size={24} color="#aab" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { triggerHaptic('medium'); setStoreVisible(false); }}>
                    <Ionicons name="close-circle" size={32} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* STEP 1: PACKAGES LIST */}
              {paymentStep === 'packages' && (
                <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                  <Text style={styles.storeSubtitle}>{t.coinDesc}</Text>
                  
                  {/* Package 1 */}
                  <TouchableOpacity 
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedPackage({ amount: 1, price: 5 });
                      setPaymentStep('method');
                    }}
                    style={styles.packageCard}
                  >
                    <LinearGradient colors={['#332255', '#1e1233']} style={styles.packageCardGradient}>
                      <View style={styles.packageIconWrap}>
                        <MaterialCommunityIcons name="poker-chip" size={32} color="#00e676" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.packageTitle}>1 Coin</Text>
                        <Text style={styles.packagePrice}>5 Birr</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={22} color="#889" />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Package 2 - Best Value */}
                  <TouchableOpacity 
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedPackage({ amount: 10, price: 50 });
                      setPaymentStep('method');
                    }}
                    style={[styles.packageCard, styles.packageCardPopular]}
                  >
                    <LinearGradient colors={['#4c3600', '#261b00']} style={styles.packageCardGradient}>
                      <View style={styles.packageIconWrap}>
                        <MaterialCommunityIcons name="poker-chip" size={36} color="#ffcc00" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.packageTitle, { color: '#ffcc00' }]}>10 Coins</Text>
                        <Text style={styles.packagePrice}>50 Birr</Text>
                      </View>
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>POPULAR</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={22} color="#ffcc00" />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Package 3 - VIP */}
                  <TouchableOpacity 
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedPackage({ amount: 50, price: 250 });
                      setPaymentStep('method');
                    }}
                    style={styles.packageCard}
                  >
                    <LinearGradient colors={['#551a3b', '#2e0e20']} style={styles.packageCardGradient}>
                      <View style={styles.packageIconWrap}>
                        <MaterialCommunityIcons name="poker-chip" size={38} color="#cc0066" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.packageTitle, { color: '#ff44aa' }]}>50 Coins</Text>
                        <Text style={styles.packagePrice}>250 Birr</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={22} color="#889" />
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* STEP 2: PAYMENT METHOD */}
              {paymentStep === 'method' && selectedPackage && (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={styles.storeSubtitle}>
                    {t.selectPaymentMethod} ({selectedPackage.amount} {selectedPackage.amount === 1 ? 'Coin' : 'Coins'} - {selectedPackage.price} Birr)
                  </Text>

                  {/* Chapa Option */}
                  <TouchableOpacity onPress={startChapaPayment} style={{ marginTop: 15 }}>
                    <LinearGradient colors={['#00cfff', '#007bb6']} style={styles.storeBtnInner}>
                      <Ionicons name="card" size={24} color="#111" />
                      <Text style={styles.storeBtnText}>{t.telebirrOrBank}</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Manual Bank Transfer Option */}
                  <TouchableOpacity onPress={() => { triggerHaptic('light'); setPaymentStep('manual'); }} style={{ marginTop: 15 }}>
                    <LinearGradient colors={['#ff8a65', '#d84315']} style={styles.storeBtnInner}>
                      <Ionicons name="cash" size={24} color="#fff" />
                      <Text style={[styles.storeBtnText, { color: '#fff' }]}>{t.manualBankTransfer}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: MANUAL TRANSFER INSTRUCTIONS */}
              {paymentStep === 'manual' && selectedPackage && (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={[styles.modalTitle, { fontSize: 18, color: '#ffcc00', alignSelf: 'center', marginBottom: 10 }]}>
                    {t.instructions}
                  </Text>
                  
                  <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>{t.manualInstructions}</Text>
                  </View>

                  <TouchableOpacity onPress={handleConfirmManualTransfer} style={{ marginTop: 25 }}>
                    <LinearGradient colors={['#00e676', '#00a855']} style={styles.storeBtnInner}>
                      <Ionicons name="checkmark-circle" size={24} color="#111" />
                      <Text style={styles.storeBtnText}>{t.iHaveTransferred}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 4: PROCESSING / LOADING */}
              {paymentStep === 'processing' && (
                <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="#00e676" />
                  <Text style={{ color: '#fff', fontSize: 16, marginTop: 20, textAlign: 'center', lineHeight: 24 }}>
                    {t.paymentVerifying}
                  </Text>
                </View>
              )}

              {/* STEP 5: SETTINGS */}
              {paymentStep === 'settings' && (
                <KeyboardAvoidingView behavior="padding" style={{ paddingVertical: 10 }}>
                  <Text style={styles.settingsLabel}>{t.publicKey}:</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={pubKeyInput}
                    onChangeText={setPubKeyInput}
                    placeholder="CHAPUBK_TEST-..."
                    placeholderTextColor="#556"
                    autoCapitalize="none"
                  />

                  <Text style={[styles.settingsLabel, { marginTop: 15 }]}>{t.secretKey}:</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={secKeyInput}
                    onChangeText={setSecKeyInput}
                    placeholder="CHASECK_TEST-..."
                    placeholderTextColor="#556"
                    secureTextEntry={true}
                    autoCapitalize="none"
                  />

                  <TouchableOpacity onPress={handleSaveChapaKeys} style={{ marginTop: 30 }}>
                    <LinearGradient colors={['#ffcc00', '#e6a800']} style={styles.storeBtnInner}>
                      <Ionicons name="save" size={22} color="#111" />
                      <Text style={styles.storeBtnText}>{t.saveSettings}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </KeyboardAvoidingView>
              )}

            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  const renderHome = () => {
    // Build top 3 daily players from history
    const topPlayers = (() => {
      const scores = {};
      gameHistory.forEach(g => {
        if (!scores[g.winnerId]) scores[g.winnerId] = 0;
        scores[g.winnerId] += g.winnerScore;
      });
      return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, score]) => ({ name, score }));
    })();

    const rankMedals = ['🥇', '🥈', '🥉'];

    return (
    <ImageBackground source={require('./assets/splash_bg.png')} style={styles.fullScreenBg}>
      <StatusBar barStyle="light-content" hidden={false} />
      {renderStore()}

      {/* TOP BAR: Menu on left, Lang + Sound + Coin pill + gem on right */}
      <View style={styles.homeTopBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => { triggerHaptic('light'); setMenuVisible(true); }}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
            <Text style={styles.langBtnText}>{t.language}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.langBtn} onPress={toggleSound}>
            <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={18} color={soundOn ? '#00e676' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeCoinPill} onPress={() => setStoreVisible(true)}>
            <Text style={styles.homeCoinText}>{coins !== null ? coins : '...'}</Text>
            <MaterialCommunityIcons name="poker-chip" size={22} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeGemBtn} onPress={() => setStoreVisible(true)}>
            <MaterialCommunityIcons name="diamond-stone" size={24} color="#00cfff" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: 110, paddingBottom: 30 }}
        >
          {/* LOGO */}
          <View style={styles.logoArea}>
            <View style={styles.logoRow}>
              <LinearGradient colors={['#1a0a00', '#3d1f00']} style={styles.logoBall}>
                <Text style={styles.logoBallText}>8</Text>
              </LinearGradient>
              <Text style={styles.logoText}>KOTARIEW</Text>
            </View>
            <View style={styles.flameBar} />
          </View>

          {/* CENTERED PLAY NOW HERO CARD */}
          <View style={{ alignItems: 'center', marginVertical: 24, paddingHorizontal: 20 }}>
            <TouchableOpacity 
              style={{ width: '100%', maxWidth: 340 }} 
              onPress={() => setSetupVisible(true)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#1a6b3a', '#0d3d1f']} style={[styles.mainCard, { minHeight: 200 }]}>
                <View style={styles.mainCardIconCircle}>
                  <Text style={styles.mainCardBallNum}>8</Text>
                </View>
                <Text style={[styles.mainCardTitle, { fontSize: 22 }]}>{t.playNow}</Text>
                <Text style={styles.mainCardSub}>{t.multiplayer}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* DAILY TOP PLAYERS over the table */}
          <View style={styles.dailySection}>
            <Text style={styles.dailyTitle}>{t.dailyTopPlayers}</Text>
            {topPlayers.length === 0 ? (
              <Text style={styles.dailyEmpty}>{t.playToAppear}</Text>
            ) : (
              topPlayers.map((p, i) => (
                <View key={i} style={styles.dailyRow}>
                  <Text style={styles.dailyRank}>{rankMedals[i]}</Text>
                  <View style={styles.dailyAvatar}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>
                  <Text style={styles.dailyName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.dailyScore}>{p.score}</Text>
                </View>
              ))
            )}

            {/* Session config row */}
            <View style={styles.sessionRowInline}>
              <TextInput
                style={styles.sessionInputSmall}
                value={tableNumber}
                onChangeText={(v) => { setTableNumber(v); saveSessionState(sessionGamesCount, sessionTotalPot, operator, v); }}
                placeholder={t.tableLabel} placeholderTextColor="#889"
              />
              <TouchableOpacity
                style={[styles.sessionInputSmall, {flex: 2, marginLeft: 8, justifyContent: 'center'}]}
                onPress={() => { triggerHaptic('light'); setOperatorModalVisible(true); }}
              >
                <Text style={{ color: operator ? '#00e676' : '#889', fontWeight: 'bold', fontSize: 14 }}>
                  👤 {operator || t.operatorLabel}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sessionStatsRow}>
              <Text style={styles.sessionStatText}>🎱 {t.gamesLabel}: <Text style={{color:'#fff', fontWeight:'bold'}}>{sessionGamesCount}</Text></Text>
              <Text style={styles.sessionStatText}>💰 {t.potLabel}: <Text style={{color:'#FFD700', fontWeight:'bold'}}>{sessionTotalPot} Birr</Text></Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Setup Modal */}
      <Modal visible={setupVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBg}
        >
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1a1a2e', '#0f0f1c']} style={styles.modalDarkGradient}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={styles.modalHeader}>
                   <Text style={styles.modalTitle}>{t.lobbySetup}</Text>
                   <TouchableOpacity onPress={() => setSetupVisible(false)}>
                      <Ionicons name="close-circle" size={32} color="#ff4444" />
                   </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t.numPlayers}</Text>
                <View style={styles.buttonGroup}>
                  {[2, 3, 4].map(num => (
                    <TouchableOpacity key={num} onPress={() => handlePlayerCountChange(num)} style={{flex:1, marginHorizontal: 5}}>
                      <LinearGradient 
                        colors={playerCount === num ? ['#00e676', '#00a855'] : ['#333', '#111']} 
                        style={styles.countButton}
                      >
                        <Text style={[styles.buttonText, playerCount === num && styles.activeButtonText]}>{num}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, {marginTop: 20}]}>{t.playerBets}</Text>
                <View style={{ marginBottom: 10 }}>
                  {playersData.map((p, i) => (
                    <View key={i} style={styles.playerSetupRow}>
                        <View style={styles.nameInputWrapper}>
                          <TextInput 
                            style={styles.modalInputNameWithBtn}
                            value={p.name}
                            onChangeText={(v) => updatePlayerData(i, 'name', v)}
                            placeholder={`Player ${i+1} Name`}
                            placeholderTextColor="#667"
                          />
                          <TouchableOpacity style={styles.frequentPlayerBtn} onPress={() => openPlayerPicker(i)}>
                            <Ionicons name="people" size={20} color="#00e676" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.betInputWrapper}>
                           <TextInput 
                              style={styles.modalInputBet}
                              value={p.bet}
                              onChangeText={(v) => updatePlayerData(i, 'bet', v)}
                              keyboardType="numeric"
                              placeholder="Bet"
                              placeholderTextColor="#667"
                           />
                           <Text style={styles.currTag}>Birr</Text>
                        </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.startBtnOuter} onPress={startGame}>
                  <LinearGradient colors={['#ffcc00', '#e6a800']} style={styles.startBtnInner}>
                     <Text style={styles.startBtnText}>{t.startMatch}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Frequent Player Selection Modal */}
      <Modal visible={playerPickerVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.modalContentSmall}>
            <LinearGradient colors={['#2a1a3e', '#1a0f2c']} style={styles.modalDarkGradient}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>{t.savedPlayers}</Text>
                 <TouchableOpacity onPress={() => setPlayerPickerVisible(false)}>
                    <Ionicons name="close-circle" size={32} color="#ff4444" />
                 </TouchableOpacity>
              </View>

              {savedPlayers.length === 0 ? (
                <Text style={{color: '#aab', textAlign: 'center', marginVertical: 20}}>
                  No saved players yet. Start a match to save names automatically!
                </Text>
              ) : (
                <ScrollView style={{maxHeight: 250}} showsVerticalScrollIndicator={true}>
                  {savedPlayers.map((playerName, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.playerPickRow}
                      onPress={() => selectFrequentPlayer(playerName)}
                    >
                      <Ionicons name="person" size={18} color="#ffcc00" style={{marginRight: 10}} />
                      <Text style={styles.playerPickText}>{playerName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </ImageBackground>
    );
  };

  const renderGame = () => {
    if (!status) return null;

    if (winner) {
       return (
         <ImageBackground source={require('./assets/splash_bg.png')} style={styles.fullScreenBg}>
           <View style={styles.bgOverlayHeavy} />
           <View style={styles.winnerContainer}>
             <Ionicons name="trophy" size={100} color="#ffcc00" />
             <Text style={styles.winnerText}>{winner.winner_id} {t.wins}</Text>
             <Text style={styles.finalScoreText}>{t.score}: {winner.winner_score}</Text>
             
              <LinearGradient colors={['#2a2a3e', '#1a1a2e']} style={styles.financialCard}>
                <Text style={styles.financialTitle}>{t.matchResults}</Text>
                <View style={styles.finDivider} />
                
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>{t.totalPot}:</Text>
                  <Text style={styles.finValue}>{winner.total_pot.toFixed(0)} Birr</Text>
                </View>
                
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>🥇 {t.winnerShare} ({pctWinner}%):</Text>
                  <Text style={styles.finValue}>{winner.prize_winner.toFixed(0)} Birr</Text>
                </View>

                {pctTable > 0 && (
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>🎱 {t.tableShare} ({pctTable}%):</Text>
                    <Text style={styles.finValue}>{winner.prize_table.toFixed(0)} Birr</Text>
                  </View>
                )}
                
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>🏠 {t.kotariwShare} ({pctKotariw}%):</Text>
                  <Text style={styles.finValue}>{winner.prize_kotariw.toFixed(0)} Birr</Text>
                </View>
              </LinearGradient>

             <TouchableOpacity onPress={resetToHome} style={{marginTop: 30}}>
                <LinearGradient colors={['#00e676', '#00a855']} style={styles.returnBtn}>
                   <Text style={styles.returnBtnText}>{t.mainMenu}</Text>
                </LinearGradient>
             </TouchableOpacity>
           </View>
         </ImageBackground>
       );
    }

    const remainingCount = status.remaining_numbers ? status.remaining_numbers.length : 0;
    const playerKeys = Object.keys(status.players);
    const isTwoPlayer = playerKeys.length === 2;

    return (
      <View style={styles.gameContainer}>
        {renderGameHeader()}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gameScrollContent}
        >
          {/* ── PLAYER SCORE CARDS (Image 2 + Image 1 Neon Cards) ── */}
          <View style={styles.scoresWrap}>
            {playerKeys.map((key, i) => {
              const p = Array.isArray(status.players) ? status.players[i] : status.players[key];
              const pId = Array.isArray(status.players) ? p.id : key;
              const pScore = Array.isArray(status.players) ? p.score : p.total_score;
              const isActive = status.current_player === pId;

              return (
                <View
                  key={pId}
                  style={[
                    styles.playerNeonCard,
                    isActive ? styles.playerNeonCardActive : styles.playerNeonCardInactive,
                    isTwoPlayer ? { flex: 1, marginHorizontal: 5 } : { width: '48%', marginBottom: 10 }
                  ]}
                >
                  {/* Turn indicator badge */}
                  <View style={isActive ? styles.turnBadgeActive : styles.turnBadgeInactive}>
                    <Text style={isActive ? styles.turnBadgeActiveText : styles.turnBadgeInactiveText}>
                      {isActive ? `● ${t.yourTurn || 'YOUR TURN'}` : (t.waitingTurn || 'WAITING')}
                    </Text>
                  </View>

                  {/* Player identity row */}
                  <View style={styles.playerCardHeader}>
                    <View style={[styles.playerAvatarCircle, isActive && styles.playerAvatarCircleActive]}>
                      <Text style={[styles.playerAvatarLetter, isActive && { color: '#00f2fe' }]}>
                        {pId.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.playerNameText, isActive ? styles.playerNameActive : styles.playerNameInactive]}
                    >
                      {pId.toUpperCase()}
                    </Text>
                  </View>

                  {/* Digital Score */}
                  <Text style={[styles.playerScoreDisplay, isActive ? styles.scoreActiveText : styles.scoreInactiveText]}>
                    {pScore}
                  </Text>

                  {/* Pocketed Mini Balls */}
                  <View style={styles.miniBallsRow}>
                    {p.history && p.history.length > 0 ? (
                      p.history.slice(-5).map((item, idx) => (
                        <MiniatureBall key={idx} item={item} />
                      ))
                    ) : (
                      <Text style={styles.noPocketedText}>- - -</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── 2D POOL TABLE (Image 2 Metallic Frame & Dispersed 3D Balls) ── */}
          <View style={styles.poolTableWrapper}>
            <View style={styles.poolTableOuter}>
              {/* Metallic corner pocket plates / trims */}
              <View style={[styles.pocketChromePlate, styles.plateTopLeft]} />
              <View style={[styles.pocketChromePlate, styles.plateTopRight]} />
              <View style={[styles.pocketChromePlate, styles.plateBottomLeft]} />
              <View style={[styles.pocketChromePlate, styles.plateBottomRight]} />
              <View style={[styles.pocketChromePlateSide, styles.plateMidLeft]} />
              <View style={[styles.pocketChromePlateSide, styles.plateMidRight]} />

              {/* Tournament Felt Surface */}
              <LinearGradient
                colors={['#0e4f27', '#083619', '#0e4f27']}
                style={styles.poolTableFelt}
              >
                {/* 6 Drop Pockets */}
                {[
                  { top: 2, left: 2 },
                  { top: 2, right: 2 },
                  { bottom: 2, left: 2 },
                  { bottom: 2, right: 2 },
                  { top: '50%', left: 2, marginTop: -10 },
                  { top: '50%', right: 2, marginTop: -10 },
                ].map((pos, i) => (
                  <View key={i} style={[styles.pocketDropHole, pos]} />
                ))}

                {/* 13 Realistic 3D Balls */}
                {[
                  { num: 3,  top: '15%', left: '16%' },
                  { num: 4,  top: '38%', left: '14%' },
                  { num: 5,  top: '62%', left: '15%' },
                  { num: 6,  top: '83%', left: '24%' },
                  { num: 7,  top: '84%', left: '44%' },
                  { num: 8,  top: '50%', left: '48%' },
                  { num: 9,  top: '26%', left: '50%' },
                  { num: 10, top: '14%', left: '68%' },
                  { num: 11, top: '34%', left: '84%' },
                  { num: 12, top: '58%', left: '85%' },
                  { num: 13, top: '82%', left: '78%' },
                  { num: 14, top: '72%', left: '62%' },
                  { num: 15, top: '14%', left: '34%' },
                ].map(({ num, top, left }) => {
                  const remaining = status.remaining_numbers;
                  const isPocketed = !remaining.includes(num);
                  if (isPocketed) return null;
                  const isSelected = selectedBall === num;
                  const theme = BALL_THEMES[num] || { solid: '#888', gradient: ['#aaa', '#888', '#555'], stripe: false };
                  const isStripe = theme.stripe;
                  return (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.tableBallTouch,
                        { top, left },
                      ]}
                      onPress={() => {
                        triggerHaptic('light');
                        setSelectedBall(num);
                        playSound('ball_select');
                      }}
                      activeOpacity={0.8}
                    >
                      {/* Glow ring behind the ball when selected */}
                      {isSelected && <View style={styles.tableBallGlow} />}

                      {/* Directional contact shadow on green cloth */}
                      <View style={styles.tableBallShadow} />

                      {/* 3D Realistic Billiard Ball matching Image 2 */}
                      <View style={styles.tableBall}>
                        {isStripe ? (
                          <LinearGradient
                            colors={['#ffffff', '#f4f4f4', '#c9c9c9']}
                            start={{ x: 0.22, y: 0.12 }}
                            end={{ x: 0.85, y: 0.92 }}
                            style={styles.ballSphereBase}
                          >
                            <LinearGradient
                              colors={theme.gradient}
                              start={{ x: 0.22, y: 0.15 }}
                              end={{ x: 0.85, y: 0.90 }}
                              style={styles.tableBallStripeBand}
                            />
                            <View style={styles.tableBallGlare} />
                            <View style={styles.tableBallPinpoint} />
                            <View style={styles.tableBallDot}>
                              <Text style={styles.tableBallNumText}>{num}</Text>
                              {theme.underline && <View style={styles.ballNumUnderline} />}
                            </View>
                          </LinearGradient>
                        ) : (
                          <LinearGradient
                            colors={theme.gradient}
                            start={{ x: 0.22, y: 0.12 }}
                            end={{ x: 0.85, y: 0.92 }}
                            style={styles.ballSphereBase}
                          >
                            <View style={styles.tableBallGlare} />
                            <View style={styles.tableBallPinpoint} />
                            <View style={styles.tableBallRim} />
                            <View style={styles.tableBallDot}>
                              <Text style={styles.tableBallNumText}>{num}</Text>
                              {theme.underline && <View style={styles.ballNumUnderline} />}
                            </View>
                          </LinearGradient>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </LinearGradient>
            </View>

            {/* BALLS REMAINING PILL BADGE (Image 2 style) */}
            <View style={styles.ballsRemainingContainer}>
              <View style={styles.ballsRemainingPill}>
                <Ionicons name="ellipse" size={8} color="#00f2fe" style={{ marginRight: 6 }} />
                <Text style={styles.ballsRemainingText}>
                  {t.ballsRemaining || 'BALLS REMAINING'}: <Text style={{ color: '#00f2fe', fontWeight: 'bold' }}>{remainingCount}</Text>
                </Text>
              </View>
            </View>

            {/* Ball Selection Alert Banner */}
            {selectedBall ? (
              <View style={styles.ballSelectedBanner}>
                <Text style={styles.ballSelectedText}>
                  Ball <Text style={{ color: '#ffcc00', fontWeight: '900' }}>{selectedBall}</Text> selected — Tap <Text style={{ color: '#00e676', fontWeight: 'bold' }}>+ {t.point || 'POINT'}</Text> or <Text style={{ color: '#ff3366', fontWeight: 'bold' }}>- {t.point || 'POINT'}</Text>
                </Text>
              </View>
            ) : (
              <Text style={styles.tableBallHint}>Tap a ball on the table to score or penalize</Text>
            )}
          </View>

          {/* ── BALLS SUNK / POCKETED CARD (Image 1 style) ── */}
          <View style={styles.ballsSunkCard}>
            <View style={styles.ballsSunkHeader}>
              <Text style={styles.ballsSunkTitle}>{t.ballsSunk || 'BALLS SUNK'}</Text>
              <View style={styles.cueBallBadge}>
                <View style={styles.cueBallDot} />
                <Text style={styles.cueBallText}>Cue Ball {t.cueBallReady || 'Ready'}</Text>
              </View>
            </View>
            <View style={styles.ballsSunkList}>
              {status.used_numbers && status.used_numbers.length > 0 ? (
                status.used_numbers.map(num => (
                  <View key={num} style={styles.sunkBallWrapper}>
                    <MiniatureBall item={'+' + num} />
                    <View style={styles.sunkCheckBadge}>
                      <Ionicons name="checkmark" size={8} color="#fff" />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noSunkText}>{t.allBallsOnTable || 'All balls on table'}</Text>
              )}
            </View>
          </View>

          {/* ── PRIMARY NEON ACTION BUTTONS (Image 2 style) ── */}
          <View style={styles.primaryActionRow}>
            <TouchableOpacity
              style={styles.neonBtnAdd}
              onPress={() => sendAction('add')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={26} color="#00e676" />
              <Text style={styles.neonBtnAddText}>+ {t.point || 'POINT'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.neonBtnSubtract}
              onPress={() => sendAction('subtract')}
              activeOpacity={0.8}
            >
              <Ionicons name="remove" size={26} color="#ff3366" />
              <Text style={styles.neonBtnSubtractText}>- {t.point || 'POINT'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── SECONDARY PILL CONTROLS (Image 2 style: UNDO, PASS TURN, QUIT) ── */}
          <View style={styles.secondaryControlsRow}>
            <TouchableOpacity
              style={[styles.secPillBtn, !status.can_undo && styles.secPillBtnDisabled]}
              onPress={handleUndo}
              disabled={!status.can_undo}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-undo" size={15} color={status.can_undo ? '#ffcc00' : '#4b5563'} />
              <Text style={[styles.secPillText, { color: status.can_undo ? '#ffcc00' : '#4b5563' }]}>
                {' '}{t.undo || 'UNDO'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secPillBtn}
              onPress={handlePassTurn}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal" size={15} color="#00f2fe" />
              <Text style={[styles.secPillText, { color: '#00f2fe' }]}>
                {' '}{t.passTurn || 'PASS TURN'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secPillBtn}
              onPress={handleQuitGame}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={15} color="#ff4444" />
              <Text style={[styles.secPillText, { color: '#ff4444' }]}>
                {' '}{t.quit || 'QUIT'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderHistory = () => {

    // ── Analytics computations ──
    const totalGames = gameHistory.length;
    const totalEarnings = gameHistory.reduce((sum, g) => sum + (g.totalPot || 0), 0);
    const hostCommission = gameHistory.reduce((sum, g) => sum + (g.prizeKotariw ?? ((g.totalPot || 0) * 0.20)), 0);
    const avgPot = totalGames > 0 ? (totalEarnings / totalGames).toFixed(0) : 0;

    // Last 8 matches for bar chart (oldest → newest)
    const chartData = [...gameHistory].reverse().slice(-8);
    const maxPot = chartData.reduce((m, g) => Math.max(m, g.totalPot || 0), 1);

    return (
      <View style={styles.gameContainer}>
        <View style={styles.headerContainer}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={() => setCurrentScreen('HOME')} style={{marginRight: 15}}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{fontSize: 22, color: '#fff', fontWeight: 'bold'}}>{t.gameHistory}</Text>
          </View>
          <TouchableOpacity 
            style={styles.clearHistoryBtn} 
            onPress={() => {
              Alert.alert(
                "Clear History",
                "Are you sure you want to clear all history records?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                      setGameHistory([]);
                      await AsyncStorage.removeItem('kotariw_history');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.historyTabBar}>
          <TouchableOpacity
            style={[styles.historyTabBtn, historyTab === 'matches' && styles.historyTabBtnActive]}
            onPress={() => { triggerHaptic('light'); setHistoryTab('matches'); }}
          >
            <Ionicons name="list" size={16} color={historyTab === 'matches' ? '#111' : '#aab'} />
            <Text style={[styles.historyTabText, historyTab === 'matches' && { color: '#111' }]}>{t.matchesTab}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.historyTabBtn, historyTab === 'analytics' && styles.historyTabBtnActive]}
            onPress={() => { triggerHaptic('light'); setHistoryTab('analytics'); }}
          >
            <Ionicons name="bar-chart" size={16} color={historyTab === 'analytics' ? '#111' : '#aab'} />
            <Text style={[styles.historyTabText, historyTab === 'analytics' && { color: '#111' }]}>{t.analyticsTab}</Text>
          </TouchableOpacity>
        </View>

        {historyTab === 'matches' ? (
          gameHistory.length === 0 ? (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
              <Ionicons name="document-text-outline" size={80} color="#445" />
              <Text style={{color: '#889', fontSize: 16, marginTop: 15, textAlign: 'center'}}>
                {t.noHistory}
              </Text>
            </View>
          ) : (
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 15}} showsVerticalScrollIndicator={true}>
              {gameHistory.map((game) => (
                <LinearGradient key={game.id} colors={['#2a2a3e', '#1a1a2e']} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View>
                      <Text style={styles.historyDate}>{game.date} | {game.startTime} - {game.endTime}</Text>
                      <Text style={styles.historyOpText}>{t.operator}: {game.operator}</Text>
                    </View>
                    <View style={styles.historyTableBadge}>
                      <Text style={styles.historyTableText}>Table {game.table}</Text>
                    </View>
                  </View>
                  <View style={styles.historyDivider} />
                  
                  <View style={styles.historyWinnerRow}>
                    <Text style={styles.historyWinnerLabel}>{t.winner}:</Text>
                    <Text style={styles.historyWinnerName}>{game.winnerId} ({game.winnerScore} pts)</Text>
                  </View>

                  <View style={styles.historyPlayersList}>
                    {game.players.map((p, idx) => {
                      const isWinner = p.name.toLowerCase() === game.winnerId.toLowerCase();
                      return (
                        <View key={idx} style={styles.historyPlayerScoreRow}>
                          <Text style={[styles.historyPlayerNameText, isWinner && {color: '#ffcc00', fontWeight: 'bold'}]}>
                            {p.name} {isWinner && '👑'}
                          </Text>
                          <Text style={styles.historyPlayerScoreText}>
                            Score: {p.score} | Bet: {p.bet} Birr
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={{flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingHorizontal: 5}}>
                    <View>
                      <Text style={{color: '#aab', fontSize: 11}}>🥇 {t.winnerShare} ({game.pctWinner ?? 80}%):</Text>
                      <Text style={{color: '#fff', fontSize: 13, fontWeight: 'bold'}}>{(game.prizeWinner ?? (game.totalPot * 0.8)).toFixed(0)} Birr</Text>
                    </View>
                    {(game.pctTable > 0 || game.prizeTable > 0) && (
                      <View>
                        <Text style={{color: '#aab', fontSize: 11}}>🎱 {t.tableShare} ({game.pctTable ?? 0}%):</Text>
                        <Text style={{color: '#fff', fontSize: 13, fontWeight: 'bold'}}>{(game.prizeTable ?? 0).toFixed(0)} Birr</Text>
                      </View>
                    )}
                    <View>
                      <Text style={{color: '#aab', fontSize: 11}}>🏠 {t.kotariwShare} ({game.pctKotariw ?? 20}%):</Text>
                      <Text style={{color: '#00e676', fontSize: 13, fontWeight: 'bold'}}>{(game.prizeKotariw ?? (game.totalPot * 0.2)).toFixed(0)} Birr</Text>
                    </View>
                  </View>

                  <View style={styles.historyDivider} />

                  <View style={styles.historyFooter}>
                    <Text style={styles.historyFooterPotLabel}>Total Pot:</Text>
                    <Text style={styles.historyFooterPotValue}>{game.totalPot} Birr</Text>
                  </View>
                </LinearGradient>
              ))}
            </ScrollView>
          )
        ) : (
          /* ── ANALYTICS TAB ── */
          <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 15}}>
            {gameHistory.length === 0 ? (
              <View style={{justifyContent: 'center', alignItems: 'center', padding: 40}}>
                <Ionicons name="bar-chart-outline" size={80} color="#445" />
                <Text style={{color: '#889', fontSize: 16, marginTop: 15, textAlign: 'center'}}>{t.noAnalyticsData}</Text>
              </View>
            ) : (
              <>
                {/* KPI cards */}
                <View style={styles.analyticsKpiRow}>
                  <LinearGradient colors={['#1a3a6b', '#0d1f3d']} style={styles.analyticsKpiCard}>
                    <Ionicons name="game-controller" size={28} color="#00cfff" />
                    <Text style={styles.analyticsKpiValue}>{totalGames}</Text>
                    <Text style={styles.analyticsKpiLabel}>{t.totalGames}</Text>
                  </LinearGradient>
                  <LinearGradient colors={['#1a6b3a', '#0d3d1f']} style={styles.analyticsKpiCard}>
                    <MaterialCommunityIcons name="poker-chip" size={28} color="#FFD700" />
                    <Text style={styles.analyticsKpiValue}>{totalEarnings.toFixed(0)}</Text>
                    <Text style={styles.analyticsKpiLabel}>{t.totalEarnings}</Text>
                  </LinearGradient>
                </View>
                <View style={styles.analyticsKpiRow}>
                  <LinearGradient colors={['#3d1a1a', '#2a0f0f']} style={styles.analyticsKpiCard}>
                    <Ionicons name="home" size={28} color="#ff8a65" />
                    <Text style={[styles.analyticsKpiValue, {color:'#ff8a65'}]}>{hostCommission.toFixed(0)}</Text>
                    <Text style={styles.analyticsKpiLabel}>{t.hostCommission}</Text>
                  </LinearGradient>
                  <LinearGradient colors={['#3d3a1a', '#2a280f']} style={styles.analyticsKpiCard}>
                    <Ionicons name="trending-up" size={28} color="#ffcc00" />
                    <Text style={[styles.analyticsKpiValue, {color:'#ffcc00'}]}>{avgPot}</Text>
                    <Text style={styles.analyticsKpiLabel}>{t.averagePot}</Text>
                  </LinearGradient>
                </View>

                {/* Bar Chart */}
                <LinearGradient colors={['#1e1e30', '#14142a']} style={styles.analyticsChartCard}>
                  <Text style={styles.analyticsChartTitle}>{t.recentEarnings}</Text>
                  <View style={styles.analyticsBarContainer}>
                    {chartData.map((game, idx) => {
                      const barHeightPct = ((game.totalPot || 0) / maxPot) * 100;
                      const commission = (game.totalPot * 0.20).toFixed(0);
                      return (
                        <View key={game.id} style={styles.analyticsBarCol}>
                          <Text style={styles.analyticsBarValue}>{(game.totalPot || 0).toFixed(0)}</Text>
                          <View style={styles.analyticsBarTrack}>
                            <LinearGradient
                              colors={['#00e676', '#007a3d']}
                              style={[styles.analyticsBarFill, { height: `${barHeightPct}%` }]}
                            />
                          </View>
                          <View style={styles.analyticsCommissionDot}>
                            <Text style={styles.analyticsCommissionText}>{commission}</Text>
                          </View>
                          <Text style={styles.analyticsBarLabel} numberOfLines={1}>
                            {(idx + 1)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.analyticsLegend}>
                    <View style={[styles.analyticsLegendDot, {backgroundColor:'#00e676'}]} />
                    <Text style={styles.analyticsLegendText}>Pot   </Text>
                    <View style={[styles.analyticsLegendDot, {backgroundColor:'#ff8a65'}]} />
                    <Text style={styles.analyticsLegendText}>Commission (below bar)</Text>
                  </View>
                </LinearGradient>
              </>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderBottomNav = () => (
    <View style={styles.bottomNavDock}>
      <TouchableOpacity
        style={styles.bottomNavItem}
        onPress={() => { triggerHaptic('light'); setCurrentScreen('GAME'); }}
      >
        {currentScreen === 'GAME' && <View style={styles.bottomNavActiveIndicator} />}
        <Ionicons
          name="game-controller"
          size={22}
          color={currentScreen === 'GAME' ? '#00f2fe' : '#64748b'}
        />
        <Text style={[styles.bottomNavText, currentScreen === 'GAME' && styles.bottomNavTextActive]}>
          {t.gameTab || 'Game'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomNavItem}
        onPress={() => { triggerHaptic('light'); setCurrentScreen('HISTORY'); }}
      >
        {currentScreen === 'HISTORY' && <View style={styles.bottomNavActiveIndicator} />}
        <Ionicons
          name="time"
          size={22}
          color={currentScreen === 'HISTORY' ? '#00f2fe' : '#64748b'}
        />
        <Text style={[styles.bottomNavText, currentScreen === 'HISTORY' && styles.bottomNavTextActive]}>
          {t.historyNavTab || 'History'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomNavItem}
        onPress={() => { triggerHaptic('light'); setDashboardVisible(true); }}
      >
        <Ionicons name="stats-chart" size={22} color="#64748b" />
        <Text style={styles.bottomNavText}>
          {t.statsNavTab || 'Stats'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomNavItem}
        onPress={() => { triggerHaptic('light'); setMenuVisible(true); }}
      >
        <Ionicons name="settings" size={22} color="#64748b" />
        <Text style={styles.bottomNavText}>
          {t.settingsNavTab || 'Settings'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{flex:1, backgroundColor:'#080b11'}}>
      {currentScreen === 'HOME' && renderHome()}
      {currentScreen === 'GAME' && renderGame()}
      {currentScreen === 'HISTORY' && renderHistory()}
      {renderMenuModal()}
      {renderKotariwDashboardModal()}
      {renderOperatorModal()}
      {(currentScreen === 'GAME' || currentScreen === 'HISTORY') && renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Futuristic Scorer Header ──
  headerCenterWrap: { alignItems: 'center' },
  headerNeonTitle: {
    color: '#00f2fe',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.5,
    textShadowColor: 'rgba(0, 242, 254, 0.7)',
    textShadowRadius: 8,
  },
  tableBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  tableBadgeText: { color: '#00f2fe', fontSize: 10, fontWeight: '800' },
  potPillBadge: {
    backgroundColor: 'rgba(255, 204, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.25)',
  },
  potPillText: { color: '#ffcc00', fontSize: 11, fontWeight: '700' },
  gearBtn: {
    padding: 7,
    backgroundColor: 'rgba(20, 26, 38, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Neon Player Cards (Image 2 style) ──
  playerNeonCard: {
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  playerNeonCardActive: {
    backgroundColor: 'rgba(10, 22, 40, 0.9)',
    borderColor: '#00f2fe',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 8,
  },
  playerNeonCardInactive: {
    backgroundColor: 'rgba(16, 22, 34, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  turnBadgeActive: {
    backgroundColor: '#00f2fe',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  turnBadgeActiveText: {
    color: '#070e1b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  turnBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  turnBadgeInactiveText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  playerAvatarCircleActive: {
    borderColor: '#00f2fe',
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
  },
  playerAvatarLetter: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  playerNameText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  playerNameActive: { color: '#00f2fe' },
  playerNameInactive: { color: '#718096' },
  playerScoreDisplay: {
    fontSize: 42,
    fontWeight: '900',
    marginVertical: 2,
    letterSpacing: 1,
  },
  scoreActiveText: {
    color: '#ffffff',
    textShadowColor: 'rgba(0, 242, 254, 0.4)',
    textShadowRadius: 8,
  },
  scoreInactiveText: { color: '#64748b' },
  noPocketedText: { color: '#374151', fontSize: 10, letterSpacing: 2 },

  // ── Metallic Pool Table (Image 2 style) ──
  pocketChromePlate: {
    position: 'absolute',
    width: 28,
    height: 28,
    backgroundColor: '#94a3b8',
    borderRadius: 6,
    zIndex: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  plateTopLeft: { top: -2, left: -2, borderTopLeftRadius: 14 },
  plateTopRight: { top: -2, right: -2, borderTopRightRadius: 14 },
  plateBottomLeft: { bottom: -2, left: -2, borderBottomLeftRadius: 14 },
  plateBottomRight: { bottom: -2, right: -2, borderBottomRightRadius: 14 },
  pocketChromePlateSide: {
    position: 'absolute',
    width: 22,
    height: 16,
    backgroundColor: '#94a3b8',
    borderRadius: 4,
    zIndex: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  plateMidLeft: { top: '50%', left: -2, marginTop: -8 },
  plateMidRight: { top: '50%', right: -2, marginTop: -8 },
  pocketDropHole: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#05080f',
    zIndex: 4,
  },

  // ── Balls Remaining Pill (Image 2 style) ──
  ballsRemainingContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  ballsRemainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  ballsRemainingText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  ballSelectedBanner: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.35)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginTop: 8,
  },
  ballSelectedText: {
    color: '#e2e8f0',
    fontSize: 12,
    textAlign: 'center',
  },

  // ── Balls Sunk Card (Image 1 style) ──
  ballsSunkCard: {
    marginHorizontal: 15,
    marginTop: 12,
    backgroundColor: 'rgba(16, 22, 34, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
  },
  ballsSunkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ballsSunkTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cueBallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cueBallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    marginRight: 5,
  },
  cueBallText: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
  ballsSunkList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 28,
  },
  sunkBallWrapper: {
    position: 'relative',
    marginRight: 6,
    marginBottom: 4,
  },
  sunkCheckBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00e676',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  noSunkText: { color: '#64748b', fontSize: 11, fontStyle: 'italic' },

  // ── Primary Neon Action Buttons (Image 2 style) ──
  primaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 16,
  },
  neonBtnAdd: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderWidth: 2,
    borderColor: '#00e676',
    borderRadius: 14,
    paddingVertical: 14,
    marginRight: 8,
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 8,
  },
  neonBtnAddText: {
    color: '#00e676',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginLeft: 6,
  },
  neonBtnSubtract: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
    borderWidth: 2,
    borderColor: '#ff3366',
    borderRadius: 14,
    paddingVertical: 14,
    marginLeft: 8,
    shadowColor: '#ff3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 8,
  },
  neonBtnSubtractText: {
    color: '#ff3366',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginLeft: 6,
  },

  // ── Secondary Controls Row (Image 2 style) ──
  secondaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
  },
  secPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 26, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  secPillBtnDisabled: {
    opacity: 0.4,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  secPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // ── Bottom Dock Navigation (Image 1 & Image 2 style) ──
  bottomNavDock: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 14, 22, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  bottomNavActiveIndicator: {
    position: 'absolute',
    top: -8,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#00f2fe',
    borderRadius: 2,
    shadowColor: '#00f2fe',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  bottomNavText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  bottomNavTextActive: {
    color: '#00f2fe',
  },

  fullScreenBg: { flex: 1, resizeMode: 'cover' },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 5, 20, 0.45)' },
  bgOverlayHeavy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 5, 20, 0.85)' },
  gameContainer: { flex: 1, backgroundColor: '#0f0f1c' },
  gameScrollContent: { flexGrow: 1, paddingBottom: 30 },
  
  // Language button
  langBtn: { marginRight: 8, padding: 7, backgroundColor: 'rgba(20,20,40,0.8)', borderRadius: 16, borderWidth: 1, borderColor: '#445', justifyContent: 'center', alignItems: 'center', minWidth: 36 },
  langBtnText: { color: '#ffcc00', fontWeight: 'bold', fontSize: 12 },

  // Header
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 50, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  quitBtnHeader: { marginRight: 8, padding: 5, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.3)', justifyContent: 'center', alignItems: 'center' },
  profileBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,20,40,0.8)', paddingRight: 15, borderRadius: 30, borderWidth: 1, borderColor: '#445' },
  profileTextWrap: { marginLeft: 8 },
  profileName: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  levelWrap: { backgroundColor: '#ffcc00', paddingHorizontal: 6, borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 },
  levelText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  headerRightWrap: { flexDirection: 'row', alignItems: 'center' },
  historyBtn: { marginRight: 15, padding: 5, backgroundColor: 'rgba(20,20,40,0.8)', borderRadius: 20, borderWidth: 1, borderColor: '#445' },
  walletContainer: { justifyContent: 'center' },
  walletBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  walletText: { color: '#000', fontWeight: 'bold', fontSize: 16, marginHorizontal: 8 },

  // Home Screen Layout
  homeScrollContent: { flexGrow: 1 },
  homeContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  cardsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 10, marginVertical: 20 },
  sideCard: { width: 100, height: 160, borderRadius: 15, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  centerCard: { width: 150, height: 220, borderRadius: 20, overflow: 'hidden', marginHorizontal: 15, zIndex: 10, elevation: 20, shadowColor: '#00ff88', shadowOpacity: 0.4, shadowRadius: 20 },
  cardGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  cardGradientCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10, borderWidth: 2, borderColor: '#00ff88', borderRadius: 20 },
  centerIconWrap: { marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 15, textAlign: 'center' },
  cardTitleExtra: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 5 },

  // Dashboard / Session Stats
  dashboardContainer: { width: '90%', marginTop: 10 },
  dashboardGradient: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#334', elevation: 10 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dashboardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  dashboardDate: { color: '#889', fontSize: 12 },
  dashboardDivider: { height: 1, backgroundColor: '#334', marginVertical: 12 },
  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashboardCol: { flex: 1, alignItems: 'center' },
  dashboardLabel: { color: '#889', fontSize: 11, fontWeight: 'bold', marginBottom: 5 },
  dashboardValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  dashboardSubLabel: { color: '#889', fontSize: 12, marginBottom: 5 },
  sessionInput: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334', fontSize: 14, textAlign: 'center' },

  // Setup / Store Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '85%', borderRadius: 20, overflow: 'hidden', elevation: 20 },
  modalContentSmall: { width: '80%', borderRadius: 20, overflow: 'hidden', elevation: 20 },
  modalDarkGradient: { padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334', paddingBottom: 15 },
  modalTitle: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  label: { color: '#aab', fontSize: 14, marginBottom: 10, fontWeight: 'bold' },
  buttonGroup: { flexDirection: 'row', justifyContent: 'space-between' },
  countButton: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#445' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeButtonText: { color: '#111' },
  
  // Player Setup Row & Custom Pick Button
  playerSetupRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  nameInputWrapper: { flex: 1.5, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#334' },
  modalInputNameWithBtn: { flex: 1, color: '#00e676', padding: 14, fontSize: 16 },
  frequentPlayerBtn: { padding: 10, justifyContent: 'center', alignItems: 'center' },
  
  betInputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, alignItems: 'center', paddingRight: 10, borderWidth: 1, borderColor: '#334' },
  modalInputBet: { flex: 1, color: '#ffcc00', padding: 14, fontSize: 16, textAlign: 'center' },
  currTag: { color: '#889', fontSize: 12, fontWeight: 'bold' },
  startBtnOuter: { marginTop: 25, borderRadius: 15, overflow: 'hidden' },
  startBtnInner: { paddingVertical: 18, alignItems: 'center' },
  startBtnText: { color: '#111', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  storeBtnInner: { paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 15, elevation: 5 },
  storeBtnText: { color: '#111', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },

  // Player Picker Modal
  playerPickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334' },
  playerPickText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Game View
  gameInfoBox: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  turnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  potText: { color: '#ffcc00', fontSize: 16, marginTop: 5, fontWeight: '600' },
  scoresWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, padding: 15 },
  playerCard: { padding: 15, borderRadius: 15, alignItems: 'center', width: '45%', borderWidth: 1, borderColor: '#334', elevation: 5 },
  cardActiveGlow: { shadowColor: '#00e676', shadowOpacity: 0.8, shadowRadius: 10, elevation: 10, transform: [{scale: 1.05}] },
  playerName: { color: '#aab', fontSize: 15, fontWeight: 'bold' },
  playerScore: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  miniBall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2.5,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.4,
    shadowRadius: 1.5,
  },
  miniBallBase: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  miniBallStripe: {
    position: 'absolute',
    width: '100%',
    height: 13,
    top: 4.5,
    zIndex: 1,
  },
  miniBallInner: {
    width: 10.5,
    height: 10.5,
    borderRadius: 5.25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 0.4,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  miniBallText: {
    color: '#0d0d0d',
    fontSize: 6.5,
    fontWeight: '900',
    lineHeight: 8,
  },
  miniBallUnderline: {
    width: 5,
    height: 0.8,
    backgroundColor: '#0d0d0d',
    borderRadius: 0.5,
    marginTop: 0.3,
  },
  miniBallsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    maxWidth: '100%',
  },
  // ── Pool Table ──
  poolTableWrapper: { marginHorizontal: 12, marginTop: 10 },
  poolTableOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 12,
    borderColor: '#1a2230',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  poolTableFelt: {
    height: 280,
    position: 'relative',
  },
  pocketDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111',
  },
  // Each ball's absolute-positioned touch target
  tableBallTouch: {
    position: 'absolute',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  // Realistic contact drop shadow on green table felt
  tableBallShadow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000',
    opacity: 0.38,
    top: 5,
    left: 4,
    transform: [{ scaleY: 0.65 }],
    zIndex: 1,
  },
  // The round ball itself
  tableBall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    elevation: 8,
  },
  ballSphereBase: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // Wide stripe band across middle of stripe balls (Image 2 style)
  tableBallStripeBand: {
    position: 'absolute',
    width: '100%',
    height: 25,
    top: 8.5,
    zIndex: 1,
  },
  // Crisp white circle that holds the number (clean white on every ball like Image 2!)
  tableBallDot: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    borderWidth: 0.6,
    borderColor: 'rgba(0,0,0,0.22)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
  },
  tableBallNumText: {
    color: '#0d0d0d',
    fontSize: 9.5,
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 11,
  },
  ballNumUnderline: {
    width: 8.5,
    height: 1.3,
    backgroundColor: '#0d0d0d',
    borderRadius: 1,
    marginTop: 0.5,
  },
  // Curved gloss specular glare on top-left (Image 2 polished finish)
  tableBallGlare: {
    position: 'absolute',
    width: 14,
    height: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.65)',
    top: 3.5,
    left: 5.5,
    zIndex: 4,
    transform: [{ rotate: '-35deg' }],
  },
  // Tiny sharp pinpoint reflection for glossy 3D shine
  tableBallPinpoint: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    top: 5.5,
    left: 8.5,
    zIndex: 5,
  },
  tableBallRim: {
    position: 'absolute',
    width: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    bottom: 2.5,
    right: 5,
    zIndex: 2,
    transform: [{ rotate: '-25deg' }],
  },
  tableBallGlow: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#ffcc00',
    backgroundColor: 'rgba(255, 204, 0, 0.25)',
    zIndex: 0,
  },
  tableBallHint: {
    color: '#889',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  actionRow: { flexDirection: 'row', padding: 20, paddingBottom: 40, marginTop: 'auto' },
  actionGradiant: { flexDirection: 'row', paddingVertical: 16, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  actionBtnText: { fontSize: 16, fontWeight: 'bold', color: '#111' },

  // Winner View
  winnerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  winnerText: { fontSize: 44, color: '#ffcc00', fontWeight: '900', marginTop: 20, textShadowColor: '#000', textShadowRadius: 10 },
  finalScoreText: { fontSize: 20, color: '#fff', marginBottom: 40, fontWeight: 'bold' },
  financialCard: { width: '100%', padding: 25, borderRadius: 20, elevation: 15, borderWidth: 1, borderColor: '#445' },
  financialTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, letterSpacing: 2 },
  finDivider: { height: 1, backgroundColor: '#445', marginBottom: 15 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  finLabel: { color: '#aab', fontSize: 16 },
  finValue: { color: '#00e676', fontSize: 18, fontWeight: 'bold' },
  returnBtn: { paddingVertical: 15, paddingHorizontal: 40, borderRadius: 25, elevation: 5 },
  returnBtnText: { color: '#111', fontSize: 18, fontWeight: 'bold' },

  // History Screen Styles
  clearHistoryBtn: { padding: 8, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.3)' },
  historyCard: { padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#334', elevation: 5 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: '#aab', fontSize: 12, fontWeight: '600' },
  historyOpText: { color: '#667', fontSize: 11, marginTop: 2 },
  historyTableBadge: { backgroundColor: '#ffcc00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  historyTableText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  historyDivider: { height: 1, backgroundColor: '#334', marginVertical: 10 },
  historyWinnerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  historyWinnerLabel: { color: '#889', fontSize: 14, marginRight: 5 },
  historyWinnerName: { color: '#ffcc00', fontSize: 15, fontWeight: 'bold' },
  historyPlayersList: { paddingLeft: 10 },
  historyPlayerScoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  historyPlayerNameText: { color: '#fff', fontSize: 13 },
  historyPlayerScoreText: { color: '#889', fontSize: 12 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyFooterPotLabel: { color: '#aab', fontSize: 14, fontWeight: 'bold' },
  historyFooterPotValue: { color: '#00e676', fontSize: 16, fontWeight: 'bold' },

  // ---- NEW HOME UI ----
  homeTopBar: { position: 'absolute', top: 50, left: 15, right: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  menuBtn: { backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#fff' },
  menuModalContent: { width: '80%', borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  menuOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  menuOptionText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 15 },
  dashboardInputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 15, borderWidth: 1, borderColor: '#334' },
  dashboardInputLabel: { color: '#aab', fontSize: 14, fontWeight: 'bold', flex: 2 },
  dashboardInput: { color: '#ffcc00', fontSize: 18, fontWeight: 'bold', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 15, minWidth: 70, borderWidth: 1, borderColor: '#445' },
  dashboardPctSign: { color: '#889', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  dashboardValidationContainer: { alignItems: 'center', marginVertical: 15, padding: 12, borderRadius: 12 },
  dashboardValidationText: { fontSize: 14, fontWeight: 'bold' },
  homeCoinPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700', marginRight: 8 },
  homeCoinText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16, marginRight: 6 },
  homeGemBtn: { backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#00cfff' },

  // Logo
  logoArea: { alignItems: 'center', marginTop: 70, marginBottom: 10 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoBall: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 6, borderWidth: 3, borderColor: '#ff8800' },
  logoBallText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  logoText: { fontSize: 38, fontWeight: '900', color: '#4fc3f7', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 6 },
  flameBar: { height: 3, width: 220, backgroundColor: '#ff8800', borderRadius: 2, marginTop: 4, opacity: 0.7 },

  // Two main cards
  mainCardsRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  mainCard: { borderRadius: 22, padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 180, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', elevation: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  mainCardIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  mainCardBallNum: { color: '#fff', fontSize: 36, fontWeight: '900' },
  mainCardTitle: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  mainCardSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', marginTop: 4, letterSpacing: 2 },

  // Daily top players
  dailySection: { marginHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dailyTitle: { color: '#ccc', fontSize: 11, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center', marginBottom: 10 },
  dailyEmpty: { color: '#667', fontSize: 13, textAlign: 'center', marginVertical: 8 },
  dailyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dailyRank: { fontSize: 20, marginRight: 8, width: 28 },
  dailyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#556' },
  dailyName: { flex: 1, color: '#ddd', fontSize: 14, fontWeight: '600' },
  dailyScore: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },

  // Session inline
  sessionRowInline: { flexDirection: 'row', marginTop: 12 },
  sessionInputSmall: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334', fontSize: 13, textAlign: 'center' },
  sessionStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sessionStatText: { color: '#889', fontSize: 13 },

  // ── History Tabs ──
  historyTabBar: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334',
  },
  historyTabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  historyTabBtnActive: {
    backgroundColor: '#00e676',
  },
  historyTabText: {
    color: '#aab',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ── Analytics ──
  analyticsKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  analyticsKpiCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 6,
  },
  analyticsKpiValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 6,
  },
  analyticsKpiLabel: {
    color: '#889',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 3,
    textAlign: 'center',
  },
  analyticsChartCard: {
    borderRadius: 18,
    padding: 18,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#334',
    elevation: 8,
  },
  analyticsChartTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  analyticsBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 130,
    gap: 6,
  },
  analyticsBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  analyticsBarValue: {
    color: '#aab',
    fontSize: 8,
    marginBottom: 2,
  },
  analyticsBarTrack: {
    width: '80%',
    height: '85%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  analyticsBarFill: {
    width: '100%',
    borderRadius: 6,
  },
  analyticsCommissionDot: {
    backgroundColor: 'rgba(255,138,101,0.2)',
    borderRadius: 4,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  analyticsCommissionText: {
    color: '#ff8a65',
    fontSize: 7,
    fontWeight: 'bold',
  },
  analyticsBarLabel: {
    color: '#667',
    fontSize: 9,
    marginTop: 3,
  },
  analyticsLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  analyticsLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  analyticsLegendText: {
    color: '#889',
    fontSize: 11,
    marginRight: 10,
  },

  // ── Coin Store Styles ──
  storeSubtitle: {
    color: '#aab',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  packageCard: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334',
  },
  packageCardPopular: {
    borderColor: '#ffcc00',
    borderWidth: 2,
    transform: [{ scale: 1.01 }],
  },
  packageCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  packageIconWrap: {
    marginRight: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  packagePrice: {
    color: '#889',
    fontSize: 14,
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: '#ffcc00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  popularBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  },
  instructionContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334',
    marginBottom: 15,
  },
  instructionText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 22,
  },
  settingsLabel: {
    color: '#aab',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  settingsInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334',
    fontSize: 14,
  },
});
