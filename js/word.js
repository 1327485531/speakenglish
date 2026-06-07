/**
 * word.js — 单词级注音引擎
 *
 * 职责:
 *   1. 内置高频200词词典
 *   2. G2P后备（未收录词 → 字母到音素的规则映射）
 *   3. 音节切分
 *   4. ARPAbet音素 → 拼音 → 汉字 三级映射
 *   5. 重音检测
 */

// ============================================================
// 1. 内置高频词典（单词 → ARPAbet 音素串）
//    来源: CMU Pronouncing Dictionary 高频子集
//    支持两种格式：
//      - 字符串：纯音素串（如 'AH0'）
//      - 对象：{ phonemes: '...', spellings: ['...'] }
// ============================================================

/** 标准化词典条目：统一返回 { phonemes, spellings, meaning } */
function normalizeEntry(word) {
  const raw = BUILTIN_DICT[word];
  if (!raw) return null;
  if (typeof raw === 'string') return { phonemes: raw, spellings: null, meaning: null };
  return {
    phonemes: raw.phonemes,
    spellings: raw.spellings || null,
    meaning: raw.meaning || null,
  };
}
const BUILTIN_DICT = {
  // --- 冠词/限定词 ---
  'a':            { phonemes: 'AH0',                spellings: ['a'],                meaning: '一；一个' },
  'an':           { phonemes: 'AE1 N',              spellings: ['an'],               meaning: '一；一个（用于元音前）' },
  'the':          { phonemes: 'DH AH0',             spellings: ['the'],              meaning: '这；那' },
  'this':         { phonemes: 'DH IH1 S',           spellings: ['this'],             meaning: '这个' },
  'that':         { phonemes: 'DH AE1 T',           spellings: ['that'],             meaning: '那个' },
  'these':        { phonemes: 'DH IY1 Z',           spellings: ['these'],            meaning: '这些' },
  'those':        { phonemes: 'DH OW1 Z',           spellings: ['those'],            meaning: '那些' },
  'some':         { phonemes: 'S AH1 M',            spellings: ['some'],             meaning: '一些' },
  'any':          { phonemes: 'EH1 N IY0',          spellings: ['an','y'],           meaning: '任何' },
  'no':           { phonemes: 'N OW1',              spellings: ['no'],               meaning: '没有；不' },
  'all':          { phonemes: 'AO1 L',              spellings: ['all'],              meaning: '全部' },
  'every':        { phonemes: 'EH1 V R IY0',        spellings: ['ev','er','y'],       meaning: '每个' },
  'each':         { phonemes: 'IY1 CH',             spellings: ['each'],             meaning: '每个' },
  'both':         { phonemes: 'B OW1 TH',           spellings: ['both'],             meaning: '两者都' },
  'few':          { phonemes: 'F Y UW1',            spellings: ['few'],              meaning: '很少' },
  'more':         { phonemes: 'M AO1 R',            spellings: ['more'],             meaning: '更多' },
  'most':         { phonemes: 'M OW1 S T',          spellings: ['most'],             meaning: '大多数' },
  'other':        { phonemes: 'AH1 DH ER0',         spellings: ['oth','er'],          meaning: '其他' },
  'such':         { phonemes: 'S AH1 CH',           spellings: ['such'],             meaning: '如此' },
  'much':         { phonemes: 'M AH1 CH',           spellings: ['much'],             meaning: '很多' },
  'many':         { phonemes: 'M EH1 N IY0',        spellings: ['man','y'],           meaning: '许多' },

  // --- 功能词 ---
  'in':           { phonemes: 'IH1 N',              spellings: ['in'],               meaning: '在……里' },
  'on':           { phonemes: 'AA1 N',              spellings: ['on'],               meaning: '在……上' },
  'at':           { phonemes: 'AE1 T',              spellings: ['at'],               meaning: '在' },
  'for':          { phonemes: 'F AO1 R',            spellings: ['for'],              meaning: '为了' },
  'to':           { phonemes: 'T UW1',              spellings: ['to'],               meaning: '到；向' },
  'of':           { phonemes: 'AH1 V',              spellings: ['of'],               meaning: '……的' },
  'with':         { phonemes: 'W IH1 DH',           spellings: ['with'],             meaning: '和……一起' },
  'by':           { phonemes: 'B AY1',              spellings: ['by'],               meaning: '由；被' },
  'from':         { phonemes: 'F R AH1 M',          spellings: ['from'],             meaning: '从' },
  'up':           { phonemes: 'AH1 P',              spellings: ['up'],               meaning: '向上' },
  'about':        { phonemes: 'AH0 B AW1 T',        spellings: ['a','bout'],          meaning: '关于' },
  'into':         { phonemes: 'IH1 N T UW0',        spellings: ['in','to'],           meaning: '进入' },
  'over':         { phonemes: 'OW1 V ER0',          spellings: ['o','ver'],           meaning: '在……上方' },
  'after':        { phonemes: 'AE1 F T ER0',        spellings: ['af','ter'],          meaning: '在……之后' },
  'before':       { phonemes: 'B IH0 F AO1 R',      spellings: ['be','fore'],         meaning: '在……之前' },
  'between':      { phonemes: 'B IH0 T W IY1 N',    spellings: ['be','tween'],        meaning: '在……之间' },
  'through':      { phonemes: 'TH R UW1',           spellings: ['through'],          meaning: '通过' },
  'under':        { phonemes: 'AH1 N D ER0',        spellings: ['un','der'],          meaning: '在……下面' },
  "don't":        { phonemes: 'D OW1 N T',          spellings: ['don','t'],           meaning: '不（do not 缩写）' },
  'down':         { phonemes: 'D AW1 N',            spellings: ['down'],             meaning: '向下' },
  'out':          { phonemes: 'AW1 T',              spellings: ['out'],              meaning: '出去' },
  'off':          { phonemes: 'AO1 F',              spellings: ['off'],              meaning: '离开；关' },
  'than':         { phonemes: 'DH AE1 N',           spellings: ['than'],             meaning: '比' },
  'as':           { phonemes: 'AE1 Z',              spellings: ['as'],               meaning: '作为；像' },
  'like':         { phonemes: 'L AY1 K',            spellings: ['like'],             meaning: '喜欢；像' },
  'so':           { phonemes: 'S OW1',              spellings: ['so'],               meaning: '所以；这么' },
  'if':           { phonemes: 'IH1 F',              spellings: ['if'],               meaning: '如果' },
  'but':          { phonemes: 'B AH1 T',            spellings: ['but'],              meaning: '但是' },
  'because':      { phonemes: 'B IH0 K AO1 Z',      spellings: ['be','cause'],        meaning: '因为' },
  'and':          { phonemes: 'AE1 N D',            spellings: ['and'],              meaning: '和' },
  'or':           { phonemes: 'AO1 R',              spellings: ['or'],               meaning: '或者' },
  'when':         { phonemes: 'W EH1 N',            spellings: ['when'],             meaning: '当……时' },
  'where':        { phonemes: 'W EH1 R',            spellings: ['where'],            meaning: '哪里' },
  'how':          { phonemes: 'HH AW1',             spellings: ['how'],              meaning: '怎样' },
  'what':         { phonemes: 'W AH1 T',            spellings: ['what'],             meaning: '什么' },
  'which':        { phonemes: 'W IH1 CH',           spellings: ['which'],            meaning: '哪一个' },
  'who':          { phonemes: 'HH UW1',             spellings: ['who'],              meaning: '谁' },
  'whose':        { phonemes: 'HH UW1 Z',           spellings: ['whose'],            meaning: '谁的' },
  'why':          { phonemes: 'W AY1',              spellings: ['why'],              meaning: '为什么' },
  'while':        { phonemes: 'W AY1 L',            spellings: ['while'],            meaning: '当……的时候' },
  'whether':      { phonemes: 'W EH1 DH ER0',       spellings: ['wheth','er'],        meaning: '是否' },
  'though':       { phonemes: 'DH OW1',             spellings: ['though'],           meaning: '虽然' },
  'although':     { phonemes: 'AO L DH OW1',        spellings: ['al','though'],       meaning: '尽管' },
  'since':        { phonemes: 'S IH1 N S',          spellings: ['since'],            meaning: '自从；因为' },
  'until':        { phonemes: 'AH0 N T IH1 L',      spellings: ['un','til'],          meaning: '直到' },
  'unless':       { phonemes: 'AH0 N L EH1 S',      spellings: ['un','less'],         meaning: '除非' },

  // --- 代词 ---
  'i':            { phonemes: 'AY1',                spellings: ['i'],                meaning: '我' },
  'you':          { phonemes: 'Y UW1',              spellings: ['you'],              meaning: '你；你们' },
  'he':           { phonemes: 'HH IY1',             spellings: ['he'],               meaning: '他' },
  'she':          { phonemes: 'SH IY1',             spellings: ['she'],              meaning: '她' },
  'it':           { phonemes: 'IH1 T',              spellings: ['it'],               meaning: '它' },
  'we':           { phonemes: 'W IY1',              spellings: ['we'],               meaning: '我们' },
  'they':         { phonemes: 'DH EY1',             spellings: ['they'],             meaning: '他们' },
  'me':           { phonemes: 'M IY1',              spellings: ['me'],               meaning: '我（宾格）' },
  'him':          { phonemes: 'HH IH1 M',           spellings: ['him'],              meaning: '他（宾格）' },
  'her':          { phonemes: 'HH ER1',             spellings: ['her'],              meaning: '她（宾格）；她的' },
  'us':           { phonemes: 'AH1 S',              spellings: ['us'],               meaning: '我们（宾格）' },
  'them':         { phonemes: 'DH EH1 M',           spellings: ['them'],             meaning: '他们（宾格）' },
  'my':           { phonemes: 'M AY1',              spellings: ['my'],               meaning: '我的' },
  'your':         { phonemes: 'Y AO1 R',            spellings: ['your'],             meaning: '你的；你们的' },
  'his':          { phonemes: 'HH IH1 Z',           spellings: ['his'],              meaning: '他的' },
  'its':          { phonemes: 'IH1 T S',            spellings: ['its'],              meaning: '它的' },
  'our':          { phonemes: 'AW1 ER0',            spellings: ['our'],              meaning: '我们的' },
  'their':        { phonemes: 'DH EH1 R',           spellings: ['their'],            meaning: '他们的' },
  'mine':         { phonemes: 'M AY1 N',            spellings: ['mine'],             meaning: '我的（东西）' },
  'yours':        { phonemes: 'Y AO1 R Z',          spellings: ['yours'],            meaning: '你的；你们的（东西）' },
  'hers':         { phonemes: 'HH ER1 Z',           spellings: ['hers'],             meaning: '她的（东西）' },
  'itself':       { phonemes: 'IH0 T S EH1 L F',    spellings: ['it','self'],         meaning: '它自己' },
  'myself':       { phonemes: 'M AY0 S EH1 L F',    spellings: ['my','self'],         meaning: '我自己' },
  'yourself':     { phonemes: 'Y AO0 R S EH1 L F',  spellings: ['your','self'],       meaning: '你自己' },
  'himself':      { phonemes: 'HH IH1 M S EH0 L F', spellings: ['him','self'],        meaning: '他自己' },
  'herself':      { phonemes: 'HH ER1 S EH0 L F',   spellings: ['her','self'],        meaning: '她自己' },
  'ourselves':    { phonemes: 'AW0 R S EH1 L V Z',  spellings: ['our','selves'],      meaning: '我们自己' },
  'themselves':   { phonemes: 'DH EH0 M S EH1 L V Z', spellings: ['them','selves'],   meaning: '他们自己' },
  'someone':      { phonemes: 'S AH1 M W AH2 N',    spellings: ['some','one'],        meaning: '某人' },
  'something':    { phonemes: 'S AH1 M TH IH2 NG',  spellings: ['some','thing'],      meaning: '某事' },
  'somebody':     { phonemes: 'S AH1 M B AA2 D IY0', spellings: ['some','bod','y'],    meaning: '某人' },
  'anyone':       { phonemes: 'EH1 N IY0 W AH2 N',  spellings: ['an','y','one'],       meaning: '任何人' },
  'anything':     { phonemes: 'EH1 N IY0 TH IH2 NG', spellings: ['an','y','thing'],    meaning: '任何事' },
  'nothing':      { phonemes: 'N AH1 TH IH0 NG',    spellings: ['noth','ing'],         meaning: '没有什么' },
  'everything':   { phonemes: 'EH1 V R IY0 TH IH2 NG', spellings: ['ev','er','y','thing'], meaning: '一切' },
  'nobody':       { phonemes: 'N OW1 B AA2 D IY0',  spellings: ['no','bod','y'],       meaning: '没有人' },
  'everyone':     { phonemes: 'EH1 V R IY0 W AH2 N', spellings: ['ev','er','y','one'], meaning: '每个人' },

  // --- 系词/助动词 ---
  'is':           { phonemes: 'IH1 Z',              spellings: ['is'],               meaning: '是' },
  'are':          { phonemes: 'AA1 R',              spellings: ['are'],              meaning: '是' },
  'was':          { phonemes: 'W AA1 Z',            spellings: ['was'],              meaning: '是（过去式）' },
  'were':         { phonemes: 'W ER1',              spellings: ['were'],             meaning: '是（过去式）' },
  'be':           { phonemes: 'B IY1',              spellings: ['be'],               meaning: '是；成为' },
  'been':         { phonemes: 'B IH1 N',            spellings: ['been'],             meaning: '是（过去分词）' },
  'being':        { phonemes: 'B IY1 IH0 NG',       spellings: ['be','ing'],          meaning: '存在；正被' },
  'am':           { phonemes: 'AE1 M',              spellings: ['am'],               meaning: '是（与 I 连用）' },
  'do':           { phonemes: 'D UW1',              spellings: ['do'],               meaning: '做' },
  'does':         { phonemes: 'D AH1 Z',            spellings: ['does'],             meaning: '做（第三人称单数）' },
  'did':          { phonemes: 'D IH1 D',            spellings: ['did'],              meaning: '做（过去式）' },
  'done':         { phonemes: 'D AH1 N',            spellings: ['done'],             meaning: '做完' },
  'doing':        { phonemes: 'D UW1 IH0 NG',       spellings: ['do','ing'],          meaning: '正在做' },
  'have':         { phonemes: 'HH AE1 V',           spellings: ['have'],             meaning: '有' },
  'has':          { phonemes: 'HH AE1 Z',           spellings: ['has'],              meaning: '有（第三人称单数）' },
  'had':          { phonemes: 'HH AE1 D',           spellings: ['had'],              meaning: '有（过去式）' },
  'having':       { phonemes: 'HH AE1 V IH0 NG',    spellings: ['hav','ing'],         meaning: '有（进行时）' },
  'can':          { phonemes: 'K AE1 N',            spellings: ['can'],              meaning: '能' },
  'could':        { phonemes: 'K UH1 D',            spellings: ['could'],            meaning: '能（过去式）' },
  'will':         { phonemes: 'W IH1 L',            spellings: ['will'],             meaning: '将要' },
  'would':        { phonemes: 'W UH1 D',            spellings: ['would'],            meaning: '将会（过去式）' },
  'shall':        { phonemes: 'SH AE1 L',           spellings: ['shall'],            meaning: '将要（用于第一人称）' },
  'should':       { phonemes: 'SH UH1 D',           spellings: ['should'],           meaning: '应该' },
  'may':          { phonemes: 'M EY1',              spellings: ['may'],              meaning: '可能；可以' },
  'might':        { phonemes: 'M AY1 T',            spellings: ['might'],            meaning: '可能（过去式）' },
  'must':         { phonemes: 'M AH1 S T',          spellings: ['must'],             meaning: '必须' },
  'need':         { phonemes: 'N IY1 D',            spellings: ['need'],             meaning: '需要' },
  'dare':         { phonemes: 'D EH1 R',            spellings: ['dare'],             meaning: '敢' },
  'ought':        { phonemes: 'AO1 T',              spellings: ['ought'],            meaning: '应该' },
  'used':         { phonemes: 'Y UW1 Z D',          spellings: ['used'],             meaning: '习惯的（used to）' },

  // --- 否定 ---
  'not':          { phonemes: 'N AA1 T',            spellings: ['not'],              meaning: '不' },
  "doesn't":      { phonemes: 'D AH1 Z AH0 N T',    spellings: ['does','n\'t'],       meaning: '不（does not 缩写）' },
  "didn't":       { phonemes: 'D IH1 D AH0 N T',    spellings: ['did','n\'t'],        meaning: '没有（did not 缩写）' },
  "can't":        { phonemes: 'K AE1 N T',          spellings: ['can\'t'],           meaning: '不能' },
  "couldn't":     { phonemes: 'K UH1 D AH0 N T',    spellings: ['could','n\'t'],      meaning: '不能（过去式）' },
  "won't":        { phonemes: 'W OW1 N T',          spellings: ['won\'t'],           meaning: '将不会' },
  "wouldn't":     { phonemes: 'W UH1 D AH0 N T',    spellings: ['would','n\'t'],      meaning: '不会（过去式）' },
  "shouldn't":    { phonemes: 'SH UH1 D AH0 N T',   spellings: ['should','n\'t'],     meaning: '不应该' },
  "mustn't":      { phonemes: 'M AH1 S AH0 N T',    spellings: ['must','n\'t'],       meaning: '禁止' },
  "isn't":        { phonemes: 'IH1 Z AH0 N T',      spellings: ['is','n\'t'],         meaning: '不是' },
  "aren't":       { phonemes: 'AA1 R N T',          spellings: ['are','n\'t'],        meaning: '不是（are not 缩写）' },
  "wasn't":       { phonemes: 'W AA1 Z AH0 N T',    spellings: ['was','n\'t'],        meaning: '不是（过去式）' },
  "weren't":      { phonemes: 'W ER1 N T',          spellings: ['were','n\'t'],       meaning: '不是（过去式）' },
  "haven't":      { phonemes: 'HH AE1 V AH0 N T',   spellings: ['have','n\'t'],       meaning: '没有（have not 缩写）' },
  "hasn't":       { phonemes: 'HH AE1 Z AH0 N T',   spellings: ['has','n\'t'],        meaning: '没有（has not 缩写）' },
  "hadn't":       { phonemes: 'HH AE1 D AH0 N T',   spellings: ['had','n\'t'],        meaning: '没有（过去完成）' },
  "needn't":      { phonemes: 'N IY1 D AH0 N T',    spellings: ['need','n\'t'],       meaning: '不必' },

  // --- 高频实词 ---
  'go':           { phonemes: 'G OW1',              spellings: ['go'],               meaning: '去' },
  'get':          { phonemes: 'G EH1 T',            spellings: ['get'],              meaning: '得到' },
  'make':         { phonemes: 'M EY1 K',            spellings: ['make'],             meaning: '制造' },
  'take':         { phonemes: 'T EY1 K',            spellings: ['take'],             meaning: '拿走' },
  'come':         { phonemes: 'K AH1 M',            spellings: ['come'],             meaning: '来' },
  'see':          { phonemes: 'S IY1',              spellings: ['see'],              meaning: '看见' },
  'know':         { phonemes: 'N OW1',              spellings: ['know'],             meaning: '知道' },
  'look':         { phonemes: 'L UH1 K',            spellings: ['look'],             meaning: '看' },
  'give':         { phonemes: 'G IH1 V',            spellings: ['give'],             meaning: '给' },
  'find':         { phonemes: 'F AY1 N D',          spellings: ['find'],             meaning: '找到' },
  'think':        { phonemes: 'TH IH1 NG K',        spellings: ['think'],            meaning: '思考' },
  'tell':         { phonemes: 'T EH1 L',            spellings: ['tell'],             meaning: '告诉' },
  'ask':          { phonemes: 'AE1 S K',            spellings: ['ask'],              meaning: '问' },
  'work':         { phonemes: 'W ER1 K',            spellings: ['work'],             meaning: '工作' },
  'seem':         { phonemes: 'S IY1 M',            spellings: ['seem'],             meaning: '似乎' },
  'feel':         { phonemes: 'F IY1 L',            spellings: ['feel'],             meaning: '感觉' },
  'try':          { phonemes: 'T R AY1',            spellings: ['try'],              meaning: '尝试' },
  'leave':        { phonemes: 'L IY1 V',            spellings: ['leave'],            meaning: '离开' },
  'call':         { phonemes: 'K AO1 L',            spellings: ['call'],             meaning: '打电话' },
  'keep':         { phonemes: 'K IY1 P',            spellings: ['keep'],             meaning: '保持' },
  'let':          { phonemes: 'L EH1 T',            spellings: ['let'],              meaning: '让' },
  'begin':        { phonemes: 'B IY0 G IH1 N',      spellings: ['be','gin'],          meaning: '开始' },
  'show':         { phonemes: 'SH OW1',             spellings: ['show'],             meaning: '展示' },
  'hear':         { phonemes: 'HH IY1 R',           spellings: ['hear'],             meaning: '听见' },
  'play':         { phonemes: 'P L EY1',            spellings: ['play'],             meaning: '玩' },
  'run':          { phonemes: 'R AH1 N',            spellings: ['run'],              meaning: '跑' },
  'move':         { phonemes: 'M UW1 V',            spellings: ['move'],             meaning: '移动' },
  'live':         { phonemes: 'L IH1 V',            spellings: ['live'],             meaning: '居住；生活' },
  'believe':      { phonemes: 'B IH0 L IY1 V',      spellings: ['be','lieve'],        meaning: '相信' },
  'bring':        { phonemes: 'B R IH1 NG',         spellings: ['bring'],            meaning: '带来' },
  'happen':       { phonemes: 'HH AE1 P AH0 N',     spellings: ['hap','pen'],         meaning: '发生' },
  'write':        { phonemes: 'R AY1 T',            spellings: ['write'],            meaning: '写' },
  'provide':      { phonemes: 'P R AH0 V AY1 D',    spellings: ['pro','vide'],        meaning: '提供' },
  'sit':          { phonemes: 'S IH1 T',            spellings: ['sit'],              meaning: '坐' },
  'stand':        { phonemes: 'S T AE1 N D',        spellings: ['stand'],            meaning: '站' },
  'lose':         { phonemes: 'L UW1 Z',            spellings: ['lose'],             meaning: '失去' },
  'pay':          { phonemes: 'P EY1',              spellings: ['pay'],              meaning: '付款' },
  'meet':         { phonemes: 'M IY1 T',            spellings: ['meet'],             meaning: '遇见' },
  'include':      { phonemes: 'IH0 N K L UW1 D',    spellings: ['in','clude'],        meaning: '包括' },
  'continue':     { phonemes: 'K AH0 N T IH1 N Y UW0', spellings: ['con','tin','ue'], meaning: '继续' },
  'set':          { phonemes: 'S EH1 T',            spellings: ['set'],              meaning: '设置' },
  'learn':        { phonemes: 'L ER1 N',            spellings: ['learn'],            meaning: '学习' },
  'change':       { phonemes: 'CH EY1 N JH',        spellings: ['change'],           meaning: '改变' },
  'lead':         { phonemes: 'L IY1 D',            spellings: ['lead'],             meaning: '领导' },
  'understand':   { phonemes: 'AH2 N D ER0 S T AE1 N D', spellings: ['un','der','stand'], meaning: '理解' },
  'watch':        { phonemes: 'W AA1 CH',           spellings: ['watch'],            meaning: '观看' },
  'follow':       { phonemes: 'F AA1 L OW0',        spellings: ['fol','low'],         meaning: '跟随' },
  'stop':         { phonemes: 'S T AA1 P',          spellings: ['stop'],             meaning: '停止' },
  'create':       { phonemes: 'K R IY0 EY1 T',      spellings: ['cre','ate'],         meaning: '创造' },
  'speak':        { phonemes: 'S P IY1 K',          spellings: ['speak'],            meaning: '说话' },
  'read':         { phonemes: 'R IY1 D',            spellings: ['read'],             meaning: '阅读' },
  'allow':        { phonemes: 'AH0 L AW1',          spellings: ['al','low'],          meaning: '允许' },
  'add':          { phonemes: 'AE1 D',              spellings: ['add'],              meaning: '增加' },
  'spend':        { phonemes: 'S P EH1 N D',        spellings: ['spend'],            meaning: '花费' },
  'grow':         { phonemes: 'G R OW1',            spellings: ['grow'],             meaning: '生长' },
  'open':         { phonemes: 'OW1 P AH0 N',        spellings: ['o','pen'],           meaning: '打开' },
  'walk':         { phonemes: 'W AO1 K',            spellings: ['walk'],             meaning: '走路' },
  'win':          { phonemes: 'W IH1 N',            spellings: ['win'],              meaning: '赢' },
  'teach':        { phonemes: 'T IY1 CH',           spellings: ['teach'],            meaning: '教' },
  'offer':        { phonemes: 'AO1 F ER0',          spellings: ['of','fer'],          meaning: '提供' },
  'remember':     { phonemes: 'R IH0 M EH1 M B ER0', spellings: ['re','mem','ber'],   meaning: '记得' },
  'love':         { phonemes: 'L AH1 V',            spellings: ['love'],             meaning: '爱' },
  'consider':     { phonemes: 'K AH0 N S IH1 D ER0', spellings: ['con','sid','er'],   meaning: '考虑' },
  'appear':       { phonemes: 'AH0 P IY1 R',        spellings: ['ap','pear'],         meaning: '出现' },
  'buy':          { phonemes: 'B AY1',              spellings: ['buy'],              meaning: '买' },
  'wait':         { phonemes: 'W EY1 T',            spellings: ['wait'],             meaning: '等待' },
  'serve':        { phonemes: 'S ER1 V',            spellings: ['serve'],            meaning: '服务' },
  'die':          { phonemes: 'D AY1',              spellings: ['die'],              meaning: '死' },
  'send':         { phonemes: 'S EH1 N D',          spellings: ['send'],             meaning: '发送' },
  'expect':       { phonemes: 'IH0 K S P EH1 K T',  spellings: ['ex','pect'],         meaning: '期望' },
  'build':        { phonemes: 'B IH1 L D',          spellings: ['build'],            meaning: '建造' },
  'stay':         { phonemes: 'S T EY1',            spellings: ['stay'],             meaning: '停留' },
  'fall':         { phonemes: 'F AO1 L',            spellings: ['fall'],             meaning: '掉落' },
  'cut':          { phonemes: 'K AH1 T',            spellings: ['cut'],              meaning: '切' },
  'reach':        { phonemes: 'R IY1 CH',           spellings: ['reach'],            meaning: '到达' },
  'kill':         { phonemes: 'K IH1 L',            spellings: ['kill'],             meaning: '杀' },
  'raise':        { phonemes: 'R EY1 Z',            spellings: ['raise'],            meaning: '举起；抚养' },
  'pass':         { phonemes: 'P AE1 S',            spellings: ['pass'],             meaning: '通过' },
  'sell':         { phonemes: 'S EH1 L',            spellings: ['sell'],             meaning: '卖' },
  'require':      { phonemes: 'R IH0 K W AY1 ER0',  spellings: ['re','quire'],        meaning: '需要' },
  'report':       { phonemes: 'R IH0 P AO1 R T',    spellings: ['re','port'],         meaning: '报告' },
  'decide':       { phonemes: 'D IH0 S AY1 D',      spellings: ['de','cide'],         meaning: '决定' },
  'pull':         { phonemes: 'P UH1 L',            spellings: ['pull'],             meaning: '拉' },
  'develop':      { phonemes: 'D IH0 V EH1 L AH0 P', spellings: ['de','vel','op'],    meaning: '发展' },
  'carry':        { phonemes: 'K AE1 R IY0',        spellings: ['car','ry'],          meaning: '携带' },
  'break':        { phonemes: 'B R EY1 K',          spellings: ['break'],            meaning: '打破' },
  'receive':      { phonemes: 'R IH0 S IY1 V',      spellings: ['re','ceive'],        meaning: '收到' },
  'agree':        { phonemes: 'AH0 G R IY1',        spellings: ['a','gree'],          meaning: '同意' },
  'support':      { phonemes: 'S AH0 P AO1 R T',    spellings: ['sup','port'],        meaning: '支持' },
  'explain':      { phonemes: 'IH0 K S P L EY1 N',  spellings: ['ex','plain'],        meaning: '解释' },

  // --- 常见时态/语调词 ---
  'yes':          { phonemes: 'Y EH1 S',            spellings: ['yes'],              meaning: '是' },
  'okay':         { phonemes: 'OW0 K EY1',          spellings: ['o','kay'],           meaning: '好的' },
  'please':       { phonemes: 'P L IY1 Z',          spellings: ['please'],           meaning: '请' },
  'sorry':        { phonemes: 'S AA1 R IY0',        spellings: ['sor','ry'],          meaning: '对不起' },
  'thank':        { phonemes: 'TH AE1 NG K',        spellings: ['thank'],            meaning: '感谢' },
  'hello':        { phonemes: 'HH EH0 L OW1',       spellings: ['hel','lo'],          meaning: '你好' },
  'goodbye':      { phonemes: 'G UH0 D B AY1',      spellings: ['good','bye'],        meaning: '再见' },
  'thanks':       { phonemes: 'TH AE1 NG K S',      spellings: ['thanks'],           meaning: '谢谢' },
  'welcome':      { phonemes: 'W EH1 L K AH0 M',    spellings: ['wel','come'],        meaning: '欢迎' },
  'excuse':       { phonemes: 'IH0 K S K Y UW1 S',  spellings: ['ex','cuse'],         meaning: '原谅' },
  'help':         { phonemes: 'HH EH1 L P',         spellings: ['help'],             meaning: '帮助' },
  'want':         { phonemes: 'W AA1 N T',          spellings: ['want'],             meaning: '想要' },
  'mean':         { phonemes: 'M IY1 N',            spellings: ['mean'],             meaning: '意思是' },
  'sure':         { phonemes: 'SH UH1 R',           spellings: ['sure'],             meaning: '确定' },
  'right':        { phonemes: 'R AY1 T',            spellings: ['right'],            meaning: '正确的；右边' },
  'wrong':        { phonemes: 'R AO1 NG',           spellings: ['wrong'],            meaning: '错误的' },
  'good':         { phonemes: 'G UH1 D',            spellings: ['good'],             meaning: '好的' },
  'bad':          { phonemes: 'B AE1 D',            spellings: ['bad'],              meaning: '坏的' },
  'big':          { phonemes: 'B IH1 G',            spellings: ['big'],              meaning: '大的' },
  'small':        { phonemes: 'S M AO1 L',          spellings: ['small'],            meaning: '小的' },
  'new':          { phonemes: 'N UW1',              spellings: ['new'],              meaning: '新的' },
  'old':          { phonemes: 'OW1 L D',            spellings: ['old'],              meaning: '老的；旧的' },
  'first':        { phonemes: 'F ER1 S T',          spellings: ['first'],            meaning: '第一' },
  'last':         { phonemes: 'L AE1 S T',          spellings: ['last'],             meaning: '最后的' },
  'next':         { phonemes: 'N EH1 K S T',        spellings: ['next'],             meaning: '下一个' },
  'same':         { phonemes: 'S EY1 M',            spellings: ['same'],             meaning: '相同的' },
  'different':    { phonemes: 'D IH1 F ER0 AH0 N T', spellings: ['dif','fer','ent'],  meaning: '不同的' },
  'long':         { phonemes: 'L AO1 NG',           spellings: ['long'],             meaning: '长的' },
  'short':        { phonemes: 'SH AO1 R T',         spellings: ['short'],            meaning: '短的' },
  'high':         { phonemes: 'HH AY1',             spellings: ['high'],             meaning: '高的' },
  'low':          { phonemes: 'L OW1',              spellings: ['low'],              meaning: '低的' },
  'fast':         { phonemes: 'F AE1 S T',          spellings: ['fast'],             meaning: '快的' },
  'slow':         { phonemes: 'S L OW1',            spellings: ['slow'],             meaning: '慢的' },
  'early':        { phonemes: 'ER1 L IY0',          spellings: ['ear','ly'],          meaning: '早的' },
  'late':         { phonemes: 'L EY1 T',            spellings: ['late'],             meaning: '晚的' },
  'easy':         { phonemes: 'IY1 Z IY0',          spellings: ['eas','y'],           meaning: '容易的' },
  'hard':         { phonemes: 'HH AA1 R D',         spellings: ['hard'],             meaning: '困难的；硬的' },
  'better':       { phonemes: 'B EH1 T ER0',        spellings: ['bet','ter'],         meaning: '更好的' },
  'best':         { phonemes: 'B EH1 S T',          spellings: ['best'],             meaning: '最好的' },
  'less':         { phonemes: 'L EH1 S',            spellings: ['less'],             meaning: '更少的' },
  'very':         { phonemes: 'V EH1 R IY0',        spellings: ['ver','y'],           meaning: '非常' },
  'too':          { phonemes: 'T UW1',              spellings: ['too'],              meaning: '太；也' },
  'also':         { phonemes: 'AO1 L S OW0',        spellings: ['al','so'],           meaning: '也' },
  'always':       { phonemes: 'AO1 L W EY2 Z',      spellings: ['al','ways'],         meaning: '总是' },
  'never':        { phonemes: 'N EH1 V ER0',        spellings: ['nev','er'],          meaning: '从不' },
  'often':        { phonemes: 'AO1 F AH0 N',        spellings: ['of','ten'],          meaning: '经常' },
  'usually':      { phonemes: 'Y UW1 ZH UW0 AH0 L IY0', spellings: ['u','su','al','ly'], meaning: '通常' },
  'maybe':        { phonemes: 'M EY1 B IY0',        spellings: ['may','be'],          meaning: '也许' },
  'almost':       { phonemes: 'AO1 L M OW0 S T',    spellings: ['al','most'],         meaning: '几乎' },
  'enough':       { phonemes: 'IH0 N AH1 F',        spellings: ['e','nough'],         meaning: '足够的' },
  'still':        { phonemes: 'S T IH1 L',          spellings: ['still'],            meaning: '仍然' },
  'just':         { phonemes: 'JH AH1 S T',         spellings: ['just'],             meaning: '刚刚；只是' },
  'only':         { phonemes: 'OW1 N L IY0',        spellings: ['on','ly'],           meaning: '唯一的；只有' },
  'really':       { phonemes: 'R IY1 L IY0',        spellings: ['re','al','ly'],       meaning: '真正地' },
  'now':          { phonemes: 'N AW1',              spellings: ['now'],              meaning: '现在' },
  'here':         { phonemes: 'HH IY1 R',           spellings: ['here'],             meaning: '这里' },
  'there':        { phonemes: 'DH EH1 R',           spellings: ['there'],            meaning: '那里' },
  'well':         { phonemes: 'W EH1 L',            spellings: ['well'],             meaning: '好地' },
  'then':         { phonemes: 'DH EH1 N',           spellings: ['then'],             meaning: '然后' },
  'again':        { phonemes: 'AH0 G EH1 N',        spellings: ['a','gain'],          meaning: '再次' },
  'even':         { phonemes: 'IY1 V AH0 N',        spellings: ['e','ven'],           meaning: '甚至' },
  'ever':         { phonemes: 'EH1 V ER0',          spellings: ['ev','er'],           meaning: '曾经' },
  'away':         { phonemes: 'AH0 W EY1',          spellings: ['a','way'],           meaning: '离开' },
  'today':        { phonemes: 'T AH0 D EY1',        spellings: ['to','day'],          meaning: '今天' },
  'tomorrow':     { phonemes: 'T AH0 M AA1 R OW0',  spellings: ['to','mor','row'],    meaning: '明天' },
  'yesterday':    { phonemes: 'Y EH1 S T ER0 D EY0', spellings: ['yes','ter','day'],   meaning: '昨天' },
  'sometimes':    { phonemes: 'S AH1 M T AY2 M Z',  spellings: ['some','times'],      meaning: '有时候' },

  // --- 数词 ---
  'one':          { phonemes: 'W AH1 N',            spellings: ['one'],              meaning: '一' },
  'two':          { phonemes: 'T UW1',              spellings: ['two'],              meaning: '二' },
  'three':        { phonemes: 'TH R IY1',           spellings: ['three'],            meaning: '三' },
  'four':         { phonemes: 'F AO1 R',            spellings: ['four'],             meaning: '四' },
  'five':         { phonemes: 'F AY1 V',            spellings: ['five'],             meaning: '五' },
  'six':          { phonemes: 'S IH1 K S',          spellings: ['six'],              meaning: '六' },
  'seven':        { phonemes: 'S EH1 V AH0 N',      spellings: ['sev','en'],          meaning: '七' },
  'eight':        { phonemes: 'EY1 T',              spellings: ['eight'],            meaning: '八' },
  'nine':         { phonemes: 'N AY1 N',            spellings: ['nine'],             meaning: '九' },
  'ten':          { phonemes: 'T EH1 N',            spellings: ['ten'],              meaning: '十' },
  'hundred':      { phonemes: 'HH AH1 N D R AH0 D', spellings: ['hun','dred'],        meaning: '百' },
  'thousand':     { phonemes: 'TH AW1 Z AH0 N D',   spellings: ['thou','sand'],       meaning: '千' },
  'second':       { phonemes: 'S EH1 K AH0 N D',    spellings: ['sec','ond'],         meaning: '第二；秒' },
  'third':        { phonemes: 'TH ER1 D',           spellings: ['third'],            meaning: '第三' },
  'time':         { phonemes: 'T AY1 M',            spellings: ['time'],             meaning: '时间' },
  'year':         { phonemes: 'Y IY1 R',            spellings: ['year'],             meaning: '年' },
  'day':          { phonemes: 'D EY1',              spellings: ['day'],              meaning: '天' },
  'week':         { phonemes: 'W IY1 K',            spellings: ['week'],             meaning: '周' },
  'month':        { phonemes: 'M AH1 N TH',         spellings: ['month'],            meaning: '月' },
  'hour':         { phonemes: 'AW1 ER0',            spellings: ['hour'],             meaning: '小时' },
  'minute':       { phonemes: 'M IH1 N IH0 T',      spellings: ['min','ute'],         meaning: '分钟' },
  'moment':       { phonemes: 'M OW1 M AH0 N T',    spellings: ['mo','ment'],         meaning: '时刻' },
  'morning':      { phonemes: 'M AO1 R N IH0 NG',   spellings: ['morn','ing'],        meaning: '早晨' },
  'afternoon':    { phonemes: 'AE2 F T ER0 N UW1 N', spellings: ['af','ter','noon'],  meaning: '下午' },
  'evening':      { phonemes: 'IY1 V N IH0 NG',     spellings: ['eve','ning'],        meaning: '晚上' },
  'night':        { phonemes: 'N AY1 T',            spellings: ['night'],            meaning: '夜晚' },
  'weekend':      { phonemes: 'W IY1 K EH2 N D',    spellings: ['week','end'],        meaning: '周末' },
  'ago':          { phonemes: 'AH0 G OW1',          spellings: ['a','go'],            meaning: '以前' },
  'later':        { phonemes: 'L EY1 T ER0',        spellings: ['lat','er'],          meaning: '稍后' },
  'soon':         { phonemes: 'S UW1 N',            spellings: ['soon'],             meaning: '不久' },
  'already':      { phonemes: 'AO0 L R EH1 D IY0',  spellings: ['al','read','y'],      meaning: '已经' },
  'finally':      { phonemes: 'F AY1 N AH0 L IY0',  spellings: ['fi','nal','ly'],      meaning: '最后' },
  'yet':          { phonemes: 'Y EH1 T',            spellings: ['yet'],              meaning: '还；然而' },
  'name':         { phonemes: 'N EY1 M',            spellings: ['name'],             meaning: '名字' },
  'floor':        { phonemes: 'F L AO1 R',          spellings: ['floor'],            meaning: '地板' },
  'hook':         { phonemes: 'HH UH1 K',           spellings: ['hook'],             meaning: '钩子' },
  'wood':         { phonemes: 'W UW1 D',            spellings: ['wood'],             meaning: '木头' },
  'peace':        { phonemes: 'P IY1 S',            spellings: ['peace'],            meaning: '和平' },
  'stupid':       { phonemes: 'S T UW1 P IH0 D',    spellings: ['stu','pid'],         meaning: '愚蠢的' },
  'piece':        { phonemes: 'P IY1 S',            spellings: ['piece'],            meaning: '片；块' },
  'rape':         { phonemes: 'R EY1 P',            spellings: ['rape'],             meaning: '强奸' },
  'dude':         { phonemes: 'D UW1 D',            spellings: ['dude'],             meaning: '哥们' },
  'rude':         { phonemes: 'R UW1 D',            spellings: ['rude'],             meaning: '粗鲁的' },

  // --- 特殊发音 ---
  'oh':           { phonemes: 'OW1',                spellings: ['oh'],               meaning: '哦' },
  'uh':           { phonemes: 'AH1',                spellings: ['uh'],               meaning: '呃' },
  'um':           { phonemes: 'AH1 M',              spellings: ['um'],               meaning: '嗯' },
  'hmm':          { phonemes: 'HH M',               spellings: ['hmm'],              meaning: '嗯（思考）' },
  'ah':           { phonemes: 'AA1',                spellings: ['ah'],               meaning: '啊' },
  'wow':          { phonemes: 'W AW1',              spellings: ['wow'],              meaning: '哇' },
  'hey':          { phonemes: 'HH EY1',             spellings: ['hey'],              meaning: '嘿' },
  'hi':           { phonemes: 'HH AY1',             spellings: ['hi'],               meaning: '嗨' },
  'ok':           { phonemes: 'OW0 K EY1',          spellings: ['o','k'],             meaning: '好' },
  'america':     { phonemes: 'AH0 M EH1 R IH0 K AH0', spellings: ['a','mer','i','ca'],   meaning: '美国' },
  // --- 实用场景词 ---
  'toilet':       { phonemes: 'T OY1 L AH0 T',      spellings: ['toi','let'],         meaning: '厕所' },
  'restaurant':   { phonemes: 'R EH1 S T ER0 AA2 N T', spellings: ['res','tau','rant'], meaning: '餐厅' },
  'hospital':     { phonemes: 'HH AA1 S P IH0 T AH0 L', spellings: ['hos','pi','tal'], meaning: '医院' },
  'police':       { phonemes: 'P AH0 L IY1 S',      spellings: ['po','lice'],         meaning: '警察' },
  'station':      { phonemes: 'S T EY1 SH AH0 N',   spellings: ['sta','tion'],        meaning: '车站；站' },
  'airport':      { phonemes: 'EH1 R P AO2 R T',    spellings: ['air','port'],        meaning: '机场' },
  'hotel':        { phonemes: 'HH OW0 T EH1 L',     spellings: ['ho','tel'],          meaning: '酒店' },
  'supermarket':  { phonemes: 'S UW1 P ER0 M AA2 R K IH0 T', spellings: ['su','per','mar','ket'], meaning: '超市' },
  'pharmacy':     { phonemes: 'F AA1 R M AH0 S IY0', spellings: ['phar','ma','cy'],    meaning: '药店' },
  'bank':         { phonemes: 'B AE1 NG K',         spellings: ['bank'],             meaning: '银行' },
  'school':       { phonemes: 'S K UW1 L',          spellings: ['school'],           meaning: '学校' },
  'university':   { phonemes: 'Y UW2 N AH0 V ER1 S IH0 T IY0', spellings: ['u','ni','ver','si','ty'], meaning: '大学' },
  'office':       { phonemes: 'AO1 F IH0 S',        spellings: ['of','fice'],         meaning: '办公室' },
  'factory':      { phonemes: 'F AE1 K T ER0 IY0',  spellings: ['fac','to','ry'],      meaning: '工厂' },
  'kitchen':      { phonemes: 'K IH1 CH AH0 N',     spellings: ['kitch','en'],        meaning: '厨房' },
  'bedroom':      { phonemes: 'B EH1 D R UW2 M',    spellings: ['bed','room'],        meaning: '卧室' },
  'bathroom':     { phonemes: 'B AE1 TH R UW2 M',   spellings: ['bath','room'],       meaning: '浴室' },
  'telephone':    { phonemes: 'T EH1 L AH0 F OW2 N', spellings: ['tel','e','phone'],   meaning: '电话' },
  'internet':     { phonemes: 'IH1 N T ER0 N EH2 T', spellings: ['in','ter','net'],    meaning: '互联网' },
  'computer':     { phonemes: 'K AH0 M P Y UW1 T ER0', spellings: ['com','put','er'], meaning: '电脑' },
  'television':   { phonemes: 'T EH1 L AH0 V IH2 ZH AH0 N', spellings: ['tel','e','vi','sion'], meaning: '电视' },
  'television2':  { phonemes: 'T EH2 L AH0 V IH1 ZH AH0 N', spellings: ['tel','e','vi','sion'], meaning: '电视（重音变体）' },
  'beautiful':    { phonemes: 'B Y UW1 T IH0 F AH0 L', spellings: ['beau','ti','ful'], meaning: '美丽的' },
  'wonderful':    { phonemes: 'W AH1 N D ER0 F AH0 L', spellings: ['won','der','ful'], meaning: '精彩的' },
  'terrible':     { phonemes: 'T EH1 R AH0 B AH0 L', spellings: ['ter','ri','ble'],    meaning: '可怕的' },
  'horrible':     { phonemes: 'HH AO1 R AH0 B AH0 L', spellings: ['hor','ri','ble'],   meaning: '可怕的' },
  'possible':     { phonemes: 'P AA1 S AH0 B AH0 L', spellings: ['pos','si','ble'],    meaning: '可能的' },
  'comfortable':  { phonemes: 'K AH1 M F ER0 T AH0 B AH0 L', spellings: ['com','fort','a','ble'], meaning: '舒适的' },
  'favorite':     { phonemes: 'F EY1 V ER0 IH0 T',  spellings: ['fa','vor','ite'],     meaning: '最喜欢的' },
  'delicious':    { phonemes: 'D IH0 L IH1 SH AH0 S', spellings: ['de','li','cious'],  meaning: '美味的' },
  'dangerous':    { phonemes: 'D EY1 N JH ER0 AH0 S', spellings: ['dan','ger','ous'],  meaning: '危险的' },
  'important':    { phonemes: 'IH0 M P AO1 R T AH0 N T', spellings: ['im','por','tant'], meaning: '重要的' },
  'interesting':  { phonemes: 'IH1 N T ER0 AH0 S T IH0 NG', spellings: ['in','ter','est','ing'], meaning: '有趣的' },
  'emergency':    { phonemes: 'IH0 M ER1 JH AH0 N S IY0', spellings: ['e','mer','gen','cy'], meaning: '紧急情况' },
  'customer':     { phonemes: 'K AH1 S T AH0 M ER0', spellings: ['cus','tom','er'],    meaning: '顾客' },
  'manager':      { phonemes: 'M AE1 N AH0 JH ER0', spellings: ['man','ag','er'],      meaning: '经理' },
  'doctor':       { phonemes: 'D AA1 K T ER0',      spellings: ['doc','tor'],         meaning: '医生' },
  'nurse':        { phonemes: 'N ER1 S',            spellings: ['nurse'],            meaning: '护士' },
  'teacher':      { phonemes: 'T IY1 CH ER0',       spellings: ['teach','er'],        meaning: '老师' },
  'driver':       { phonemes: 'D R AY1 V ER0',      spellings: ['driv','er'],         meaning: '司机' },
  ' waiter':      { phonemes: 'W EY1 T ER0',        spellings: ['wait','er'],         meaning: '服务员' }, // 注意键名前有一个空格，保留原样
  'water':        { phonemes: 'W AO1 T ER0',        spellings: ['wa','ter'],          meaning: '水' },
  'weather':      { phonemes: 'W EH1 DH ER0',       spellings: ['weath','er'],        meaning: '天气' },
  'family':       { phonemes: 'F AE1 M AH0 L IY0',  spellings: ['fam','i','ly'],       meaning: '家庭' },
  'friend':       { phonemes: 'F R EH1 N D',        spellings: ['friend'],           meaning: '朋友' },
  'people':       { phonemes: 'P IY1 P AH0 L',      spellings: ['peo','ple'],         meaning: '人们' },
  'children':     { phonemes: 'CH IH1 L D R AH0 N', spellings: ['chil','dren'],       meaning: '孩子们' },
  'problem':      { phonemes: 'P R AA1 B L AH0 M',  spellings: ['prob','lem'],        meaning: '问题' },
  'question':     { phonemes: 'K W EH1 S T CH AH0 N', spellings: ['ques','tion'],     meaning: '问题' },
  'answer':       { phonemes: 'AE1 N S ER0',        spellings: ['an','swer'],         meaning: '答案' },
  'example':      { phonemes: 'IH0 G Z AE1 M P AH0 L', spellings: ['ex','am','ple'],  meaning: '例子' },
  'english':      { phonemes: 'IH1 NG G L IH0 SH',  spellings: ['Eng','lish'],        meaning: '英语' },
  'chinese':      { phonemes: 'CH AY1 N IY0 Z',     spellings: ['Chi','nese'],        meaning: '中文；中国人' },
  'japanese':     { phonemes: 'JH AE2 P AH0 N IY1 Z', spellings: ['Jap','a','nese'], meaning: '日语；日本人' },
  'world':        { phonemes: 'W ER1 L D',          spellings: ['world'],            meaning: '世界' },
  'country':      { phonemes: 'K AH1 N T R IY0',    spellings: ['coun','try'],        meaning: '国家' },
  'city':         { phonemes: 'S IH1 T IY0',        spellings: ['cit','y'],           meaning: '城市' },
  'place':        { phonemes: 'P L EY1 S',          spellings: ['place'],            meaning: '地方' },
  'street':       { phonemes: 'S T R IY1 T',        spellings: ['street'],           meaning: '街道' },
  'number':       { phonemes: 'N AH1 M B ER0',      spellings: ['num','ber'],         meaning: '数字；号码' },
  'color':        { phonemes: 'K AH1 L ER0',        spellings: ['col','or'],          meaning: '颜色' },
  'money':        { phonemes: 'M AH1 N IY0',        spellings: ['mon','ey'],          meaning: '钱' },
  'price':        { phonemes: 'P R AY1 S',          spellings: ['price'],            meaning: '价格' },
  'food':         { phonemes: 'F UW1 D',            spellings: ['food'],             meaning: '食物' },
  'breakfast':    { phonemes: 'B R EH1 K F AH0 S T', spellings: ['break','fast'],     meaning: '早餐' },
  'lunch':        { phonemes: 'L AH1 N CH',         spellings: ['lunch'],            meaning: '午餐' },
  'dinner':       { phonemes: 'D IH1 N ER0',        spellings: ['din','ner'],         meaning: '晚餐' },
  'coffee':       { phonemes: 'K AO1 F IY0',        spellings: ['cof','fee'],         meaning: '咖啡' },
  'tea':          { phonemes: 'T IY1',              spellings: ['tea'],              meaning: '茶' },
  'beer':         { phonemes: 'B IY1 R',            spellings: ['beer'],             meaning: '啤酒' },
  'wine':         { phonemes: 'W AY1 N',            spellings: ['wine'],             meaning: '红酒' },
  'fruit':        { phonemes: 'F R UW1 T',          spellings: ['fruit'],            meaning: '水果' },
  'chicken':      { phonemes: 'CH IH1 K AH0 N',     spellings: ['chick','en'],        meaning: '鸡肉' },
  'vegetable':    { phonemes: 'V EH1 JH T AH0 B AH0 L', spellings: ['veg','e','ta','ble'], meaning: '蔬菜' },
  'sandwich':     { phonemes: 'S AE1 N D W IH0 CH', spellings: ['sand','wich'],       meaning: '三明治' },
  'situation':    { phonemes: 'S IH2 CH UW0 EY1 SH AH0 N', spellings: ['sit','u','a','tion'], meaning: '情况' },
  'information':  { phonemes: 'IH2 N F ER0 M EY1 SH AH0 N', spellings: ['in','for','ma','tion'], meaning: '信息' },
  'round':        { phonemes: 'R AW1 N D',          spellings: ['round'],            meaning: '圆的；轮' },
  'result':       { phonemes: 'R IH0 Z AH1 L T',    spellings: ['re','sult'],         meaning: '结果' },
  'head':         { phonemes: 'HH EH1 D',           spellings: ['head'],             meaning: '头' },
  'noodle':       { phonemes: 'N UW1 D AH0 L',      spellings: ['noo','dle'],         meaning: '面条' },

  // --- -rry 家族 ---
  'worry':        { phonemes: 'W AH1 R IY0',        spellings: ['wor','ry'],          meaning: '担心' },
  'hurry':        { phonemes: 'HH AH1 R IY0',       spellings: ['hur','ry'],          meaning: '赶快' },
  'marry':        { phonemes: 'M AE1 R IY0',        spellings: ['mar','ry'],          meaning: '结婚' },
  'cherry':       { phonemes: 'CH EH1 R IY0',       spellings: ['cher','ry'],         meaning: '樱桃' },
  'berry':        { phonemes: 'B EH1 R IY0',        spellings: ['ber','ry'],          meaning: '浆果' },
  'merry':        { phonemes: 'M EH1 R IY0',        spellings: ['mer','ry'],          meaning: '愉快的' },

  // --- -er- r 化元音家族 ---
  'mercy':        { phonemes: 'M ER1 S IY0',        spellings: ['mer','cy'],          meaning: '仁慈' },
  'verb':         { phonemes: 'V ER1 B',            spellings: ['verb'],             meaning: '动词' },
  'person':       { phonemes: 'P ER1 S AH0 N',      spellings: ['per','son'],         meaning: '人' },
  'perfect':      { phonemes: 'P ER1 F IH0 K T',    spellings: ['per','fect'],        meaning: '完美的' },

  // --- -able / -ible 家族 ---
  'able':         { phonemes: 'EY1 B AH0 L',        spellings: ['a','ble'],           meaning: '能够' },
  'impossible':   { phonemes: 'IH2 M P AA1 S AH0 B AH0 L', spellings: ['im','pos','si','ble'], meaning: '不可能的' },
  'table':        { phonemes: 'T EY1 B AH0 L',      spellings: ['ta','ble'],          meaning: '桌子' },

  // --- -le 家族 ---
  'apple':        { phonemes: 'AE1 P AH0 L',        spellings: ['ap','ple'],          meaning: '苹果' },
  'little':       { phonemes: 'L IH1 T AH0 L',      spellings: ['lit','tle'],         meaning: '小的' },
  'bottle':       { phonemes: 'B AA1 T AH0 L',      spellings: ['bot','tle'],         meaning: '瓶子' },
  'middle':       { phonemes: 'M IH1 D AH0 L',      spellings: ['mid','dle'],         meaning: '中间' },
  'simple':       { phonemes: 'S IH1 M P AH0 L',    spellings: ['sim','ple'],         meaning: '简单的' },

  // --- -tion 派生词（保留原有 spellings 和 meaning） ---
  'nation':           { phonemes: 'N EY1 SH AH0 N',                         spellings: ['na','tion'],                        meaning: '国家' },
  'national':         { phonemes: 'N AE1 SH AH0 N AH0 L',                   spellings: ['na','tion','al'],                    meaning: '国家的' },
  'international':    { phonemes: 'IH2 N T ER0 N AE1 SH AH0 N AH0 L',       spellings: ['in','ter','na','tion','al'],          meaning: '国际的' },
  'population':       { phonemes: 'P AA2 P Y AH0 L EY1 SH AH0 N',           spellings: ['pop','u','la','tion'],               meaning: '人口' },
  "vacation":         { "phonemes": "V EY0 K EY1 SH AH0 N",                 "spellings": ["va", "ca", "tion"],                "meaning": "假期" },
  "creation":         { "phonemes": "K R IY0 EY1 SH AH0 N",                 "spellings": ["cre", "a", "tion"],                "meaning": "创造" },
  "donation":         { "phonemes": "D OW0 N EY1 SH AH0 N",                 "spellings": ["do", "na", "tion"],                "meaning": "捐赠" },
  "vocation":         { "phonemes": "V OW0 K EY1 SH AH0 N",                 "spellings": ["vo", "ca", "tion"],                "meaning": "职业" },
  "probation":        { "phonemes": "P R AH0 B EY1 SH AH0 N",               "spellings": ["pro", "ba", "tion"],               "meaning": "试用期" },
  "privation":        { "phonemes": "P R AY0 V EY1 SH AH0 N",               "spellings": ["pri", "va", "tion"],               "meaning": "匮乏" },
  "narration":        { "phonemes": "N EH0 R EY1 SH AH0 N",                 "spellings": ["nar", "ra", "tion"],               "meaning": "叙述" },
  "oration":          { "phonemes": "AO0 R EY1 SH AH0 N",                   "spellings": ["o", "ra", "tion"],                 "meaning": "演说" },
  "relaxation":       { "phonemes": "R IY0 L AE0 K S EY1 SH AH0 N",         "spellings": ["re", "lax", "a", "tion"],          "meaning": "放松" },
  "observation":      { "phonemes": "AA0 B Z ER0 V EY1 SH AH0 N",           "spellings": ["ob", "ser", "va", "tion"],         "meaning": "观察" },
  "reservation":      { "phonemes": "R EH0 Z ER0 V EY1 SH AH0 N",           "spellings": ["res", "er", "va", "tion"],         "meaning": "预订" },
  "preservation":     { "phonemes": "P R EH0 Z ER0 V EY1 SH AH0 N",         "spellings": ["pres", "er", "va", "tion"],        "meaning": "保存" },
  "conversation":     { "phonemes": "K AA0 N V ER0 S EY1 SH AH0 N",         "spellings": ["con", "ver", "sa", "tion"],        "meaning": "交谈" },
  "expectation":      { "phonemes": "EH0 K S P EH0 K T EY1 SH AH0 N",       "spellings": ["ex", "pec", "ta", "tion"],         "meaning": "期望" },
  "adaptation":       { "phonemes": "AE0 D AE0 P T EY1 SH AH0 N",           "spellings": ["ad", "ap", "ta", "tion"],          "meaning": "适应" },
  "limitation":       { "phonemes": "L IH0 M IH0 T EY1 SH AH0 N",           "spellings": ["lim", "i", "ta", "tion"],          "meaning": "限制" },
  "invitation":       { "phonemes": "IH0 N V IH0 T EY1 SH AH0 N",           "spellings": ["in", "vi", "ta", "tion"],          "meaning": "邀请" },
  "consultation":     { "phonemes": "K AA0 N S AH0 L T EY1 SH AH0 N",       "spellings": ["con", "sul", "ta", "tion"],        "meaning": "咨询" },
  "combination":      { "phonemes": "K AA0 M B IH0 N EY1 SH AH0 N",         "spellings": ["com", "bi", "na", "tion"],         "meaning": "组合" },
  "determination":    { "phonemes": "D IH0 T ER0 M IH0 N EY1 SH AH0 N",     "spellings": ["de", "ter", "mi", "na", "tion"],   "meaning": "决心" },
  "examination":      { "phonemes": "IH0 G Z AE0 M IH0 N EY1 SH AH0 N",     "spellings": ["ex", "am", "i", "na", "tion"],     "meaning": "考试" },
  "explanation":      { "phonemes": "EH0 K S P L AH0 N EY1 SH AH0 N",       "spellings": ["ex", "pla", "na", "tion"],         "meaning": "解释" },
  "preparation":      { "phonemes": "P R EH0 P AH0 R EY1 SH AH0 N",         "spellings": ["prep", "a", "ra", "tion"],         "meaning": "准备" },
  "recommendation":   { "phonemes": "R EH0 K AH0 M EH0 N D EY1 SH AH0 N",   "spellings": ["rec", "om", "men", "da", "tion"],  "meaning": "推荐" },
  "transportation":   { "phonemes": "T R AE0 N S P ER0 T EY1 SH AH0 N",     "spellings": ["trans", "por", "ta", "tion"],      "meaning": "交通" },
  "presentation":     { "phonemes": "P R EH0 Z AH0 N T EY1 SH AH0 N",       "spellings": ["pres", "en", "ta", "tion"],        "meaning": "演示" },
  "conservation":     { "phonemes": "K AA0 N S ER0 V EY1 SH AH0 N",         "spellings": ["con", "ser", "va", "tion"],        "meaning": "保护" }
  
};

