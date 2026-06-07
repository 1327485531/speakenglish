/**
 * sentence.js — 句子级注音处理
 *
 * 职责:
 *   1. 模式自动检测（单词 / 句子）
 *   2. 连读规则应用
 *   3. 功能词弱读
 *   4. 语调标记
 */

// ============================================================
// 1. 模式检测
// ============================================================

/**
 * 自动检测输入模式
 * @param {string} text - 用户输入的文本
 * @returns {'word'|'sentence'}
 */
function detectMode(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'word';
  return trimmed.includes(' ') ? 'sentence' : 'word';
}

// ============================================================
// 2. 连读规则
// ============================================================

let _linkingRules = null;

async function loadLinkingRules() {
  if (_linkingRules) return _linkingRules;
  try {
    const res = await fetch('data/linking_rules.json');
    _linkingRules = await res.json();
  } catch (e) {
    console.warn('Failed to load linking_rules.json', e);
    _linkingRules = {};
  }
  return _linkingRules;
}

/**
 * 应用连读规则到单词序列
 * 在连读对之间插入 link 标记
 */
function applyLinkingRules(wordItems, originalWords) {
  if (!_linkingRules) return wordItems;

  const result = [];
  for (let i = 0; i < wordItems.length; i++) {
    const current = JSON.parse(JSON.stringify(wordItems[i])); // 深拷贝
    result.push(current);

    if (i < wordItems.length - 1) {
      const pairKey = originalWords[i].toLowerCase() + ' ' + originalWords[i + 1].toLowerCase();
      const rule = _linkingRules[pairKey];
      if (rule) {
        // 标记连读
        current.linkingNext = true;
        result.push({ _linkMarker: true, pairKey });
      }
    }
  }

  return result;
}

// ============================================================
// 3. 弱读规则
// ============================================================

/**
 * 常见功能词的弱读形式
 * 句子模式下应用
 */
const WEAK_FORMS = {
  'a': { stress: [0] },
  'an': { stress: [0] },
  'the': { stress: [0] },
  'to': { stress: [0] },
  'for': { stress: [0] },
  'of': { stress: [0] },
  'and': { stress: [0] },
  'or': { stress: [0] },
  'but': { stress: [0] },
  'that': { stress: [0] },
  'than': { stress: [0] },
  'as': { stress: [0] },
  'at': { stress: [0] },
  'by': { stress: [0] },
  'from': { stress: [0] },
  'in': { stress: [0] },
  'on': { stress: [0] },
  'with': { stress: [0] },
  'can': { stress: [0] },
  'could': { stress: [0] },
  'will': { stress: [0] },
  'would': { stress: [0] },
  'shall': { stress: [0] },
  'should': { stress: [0] },
  'must': { stress: [0] },
  'may': { stress: [0] },
  'might': { stress: [0] },
  'some': { stress: [0] },
  'there': { stress: [0] },
  'are': { stress: [0] },
  'is': { stress: [0] },
  'was': { stress: [0] },
  'were': { stress: [0] },
  'have': { stress: [0] },
  'has': { stress: [0] },
  'had': { stress: [0] },
  'do': { stress: [0] },
  'does': { stress: [0] },
  'am': { stress: [0] },
  'be': { stress: [0] },
  'been': { stress: [0] },
  'not': { stress: [0] },
  'her': { stress: [0] },
  'him': { stress: [0] },
  'us': { stress: [0] },
  'them': { stress: [0] },
  'your': { stress: [0] },
  'my': { stress: [0] },
  'his': { stress: [0] },
  'its': { stress: [0] },
  'our': { stress: [0] },
  'their': { stress: [0] },
  'who': { stress: [0] },
  'which': { stress: [0] },
  'what': { stress: [0] },
  'when': { stress: [0] },
  'where': { stress: [0] },
  'how': { stress: [0] },
  'if': { stress: [0] },
  'so': { stress: [0] },
  'just': { stress: [0] },
};

/**
 * 对功能词应用弱读（降低重音为0）
 */
