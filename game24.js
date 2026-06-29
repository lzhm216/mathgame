/* ==========================================================================
   24点游戏 - 极速现代游戏逻辑 & 核心算法 (Vanilla JS)
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. 核心数学 AST 与解析器 (用于安全计算与算式规范化去重)
// --------------------------------------------------------------------------

class ASTNode {
    constructor(type, val, left = null, right = null) {
        this.type = type; // 'NUMBER' or 'OPERATOR'
        this.val = val;   // 运算符字符（'+','-','*','/'）或数字值
        this.left = left;
        this.right = right;
    }

    // 将 AST 规范化并转化为标准中缀字符串以进行交换律去重
    toString() {
        if (this.type === 'NUMBER') {
            return String(this.val);
        }
        // 对于满足交换律的运算符 (+ 和 *)，对左右子树按字典序排序
        if (this.val === '+' || this.val === '*') {
            const lStr = this.left.toString();
            const rStr = this.right.toString();
            return lStr < rStr ? `(${lStr}${this.val}${rStr})` : `(${rStr}${this.val}${lStr})`;
        }
        // 不满足交换律的运算符 (- 和 /)
        return `(${this.left.toString()}${this.val}${this.right.toString()})`;
    }
}

// 词法分析器：将字符串表达式解析成 Token 序列
function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
        const char = str[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (/[0-9]/.test(char)) {
            let numStr = '';
            while (i < str.length && /[0-9]/.test(str[i])) {
                numStr += str[i];
                i++;
            }
            tokens.push({ type: 'NUMBER', value: parseInt(numStr, 10) });
            continue;
        }
        if (['+', '-', '*', '/'].includes(char)) {
            tokens.push({ type: 'OPERATOR', value: char });
            i++;
            continue;
        }
        if (char === '(' || char === ')') {
            tokens.push({ type: 'PAREN', value: char });
            i++;
            continue;
        }
        throw new Error(`未知字符: ${char}`);
    }
    return tokens;
}

// Shunting-Yard 算法：Token 序列转逆波兰表示法 (RPN)
function shuntingYard(tokens) {
    const outputQueue = [];
    const operatorStack = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };

    for (const token of tokens) {
        if (token.type === 'NUMBER') {
            outputQueue.push(token);
        } else if (token.type === 'OPERATOR') {
            while (
                operatorStack.length > 0 &&
                operatorStack[operatorStack.length - 1].type === 'OPERATOR' &&
                precedence[operatorStack[operatorStack.length - 1].value] >= precedence[token.value]
            ) {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.push(token);
        } else if (token.type === 'PAREN' && token.value === '(') {
            operatorStack.push(token);
        } else if (token.type === 'PAREN' && token.value === ')') {
            let hasLeftParen = false;
            while (operatorStack.length > 0) {
                const top = operatorStack[operatorStack.length - 1];
                if (top.type === 'PAREN' && top.value === '(') {
                    hasLeftParen = true;
                    operatorStack.pop();
                    break;
                } else {
                    outputQueue.push(operatorStack.pop());
                }
            }
            if (!hasLeftParen) throw new Error('括号不匹配');
        }
    }

    while (operatorStack.length > 0) {
        const top = operatorStack.pop();
        if (top.type === 'PAREN') throw new Error('括号不匹配');
        outputQueue.push(top);
    }
    return outputQueue;
}

// 逆波兰表达式构建 AST
function buildAST(rpnTokens) {
    const stack = [];
    for (const token of rpnTokens) {
        if (token.type === 'NUMBER') {
            stack.push(new ASTNode('NUMBER', token.value));
        } else if (token.type === 'OPERATOR') {
            if (stack.length < 2) throw new Error('运算符位置错误');
            const right = stack.pop();
            const left = stack.pop();
            stack.push(new ASTNode('OPERATOR', token.value, left, right));
        }
    }
    if (stack.length !== 1) throw new Error('算式不完整');
    return stack[0];
}

// 逆波兰求值
function evaluateRPN(rpnTokens) {
    const stack = [];
    for (const token of rpnTokens) {
        if (token.type === 'NUMBER') {
            stack.push(token.value);
        } else if (token.type === 'OPERATOR') {
            if (stack.length < 2) throw new Error('运算符不完整');
            const b = stack.pop();
            const a = stack.pop();
            let res;
            if (token.value === '+') res = a + b;
            else if (token.value === '-') res = a - b;
            else if (token.value === '*') res = a * b;
            else if (token.value === '/') {
                if (Math.abs(b) < 1e-9) throw new Error('除数不能为零');
                res = a / b;
            }
            stack.push(res);
        }
    }
    if (stack.length !== 1) throw new Error('算式不完整');
    return stack[0];
}

// 暴露给外部的解析求值规范化一体函数
function parseEvaluateAndNormalize(exprStr) {
    const tokens = tokenize(exprStr);
    const rpn = shuntingYard(tokens);
    const value = evaluateRPN(rpn);
    const ast = buildAST(rpn);
    return {
        value: value,
        normalized: ast.toString(),
        numbersUsed: tokens.filter(t => t.type === 'NUMBER').map(t => t.value)
    };
}


// --------------------------------------------------------------------------
// 2. 24点暴力递归求解器 (生成提示与难度牌池)
// --------------------------------------------------------------------------

// 求解出给定4个数字的所有独立算式解
function solve24(numbers) {
    const solutions = new Set();
    const normalizedSolutions = new Set();

    // 内部递归求解
    // arr 存储形式为 { val: 浮点数值, expr: 表达式字符串, ast: ASTNode }
    function search(arr) {
        if (arr.length === 1) {
            if (Math.abs(arr[0].val - 24) < 1e-6) {
                const normStr = arr[0].ast.toString();
                if (!normalizedSolutions.has(normStr)) {
                    normalizedSolutions.add(normStr);
                    // 美化表达式：移除最外层没必要的括号
                    let prettyExpr = arr[0].expr;
                    if (prettyExpr.startsWith('(') && prettyExpr.endsWith(')')) {
                        // 验证去掉最外层括号后是否合法
                        const peeled = prettyExpr.substring(1, prettyExpr.length - 1);
                        try {
                            const parsed = parseEvaluateAndNormalize(peeled);
                            if (Math.abs(parsed.value - 24) < 1e-6) {
                                prettyExpr = peeled;
                            }
                        } catch(e) {}
                    }
                    solutions.add(prettyExpr);
                }
            }
            return;
        }

        for (let i = 0; i < arr.length; i++) {
            for (let j = 0; j < arr.length; j++) {
                if (i === j) continue;
                
                const a = arr[i];
                const b = arr[j];
                const nextArr = [];
                for (let k = 0; k < arr.length; k++) {
                    if (k !== i && k !== j) nextArr.push(arr[k]);
                }

                // 尝试六种运算组合
                // 1. a + b
                search([...nextArr, {
                    val: a.val + b.val,
                    expr: `(${a.expr} + ${b.expr})`,
                    ast: new ASTNode('OPERATOR', '+', a.ast, b.ast)
                }]);

                // 2. a - b
                search([...nextArr, {
                    val: a.val - b.val,
                    expr: `(${a.expr} - ${b.expr})`,
                    ast: new ASTNode('OPERATOR', '-', a.ast, b.ast)
                }]);

                // 3. a * b
                search([...nextArr, {
                    val: a.val * b.val,
                    expr: `(${a.expr} * ${b.expr})`,
                    ast: new ASTNode('OPERATOR', '*', a.ast, b.ast)
                }]);

                // 4. a / b (b不为0)
                if (Math.abs(b.val) > 1e-9) {
                    search([...nextArr, {
                        val: a.val / b.val,
                        expr: `(${a.expr} / ${b.expr})`,
                        ast: new ASTNode('OPERATOR', '/', a.ast, b.ast)
                    }]);
                }
            }
        }
    }

    // 初始化递归输入
    const initialArr = numbers.map(n => ({
        val: n,
        expr: String(n),
        ast: new ASTNode('NUMBER', n)
    }));

    search(initialArr);
    return Array.from(solutions);
}


// --------------------------------------------------------------------------
// 3. 游戏核心状态与持久化
// --------------------------------------------------------------------------

const GAME_STATE = {
    // 基础属性
    scoreTotal: 0,       // 累计总积分
    scoreToday: 0,       // 今日积分
    streak: 0,           // 连胜关卡数
    currentDifficulty: 'easy', // 难度：easy, medium, hard
    
    // 当前牌局属性
    currentNumbers: [],   // 当前发出的 4 张牌的值，如 [3, 8, 3, 8]
    currentCards: [],     // 当前发出的 4 张牌的花色和点数对象，如 [{val:3, suit:'H'}, ...]
    allSolutions: [],     // 本题所有解法文本（去重后）
    allNormalizedSolutions: new Set(), // 所有规范化解的集合
    foundSolutions: [],   // 玩家当前已找出的解法集合 (Normalized String 数组)
    foundSolutionTexts: [], // 玩家已找出的解法明文显示，如 ["8 / (3 - 8/3)"]
    
    // 计时器属性
    timerSeconds: 0,
    timerInterval: null,
    
    // 玩家当前构建表达式的 tokens，如 [{type:'NUMBER', val: 8, cardIndex: 0}, ...]
    exprTokens: [] 
};

// 扑克牌花色数据
const SUITS = [
    { name: 'hearts', char: '♥', colorClass: 'red' },
    { name: 'diamonds', char: '♦', colorClass: 'red' },
    { name: 'spades', char: '♠', colorClass: 'black' },
    { name: 'clubs', char: '♣', colorClass: 'black' }
];

// 保存游戏进度到本地
function saveGameProgress() {
    const todayStr = getTodayDateString();
    const data = {
        scoreTotal: GAME_STATE.scoreTotal,
        streak: GAME_STATE.streak,
        dailyScores: {}
    };

    // 从 localStorage 中恢复已有日期记录，防止被覆盖
    try {
        const raw = localStorage.getItem('math24_save');
        if (raw) {
            const parsed = JSON.parse(raw);
            data.dailyScores = parsed.dailyScores || {};
        }
    } catch(e) {
        console.error("加载旧存档失败，正在初始化新存档");
    }

    data.dailyScores[todayStr] = GAME_STATE.scoreToday;
    localStorage.setItem('math24_save', JSON.stringify(data));
}

// 从本地加载进度
function loadGameProgress() {
    try {
        const raw = localStorage.getItem('math24_save');
        if (raw) {
            const data = JSON.parse(raw);
            GAME_STATE.scoreTotal = data.scoreTotal || 0;
            GAME_STATE.streak = data.streak || 0;
            
            const todayStr = getTodayDateString();
            const daily = data.dailyScores || {};
            GAME_STATE.scoreToday = daily[todayStr] || 0;
        }
    } catch(e) {
        console.warn("未找到存档或解析失败，使用默认状态");
    }
}

// 获取今天日期字符串 (格式 YYYY-MM-DD)
function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// --------------------------------------------------------------------------
// 4. 发牌核心逻辑 (根据难度动态筛选)
// --------------------------------------------------------------------------

// 根据难度生成有解且符合解数要求的卡牌
function generateDeckForDifficulty(difficulty) {
    let maxNumber = 10;
    let minSolutions = 1;
    let maxSolutions = 999;

    if (difficulty === 'easy') {
        maxNumber = 10; // 初级使用 1-10
        minSolutions = 5; // 解法要很多，方便拼出
    } else if (difficulty === 'medium') {
        maxNumber = 13; // 中级使用 1-13 (包含 J,Q,K)
        minSolutions = 2;
        maxSolutions = 4;
    } else if (difficulty === 'hard') {
        maxNumber = 13; // 高级使用 1-13
        minSolutions = 1;
        maxSolutions = 1; // 仅有唯一解，或高难度解法
    }

    let attempts = 0;
    while (attempts < 2000) {
        attempts++;
        const testNums = [];
        for (let i = 0; i < 4; i++) {
            testNums.push(Math.floor(Math.random() * maxNumber) + 1);
        }

        const sols = solve24(testNums);
        if (sols.length >= minSolutions && sols.length <= maxSolutions) {
            // 如果是高级，额外排除可以直接靠简单连加/连乘过关的极为简单的题
            if (difficulty === 'hard') {
                // 如果唯一解里全是加法，重新发牌
                if (sols[0].indexOf('+') !== -1 && sols[0].indexOf('*') === -1 && sols[0].indexOf('/') === -1) {
                    continue;
                }
            }
            
            // 组装带花色的卡片数据
            const cardData = testNums.map(n => {
                const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
                return {
                    value: n,
                    suitChar: suit.char,
                    suitName: suit.name,
                    colorClass: suit.colorClass
                };
            });

            return {
                numbers: testNums,
                cards: cardData,
                solutions: sols
            };
        }
    }

    // 降级退路：如果实在死循环未生成，直接发一个经典有解牌
    return {
        numbers: [3, 3, 8, 8],
        cards: [
            { value: 3, suitChar: '♥', suitName: 'hearts', colorClass: 'red' },
            { value: 8, suitChar: '♠', suitName: 'spades', colorClass: 'black' },
            { value: 3, suitChar: '♦', suitName: 'diamonds', colorClass: 'red' },
            { value: 8, suitChar: '♣', suitName: 'clubs', colorClass: 'black' }
        ],
        solutions: ["8 / (3 - 8 / 3)"]
    };
}


// --------------------------------------------------------------------------
// 5. 视图渲染与 DOM 绑定
// --------------------------------------------------------------------------

// 扑克牌点数美化
function getCardDisplayLabel(val) {
    if (val === 1) return 'A';
    if (val === 11) return 'J';
    if (val === 12) return 'Q';
    if (val === 13) return 'K';
    return String(val);
}

// 渲染 4 张扑克牌
function renderCards(isNewRound = false) {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';

    GAME_STATE.currentCards.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = `poker-card ${card.colorClass}`;
        if (isNewRound) {
            cardEl.classList.add('deal-animate');
        }
        // 绑定索引，便于在算式输入中追踪是哪张卡片被点按了
        cardEl.dataset.index = index;
        cardEl.dataset.value = card.value;

        // 如果该卡片已被放入当前表达式，则置灰并禁止交互
        const isUsed = GAME_STATE.exprTokens.some(t => t.type === 'NUMBER' && t.cardIndex === index);
        if (isUsed) {
            cardEl.classList.add('disabled');
        }

        const label = getCardDisplayLabel(card.value);

        cardEl.innerHTML = `
            <div class="card-corner top-left">
                <span>${label}</span>
                <span class="card-suit-small">${card.suitChar}</span>
            </div>
            <div class="card-center">${card.suitChar}</div>
            <div class="card-corner bottom-right">
                <span>${label}</span>
                <span class="card-suit-small">${card.suitChar}</span>
            </div>
        `;

        // 触摸与点击事件绑定
        cardEl.addEventListener('click', () => handleCardClick(index, card.value));
        container.appendChild(cardEl);
    });
}

// 渲染表达式拼凑栏
function renderExpression() {
    const display = document.getElementById('expr-display');
    display.innerHTML = '';

    if (GAME_STATE.exprTokens.length === 0) {
        display.innerHTML = `<span class="expr-placeholder">点击数字或符号开始</span>`;
        updateFeedback("请构建算式等于 24", "normal");
        return;
    }

    GAME_STATE.exprTokens.forEach(token => {
        const span = document.createElement('span');
        if (token.type === 'NUMBER') {
            span.className = 'expr-token number';
            span.textContent = getCardDisplayLabel(token.displayVal); // 扑克牌字母形式，如 A、J
        } else if (token.type === 'OPERATOR') {
            span.className = 'expr-token operator';
            // 显示为漂亮易读的乘除号
            let opChar = token.val;
            if (opChar === '*') opChar = '×';
            if (opChar === '/') opChar = '÷';
            span.textContent = ` ${opChar} `;
        } else {
            span.className = 'expr-token paren';
            span.textContent = token.val;
        }
        display.appendChild(span);
    });

    // 自动滚动到表达式最右端
    display.scrollLeft = display.scrollWidth;

    // 尝试进行局部/实时求值并给予指导性反馈
    tryEvaluateExprRealtime();
}

// 渲染已提交成功解法列表
function renderSubmittedSolutions() {
    const section = document.getElementById('submitted-section');
    const list = document.getElementById('submitted-list');
    list.innerHTML = '';

    if (GAME_STATE.foundSolutionTexts.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    GAME_STATE.foundSolutionTexts.forEach(solText => {
        const pill = document.createElement('span');
        pill.className = 'solution-pill';
        pill.textContent = solText;
        list.appendChild(pill);
    });
}

// 更新状态仪表板
function updateStatsUI() {
    document.getElementById('score-today').textContent = GAME_STATE.scoreToday;
    document.getElementById('score-total').textContent = GAME_STATE.scoreTotal;
    document.getElementById('streak-val').textContent = GAME_STATE.streak;
    
    // 今日统计弹窗中的数据同步
    document.getElementById('stats-today-val').textContent = GAME_STATE.scoreToday;
    document.getElementById('stats-total-val').textContent = GAME_STATE.scoreTotal;

    // 题目解法进度更新
    const foundCnt = GAME_STATE.foundSolutions.length;
    const totalCnt = GAME_STATE.allSolutions.length;
    document.getElementById('found-solutions-count').textContent = foundCnt;
    document.getElementById('total-solutions-count').textContent = totalCnt;

    const percent = totalCnt > 0 ? (foundCnt / totalCnt) * 100 : 0;
    document.getElementById('solution-progress-bar').style.width = `${percent}%`;

    // 按钮文案微调：若找齐了解法则按钮显示“下一关”，否则显示“跳过本题”
    const dealBtnText = document.getElementById('deal-btn-text');
    if (foundCnt === totalCnt && totalCnt > 0) {
        dealBtnText.textContent = "下一关";
    } else {
        dealBtnText.textContent = "跳过本题";
    }

    // 难度分数徽章提示更新
    const badge = document.getElementById('difficulty-bonus');
    badge.className = `difficulty-badge badge-${GAME_STATE.currentDifficulty}`;
    let bonusText = "+10 / 额外 +5";
    if (GAME_STATE.currentDifficulty === 'medium') bonusText = "+20 / 额外 +10";
    if (GAME_STATE.currentDifficulty === 'hard') bonusText = "+30 / 额外 +15";
    badge.textContent = bonusText;
}

// 统一更新信息反馈栏
function updateFeedback(msg, type) {
    const bar = document.getElementById('feedback-msg');
    bar.textContent = msg;
    bar.className = 'feedback-bar';
    if (type === 'success') bar.classList.add('correct');
    if (type === 'error') bar.classList.add('error');
}


// --------------------------------------------------------------------------
// 6. 游戏交互处理与核心流程
// --------------------------------------------------------------------------

// 切换游戏难度
function handleDifficultyChange(diff) {
    if (GAME_STATE.currentDifficulty === diff) return;
    
    GAME_STATE.currentDifficulty = diff;
    
    // 更新 Tabs 样式
    document.querySelectorAll('.diff-tab').forEach(tab => {
        if (tab.dataset.diff === diff) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 切换难度清空连胜并重新发牌
    GAME_STATE.streak = 0;
    startNewRound();
}

// 点击卡片数字
function handleCardClick(cardIndex, value) {
    // 检查是否已经用了4个数字，如果是则无法添加
    const numCount = GAME_STATE.exprTokens.filter(t => t.type === 'NUMBER').length;
    if (numCount >= 4) {
        updateFeedback("4个数字已全部使用，请添加运算符或括号！", "error");
        return;
    }

    // 判断前一个 token 是不是也是数字（除非前一个是运算符或左括号，否则不能连续放数字）
    if (GAME_STATE.exprTokens.length > 0) {
        const lastToken = GAME_STATE.exprTokens[GAME_STATE.exprTokens.length - 1];
        if (lastToken.type === 'NUMBER' || lastToken.val === ')') {
            updateFeedback("数字之间需要有运算符隔开！", "error");
            return;
        }
    }

    // 推入 Token
    GAME_STATE.exprTokens.push({
        type: 'NUMBER',
        val: value,
        displayVal: value, // 保持原始点数用于扑克牌字母渲染
        cardIndex: cardIndex
    });

    renderCards();
    renderExpression();
}

// 点击符号键 (运算符或括号)
function handleKeyClick(type, val) {
    if (GAME_STATE.exprTokens.length === 0) {
        // 第一个键只能是数字或左括号
        if (val !== '(') {
            updateFeedback("算式不能以运算符开头！", "error");
            return;
        }
    } else {
        const lastToken = GAME_STATE.exprTokens[GAME_STATE.exprTokens.length - 1];
        
        // 限制连续运算符，如 "++"
        if (type === 'operator' && lastToken.type === 'OPERATOR') {
            updateFeedback("不能连续输入两个运算符！", "error");
            return;
        }
        // 左括号前不能直接是数字（除非有运算符）
        if (val === '(' && (lastToken.type === 'NUMBER' || lastToken.val === ')')) {
            updateFeedback("括号与数字之间需要运算符！", "error");
            return;
        }
        // 运算符前不能是左括号
        if (type === 'operator' && lastToken.val === '(') {
            updateFeedback("左括号后面不能紧跟运算符！", "error");
            return;
        }
    }

    GAME_STATE.exprTokens.push({
        type: type === 'operator' ? 'OPERATOR' : 'PAREN',
        val: val
    });

    renderExpression();
}

// 撤销单步
function handleUndo() {
    if (GAME_STATE.exprTokens.length === 0) return;
    GAME_STATE.exprTokens.pop();
    renderCards();
    renderExpression();
}

// 清空表达式
function handleClear() {
    GAME_STATE.exprTokens = [];
    renderCards();
    renderExpression();
}

// 实时表达式局部计算提示
function tryEvaluateExprRealtime() {
    // 构造表达式字符串
    const exprStr = GAME_STATE.exprTokens.map(t => t.val).join(' ');
    
    // 如果没有使用任何数字，不做计算提示
    const numCount = GAME_STATE.exprTokens.filter(t => t.type === 'NUMBER').length;
    if (numCount === 0) return;

    try {
        const parsed = parseEvaluateAndNormalize(exprStr);
        // 如果能够求出值（即使数字没用齐），也显示实时数值辅助玩家
        const roundedVal = Math.round(parsed.value * 100) / 100;
        updateFeedback(`当前运算值 = ${roundedVal}`, "normal");
    } catch(e) {
        // 中途表达式语法错误正常，不提示异常，只鼓励继续拼凑
        updateFeedback("正在构建算式...", "normal");
    }
}

// 验证玩家提交的 24 点表达式
function verifySolution() {
    if (GAME_STATE.exprTokens.length === 0) {
        updateFeedback("算式为空，请拼凑算式！", "error");
        return;
    }

    const exprStr = GAME_STATE.exprTokens.map(t => t.val).join(' ');

    try {
        const parsed = parseEvaluateAndNormalize(exprStr);
        
        // 1. 验证是否等于 24
        if (Math.abs(parsed.value - 24) > 1e-6) {
            updateFeedback(`计算结果是 ${Math.round(parsed.value * 100) / 100}，再试一次！`, "error");
            return;
        }

        // 2. 验证是否刚好使用了 4 个扑克牌数字各一次
        if (parsed.numbersUsed.length !== 4) {
            updateFeedback("您必须将 4 张牌全部用上！", "error");
            return;
        }

        // 比较使用的数字列表是否和发牌池一致
        const sortedUsed = [...parsed.numbersUsed].sort((a, b) => a - b);
        const sortedTarget = [...GAME_STATE.currentNumbers].sort((a, b) => a - b);
        let match = true;
        for (let i = 0; i < 4; i++) {
            if (sortedUsed[i] !== sortedTarget[i]) {
                match = false;
                break;
            }
        }

        if (!match) {
            updateFeedback("只能使用当前牌面上的 4 个数字！", "error");
            return;
        }

        // 3. 验证是否与已经拼出的解法重复 (基于 AST 的规范化表示去重)
        if (GAME_STATE.foundSolutions.includes(parsed.normalized)) {
            updateFeedback("这个解法你已经拼出来过啦，找个新花样吧！", "error");
            return;
        }

        // 4. 判定解法属于系统可行解集（防止玩家算对但系统没收录的极低可能情况，双向备份）
        // 事实上我们的 solve24 跑全排列理论上一定包含所有正确解，这里做规范化收录
        GAME_STATE.foundSolutions.push(parsed.normalized);
        
        // 重新美化玩家的算式放入显示列表中
        let formattedSol = exprStr;
        formattedSol = formattedSol.replace(/\*/g, '×').replace(/\//g, '÷');
        GAME_STATE.foundSolutionTexts.push(formattedSol);

        // 5. 积分与连胜逻辑计算
        let baseScore = 10;
        let extraScore = 5;
        if (GAME_STATE.currentDifficulty === 'medium') {
            baseScore = 20;
            extraScore = 10;
        } else if (GAME_STATE.currentDifficulty === 'hard') {
            baseScore = 30;
            extraScore = 15;
        }

        let ptsEarned = 0;
        if (GAME_STATE.foundSolutions.length === 1) {
            // 本题首个正确答案
            ptsEarned = baseScore;
            GAME_STATE.streak++;
            updateFeedback(`恭喜！首答正确，积分 +${ptsEarned}！`, "success");
            triggerCelebration();
        } else {
            // 本题额外正确答案
            ptsEarned = extraScore;
            updateFeedback(`厉害！解锁额外解法，积分 +${ptsEarned}！`, "success");
            triggerCelebration();
        }

        GAME_STATE.scoreToday += ptsEarned;
        GAME_STATE.scoreTotal += ptsEarned;

        // 保存进度
        saveGameProgress();

        // 按钮特效反馈
        const checkBtn = document.getElementById('btn-check');
        checkBtn.classList.add('correct-pulse');
        setTimeout(() => checkBtn.classList.remove('correct-pulse'), 500);

        // 重绘界面与进度
        renderSubmittedSolutions();
        updateStatsUI();
        handleClear(); // 自动清空以便玩家输入下一个解法

    } catch (err) {
        updateFeedback(`算式不合法: ${err.message}`, "error");
    }
}

