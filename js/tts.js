/**
 * tts.js — 语音播放引擎
 *
 * 基于 Web Speech API (speechSynthesis)
 */

let _currentUtterance = null;
let _isPaused = false;
let _currentRate = 0.8;
let _voicesReady = false;
let _savedVoices = [];

/**
 * 等待语音列表加载完成（Chrome 需要）
 */
function waitForVoices(callback) {
  if (!window.speechSynthesis) {
    callback([]);
    return;
  }
  if (_voicesReady) {
    callback(_savedVoices);
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    _savedVoices = voices;
    _voicesReady = true;
    callback(voices);
    return;
  }
  window.speechSynthesis.onvoiceschanged = () => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) {
      _savedVoices = v;
      _voicesReady = true;
      window.speechSynthesis.onvoiceschanged = null;
      callback(v);
    }
  };
}

/**
 * 播放文本
 * @param {string} text - 要朗读的文本
 * @param {number} rate - 语速 (0.1~2.0，默认0.8慢速)
 * @param {Function} onEnd - 播放结束回调
 * @param {Function} onBoundary - 边界事件回调 (单词级)
 */
function speak(text, rate, onEnd, onBoundary) {
  // 停止当前播放
  stop();

  if (!text) return;

  // 先等语音列表加载完，再用正确的声音播放
  waitForVoices((voices) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate !== undefined ? rate : _currentRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 选择英文声音（优先女声）
    const preferredVoice = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google US English'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
    }

    if (onBoundary) {
      utterance.onboundary = onBoundary;
    }

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
    };

    _currentUtterance = utterance;
    _isPaused = false;

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * 停止播放
 */
function stop() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  _currentUtterance = null;
  _isPaused = false;
}

/**
 * 暂停/继续切换
 */
function togglePause() {
  if (!window.speechSynthesis) return false;
  if (_isPaused) {
    window.speechSynthesis.resume();
    _isPaused = false;
  } else {
    window.speechSynthesis.pause();
    _isPaused = true;
  }
  return _isPaused;
}

/**
 * 设置语速
 */
function setRate(rate) {
  _currentRate = Math.max(0.3, Math.min(2.0, rate));
  return _currentRate;
}

/**
 * 获取当前语速
 */
function getRate() {
  return _currentRate;
}

/**
 * 是否正在播放
 */
function isSpeaking() {
  return window.speechSynthesis ? window.speechSynthesis.speaking : false;
}

/**
 * 是否暂停中
 */
function isPaused() {
  return _isPaused;
}

if (window.speechSynthesis) {
  waitForVoices(() => {});
}