function applyWeakForms(wordItems, originalWords) {
  return wordItems.map((item, idx) => {
    if (!item || !item.items) return item;
    const wordLower = originalWords[idx] ? originalWords[idx].toLowerCase() : '';
    const weakForm = WEAK_FORMS[wordLower];
    if (weakForm && weakForm.stress) {
      const newItem = JSON.parse(JSON.stringify(item));
      newItem.items = newItem.items.map((syl, si) => {
        if (si < weakForm.stress.length) {
          return { ...syl, stress: weakForm.stress[si] || 0 };
        }
        return { ...syl, stress: 0 };
      });
      return newItem;
    }
    return item;
  });
}

// ============================================================
// 4. 语调标记
// ============================================================

/**
 * 判断句子语调类型
 * @returns {'rising'|'falling'|'flat'}
 */
function detectIntonation(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'flat';

  const lastChar = trimmed.charAt(trimmed.length - 1);

  // 问号 → 升调
  if (lastChar === '?') return 'rising';

  // 感叹号 → 降调强调
  if (lastChar === '!') return 'falling';

  // 句号 → 降调
  if (lastChar === '.') return 'falling';

  // 简单规则：Yes/No问句识别
  const lower = trimmed.toLowerCase();
  const firstWord = lower.split(' ')[0];
  const questionStarters = ['is', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had',
    'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must'];
  if (questionStarters.includes(firstWord)) return 'rising';

  // 默认降调
  return 'falling';
}

/**
 * 获取语调箭头符号
 */
function getIntonationSymbol(type) {
  switch (type) {
    case 'rising': return '↗';
    case 'falling': return '↘';
    default: return '→';
  }
}

// ============================================================
// 5. 句子处理主函数
// ============================================================

// ============================================================
// 6. 句子级中文翻译
// ============================================================

/**
 * 常用句子中文翻译映射表
 * 用户在句子模式下看到整句的中文翻译，而不是每个词单独的释义
 */
const SENTENCE_TRANSLATIONS = {
  'where is the toilet': '厕所在哪里？',
  'what is your name': '你叫什么名字？',
  'i need help': '我需要帮助。',
  'how much is this': '这个多少钱？',
  'where is the hospital': '医院在哪里？',
  'can i have some water': '能给我点水吗？',
  'thank you very much': '非常感谢。',
  'do you speak english': '你讲英语吗？',
  'i don\'t understand': '我不明白。',
  'what time is it': '几点了？',
};

/**
 * 构建句子级中文翻译
 * 优先查找预设翻译表，找不到则拼接各单词释义
 */
function buildSentenceMeaning(wordItems, originalWords) {
  // 转小写、去标点，查预设翻译
  const key = originalWords.map(w => w.replace(/[^a-zA-Z]/g, '').toLowerCase()).join(' ');
  if (SENTENCE_TRANSLATIONS[key]) return SENTENCE_TRANSLATIONS[key];

  // 后备：拼接各单词释义
  const parts = wordItems
    .map((item, idx) => {
      if (item && item.meaning) {
        // 句首单词首字母大写还原
        const word = originalWords[idx] || '';
        const isSentenceStart = idx === 0;
        return isSentenceStart
          ? item.meaning.charAt(0).toUpperCase() + item.meaning.slice(1)
          : item.meaning;
      }
      return '';
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join('') + '。' : '';
}

/**
 * 完整句子处理流程
 * @param {Array} wordItems - getWordPronunciation 结果数组
 * @param {Array} originalWords - 原始单词数组
 * @param {string} originalText - 原始输入文本
 * @returns {Object} 处理结果
 */
function processSentence(wordItems, originalWords, originalText) {
  // 1. 应用弱读
  let processed = applyWeakForms(wordItems, originalWords);

  // 2. 应用连读
  const withLinking = applyLinkingRules(processed, originalWords);

  // 3. 语调判定
  const intonationType = detectIntonation(originalText);
  const intonationSymbol = getIntonationSymbol(intonationType);

  // 4. 句子级中文翻译
  const sentenceMeaning = buildSentenceMeaning(wordItems, originalWords);

  return {
    mode: 'sentence',
    blocks: withLinking,
    intonation: intonationSymbol,
    intonationType: intonationType,
    meaning: sentenceMeaning,
  };
}

/**
 * 单词模式处理
 */
function processWord(wordItem, originalText) {
  return {
    mode: 'word',
    blocks: [wordItem],
    intonation: '',
    intonationType: 'flat',
  };
}
