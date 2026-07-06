// public/js/tutorials.js
// Game tutorial system — shows rules overlay for each game
(function() {
  var TUTORIALS_ZH = {
    tictactoe: {
      sections: [
        { h: '游戏目标', p: '在 3×3 的网格中，先将自己的三个棋子连成一线（横、竖、斜均可）获胜。' },
        { h: '回合流程', p: '双方轮流在空格中落子。先手为 ⨉，后手为 ○。' },
        { h: '平局', p: '如果棋盘填满且无人连成一线，则判定为平局。' },
      ]
    },
    gomoku: {
      sections: [
        { h: '游戏目标', p: '在 15×15 的棋盘上，先将五颗棋子连成一线（横、竖、斜均可）获胜。' },
        { h: '回合流程', p: '双方轮流落子。黑棋先手，白棋后手。落子后不能移动。' },
        { h: '策略提示', p: '注意防守对方的活三和活四，同时寻找自己的连珠机会。' },
      ]
    },
    davinci: {
      sections: [
        { h: '游戏目标', p: '猜出所有对手的牌，成为最后存活的玩家。' },
        { h: '牌组', p: '26张牌：黑色 0-11、白色 0-11，外加 2 张万能牌（★）。万能牌可放在任意位置。' },
        { h: '排序规则', p: '数字从小到大排列，相同数字黑色在左、白色在右。万能牌停留在你放置的位置，不会被自动排序移动。' },
        { h: '回合流程', p: '①抽牌：从牌堆抽一张牌自己看。②猜牌：点击对手的一张暗牌，选择颜色和数字进行猜测。③猜对：对手的牌翻开，可选择继续猜或结束。④猜错：进入惩罚阶段，必须翻开自己一张牌。⑤过：不猜，将抽到的牌面朝下插入自己的牌列。' },
        { h: '惩罚阶段', p: '猜错后需翻开自己一张未翻的牌。点击自己的暗牌选择翻开哪张。' },
        { h: '万能牌', p: '抽到万能牌时（包括开局抽到的第一张），需要自己选择把它插在牌列的哪个位置。放好之后整局都不会再移动。猜测万能牌时选择"★万能"颜色即可。' },
      ]
    },
    uno: {
      sections: [
        { h: '游戏目标', p: '尽快出完手中所有牌，出完时喊"UNO"。' },
        { h: '出牌规则', p: '可以出与弃牌堆顶牌颜色相同或数字相同的牌。万能牌可随时出。' },
        { h: '功能牌', p: '⊘跳过：跳过下家。↻反转：改变出牌方向（2人时等同跳过）。+2：下家摸2张且跳过。★万能：可指定下个颜色。+4：万能且下家摸4张。' },
        { h: '叠加规则', p: '+2 和 +4 可以叠加！被罚 +2 的人可以出 +2 或 +4 将累计罚牌继续传递下去；被罚 +4 同理。如果不出叠加牌则必须一次性摸走所有累计罚牌。' },
        { h: '摸牌', p: '无牌可出时必须摸1张。摸到可出的牌可立即出或保留。' },
        { h: 'UNO!', p: '手牌只剩1张时记得喊 UNO！' },
      ]
    },
    doudizhu: {
      sections: [
        { h: '游戏目标', p: '地主需先出完所有牌，农民方任意一人先出完则农民胜。' },
        { h: '发牌', p: '每人17张，底牌3张。叫分最高者成为地主，获得底牌。' },
        { h: '叫地主', p: '轮流叫分（1-3分或不叫）。叫分最高者成为地主。无人叫分则重新发牌。' },
        { h: '牌型', p: '单张、对子、三条、三带一、三带二、顺子（≥5张连续）、连对（≥3对连续）、飞机（连续三条）、炸弹（四张相同）、火箭（大王+小王）。' },
        { h: '出牌规则', p: '首家自由出牌，后续必须出相同类型且更大的牌（或炸弹/火箭）。可选择不出（过）。' },
        { h: '大小', p: '火箭 > 炸弹 > 普通牌。普通牌按 3<4<5<6<7<8<9<10<J<Q<K<A<2<小王<大王。' },
      ]
    },
    'exploding-kittens': {
      sections: [
        { h: '游戏目标', p: '活到最后！避免抽到爆炸猫，成为唯一的幸存者。' },
        { h: '牌组', p: '💣爆炸猫（抽到则淘汰）、🔧拆除（化解爆炸）、⏭跳过（不抽牌结束回合）、⚔甩锅（指定一名玩家连玩两回合）、🔮预言（偷看牌堆顶3张）、🔀洗混（洗牌）、🎁/👋偷牌（随机偷取对手一张牌）。' },
        { h: '回合流程', p: '①打牌阶段（可选）：可打任意多张道具牌或一张不打。②抽牌阶段（必须）：从牌堆顶抽1张结束回合。抽到爆炸猫且无拆除卡则立即淘汰！' },
        { h: '偷牌', p: '打出偷牌（🎁/👋）并选择一名对手，立即从对方手中随机抽走一张牌据为己有。' },
        { h: '拆除陷阱', p: '用拆除卡化解爆炸后，可将爆炸猫秘密放回牌堆任意位置（可放最上面害人！）。' },
      ]
    },
    rummikub: {
      sections: [
        { h: '游戏目标', p: '最先出完手中所有牌。出完时喊一声"拉密！"。' },
        { h: '牌组', p: '106张牌：4种颜色（黑蓝红橙）× 数字1-13 各2张 + 2张百搭牌（★）。每人发14张。' },
        { h: '合法牌组', p: '①顺组：同颜色、连续数字，至少3张（如 🔴3-4-5）。②群组：不同颜色、相同数字，至少3张（如 🔴7-🔵7-🟠7）。' },
        { h: '破冰规则', p: '首次出牌必须用自己手上的牌组成合法牌组，且总分 ≥ 30分。百搭牌计0分。可在设置中关闭此规则。' },
        { h: '破冰后', p: '每回合可出任意多张牌：①打出新的顺组或群组。②在桌面已有牌组上接牌。③点"🔀重组牌桌"进入操作台拿桌面牌重组。无法出牌时摸1张并结束回合。' },
        { h: '重组牌桌', p: '操作台里桌面所有牌组+你的手牌会分格摊开。点牌选中→点目标牌组放入，可拆开、合并、新建牌组，自由拿用桌面上的牌。要求：①每个牌组都合法（绿框）②至少用掉1张自己的手牌③桌面原有的牌不能丢。完成点"提交"，不满意点"取消"还原。' },
        { h: '百搭牌', p: '可代替任意牌使用。游戏结束时仍留在手中的每张百搭牌扣30分。' },
      ]
    },
    twentyfour: {
      sections: [
        { h: '游戏目标', p: '用给出的 4 个数字（每个用且仅用一次），通过加减乘除和括号算出 24。多轮比拼，胜场最多者夺冠。' },
        { h: '操作', p: '点击数字和运算符（+ − × ÷ 与括号）组合算式，点"提交"。可用"撤销/清空"修改。' },
        { h: '计时模式', p: '若房主设置了每轮限时：你算对后会进入等待，不会立刻结束本轮；倒计时结束时，所有人一起进入下一轮，本轮由"最快答对"的人得分。' },
        { h: '算错提示', p: '提交的算式若不等于 24，会直接显示你这次算出来的结果，方便你调整。' },
        { h: '无计时模式', p: '若未设置限时，则第一个答对的人立即赢得本轮。' },
      ]
    },
    minesweeper: {
      sections: [
        { h: '游戏目标', p: '在同一张扫雷图上与其他玩家竞速！抢先翻开所有安全格即可获胜。翻到地雷则立即出局。' },
        { h: '操作方式', p: '🖱️ 电脑：左键翻格格、右键标旗。📱 手机/平板：点按翻格、长按 0.5 秒标旗。数字表示周围 8 格有几颗雷，空白区域（数字0）自动展开。' },
        { h: '胜负与平局', p: '①最先翻开所有安全格的玩家胜。②只剩一人生还时该玩家胜。③全部玩家都踩雷出局则为平局。出局后可继续观战。' },
        { h: '策略提示', p: '利用数字推理雷的位置。不确定的地方先标旗子。竞速中不必标出所有雷——标自己需要的，大胆翻安全的格子。' },
      ]
    },
    numberbomb: {
      sections: [
        { h: '游戏目标', p: '在 1-100 之间轮流猜数字，避免踩中炸弹！踩中炸弹扣一条命，最后存活者获胜。' },
        { h: '回合流程', p: '系统随机设定炸弹数字。玩家轮流猜，猜完后范围自动缩小。猜到炸弹数字的人扣一条命并进入下一轮，炸弹重新随机。' },
        { h: '输入方式', p: '可以点击数字键拼成数字，也可以用键盘输入。输入完成后点击"猜！"或按回车确认。' },
        { h: '命数与胜负', p: '每人 3 条命。命扣完即出局。剩余最后一人获胜。若所有人同时阵亡则为平局。' },
        { h: '策略提示', p: '二分法不等于安全——你每次猜一个数字，如果正好运气好就会踩雷。观察对手猜过的范围，找安全的中间点。' },
      ]
    },
    oldmaid: {
      sections: [
        { h: '游戏目标', p: '尽快丢掉手中所有牌。游戏结束时手拿鬼牌的人输！' },
        { h: '发牌与配对', p: '一副 53 张（52 张正常牌 + 1 张鬼牌👻）均发给所有人。发牌后每人先自动弃掉手中数字相同的对子。鬼牌无法配对。' },
        { h: '回合流程', p: '①点击一个对手的头像。②对手的牌会面朝下展示，点击其中一张抽取。③若抽到的牌与手中某牌成对，自动丢弃。④轮到下家抽牌。' },
        { h: '胜负与平局', p: '手牌全部清空的玩家安全退出。最后剩一人手拿鬼牌——此人败北。若最后两人同时清空则为平局（鬼牌已在之前的抽牌中随对子丢弃）。' },
        { h: '小技巧', p: '如果你手里有鬼牌，尽量假动作干扰对手判断，让别人觉得鬼牌不在你手里。如果别人拼命抽你某张牌，说明他手中有相同数字想凑对。' },
      ]
    },
    liarsbar: {
      sections: [
        { h: '游戏目标', p: '出牌面朝下声称牌面，可以说谎也可以说真话。活到最后即是赢家！' },
        { h: '牌堆', p: 'J、Q、K（每花色各 2 张 = 24 张）+ 万能牌★（4 张）+ 鬼牌👻（1 张）。万能牌永远是"真话"，鬼牌被质疑时除出牌者外所有人开枪。' },
        { h: '回合流程', p: '①系统抽一张主题牌（J/Q/K 之一）。②每人发 5 张手牌，轮流面朝下出一张牌并声称是该主题。③下家可接受（继续出牌）或质疑（翻开上家的牌）。④质疑后本圈结束，判谁撒谎谁开枪，然后重新发牌。' },
        { h: '俄罗斯转盘', p: '每人一把 6 发弹仓的左轮手枪，6 个位置中只有 1 发子弹，位置随机（1-6）。被质疑判定撒谎时开枪：弹仓每次开火后前进一格，第 N 枪如果恰好转到子弹位置即阵亡。没子弹则安全过关。每人的子弹位置独立且互不相同——有人可能第 1 枪就中，有人能撑到第 6 枪。' },
        { h: '万能牌★', p: '万能牌可当作任何牌，永远不会被质疑成功。质疑万能牌的人自己开枪。' },
        { h: '鬼牌👻', p: '打出鬼牌并声称是主题牌，如果被质疑 → 出牌者之外的所有人都要开一枪！俗称"一网打尽"。' },
        { h: '胜负', p: '最后存活的玩家获胜。所有人同时阵亡则平局。' },
        { h: '策略', p: '手牌中有主题牌就说真话。没有主题牌就得说谎。万能牌是安全牌。鬼牌尽量藏着，等弹仓接近装满时用最狠。对方弹仓快满时积极质疑逼他开枪！' },
      ]
    },
    bigtwo: {
      sections: [
        { h: '游戏目标', p: '最先出完手中所有牌即为赢家。' },
        { h: '牌型', p: '单张、对子、三条、顺子（≥5张连续）、同花（5张同花色）、葫芦（三条+对子）、铁支（四条+单张）、同花顺（5张连续同花）。' },
        { h: '出牌规则', p: '持 ♦3 者先出。必须出与上家相同张数和类型的牌型才能打过（同类型比大小）。不能打过则过牌。所有人过牌后，最后出牌者自由出牌。' },
        { h: '比大小', p: '牌面：3<4<5<6<7<8<9<10<J<Q<K<A<2。花色：♠>♥>♣>♦。同牌面时比花色。' },
        { h: '胜负', p: '先出完者胜。其余玩家按剩余牌数计分。' },
      ]
    },
    texas: {
      sections: [
        { h: '游戏目标', p: '通过下注、加注、弃牌等策略，在摊牌时用最好的五张牌赢得彩池。' },
        { h: '发牌', p: '每人 2 张底牌（仅自己可见）。系统分三轮发出 5 张公共牌：翻牌(3张)→转牌(1张)→河牌(1张)。' },
        { h: '下注四轮', p: '翻牌前→翻牌→转牌→河牌，每轮可操作：弃牌、过牌、跟注、加注、全下。' },
        { h: '牌型大小', p: '高牌 < 一对 < 两对 < 三条 < 顺子 < 同花 < 葫芦 < 铁支 < 同花顺。' },
        { h: '盲注', p: '每局两人自动下盲注（小盲注/大盲注），确保彩池有底。庄家标记按序轮换。' },
        { h: '全下', p: '筹码不够跟注时可以全下。全下后只能摊牌，不再参与后续下注。' },
      ]
    },
    flightchess: {
      sections: [
        { h: '游戏目标', p: '将自己的 4 架飞机从基地出发，绕棋盘一圈并回到终点。最先完成所有 4 架飞机的玩家获胜。' },
        { h: '起飞', p: '掷到 6 才能将一架飞机从基地放到起点格。掷到 6 后可以再掷一次。' },
        { h: '移动', p: '掷骰子后点击一架飞机前进骰子点数。飞机沿路径顺时针移动。' },
        { h: '踩人', p: '如果你的飞机落在对手飞机所在格，对手的飞机会被送回基地重新开始。' },
        { h: '跳板', p: '落在自己颜色的格子上可以跳 4 格。如果跳到的格也是自己的颜色，可以再跳一次。' },
        { h: '回家', p: '飞机需要精准点数才能进入终点区。终点区不需要精准点数，到达终点飞机即完成。' },
        { h: '连续 6 点', p: '连续三次掷到 6 → 直接结束回合，不能移动。' },
      ]
    },
    snakebattle: {
      sections: [
        { h: '游戏目标', p: '所有人进入同一张地图操控自己的蛇。撞墙、撞到蛇身或和其他蛇同时抢到同一格都会淘汰，最后存活者获胜。' },
        { h: '怎么移动', p: '手机可在棋盘上滑动或点击下方方向键；电脑可用方向键或 WASD。每次操作只改变下一步方向，不能原地掉头。' },
        { h: '吃苹果', p: '吃到 🍎 后蛇会变长一格，并在空格重新生成苹果。蛇越长分数越高，也越难避开自己。' },
        { h: '碰撞规则', p: '碰到墙或任何没有腾空的蛇身会立刻出局。两条蛇同时进入同一格、或互相交换蛇头位置时都会淘汰。' },
        { h: '观战与获胜', p: '出局后仍可观看其他玩家。若所有蛇同一时刻淘汰则为平局；否则最后一条存活的蛇获胜。' },
      ]
    },
    chinesechess: {
      sections: [
        { h: '游戏目标', p: '将死对方的将/帅（让对方无路可逃）即获胜。9×10 棋盘，红黑各 16 子。' },
        { h: '棋子走法', p: '车：直线走任意格。马：走日字（蹩马腿）。炮：直线走，吃子须隔一子。象/相：田字对角（塞象眼），不过河。士/仕：九宫斜走一格。将/帅：九宫直走一格，不能对面。兵/卒：过河前直走一格，过河后可横走。' },
        { h: '将军与将死', p: '移动后不能让自己的将帅被将军。如果一方无合法走法且被将军则为将死，对方胜。无合法走法但未被将军也是输（困毙）。' },
        { h: '操作', p: '点击己方棋子选中，再点击目标位置落子。非法走法会被服务器拒绝。' },
      ]
    },
    chess: {
      sections: [
        { h: '游戏目标', p: '将死对方的王（King）即获胜。8×8 黑白格棋盘，双方各 16 子。' },
        { h: '棋子走法', p: '王(K)：任意方向一格。后(Q)：任意直线任意距离。车(R)：横竖直线。象(B)：斜线。马(N)：L形（日字，无蹩腿）。兵(P)：向前一格，首步可走两格，斜吃。' },
        { h: '特殊规则', p: '王车易位：王和车之间无子且未被将军时可同时移动。吃过路兵：兵首步走两格后，相邻对方兵可斜吃。升变：兵到底线可变为后/车/象/马。' },
        { h: '胜负判定', p: '将死对方王获胜。困毙（无合法走法但未被将军）为和棋。50步无吃子/三次重复局面/子力不足也可和棋。' },
        { h: '操作', p: '点击己方棋子选中（显示绿色走法点），再点击目标位置落子。红色圈表示可吃子。兵到底线弹出升变选择。' },
      ]
    },
    checkers: {
      sections: [
        { h: '游戏目标', p: '吃掉对方所有棋子或使其无路可走。8×8 棋盘，仅用深色格，双方各 12 子。' },
        { h: '棋子走法', p: '普通子(m)：向前斜走一格。王(k)：前后斜走均可。吃子：跳过相邻敌方子落到其后空格。' },
        { h: '强制吃子', p: '有吃子选项时必须吃子。可连吃（跳过多个敌方子）。普通子到底线升为王。' },
        { h: '操作', p: '点击己方棋子选中，再点击目标位置落子。红色圈表示可吃子位置。' },
      ]
    },
    connect4: {
      sections: [
        { h: '游戏目标', p: '先在横/竖/斜方向连成 4 子即获胜。7 列 × 6 行棋盘。' },
        { h: '落子规则', p: '选一列投入棋子，棋子自动落到底部空位。黄色先手，红色后手。' },
        { h: '胜负判定', p: '横/竖/斜任意方向 4 子连珠获胜。棋盘满无连珠则平局。' },
        { h: '操作', p: '点击列顶部或直接点击列中任意位置即可落子。' },
      ]
    },
    reversi: {
      sections: [
        { h: '游戏目标', p: '棋盘上棋子多的一方获胜。8×8 棋盘，开局中心 4 子（黑先）。' },
        { h: '落子规则', p: '落子必须能夹住至少一个对方子（8 方向直线）。被夹的对方子全部翻转为己方。' },
        { h: 'Pass 与结束', p: '无合法走法则跳过(pass)。双方都 pass 或棋盘满时结束，数子定胜负。' },
        { h: '操作', p: '点击空格落子。半透明圆点表示可落子位置。' },
      ]
    },
    go9: {
      sections: [
        { h: '游戏目标', p: '在 9×9 棋盘上围地。终局时，占地（棋子+所围空）多的一方获胜。白方有 6.5 目贴目。' },
        { h: '落子', p: '黑白交替在交叉点落子。棋子落定后不可移动。' },
        { h: '提子', p: '当一块棋的所有气（相邻空位）被堵住时，该块棋被提走。提子计入你的俘虏。' },
        { h: '打劫', p: '不能立刻提回刚被对方提掉单个子的位置（需要先在别处走一步）。标记为红点的位置当前禁止落子。' },
        { h: '禁着点', p: '不能落在自己棋子会被立刻提走的位置（自杀），除非落子能提掉对方棋子。' },
        { h: '终局', p: '双方连续过手两次 → 游戏结束，自动判分。点击「过手」按钮放弃当回合。' },
        { h: '计分', p: '中国规则：己方盘上棋子数 + 围住的空位数 = 得分。白方加 6.5 目贴目。' },
      ]
    },
    drawguess: {
      sections: [
        { h: '游戏目标', p: '和朋友一起画图、猜词与传递信息。房主可选择实时抢答的舞台猜词，或会逐步跑偏的悄悄话传画。' },
        { h: '两种玩法', p: '🎤 舞台猜词：一名画家实时作画，其余玩家同时抢答。答对得分，轮流当画家，累计积分最高者获胜。🔇 悄悄话传画：第 1 人看到词后作画 → 传给第 2 人猜词 → 第 2 人看到的词传给第 3 人作画 → 交替传递到最后一人。全部完成后逐步揭示整条传话链，全员投票选出最有趣的一步。' },
        { h: '选词', p: '第一位画家从几个候选词中选一个开画（候选词数量可在房间设置中调整）。超时会自动选第一个词。' },
        { h: '画画', p: '轮到你画时，根据词语（或上一位玩家猜的词）在画板上作画。可换颜色、笔宽，可用橡皮和清空。限时结束会自动提交。' },
        { h: '猜词', p: '轮到你猜时，看上一位玩家的画，输入你猜的词。你的答案会传给下一位画家。' },
        { h: '揭示与投票', p: '所有人完成后系统逐步揭示整条传话链：原词 → 画 → 猜词 → 画 → … → 最终猜词。每人投票给最有趣或最离谱的一步，得票最多的那步的作者获胜。即使最终猜词与原词完全不同也很有趣！' },
        { h: '房间设置', p: '房主可选词库分类（动物/食物/成语/网络热词等）、画画/猜词限时、候选词数量，还能添加自定义词。' },
      ]
    },
    monopoly: {
      sections: [
        { h: '游戏目标', p: '通过买地、收租让对手破产，成为最后存活的玩家。每人起始 1500 元。' },
        { h: '掷骰移动', p: '轮到你点「掷骰子」，棋子按点数前进。绕棋盘一圈经过起点可领 200 元。' },
        { h: '买地与收租', p: '停在无主地产/车站/电力公司可购买。停在别人的地产要付租金，租金随房子数增加。' },
        { h: '垄断与建房', p: '集齐同色组的全部地产即垄断：空地租金翻倍；可在回合结束阶段花钱盖房（最多 5 级=旅馆），租金大涨。' },
        { h: '机会卡', p: '停在「❓机会」格抽一张卡：可能得钱、罚款、前进/后退、直接入狱或获得免租卡。' },
        { h: '监狱', p: '踩到「入狱」角格会被关进监狱，需掷出双数才能出狱，3 回合未出则交 50 元强制出狱。' },
        { h: '破产', p: '现金为负即破产出局，名下地产释放。最后剩下的玩家获胜。' },
      ]
    },
    suikabattle: {
      sections: [
        { h: '游戏目标', p: '控制水果落点，让相同水果碰撞合成为更大的水果，累积更高分数。单人可挑战自己的最高分，多人比谁坚持得更久。' },
        { h: '投放水果', p: '移动上方的水果到合适的位置后点击或松手投下。当前水果会落下，下一颗水果会显示在预告位置。' },
        { h: '合成得分', p: '两颗相同水果相撞会合成更大的水果，并按合成等级获得分数。尽量让场地保持平整，为后续合成留出空间。' },
        { h: '结束与胜负', p: '水果堆到警戒线以上并停留时即出局。多人对局中最后未出局的玩家获胜；单人对局按最终分数结算。' },
        { h: '小技巧', p: '优先把较小水果集中在一侧，避免把不同大小的水果散落在中间；预留顶部空间比追求一次合成更重要。' },
      ]
    },
    sheeptile: {
      sections: [
        { h: '游戏目标', p: '把堆叠的卡牌全部消除即可通关。共两关：第 1 关轻松热身，第 2 关难度大幅提升。' },
        { h: '消除规则', p: '点击没有被上层遮挡的卡牌，它会飞入底部的 7 格槽位。槽位中集齐 3 张相同图案自动消除。' },
        { h: '爆槽出局', p: '槽位被 7 张未消除的卡牌占满就爆槽出局。出局后可观战。' },
        { h: '暗牌队列', p: '第 2 关底部有面朝下的暗牌队列（❔），只有露出的一端可以点击。翻开后才能看到图案，需要提前规划消除顺序，避免卡死。' },
        { h: '道具', p: '每关各有 1 次：↩撤回（退回上一张）、🔀洗牌（打乱剩余图案）、⏏移出3张（清掉槽位前 3 张缓解压力）。' },
        { h: '对战', p: '所有人独立解题、看不到对方怎么点，只能看到对手进度条。先通关（清空第 2 关）者获胜；也可比谁活得久。' },
        { h: '房间设置', p: '房主可选「同一张棋盘」（所有人棋盘相同，公平比手速）或「各自随机」。' },
      ]
    },
    truthdare: {
      sections: [
        { h: '页面定位', p: '这是一个聚会抽题工具。场外剪刀石头布决定谁输，输的人回到页面点击抽卡。页面负责同步题目，不负责判胜负。' },
        { h: '怎么开始', p: '进入房间后所有人准备，房主点击开始。开始后可以选择「真心话」「大冒险」或「随机来一张」。' },
        { h: '抽卡同步', p: '任意玩家抽到的题目会同步给房间内所有人，中央卡片显示当前题目，下方会保留最近抽到的记录。' },
        { h: '牌库类型', p: '房主可以启用轻松破冰、朋友聚会、深度真心话、大冒险挑战等不同类型的牌库。' },
        { h: '自定义牌库', p: '房主可在等待房间里填写自定义真心话和自定义大冒险，一行一条；保存后勾选「自定义」牌库即可加入抽卡范围。' },
        { h: '小建议', p: '如果不想太刺激，就先开轻松破冰和朋友聚会；熟人局再加入深度真心话或大冒险挑战。' },
      ]
    },
  };

  var TUTORIALS_EN = {
    tictactoe: {
      sections: [
        { h: 'Objective', p: 'Be the first to get three of your marks in a row (horizontally, vertically, or diagonally) on a 3×3 grid.' },
        { h: 'Gameplay', p: 'Players take turns placing their mark in an empty cell. First player is ⨉, second is ○.' },
        { h: 'Draw', p: 'If the board fills up with no winner, the game ends in a draw.' },
      ]
    },
    gomoku: {
      sections: [
        { h: 'Objective', p: 'Be the first to get five stones in a row (horizontally, vertically, or diagonally) on a 15×15 board.' },
        { h: 'Gameplay', p: 'Players take turns placing stones. Black goes first, White second. Stones cannot be moved once placed.' },
        { h: 'Strategy', p: 'Watch for your opponent\'s open-threes and open-fours while building your own winning lines.' },
      ]
    },
    davinci: {
      sections: [
        { h: 'Objective', p: 'Guess all opponents\' hidden tiles to become the last player standing.' },
        { h: 'Tile Set', p: '26 tiles: Black 0-11, White 0-11, plus 2 wild tiles (★). Wild tiles can be placed anywhere in your sequence.' },
        { h: 'Sorting Rule', p: 'Tiles are arranged smallest to largest; same number: black left, white right. Wild tiles stay where you place them — they won\'t be auto-sorted.' },
        { h: 'Turn Flow', p: '① Draw: take a tile from the pile and look at it. ② Guess: click an opponent\'s face-down tile and guess its color & number. ③ Correct guess: the tile is revealed — you may guess again or end your turn. ④ Wrong guess: penalty phase — you must reveal one of your own tiles. ⑤ Pass: insert the drawn tile face-down into your sequence without guessing.' },
        { h: 'Penalty Phase', p: 'After a wrong guess, you must flip up one of your own unrevealed tiles. Click your own hidden tile to choose which one to reveal.' },
        { h: 'Wild Tile', p: 'When you draw a wild tile (including your first tile of the game), choose where to insert it in your sequence. It stays in that position for the entire game. When guessing a wild tile, select the "★ Wild" color option.' },
      ]
    },
    uno: {
      sections: [
        { h: 'Objective', p: 'Be the first to get rid of all your cards. Shout "UNO" when you\'re down to your last card!' },
        { h: 'Play Rule', p: 'Play a card matching the color or number of the top discard. Wild cards can be played at any time.' },
        { h: 'Action Cards', p: '⊘ Skip: skip the next player. ↻ Reverse: reverse play direction (in 2-player, acts as Skip). +2: next player draws 2 and is skipped. ★ Wild: choose the next color. +4: wild card + next player draws 4.' },
        { h: 'Stacking', p: '+2 and +4 cards stack! If you\'re hit with a +2, you can play your own +2 or +4 to pass the accumulated penalty to the next player; same for +4. If you don\'t play a stacking card, you must draw all accumulated cards.' },
        { h: 'Drawing', p: 'If you can\'t play any card, draw 1. You may play it immediately if eligible or keep it.' },
        { h: 'UNO!', p: 'Don\'t forget to shout UNO when you have only one card left!' },
      ]
    },
    doudizhu: {
      sections: [
        { h: 'Objective', p: 'The Landlord must play all cards first. Either Peasant getting rid of all cards means the Peasants win.' },
        { h: 'Deal', p: '17 cards per player, 3 cards in the kitty. The highest bidder becomes Landlord and takes the kitty.' },
        { h: 'Bidding', p: 'Players take turns bidding (1-3 points or pass). Highest bidder becomes Landlord. If nobody bids, redeal.' },
        { h: 'Combinations', p: 'Single, Pair, Triple, Triple+1, Triple+2, Straight (5+ consecutive), Consecutive Pairs (3+ pairs), Airplane (consecutive triples), Bomb (four of a kind), Rocket (Red Joker + Black Joker).' },
        { h: 'Play Rule', p: 'Leader plays any combination. Subsequent players must play a higher combination of the same type (or a Bomb/Rocket). You may pass at any time.' },
        { h: 'Ranking', p: 'Rocket > Bomb > Regular. Regular order: 3<4<5<6<7<8<9<10<J<Q<K<A<2<Black Joker<Red Joker.' },
      ]
    },
    'exploding-kittens': {
      sections: [
        { h: 'Objective', p: 'Survive to the end! Avoid drawing Exploding Kittens and be the last player standing.' },
        { h: 'Card Types', p: '💣 Exploding Kitten (draw = eliminated), 🔧 Defuse (neutralize an explosion), ⏭ Skip (end turn without drawing), ⚔ Attack (force a player to take two turns), 🔮 See the Future (peek at top 3 cards), 🔀 Shuffle (shuffle the deck), 🎁/👋 Steal (randomly steal a card from an opponent).' },
        { h: 'Turn Flow', p: '① Play phase (optional): play any number of action cards, or none. ② Draw phase (mandatory): draw 1 card from the deck. Drawing an Exploding Kitten without a Defuse = instant elimination!' },
        { h: 'Stealing', p: 'Play a steal card (🎁/👋) and pick an opponent to randomly take one card from their hand.' },
        { h: 'Defuse Trap', p: 'After defusing an explosion, secretly place the Exploding Kitten back anywhere in the deck (including right on top to sabotage the next player!).' },
      ]
    },
    rummikub: {
      sections: [
        { h: 'Objective', p: 'Be the first to play all your tiles. Shout "Rummikub!" when you clear your rack.' },
        { h: 'Tile Set', p: '106 tiles: 4 colors (Black, Blue, Red, Orange) × numbers 1-13 (two of each) + 2 Jokers (★). Each player starts with 14 tiles.' },
        { h: 'Legal Sets', p: '① Run: same color, consecutive numbers, at least 3 tiles (e.g. 🔴3-4-5). ② Group: different colors, same number, at least 3 tiles (e.g. 🔴7-🔵7-🟠7).' },
        { h: 'Initial Meld', p: 'Your first play must use only tiles from your rack to form legal sets totaling at least 30 points. Jokers count as 0. This rule can be turned off in settings.' },
        { h: 'After Melding', p: 'Each turn you may play any number of tiles: ① lay down new runs or groups. ② Add tiles to existing sets on the table. ③ Click "🔀 Manipulate" to enter the workbench and rearrange table tiles. If you can\'t play, draw 1 tile and end your turn.' },
        { h: 'Manipulation', p: 'In the workbench, all table sets + your hand are spread out in a grid. Click a tile to select it → click a target set to insert it. You can split, merge, and create new sets freely using table tiles. Requirements: ① every set must be legal (green border) ② at least 1 of your own tiles must be used ③ no original table tiles may be lost. Click "Submit" when done, or "Cancel" to revert.' },
        { h: 'Jokers', p: 'Jokers can substitute for any tile. At game end, each Joker still in hand is a 30-point penalty.' },
      ]
    },
    twentyfour: {
      sections: [
        { h: 'Objective', p: 'Use all 4 given numbers exactly once each, with + − × ÷ and parentheses, to make 24. Multiple rounds — the player with the most round wins takes the crown.' },
        { h: 'Controls', p: 'Click numbers and operators ( + − × ÷ and parentheses ) to build your expression, then click "Submit". Use Undo/Clear to fix mistakes.' },
        { h: 'Timed Mode', p: 'If the host sets a round time limit: solving correctly puts you in waiting state — the round won\'t end immediately. When the countdown finishes, everyone advances together. The fastest correct solver wins the round.' },
        { h: 'Wrong Answer', p: 'If your expression doesn\'t equal 24, the actual result is shown so you can adjust your approach.' },
        { h: 'Untimed Mode', p: 'With no time limit, the first player to submit a correct solution instantly wins the round.' },
      ]
    },
    minesweeper: {
      sections: [
        { h: 'Objective', p: 'Race other players on the same minefield! Be the first to uncover all safe cells. Hitting a mine means instant elimination.' },
        { h: 'Controls', p: '🖱️ Desktop: left-click to reveal, right-click to flag. 📱 Mobile: tap to reveal, long-press (0.5s) to flag. Numbers show how many mines are in the 8 surrounding cells. Empty areas (zero) auto-expand.' },
        { h: 'Win & Draw', p: '① First to uncover all safe cells wins. ② If only one player remains alive, they win. ③ If all players hit mines, it\'s a draw. Eliminated players can spectate.' },
        { h: 'Strategy', p: 'Use numbers to deduce mine locations. Flag uncertain spots. In a race, you don\'t need to flag every mine — mark what you need and boldly click safe cells.' },
      ]
    },
    numberbomb: {
      sections: [
        { h: 'Objective', p: 'Guess numbers between 1-100 without hitting the bomb! Each bomb hit costs a life — last one standing wins.' },
        { h: 'Turn Flow', p: 'The system secretly picks a bomb number. Players take turns guessing; the range narrows after each guess. Guessing the bomb number costs a life and starts a new round with a fresh bomb.' },
        { h: 'Input', p: 'Tap the number pad to build your guess, or type with your keyboard. Click "Guess!" or press Enter to confirm.' },
        { h: 'Lives & Victory', p: 'Everyone starts with 3 lives. Lose all lives = eliminated. Last remaining player wins. If everyone dies simultaneously, it\'s a draw.' },
        { h: 'Strategy', p: 'Binary search isn\'t safe — every guess could be the bomb. Watch which ranges opponents have already guessed and find a safe middle ground.' },
      ]
    },
    oldmaid: {
      sections: [
        { h: 'Objective', p: 'Get rid of all your cards as fast as possible. Whoever holds the Joker at the end loses!' },
        { h: 'Deal & Pairs', p: 'A 53-card deck (52 standard + 1 Joker 👻) is dealt to all players. Before play starts, each player automatically discards all matching pairs. The Joker cannot be paired.' },
        { h: 'Turn Flow', p: '① Click an opponent\'s avatar. ② Their cards are shown face-down — click one to draw it. ③ If the drawn card matches one in your hand, both are automatically discarded. ④ Next player\'s turn.' },
        { h: 'Win & Draw', p: 'Players who clear their hand safely exit. The last person holding the Joker loses. If the final two players both clear their hands simultaneously, it\'s a draw (the Joker was discarded with a pair earlier).' },
        { h: 'Tip', p: 'If you hold the Joker, bluff to mislead opponents. If someone keeps picking the same card from your hand, they likely have a match for it.' },
      ]
    },
    liarsbar: {
      sections: [
        { h: 'Objective', p: 'Play cards face-down and declare their rank — truth or lie, your choice. Be the last one alive!' },
        { h: 'Deck', p: 'J, Q, K (2 of each suit = 24) + Wild ★ (4) + Joker 👻 (1). Wild cards are always "truth" when challenged. When the Joker is challenged, everyone except the player who played it takes a shot.' },
        { h: 'Turn Flow', p: '① A target rank (J/Q/K) is drawn. ② Each player gets 5 cards. Take turns playing one card face-down and declaring it as the target rank. ③ The next player may accept (play their own card) or challenge (flip the last card). ④ After a challenge, the round ends — whoever lied takes a shot. Then a new round begins with a new deal.' },
        { h: 'Russian Roulette', p: 'Each player gets a 6-chamber revolver with 1 bullet placed at a random position (1-6). When judged to be lying after a challenge: fire! The chamber advances by one each shot. If the Nth shot lands on the bullet, you\'re out. No bullet = safe. Each player\'s bullet position is independent — some may die on the first shot, others survive to the 6th.' },
        { h: 'Wild Card ★', p: 'The wild card counts as any rank and can never be successfully challenged. The challenger takes the shot instead!' },
        { h: 'Joker 👻', p: 'Play the Joker and claim it\'s the target rank. If challenged → everyone except the player who played it takes a shot! Called "wiping out the table."' },
        { h: 'Victory', p: 'Last surviving player wins. If all die simultaneously, it\'s a draw.' },
        { h: 'Strategy', p: 'If you have the target rank, tell the truth. If not, you must lie. Wild cards are your safety net. Hide the Joker until chambers are nearly full for maximum devastation. Challenge aggressively when an opponent\'s chamber is nearly full!' },
      ]
    },
    bigtwo: {
      sections: [
        { h: 'Objective', p: 'Be the first to play all your cards.' },
        { h: 'Combinations', p: 'Single, Pair, Three of a Kind, Straight (5+ consecutive), Flush (5 same suit), Full House (triple + pair), Four of a Kind (quad + single), Straight Flush (5 consecutive, same suit).' },
        { h: 'Play Rule', p: 'The player holding ♦3 leads. You must play the same number of cards and the same combination type as the previous play (same type, higher rank). If you can\'t beat it, pass. When everyone passes, the last player leads freely.' },
        { h: 'Ranking', p: 'Face value: 3<4<5<6<7<8<9<10<J<Q<K<A<2. Suits: ♠>♥>♣>♦. Equal face values are broken by suit.' },
        { h: 'Victory', p: 'First to empty their hand wins. Other players score based on remaining cards.' },
      ]
    },
    texas: {
      sections: [
        { h: 'Objective', p: 'Use betting, raising, and folding strategy to win the pot with your best five-card hand at showdown.' },
        { h: 'Deal', p: 'Each player gets 2 hole cards (visible only to you). Five community cards are dealt in three stages: Flop (3) → Turn (1) → River (1).' },
        { h: 'Betting Rounds', p: 'Pre-flop → Flop → Turn → River. Each round, you may: Fold, Check, Call, Raise, or go All-In.' },
        { h: 'Hand Rankings', p: 'High Card < One Pair < Two Pair < Three of a Kind < Straight < Flush < Full House < Four of a Kind < Straight Flush.' },
        { h: 'Blinds', p: 'Two players post automatic blinds each hand (Small Blind / Big Blind) to seed the pot. The dealer button rotates each hand.' },
        { h: 'All-In', p: 'If you don\'t have enough chips to call, you can go all-in. After going all-in, you can only show down — no further betting.' },
      ]
    },
    flightchess: {
      sections: [
        { h: 'Objective', p: 'Move all 4 of your planes from the hangar, around the board, and into the home base. First to land all 4 planes wins.' },
        { h: 'Takeoff', p: 'Roll a 6 to move a plane from the hangar to the starting space. Rolling a 6 grants an extra roll.' },
        { h: 'Movement', p: 'After rolling, click a plane to move it forward by the die value. Planes move clockwise along the path.' },
        { h: 'Bumping', p: 'If your plane lands on a space occupied by an opponent\'s plane, the opponent\'s plane is sent back to their hangar!' },
        { h: 'Jump Pads', p: 'Landing on a space matching your color lets you jump 4 spaces forward. If the destination is also your color, jump again!' },
        { h: 'Home Stretch', p: 'Planes must land on the home stretch entry with an exact roll. Once on the home stretch, no exact roll is needed — reaching the center completes the plane.' },
        { h: 'Triple Six', p: 'Three consecutive 6s → your turn ends immediately with no movement.' },
      ]
    },
    snakebattle: {
      sections: [
        { h: 'Objective', p: 'All players control their own snake on a shared map. Hitting a wall, a snake body, or colliding with another snake head eliminates you. Last survivor wins.' },
        { h: 'Controls', p: 'Mobile: swipe on the board or tap the direction pad. Desktop: arrow keys or WASD. Each input only changes your next direction — you can\'t reverse into yourself.' },
        { h: 'Apples', p: 'Eating an 🍎 makes your snake grow 1 cell longer and spawns a new apple on an empty cell. Longer snakes score more but are harder to steer.' },
        { h: 'Collisions', p: 'Hitting a wall or any non-vacated snake body = instant elimination. Two snakes entering the same cell or swapping head positions both get eliminated.' },
        { h: 'Spectating & Victory', p: 'Eliminated players can still watch. If all snakes die in the same moment, it\'s a draw; otherwise the last surviving snake wins.' },
      ]
    },
    chinesechess: {
      sections: [
        { h: 'Objective', p: 'Checkmate the opponent\'s General (King) — leaving it no escape. 9×10 board, 16 pieces per side.' },
        { h: 'Piece Moves', p: 'Rook (Chariot): straight lines, any distance. Knight (Horse): L-shape (日), can be blocked. Cannon: straight lines, but must jump a piece to capture. Elephant/Bishop: diagonal 2×2 (田), blocked by center piece, cannot cross river. Advisor: one diagonal step within the palace. General/King: one orthogonal step within the palace, cannot face the opposing General. Pawn/Soldier: one step forward, after crossing the river also one step sideways.' },
        { h: 'Check & Checkmate', p: 'You cannot leave your General in check after a move. If a player has no legal moves and is in check, it\'s checkmate — opponent wins. No legal moves without being in check is also a loss (stalemate = loss in Xiangqi).' },
        { h: 'Controls', p: 'Click your piece to select it, then click the destination. Illegal moves are rejected by the server.' },
      ]
    },
    chess: {
      sections: [
        { h: 'Objective', p: 'Checkmate the opponent\'s King. 8×8 checkered board, 16 pieces per side.' },
        { h: 'Piece Moves', p: 'King: one square any direction. Queen: any straight line any distance. Rook: straight lines. Bishop: diagonals. Knight: L-shape (no blocking). Pawn: forward one, first move two, captures diagonally.' },
        { h: 'Special Rules', p: 'Castling: king and rook move together when unblocked and not in check. En passant: capture a pawn that just moved two squares. Promotion: pawn reaching the back rank becomes Q/R/B/N.' },
        { h: 'Win/Draw', p: 'Checkmate wins. Stalemate (no legal moves, not in check) is a draw. 50-move rule, threefold repetition, and insufficient material also draw.' },
        { h: 'Controls', p: 'Click a piece to select (green dots show legal moves), then click destination. Red circles show captures. Promotion triggers a piece selection dialog.' },
      ]
    },
    checkers: {
      sections: [
        { h: 'Objective', p: 'Capture all opponent pieces or leave them with no legal moves. 8×8 board using dark squares only, 12 pieces per side.' },
        { h: 'Piece Moves', p: 'Man (m): forward diagonal one square. King (k): forward and backward diagonal. Capture: jump over an adjacent opponent piece to the empty square beyond.' },
        { h: 'Forced Captures', p: 'If a capture is available, you must take it. Multi-jumps are required. Men reaching the opposite baseline become kings.' },
        { h: 'Controls', p: 'Click a piece to select, then click destination. Red circles show capture squares.' },
      ]
    },
    connect4: {
      sections: [
        { h: 'Objective', p: 'Be the first to connect 4 pieces in a row (horizontal, vertical, or diagonal). 7 columns × 6 rows.' },
        { h: 'Dropping Pieces', p: 'Choose a column and drop a piece — it falls to the lowest empty row. Yellow goes first.' },
        { h: 'Win/Draw', p: 'Four in a row wins. Board full with no winner is a draw.' },
        { h: 'Controls', p: 'Click a column to drop your piece. A preview appears at the top on hover.' },
      ]
    },
    reversi: {
      sections: [
        { h: 'Objective', p: 'Have the most pieces on the board when the game ends. 8×8 board, starts with 4 pieces in the center (black goes first).' },
        { h: 'Placing Pieces', p: 'Place a piece to flank one or more opponent pieces in a straight line (8 directions). All flanked pieces flip to your color.' },
        { h: 'Pass & End', p: 'Pass if you have no legal moves. Game ends when both players pass or the board is full. Most pieces wins.' },
        { h: 'Controls', p: 'Click an empty square to place. Translucent dots show legal positions.' },
      ]
    },
    go9: {
      sections: [
        { h: 'Objective', p: 'Surround territory on a 9×9 board. At the end, the player with more territory (stones + surrounded empty points) wins. White gets 6.5 points compensation (komi).' },
        { h: 'Placement', p: 'Black and White alternate placing stones on intersections. Stones cannot be moved once placed.' },
        { h: 'Capture', p: 'When a group of stones has all its liberties (adjacent empty points) filled by the opponent, the group is captured and removed. Captured stones count toward your prisoners.' },
        { h: 'Ko Rule', p: 'You cannot immediately recapture a single stone that just captured one of yours (you must play elsewhere first). Positions marked with a red dot are currently forbidden.' },
        { h: 'Suicide', p: 'You cannot place a stone where it would have no liberties (suicide), unless the move captures opponent\'s stones.' },
        { h: 'Ending', p: 'Both players pass consecutively twice → game ends, automatic scoring. Click the "Pass" button to skip your turn.' },
        { h: 'Scoring', p: 'Chinese rules: your stones on the board + surrounded empty points = score. White adds 6.5 komi.' },
      ]
    },
    drawguess: {
      sections: [
        { h: 'Objective', p: 'Draw, guess, and pass messages with friends. The host can choose between live drawing with real-time guessing (Stage Mode) or a telephone chain where messages drift hilariously off-course.' },
        { h: 'Two Modes', p: '🎤 Stage Mode: one artist draws live while everyone races to guess. Correct guessers score points. Players rotate as artist; highest total score wins. 🔇 Telephone Chain: Player 1 sees a word and draws it → Player 2 guesses from the drawing → Player 3 draws from that guess → alternating until the last player. The full chain is revealed step by step, and everyone votes for the funniest step.' },
        { h: 'Word Selection', p: 'The first artist picks a word from several candidates (number adjustable in room settings). Timer auto-selects the first option if you run out of time.' },
        { h: 'Drawing', p: 'When it\'s your turn to draw, sketch based on the given word (or the previous guess). Change colors, brush width, use eraser and clear canvas. Auto-submits when time is up.' },
        { h: 'Guessing', p: 'When it\'s your turn to guess, look at the previous drawing and type your best guess. Your answer becomes the word for the next artist.' },
        { h: 'Reveal & Voting', p: 'After everyone finishes, the full chain is revealed step by step: Original Word → Drawing → Guess → Drawing → … → Final Guess. Each player votes for the funniest or most absurd step. The author of the most-voted step wins. It\'s hilarious even if the final guess is nothing like the original!' },
        { h: 'Room Settings', p: 'The host can choose word categories (Animals, Food, Idioms, Internet Slang, etc.), set drawing/guessing time limits, number of candidate words, and add custom words.' },
      ]
    },
    monopoly: {
      sections: [
        { h: 'Objective', p: 'Bankrupt your opponents by buying properties and collecting rent. Be the last player standing. Everyone starts with $1500.' },
        { h: 'Movement', p: 'On your turn, click "Roll Dice" to advance. Passing or landing on GO collects $200.' },
        { h: 'Buying & Rent', p: 'Land on an unowned property/railroad/utility to buy it. Land on an owned property and pay rent — rent increases with houses.' },
        { h: 'Monopoly & Building', p: 'Owning all properties in a color group creates a monopoly: unimproved rent doubles. During the build phase at turn end, you can buy houses (up to 5 = Hotel) to drastically increase rent.' },
        { h: 'Chance Cards', p: 'Landing on "❓ Chance" draws a card: you might gain money, pay a fine, advance, go back, go directly to Jail, or earn a Get Out of Jail Free card.' },
        { h: 'Jail', p: 'Landing on the "Go to Jail" corner sends you to Jail. Roll doubles to escape, or pay $50 after 3 failed attempts for mandatory release.' },
        { h: 'Bankruptcy', p: 'Negative cash means bankruptcy — you\'re eliminated and your properties are released. Last remaining player wins.' },
      ]
    },
    suikabattle: {
      sections: [
        { h: 'Objective', p: 'Drop fruits and merge identical ones into bigger fruits to rack up a high score. Solo: beat your personal best. Multiplayer: outlast everyone.' },
        { h: 'Dropping', p: 'Drag the current fruit to the desired position, then tap or release to drop. The next fruit preview shows what\'s coming.' },
        { h: 'Merging & Scoring', p: 'When two identical fruits collide, they merge into the next larger fruit, awarding points based on the merge level. Keep the playfield flat to leave room for later merges.' },
        { h: 'Game Over', p: 'If fruit stacks above the danger line and stays there, you\'re out. In multiplayer, the last uneliminated player wins. In solo, your final score is recorded.' },
        { h: 'Tips', p: 'Cluster smaller fruits to one side rather than scattering mixed sizes in the middle. Leaving top space is more important than chasing one big merge.' },
      ]
    },
    sheeptile: {
      sections: [
        { h: 'Objective', p: 'Clear all stacked tiles to win. Two stages: Stage 1 is a warm-up; Stage 2 is significantly harder.' },
        { h: 'Match Rule', p: 'Tap a tile not covered by upper layers — it flies into your 7-slot bar. Collect 3 matching tiles in the bar to clear them automatically.' },
        { h: 'Bar Overflow', p: 'If your 7-slot bar fills up with unmatched tiles, you\'re out. Eliminated players can spectate.' },
        { h: 'Hidden Queue', p: 'Stage 2 has a face-down tile queue (❔) at the bottom — only the exposed end can be clicked. You\'ll see the pattern only after flipping it. Plan your sequence in advance to avoid getting stuck.' },
        { h: 'Power-Ups', p: 'Each stage gives you 1 use of each: ↩ Undo (return last tile), 🔀 Shuffle (rearrange remaining tiles), ⏏ Eject 3 (clear the first 3 slots).' },
        { h: 'Battle', p: 'Every player solves independently — you can\'t see others\' moves, only their progress bar. First to clear Stage 2 wins. Alternatively, see who survives longest.' },
        { h: 'Room Settings', p: 'Host can choose "Same Board" (everyone gets an identical layout for a fair speed race) or "Random" boards.' },
      ]
    },
    truthdare: {
      sections: [
        { h: 'What Is This', p: 'A party prompt-drawing tool. Decide winners and losers outside the app (e.g., rock-paper-scissors). The loser comes back to the page and draws a card. This page syncs the prompts — it does not judge who wins or loses.' },
        { h: 'Starting', p: 'Everyone readies up in the room, then the host clicks start. After starting, choose "Truth," "Dare," or "Random Pick."' },
        { h: 'Card Sync', p: 'Any prompt drawn by any player is synced to everyone in the room. The central card shows the current prompt; recent history is displayed below.' },
        { h: 'Deck Types', p: 'The host can enable different deck types: Light Icebreaker, Friends Party, Deep Truth, Dare Challenge, and more.' },
        { h: 'Custom Decks', p: 'The host can add custom Truth and Dare prompts in the waiting room (one per line). After saving, check the "Custom" deck to include them in the pool.' },
        { h: 'Tip', p: 'For a gentler game, start with Light Icebreaker and Friends Party. Save Deep Truth and Dare Challenge for close friends.' },
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
    var title = catalogEntry ? catalogEntry.name : gameType;

    var html = '<div style="background:var(--surface);border-radius:var(--radius);padding:24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;">';
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
