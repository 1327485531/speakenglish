/**
 * renderer.js — 注音渲染（三行布局）
 *
 * 每个词块渲染三行:
 *   第一行：完整 IPA 参考，如英 [ˈɛrˌpɔrt]
 *   第二行：逐符号 IPA 拆解 + 配字（tʃ 占一格，ˈ 显示但不配字）
 *   第三行：音节级 IPA + 汉字 + 拼写拆解（BUILTIN_DICT spellings）
 *
 * 渲染结构:
 *   .score
 *     .score-words
 *       .word-block            (每个单词)
 *         .word-ipa-full       (第一行: 完整 IPA)
 *         .ipa-decode          (第二行: 逐符号拆解)
 *           .ipa-cell           每个 IPA 符号
 *             .ipa-sym          IPA 字符
 *             .ipa-hanzi        配字（ˈ/ˌ 无配字）
 *         .syllable-row        (第三行: 音节信息)
 *           .syllable           每个音节
 *             .syllable-ipa     音节 IPA
 *             .syllable-hanzi   汉字
 *             .syllable-pinyin  拼音（仅拼音模式）
 *             .syllable-spelling 拼写拆解（仅 spellings 存在时）
 *         .word-original       (备用: 原英文词, 小字)
 *       .intonation            (语调箭头)
 *     .linking-svg             (连读弧线覆盖层)
 */

let _showPinyinMode = false;
let _ipaHelp = {};  // IPA 配字表缓存

function setPinyinMode(mode) {
  _showPinyinMode = mode;
}

function togglePinyinMode() {
  _showPinyinMode = !_showPinyinMode;
  return _showPinyinMode;
}

function getPinyinMode() {
  return _showPinyinMode;
}

/** 加载 IPA 配字表 */
async function loadIpaHelp() {
  if (Object.keys(_ipaHelp).length > 0) return _ipaHelp;
  try {
    const res = await fetch('data/ipa_help.json');
    _ipaHelp = await res.json();
  } catch (e) {
    console.warn('Failed to load ipa_help.json', e);
    _ipaHelp = {};
  }
  return _ipaHelp;
}

/** 初始化渲染器 */
async function initRenderer() {
  await loadIpaHelp();
}

/**
 * 从音节数据构建 IPA 逐符号拆解数组
 * 将重音标记（ˈ/ˌ）作为独立单元插入，tʃ/dʒ/aʊ 等多字符 IPA 占一格
 * @param {Array} items - 音节数组 (from block.items)
 * @returns {Array} [{sym, hanzi, tip, isStress}]
 */
function getIPADecodeItems(items) {
  const result = [];
  for (const syl of items) {
    // 音节级重音标记 → 独立单元
    if (syl.stress === 1) {
      result.push({ sym: 'ˈ', hanzi: '', tip: '主重音', isStress: true });
    } else if (syl.stress === 2) {
      result.push({ sym: 'ˌ', hanzi: '', tip: '次重音', isStress: true });
    }

    // 该音节内每个音素 → IPA 符号
    const phList = syl.phonemes.trim().split(/\s+/);
    for (const ph of phList) {
      const base = ph.replace(/[0-2]$/, '');
      const stressMatch = ph.match(/[0-2]$/);

      let ipaSym;
      if (base === 'AH' && stressMatch && stressMatch[0] === '0') ipaSym = 'ə';
      else if (base === 'ER' && stressMatch && stressMatch[0] === '0') ipaSym = 'ɚ';
      else ipaSym = ARPABET_TO_IPA[base] || base;

      const help = _ipaHelp[ipaSym];
      result.push({
        sym: ipaSym,
        hanzi: help ? help.hanzi : '',
        tip: help ? help.tip : '',
        isStress: false,
      });
    }
  }
  return result;
}

/**
 * 绘制 SVG 连读弧线（三层动画）
 * 1. stroke-dasharray 描边入场（0.6s，延迟递增）
 * 2. 3px 光点 animateMotion 单向流动（2s 循环）
 * 3. 光点到终点 → 目标音节 flash-receive（0.3s）
 */
