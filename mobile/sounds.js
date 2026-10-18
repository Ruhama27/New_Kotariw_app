import { Audio } from 'expo-av';

let sounds = {};
let isSoundEnabled = true;
let bgMusicSound = null;

const soundAssets = {
  ball_select: require('./assets/sounds/ball_select.wav'),
  score_add:   require('./assets/sounds/score_add.wav'),
  winner:      require('./assets/sounds/winner1.wav'),
};

export async function loadSounds() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    for (const [key, asset] of Object.entries(soundAssets)) {
      const { sound } = await Audio.Sound.createAsync(asset);
      sounds[key] = sound;
    }
  } catch (e) {
    console.warn('Sound load error:', e);
  }
}

export async function unloadSounds() {
  for (const sound of Object.values(sounds)) {
    try { await sound.unloadAsync(); } catch (_) {}
  }
  sounds = {};
  if (bgMusicSound) {
    try { await bgMusicSound.unloadAsync(); } catch (_) {}
    bgMusicSound = null;
  }
}

export function setSoundEnabled(val) {
  isSoundEnabled = val;
  if (!val) {
    stopBackgroundMusic();
  } else {
    playBackgroundMusic();
  }
}

export async function playSound(name) {
  if (!isSoundEnabled) return;
  try {
    const sound = sounds[name];
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    console.warn('Sound play error:', e);
  }
}

export async function playBackgroundMusic() {
  if (!isSoundEnabled) return;
  try {
    if (!bgMusicSound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
        { shouldPlay: true, isLooping: true, volume: 0.12 }
      );
      bgMusicSound = sound;
    } else {
      const status = await bgMusicSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await bgMusicSound.playAsync();
      }
    }
  } catch (e) {
    console.warn('Background music play error:', e);
  }
}

export async function stopBackgroundMusic() {
  try {
    if (bgMusicSound) {
      const status = await bgMusicSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await bgMusicSound.pauseAsync();
      }
    }
  } catch (e) {
    console.warn('Background music stop error:', e);
  }
}
