// public/js/tutorials.js
// Game tutorial system — shows rules overlay for each game
(function() {
  var TUTORIALS_ZH = {
    tictactoe: {
      sections: [
        { h: '游戏目标', p: '在 3×3 的网格中，先把自己的三个棋子连成一线（横、竖、两条对角线共 8 种）即获胜。' },
        { h: '回合流程', p: '两名玩家轮流在空格落子，座位 1 先手（⨉），座位 2 后手（○）。落子后不能撤回或移动，已被占用的格子不能再下。' },
        { h: '胜负与平局', p: '任意一方落子后立刻检查是否成线，成线即胜。九格全部填满仍无人成线则为平局。' },
        { h: '房间设置', p: '没有额外规则选项，仅支持 2 人，可添加机器人对战。' },
        { h: '操作与提示', p: '点击空格即可落子。先手占中心或角最有利；对方占中心时，后手应抢角落。每一步都先看对方是否已有两子成线，需要先堵住。' },
      ]
    },
    gomoku: {
      sections: [
        { h: '游戏目标', p: '在 15×15 的棋盘上，先让自己的棋子在横、竖、斜任一方向连成五颗或更多即获胜。' },
        { h: '回合流程', p: '黑棋（座位 1）先手，双方轮流在空交叉点落子。落子后不能移动或悔棋，没有吃子。' },
        { h: '胜负判定', p: '本游戏无禁手：长连（六子及以上）、双三、双四、四三都不受限制，只要落子后某一方向连续至少 5 子就立刻获胜。棋盘 225 格全部下满仍无五连则为平局。' },
        { h: '连珠术语', p: '活三：再走一步可成活四的三子。活四：两端都空，对方无法同时堵住，必胜。冲四：只剩一端可成五，对方必须马上堵。' },
        { h: '比赛设置', p: '房间可设置 1/3/5 局制。多局时每局结束后双方交换座位，所以先后手交替；全局以胜局数决定。' },
        { h: '操作与提示', p: '点击棋盘交叉点落子。由于无禁手，先手优势较大，后手要优先堵对方的活三和冲四；先手可尝试制造「四三」或「双活三」让对手顾此失彼。' },
      ]
    },
    sudoku: {
      sections: [
        { h: '游戏目标', p: '所有玩家面对同一道数独题，比拼谁先把所有空格填对。这是同时进行的竞速，没有回合。支持 1 到 4 人，可加机器人。' },
        { h: '数独规则', p: '9×9 的盘面，每一行、每一列、每个 3×3 宫都要填入 1 到 9 且不重复。题目给出的初始数字不可修改，每道题有唯一解。' },
        { h: '填数与生命', p: '点击空格选中，再选择数字 1-9。填对计入你的进度；与唯一解不符就算填错，扣一条命。每人共 3 条命，用完即被淘汰，且淘汰后不能再操作。已填对的格子不会再被改。' },
        { h: '提示', p: '每局每人最多 3 次提示。提示会随机揭示你的一个尚未填的空格并计入进度，不扣命，用完后无法再使用。' },
        { h: '胜负判定', p: '最先填满所有空格的玩家获胜。若除一人外其他人都被淘汰，剩下的玩家直接获胜，不必填完。所有玩家同时被淘汰则为平局。' },
        { h: '策略提示', p: '你的盘面只有自己能看到，对手看不到。先找出出现次数最多的数字，再找某行/列/宫只剩一格的位置。没有把握时不要硬猜，错三次就出局；确实卡住时用提示。' },
      ]
    },
    '2048': {
      sections: [
        { h: '游戏目标', p: '每位玩家各有一块独立的 4×4 棋盘，起点相同（共享同样的 2 个初始方块），比拼谁先合成 2048 方块。支持 1 到 4 人，可加机器人。' },
        { h: '玩法', p: '向上、下、左、右滑动（键盘方向键或屏幕滑动），所有方块一起朝该方向移动，相邻且数字相同的两个方块合并为和，合并得到的数字计入分数。每个方块每次滑动最多合并一次。' },
        { h: '生成新方块', p: '只有「有方块真正移动或合并」的滑动才算有效；无变化的滑动会被拒绝。每次有效滑动后，在随机空格生成一个新方块：90% 是 2，10% 是 4。' },
        { h: '胜负判定', p: '最先合成 2048（或更大）方块的玩家立刻获胜，比赛结束。你看不到对手的棋盘，只能看到最高分。' },
        { h: '无法移动', p: '当棋盘没有空格且没有相邻相同方块，你就被锁定，不能再操作。所有玩家都被锁定且无人合成 2048 时，总分最高者获胜，最高分并列则平局。单人游玩时，锁定但未合成 2048 即算失败。' },
        { h: '策略提示', p: '把最大的方块固定在一个角落，以两个方向（如左和下）操作为主，尽量少用相反方向。保持一整行大小递减，方便连续合并。别为了小分数把棋盘塞满。' },
      ]
    },
    davinci: {
      sections: [
        { h: '游戏目标', p: '2–3 人局每人开局 4 张牌，4 人局每人 3 张。猜出对手牌上的数字，把它翻开；一名玩家所有牌的数字都被翻开（被猜中或罚翻）即被淘汰，最后存活的玩家获胜。' },
        { h: '牌组', p: '26张牌：黑色 0-11、白色 0-11，外加 2 张万能牌（★）。万能牌可放在任意位置。' },
        { h: '排序规则', p: '数字从小到大排列，相同数字黑色在左、白色在右。万能牌停留在你放置的位置，不会被自动排序移动。' },
        { h: '公开信息', p: '所有牌的颜色（黑/白）对所有人公开，只有数字是隐藏的。你需要猜对手牌的数字。' },
        { h: '回合流程', p: '①抽牌：从牌堆抽一张牌（只有自己能看）。②猜牌：点击对手的一张暗牌，选择数字猜测，或按"猜★"猜万能牌。③猜对：该牌翻开，可继续猜，或按"过"结束回合。④猜错：抽到的牌面朝下插入你的牌列，然后你必须翻开自己的一张暗牌。⑤过：不猜，将抽到的牌面朝下插入自己的牌列，轮到下家；猜对后结束回合同样如此。' },
        { h: '惩罚阶段', p: '猜错后需翻开自己一张未翻的牌。点击自己的暗牌选择翻开哪张。翻开后轮到下家。' },
        { h: '万能牌', p: '抽到万能牌时（包括开局抽到的第一张），需要自己选择把它插在牌列的哪个位置。放好之后整局都不会再移动。猜万能牌时按"猜★"按钮。' },
      ]
    },
    uno: {
      sections: [
        { h: '目标', p: 'UNO 支持 2-6 人，每人 7 张牌，最先出完手牌的人获胜。牌堆是标准 108 张：数字牌 0-9，每色的跳过、反转、+2，以及万能牌和 +4 万能牌各 4 张。' },
        { h: '出牌规则', p: '开局翻开的第一张牌不会是万能牌，也不触发效果，0 号玩家先出。出牌需要与弃牌堆顶的牌同数字、同符号或同颜色，万能牌随时可以打出，并指定新的颜色。' },
        { h: '抽牌', p: '只有手中没有任何可出的牌时才能抽牌，否则提示「有可出的牌」。抽 1 张后回合结束，抽到的牌不能立刻打出。' },
        { h: '功能牌', p: '跳过：下一位玩家被跳过。反转：改变出牌方向，两人时相当于跳过。+2：给下家累加 2 张罚抽，可以叠加；有叠加时，只能出 +2 或 +4 接上，否则必须抽走全部累计的牌。' },
        { h: '+4 与质疑', p: '打出 +4 后，目标玩家要选择：接受（抽 4 张并被跳过）或质疑。质疑时看出牌者打出 +4 之前，手里是否还有与当时颜色相同的牌。有，质疑成功，出牌者抽 4 张，质疑者接着出牌；没有，质疑失败，质疑者抽 6 张并被跳过。' },
        { h: '喊 UNO', p: '你在手牌剩两张、准备打出倒数第二张后只剩一张时，必须在自己的回合里点击「UNO」。如果最后一张牌打出时尚未喊 UNO，立即判负，下一位玩家获胜。' },
        { h: '牌堆耗尽', p: '抽牌堆用完时，弃牌堆（保留最上面的一张）会重新洗牌作为抽牌堆。' },
        { h: '提示', p: '尽量留着万能牌用于收尾。观察对手的颜色偏好，换到对方缺少的颜色。手牌只剩 2 张时别忘了提前喊 UNO。' },
      ]
    },
    doudizhu: {
      sections: [
        { h: '游戏目标', p: '地主需先出完所有牌，农民方任意一人先出完则农民胜。' },
        { h: '发牌', p: '每人17张，底牌3张。确定地主后，地主获得底牌。' },
        { h: '叫地主', p: '房主可选两种方式，默认「叫抢」：轮流选择叫地主或不叫，有人叫后，没放弃叫牌的其他人可依次选择抢，最后叫或抢的人成为地主（叫地主 ×3，每抢一次再 ×2）。「叫分」：轮流叫 0–3 分，叫 3 分立刻成为地主，否则最高分者当地主。无人叫则重新发牌。' },
        { h: '牌型', p: '单张、对子、三条、三带一、三带二、顺子（≥5张连续）、连对（≥3对连续）、飞机（连续三条，可各带一张单牌或各带一对）、四带二（四张带两张单牌或两对）、炸弹（四张相同）、火箭（大王+小王）。顺子、连对、飞机都不能包含 2 和王。' },
        { h: '出牌规则', p: '地主先出，可出任意牌型。后面的人必须出相同牌型、相同张数且更大的牌（或炸弹/火箭），也可以选择「过」；连续两人过牌后，最后出牌的人重新自由出牌。房主可设每手限时（10/20/60/300 秒），跟牌时超时会自动「过」。' },
        { h: '大小', p: '火箭 > 炸弹 > 普通牌。普通牌按 3<4<5<6<7<8<9<10<J<Q<K<A<2<小王<大王。' },
        { h: '计分与局数', p: '每局基础 100 分：地主赢则地主 +200、两名农民各 −100，农民赢则相反。「叫抢」模式中叫地主 ×3、每次抢再 ×2；每打出一个炸弹或火箭，分数再 ×2。房主可选 3/6/9/12 局，积分累计；进入最后一局前，全员同意可再加 3 局。' },
      ]
    },
    'exploding-kittens': {
      sections: [
        { h: '目标', p: '爆炸猫是 2-6 人的淘汰游戏：抽到爆炸猫又没有拆除牌就出局，最后活下来的人获胜。本版本没有「拒绝」牌，也没有组合猫牌。' },
        { h: '牌堆与发牌', p: '牌堆包含爆炸猫 6 张、拆除 4 张，以及攻击、跳过、洗牌、偷牌、索取各 4 张、预知 5 张，人数越多这些功能牌按 ceil(人数/2) 倍增加。每人先发 4 张牌，再各补 1 张拆除。人数 - 1 张爆炸猫放入牌堆，剩余的拆除牌也洗进牌堆。5-6 人时有人没有拆除牌。' },
        { h: '回合流程', p: '你的回合可以先打出任意张功能牌，然后必须抽一张牌结束回合。点「抽牌」直接结束出牌阶段并抽牌。' },
        { h: '功能牌', p: '跳过：结束本回合且不抽牌；若你欠着额外回合，只消耗其中一个。攻击：结束回合不抽牌，指定一名玩家（不指定默认下家），该玩家要多打一个回合，多次攻击会叠加。预知：偷看牌堆顶 3 张，只有你自己能看到。洗牌：打乱牌堆。偷牌与索取：效果相同，从你指定的活着的玩家手中随机抽走一张牌，之后直接进入抽牌阶段，不能再出牌。' },
        { h: '爆炸与拆除', p: '抽到爆炸猫时，若手中有拆除牌则自动使用，你选择把爆炸猫放回牌堆的位置，0 为最底部，最大值为最顶部，不选则随机放置。没有拆除牌就淘汰，手牌弃掉。单独打出拆除牌没有任何效果。' },
        { h: '胜负', p: '场上只剩一名玩家时，该玩家获胜。牌堆被抽空时会提示牌堆为空。' },
        { h: '提示', p: '用预知牌判断下一张是否爆炸，再决定抽牌还是跳过或攻击。拆除牌留给自己，不要浪费。人数多时留意谁手里有拆除，可以用偷牌削弱对手。' },
      ]
    },
    rummikub: {
      sections: [
        { h: '游戏目标', p: '最先出完手中所有牌。出完时喊一声"拉密！"。' },
        { h: '牌组', p: '106张牌：4种颜色（黑蓝红橙）× 数字1-13 各2张 + 2张百搭牌（★）。每人发14张。' },
        { h: '合法牌组', p: '①顺组：同颜色、连续数字，至少3张（如 🔴3-4-5）。②群组：不同颜色、相同数字，至少3张（如 🔴7-🔵7-🟠7）。' },
        { h: '破冰规则', p: '首次出牌的手牌点数需 ≥ 30（百搭牌按 30 分计）：直接出牌时，第一组牌自己就要 ≥ 30 分；通过「重组牌桌」出牌时，用掉的所有手牌合计 ≥ 30 分即可。破冰后才能接牌或重组。可在设置中关闭此规则。' },
        { h: '破冰后', p: '每回合可出任意多张牌：①打出新的顺组或群组。②在桌面已有牌组上接牌。③点"🔀重组牌桌"进入操作台拿桌面牌重组。无法出牌时摸1张并结束回合。' },
        { h: '重组牌桌', p: '操作台里桌面所有牌组+你的手牌会分格摊开。点牌选中→点目标牌组放入，可拆开、合并、新建牌组，自由拿用桌面上的牌。要求：①每个牌组都合法（绿框）②至少用掉1张自己的手牌③桌面原有的牌不能丢。完成点"提交"，不满意点"取消"还原。' },
        { h: '百搭牌', p: '可代替任意牌使用。破冰计分和僵局结算时，每张百搭牌按 30 分计。' },
        { h: '牌堆摸完', p: '牌堆摸空后，如果所有人轮流都无法出牌（只能过），本局结束：手牌点数合计最少的人获胜（数字牌按数字计，百搭按 30 分），点数相同则平局。' },
      ]
    },
    twentyfour: {
      sections: [
        { h: '目标', p: '每轮给出 4 张 1～13 的牌，用 + − × ÷ 和括号把四个数字各用一次，算出 24。每轮题目一定有解。' },
        { h: '写算式', p: '用屏幕按钮输入数字、运算符与括号，也有撤销和清空。必须恰好使用这四个数字各一次，「12」是整数十二，不会被当作 1 和 2。中间结果可以是分数，结果与 24 的误差在 0.0001 内即算对。答错会显示你算出的结果，次数不限。' },
        { h: '不限时模式', p: '默认每轮不限时：第一个提交正确答案的人直接赢下这一轮。' },
        { h: '限时模式', p: '房主可设置每轮 30/60/90/120 秒。限时模式下答对后只是记录，不再允许重复提交；时间到后，提交时间最早的正确者赢下这一轮；若没人答对，本轮无人得分。' },
        { h: '轮数与胜负', p: '房主可选 3/5/7/10 轮（默认 5 轮）。每轮结束后点「下一轮」继续，最后一轮后点击会进入总结，赢下轮数最多的玩家获胜，并列时取座位靠前者。' },
        { h: '提示按钮', p: '卡住时可以点「提示」，提示分多步逐步给出思路，每次点击之间有冷却，用完后不能再提示。' },
        { h: '房间设置', p: '每轮时间与总轮数仅房主可改。1～99 人可开局，电脑玩家会同时抢答。' },
      ]
    },
    minesweeper: {
      sections: [
        { h: '目标', p: '所有人面对同一张 10×10 的雷区，共 15 颗雷、85 个安全格。谁先翻开全部 85 个安全格谁赢；也可以靠对手踩雷获胜。' },
        { h: '同时进行', p: '没有回合，大家同时操作，每人有自己独立的棋盘，互相看得到进度但互不影响。雷的位置对所有人相同，别人踩到的雷你也可以参考。' },
        { h: '翻格与数字', p: '翻开一格会显示周围 8 格的雷数。数字为 0 的格子会自动向四周连锁展开。整局第一次翻格（不论是谁）一定不是雷，若本来是雷会被挪到别处。注意：只保护全局第一下，之后每个人的第一下仍可能踩雷。' },
        { h: '插旗', p: '对可疑的格子插旗做标记，再点一次取消。旗子数量不限，只是个人记号，不会判断对错；插了旗的格子不能翻开，要先取消旗。已翻开的格子不能插旗。' },
        { h: '淘汰与胜负', p: '踩到雷的人立即出局，棋盘保留供旁观。只剩 1 名存活者时，该玩家立即获胜；所有人同时出局则平局；单人游玩时踩雷即失败。第一个翻完 85 个安全格的人立刻获胜，游戏结束。' },
        { h: '操作', p: '电脑上左键翻开、右键插旗；手机上轻点翻开，长按约 0.5 秒插旗。1 人也可以开局，当作单人扫雷练习。' },
        { h: '提示', p: '速度和稳妥要平衡：多人时稳健的人可以等对手踩雷，但对手也可能抢先翻完。先找数字 1 的孤立角落，用旗标出确定的雷，再用数字互相推理。' },
      ]
    },
    numberbomb: {
      sections: [
        { h: '目标', p: '系统在 1～100 中随机藏了一个「炸弹数字」，大家轮流猜，猜中的人要扣 1 条命。每人 3 条命，最后还有命的人获胜。' },
        { h: '猜数', p: '轮到你时输入一个整数，必须在当前范围内。猜大了，范围上限变成「你猜的数-1」；猜小了，范围下限变成「你猜的数+1」。范围会越来越窄。' },
        { h: '踩雷', p: '猜中炸弹数字就失去 1 条命。如果场上还有不止一人活着，会重新随机藏一个炸弹，范围重置为 1～100，轮数加一。踩雷的人先开始下一轮，若他已出局则交给下一位存活者。' },
        { h: '被迫踩雷', p: '当范围只剩一个数字时，下一位玩家只能猜这个数字，必定踩雷。所以把范围缩到只剩 2 个数时要特别小心。' },
        { h: '胜负', p: '轮到你时没有时间限制，已淘汰的玩家会被跳过。场上不超过 1 人还有命时游戏结束，最后存活者获胜。单人游玩时第一次踩雷就结束。' },
        { h: '操作', p: '用屏幕数字键盘（0-9、退格、「猜！」按钮），或直接用键盘输入并按回车，最多 3 位。下方记录最近 10 条事件。支持 1～10 人。' },
        { h: '提示', p: '尽量把范围缩到让下家难以回避的状态：让对方面对 2 个数字的范围，或者自己避免成为那个人。' },
      ]
    },
    oldmaid: {
      sections: [
        { h: '目标', p: '不要成为最后拿着鬼牌的人。使用 52 张牌加 1 张鬼牌（共 53 张）轮流发给 2～6 人，所以每人手牌数可能相差 1 张。' },
        { h: '配对弃牌', p: '开局和每次摸牌后，手上点数相同的两张会自动成对弃掉；鬼牌不能配对。手牌是对其他人隐藏的。' },
        { h: '摸牌', p: '座位 1 先开始。轮到你时，从下一位还有手牌的玩家那里盲抽一张：先点选要抽谁，再点其中一张背面的牌。若抽到的牌能与你手中的牌配对，会自动弃掉。' },
        { h: '跳过', p: '手牌打光的玩家直接跳过，不再参与抽牌。' },
        { h: '胜负', p: '当只剩一名玩家手里还有牌时游戏结束，他手里的就是鬼牌，他输了，其余所有人都算赢。没有计时限制。' },
        { h: '技巧', p: '抽牌时可以观察对方抽牌的犹豫表情；手里有鬼牌时尽量让别人觉得它是别的牌。位置并无规律，运气成分较大，轻松玩就好。' },
      ]
    },
    liarsbar: {
      sections: [
        { h: '游戏目标', p: '出牌面朝下声称牌面，可以说谎也可以说真话。活到最后即是赢家！' },
        { h: '牌堆', p: 'J、Q、K（每花色各 2 张 = 24 张）+ 万能牌★（4 张）+ 鬼牌👻（1 张）。万能牌永远是"真话"，鬼牌被质疑时除出牌者外所有人开枪。' },
        { h: '回合流程', p: '①系统抽一张主题牌（J/Q/K 之一）。②每人发 5 张手牌，轮流面朝下出 1–3 张牌，并声称它们都是该主题牌。③下家可以接着出牌，或质疑上家刚出的那一手。④质疑后翻开上家那一手：只要有一张不是主题牌（万能牌除外）就算撒谎，撒谎者开枪；全是真的，则质疑者开枪。然后重新洗牌发牌开始新一圈。没牌的人会被跳过；如果其他人都没牌了，轮到的人只能质疑。' },
        { h: '俄罗斯转盘', p: '每人一把 6 发弹仓的左轮手枪，只有 1 发子弹，位置在 1–6 中独立随机（不同人的位置可能相同）。轮到开枪时扣一次扳机：弹仓每次开火前进一格，第 N 枪恰好是子弹位置即阵亡，否则安全。弹仓不会重新装填，进度保留到游戏结束，所以越往后越危险。' },
        { h: '万能牌★', p: '万能牌可当作任何牌。如果被质疑的那一手里只有主题牌和万能牌，质疑者自己开枪。' },
        { h: '鬼牌👻', p: '打出鬼牌并声称是主题牌，如果被质疑 → 出牌者之外的所有人都要开一枪！俗称"一网打尽"。' },
        { h: '胜负', p: '最后存活的玩家获胜。' },
        { h: '策略', p: '手牌中有主题牌就说真话。没有主题牌就得说谎。万能牌是安全牌。鬼牌尽量藏着，等弹仓接近装满时用最狠。对方弹仓快满时积极质疑逼他开枪！' },
      ]
    },
    bigtwo: {
      sections: [
        { h: '目标', p: '大老二是 2-4 人的爬牌游戏：最先把手牌出完的人获胜。其他人按手中剩余牌数记分，牌越少越好。每局只打一手，没有多局累计。' },
        { h: '发牌与先手', p: '使用 52 张牌（无王）。按人数平分，每人 floor(52/人数) 张，3 人时每人 17 张余 1 张，余牌依次发给前面的座位。持有方块 3 的玩家先出牌，并且第一手必须包含方块 3，否则提示「首出必须含方块3」。' },
        { h: '大小顺序', p: '点数从小到大：3 4 5 6 7 8 9 10 J Q K A 2，2 最大，3 最小。花色从大到小：黑桃 > 红桃 > 梅花 > 方块。点数相同的牌比花色。' },
        { h: '可出的牌型', p: '单张；对子（两张同点数，比较两张中较大的花色）；三条（三张同点数）；顺子（5 张及以上连续点数，最多 13 张，2 可以放在最高位，3 最小，没有 A-2-3 回环，比较最小的一张，起点相同的顺子不能互压）；同花（5 张同花色但不连续，比最大一张，再比花色）；葫芦（三条加一对，比三条的点数）；四条带一（四张同点数加任意一张，比四条的点数）；同花顺（5 张连续同花色，比最小一张，再比花色）。' },
        { h: '出牌与压牌', p: '下家必须出与上一手相同牌型、相同张数的牌，并且更大。注意：五张牌型之间不分高低，同花顺只能压同花顺，葫芦只能压葫芦，四条带一只能压四条带一，以此类推。' },
        { h: '过牌与新一轮', p: '有人领出牌时不能过牌，只有跟牌时才能「过」。你自己打出的牌没有人跟时也不能过。当其余所有人都连续过牌后，最后出牌的人重新自由领出，可以出任何合法牌型。' },
        { h: '胜负与计分', p: '第一个出完手牌的玩家获胜，游戏立刻结束。其他玩家的得分等于手中剩余牌数，数字越小越好，赢家为 0。' },
        { h: '提示', p: '先把小牌和零散牌走掉，留着 2 和 A 控制出牌权。顺子可以一次走掉很多牌。对手手牌快打完时，要优先打出对方难以压住的大牌型。' },
      ]
    },
    'mahjong-sichuan': {
      title: '四川麻将',
      sections: [
        { h: '游戏目标', p: '凑出胡牌牌型（4组面子+1对将），成为胡牌的玩家。四川麻将采用"血战到底"规则——一家胡了不结束，继续打到3家胡或流局。' },
        { h: '定缺', p: '开局每人选一门花色（万/筒/条）作为“缺门”，胡牌时手牌里不能再有缺门花色的牌，所以要尽早打光，建议选手里最少的那门。四川麻将只有万、筒、条共 108 张牌，没有风牌、箭牌和花牌，也不能吃牌，只能碰和杠。' },
        { h: '什么叫面子', p: '面子是胡牌的基本组合，有三种：①顺子——同花色连续3张（如2万3万4万、5筒6筒7筒）；②刻子——3张完全相同（如3筒3筒3筒、9条9条9条）；③杠——4张相同（算作一组面子，额外加分）。' },
        { h: '什么叫将', p: '将是一对完全相同的牌（如 5万5万）。普通胡牌必须有且仅有 1 对将。' },
        { h: '怎么碰牌', p: '别人打出的牌，你手里有 2 张相同 → 可以碰。碰后三张刻子亮在自己面前，然后你必须立即打出一张牌，不摸牌。四川麻将不能吃牌。' },
        { h: '怎么杠牌', p: '三种杠：①暗杠——自己摸齐 4 张相同的牌；②点杠——手里有 3 张，别人打出第 4 张；③补杠——先碰，之后自己摸到第 4 张。杠后从牌尾补一张牌。' },
        { h: '怎么胡牌', p: '两种方式：①自摸——自己摸到的牌凑成胡牌牌型；②点炮（接炮）——别人打出的牌你正好需要。胡牌公式：4组面子 + 1对将 = 胡。或者凑成7个对子（七对）。' },
        { h: '胡牌牌型详解', p: '标准型：4 组面子（顺子或刻子）+ 1 对将。例如：234万+567万+222筒+888条+99条 = 胡。七对：7 个对子（不能有碰/杠；同一张牌的 4 张可算两对），例如 22万+55万+33筒+44筒+66条+88条+99条。' },
        { h: '番种与计分', p: '每次胡牌至少 1 分（平胡）。加番：自摸 +1、断幺九（手牌全无 1 和 9）+1、对对和（碰/杠了 3 组以上且全是刻子）+2、七对 +4、清一色（只有一种花色）+8、海底捞（最后一张牌自摸）+1；每个杠 +2~3；每一“根”（手里有 4 张相同的牌却没杠）+1。番数即得分：自摸时每个还没胡的对手各付该分，点炮时由点炮者一人付。' },
        { h: '刮风下雨（可选）', p: '房主开启「刮风下雨」后，杠牌的分数计入本局结算：点杠由点炮者付 2 分；暗杠每个还没胡牌的对手各付 2 分；补杠每个还没胡牌的对手各付 1 分。开启后，本局结束时的花猪和未听牌赔分也会一并结算。' },
        { h: '血战到底规则', p: '一家胡牌后不结束！已胡的玩家退出，剩余玩家继续打，直到第3家胡或牌摸完。先胡的不一定是赢家——后胡的番数可能更大。策略：有时可以等更大的番再胡。' },
        { h: '房间选项', p: '房主可开关：血战到底（默认开；关闭则一家胡牌就结束本局）、一炮多响（同一张炮牌可多家同时胡）、刮风下雨（杠牌收分）、流局查花猪、流局查大叫、最后四张自动胡（牌墙只剩 4 张时能胡必须胡）、换三张（开局前每家选 3 张同花色牌与对家交换）。除血战到底外默认都是关闭的。' },
        { h: '流局（荒庄）', p: '牌墙摸完本局结束，没有人胡牌就是荒庄流局。若房主开启了「流局查花猪」：手里还留着缺门花色的人要赔分给其他人；若开启了「流局查大叫」：没听牌的人要赔分给听牌的人。两项默认关闭。' },
        { h: '多局积分制', p: '每局结算后分数累计到总分。胡牌者下局坐庄，荒庄则顺时针换庄。没有固定局数，可以一直开下一局，总分最高者领先。' },
        { h: '获胜策略', p: '①优先打缺——先把缺门花色打完，否则胡不了；②留搭子——保留能组成顺子的牌（如2万3万等1万或4万）；③注意别人碰杠——判断谁在做什么牌型，避免点炮；④血战到底时——先胡不一定赢，有时可以等更大的番；⑤听牌优先——尽早听牌（只差1张就能胡），提高胡牌概率。' },
      ]
    },
    'mahjong-cantonese': {
      title: '广东麻将',
      sections: [
        { h: '游戏目标', p: '广东鸡平胡——最快凑出胡牌牌型即可胡牌，一家胡即结束本局；牌摸完无人胡则流局。胡牌得分等于番数：自摸时每个对手各付，点炮时由点炮者一人付。节奏快，适合休闲。' },
        { h: '可以吃牌', p: '与四川不同，广东麻将可以吃牌！上家打出的牌，你能组成顺子就可以吃。吃后必须立即出牌。吃牌只能吃上家（逆时针方向的上家）。' },
        { h: '吃碰杠优先级', p: '胡 > 杠 > 碰 > 吃；同级时离出牌者最近的人优先。' },
        { h: '怎么碰牌', p: '别人打出的牌，你手里有2张相同 → 可以碰。碰后组成3张刻子亮在面前，然后立即出牌。碰对所有花色有效（包括字牌）。' },
        { h: '怎么杠牌', p: '暗杠：自己摸到4张相同；明杠：手里有3张别人打出第4张；补杠：碰后摸到第4张。杠后从牌尾补一张。杠上开花+1番。' },
        { h: '怎么胡牌', p: '自摸或点炮。胡牌公式：4组面子+1对将。七对也可胡。' },
        { h: '番种', p: '平胡 1 番起算。加番：自摸 +1、断幺九（无 1/9 和字牌）+1、杠上开花 +1、海底捞月（最后一张牌自摸）+1、对对和（碰/杠了 3 组以上且全是刻子）+2、混一色 +2、七对 +2、清一色 +8、大三元 +8、大四喜 +8、十三幺 +8。开启「红中百搭」且手里有红中时胡牌再 +1 番。' },
        { h: '起胡与封顶', p: '房主可设「起胡番数」（不限 / 1 番 / 3 番，番数不够不能胡）和「封顶番数」（不封顶 / 3 / 4 / 5 番）。' },
        { h: '特殊番型', p: '大三元：中发白三组刻子。大四喜：东南西北四组刻子。十三幺：13种幺九字牌各1张+任1张成对。这些番型无需满足标准4面子+1对结构即可胡牌。' },
        { h: '买码', p: '胡牌后自动从牌尾翻 4 张牌，每翻到一张风牌（东南西北）或箭牌（中发白）额外 +1 番（牌组里没有花牌）。房主可在房间设置里关闭买码。' },
        { h: '多局积分', p: '每局得分累计到总分。胡牌者下局坐庄，荒庄则顺时针换庄。没有固定局数，可以一直开下一局。' },
        { h: '获胜策略', p: '鸡平胡节奏快，优先听牌；注意保留中张（4-6），边张（1/9）难组搭；观察对手吃碰判断其牌型；有胡就胡，不要贪大番。' },
      ]
    },
    texas: {
      sections: [
        { h: '目标', p: '德州扑克最多 8 人。每人手握 2 张底牌，与桌面 5 张公共牌组成最大的 5 张牌，赢得底池。本版本每场只打一手牌，打完即结束。' },
        { h: '筹码与盲注', p: '每位玩家开局有 1000 筹码。庄家位固定为 0 号座位，小盲位于庄家下家，下注 10；大盲再下一位，下注 20。' },
        { h: '流程', p: '翻牌前（每人 2 张底牌）→ 翻牌（3 张公共牌）→ 转牌（1 张）→ 河牌（1 张）→ 摊牌。每一轮下注结束后进入下一阶段。翻牌前由大盲下家先行动，两人单挑时由庄家先行动。' },
        { h: '可用操作', p: '弃牌：放弃本手牌。过牌：当前无需补注时可以不下注。跟注：补到当前最高注。加注：填写本轮的总下注额，至少要比当前最高注多出上一次加注的幅度，本轮还没人下注时至少下 10。全下：把剩下的筹码全部推出。' },
        { h: '牌型大小', p: '从小到大：高牌、一对、两对、三条、顺子、同花、葫芦、四条、同花顺。取 7 张牌（2 张底牌加 5 张公共牌）中最好的 5 张。A-2-3-4-5 是最小的顺子（轮子）。牌型相同时比较踢脚牌。' },
        { h: '胜负', p: '除一人以外全部弃牌时，剩下的那位直接赢下底池。否则摊牌时牌型最大者赢下底池。若牌型完全相同，本版本不分池，取先出现的最大者全赢。本版本也没有边池，全下玩家和其他人共用一个底池。' },
        { h: '提示', p: '起手强牌（大对子、AK）可以主动加注，弱牌在后位不必勉强跟注。观察对手的下注力度来判断牌力。全下前请确认胜率，因为一局只有一手牌，输光就没有下一手了。' },
      ]
    },
    flightchess: {
      sections: [
        { h: '目标', p: '飞行棋 2-4 人，每人 4 架飞机。最先让自己的 4 架飞机全部飞到终点的玩家获胜。已经完成的玩家在轮转时被跳过。' },
        { h: '起飞', p: '飞机起始停在机场。掷出 6 才能起飞，起飞时飞机放在自己的起点，如果起点上有对方飞机会将其击落。' },
        { h: '行进路线', p: '主路径共 52 格，每个座位的起点相差 13 格。走完一圈后进入 6 格终点通道，需要正好走到终点（第 58 步）。步数超过终点时会倒退弹回。从主路径进入终点通道时不会弹回。' },
        { h: '击落', p: '落到有对方飞机的格子上，会把该格上所有对方飞机送回机场。本版没有安全格。' },
        { h: '飞跃与同色跳', p: '第 8 步的飞行格：落在这里会直接飞到第 32 步并停下，落点上的敌机同样被击落。自己颜色的格子（步数能被 4 整除，但不含第 8 步）：落在这里会前跳 4 格并停下，只有跳后仍在主路径内（小于 52）才生效。' },
        { h: '连续掷骰', p: '掷出 6 可以再掷一次。连续三次 6 则本回合作废。如果所有飞机都在机场或终点，连续 5 次没掷出 6，下一次必定为 6（保底）。' },
        { h: '无法行动', p: '没有任何飞机可以移动时，系统自动跳过回合；若这次是 6 则仍可再掷。棋子颜色是随机分配的，仅为外观。' },
        { h: '提示', p: '尽量用 6 起飞增加场上飞机数，优先选择能击落对方或能飞跃的落点，终点前要算好点数，避免弹回。' },
      ]
    },
    snakebattle: {
      sections: [
        { h: '目标', p: '2～6 人在 28×20 的场地里同时操控贪吃蛇，活到最后的人获胜。蛇开局长 3 格，从不同的出生点出发。' },
        { h: '操作', p: '方向键或 WASD 控制，手机可在棋盘上滑动或使用屏幕方向键。蛇每 0.12 秒自动前进一格，不能直接掉头（180 度反向会被忽略）。' },
        { h: '吃苹果', p: '场上始终有一个苹果，被吃掉后会在空位重新出现。吃到苹果蛇身长 1 格、得 1 分。分数只用于展示，不决定胜负。' },
        { h: '死亡', p: '撞墙、撞到任何蛇身（包括自己和已死亡的蛇留下的身体），或两条蛇的头同时进入同一格，都会死亡。两条蛇头对穿互换位置也算双方死亡。蛇尾移开的格子可以立刻进入（正在变长时除外）。' },
        { h: '尸体', p: '死亡的蛇身体会留在场上成为障碍，直到本局结束，所以后期场地会越来越拥挤。' },
        { h: '胜负', p: '场上活着的蛇不超过 1 条时结束，剩下的那条获胜。若最后几条蛇在同一刻全部死亡，则平局。' },
        { h: '提示', p: '沿边缘和蛇群外围走更安全，利用别人的尸体逼对手拐进死路；不要为了苹果冲进狭窄区域。至少需要 2 名玩家，可添加电脑。' },
      ]
    },
    chinesechess: {
      sections: [
        { h: '游戏目标', p: '将死对方的将/帅获胜。9×10 的棋盘，红黑各 16 子，红方在下方先手。' },
        { h: '棋子走法', p: '车：横竖直线任意格，不能越子。马：走日字，若马腿（先直走的那一格）有子则被蹩住。炮：不吃子时同车；吃子必须隔一子（炮架），恰好跳过一子吃其后第一个子。相/象：田字对角走两格，田心有子则被塞住，不能过河。仕/士：只在九宫内斜走一格。将/帅：只在九宫内直走一格。兵/卒：过河前只能向前一格，过河后可前进或横走一格，不能后退。' },
        { h: '将军与对面笑', p: '走完后自己的将/帅不能处于被攻击状态，也不能与对方将/帅在同一列且中间无子（对面笑），违反的走法不会被接受。' },
        { h: '胜负判定', p: '轮到一方时若没有任何合法走法，无论是被将死还是被困毙，都判该方输。出现同一局面三次，或连续 120 步（每方 60 步）无人吃子，则判和棋。' },
        { h: '比赛设置', p: '房间可设置 1/3/5 局制，多局时每局后交换座位，使先后手（红方）交替。' },
        { h: '操作与提示', p: '点击己方棋子选中，会显示可走位置，再点击目标位置落子。非法走法会被服务器拒绝。开局可先出车、跳马，炮常用于牵制；注意自己的帅是否暴露在炮或车的攻击线上。' },
      ]
    },
    chess: {
      sections: [
        { h: '目标', p: '标准国际象棋，完整遵循国际规则。2 名玩家，座位 1 执白先行，将死对方的王即获胜。' },
        { h: '走子', p: '点击自己的棋子，会显示绿色圆点标出可走的格子，捕获时有红圈；再点目标格即可。系统只允许合法的走法，被将军时必须解除将军。' },
        { h: '特殊规则', p: '支持王车易位、吃过路兵和兵升变。兵走到底线会弹出升变选择（后、车、象、马），不选默认升后。' },
        { h: '胜负', p: '将死则走子方获胜。以下情况和棋：逼和（无子可动但没有被将军）、双方子力不足以将死、同一局面三次重复、50 步内无吃子无动兵。' },
        { h: '没有的功能', p: '本模块没有认输按钮和计时钟，下棋不限时。' },
        { h: '系列赛', p: '房主可选一局、三局两胜或五局三胜。每局结束后双方互换座位，先手颜色交替。和棋不计胜场，系列赛由胜场多者获胜。' },
        { h: '电脑与提示', p: '可以添加电脑对手并选择难度。开局先控制中心、尽快出动马和象并王车易位；注意每步之后对方是否能吃你的无保护子。' },
      ]
    },
    checkers: {
      sections: [
        { h: '游戏目标', p: '吃掉对方所有棋子，或让对方无合法走法（无路可走）即获胜。' },
        { h: '棋盘与开局', p: '8×8 棋盘，只用深色格，每方 12 颗普通子，各占靠近自己一侧的三行。红方（座位 1，在下方）先手，黑方在上方。' },
        { h: '普通子走法', p: '普通子只能向前斜走一格到空格，不能后退。吃子也只能向前：跳过相邻的敌子，落在其正后方的空格上，被跳过的敌子被移除。' },
        { h: '王', p: '普通子走到对方底线（红方到最上一行，黑方到最下一行）即升为王。王可向前或向后斜走一格，也可向前后跳吃，但每次只走一格（不是飞王）。' },
        { h: '强制吃子', p: '只要有吃子的走法，就必须吃，不能走普通的步。吃子后若同一棋子落脚处还能继续吃，必须继续连跳；有多个选择时由你选。若普通子在连跳中途刚好升王，则本回合立即结束。' },
        { h: '胜负判定', p: '一方走完后，对方已无棋子或无任何合法走法，该方获胜。本游戏没有和棋判定。' },
        { h: '比赛设置', p: '房间可设置 1/3/5 局制，多局时每局后交换座位，使先后手交替。' },
        { h: '操作与提示', p: '点击己方棋子选中，再点击目标格；连跳时继续点击下一个落点。合法目标会被标出。尽量保留后排棋子，延缓对方升王；留意会逼你吃子、反而让对手连跳的交换陷阱。' },
      ]
    },
    connect4: {
      sections: [
        { h: '游戏目标', p: '在 7 列 × 6 行的竖立棋盘中，先让自己的四颗棋子在横、竖、斜任一方向连成一线即获胜。' },
        { h: '落子规则', p: '每回合选择一列投入一颗棋子，棋子受重力落到该列最低的空位。已装满的列不能再投。黄色（座位 1）先手，红色（座位 2）后手。' },
        { h: '胜负判定', p: '落子后立刻检查横、竖、两条斜线是否出现至少 4 连，出现即获胜。42 格全部填满且无人连成四子则为平局。' },
        { h: '操作', p: '点击任意一列（顶部或列中任意位置）即可落子。轮到你时，可落子的列会被标出，最后一手会高亮。' },
        { h: '策略提示', p: '中间列参与的连线最多，优先占中列。要堵住对方「三连且下一格可落子」的位置，也要避免自己落子后，让对方在上方一格直接完成四连。' },
      ]
    },
    reversi: {
      sections: [
        { h: '游戏目标', p: '棋局结束时，棋子数更多的一方获胜。' },
        { h: '棋盘与开局', p: '房间设置可选 8×8、10×10 或 12×12。开局在棋盘中心交叉摆放 4 颗子（每方 2 颗）。黑棋（座位 1）先手。' },
        { h: '落子规则', p: '每回合必须把子下在空格，且从该点向 8 个方向（横、竖、斜）中至少一个方向上，连续若干颗对方棋子的尽头是自己的棋子。这些被夹住的对方棋子全部翻成自己的颜色。不能夹住对方棋子的位置不能落。' },
        { h: '无子可下', p: '无合法落点时必须选择跳过（pass）；有合法落点时不能跳过。一方落子后若对方没有合法落点，则轮到你继续走。' },
        { h: '结束与胜负', p: '当双方都没有合法落点（包括棋盘下满）时结束，数棋子多的一方获胜，数量相同则平局。' },
        { h: '比赛设置', p: '房间可设置 1/3/5 局制。多局时每局结束后双方交换座位，使先后手交替。' },
        { h: '操作与提示', p: '点击空格落子，半透明圆点表示合法落点。角落一旦占住就不会被翻转，非常重要；紧挨角的格子容易送角，应尽量避免。前期少翻子、保持行动力，后期再多翻。' },
      ]
    },
    go9: {
      sections: [
        { h: '目标', p: '九路围棋在 9x9 棋盘上进行，双方轮流落子，目标是用棋子围住更多的地盘。黑棋为 0 号玩家，先手。' },
        { h: '落子与提子', p: '棋子落在交叉点上，不能移动。棋子的「气」是相邻的空点，一块棋子没有气时被提走。落子可以提掉对方无气的棋子。' },
        { h: '禁着', p: '自杀（落子后自己没有气）是不允许的，除非这一手同时提掉了对方的棋子。打劫：单子被提后，对方不能立刻在原位回提，需要隔一手才可以。' },
        { h: '终局', p: '连续两次虚着（pass）后对局结束。为防止无限对局，总手数达到 200 手也会强制结束。' },
        { h: '数子法计分', p: '使用中国规则数子：每方得分等于棋盘上自己的棋子数加上只与自己颜色相邻的空点区域。因为黑棋先手，黑棋要贴 3.75 子，即黑棋得分 = 实地 - 3.75。得分高者获胜，若得分完全相同则判和。' },
        { h: '多局制', p: '房间设置里可以选择一局、三局两胜或五局三胜。每局结束后双方座位对调，因此先手方轮换。机器人难度也可以在房间中选择。' },
        { h: '提示', p: '开局优先占角、再占边。注意保持棋子的气，别被分割成零散的小块。收官阶段别忘了黑棋要贴子。' },
      ]
    },
    drawguess: {
      sections: [
        { h: '游戏目标', p: '和朋友一起画图、猜词与传递信息。房主可选择实时抢答的舞台猜词，或会逐步跑偏的悄悄话传画。' },
        { h: '两种玩法', p: '🎤 舞台猜词：一名画家实时作画，其余玩家同时抢答（可无限次猜，忽略空格和大小写）。猜得越早分越高（最低 2 分，不限时固定 10 分），画家每有一人猜中得 1 分。全员猜中或时间到则本轮结束，每人轮流当一次画家，总分最高者获胜。🔇 悄悄话传画：第 1 人看到词后作画 → 第 2 人看画猜词 → 第 3 人根据这个猜测作画 → 交替到最后一人。结束后全员投票判断最终结果是否仍符合原词：符合则起点玩家得 3 分。每人轮流当一次起点，总分最高者获胜。' },
        { h: '选词', p: '第一位画家从几个候选词中选一个开画（候选词数量可在房间设置中调整）。超时会自动选第一个词。' },
        { h: '画画', p: '轮到你画时，根据词语（或上一位玩家猜的词）在画板上作画。可换颜色、笔宽，可用橡皮和清空。限时结束会自动提交。' },
        { h: '猜词', p: '轮到你猜时，看上一位玩家的画，输入你猜的词。你的答案会传给下一位画家。' },
        { h: '揭示与投票', p: '所有人完成后系统逐步揭示整条传话链：原词 → 画 → 猜词 → 画 → … → 最终结果。全员投票选择「符合原词」或「已经跑偏」，过半（含平票）算符合，起点玩家得 3 分；跑偏不得分。接着下一位玩家开新一条链，直到每人都当过起点。' },
        { h: '房间设置', p: '房主可选词库分类（动物/食物/成语/网络热词等）、画画/猜词限时、候选词数量，还能添加自定义词。' },
      ]
    },
    monopoly: {
      sections: [
        { h: '游戏目标', p: '通过买地、收租让对手破产，成为最后存活的玩家。每人起始 1500 元。' },
        { h: '掷骰移动', p: '轮到你点「掷骰子」，棋子按两枚骰子点数之和前进。经过或停在起点可领 200 元。' },
        { h: '买地与收租', p: '停在无主的地产/车站/电力公司可花钱购买（不买就保持无主，没有拍卖）。停在别人的地产要付租金：地产租金随房子数增加；车站按对方拥有的车站数收 60/120/240/420 元；电力公司按本次骰子点数之和 ×10 收租。' },
        { h: '垄断与建房', p: '集齐同色组的全部地产即垄断：空地租金翻倍，并且在自己的回合里可以花钱盖房（每级造价为地价的一半，最多 5 级 = 旅馆），租金大涨。' },
        { h: '机会卡', p: '停在「❓机会」格抽一张卡：可能得钱、罚款、向每位玩家收 50 元、前进/后退、回到起点、直接入狱，或获得免租卡（免一次地产租金，用掉即失效，对车站和电力公司无效）。' },
        { h: '税与其他格子', p: '「所得税」格要交 200 元；「探监」和「免费停车」格没有任何效果。' },
        { h: '监狱', p: '踩到「入狱」角格或抽到入狱卡会被关进监狱。在监狱里每回合掷骰：掷出双数立即出狱并按点数前进；连续 3 次没掷出双数，则交 50 元出狱并按第 3 次的点数前进。' },
        { h: '破产', p: '现金一旦为负立即破产出局（没有抵押、出售或交易），名下地产变回无主。最后剩下的玩家获胜。' },
      ]
    },
    suikabattle: {
      sections: [
        { h: '目标', p: '往容器里投水果，相同的水果碰在一起会合成更大的一种，靠合成得分。多人对战时，容器先被堆满的人出局，最后留下的人获胜。' },
        { h: '操作', p: '移动鼠标或手指瞄准，点击（或手指抬起）即投下当前水果，下方会预告下一个。每次投放之间有约 0.6 秒冷却。投下的水果随机来自最小的 5 种。' },
        { h: '水果顺序', p: '共 11 种：樱桃、草莓、葡萄、橘子、柠檬、猕猴桃、番茄、桃子、菠萝、椰子、西瓜。两个相同的合成下一种；两个西瓜相遇会一起消失。' },
        { h: '计分', p: '合成时得到新水果对应的分数：1、3、6、10、15、21、28、36、45、55、66。例如两个樱桃合成草莓得 3 分，两个西瓜消失得 66 分。单纯投放不得分。' },
        { h: '出局', p: '如果有水果的顶部高过警戒线，并且几乎静止超过约 2 秒，该玩家就爆满出局。物理计算在各自的浏览器里进行，服务器只统计分数与出局。' },
        { h: '胜负', p: '多人时最后一个没爆满的人获胜，与分数高低无关；若所有人都爆满，则分数最高者获胜，同分取座位靠前者。单人游玩直到爆满，以最终得分为成绩。1～4 人可玩。' },
        { h: '提示', p: '把大水果集中放在一侧，小水果放在边上等待合成；避免让水果卡在警戒线附近。多人对战更看重稳，不要为了分数冒险堆高。' },
      ]
    },
    sheeptile: {
      sections: [
        { h: '目标', p: '羊了个羊是消除类游戏，支持 1-6 人。点击牌面进入下方 7 格槽，凑齐 3 张相同图案自动消除，最先通关第 2 关的玩家获胜。' },
        { h: '点击规则', p: '只能点击没有被覆盖的牌。当另一张更高层的牌在横纵向都与它重叠不足一格时，该牌被视为遮挡。点击后牌进入槽中，3 张相同图案消除并得 3 分。' },
        { h: '失败条件', p: '槽位共 7 格，被占满即淘汰。所有人都被淘汰时，得分最高者获胜；只剩一名存活者时该玩家获胜。' },
        { h: '关卡', p: '第 1 关共 24 张牌、6 种图案，用于热身。第 2 关共 102 张牌、14 种图案，包括金字塔主体 70 张、左右侧列各 6 张，以及两条各 10 张的背面队列牌。布局由程序保证有解。' },
        { h: '道具', p: '每一关每种道具可用一次，进入新关卡后重置：撤销（取回刚放进槽中的牌）；洗牌（重新打乱剩余牌面的图案）；移出（把槽里最前面的 3 张牌移出）。' },
        { h: '房间设置：同一盘面', p: '默认开启，所有人玩同一盘棋，比谁更快更稳。关闭后每位玩家拥有各自独立的随机图案分布。' },
        { h: '提示', p: '先看清下层的牌，多留出槽位余量。道具要留到槽快满的关键时刻。同一图案尽量成组收集，不要让槽里堆满零散的牌。' },
      ]
    },
    sanguo: {
      sections: [
        { h: '目标', p: '4–8 人身份局，每人一个暗置身份（主公公开）。主公和忠臣要消灭所有反贼和内奸；反贼要杀死主公；内奸要先帮忙清掉其他人，最后单挑主公并取胜。' },
        { h: '回合', p: '开局每人 4 张牌，主公体力上限 +1 并先手。每回合：先处理判定区的牌（乐不思蜀、闪电）→ 摸 2 张牌 → 出牌 → 弃牌到手牌数不超过当前体力。出牌阶段每回合只能出一张「杀」（装了诸葛连弩不限）。' },
        { h: '基本牌', p: '「杀」攻击攻击范围内的人，对方要打出「闪」才能躲过，否则损失 1 点体力；「桃」回复 1 点体力（满体力时不能用）。体力降到 0 即濒死，此时任何人都可以出桃救人；没人救则死亡，并弃掉所有牌。' },
        { h: '锦囊', p: '过河拆桥、顺手牵羊、决斗、借刀杀人、南蛮入侵、万箭齐发、桃园结义、五谷丰登、无中生有、乐不思蜀、闪电。「无懈可击」可以抵消任意锦囊，也可以被再次抵消。' },
        { h: '装备', p: '武器决定攻击范围并带有特效，防具提供防御，+1 马让别人更难打到你，-1 马让你更容易够到别人。' },
        { h: '武将技能', p: '每人随机分到一名武将，技能写在你的牌面下方。刘备、孙权、华佗、貂蝉有主动技能（选牌和目标后点技能按钮），其余是被动或转换技能。' },
        { h: '奖惩', p: '杀死反贼摸 3 张牌；主公杀死忠臣，要弃掉所有手牌和装备。' },
        { h: '提示', p: '手牌点一下选中，需要目标时再点座位；被问到要不要出闪、无懈可击或桃时，不想出点「放弃」。出牌阶段限时 40 秒，响应限时约 10-15 秒，超时会自动结束出牌或视为放弃。本版本没有主公技。人不够可以加电脑凑人。' },
      ]
    },
    werewolf: {
      sections: [
        { h: '怎么玩', p: '手机就是法官：夜里轮到你时手机提示你操作，其他人的屏幕只显示“天黑请闭眼”。白天可以当面说，也可以在房间设置里选「打字聊天」在手机上打字发言；发言顺序和投票都在手机上完成。' },
        { h: '身份配置', p: '按人数自动配板：6 人 2 狼+预言家+女巫+2 平民；7 人加入猎人；8-10 人狼增至 3 只，平民随人数增加；11-12 人再加入白痴（12 人为 4 狼）。身份牌默认盖着，点一下才显示，注意别让旁边的人看到。' },
        { h: '夜晚', p: '狼人一起选击杀目标（可以空刀），预言家查验一人并得知对方是不是狼人。之后女巫可以用解药救下被刀的人（不能自救），或用毒药毒死任意一人；每瓶药整局只能用一次，同一晚只能用一瓶。' },
        { h: '白天', p: '第一天可以竞选警长：想竞选的人上警并依次发言，其他人投票。之后公布昨晚死讯，第一晚的死者有遗言，然后所有活着的人依次发言，接着是一段自由讨论（所有人都点「准备投票」就提前结束），最后投票放逐，被放逐的人有遗言。警长在放逐投票中算 1.5 票，并最后发言。平票的人进行 PK 发言再投一次，还平票就无人出局。' },
        { h: '打字聊天', p: '选了「打字聊天」时：轮流发言阶段只有当前发言人能打字；自由讨论和投票时所有活着的人都能说；夜里狼人有只有狼队友看得到的狼人频道；出局的人只能旁观（遗言除外）。' },
        { h: '技能', p: '猎人出局时可以开枪带走一人（被毒死除外）；白痴被放逐时翻牌免死，但之后不能投票；警长出局时可以移交或撕毁警徽。' },
        { h: '胜负', p: '狼人全部出局，好人获胜；神职全部出局或平民全部出局（屠边），狼人获胜。' },
        { h: '房间设置', p: '房主可以选择发言方式（面对面 / 打字聊天）、自由讨论时长（可关闭）、每人发言时长，以及是否进行警长竞选。人数不够可以加电脑凑人，电脑只会随机行动，主要用于试玩。' },
      ]
    },
    truthdare: {
      sections: [
        { h: '页面定位', p: '这是聚会抽题工具，没有胜负和结束条件。先在场外剪刀石头布（或别的小游戏）决定谁输，输的人回到页面抽题。' },
        { h: '抽题', p: '任何玩家随时都可以点「真心话」「大冒险」或「随机」抽一张，没有回合顺序。「随机」会各 50% 抽真心话或大冒险（如果某类没有题则用另一类）。题目会同步显示在所有人的屏幕上，下方保留最近 12 条记录。' },
        { h: '内置题库', p: '有四套题库：轻松破冰、朋友聚会、深度真心话、大冒险挑战，每套各 6 条真心话和 6 条大冒险。抽题是随机的，同一题可能重复出现。' },
        { h: '自定义牌库', p: '房间设置里可以勾选启用的题库，并添加自定义真心话和大冒险，每行一条（也可以用分号分隔），各最多 80 条。' },
        { h: '兜底规则', p: '没有勾选任何题库则使用全部内置题库；如果所选范围里没有某类题，会回退到默认题库。自定义题库为空则不启用。' },
        { h: '人数', p: '2～10 人。大家约定好规则，抽到的题目由抽卡的人完成，或按你们自己的玩法来。' },
        { h: '提示', p: '选题库时注意场合和关系，深度题适合熟人，破冰题适合初次见面；不想做的题可以重新抽或约定放弃。' },
      ]
    },
    hearts: {
      sections: [
        { h: '目标', p: '红心大战固定 4 人，每人 13 张牌。目标是尽量少拿分：每张红桃 1 分，黑桃 Q 13 分，一轮共 26 分。累计分数最先达到 100 分时游戏结束，总分最低者获胜，并列时座位靠前者优先。' },
        { h: '传牌', p: '每轮开始先传 3 张牌，方向按轮次循环：向左、向右、对家、不传。不传的那一轮直接开始出牌。如果超时或直接确认，系统会自动选择你手中最大的 3 张传出。' },
        { h: '出牌规则', p: '持有梅花 2 的玩家先出，且第一墩必须出梅花 2。之后每墩必须跟出与首家相同的花色，没有该花色时可以垫任何牌。首墩如果你手中有非得分牌，就不能垫红桃或黑桃 Q。' },
        { h: '红心破冰', p: '红桃被打出之前（破冰），任何人都不能领出红桃，除非手中只剩红桃。注意只有红桃本身会破冰，黑桃 Q 落地不算。' },
        { h: '吃墩', p: '每墩中首家花色里最大的一张赢得这一墩，赢家拿走墩里所有的得分牌，并领出下一墩。' },
        { h: '打满全垒', p: '如果一名玩家一轮内独得全部 26 分，则他本轮记 0 分，其余三人各记 26 分。风险很高，仅在手牌极端时尝试。' },
        { h: '机器人难度', p: '房间里可以给机器人选择难度，难度越高，机器人越会算牌、躲分和送分。' },
        { h: '提示', p: '尽早打出大牌和黑桃 Q 之上的危险牌，传牌时把大牌和黑桃 Q、A、K 传出去。留意黑桃 Q 的去向，别让它落到自己手里。' },
      ]
    },
    battleship: {
      sections: [
        { h: '目标', p: '2 人对战的海战棋：在 10×10 的海域上摆好自己的舰队，然后轮流向对方海域开炮，先击沉对方全部 5 艘船的人获胜。' },
        { h: '布阵', p: '舰队固定为 5 艘：航母 5 格、战列舰 4 格、巡洋舰 3 格、潜艇 3 格、驱逐舰 2 格。按顺序放置，不得重叠或超出边界，但可以紧挨着。可从船坞拖动或点格子放置；点击、旋转按钮或右键切换横竖。双方同时布阵，都完成后开战。' },
        { h: '开炮', p: '座位 1 先手。每次选对方海域一格射击，已射过的格子不能再射。结果有三种：未命中、命中、击沉。' },
        { h: '回合', p: '命中不会获得额外回合，不论结果如何，每次射击后都轮到对手。' },
        { h: '击沉', p: '击沉一艘船时，会向射手揭示整艘船的种类和轮廓，便于判断剩余舰船。' },
        { h: '胜负', p: '先击沉对方 5 艘船者获胜，不存在平局。结束后会显示对方船只的位置。' },
        { h: '电脑与技巧', p: '可添加电脑并选择难度。布阵时别总靠边或排成整齐的一排；射击时命中后沿相邻四个方向探索，每艘船至少 2 格，隔格搜索更高效。' },
      ]
    },
  };

  var TUTORIALS_EN = {
    tictactoe: {
      sections: [
        { h: 'Objective', p: 'On a 3x3 grid, be first to get three of your marks in a row: horizontal, vertical or diagonal (8 lines in total).' },
        { h: 'Turns', p: 'Two players alternate placing a mark in an empty cell. Seat 1 goes first (X), seat 2 second (O). Marks cannot be moved or undone, and an occupied cell cannot be used.' },
        { h: 'Win and Draw', p: 'After every move the board is checked immediately; completing a line wins. If all nine cells fill without a line, the game is a draw.' },
        { h: 'Room Settings', p: 'No extra options. Two players only; you can add a bot opponent.' },
        { h: 'Tips', p: 'Click an empty cell to play. Take the center or a corner on your first move. Always check whether the opponent has two in a line and block it before attacking.' },
      ]
    },
    gomoku: {
      sections: [
        { h: 'Objective', p: 'On a 15x15 board, be first to line up five or more of your stones horizontally, vertically or diagonally.' },
        { h: 'Turns', p: 'Black (seat 1) moves first and players alternate placing a stone on an empty intersection. Stones never move and there are no captures or undo.' },
        { h: 'Winning', p: 'There are no forbidden moves: overlines (six or more), double threes and double fours are all allowed. As soon as a move creates at least 5 in a row in any direction, that player wins. If all 225 points are filled with no five, the game is a draw.' },
        { h: 'Terms', p: 'Open three: three stones that become an open four with one more move. Open four: both ends empty, the opponent cannot block both, so it wins. Four: only one end open, the opponent must block at once.' },
        { h: 'Match Settings', p: 'The room can use a best-of 1, 3 or 5 match. Between games the two seats swap, so who moves first alternates; the match is decided by games won.' },
        { h: 'Controls and Tips', p: 'Click an intersection to place a stone. Since there are no restrictions, going first is a strong advantage: as White, block open threes and fours first. As Black, build a four-three or double open three to overload the defense.' },
      ]
    },
    sudoku: {
      sections: [
        { h: 'Objective', p: 'All players solve the same Sudoku. It is a real-time race with no turns: the first to fill every blank correctly wins. 1 to 4 players, bots allowed.' },
        { h: 'Sudoku Rules', p: 'On the 9x9 grid, every row, column and 3x3 box must contain 1 to 9 without repeats. The given numbers cannot be changed, and each puzzle has a unique solution.' },
        { h: 'Filling and Lives', p: 'Click a blank cell, then pick a digit 1-9. A correct digit counts toward your progress; a digit that differs from the solution is wrong and costs one life. Everyone has 3 lives; with none left you are eliminated and can no longer play. Correctly filled cells stay fixed.' },
        { h: 'Hints', p: 'Each player gets at most 3 hints per game. A hint fills one random blank of yours for free and counts toward progress; it does not cost a life.' },
        { h: 'Winning', p: 'First to fill all blanks wins. If everyone but one player is eliminated, the last player wins at once without finishing. If all players are eliminated together, it is a draw.' },
        { h: 'Tips', p: 'Opponents cannot see your grid. Start with the digits that appear most, then look for rows, columns or boxes with a single blank. Do not guess: three mistakes end your game. Use hints when stuck.' },
      ]
    },
    '2048': {
      sections: [
        { h: 'Objective', p: 'Every player has an independent 4x4 board, all starting from the same layout (the same 2 initial tiles). Race to be first to create a 2048 tile. 1 to 4 players, bots allowed.' },
        { h: 'Gameplay', p: 'Slide up, down, left or right (arrow keys or swipe). All tiles move that way, and two adjacent equal tiles merge into their sum, which is added to your score. A tile can merge only once per move.' },
        { h: 'New Tiles', p: 'Only a move that actually changes the board counts; a move with no effect is rejected. After each valid move a new tile appears in a random empty cell: 90 percent a 2, 10 percent a 4.' },
        { h: 'Winning', p: 'The first player to make a 2048 tile (or higher) wins immediately and the round ends. You cannot see opponent boards, only the top score.' },
        { h: 'Locked Boards', p: 'When your board has no empty cell and no adjacent equal tiles, you are locked and cannot move. If every player is locked and nobody reached 2048, the highest score wins; equal top scores are a draw. Playing solo, getting locked before 2048 is a loss.' },
        { h: 'Tips', p: 'Keep your biggest tile in a corner and mostly use two directions (for example left and down), rarely the opposite one. Keep one row in descending order so merges chain. Do not fill the board chasing small points.' },
      ]
    },
    davinci: {
      sections: [
        { h: 'Objective', p: 'Each player starts with 4 tiles (3 tiles in a 4-player game). Guess the numbers on opponents\' hidden tiles to reveal them. A player whose tiles are all revealed (guessed, or flipped as a penalty) is eliminated; the last player standing wins.' },
        { h: 'Tile Set', p: '26 tiles: Black 0-11, White 0-11, plus 2 wild tiles (★). Wild tiles can be placed anywhere in your sequence.' },
        { h: 'Sorting Rule', p: 'Tiles are arranged smallest to largest; same number: black left, white right. Wild tiles stay where you place them — they won\'t be auto-sorted.' },
        { h: 'Public Info', p: 'All tile colors (black/white) are public. Only the number is hidden. You guess the number of an opponent\'s tile.' },
        { h: 'Turn Flow', p: '① Draw: take a tile from the pile (only you can see it). ② Guess: click an opponent\'s hidden tile and guess its number, or press "Guess ★" for a wild tile. ③ Correct guess: the tile is revealed; you may keep guessing or press "Pass" to end your turn. ④ Wrong guess: your drawn tile is inserted face-down into your row, then you must flip one of your own hidden tiles. ⑤ Pass: insert the drawn tile face-down into your row without guessing; the same happens when you end your turn after a correct guess.' },
        { h: 'Penalty Phase', p: 'After a wrong guess, you must flip up one of your own unrevealed tiles. Click your own hidden tile to choose which one to reveal. Then the turn passes to the next player.' },
        { h: 'Wild Tile', p: 'When you draw a wild tile (including your first tile of the game), choose where to insert it in your sequence. It stays in that position for the entire game. To guess a wild tile, press the "Guess ★" button.' },
      ]
    },
    uno: {
      sections: [
        { h: 'Goal', p: 'UNO is for 2-6 players, 7 cards each. The first player to empty their hand wins. The deck is the standard 108 cards: numbers 0-9, skip, reverse and draw two in each colour, plus 4 wild and 4 wild draw four.' },
        { h: 'Playing cards', p: 'The first discard is never a wild and has no effect, and player 0 starts. A card can be played if it matches the top card by number or symbol, or matches the current colour. Wild cards can always be played and set a new colour.' },
        { h: 'Drawing', p: 'You may only draw when you have no playable card, otherwise you are told you have a playable card. You draw 1 card and your turn ends, and the drawn card cannot be played immediately.' },
        { h: 'Action cards', p: 'Skip makes the next player miss a turn. Reverse changes direction, and with two players it acts like a skip. Draw two adds 2 to a penalty that can stack. While a penalty is pending you may only add a draw two or draw four, or else you must draw the whole accumulated penalty.' },
        { h: 'Wild draw four and challenges', p: 'After a wild draw four, the target chooses to accept (draw 4 and miss a turn) or challenge. A challenge checks whether the player held a card of the previous colour before playing it. If yes, the challenge succeeds: the player draws 4 and the challenger plays next. If not, the challenge fails: the challenger draws 6 and misses a turn.' },
        { h: 'Calling UNO', p: 'When you are about to play your second to last card and have one left, you must press UNO during your own turn. If you play your last card without having called UNO, you lose at once and the next player wins.' },
        { h: 'Running out of cards', p: 'When the draw pile runs out, the discard pile (keeping the top card) is reshuffled into a new draw pile.' },
        { h: 'Tips', p: 'Save wild cards for the finish. Watch which colours opponents lack and switch to those. Do not forget to call UNO before playing down to your last card.' },
      ]
    },
    doudizhu: {
      sections: [
        { h: 'Objective', p: 'The Landlord must play all cards first. Either Peasant getting rid of all cards means the Peasants win.' },
        { h: 'Deal', p: '17 cards per player, 3 cards in the kitty. Once the Landlord is decided, they take the kitty.' },
        { h: 'Bidding', p: 'The host picks a mode; the default is Call and Rob: players take turns calling or passing; once someone calls, players who did not pass may rob in turn, and the last caller or robber becomes Landlord (a call multiplies the score by 3, each rob by a further 2). In Score mode players bid 0-3 points in turn; a bid of 3 wins at once, otherwise the highest bid becomes Landlord. If nobody bids, redeal.' },
        { h: 'Combinations', p: 'Single, Pair, Triple, Triple+1, Triple+2 (a pair), Straight (5+ consecutive), Consecutive Pairs (3+ pairs), Airplane (consecutive triples, each optionally with a single or each with a pair), Four+2 (four of a kind with two singles or two pairs), Bomb (four of a kind), Rocket (Red Joker + Black Joker). Straights, consecutive pairs and airplanes cannot include 2s or Jokers.' },
        { h: 'Play Rule', p: 'The Landlord leads with any combination. Each next player must play the same type with the same number of cards but higher (or a Bomb/Rocket), or pass; after two players pass in a row, the last player to play leads freely again. The host can set a time limit per play (10/20/60/300 s); when it runs out while you are following, you automatically pass.' },
        { h: 'Ranking', p: 'Rocket > Bomb > Regular. Regular order: 3<4<5<6<7<8<9<10<J<Q<K<A<2<Black Joker<Red Joker.' },
        { h: 'Scoring and Rounds', p: 'Each round is worth a base of 100 points: if the Landlord wins the Landlord gets +200 and each Peasant -100; if the Peasants win it is reversed. In Call and Rob mode a call is x3 and each rob a further x2; every Bomb or Rocket played doubles the score again. The host picks 3/6/9/12 rounds and scores accumulate; before the final round everyone can vote to add 3 more rounds.' },
      ]
    },
    'exploding-kittens': {
      sections: [
        { h: 'Goal', p: 'Exploding Kittens is an elimination game for 2-6 players. If you draw an exploding kitten without a defuse you are out, and the last survivor wins. This version has no Nope card and no cat combos.' },
        { h: 'Deck and deal', p: 'The deck has 6 exploding kittens, 4 defuses, 4 each of attack, skip, shuffle, steal and favor, and 5 see-the-future. The action cards are multiplied by ceil(players / 2). Each player gets 4 cards plus 1 defuse. Players minus 1 kittens go into the deck, and any leftover defuses are shuffled in. With 5-6 players some players start without a defuse.' },
        { h: 'Turn flow', p: 'On your turn you may play any number of action cards, then you must draw a card to end the turn. The draw button skips straight to drawing.' },
        { h: 'Action cards', p: 'Skip ends your turn without drawing, and if you owe extra turns it only uses up one of them. Attack ends your turn without drawing and sends an extra turn to a chosen player (the next player by default), and multiple attacks stack. See the Future shows the top 3 cards to you only. Shuffle shuffles the deck. Steal and Favor work identically: take a random card from a living player you choose, then you go straight to drawing and cannot play more cards.' },
        { h: 'Kittens and defuses', p: 'When you draw a kitten and hold a defuse, it is used automatically and you choose where the kitten goes back into the deck, where 0 is the bottom and the highest position is the top. If you do not choose, the position is random. Without a defuse you are eliminated and your hand is discarded. Playing a defuse by itself does nothing.' },
        { h: 'Winning', p: 'When only one player remains alive, that player wins. If the deck runs out you will be told the deck is empty.' },
        { h: 'Tips', p: 'Use See the Future to check whether the next card is a kitten, then decide to draw, skip or attack. Keep your defuse for yourself. In bigger games steal from players who might hold a defuse.' },
      ]
    },
    rummikub: {
      sections: [
        { h: 'Objective', p: 'Be the first to play all your tiles. Shout "Rummikub!" when you clear your rack.' },
        { h: 'Tile Set', p: '106 tiles: 4 colors (Black, Blue, Red, Orange) × numbers 1-13 (two of each) + 2 Jokers (★). Each player starts with 14 tiles.' },
        { h: 'Legal Sets', p: '① Run: same color, consecutive numbers, at least 3 tiles (e.g. 🔴3-4-5). ② Group: different colors, same number, at least 3 tiles (e.g. 🔴7-🔵7-🟠7).' },
        { h: 'Initial Meld', p: 'Your first play must be worth at least 30 points from your own tiles (a Joker counts as 30). When laying tiles down directly, the first set alone must reach 30; when using the workbench, all of your own tiles you use add up together. Only after melding can you add to table sets or rearrange them. This rule can be turned off in settings.' },
        { h: 'After Melding', p: 'Each turn you may play any number of tiles: ① lay down new runs or groups. ② Add tiles to existing sets on the table. ③ Click "🔀 Manipulate" to enter the workbench and rearrange table tiles. If you can\'t play, draw 1 tile and end your turn.' },
        { h: 'Manipulation', p: 'In the workbench, all table sets + your hand are spread out in a grid. Click a tile to select it → click a target set to insert it. You can split, merge, and create new sets freely using table tiles. Requirements: ① every set must be legal (green border) ② at least 1 of your own tiles must be used ③ no original table tiles may be lost. Click "Submit" when done, or "Cancel" to revert.' },
        { h: 'Jokers', p: 'Jokers can substitute for any tile. For the initial meld and for the stalemate count, each Joker is worth 30 points.' },
        { h: 'Empty Pool', p: 'Once the pool is empty, if every player in turn has to pass, the game ends: the player whose remaining tiles add up to the least wins (number tiles count their number, Jokers 30). Equal totals are a draw.' },
      ]
    },
    twentyfour: {
      sections: [
        { h: 'Goal', p: 'Each round shows 4 cards from 1 to 13. Use + - x / and parentheses with each number exactly once to make 24. Every puzzle is solvable.' },
        { h: 'Writing', p: 'Enter numbers, operators and brackets with the on-screen buttons; undo and clear are available. You must use all four numbers exactly once, and 12 counts as the whole number twelve, not 1 and 2. Fractions are fine in intermediate steps and a result within 0.0001 of 24 counts. A wrong answer shows the value you got, and tries are unlimited.' },
        { h: 'Untimed Mode', p: 'By default rounds have no timer: the first correct answer wins the round at once.' },
        { h: 'Timed Mode', p: 'The host can set a round time of 30, 60, 90 or 120 seconds. In timed mode a correct answer is only recorded and you cannot submit again; when time is up, the earliest correct submission wins the round. If nobody is correct, nobody scores.' },
        { h: 'Rounds and Winning', p: 'The host picks 3, 5, 7 or 10 rounds (5 by default). After each round tap Next Round; after the last round that tap goes to the summary. The player with the most round wins takes the game, ties going to the lower seat.' },
        { h: 'Hint Button', p: 'When stuck, tap Hint for a step-by-step clue. There is a cooldown between clicks and a limited number of steps.' },
        { h: 'Room Settings', p: 'Round time and number of rounds can only be changed by the host. 1 to 99 players can start; bots race at the same time.' },
      ]
    },
    minesweeper: {
      sections: [
        { h: 'Goal', p: 'Everyone faces the same 10x10 field with 15 mines and 85 safe cells. Reveal all 85 safe cells first to win, or outlast the rest when they hit mines.' },
        { h: 'Simultaneous Play', p: 'There are no turns. Everyone plays at the same time on their own independent board, and you can see each other progress. The mine layout is identical for all players.' },
        { h: 'Revealing', p: 'A revealed cell shows the number of mines among its 8 neighbors. A zero cell opens its neighbors automatically. The very first reveal of the whole game (by anyone) is never a mine; if it was one, the mine is moved. Only that first reveal is protected, so later players can still hit a mine on their first click.' },
        { h: 'Flags', p: 'Flag suspicious cells and click again to remove. The number of flags is unlimited and they are only your own notes, never checked. A flagged cell cannot be revealed until unflagged, and a revealed cell cannot be flagged.' },
        { h: 'Elimination and Winning', p: 'Hitting a mine puts you out; your board stays visible for spectating. If exactly one player is still alive, they win at once. If everyone is out at the same time it is a draw. In solo play, hitting a mine is a loss. The first to reveal all 85 safe cells wins immediately.' },
        { h: 'Controls', p: 'On desktop, left click reveals and right click flags. On touch, tap to reveal and long-press for about half a second to flag. One player can start a game for solo practice.' },
        { h: 'Tips', p: 'Balance speed and safety: in a group the careful player can wait for others to blow up, but a fast opponent may finish first. Start from isolated 1s in corners, flag certain mines, then chain deductions.' },
      ]
    },
    numberbomb: {
      sections: [
        { h: 'Goal', p: 'A secret bomb number from 1 to 100 is chosen. Players take turns guessing, and whoever hits it loses a life. Everyone has 3 lives; the last player with lives wins.' },
        { h: 'Guessing', p: 'On your turn enter an integer within the current range. A guess above the bomb sets the upper limit to your guess minus 1; a guess below sets the lower limit to your guess plus 1. The range keeps shrinking.' },
        { h: 'Hitting the Bomb', p: 'Hitting the bomb costs 1 life. If more than one player is still alive, a new bomb is picked, the range resets to 1-100 and the round counter goes up. The player who hit it starts the next round, or the next living player if they are out.' },
        { h: 'Forced Hit', p: 'When only one number is left in the range, the next player can only guess that number and must hit the bomb. So be careful about leaving a two-number range for yourself.' },
        { h: 'Winning', p: 'There is no turn timer, and eliminated players are skipped. The game ends when at most one player still has lives and that player wins. In solo play the first hit ends the game.' },
        { h: 'Controls', p: 'Use the on-screen keypad (0-9, backspace and the Guess button) or type with the keyboard and press Enter, up to 3 digits. A log shows the last 10 events. 1 to 10 players.' },
        { h: 'Tips', p: 'Aim to leave the next player a range where every choice is bad, such as two numbers left, and avoid being that player yourself.' },
      ]
    },
    oldmaid: {
      sections: [
        { h: 'Goal', p: 'Do not be the last one holding the Joker. The deck is 52 cards plus 1 Joker (53 in total), dealt around the table to 2 to 6 players, so hands may differ by one card.' },
        { h: 'Pairs', p: 'At the start and after every draw, pairs of the same rank are discarded automatically. The Joker never pairs. Hands are hidden from the others.' },
        { h: 'Drawing', p: 'Seat 1 starts. On your turn you draw a face-down card from the next player who still has cards: first pick whom to draw from, then tap one of their card backs. If it pairs with a card in your hand, the pair is discarded automatically.' },
        { h: 'Skipping', p: 'Players with an empty hand are skipped and no longer take part in drawing.' },
        { h: 'Winning', p: 'The game ends when only one player still holds cards. That player has the Joker and loses; everyone else wins. There is no timer.' },
        { h: 'Tips', p: 'Watch your opponents for hesitation when they draw, and try not to give away the Joker. Luck dominates, so enjoy it.' },
      ]
    },
    liarsbar: {
      sections: [
        { h: 'Objective', p: 'Play cards face-down and declare their rank — truth or lie, your choice. Be the last one alive!' },
        { h: 'Deck', p: 'J, Q, K (2 of each suit = 24) + Wild ★ (4) + Joker 👻 (1). Wild cards are always "truth" when challenged. When the Joker is challenged, everyone except the player who played it takes a shot.' },
        { h: 'Turn Flow', p: '① A target rank (J/Q/K) is drawn. ② Each player gets 5 cards. On your turn play 1-3 cards face-down and declare them all as the target rank. ③ The next player may either play their own cards or challenge the last play. ④ On a challenge the last play is flipped: if any card is not the target rank (Wild excepted) the player who played it shoots; if all were genuine, the challenger shoots. Then a new round begins with a fresh deal. Players with no cards are skipped; if nobody else holds cards, you must challenge.' },
        { h: 'Russian Roulette', p: 'Each player has a 6-chamber revolver with 1 bullet at a random position (1-6), chosen independently per player (two players may share a position). When you must shoot you pull the trigger once: the chamber advances one slot per shot, and if the Nth shot lands on the bullet you are out; otherwise you are safe. Chambers are never reloaded, so every later shot is more dangerous.' },
        { h: 'Wild Card ★', p: 'A Wild counts as the target rank. If a challenged play contains only target-rank cards and Wilds, the challenger takes the shot.' },
        { h: 'Joker 👻', p: 'Play the Joker and claim it\'s the target rank. If challenged → everyone except the player who played it takes a shot! Called "wiping out the table."' },
        { h: 'Victory', p: 'The last player alive wins.' },
        { h: 'Strategy', p: 'If you have the target rank, tell the truth. If not, you must lie. Wild cards are your safety net. Hide the Joker until chambers are nearly full for maximum devastation. Challenge aggressively when an opponent\'s chamber is nearly full!' },
      ]
    },
    bigtwo: {
      sections: [
        { h: 'Goal', p: 'Big Two is a climbing game for 2-4 players. The first player to empty their hand wins. The others score the number of cards left in hand, and fewer is better. Only one hand is played per game.' },
        { h: 'Deal and first lead', p: 'A 52-card deck without jokers is divided evenly, floor(52 / players) cards each, with any leftover cards going to the first seats. The holder of the 3 of diamonds leads, and the first play must include that card.' },
        { h: 'Ranking', p: 'Ranks from low to high: 3 4 5 6 7 8 9 10 J Q K A 2. The 2 is the highest and the 3 is the lowest. Suits from high to low: spades, hearts, clubs, diamonds. Equal ranks are compared by suit.' },
        { h: 'Combinations', p: 'Single. Pair (compared by the higher suit of the two). Triple. Straight (5 or more consecutive ranks, up to 13 cards, the 2 may be used at the top, the 3 is lowest, no A-2-3 wrap, compared by the lowest card, so equal straights cannot beat each other). Flush (5 cards of one suit, not consecutive, compared by highest card then suit). Full house (triple plus pair, compared by the triple). Four plus one (compared by the four). Straight flush (5 consecutive cards of one suit, compared by lowest card then suit).' },
        { h: 'Beating a play', p: 'You must answer with the same combination type and the same number of cards, and it must be higher. Five-card hands do not outrank each other across types: a straight flush only beats another straight flush, a full house only beats a full house, and so on.' },
        { h: 'Passing and new rounds', p: 'You cannot pass when leading, only when following. You also cannot pass on your own play. When every other player has passed in a row, the last player to play leads again and may play any valid combination.' },
        { h: 'Winning and scoring', p: 'The first player to play all cards wins and the game ends at once. Every other player scores the number of cards remaining in hand. Lower is better and the winner has 0.' },
        { h: 'Tips', p: 'Get rid of low and awkward cards first and keep 2s and aces to take control of the lead. Straights shed many cards at once. When an opponent is nearly out, play the big combinations that are hard to beat.' },
      ]
    },
    'mahjong-sichuan': {
      title: 'Sichuan Mahjong',
      sections: [
        { h: 'Objective', p: 'Form a winning hand (4 melds + 1 pair) to win. Sichuan "Blood Battle" — after one player wins, others keep playing until 3 win or the wall is empty.' },
        { h: 'Void Suit', p: 'At the start everyone picks one suit (万/筒/条) as their "void" suit. You cannot win while any tile of that suit remains in your hand, so discard it early - pick the suit you hold the fewest of. Sichuan Mahjong uses only the 108 suit tiles (no winds, dragons or flowers) and has no chow: you can only pung or kong.' },
        { h: 'What is a Meld', p: 'Three types: ①Sequence (顺子) — 3 consecutive tiles of same suit (e.g. 2万3万4万); ②Triplet (刻子) — 3 identical tiles (e.g. 3筒3筒3筒); ③Kong (杠) — 4 identical tiles (counts as a meld, bonus points).' },
        { h: 'What is a Pair', p: 'The pair ("将") is 2 identical tiles (e.g. 5万 5万). A standard winning hand needs exactly 1 pair.' },
        { h: 'How to Pung', p: 'When another player discards a tile you hold 2 of, you may pung to make a triplet. After punging you must discard a tile immediately (no draw). There is no chow in Sichuan Mahjong.' },
        { h: 'How to Kong', p: 'Three types: ①Concealed Kong (暗杠) - you hold all 4 yourself; ②Exposed Kong (点杠) - you hold 3 and an opponent discards the 4th; ③Added Kong (补杠) - you already have a pung and draw the 4th. After any kong you draw a replacement tile from the wall tail.' },
        { h: 'How to Win', p: 'Two ways: ①Self-draw (自摸) — complete the hand yourself; ②Discard win (点炮) — claim another player\'s discard. Formula: 4 melds + 1 pair = win. Or 7 pairs (七对).' },
        { h: 'Winning Patterns', p: 'Standard: 4 melds (sequences/triplets) + 1 pair. Example: 234万+567万+222筒+888条+99条 = win. Seven Pairs: 7 pairs with no pung/kong (four identical tiles count as two pairs). Example: 22万+55万+33筒+44筒+66条+88条+99条.' },
        { h: 'Fan & Scoring', p: 'A win is worth at least 1 point (plain win). Bonuses: self-draw +1, all simples (no 1s or 9s) +1, all pungs (3+ melds laid down, all pungs/kongs) +2, seven pairs +4, one suit only +8, last-tile self-draw +1, each kong +2 to +3, each "root" (4 identical tiles in hand that were not konged) +1. Points equal the fan: on a self-draw every opponent who has not won yet pays that amount, on a discard win only the discarder pays.' },
        { h: 'Kong Payments (optional)', p: 'If the host turns on "Wind and Rain", kong points count in the round result: an exposed kong costs the discarder 2 points; a concealed kong costs every opponent who has not won 2 points each; an added kong costs each of them 1 point. With this on, the Flower Pig and Big Call payments at the end of the round also apply.' },
        { h: 'Blood Battle', p: 'After one player wins, they exit. Remaining players continue until 3 win or wall empties. First winner isn\'t necessarily the final winner — later wins can score higher.' },
        { h: 'Room Options', p: 'The host can toggle: Blood Battle (on by default; off means the round ends at the first win), multiple winners on one discard, Wind and Rain (kongs score points), check Flower Pig at draw, check Big Call at draw, last four tiles auto-win (you must win if you can when 4 tiles remain in the wall), and swap three (before play each player swaps 3 same-suit tiles with the player opposite). Everything except Blood Battle is off by default.' },
        { h: 'Draw (荒庄)', p: 'The round ends when the wall runs out; if nobody has won it is a draw. If the host enabled "check Flower Pig", players still holding void-suit tiles pay the others; if "check Big Call" is on, players who are not ready (听牌) pay those who are. Both are off by default.' },
        { h: 'Multi-Round Scoring', p: 'After each round the points are added to a running total. The winner becomes the next dealer; after a draw the deal rotates clockwise. There is no fixed number of rounds; keep playing and the highest total leads.' },
        { h: 'Winning Strategy', p: '①Discard your void suit first — you can\'t win with it; ②Keep "搭子" (partial sequences like 2万3万 waiting for 1万/4万); ③Watch opponents\' pungs/kongs — deduce their hand; ④In Blood Battle — sometimes wait for bigger fan; ⑤Prioritize reaching "ready" (听牌) status ASAP.' },
      ]
    },
    'mahjong-cantonese': {
      title: 'Cantonese Mahjong',
      sections: [
        { h: 'Objective', p: 'Cantonese (鸡平胡) - fastest to complete a winning hand wins, and one win ends the round; if the wall runs out with no winner the round is drawn. A win scores its fan as points: on a self-draw every opponent pays it, on a discard win only the discarder pays. Quick and casual.' },
        { h: 'You Can Chow!', p: 'Unlike Sichuan, Cantonese mahjong allows chowing! If the player before you (upstream) discards a tile you can form a sequence with, you can chow. Must discard immediately after.' },
        { h: 'Claim Priority', p: 'Win > Kong > Pung > Chow. If several players claim at the same level, the one closest to the discarder (in turn order) gets priority.' },
        { h: 'How to Pung', p: 'Discard matches a pair in your hand → Pung to make triplet. Must discard immediately. Works for all tiles including honours.' },
        { h: 'How to Kong', p: 'Concealed: draw all 4. Exposed: have 3, opponent discards 4th. Added: pung then draw 4th. Draw replacement from wall. 杠上花 (win on replacement) +1 fan.' },
        { h: 'How to Win', p: 'Self-draw or claim discard. Formula: 4 melds + 1 pair. Seven Pairs also wins.' },
        { h: 'Fan Types', p: 'A plain win (平胡) is worth 1 fan. Bonuses: self-draw +1, all simples (no 1s, 9s or honours) +1, win on kong replacement (杠上花) +1, last-tile self-draw (海底捞) +1, all pungs (3+ melds laid down, all pungs/kongs) +2, half flush (混一色) +2, seven pairs +2, full flush (清一色) +8, big three dragons (大三元) +8, big four winds (大四喜) +8, thirteen orphans (十三幺) +8. With the optional Red Dragon Wild (红中百搭) rule, winning with a Red Dragon in hand gives +1 fan.' },
        { h: 'Minimum and Cap', p: 'The host can set a minimum fan to win (none / 1 / 3; a hand below the minimum cannot win) and a fan cap (none / 3 / 4 / 5).' },
        { h: 'Special Hands', p: '大三元: three pungs of 中发白. 大四喜: four pungs of 东南西北. 十三幺: one of each terminal/honour tile (13 types) + one paired. These bypass the standard 4-meld+pair structure.' },
        { h: 'Buy Tiles (买码)', p: 'After winning, 4 tiles are automatically turned over from the wall tail. Each wind (东南西北) or dragon (中发白) among them scores +1 fan. The deck has no flower tiles. The host can turn this off in room settings.' },
        { h: 'Multiple Rounds', p: 'Scores accumulate across rounds. The winner deals next; after a draw the deal rotates clockwise. There is no fixed number of rounds.' },
        { h: 'Winning Strategy', p: 'Fast-paced — prioritize reaching ready status; keep middle tiles (4-6), edge tiles (1/9) are hard to use; watch opponents\' chows/pungs to deduce their hands; don\'t greed for big fans — win when you can.' },
      ]
    },
    texas: {
      sections: [
        { h: 'Goal', p: 'Texas Hold em supports up to 8 players. Each player has 2 hole cards and makes the best 5-card hand using the 5 community cards to win the pot. This version plays a single hand per game.' },
        { h: 'Chips and blinds', p: 'Every player starts with 1000 chips. The dealer button is fixed at seat 0. The small blind is the next seat and posts 10, and the big blind is the seat after that and posts 20.' },
        { h: 'Flow', p: 'Preflop (2 hole cards each), flop (3 community cards), turn (1), river (1), then showdown. Each betting round ends before the next stage. Preflop, the seat after the big blind acts first, and when heads-up the dealer acts first.' },
        { h: 'Actions', p: 'Fold gives up the hand. Check passes when there is nothing to call. Call matches the current bet. Raise sets your total bet for the round, which must exceed the current bet by at least the size of the last raise, or be at least 10 when nobody has bet this round. All-in pushes all remaining chips.' },
        { h: 'Hand ranking', p: 'From low to high: high card, pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush. The best 5 of the 7 available cards counts. A-2-3-4-5 is the lowest straight (the wheel). Equal hands are decided by kickers.' },
        { h: 'Result', p: 'If everyone else folds, the last player wins the pot. Otherwise the best hand at showdown wins the pot. If hands are exactly equal this version does not split the pot and the first best player takes it all. There are no side pots either, so everyone shares a single pot.' },
        { h: 'Tips', p: 'Raise with strong starting hands such as big pairs or ace-king, and do not chase weak hands from late position. Watch bet sizing to read opponents. Think before going all-in, because there is only one hand per game.' },
      ]
    },
    flightchess: {
      sections: [
        { h: 'Goal', p: 'Flight Chess is for 2-4 players with 4 planes each. The first player to bring all 4 planes home wins. Players who have finished are skipped in turn order.' },
        { h: 'Launching', p: 'Planes start in the base. You need a 6 to launch. A launched plane is placed on your start cell and captures any enemy plane standing there.' },
        { h: 'The route', p: 'The main path has 52 cells and each seat starts 13 cells apart. After the main path comes a home stretch of 6 cells, and you must land exactly on the final step (step 58). Overshooting makes you bounce back. Entering the home stretch from the main path does not bounce.' },
        { h: 'Capturing', p: 'Landing on a cell with enemy planes sends every enemy plane there back to base. There are no safe squares in this version.' },
        { h: 'Fly and jump cells', p: 'Step 8 is the fly cell: landing there flies you to step 32 and you stop, capturing anything on the landing cell. Cells of your own colour (steps divisible by 4, except step 8) jump you forward 4 cells and stop, but only if the jump ends before step 52.' },
        { h: 'Rolling', p: 'Rolling a 6 gives another roll. Three 6s in a row forfeit the turn. If all your planes are in base or home, after 5 rolls in a row without a 6 the next roll is guaranteed to be a 6.' },
        { h: 'No legal move', p: 'If no plane can move, the turn is skipped automatically, though a 6 still grants another roll. Plane colours are assigned randomly and are only cosmetic.' },
        { h: 'Tips', p: 'Use 6s to launch more planes. Prefer landings that capture or trigger a fly or jump. Count your steps near home to avoid bouncing back.' },
      ]
    },
    snakebattle: {
      sections: [
        { h: 'Goal', p: '2 to 6 players steer snakes at the same time on a 28x20 field. The last snake alive wins. Each snake starts 3 cells long from a different spawn point.' },
        { h: 'Controls', p: 'Arrow keys or WASD; on phones swipe on the board or use the on-screen arrows. Snakes advance one cell every 0.12 seconds and cannot reverse directly (a 180-degree turn is ignored).' },
        { h: 'Food', p: 'There is always one apple on the field and a new one appears on a free cell after it is eaten. Eating grows you by 1 and gives 1 point. Score is for display only and does not decide the winner.' },
        { h: 'Dying', p: 'You die by hitting a wall, any snake body (your own and the bodies of dead snakes included), or by two heads entering the same cell. Two heads swapping places kills both. A cell the tail is leaving can be entered right away, unless that snake is growing.' },
        { h: 'Corpses', p: 'A dead snake stays on the board as an obstacle until the round ends, so the field gets more crowded.' },
        { h: 'Winning', p: 'The round ends when at most one snake is alive and that survivor wins. If the last snakes all die on the same tick, it is a draw.' },
        { h: 'Tips', p: 'Stay near the edges and the outside of the pack, and use corpses to box opponents in; do not dive into tight spots for an apple. At least 2 players are needed; bots can fill seats.' },
      ]
    },
    chinesechess: {
      sections: [
        { h: 'Objective', p: 'Checkmate the enemy general. The board is 9x10 with 16 pieces per side; red is at the bottom and moves first.' },
        { h: 'Piece Moves', p: 'Chariot: any distance in a straight line, cannot jump. Horse: moves like an L, blocked if the square next to it in its first (straight) step is occupied. Cannon: moves like a chariot, but captures only by jumping over exactly one piece (the screen). Elephant: two squares diagonally, blocked if the middle point is occupied, cannot cross the river. Advisor: one square diagonally inside the palace. General: one square orthogonally inside the palace. Soldier: one step forward before the river; after crossing it can also step sideways, never backward.' },
        { h: 'Check and Flying General', p: 'After your move your own general must not be attacked, and the two generals must not face each other on a file with nothing between them. Moves that break this are not accepted.' },
        { h: 'Winning', p: 'If the player to move has no legal move, they lose, whether checkmated or stalemated. A position repeated three times, or 120 consecutive plies (60 per side) without a capture, is a draw.' },
        { h: 'Match Settings', p: 'The room can use best-of 1, 3 or 5; between games the seats swap so the red (first) side alternates.' },
        { h: 'Controls and Tips', p: 'Click one of your pieces to select it and see where it can go, then click the target. Illegal moves are rejected by the server. Develop chariots and horses early, use cannons to pin pieces, and always check whether your general is exposed to a cannon or chariot.' },
      ]
    },
    chess: {
      sections: [
        { h: 'Goal', p: 'Standard chess under full international rules. Two players; seat 1 plays White and moves first. Checkmate the enemy king to win.' },
        { h: 'Moving', p: 'Click one of your pieces to see green dots on legal squares, with a red ring on captures, then click the target. Only legal moves are accepted, and you must get out of check.' },
        { h: 'Special Moves', p: 'Castling, en passant and promotion are supported. A pawn reaching the last rank opens a promotion choice (queen, rook, bishop, knight); with no choice it becomes a queen.' },
        { h: 'Results', p: 'Checkmate wins for the mover. Draws: stalemate, insufficient material to mate, threefold repetition, and the 50-move rule.' },
        { h: 'Not Included', p: 'There is no resign button and no chess clock; games are untimed.' },
        { h: 'Matches', p: 'The host can pick a single game, best of 3 or best of 5. Seats swap between games so the first move alternates. Draws give no win; the player with more wins takes the match.' },
        { h: 'Bots and Tips', p: 'You can add a bot and pick its difficulty. Control the center, develop knights and bishops early and castle; after each move check whether an unprotected piece can be captured.' },
      ]
    },
    checkers: {
      sections: [
        { h: 'Objective', p: 'Capture all opposing pieces or leave the opponent with no legal move.' },
        { h: 'Board and Setup', p: '8x8 board, dark squares only, 12 men per side on the three rows nearest each player. Red (seat 1, at the bottom) moves first; black is at the top.' },
        { h: 'Men', p: 'A man moves one square diagonally forward onto an empty square and can never move backward. It also captures only forward: jump over an adjacent enemy piece onto the empty square right behind it, and the jumped piece is removed.' },
        { h: 'Kings', p: 'A man reaching the far row (top for red, bottom for black) becomes a king. A king moves or captures diagonally in all four directions, but only one square at a time (no flying kings).' },
        { h: 'Forced Capture', p: 'If any capture exists you must capture; a plain move is not allowed. After a capture, if the same piece can jump again from where it landed, it must keep jumping; if there are several options you choose. If a man becomes a king in the middle of a jump, its turn ends at once.' },
        { h: 'Winning', p: 'You win when, after your move, the opponent has no pieces or no legal move. This game has no draw rule.' },
        { h: 'Match Settings', p: 'The room can use best-of 1, 3 or 5; between games the seats swap so the first move alternates.' },
        { h: 'Controls and Tips', p: 'Click one of your pieces, then a target square; during a multi-jump keep clicking the next landing square. Legal targets are marked. Keep your back row as long as possible to delay enemy kings, and watch for trades that force you to capture into a multi-jump.' },
      ]
    },
    connect4: {
      sections: [
        { h: 'Objective', p: 'On a 7-column by 6-row upright board, be first to connect four of your discs horizontally, vertically or diagonally.' },
        { h: 'Dropping Discs', p: 'On your turn choose a column; the disc falls to the lowest empty slot of that column. A full column cannot be used. Yellow (seat 1) goes first, red (seat 2) second.' },
        { h: 'Win and Draw', p: 'After each drop the board checks the row, column and both diagonals for 4 or more in a row. If all 42 slots fill with no four, the game is a draw.' },
        { h: 'Controls', p: 'Click anywhere in a column (top or any cell) to drop a disc. On your turn the playable columns are marked, and the last move is highlighted.' },
        { h: 'Tips', p: 'The center column joins the most lines, so take it early. Block three in a row whose next slot is playable. Beware of traps: do not drop a disc that lets the opponent place one on top and complete four.' },
      ]
    },
    reversi: {
      sections: [
        { h: 'Objective', p: 'When the game ends, the player with more discs on the board wins.' },
        { h: 'Board and Setup', p: 'The room can use an 8x8, 10x10 or 12x12 board. The game starts with 4 discs in the center, two per player, placed diagonally. Black (seat 1) moves first.' },
        { h: 'Placing Discs', p: 'You must place a disc on an empty cell so that in at least one of the 8 directions a run of opponent discs is closed off by one of your own discs. All those bracketed opponent discs flip to your color. A cell that flips nothing is illegal.' },
        { h: 'No Legal Move', p: 'With no legal move you must pass; with a legal move available you cannot pass. If after your move the opponent has no legal move, you move again.' },
        { h: 'End and Result', p: 'The game ends when neither player has a legal move (including a full board). The player with more discs wins; equal counts are a draw.' },
        { h: 'Match Settings', p: 'The room can use best-of 1, 3 or 5. Between games the seats swap so the first move alternates.' },
        { h: 'Controls and Tips', p: 'Click an empty cell to play; faint dots mark legal moves. Corners can never be flipped, so they are very valuable, while cells next to a corner often give it away. Flip few discs early to keep mobility, and grab more near the end.' },
      ]
    },
    go9: {
      sections: [
        { h: 'Goal', p: '9x9 Go is played on a 9 by 9 board. Players alternate placing stones, and the aim is to surround more territory. Black is player 0 and moves first.' },
        { h: 'Placing and capturing', p: 'Stones are placed on intersections and never move. A liberty is an empty adjacent point. A group with no liberties is captured and removed. A move may capture enemy stones that have no liberties left.' },
        { h: 'Forbidden moves', p: 'Suicide (a move leaving your own group with no liberties) is illegal unless it captures enemy stones. Ko: after a single stone is captured, the opponent cannot immediately recapture on the same point and must wait a turn.' },
        { h: 'End of game', p: 'The game ends after two consecutive passes. To avoid endless games it also ends when the move count reaches 200.' },
        { h: 'Area scoring', p: 'Chinese area scoring is used: each side scores its stones on the board plus the empty regions touched only by its own colour. Because Black moves first, Black gives 3.75 points of komi, so Black score = area minus 3.75. The higher score wins and an exact tie is a draw.' },
        { h: 'Match mode', p: 'In the room settings you can choose a single game, best of 3 or best of 5. Seats swap after each game so the first move alternates. Bot difficulty can also be chosen in the room.' },
        { h: 'Tips', p: 'Take corners first, then sides. Keep your stones connected and with liberties instead of scattered. Remember the komi when counting the endgame.' },
      ]
    },
    drawguess: {
      sections: [
        { h: 'Objective', p: 'Draw, guess, and pass messages with friends. The host can choose between live drawing with real-time guessing (Stage Mode) or a telephone chain where messages drift hilariously off-course.' },
        { h: 'Two Modes', p: '🎤 Stage Mode: one artist draws live while everyone races to guess (unlimited tries; spaces and case are ignored). Earlier guesses score more (minimum 2 points, 10 if untimed) and the artist gets 1 point per correct guesser. A round ends when everyone has guessed or time runs out; everyone is artist once and the highest total wins. 🔇 Telephone Chain: Player 1 sees a word and draws it → Player 2 guesses from the drawing → Player 3 draws from that guess → alternating until the last player. Then everyone votes on whether the end result still matches the original word; if so, the player who started the chain gets 3 points. Everyone starts one chain and the highest total wins.' },
        { h: 'Word Selection', p: 'The first artist picks a word from several candidates (number adjustable in room settings). Timer auto-selects the first option if you run out of time.' },
        { h: 'Drawing', p: 'When it\'s your turn to draw, sketch based on the given word (or the previous guess). Change colors, brush width, use eraser and clear canvas. Auto-submits when time is up.' },
        { h: 'Guessing', p: 'When it\'s your turn to guess, look at the previous drawing and type your best guess. Your answer becomes the word for the next artist.' },
        { h: 'Reveal & Voting', p: 'After everyone finishes, the full chain is revealed step by step: Original Word → Drawing → Guess → Drawing → … → End Result. Everyone votes \'matches the original\' or \'drifted\'; a majority (or a tie) counts as a match and the starting player scores 3 points, otherwise 0. Then the next player starts a new chain, until everyone has started one.' },
        { h: 'Room Settings', p: 'The host can choose word categories (Animals, Food, Idioms, Internet Slang, etc.), set drawing/guessing time limits, number of candidate words, and add custom words.' },
      ]
    },
    monopoly: {
      sections: [
        { h: 'Objective', p: 'Bankrupt your opponents by buying properties and collecting rent. Be the last player standing. Everyone starts with $1500.' },
        { h: 'Movement', p: 'On your turn, click "Roll Dice" to advance by the total of both dice. Passing or landing on GO collects $200.' },
        { h: 'Buying & Rent', p: 'Land on an unowned property/railroad/utility to buy it (decline and it stays unowned - no auctions). Landing on someone else’s property costs rent: property rent grows with houses; railroads charge $60/$120/$240/$420 for 1/2/3/4 owned; utilities charge 10x the dice total.' },
        { h: 'Monopoly & Building', p: 'Owning every property of a color group is a monopoly: unimproved rent doubles, and on your own turn you can buy houses (each costs half the property price, up to 5 = Hotel) to drastically raise rent.' },
        { h: 'Chance Cards', p: 'Landing on "❓ Chance" draws a card: gain or lose money, collect $50 from every player, advance or go back, return to GO, go directly to Jail, or keep a Free Rent card that waives one property rent (not railroads or utilities) and is then used up.' },
        { h: 'Tax & Other Spaces', p: 'The "Income Tax" space costs $200. "Just Visiting" jail and "Free Parking" do nothing.' },
        { h: 'Jail', p: 'Landing on "Go to Jail" or drawing the Jail card sends you to Jail. Each turn there, roll: doubles frees you and you move by that roll; after 3 failed rolls you pay $50 and move by the third roll.' },
        { h: 'Bankruptcy', p: 'The moment your cash goes negative you are bankrupt and eliminated (there is no mortgaging, selling or trading) and your properties become unowned. Last player standing wins.' },
      ]
    },
    suikabattle: {
      sections: [
        { h: 'Goal', p: 'Drop fruit into your container; two identical fruits that touch merge into the next bigger one and score points. In multiplayer, the first containers to overflow are knocked out and the last one standing wins.' },
        { h: 'Controls', p: 'Move the mouse or finger to aim and click (or lift your finger) to drop the current fruit; the next one is previewed. There is a cooldown of about 0.6 seconds between drops. Dropped fruits are random among the 5 smallest.' },
        { h: 'Fruit Chain', p: 'There are 11 fruits: cherry, strawberry, grape, orange, lemon, kiwi, tomato, peach, pineapple, coconut, watermelon. Two of a kind make the next one; two watermelons vanish together.' },
        { h: 'Scoring', p: 'A merge scores the points of the new fruit: 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66. Two cherries making a strawberry give 3 points; two watermelons vanishing give 66. Dropping alone scores nothing.' },
        { h: 'Overflow', p: 'If a fruit rests above the danger line, almost motionless, for about 2 seconds, that player is out. Physics runs in each browser; the server only tracks scores and eliminations.' },
        { h: 'Winning', p: 'In multiplayer the last player not overflowed wins regardless of score; if everyone overflows, the highest score wins and ties go to the lower seat. Solo play runs until overflow and your final score is the result. 1 to 4 players.' },
        { h: 'Tips', p: 'Keep big fruits together on one side and small ones beside them waiting to merge; avoid letting fruits settle near the line. In a versus match, safe play beats greedy stacking.' },
      ]
    },
    sheeptile: {
      sections: [
        { h: 'Goal', p: 'Sheep Tile is a matching game for 1-6 players. Click tiles to place them into a 7-slot tray, and three tiles of the same pattern clear automatically. The first player to clear level 2 wins.' },
        { h: 'Clicking tiles', p: 'You can only click tiles that are not covered. A tile is covered when a higher tile overlaps it by more than a cell width in both directions. A clicked tile goes into the tray, and three identical tiles clear and give 3 points.' },
        { h: 'Losing', p: 'The tray has 7 slots and a player is eliminated when it fills up. If everyone is eliminated, the highest score wins. If only one player survives, that player wins.' },
        { h: 'Levels', p: 'Level 1 has 24 tiles with 6 patterns as a warm-up. Level 2 has 102 tiles with 14 patterns: a pyramid of 70, two side columns of 6, and two queues of 10 face-down tiles. Layouts are guaranteed to be solvable.' },
        { h: 'Powers', p: 'Each power can be used once per level and resets on a new level. Undo returns the last tile placed in the tray. Shuffle reshuffles the patterns of the remaining tiles. Pop 3 removes the first 3 tiles from the tray.' },
        { h: 'Room option: same board', p: 'On by default, so everyone plays the same board and races. If turned off, each player gets an independent random arrangement of patterns.' },
        { h: 'Tips', p: 'Look at lower layers before picking, and keep spare slots free. Save powers for the moment the tray is nearly full. Collect matching patterns in groups instead of filling the tray with scattered tiles.' },
      ]
    },
    sanguo: {
      sections: [
        { h: 'Goal', p: '4–8 players, each with a hidden role (the lord is public). The lord and loyalists must defeat all rebels and the spy; rebels must kill the lord; the spy wins by outlasting everyone and finishing the lord in a duel.' },
        { h: 'Turn', p: 'Everyone starts with 4 cards; the lord has +1 max health and goes first. Each turn: resolve cards in your judgement zone (Indulgence, Lightning) -> draw 2 -> play cards -> discard down to your current health. You may play one Slash per turn (unlimited with the Repeating Crossbow).' },
        { h: 'Basic Cards', p: 'Slash hits a player in range, who must play a Dodge or lose 1 health. Peach heals 1 (not usable at full health). At 0 health you are dying: anyone may play a Peach to save you, otherwise you die and discard all your cards.' },
        { h: 'Tricks', p: 'Dismantle, Snatch, Duel, Borrowed Blade, Barbarian Raid, Arrow Barrage, Peach Garden, Harvest, Windfall, Indulgence and Lightning. Nullify cancels any trick and can itself be nullified.' },
        { h: 'Equipment', p: 'Weapons set your attack range and add effects, armor defends, a +1 horse makes you harder to reach and a -1 horse brings others closer.' },
        { h: 'Generals', p: 'Everyone gets a random general whose skills are listed under your hand. Liu Bei, Sun Quan, Hua Tuo and Diao Chan have active skills (pick cards and targets, then tap the skill); the rest are passive or conversion skills.' },
        { h: 'Rewards and Penalties', p: 'Killing a rebel draws 3 cards; a lord who kills a loyalist discards all cards and equipment.' },
        { h: 'Tips', p: 'Tap a card to select it, then tap a seat if it needs a target. When asked to play Dodge, Nullify or Peach, tap Pass to decline. The play phase is limited to 40 s and responses to about 10-15 s; on timeout your turn ends or the response counts as a pass. There are no lord skills in this version. Bots can fill empty seats.' },
      ]
    },
    werewolf: {
      sections: [
        { h: 'How It Works', p: 'The phone is the moderator. At night, only players with an action see prompts; everyone else sees “night falls”. During the day you talk in person, or pick typed chat in the room settings and type on the phone; speaking order and votes always run on the phone.' },
        { h: 'Roles', p: 'Roles scale with the table: 6 players = 2 wolves, Seer, Witch, 2 villagers; 7 adds the Hunter; 8-10 have 3 wolves and more villagers; 11-12 add the Idiot (12 players = 4 wolves). Your role card stays face down until you tap it.' },
        { h: 'Night', p: 'Wolves agree on a victim (or no kill) and the Seer checks one player and learns whether they are a wolf. Then the Witch may use the antidote on the victim (never on herself) or the poison on anyone; each potion can be used only once per game, and only one per night.' },
        { h: 'Day', p: 'On day one you may elect a sheriff: candidates speak, the others vote. Then deaths are announced, first-night victims give last words, everyone alive speaks in turn, then an open discussion follows (it ends early once all tap Ready to vote), and then the exile vote; the exiled player gives last words. The sheriff’s vote counts 1.5 in the exile vote and they speak last. A tie leads to tie-break speeches and a revote; a second tie exiles nobody.' },
        { h: 'Typed Chat', p: 'With typed chat on: during turn-by-turn speeches only the current speaker can type; in the open discussion and the vote every living player can talk; at night the wolves get a channel only they can read; players who are out can only watch, apart from their last words.' },
        { h: 'Powers', p: 'The Hunter may shoot someone when he dies, unless poisoned. The Idiot survives his first exile by revealing but loses his vote. A dying sheriff passes or tears up the badge.' },
        { h: 'Winning', p: 'The village wins when every wolf is out. The wolves win when all special roles or all villagers are out.' },
        { h: 'Room Settings', p: 'The host picks how people talk (face to face or typed chat), the open discussion length (or off), the speech time and whether there is a sheriff election. Bots can fill empty seats; they act randomly and are mainly for trying the game.' },
      ]
    },
    truthdare: {
      sections: [
        { h: 'What Is This', p: 'A party prompt tool with no winner and no end condition. Decide who loses outside the app (for example rock-paper-scissors); the loser comes back and draws a card.' },
        { h: 'Drawing', p: 'Any player can tap Truth, Dare or Random at any time; there is no turn order. Random picks truth or dare 50/50 (or whichever kind has cards). The card is shown on every screen and the last 12 draws are kept in the history.' },
        { h: 'Built-in Decks', p: 'There are four decks: Icebreaker, Party, Deep Truths and Dare Challenge, each with 6 truths and 6 dares. Draws are random, so a card may repeat.' },
        { h: 'Custom Cards', p: 'In the room settings you can tick which decks are on and add your own truths and dares, one per line (semicolons also separate), up to 80 of each.' },
        { h: 'Fallbacks', p: 'If no deck is ticked, all built-in decks are used. If the chosen decks have no cards of a kind, it falls back to the default decks. An empty custom deck is not enabled.' },
        { h: 'Players', p: '2 to 10 players. Agree on the house rules; the person who draws completes the card, or follow whatever play style your group likes.' },
        { h: 'Tips', p: 'Pick decks to match the crowd: icebreakers for new acquaintances, deep truths for close friends. Redraw or agree to skip a card nobody is comfortable with.' },
      ]
    },
    hearts: {
      sections: [
        { h: 'Goal', p: 'Hearts is for exactly 4 players, 13 cards each. The aim is to take as few points as possible: each heart is 1 point and the queen of spades is 13, for 26 points per round. The game ends when anyone reaches 100 points, and the lowest total wins. Ties go to the lower seat.' },
        { h: 'Passing', p: 'Each round starts by passing 3 cards. The direction cycles: left, right, across, then no pass. On the no-pass round play starts right away. If you confirm without choosing, the 3 highest cards are passed automatically.' },
        { h: 'Playing tricks', p: 'The holder of the 2 of clubs leads and must play it on the first trick. After that you must follow the suit led, and if you have none you may discard anything. On the first trick you cannot discard a heart or the queen of spades if you hold any other card.' },
        { h: 'Breaking hearts', p: 'Hearts cannot be led until a heart has been played, unless you hold only hearts. Only a heart breaks hearts. Playing the queen of spades does not.' },
        { h: 'Winning a trick', p: 'The highest card of the suit led wins the trick. The winner collects all point cards in it and leads the next trick.' },
        { h: 'Shooting the moon', p: 'If one player takes all 26 points in a round, that player scores 0 and each of the other three scores 26. This is risky and only worth trying with an extreme hand.' },
        { h: 'Bot difficulty', p: 'You can choose the bot difficulty in the room. Higher levels count cards better and are better at dodging or dumping points.' },
        { h: 'Tips', p: 'Pass away big cards and the queen, ace and king of spades. Watch where the queen of spades goes and avoid ending up with it. Dump dangerous high cards early.' },
      ]
    },
    battleship: {
      sections: [
        { h: 'Goal', p: 'A two-player naval duel on a 10x10 sea. Place your fleet, then take turns shooting at the enemy sea. Sink all 5 enemy ships first to win.' },
        { h: 'Placement', p: 'The fleet is fixed: carrier 5, battleship 4, cruiser 3, submarine 3, destroyer 2. Place them in order with no overlap or leaving the board, though ships may touch. Drag from the tray or tap a cell; tap, the rotate button or right-click switches horizontal and vertical. Both sides place at the same time and the battle starts when both are done.' },
        { h: 'Shooting', p: 'Seat 1 fires first. Pick one cell of the enemy sea per shot; a cell already shot cannot be shot again. The result is miss, hit or sunk.' },
        { h: 'Turns', p: 'A hit gives no extra turn. After every shot, hit or miss, the turn passes to the opponent.' },
        { h: 'Sinking', p: 'When you sink a ship, its type and full outline are revealed to you, which helps you plan against the remaining ships.' },
        { h: 'Winning', p: 'The first to sink all 5 enemy ships wins; there are no draws. Enemy ship positions are shown after the game.' },
        { h: 'Bots and Tips', p: 'You can add a bot and choose its difficulty. Do not always hug the edges or line ships up; when you score a hit, probe the four neighbors, and search on a checkerboard pattern since every ship is at least 2 cells long.' },
      ]
    },
  };

  function getTutorials() {
    return (window.__ACTIVE_LANG === 'en' && window.__LANG && window.__LANG.en) ? TUTORIALS_EN : TUTORIALS_ZH;
  }

  // ---- Tutorial overlay ----
  function showTutorial(gameType) {
    var t = getTutorials()[gameType];
    if (!t) return;

    var overlay = document.getElementById('tutorialOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tutorialOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(overlay);
    }

    var catalogEntry = window.gameCatalog && window.gameCatalog.byId(gameType);
    // 变体（如 mahjong-cantonese）在大厅目录里没有条目，byId 会返回 null，
    // 此时用教程自带的 title，否则会把原始 key 显示出来。
    var title = t.title || (catalogEntry ? catalogEntry.name : gameType);

    var html = '<div style="background:var(--surface);border-radius:var(--radius);padding:24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">';
    // 右上角 ✕ 关闭（不依赖滚到底部）
    html += '<div onclick="document.getElementById(\'tutorialOverlay\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:17px;line-height:1;color:var(--text-muted);background:var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.2);">✕</div>';
    html += '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">📖 ' + _tf('tutorial_title', title) + '</div>';
    html += '<div style="width:36px;height:2px;background:var(--accent);margin-bottom:16px;"></div>';

    for (var i = 0; i < t.sections.length; i++) {
      var s = t.sections[i];
      html += '<div style="margin-bottom:14px;">';
      html += '<div style="font-size:15px;font-weight:700;margin-bottom:4px;">' + s.h + '</div>';
      html += '<div style="font-size:14px;color:var(--text-muted);line-height:1.6;">' + s.p + '</div>';
      html += '</div>';
    }

    html += '<button class="btn btn-primary" onclick="document.getElementById(\'tutorialOverlay\').style.display=\'none\'" style="margin-top:8px;">' + (typeof _t === 'function' ? _t('got_it') : '知道了') + '</button>';
    html += '</div>';

    overlay.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }

  window.showGameTutorial = showTutorial;
})();