// ============================================================
// 2. G2P 后备规则（字母 → 音素）
// ============================================================

// 常见多字母组合 → 音素
const G2P_MULTI = {
  'ph': 'F',
  'gh': '',  // 静音或 F, 按上下文处理
  'kn': 'N',  // k 静音
  'ps': 'S',  // p 静音 (如 psychology)
  'wr': 'R',  // w 静音
  'mb': 'M',  // b 静音 (如 climb)
  'bt': 'T',  // b 静音 (如 subtle)
  'tion': 'SH AH N',
  'sion': 'SH AH N',
  'cian': 'SH AH N',
  'ture': 'CH ER',
  'sure': 'ZH ER',
  'cial': 'SH AH L',
  'tial': 'SH AH L',
  'cious': 'SH AH S',
  'tious': 'SH AH S',
  'geous': 'JH AH S',
  'que': 'K',
  'gue': 'G',
  'qu': 'K W',
  'wh': 'W',
  'ng': 'NG',
  'nk': 'NG K',
  'ck': 'K',
  'dge': 'JH',
  'tch': 'CH',
  'eau': 'OW',
  'oi': 'OY',
  'oy': 'OY',
  'ou': 'AW',
  'ow': 'OW',
  'oo': 'UW',
  'ea': 'IY',
  'ee': 'IY',
  'er': 'ER',  // r 化元音（mercy/her/serve → ER，不拆成 EH+R）
  'ai': 'EY',
  'ay': 'EY',
  'oa': 'OW',
  'oe': 'OW',
  'ui': 'UW',
  'ie': 'IY',
  'ei': 'IY',
  'igh': 'AY',
  'eigh': 'EY',
  'augh': 'AO',
  'ough': 'AH',
  'wor': 'W ER',
  'war': 'W AO R',
  'wa': 'W AA',
  'ch': 'CH',
  'sh': 'SH',
  'th': 'TH',
  'zh': 'ZH',
  'dg': 'JH',
  // -tion 元音读长音规则（5 字母，优先于 4 字母的 tion）
  'ation': 'EY SH AH N',
  'ition': 'IH SH AH N',
  'otion': 'OW SH AH N',
  'ution': 'UW SH AH N',
  'etion': 'EH SH AH N',
  'able': 'AH0 B AH0 L',
  'ible': 'AH0 B AH0 L',
  'le': 'AH0 L',
};

