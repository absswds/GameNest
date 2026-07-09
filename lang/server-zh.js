module.exports = {
  // Common server errors (used by server.js directly)
  'invalid_game_type': '无效的游戏类型',
  'create_room_failed': '创建房间失败',
  'host_only_add_bot': '只有房主可以添加AI',
  'game_started_add_bot': '游戏已开始，不能添加AI',
  'game_no_ai': '该游戏不支持AI',
  'room_full': '房间已满',
  'room_not_found': '房间不存在或已结束',
  'game_started': '游戏已经开始',
  'host_only_start': '只有房主可以开始游戏',
  'min_players': '至少需要2名玩家',
  'all_ready_required': '所有玩家就绪后才能开始',
  'game_started_no_swap': '游戏已经开始，不能换位',
  'host_only_settings': '只有房主可以修改设置',
  'game_started_no_settings': '游戏已开始，不能修改设置',
  'host_only_restart': '只有房主可以重新开局',

  // Common gameplay errors
  'g_game_over': '游戏已结束',
  'g_not_your_turn': '不是你的回合',
  'g_unknown_action': '未知操作',
  'g_invalid_action': '无效操作',

  // Bigtwo (bt_)
  'bt_invalid_format': '无效格式',
  'bt_must_lead': '本轮你是首家，必须出牌',
  'bt_cannot_pass_after_play': '你刚出了牌别人都没过，不能过',
  'bt_no_hand': '你没有手牌',
  'bt_card_not_in_hand': '你手上没有这张牌',
  'bt_invalid_play': '无效牌型',
  'bt_doesnt_beat': '打不过上家的牌',

  // Checkers (ck_)
  'ck_out_of_bounds': '超出棋盘范围',
  'ck_no_piece_there': '该位置没有棋子',
  'ck_not_your_piece': '不能移动对方的棋子',
  'ck_illegal_move': '不合法的走法',

  // Chinese Chess (xq_)
  'xq_out_of_bounds': '超出棋盘范围',
  'xq_stand_still': '不能原地不动',
  'xq_no_piece_there': '该位置没有棋子',
  'xq_not_your_piece': '不能移动对方的棋子',
  'xq_cannot_take_own': '不能吃自己的棋子',
  'xq_illegal_move': '不合法的走法',

  // Connect 4 (c4_)
  'c4_invalid_column': '无效的列',
  'c4_column_full': '该列已满',

  // Da Vinci Code (dv_)
  'dv_choose_joker_position': '请选择万能牌插入位置',
  'dv_invalid_position': '无效位置',
  'dv_cannot_guess_own': '不能猜自己的牌',
  'dv_invalid_target': '无效的目标玩家',
  'dv_player_out': '该玩家已经出局',
  'dv_card_already_revealed': '这张牌已经揭示了',
  'dv_no_card_there': '该位置没有牌',

  // Doudizhu (ddz_)
  'ddz_already_robbed': '已抢过',
  'ddz_already_voted': '已投过票',
  'ddz_allow_double': '允许加倍',
  'ddz_allow_show_hand': '允许明牌',
  'ddz_bid_mode': '叫地主方式',
  'ddz_bid_mode_rob': '叫抢',
  'ddz_bid_mode_score': '叫分',
  'ddz_bid_must_be_0_3': '叫分必须是 0-3',
  'ddz_call_landlord': '叫地主',
  'ddz_card_not_in_hand': '你手上没有这张牌',
  'ddz_click_next_round': '开始下一局',
  'ddz_continue_no': '不加了',
  'ddz_continue_prompt': '第 %s 局即将开始，要再加 3 局吗？',
  'ddz_continue_yes': '再来 3 局',
  'ddz_cumulative_scores': '累计积分',
  'ddz_doesnt_beat': '打不过上家的牌',
  'ddz_final_score': '最终积分',
  'ddz_first_caller': '先叫规则',
  'ddz_first_caller_random': '每局随机',
  'ddz_first_caller_winner': '赢家先叫',
  'ddz_game_multiplier': '倍数',
  'ddz_game_over_title': '游戏结束',
  'ddz_game_rules': '游戏规则',
  'ddz_invalid_bid_action': '无效的出价',
  'ddz_invalid_format': '无效格式',
  'ddz_invalid_play': '无效牌型',
  'ddz_invalid_vote': '无效投票',
  'ddz_must_lead': '本轮你是首家，不能过',
  'ddz_no_call': '不叫',
  'ddz_no_rob': '不抢',
  'ddz_not_eligible_to_rob': '本局不叫无法抢',
  'ddz_not_your_bid': '还没轮到你叫地主',
  'ddz_play_time': '出牌时长',
  'ddz_play_time_10': '10秒',
  'ddz_play_time_20': '20秒',
  'ddz_play_time_60': '60秒',
  'ddz_play_time_300': '5分钟',
  'ddz_rob': '抢',
  'ddz_round_end_title': '第 %s 局结束',
  'ddz_round_scores': '本局积分',
  'ddz_round_start': '第 %s 局',
  'ddz_seconds': '秒',
  'ddz_time_left': '剩余',
  'ddz_time_up': '时间到，自动不出',
  'ddz_total_rounds': '总局数',
  'ddz_total_rounds_12': '12局',
  'ddz_total_rounds_3': '3局',
  'ddz_total_rounds_6': '6局',
  'ddz_total_rounds_9': '9局',

  // Draw Guess (dg_)
  'dg_cannot_pick_word_now': '现在不能选词',
  'dg_cannot_draw_now': '现在不能画',
  'dg_cannot_repeat_guess': '不能重复猜词',
  'dg_wrong_try_again': '不对，再试试',
  'dg_round_ended': '本轮已结束',
  'dg_pick_word_first': '请先选词',
  'dg_not_your_word': '不是你选词',
  'dg_stage_ended': '链已结束',
  'dg_already_submitted': '已提交',
  'dg_content_empty': '内容为空',
  'dg_invalid_vote': '无效投票',
  'dg_game_not_running': '游戏未进行',

  // Exploding Kittens (ek_)
  'ek_you_are_out': '你已经出局了',
  'ek_deck_empty': '牌堆已空',
  'ek_card_not_in_hand': '手上没有这张牌',
  'ek_must_target_player': '必须指定目标玩家',
  'ek_target_out': '目标玩家已出局',

  // Liar's Bar (lb_)
  'lb_you_are_out': '你已出局',
  'lb_not_your_shot': '不是你在开枪',
  'lb_shooting_in_progress': '正在开枪阶段，请等待',
  'lb_wrong_phase': '当前阶段不能操作',
  'lb_select_a_card': '请选择一张牌',
  'lb_no_hand': '你没有手牌',
  'lb_card_not_in_hand': '你没有这张牌',
  'lb_nothing_to_challenge': '没有可以质疑的牌',
  'lb_cannot_challenge_self': '不能质疑自己',

  // Old Maid (om_)
  'om_no_hand': '你没有手牌',
  'om_choose_player': '请选择要从哪个玩家抽牌',
  'om_cannot_draw_self': '不能抽自己的牌',
  'om_player_no_cards': '该玩家没有牌了',
  'om_invalid_draw_position': '无效的选牌位置',

  // Number Bomb (nb_)
  'nb_you_are_out': '你已出局',
  'nb_invalid_guess': '无效猜测',

  // Texas Hold'em (tx_)
  'tx_showdown_start_new': '已经摊牌，请重新开始',
  'tx_you_folded': '你已经弃牌',
  'tx_you_all_in': '你已经全下',
  'tx_must_call': '必须先跟注',
  'tx_you_can_check': '你可以过牌',
  'tx_not_enough_chips_go_allin': '筹码不足，请全下',
  'tx_raise_too_low': '加注至少需要 X 筹码',
  'tx_not_enough_chips': '筹码不足',

  // Rummikub (rk_)
  'rk_submit_at_least_one_set': '请至少提交一个牌组',
  'rk_invalid_set': '牌组格式错误',
  'rk_invalid_tile': '牌组中有无效牌',
  'rk_illegal_sets': '存在不合法的牌组',
  'rk_use_at_least_one_own': '必须至少使用一张自己的牌',
  'rk_all_table_tiles_must_regroup': '桌面上原有的牌必须全部重新组成合法牌组',
  'rk_need_break_ice': '首次出牌总分需要≥30分',
  'rk_table_empty': '桌面还没有牌组',
  'rk_already_played': '本回合已经出过牌',
  'rk_card_not_in_hand': '手上没有这张牌',
  'rk_cannot_form_set': '不能组成合法牌组',
  'rk_cannot_join_set': '不能加入该牌组',
  'rk_invalid_play': '无效出牌',

  // Flight Chess (fc_)
  'fc_need_to_select_plane': '请先移动飞机',
  'fc_roll_dice_first': '请先掷骰子',
  'fc_invalid_plane': '无效的飞机',
  'fc_plane_already_home': '这架飞机已经到家了',
  'fc_must_roll_6_to_launch': '只有掷到6才能起飞',

  // Truth or Dare (td_)
  'td_choose_kind': '请选择真心话或大冒险',
  'td_empty_deck': '当前牌库没有可抽的卡',

  // Gomoku (gk_)
  'gk_invalid_position': '无效位置',
  'gk_out_of_bounds': '超出棋盘范围',
  'gk_position_occupied': '该位置已被占用',

  // Go 9x9 (go_)
  'go_out_of_bounds': '超出棋盘',
  'go_position_occupied': '该位置已有棋子',
  'go_ko_rule': '打劫规则：不能立刻提回',
  'go_suicide_point': '禁着点：此处落子会自杀',

  // Hearts (ht_)
  'ht_select_3_to_pass': '请选3张传牌',
  'ht_no_duplicate_selection': '不能重复选择相同卡牌',
  'ht_card_not_in_hand': '手上没有这张牌',
  'ht_wrong_phase': '当前阶段不允许此操作',
  'ht_no_hand': '手牌为空',
  'ht_select_a_card': '请选一张牌',
  'ht_illegal_card': '非法出牌',

  // Minesweeper (ms_)
  'ms_you_are_out': '你已出局，只能观战',
  'ms_invalid_action': '无效操作',
  'ms_out_of_bounds': '坐标超出范围',
  'ms_already_revealed': '该格已翻开',
  'ms_flagged': '该格已标旗，请先取消旗子',
  'ms_invalid_action_type': '无效操作类型',

  // Sheeptile (st_)
  'st_no_such_player': '无此玩家',
  'st_you_are_out': '你已出局',
  'st_tile_not_found': '找不到此牌',
  'st_wrong_level': '不是当前关卡的牌',
  'st_already_removed': '已移除',
  'st_covered_cannot_click': '被遮挡，无法点击',
  'st_no_undos_left': '撤回次数已用完',
  'st_slot_empty': '槽位为空',
  'st_no_shuffles_left': '洗牌次数已用完',
  'st_no_removes_left': '移出次数已用完',

  // Snake Battle (sb_)
  'sb_player_not_found': '玩家不存在',
  'sb_you_are_out': '你已出局',
  'sb_invalid_direction': '方向无效',
  'sb_cannot_reverse': '不能立刻反向',

  // Suika Battle (sk_)
  'sk_you_are_out': '你已出局',

  // 24 Point (tf_)
  'tf_round_ended_wait_next': '本轮已结束，等待下一轮',
  'tf_game_not_started': '游戏未开始',
  'tf_already_correct': '你已答对，等待倒计时结束',
  'tf_enter_expression': '请输入表达式',
  'tf_use_all_4_numbers': '必须使用全部4个数字',
  'tf_wrong_numbers': '必须使用给定数字各一次',
  'tf_invalid_chars': '表达式含有非法字符',
  'tf_invalid_expression': '表达式无效',
  'tf_invalid_result': '计算结果无效',
  'tf_not_24': '结果不等于24',

  // UNO (uno_)
  'uno_have_playable_card': '你有可出的牌',
  'uno_card_not_in_hand': '手上没有这张牌',
  'uno_must_draw_or_play': '必须先摸牌或出+2/+4叠加',
  'uno_cannot_play_card': '不能出这张牌',

  // Tic Tac Toe (ttt_)
  'ttt_invalid_cell': '无效的落子位置',
  'ttt_position_occupied': '该位置已被占用',

  // Battleship (bs_)
  'bs_invalid_phase': '无效阶段',
  'bs_invalid_player': '无效玩家',
  'bs_invalid_coordinates': '无效坐标',
  'bs_invalid_orientation': '无效方向',
  'bs_wrong_ship_size': '错误的船只大小',
  'bs_invalid_placement': '无效的船只放置',
  'bs_out_of_bounds': '坐标超出边界',
  'bs_already_shot': '已经射击过这里',

  // Chess (ch_)
  'ch_invalid_move': '无效走法',
  'ch_illegal_move': '非法走法',

  // Reversi (rv_)
  'rv_invalid_move': '无效操作',
  'rv_out_of_bounds': '超出边界',
  'rv_cell_occupied': '该位置已有棋子',
  'rv_illegal_move': '非法走法',
};
