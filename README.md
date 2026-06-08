# Phonetic Reader — 英语发音可视化工具

输入任意英文单词或句子，自动生成 IPA 音标、逐符号拆解、拼写分段和中文注音。零基础也能看懂音标。

## ✨ 核心功能

- 📖 **完整 IPA 标注** — 美式发音，重音标记
- 🔤 **逐符号拆解 + 中文配字** — 44 个 IPA 符号每个都能看懂
- 🗣️ **拼音 + 汉字注音** — 零基础用户的发音拐杖
- 🎵 **连读弧线** — 句子模式自动标注连读和语调
- 📝 **拼写分段** — 理解英语拼读逻辑
- 🔊 **慢速语音** — 多速率可调

## 🚀 直接用

[→ [(https://1327485531.github.io/speakenglish/)](https://1327485531.github.io/speakenglish/))]()

支持 Web / PWA（手机可添加到桌面，离线使用）。


## 🧩 一张截图
<img width="1111" height="929" alt="360se_BEPuISQUwy" src="https://github.com/user-attachments/assets/19cb8eba-30f9-408d-8196-e4768d05da4e" />




## 🏗 项目架构

源码结构：
│ index.html        # 主页面
│ manifest.json     # PWA
│ sw.js            # Service Worker  
├── css/           # 样式
├── js/            # 核心逻辑
│   ├── word.js    # 单词引擎（字典查询 + 音节切分 + 注音映射）
│   ├── sentence.js # 句子处理（连读 + 弱读 + 语调）
│   ├── renderer.js # 三行 IPA 渲染 + 连读弧线
│   └── tts.js     # 语音合成
├── data/          # 核心数据
│   ├── syllable_map.json   # 7600+ 条音素→拼音映射
│   ├── pinyin_hanzi.json   # 拼音→汉字映射
│   ├── ipa_help.json       # 44 个 IPA 符号配字
│   └── linking_rules.json  # 270+ 条连读规则
└── tools/         # 数据生成脚本

## 🔧 技术栈

- 纯前端（HTML + CSS + JS），零依赖构建
- Web Speech API（TTS 播放）
- PWA + Service Worker（离线使用）
- GitHub Pages 部署

## 📦 数据工程

- **发音引擎**：内置词典覆盖 400+ 不规则词 + G2P 规则推导（silent-e、soft-c、-tion/-able/-ible 等后缀识别），未收录词自动推导发音
- **映射表 7600+ 条**：ARPAbet 音素→拼音→汉字，覆盖 CVC 音节模板、辅音丛、元音+鼻音尾等组合
- **连读规则 270+ 条**：覆盖常见功能词连读和弱读模式

## 🎬 视频教程

抖音/B站搜索：[小喷壶AI搞特效]/[我有一个小喷壶]



## 🤝 贡献

发现注音不准确？欢迎提 Issue 或 Pull Request。

## 📄 许可

MIT License