// 单个字母 → 常见音素映射
const G2P_SINGLE = {
  'a': 'AH',
  'b': 'B',
  'c': 'K',
  'd': 'D',
  'e': 'EH',
  'f': 'F',
  'g': 'G',
  'h': 'HH',
  'i': 'IH',
  'j': 'JH',
  'k': 'K',
  'l': 'L',
  'm': 'M',
  'n': 'N',
  'o': 'AA',
  'p': 'P',
  'q': 'K',
  'r': 'R',
  's': 'S',
  't': 'T',
  'u': 'AH',
  'v': 'V',
  'w': 'W',
  'x': 'K S',
  'y': 'Y',
  'z': 'Z',
};

// 末尾 e 静音模式
const SILENT_E_ENDINGS = ['ce', 'ge', 'le', 're', 'se', 'te', 've', 'ze', 'me', 'ne', 'ke', 'pe', 'be', 'de', 'fe'];

function g2pLetterToPhonemes(letter, prevLetter, nextLetters, word, pos) {
  const lookahead = nextLetters.join('').toLowerCase();
  const bigram = (letter + (nextLetters[0] || '')).toLowerCase();

  // 处理 word-initial silent letters
  if (pos === 0) {
    if (letter === 'k' && nextLetters[0] === 'n') return '';
    if (letter === 'p' && nextLetters[0] === 's') return '';
    if (letter === 'p' && nextLetters[0] === 'n') return '';
    if (letter === 'w' && nextLetters[0] === 'r') return '';
    if (letter === 'g' && nextLetters[0] === 'n') return '';
    if (letter === 'h' && ['y', 'e', 'o'].includes(nextLetters[0])) {
      // 只对法语借词静音: honor, honest, hour, herb, heir
      const w = word.toLowerCase();
      if (w.startsWith('hon') || w.startsWith('hou') || w.startsWith('herb') || w.startsWith('heir')) return '';
    }
  }

  // 检查多字母组合（长匹配优先，最长 5 字母如 -ation）
  for (let len = 5; len >= 2; len--) {
    const substr = word.substr(pos, len).toLowerCase();
    const g = G2P_MULTI[substr];
    if (g !== undefined) {
      // 消费掉匹配的字母
      this._g2pSkip = len - 1;
      return g;
    }
  }

  // 单个字母
  const lc = letter.toLowerCase();

  // C 软化：c 在 e/i/y 前读 /s/（mercy → S, city → S, face → S）
  if (lc === 'c' && nextLetters[0] && 'eiy'.includes(nextLetters[0].toLowerCase())) {
    return 'S';
  }

  // 词尾 Y 变元音：y 在词尾且前一个是辅音时发 /i/（mercy → IY, happy → IY）
  if (lc === 'y' && nextLetters.length === 0) {
    const prev = prevLetter ? prevLetter.toLowerCase() : '';
    if (prev && !'aeiou'.includes(prev)) {
      return 'IY';
    }
  }

  if (lc in G2P_SINGLE) {
    return G2P_SINGLE[lc];
  }

  return '';
}