// 开始全新一局发牌
function startNewRound() {
    // 停止并充值计时器
    clearInterval(GAME_STATE.timerInterval);
    GAME_STATE.timerSeconds = 0;
    document.getElementById('timer-val').textContent = "00:00";
    
    // 生成有解局
    const deck = generateDeckForDifficulty(GAME_STATE.currentDifficulty);
    GAME_STATE.currentNumbers = deck.numbers;
    GAME_STATE.currentCards = deck.cards;
    GAME_STATE.allSolutions = deck.solutions;
    
    // 清理本题临时记录
    GAME_STATE.foundSolutions = [];
    GAME_STATE.foundSolutionTexts = [];
    GAME_STATE.exprTokens = [];

    // 重绘与更新仪表板
    renderCards(true);
    renderExpression();
    renderSubmittedSolutions();
    updateStatsUI();

    // 重启计时器
    startTimer();
}


// --------------------------------------------------------------------------
// 7. 辅助功能 (计时器、弹窗、通关彩花)
// --------------------------------------------------------------------------

// 开启今日时间计时
function startTimer() {
    GAME_STATE.timerInterval = setInterval(() => {
        GAME_STATE.timerSeconds++;
        const mins = String(Math.floor(GAME_STATE.timerSeconds / 60)).padStart(2, '0');
        const secs = String(GAME_STATE.timerSeconds % 60).padStart(2, '0');
        document.getElementById('timer-val').textContent = `${mins}:${secs}`;
    }, 1000);
}