function drawLinkingArcs(container, linkPairs) {
  // 清除旧 SVG 及关联定时器
  const oldSvg = container.querySelector('.linking-svg');
  if (oldSvg) {
    if (oldSvg._flashTimers) {
      oldSvg._flashTimers.forEach(t => clearTimeout(t));
      oldSvg._flashTimers.forEach(t => clearInterval(t));
    }
    oldSvg.remove();
  }

  const wordsDiv = container.querySelector('.score-words');
  if (!wordsDiv) return;

  const containerRect = container.getBoundingClientRect();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('linking-svg');
  svg.setAttribute('width', containerRect.width);
  svg.setAttribute('height', containerRect.height);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';
  svg.style.overflow = 'visible';
  svg.style.zIndex = '1';
  container.appendChild(svg);

  // — 唯一 <defs> 块 —
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  // 光点发光滤镜（三层辉光：超大外层光晕 + 中层辉光 + 内层亮光）
  const dotGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  dotGlow.id = 'dot-glow';
  dotGlow.setAttribute('x', '-200%'); dotGlow.setAttribute('y', '-200%');
  dotGlow.setAttribute('width', '500%'); dotGlow.setAttribute('height', '500%');
  // 外层超大光晕（散射光芒）
  const gbOuter = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbOuter.setAttribute('stdDeviation', '20'); gbOuter.setAttribute('result', 'outerGlow');
  dotGlow.appendChild(gbOuter);
  // 中层辉光
  const gbMid = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbMid.setAttribute('stdDeviation', '10'); gbMid.setAttribute('result', 'midGlow');
  dotGlow.appendChild(gbMid);
  // 内层亮光
  const gbInner = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbInner.setAttribute('stdDeviation', '4'); gbInner.setAttribute('result', 'innerGlow');
  dotGlow.appendChild(gbInner);
  // 合并: 外层 + 中层 + 内层 + 原始点
  const mergeDot = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const md1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  md1.setAttribute('in', 'outerGlow');
  const md2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  md2.setAttribute('in', 'midGlow');
  const md3 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  md3.setAttribute('in', 'innerGlow');
  const md4 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  md4.setAttribute('in', 'SourceGraphic');
  mergeDot.appendChild(md1); mergeDot.appendChild(md2); mergeDot.appendChild(md3); mergeDot.appendChild(md4);
  dotGlow.appendChild(mergeDot);
  defs.appendChild(dotGlow);

  // 弧线发光滤镜（三层辉光 + 更强）
  const arcGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  arcGlow.id = 'arc-glow';
  arcGlow.setAttribute('x', '-100%'); arcGlow.setAttribute('y', '-100%');
  arcGlow.setAttribute('width', '300%'); arcGlow.setAttribute('height', '300%');
  const gbOuter2 = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbOuter2.setAttribute('stdDeviation', '12'); gbOuter2.setAttribute('result', 'outerGlow2');
  arcGlow.appendChild(gbOuter2);
  const gbMid2 = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbMid2.setAttribute('stdDeviation', '5'); gbMid2.setAttribute('result', 'midGlow2');
  arcGlow.appendChild(gbMid2);
  const gbInner2 = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  gbInner2.setAttribute('stdDeviation', '2'); gbInner2.setAttribute('result', 'innerGlow2');
  arcGlow.appendChild(gbInner2);
  const mergeArc = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const ma1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  ma1.setAttribute('in', 'outerGlow2');
  const ma2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  ma2.setAttribute('in', 'midGlow2');
  const ma3 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  ma3.setAttribute('in', 'innerGlow2');
  const ma4 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  ma4.setAttribute('in', 'SourceGraphic');
  mergeArc.appendChild(ma1); mergeArc.appendChild(ma2); mergeArc.appendChild(ma3); mergeArc.appendChild(ma4);
  arcGlow.appendChild(mergeArc);
  defs.appendChild(arcGlow);

  // 金色渐变定义（弧线渐变）
  const goldGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  goldGrad.id = 'gold-grad';
  goldGrad.setAttribute('x1', '0%'); goldGrad.setAttribute('y1', '0%');
  goldGrad.setAttribute('x2', '100%'); goldGrad.setAttribute('y2', '0%');
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#f0a500');
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#f5c842');
  goldGrad.appendChild(stop1); goldGrad.appendChild(stop2);
  defs.appendChild(goldGrad);

  // 暗金渐变定义（词内弧线）
  const darkGoldGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  darkGoldGrad.id = 'dark-gold-grad';
  darkGoldGrad.setAttribute('x1', '0%'); darkGoldGrad.setAttribute('y1', '0%');
  darkGoldGrad.setAttribute('x2', '100%'); darkGoldGrad.setAttribute('y2', '0%');
  const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop3.setAttribute('offset', '0%'); stop3.setAttribute('stop-color', '#d4a030');
  const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop4.setAttribute('offset', '100%'); stop4.setAttribute('stop-color', '#e8b840');
  darkGoldGrad.appendChild(stop3); darkGoldGrad.appendChild(stop4);
  defs.appendChild(darkGoldGrad);

  svg.insertBefore(defs, svg.firstChild);

  /** 容器坐标 → SVG 局部坐标 */
  function rel(rect) {
    return {
      left: rect.left - containerRect.left,
      right: rect.right - containerRect.left,
      top: rect.top - containerRect.top,
      bottom: rect.bottom - containerRect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  const wordBlocks = wordsDiv.querySelectorAll(':scope > .word-block');
  const flashTimers = [];

  // —— 工具函数：创建单条弧线（含五层动画）——
  function createArc(d, color, width, targetEl, delayIdx) {
    const delay = 0.15 + delayIdx * 0.12;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('linking-arc');

    const pathId = 'ap-' + delayIdx + '-' + Math.random().toString(36).slice(2, 6);

    // 第 0 层：背景辉光路径（更宽、更强辉光）
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glowPath.setAttribute('d', d);
    glowPath.setAttribute('stroke', color);
    glowPath.setAttribute('stroke-width', parseFloat(width) * 5);
    glowPath.setAttribute('fill', 'none');
    glowPath.setAttribute('stroke-linecap', 'round');
    glowPath.setAttribute('opacity', '0.35');
    glowPath.setAttribute('filter', 'url(#arc-glow)');
    g.appendChild(glowPath);

    // 第 0.5 层：外发光扩展光晕（极宽、极淡）
    const outerGlowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outerGlowPath.setAttribute('d', d);
    outerGlowPath.setAttribute('stroke', color);
    outerGlowPath.setAttribute('stroke-width', parseFloat(width) * 10);
    outerGlowPath.setAttribute('fill', 'none');
    outerGlowPath.setAttribute('stroke-linecap', 'round');
    outerGlowPath.setAttribute('opacity', '0.12');
    outerGlowPath.setAttribute('filter', 'url(#arc-glow)');
    g.appendChild(outerGlowPath);

    // 第 1 层：主路径 + stroke-dasharray 入场
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.id = pathId;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    g.appendChild(path);

    // 计算路径长度并设置 dasharray 动画
    requestAnimationFrame(() => {
      const len = path.getTotalLength();
      if (!len) return;
      // 初始隐藏
      path.setAttribute('stroke-dasharray', len);
      path.setAttribute('stroke-dashoffset', len);
      glowPath.setAttribute('stroke-dasharray', len);
      glowPath.setAttribute('stroke-dashoffset', len);
      // 描边入场（略慢更有气势）
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      anim.setAttribute('attributeName', 'stroke-dashoffset');
      anim.setAttribute('from', len);
      anim.setAttribute('to', '0');
      anim.setAttribute('dur', '0.8s');
      anim.setAttribute('begin', delay + 's');
      anim.setAttribute('fill', 'freeze');
      path.appendChild(anim);
      // 辉光路径同步入场
      const animGlow = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animGlow.setAttribute('attributeName', 'stroke-dashoffset');
      animGlow.setAttribute('from', len);
      animGlow.setAttribute('to', '0');
      animGlow.setAttribute('dur', '0.9s');
      animGlow.setAttribute('begin', delay + 's');
      animGlow.setAttribute('fill', 'freeze');
      glowPath.appendChild(animGlow);
    });

    // 第 2 层：主光点（更大、更亮、三层辉光）
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '8');
    dot.setAttribute('fill', '#ffd700');
    dot.setAttribute('filter', 'url(#dot-glow)');
    // 主光点脉冲动画（大小闪烁）
    const dotPulse = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    dotPulse.setAttribute('attributeName', 'r');
    dotPulse.setAttribute('values', '8;10;7;9;8');
    dotPulse.setAttribute('dur', '2s');
    dotPulse.setAttribute('repeatCount', 'indefinite');
    dotPulse.setAttribute('begin', delay + 's');
    dot.appendChild(dotPulse);
    const motion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    motion.setAttribute('dur', '2s');
    motion.setAttribute('repeatCount', 'indefinite');
    motion.setAttribute('begin', delay + 's');
    const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    mpath.setAttribute('href', '#' + pathId);
    motion.appendChild(mpath);
    dot.appendChild(motion);
    g.appendChild(dot);

    // 第 2.3 层：核心白光点（很小、纯白、在内层产生星核效果）
    const coreDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    coreDot.setAttribute('r', '3');
    coreDot.setAttribute('fill', '#ffffff');
    coreDot.setAttribute('opacity', '0.9');
    const coreMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    coreMotion.setAttribute('dur', '2s');
    coreMotion.setAttribute('repeatCount', 'indefinite');
    coreMotion.setAttribute('begin', delay + 's');
    const coreMpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    coreMpath.setAttribute('href', '#' + pathId);
    coreMotion.appendChild(coreMpath);
    coreDot.appendChild(coreMotion);
    g.appendChild(coreDot);

    // 第 2.5 层：彗尾光点（大一号、淡金色、延迟 0.12s 跟随）
    const trailDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    trailDot.setAttribute('r', '5');
    trailDot.setAttribute('fill', '#ffb300');
    trailDot.setAttribute('opacity', '0.5');
    trailDot.setAttribute('filter', 'url(#dot-glow)');
    // 彗尾脉冲
    const trailPulse = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    trailPulse.setAttribute('attributeName', 'r');
    trailPulse.setAttribute('values', '5;3;5');
    trailPulse.setAttribute('dur', '1.5s');
    trailPulse.setAttribute('repeatCount', 'indefinite');
    trailPulse.setAttribute('begin', (delay + 0.12) + 's');
    trailDot.appendChild(trailPulse);
    const trailMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    trailMotion.setAttribute('dur', '2s');
    trailMotion.setAttribute('repeatCount', 'indefinite');
    trailMotion.setAttribute('begin', (delay + 0.12) + 's');
    const trailMpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    trailMpath.setAttribute('href', '#' + pathId);
    trailMotion.appendChild(trailMpath);
    trailDot.appendChild(trailMotion);
    g.appendChild(trailDot);

    // 第 2.7 层：第二彗尾（更小、更淡、延迟 0.25s）
    const trailDot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    trailDot2.setAttribute('r', '3');
    trailDot2.setAttribute('fill', '#ff8c00');
    trailDot2.setAttribute('opacity', '0.35');
    trailDot2.setAttribute('filter', 'url(#dot-glow)');
    const trailMotion2 = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    trailMotion2.setAttribute('dur', '2s');
    trailMotion2.setAttribute('repeatCount', 'indefinite');
    trailMotion2.setAttribute('begin', (delay + 0.25) + 's');
    const trailMpath2 = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    trailMpath2.setAttribute('href', '#' + pathId);
    trailMotion2.appendChild(trailMpath2);
    trailDot2.appendChild(trailMotion2);
    g.appendChild(trailDot2);

    // 到达终点时的星爆粒子（4 颗散射小星点，循环出现）
    // 使用 <g> 包装：外层 <g> 沿主路径运动，内层粒子做散射动画
    [0, 90, 180, 270].forEach((angle, i) => {
      const particleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      // 外层 animateMotion：沿主路径从起点到终点
      const approachMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      approachMotion.setAttribute('dur', '2s');
      approachMotion.setAttribute('repeatCount', 'indefinite');
      approachMotion.setAttribute('begin', delay + 's');
      const apMpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
      apMpath.setAttribute('href', '#' + pathId);
      approachMotion.appendChild(apMpath);
      particleGroup.appendChild(approachMotion);

      // 内层粒子：到达终点后做散射
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      p.setAttribute('r', [2.5, 2, 1.5, 2][i]);
      p.setAttribute('fill', ['#ffd700', '#ff8c00', '#ffffff', '#ffb300'][i]);
      p.setAttribute('opacity', [0.7, 0.5, 0.8, 0.4][i]);
      p.setAttribute('filter', 'url(#dot-glow)');
      // 粒子自身散射：用 animateTransform 做位移
      const radians = angle * Math.PI / 180;
      const dx = Math.cos(radians) * 15;
      const dy = Math.sin(radians) * 15;
      const scatter = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
      scatter.setAttribute('attributeName', 'transform');
      scatter.setAttribute('type', 'translate');
      scatter.setAttribute('values', '0,0;' + dx + ',' + dy);
      scatter.setAttribute('dur', '0.6s');
      scatter.setAttribute('repeatCount', 'indefinite');
      scatter.setAttribute('begin', delay + 's');
      p.appendChild(scatter);
      // 粒子渐隐
      const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      fade.setAttribute('attributeName', 'opacity');
      fade.setAttribute('values', [0.7, 0.5, 0.8, 0.4][i] + ';0');
      fade.setAttribute('dur', '0.6s');
      fade.setAttribute('repeatCount', 'indefinite');
      fade.setAttribute('begin', delay + 's');
      p.appendChild(fade);
      particleGroup.appendChild(p);
      g.appendChild(particleGroup);
    });

    // 第 3 层：光点到站 → 目标 flash（更华丽）
    const firstFlashDelay = (delay + 2.15) * 1000;
    let flashCount = 0;
    const flash = () => {
      if (targetEl) {
        targetEl.classList.add('flash-receive');
        const t = setTimeout(() => {
          targetEl.classList.remove('flash-receive');
          // 二次闪烁加强效果
          if (flashCount === 0) {
            const t2 = setTimeout(() => {
              targetEl.classList.add('flash-receive');
              setTimeout(() => targetEl.classList.remove('flash-receive'), 200);
            }, 80);
            flashTimers.push(t2);
          }
          flashCount++;
        }, 380);
        flashTimers.push(t);
      }
    };
    const t1 = setTimeout(flash, firstFlashDelay);
    flashTimers.push(t1);
    const t2 = setInterval(flash, 2000);
    flashTimers.push(t2);

    svg.appendChild(g);
  }

  // — 词间连读弧线（深色 2px）—
  linkPairs.forEach((pair, idx) => {
    const fromBlock = wordBlocks[pair.from];
    const toBlock = wordBlocks[pair.to];
    if (!fromBlock || !toBlock) return;

    const fromRow = fromBlock.querySelector('.syllable-row');
    const toRow = toBlock.querySelector('.syllable-row');
    if (!fromRow || !toRow) return;

    const fromSyls = fromRow.querySelectorAll(':scope > .syllable');
    const toSyls = toRow.querySelectorAll(':scope > .syllable');
    if (fromSyls.length === 0 || toSyls.length === 0) return;

    const fromEl = fromSyls[fromSyls.length - 1];
    const toEl = toSyls[0];

    const fRect = rel(fromEl.getBoundingClientRect());
    const tRect = rel(toEl.getBoundingClientRect());

    const x1 = fRect.right;
    const y1 = fRect.top + fRect.height / 2;
    const x2 = tRect.left;
    const y2 = tRect.top + tRect.height / 2;
    const cx = (x1 + x2) / 2;
    const cy = Math.max(y1, y2) + 28;

    createArc(
      'M ' + x1 + ' ' + y1 + ' Q ' + cx + ' ' + cy + ' ' + x2 + ' ' + y2,
      'url(#gold-grad)', '2.5', toEl, idx
    );
  });

  // — 词内音节连接弧线（浅色 1px）—
  let sylArcIdx = linkPairs.length;
  wordBlocks.forEach(block => {
    const row = block.querySelector('.syllable-row');
    if (!row) return;
    const syls = row.querySelectorAll(':scope > .syllable');
    if (syls.length < 2) return;

    for (let i = 0; i < syls.length - 1; i++) {
      const fRect = rel(syls[i].getBoundingClientRect());
      const tRect = rel(syls[i + 1].getBoundingClientRect());

      const x1 = fRect.right;
      const y1 = fRect.top + fRect.height / 2;
      const x2 = tRect.left;
      const y2 = tRect.top + tRect.height / 2;
      const cx = (x1 + x2) / 2;
      const cy = Math.max(y1, y2) + 16;

      createArc(
        'M ' + x1 + ' ' + y1 + ' Q ' + cx + ' ' + cy + ' ' + x2 + ' ' + y2,
        'url(#dark-gold-grad)', '2', syls[i + 1], sylArcIdx
      );
      sylArcIdx++;
    }
  });

  // 存定时器引用以便清除
  svg._flashTimers = flashTimers;
}

/**
 * 渲染注音谱（三行布局）
 */
function renderScore(container, result) {
  if (!result || !result.blocks || result.blocks.length === 0) {
    container.innerHTML = '<div class="score-empty">请输入英文单词或句子</div>';
    return;
  }

  // 移除旧 resize 监听
  if (container._resizeHandler) {
    window.removeEventListener('resize', container._resizeHandler);
    container._resizeHandler = null;
  }

  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'score';

  const wordsDiv = document.createElement('div');
  wordsDiv.className = 'score-words';

  // 收集连读对
  const linkPairs = [];
  let wordIdx = -1;

  result.blocks.forEach(block => {
    if (block._linkMarker) {
      if (wordIdx >= 0) {
        linkPairs.push({ from: wordIdx, to: wordIdx + 1, pairKey: block.pairKey });
      }
      return;
    }

    wordIdx++;
    const wordDiv = document.createElement('div');
    wordDiv.className = 'word-block';

    // ── 第一行：完整 IPA 参考 ──
    if (block.fullIPA) {
      const ipaFull = document.createElement('div');
      ipaFull.className = 'word-ipa-full';
      ipaFull.textContent = '英 [' + block.fullIPA + ']';
      wordDiv.appendChild(ipaFull);
    }

    // ── 第二行：逐符号 IPA 拆解 + 配字 ──
    const decodeItems = getIPADecodeItems(block.items || []);
    if (decodeItems.length > 0) {
      const decodeRow = document.createElement('div');
      decodeRow.className = 'ipa-decode';
      decodeItems.forEach(item => {
        const cell = document.createElement('span');
        cell.className = 'ipa-cell' + (item.isStress ? ' stress' : '');

        const symSpan = document.createElement('span');
        symSpan.className = 'ipa-sym';
        symSpan.textContent = item.sym;
        cell.appendChild(symSpan);

        if (item.isStress) {
          // 重音标记：不显示配字
        } else if (item.hanzi) {
          const hanziSpan = document.createElement('span');
          hanziSpan.className = 'ipa-hanzi';
          hanziSpan.textContent = item.hanzi;
          cell.appendChild(hanziSpan);
        } else {
          // 音素表中没有配字 → 留空占位
          const hanziSpan = document.createElement('span');
          hanziSpan.className = 'ipa-hanzi';
          hanziSpan.innerHTML = '&nbsp;';
          cell.appendChild(hanziSpan);
        }

        decodeRow.appendChild(cell);
      });
      wordDiv.appendChild(decodeRow);
    }

    // ── 第三行：音节级 IPA + 汉字 + 拼写 ──
    const sylRow = document.createElement('div');
    sylRow.className = 'syllable-row';

    // 单词级汉字覆盖（特殊处理）
    if (block.hanziOverride && !_showPinyinMode) {
      const overrideSpan = document.createElement('span');
      overrideSpan.className = 'syllable hanzi-override';
      // 汉字大字
      const hanziSpan = document.createElement('span');
      hanziSpan.className = 'syllable-hanzi';
      hanziSpan.textContent = block.hanziOverride;
      overrideSpan.appendChild(hanziSpan);
      // 完整 IPA 小字
      if (block.fullIPA) {
        const ipaSmall = document.createElement('span');
        ipaSmall.className = 'syllable-ipa';
        ipaSmall.textContent = '[' + block.fullIPA + ']';
        overrideSpan.appendChild(ipaSmall);
      }
      sylRow.appendChild(overrideSpan);
    } else if (block.items && block.items.length > 0) {
      block.items.forEach((syl, sIdx) => {
        const sylSpan = document.createElement('span');
        sylSpan.className = 'syllable' + (syl.stress > 0 ? ' stress' : '');

        if (_showPinyinMode) {
          // 拼音模式：显示拼音 + 拼写
          const pinyinSpan = document.createElement('span');
          pinyinSpan.className = 'syllable-pinyin-main';
          pinyinSpan.textContent = syl.pinyin || syl.ipa || syl.phonemes;
          sylSpan.appendChild(pinyinSpan);

          // 拼写拆解
          if (block.spellings && block.spellings[sIdx]) {
            const spSpan = document.createElement('span');
            spSpan.className = 'syllable-spelling';
            spSpan.textContent = block.spellings[sIdx];
            sylSpan.appendChild(spSpan);
          }
        } else {
          // 汉字模式：音节 IPA + 汉字 + 拼写
          const ipaSpan = document.createElement('span');
          ipaSpan.className = 'syllable-ipa';
          ipaSpan.textContent = syl.ipa || '';
          ipaSpan.title = syl.phonemes || '';
          sylSpan.appendChild(ipaSpan);

          const hanziSpan = document.createElement('span');
          hanziSpan.className = 'syllable-hanzi';
          hanziSpan.textContent = syl.hanzi || syl.pinyin || '?';
          sylSpan.appendChild(hanziSpan);

          // 拼写拆解（如果词典有 spellings）
          if (block.spellings && block.spellings[sIdx]) {
            const spSpan = document.createElement('span');
            spSpan.className = 'syllable-spelling';
            spSpan.textContent = block.spellings[sIdx];
            sylSpan.appendChild(spSpan);
          }

          // 重音标记
          if (syl.stress === 1) {
            const stressDot = document.createElement('span');
            stressDot.className = 'stress-dot';
            stressDot.textContent = '●';
            stressDot.title = '主重音';
            sylSpan.appendChild(stressDot);
          } else if (syl.stress === 2) {
            const stressDot = document.createElement('span');
            stressDot.className = 'stress-dot secondary';
            stressDot.textContent = '○';
            stressDot.title = '次重音';
            sylSpan.appendChild(stressDot);
          }
        }

        sylRow.appendChild(sylSpan);
      });
    }

    wordDiv.appendChild(sylRow);

    // ── 第四行：中文翻译 ──
    // 句子模式不显示单个词释义，改为整体翻译（见下方）
    if (result.mode !== 'sentence') {
      const meaningSpan = document.createElement('div');
      meaningSpan.className = 'word-meaning';
      if (block.meaning) {
        meaningSpan.textContent = block.meaning;
      }
      wordDiv.appendChild(meaningSpan);
    }

    // 原词（小字备注，hover 显示）
    if (block.word) {
      const origSpan = document.createElement('span');
      origSpan.className = 'word-original';
      origSpan.textContent = block.word;
      wordDiv.appendChild(origSpan);
    }

    wordsDiv.appendChild(wordDiv);
  });

  // 语调箭头
  if (result.intonation) {
    const intonationSpan = document.createElement('span');
    intonationSpan.className = 'intonation';
    intonationSpan.textContent = result.intonation;
    wordsDiv.appendChild(intonationSpan);
  }

  scoreDiv.appendChild(wordsDiv);

  // 句子模式：在底部显示整句中文翻译
  if (result.mode === 'sentence' && result.meaning) {
    const sentenceMeaningDiv = document.createElement('div');
    sentenceMeaningDiv.className = 'sentence-meaning';
    sentenceMeaningDiv.textContent = result.meaning;
    scoreDiv.appendChild(sentenceMeaningDiv);
  }
  container.innerHTML = '';
  container.appendChild(scoreDiv);

  // 绘制 SVG 连读弧线
  drawLinkingArcs(container, linkPairs);

  // resize 重绘
  const onResize = () => drawLinkingArcs(container, linkPairs);
  window.addEventListener('resize', onResize);
  container._resizeHandler = onResize;
}