/**
 * G2P 后备：将未收录词转为音素串
 */
function g2pFallback(word) {
  const wordLower = word.toLowerCase();

  // 合并双写辅音字母（worry → wory, dinner → diner, coffee → cofe）
  // 双写表示前面元音读短音，但字母本身只发一次音
  const DOUBLED = /([bcdfghjklmnpqrstvwxyz])\1/g;
  const simplified = wordLower.replace(DOUBLED, '$1');
  const chars = simplified.split('');
  const phonemes = [];
  let skip = 0;
  const isSilentE = SILENT_E_ENDINGS.some(ending => wordLower.endsWith(ending) && wordLower.length > 3);

  // Silent-e 长元音映射 (CVCe: 辅音+元音+辅音+e → 元音读字母本音)
  const SILENT_E_VOWELS = { 'a': 'EY', 'i': 'AY', 'o': 'OW', 'u': 'UW', 'e': 'IY' };
  // 例外：看起来像 CVCe 但实际不是的常用词
  const SILENT_E_EXCEPTIONS = ['come','done','love','some','have','give','live','are','gone','none','one','move','lose','were'];

  // 检测 CVCe 模式：... C + V + C + e
  let silentEVowelIdx = -1;
  let isCVCe = false;
  if (isSilentE && wordLower.length >= 4) {
    const last = wordLower.length - 1;
    if (wordLower[last] === 'e') {
      const vIdx = last - 2; // 元音位置 (倒数第3)
      const cBeforeV = wordLower[vIdx - 1]; // 元音前的字母
      const v = wordLower[vIdx];
      // 必须是: C + V + C + e (元音前是辅音，不是另一个元音)
      if (SILENT_E_VOWELS[v] && !'aeiou'.includes(cBeforeV)) {
        isCVCe = true;
        if (!SILENT_E_EXCEPTIONS.includes(wordLower)) {
          silentEVowelIdx = vIdx;
        }
      }
    }
  }

  const ctx = { _g2pSkip: 0 };

  for (let i = 0; i < chars.length; i++) {
    if (skip > 0) { skip--; continue; }
    ctx._g2pSkip = 0;

    // Silent-e: 跳过末尾的 e
    if (i === chars.length - 1 && chars[i] === 'e' && isCVCe) {
      continue;
    }

    // Silent-e: 元音发长音（字母本音）
    if (i === silentEVowelIdx) {
      phonemes.push(SILENT_E_VOWELS[chars[i]]);
      continue;
    }

    const p = g2pLetterToPhonemes.call(ctx, chars[i],
      i > 0 ? chars[i-1] : '',
      chars.slice(i+1), wordLower, i);

    skip = ctx._g2pSkip;

    if (p) {
      phonemes.push(p);
    }
  }

  // 添加重音标记（第一个元音为主重音）
  const VOWELS = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'];
  for (let i = 0; i < phonemes.length; i++) {
    const base = phonemes[i].replace(/[0-2]$/, '');
    if (VOWELS.includes(base)) {
      phonemes[i] = base + '1';
      break;
    }
  }

  return phonemes.join(' ');
}