// 弹出提示框
function showHint() {
    const hintModal = document.getElementById('modal-hint');
    const solutionText = document.getElementById('solution-text');
    
    if (GAME_STATE.allSolutions.length > 0) {
        // 从可行解集中挑选玩家目前还没提交过的那一个进行提示
        // 我们可以将所有可行解重新解析一下求出规范化形式，跟已找出形式对比
        let showText = GAME_STATE.allSolutions[0];
        
        for (const sol of GAME_STATE.allSolutions) {
            try {
                const parsed = parseEvaluateAndNormalize(sol);
                if (!GAME_STATE.foundSolutions.includes(parsed.normalized)) {
                    showText = sol;
                    break;
                }
            } catch(e) {}
        }
        
        // 转换成漂亮的乘除法显示
        showText = showText.replace(/\*/g, '×').replace(/\//g, '÷');
        solutionText.textContent = showText;
    } else {
        solutionText.textContent = "无解";
    }

    hintModal.classList.add('active');
}

// 关闭提示框
function closeHint() {
    document.getElementById('modal-hint').classList.remove('active');
}

// 打开或关闭规则介绍弹窗
function toggleRules(show) {
    const rulesModal = document.getElementById('modal-rules');
    if (show) {
        rulesModal.classList.add('active');
    } else {
        rulesModal.classList.remove('active');
    }
}

// 打开或展示每日统计数据弹窗
function toggleStatsModal(show) {
    const statsModal = document.getElementById('modal-stats');
    if (show) {
        // 动态加载历史日期数据
        renderHistoryList();
        statsModal.classList.add('active');
    } else {
        statsModal.classList.remove('active');
    }
}

// 渲染历史积分列表
function renderHistoryList() {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '';

    try {
        const raw = localStorage.getItem('math24_save');
        if (raw) {
            const data = JSON.parse(raw);
            const daily = data.dailyScores || {};
            const dates = Object.keys(daily).sort((a, b) => new Date(b) - new Date(a)); // 按日期降序

            if (dates.length > 0) {
                dates.forEach(date => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <span class="history-date">${date}</span>
                        <span class="history-score">+${daily[date]} 分</span>
                    `;
                    listEl.appendChild(item);
                });
                return;
            }
        }
    } catch(e) {
        console.error("加载历史记录失败", e);
    }

    listEl.innerHTML = `<div class="history-empty">暂无历史记录，快去完成一题吧！</div>`;
}

// Canvas 通关撒彩花粒子特效
let confettiParticles = [];
let confettiCtx = null;
let animationFrameId = null;

function triggerCelebration() {
    const canvas = document.getElementById('celebration-canvas');
    confettiCtx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    
    // 生成粒子，集中从屏幕中心偏下爆发
    for (let i = 0; i < 100; i++) {
        confettiParticles.push({
            x: canvas.width / 2,
            y: canvas.height * 0.7,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.7) * 20 - 5,
            size: Math.random() * 8 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1
        });
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    updateConfetti();
}

function updateConfetti() {
    const canvas = document.getElementById('celebration-canvas');
    if (!confettiCtx || !canvas) return;

    confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    confettiParticles.forEach(p => {
        if (p.opacity <= 0) return;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // 重力加速度
        p.vx *= 0.98; // 空气阻力
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.015;

        if (p.opacity > 0) {
            active = true;
            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.fillStyle = p.color;
            confettiCtx.globalAlpha = p.opacity;
            // 绘制方形碎纸屑
            confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            confettiCtx.restore();
        }
    });

    if (active) {
        animationFrameId = requestAnimationFrame(updateConfetti);
    } else {
        confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
}


// --------------------------------------------------------------------------
// 8. 主题切换控制
// --------------------------------------------------------------------------

function initTheme() {
    const savedTheme = localStorage.getItem('math24_theme') || 'dark';
    document.body.classList.remove('light-theme', 'eye-care-theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else if (savedTheme === 'eye-care') {
        document.body.classList.add('eye-care-theme');
    }
}

function toggleTheme() {
    let currentTheme = 'dark';
    if (document.body.classList.contains('light-theme')) {
        currentTheme = 'light';
    } else if (document.body.classList.contains('eye-care-theme')) {
        currentTheme = 'eye-care';
    }

    let nextTheme;
    if (currentTheme === 'dark') {
        nextTheme = 'light';
    } else if (currentTheme === 'light') {
        nextTheme = 'eye-care';
    } else {
        nextTheme = 'dark';
    }

    document.body.classList.remove('light-theme', 'eye-care-theme');
    if (nextTheme === 'light') {
        document.body.classList.add('light-theme');
    } else if (nextTheme === 'eye-care') {
        document.body.classList.add('eye-care-theme');
    }

    localStorage.setItem('math24_theme', nextTheme);
}

// --------------------------------------------------------------------------
// 9. 初始化入口
// --------------------------------------------------------------------------

function initGame() {
    // 0. 加载并应用主题
    initTheme();

    // 1. 加载持久化数据
    loadGameProgress();

    // 2. 绑定控制按键
    document.querySelectorAll('.btn-key').forEach(btn => {
        btn.addEventListener('click', () => {
            handleKeyClick(btn.dataset.type, btn.dataset.val);
        });
    });

    // 3. 切换难度 Tab
    document.querySelectorAll('.diff-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            handleDifficultyChange(tab.dataset.diff);
        });
    });

    // 4. 控制台按钮事件
    document.getElementById('btn-undo').addEventListener('click', handleUndo);
    document.getElementById('btn-clear').addEventListener('click', handleClear);
    document.getElementById('btn-check').addEventListener('click', verifySolution);
    document.getElementById('btn-deal').addEventListener('click', startNewRound);
    
    // 5. 提示弹窗事件
    document.getElementById('btn-hint').addEventListener('click', showHint);
    document.getElementById('btn-hint-close').addEventListener('click', closeHint);
    
    // 6. 规则弹窗事件
    document.getElementById('btn-rules').addEventListener('click', () => toggleRules(true));
    document.getElementById('btn-rules-close').addEventListener('click', () => toggleRules(false));
    
    // 7. 统计弹窗事件
    document.getElementById('btn-stats').addEventListener('click', () => toggleStatsModal(true));
    document.getElementById('btn-stats-close').addEventListener('click', () => toggleStatsModal(false));

    // 7.5 绑定主题切换按钮
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

    // 8. 窗口尺寸调整自适应 Canvas 像素大小
    window.addEventListener('resize', () => {
        const canvas = document.getElementById('celebration-canvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

    // 9. 开启全新一关游戏并引导
    startNewRound();
    
    // 如果是第一次游玩，自动展示规则介绍
    if (GAME_STATE.scoreTotal === 0) {
        toggleRules(true);
    }
}

// 监听 DOMContentLoaded 载入逻辑
document.addEventListener('DOMContentLoaded', initGame);
