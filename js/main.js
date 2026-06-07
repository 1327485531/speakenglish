/**
 * main.js — 主流程编排
 *
 * 职责:
 *   1. 应用初始化
 *   2. 输入处理（防抖）
 *   3. 生成注音的主流程
 *   4. UI事件绑定
 */

// 防抖定时器
let _debounceTimer = null;
const DEBOUNCE_DELAY = 500;

// 常用词列表（均经 pipeline 验证，无需 word_hanzi 兜底）
const COMMON_WORDS = [
  'hello', 'thanks', 'sorry', 'please', 'help', 'welcome', 'goodbye', 'excuse',
  'hospital', 'restaurant', 'police', 'airport', 'hotel', 'money', 'water', 'coffee', 'bathroom',
  'beautiful', 'important', 'interesting', 'emergency', 'different', 'problem', 'question', 'answer',
];

// 常用句列表（均使用 BUILTIN_DICT 已有词）
const COMMON_SENTENCES = [
  'Where is the toilet?',
  'What is your name?',
  'I need help.',
  'How much is this?',
  'Where is the hospital?',
  'Can I have some water?',
  'Thank you very much.',
  'Do you speak English?',
  'I don\'t understand.',
  'What time is it?',
];

/** 从数组随机取一项 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 渲染快捷标签 */
function renderQuickSelect() {
  const wordsEl = document.getElementById('qs-words');
  const sentencesEl = document.getElementById('qs-sentences');
  if (!wordsEl || !sentencesEl) return;

  wordsEl.innerHTML = COMMON_WORDS.map(w =>
    '<button class="qs-tag" data-type="word">' + w + '</button>'
  ).join('');

  sentencesEl.innerHTML = COMMON_SENTENCES.map(s =>
    '<button class="qs-tag" data-type="sentence">' + s + '</button>'
  ).join('');
}

/**
 * 应用初始化
 */
async function init() {
  // 加载数据文件
  try {
    await initWordEngine();
    await initRenderer();
    await loadLinkingRules();
    console.log('Dictionary, IPA help, and linking rules loaded.');
  } catch (e) {
    console.warn('Data loading error:', e);
  }

  // 绑定UI事件
  bindEvents();

  // 初始状态
  updatePlayButtonState(false);
  updateStatus('就绪，请输入英文');
}

/**
 * 绑定UI事件
 */
function bindEvents() {
  const inputEl = document.getElementById('text-input');
  const generateBtn = document.getElementById('generate-btn');
  const playBtn = document.getElementById('play-btn');
  const rateSlider = document.getElementById('rate-slider');
  const rateValue = document.getElementById('rate-value');
  const modeToggle = document.getElementById('mode-toggle');

  if (!inputEl || !generateBtn) return;

  // 输入框实时生成（防抖）
  inputEl.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    const text = inputEl.value.trim();
    if (text) {
      _debounceTimer = setTimeout(() => generateHint(text), DEBOUNCE_DELAY);
    } else {
      clearScore();
      updatePlayButtonState(false);
    }
  });

  // 回车键触发
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(_debounceTimer);
      const text = inputEl.value.trim();
      if (text) generateHint(text);
    }
  });

  // 生成按钮
  generateBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (text) generateHint(text);
  });

  // 播放按钮
  if (playBtn) {
    playBtn.addEventListener('click', togglePlay);
  }

  // 语速滑块
  if (rateSlider && rateValue) {
    rateSlider.addEventListener('input', () => {
      const rate = parseFloat(rateSlider.value);
      setRate(rate);
      rateValue.textContent = rate.toFixed(1) + 'x';
    });
  }

  // 模式切换
  if (modeToggle) {
    modeToggle.addEventListener('change', () => {
      const showPinyin = modeToggle.checked;
      setPinyinMode(showPinyin);
      const text = inputEl.value.trim();
      if (text) generateHint(text, { skipPlayUpdate: true });
      updateModeLabel(showPinyin);
    });
  }

  // 渲染快捷标签
  renderQuickSelect();

  // 快捷标签点击 → 填入输入框并生成
  document.querySelector('.quick-select').addEventListener('click', (e) => {
    const tag = e.target.closest('.qs-tag');
    const randomBtn = e.target.closest('.qs-random');
    if (!tag && !randomBtn) return;

    if (tag) {
      const text = tag.textContent;
      const type = tag.dataset.type;
      inputEl.value = text;
      clearTimeout(_debounceTimer);
      generateHint(text);
    } else if (randomBtn) {
      const target = randomBtn.dataset.target;
      const list = target === 'word' ? COMMON_WORDS : COMMON_SENTENCES;
      const text = pickRandom(list);
      inputEl.value = text;
      clearTimeout(_debounceTimer);
      generateHint(text);
    }
  });

  // 确保按钮松开时停止
  window.addEventListener('beforeunload', () => {
    stop();
  });
}