// ============================================================
// ARPAbet → IPA (国际音标) 映射
// ============================================================
const ARPABET_TO_IPA = {
  // 元音 (Vowels)
  'AA': 'ɑ',  'AE': 'æ',  'AH': 'ʌ',  'AO': 'ɔ',
  'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ',  'ER': 'ɜr',
  'EY': 'eɪ', 'IH': 'ɪ',  'IY': 'i',  'OW': 'oʊ',
  'OY': 'ɔɪ', 'UH': 'ʊ',  'UW': 'u',
  // 辅音 (Consonants)
  'B': 'b',   'CH': 'tʃ', 'D': 'd',   'DH': 'ð',
  'F': 'f',   'G': 'ɡ',   'HH': 'h',  'JH': 'dʒ',
  'K': 'k',   'L': 'l',   'M': 'm',   'N': 'n',
  'NG': 'ŋ',  'P': 'p',   'R': 'r',   'S': 's',
  'SH': 'ʃ',  'T': 't',   'TH': 'θ',  'V': 'v',
  'W': 'w',   'Y': 'j',   'Z': 'z',   'ZH': 'ʒ',
};

/**
 * ARPAbet 音素串 → IPA 音标
 * @param {string} phonemeStr - 空格分隔的音素串，如 "TH AE1 NG K"
 * @param {number} stress - 重音等级 (0=无, 1=主重音, 2=次重音)
 * @returns {string} IPA 字符串，如 "θæŋk"
 */
function arpabetToIPA(phonemeStr, stress) {
  if (!phonemeStr) return '';
  const parts = phonemeStr.trim().split(/\s+/);
  const ipa = parts.map(p => {
    const base = p.replace(/[0-2]$/, '');
    const s = p.match(/[0-2]$/);
    // AH0（非重读 schwa）→ ə，AH1/AH2 仍 → ʌ
    if (base === 'AH' && s && s[0] === '0') return 'ə';
    // ER0（非重读 r 化元音）→ ɚ，ER1/ER2 仍 → ɜr
    if (base === 'ER' && s && s[0] === '0') return 'ɚ';
    return ARPABET_TO_IPA[base] || base;
  }).join('');
  // IPA 重音标记放在音节前
  if (stress === 1) return 'ˈ' + ipa;
  if (stress === 2) return 'ˌ' + ipa;
  return ipa;
}

/**
 * 完整 ARPAbet 音素串 → IPA（自动处理重音位置）
 * 用于在注音谱顶部显示标准音标参考行
 */
function phonemeStrToFullIPA(phonemeStr) {
  if (!phonemeStr) return '';
  const parts = phonemeStr.trim().split(/\s+/);
  const VOWELS = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'];
  let result = '';
  for (const p of parts) {
    const base = p.replace(/[0-2]$/, '');
    const s = p.match(/[0-2]$/);
    const stress = s ? parseInt(s[0], 10) : -1;
    // AH0 → ə, ER0 → ɚ
    if (base === 'AH' && stress === 0) { result += 'ə'; continue; }
    if (base === 'ER' && stress === 0) { result += 'ɚ'; continue; }
    let ipa = ARPABET_TO_IPA[base] || base;
    if (VOWELS.includes(base) && stress === 1) result += 'ˈ';
    else if (VOWELS.includes(base) && stress === 2) result += 'ˌ';
    result += ipa;
  }
  return result;
}