/**
 * 生成注音主流程
 */
async function generateHint(text, options) {
  const opts = options || {};
  const hintArea = document.getElementById('hint-area');
  const playBtn = document.getElementById('play-btn');

  if (!hintArea) return;

  updateStatus('处理中...');

  try {
    const mode = detectMode(text);

    if (mode === 'word') {
      // 单词模式
      const wordItem = await getWordPronunciation(text.trim());
      if (!wordItem) {
        hintArea.innerHTML = '<div class="score-error">未能识别该单词</div>';
        updatePlayButtonState(false);
        updateStatus('识别失败');
        return;
      }
      const result = processWord(wordItem, text);
      window._currentResult = result;
      renderScore(hintArea, result);

    } else {
      // 句子模式
      const words = text.trim().split(/\s+/);
      const results = words.map(w => ({ word: w, item: getWordPronunciation(w) }));

      // 过滤空结果，同步过滤words
      const validResults = results.filter(r => r.item !== null);
      if (validResults.length === 0) {
        hintArea.innerHTML = '<div class="score-error">未能识别句子中的单词</div>';
        updatePlayButtonState(false);
        updateStatus('识别失败');
        return;
      }

      const validItems = validResults.map(r => r.item);
      const validWords = validResults.map(r => r.word);

      const result = processSentence(validItems, validWords, text);
      window._currentResult = result;
      renderScore(hintArea, result);
    }

    // 存储当前文本用于播放
    window._currentText = text;
    updatePlayButtonState(true);
    updateStatus('注音完成 ✓');

    // 渲染完成后更新模式切换状态
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
      updateModeLabel(modeToggle.checked);
    }

  } catch (e) {
    console.error('Generate hint error:', e);
    hintArea.innerHTML = '<div class="score-error">处理出错: ' + e.message + '</div>';
    updatePlayButtonState(false);
    updateStatus('出错了');
  }
}

/**
 * 播放/停止切换
 */
function togglePlay() {
  const playBtn = document.getElementById('play-btn');

  if (isSpeaking()) {
    if (isPaused()) {
      togglePause();
      playBtn.textContent = '⏸ 暂停';
      updateStatus('播放中');
    } else {
      togglePause();
      playBtn.textContent = '▶ 继续';
      updateStatus('已暂停');
    }
    return;
  }

  // 开始播放
  const text = window._currentText;
  if (!text) return;

  const rateSlider = document.getElementById('rate-slider');
  const rate = rateSlider ? parseFloat(rateSlider.value) : 0.8;

  playBtn.textContent = '⏹ 停止';
  playBtn.classList.add('playing');
  updateStatus('播放中...');

  speak(text, rate, () => {
    // 播放结束
    playBtn.textContent = '▶ 播放';
    playBtn.classList.remove('playing');
    updateStatus('播放完成');
  });
}

/**
 * 更新播放按钮状态
 */
function updatePlayButtonState(enabled) {
  const playBtn = document.getElementById('play-btn');
  if (!playBtn) return;

  if (enabled) {
    playBtn.disabled = false;
    playBtn.textContent = '▶ 播放';
    playBtn.classList.remove('playing');
  } else {
    playBtn.disabled = true;
    playBtn.textContent = '▶ 播放';
    playBtn.classList.remove('playing');
  }
}

/**
 * 更新状态文字
 */
function updateStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

/**
 * 清除注音区域
 */
function clearScore() {
  const hintArea = document.getElementById('hint-area');
  if (hintArea) {
    hintArea.innerHTML = '<div class="score-empty">请输入英文单词或句子</div>';
  }
  window._currentResult = null;
  window._currentText = '';
}

/**
 * 更新模式切换标签
 */
function updateModeLabel(showPinyin) {
  const label = document.querySelector('.toggle-label');
  if (label) {
    label.textContent = showPinyin ? '拼音模式' : '汉字模式';
  }
}

// Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