/**
 * 统一获取单词发音
 * 1. 查内置词典；2. 查大小写变体；3. G2P 后备
 */
function getWordPronunciation(word) {
  const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (!clean) return null;

  let entry = normalizeEntry(clean);

  // 大小写变体
  if (!entry) {
    const upper = clean.charAt(0).toUpperCase() + clean.slice(1);
    entry = normalizeEntry(upper);
  }

  let phonemeStr;
  let spellings = null;
  let meaning = null;

  if (entry) {
    phonemeStr = entry.phonemes;
    spellings = entry.spellings;
    meaning = entry.meaning;
  } else {
    // G2P后备
    phonemeStr = g2pFallback(clean);
  }

  // 解析音素
  const phonemes = phonemeStr.trim().split(/\s+/);

  // 音节切分
  const syllables = splitSyllables(phonemes);

  // 检测重音
  const stresses = detectStress(phonemes, syllables);

  // 映射到拼音和汉字
  const items = syllables.map((syl, idx) => {
    const sylPhonemes = syl.join(' ');
    const pinyin = mapToPinyin(sylPhonemes);
    const hanzi = mapToHanzi(pinyin);
    return {
      phonemes: sylPhonemes,
      ipa: arpabetToIPA(sylPhonemes, stresses[idx] || 0),
      pinyin: pinyin || sylPhonemes,
      hanzi: hanzi || pinyin,
      stress: stresses[idx] || 0,
    };
  });

  // 单词级汉字覆盖（如 "name"→"内幕"，整词替换音节级汉字）
  const hanziOverride = _wordHanzi ? _wordHanzi[clean] : null;
  const result = { word: clean, items };
  if (hanziOverride) {
    result.hanziOverride = hanziOverride;
  }
  // 完整 IPA 音标参考行（从音节 IPA 拼接，确保重音符号正确）
  // 例如 ˈɛr + ˌpɔrt = ˈɛrˌpɔrt（而非逐音素的 ˈɛrpˌɔrt）
  result.fullIPA = result.items.map(s => s.ipa).join('');

  // 拼写拆解（用于第三行显示）
  result.spellings = spellings;

  // 中文翻译（用于第四行显示）
  result.meaning = meaning;

  return result;
}

// ============================================================
// 3. 音节切分
// ============================================================

/**
 * 从音素中剥离重音标记 → 纯元音名
 */
function stripStress(phoneme) {
  return phoneme.replace(/[0-2]$/, '');
}

/**
 * 按元音分割音素序列 → 音节数组
 * 改进版：每个音节 = 辅音(onset) + 元音(nucleus)
 * 元音后的辅音(coda)独立成单独音节，便于拼音映射
 */
function splitSyllables(phonemes) {
  const syllables = [];
  let onset = [];     // 当前音节的辅音前缀
  let nucleus = null; // 当前音节的元音
  let coda = [];      // 当前音节后的辅音

  function flush() {
    if (nucleus) {
      syllables.push([...onset, nucleus, ...coda]);
    } else if (onset.length > 0) {
      // 只有辅音 → 加到上一个音节或独立
      if (syllables.length > 0) {
        syllables[syllables.length - 1].push(...onset);
      } else {
        syllables.push([...onset]);
      }
    }
    onset = [];
    nucleus = null;
    coda = [];
  }

  const VOWELS = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'];

  for (let i = 0; i < phonemes.length; i++) {
    const p = phonemes[i];
    const base = stripStress(p);
    const isV = VOWELS.includes(base);

    if (isV) {
      if (nucleus) {
        // 连续元音：前一个音节结束，新音节开始
        // onset中的辅音先留着，看是否是前一个音节的coda
        syllables.push([...onset, nucleus]);
        onset = [];
        nucleus = p;
      } else {
        // 第一个元音：保存onset并设置nucleus
        nucleus = p;
        // 如果前面有coda，它们是前一个音节的
        if (coda.length > 0) {
          if (syllables.length > 0) {
            syllables[syllables.length - 1].push(...coda);
          }
          coda = [];
        }
      }
    } else {
      // 辅音
      if (nucleus) {
        // 后面还有元音吗？检查下一个音素
        let nextIsV = false;
        for (let j = i + 1; j < phonemes.length; j++) {
          const nb = stripStress(phonemes[j]);
          if (VOWELS.includes(nb)) { nextIsV = true; break; }
          break; // 只看下一个音素
        }
        if (nextIsV) {
          // 这个辅音是下一个音节的onset
          flush();
          onset = [p];
        } else {
          // 没有下一个元音 → 这个辅音是coda
          coda.push(p);
        }
      } else {
        onset.push(p);
      }
    }
  }

  // 处理最后的音素
  if (nucleus) {
    syllables.push([...onset, nucleus, ...coda]);
  } else if (onset.length > 0 || coda.length > 0) {
    const remaining = [...onset, ...coda];
    if (syllables.length > 0) {
      syllables[syllables.length - 1].push(...remaining);
    } else {
      syllables.push(remaining);
    }
  }

  return syllables.length > 0 ? syllables : [phonemes];
}

// ============================================================
// 4. 重音检测
// ============================================================
function detectStress(phonemes, syllables) {
  // 找所有重音标记位置
  const stressMap = {};
  phonemes.forEach((p, i) => {
    const match = p.match(/[0-2]$/);
    if (match) {
      stressMap[i] = parseInt(match[0], 10);
    }
  });

  // 映射到音节
  let globalIdx = 0;
  return syllables.map(syl => {
    let sylStress = 0;
    syl.forEach(() => {
      if (stressMap[globalIdx] !== undefined) {
        sylStress = Math.max(sylStress, stressMap[globalIdx]);
      }
      globalIdx++;
    });
    return sylStress;
  });
}

// ============================================================
// 5. 拼音映射
// ============================================================

// 缓存映射表
let _syllableMap = null;
let _pinyinHanzi = null;
let _wordHanzi = null;

async function loadSyllableMap() {
  if (_syllableMap) return _syllableMap;
  try {
    const res = await fetch('data/syllable_map.json');
    _syllableMap = await res.json();
  } catch (e) {
    console.warn('Failed to load syllable_map.json, using fallback', e);
    _syllableMap = {};
  }
  return _syllableMap;
}

async function loadPinyinHanzi() {
  if (_pinyinHanzi) return _pinyinHanzi;
  try {
    const res = await fetch('data/pinyin_hanzi.json');
    _pinyinHanzi = await res.json();
  } catch (e) {
    console.warn('Failed to load pinyin_hanzi.json, using fallback', e);
    _pinyinHanzi = {};
  }
  return _pinyinHanzi;
}

async function loadWordHanzi() {
  if (_wordHanzi) return _wordHanzi;
  try {
    const res = await fetch('data/word_hanzi.json');
    _wordHanzi = await res.json();
  } catch (e) {
    console.warn('Failed to load word_hanzi.json', e);
    _wordHanzi = {};
  }
  return _wordHanzi;
}

/**
 * 贪心从左到右匹配音素→拼音
 * 1. 精确匹配整串
 * 2. 无重音匹配整串
 * 3. 从左到右切分匹配（最长优先），逐段拼接
 * 确保每个音素都有输出，绝不丢弃辅⾳
 */
function mapToPinyin(syllablePhonemes) {
  if (!_syllableMap) return null;

  const key = syllablePhonemes.trim();

  // 1. 精确匹配
  if (_syllableMap[key]) return _syllableMap[key];

  // 2. 无重音匹配
  const noStress = key.replace(/[0-2]/g, '');
  if (_syllableMap[noStress]) return _syllableMap[noStress];

  // 3. 贪心左到右切分匹配
  const parts = key.split(/\s+/);
  const result = [];
  const VOWELS = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'];

  let i = 0;
  while (i < parts.length) {
    let matched = false;
    // 从长到短尝试匹配前缀
    for (let len = Math.min(4, parts.length - i); len >= 1; len--) {
      const sub = parts.slice(i, i + len).join(' ');
      const subNS = sub.replace(/[0-2]/g, '');
      if (_syllableMap[sub]) {
        result.push(_syllableMap[sub]);
        i += len;
        matched = true;
        break;
      }
      if (_syllableMap[subNS]) {
        result.push(_syllableMap[subNS]);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 单个音素都不在映射表中 → 直接用音素名
      result.push(parts[i]);
      i++;
    }
  }

  return result.join(' ');
}

function mapToHanzi(pinyin) {
  if (!_pinyinHanzi || !pinyin) return null;

  // 对多段拼音逐段查汉字再拼接（如 "hē wù kè" → "喝物克"）
  return pinyin.split(' ').map(part => {
    // 精确匹配
    if (_pinyinHanzi[part]) return _pinyinHanzi[part];

    // 忽略声调
    const noTone = part.replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o')
      .replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
      .replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜ]/g, 'u');
    for (const [key, val] of Object.entries(_pinyinHanzi)) {
      const keyNoTone = key.replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o')
        .replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
        .replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜ]/g, 'u');
      if (keyNoTone === noTone) return val;
    }

    // 完全找不到 → 返回拼音本身
    return part;
  }).join('');
}

// ============================================================
// 6. 初始化
// ============================================================
async function initWordEngine() {
  await Promise.all([loadSyllableMap(), loadPinyinHanzi(), loadWordHanzi()]);
}
