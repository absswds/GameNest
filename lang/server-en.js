module.exports = {
  // Common server errors (used by server.js directly)
  'invalid_game_type': 'Invalid game type',
  'create_room_failed': 'Failed to create room',
  'host_only_add_bot': 'Only the host can add bots',
  'game_started_add_bot': 'Game already started, cannot add bots',
  'host_only_remove_bot': 'Only the host can remove bots',
  'game_started_remove_bot': 'Game already started, cannot remove bots',
  'host_only_kick': 'Only the host can remove players',
  'kick_disallowed_playing': 'Cannot remove a player during a game',
  'kicked_by_host': 'You were removed by the host',
  'game_no_ai': 'This game does not support AI',
  'room_full': 'Room is full',
  'room_not_found': 'Room not found or has ended',
  'game_started': 'Game already started',
  'host_only_start': 'Only the host can start the game',
  'min_players': 'At least %s players needed (add AI to fill seats)',
  'all_ready_required': 'All players must be ready before starting',
  'game_started_no_swap': 'Game already started, cannot swap seats',
  'host_only_settings': 'Only the host can change settings',
  'game_started_no_settings': 'Game already started, cannot change settings',
  'host_only_restart': 'Only the host can restart the game',

  // Common gameplay errors
  'g_game_over': 'Game is over',
  'g_not_your_turn': 'Not your turn',
  'g_unknown_action': 'Unknown action',
  'g_invalid_action': 'Invalid action',

  // Bigtwo (bt_)
  'bt_invalid_format': 'Invalid format',
  'bt_must_lead': 'You must lead this round',
  'bt_cannot_pass_after_play': 'Cannot pass after playing',
  'bt_no_hand': 'No hand',
  'bt_card_not_in_hand': 'Card not in hand',
  'bt_invalid_play': 'Invalid play',
  'bt_doesnt_beat': "Doesn't beat previous play",

  // Checkers (ck_)
  'ck_out_of_bounds': 'Out of bounds',
  'ck_no_piece_there': 'No piece there',
  'ck_not_your_piece': "Cannot move opponent's piece",
  'ck_illegal_move': 'Illegal move',

  // Chinese Chess (xq_)
  'xq_out_of_bounds': 'Out of bounds',
  'xq_stand_still': 'Cannot stay in place',
  'xq_no_piece_there': 'No piece there',
  'xq_not_your_piece': "Cannot move opponent's piece",
  'xq_cannot_take_own': 'Cannot capture own piece',
  'xq_illegal_move': 'Illegal move',

  // Connect 4 (c4_)
  'c4_invalid_column': 'Invalid column',
  'c4_column_full': 'Column full',

  // Da Vinci Code (dv_)
  'dv_choose_joker_position': 'Choose joker position',
  'dv_invalid_position': 'Invalid position',
  'dv_cannot_guess_own': 'Cannot guess your own card',
  'dv_invalid_target': 'Invalid target player',
  'dv_player_out': 'Player is out',
  'dv_card_already_revealed': 'Card already revealed',
  'dv_no_card_there': 'No card there',

  // Doudizhu (ddz_)
  'ddz_not_your_bid': 'Not your bid',
  'ddz_bid_must_be_0_3': 'Bid must be 0-3',
  'ddz_invalid_format': 'Invalid format',
  'ddz_must_lead': 'You must lead this round',
  'ddz_card_not_in_hand': 'Card not in hand',
  'ddz_invalid_play': 'Invalid play',
  'ddz_doesnt_beat': "Doesn't beat previous play",
  'ddz_allow_double': 'Allow Double',
  'ddz_allow_show_hand': 'Allow Show Hand',
  'ddz_already_robbed': 'Already robbed',
  'ddz_already_voted': 'Already voted',
  'ddz_bid_mode': 'Bid Mode',
  'ddz_bid_mode_rob': 'Rob',
  'ddz_bid_mode_score': 'Score',
  'ddz_call_landlord': 'Call Landlord',
  'ddz_click_next_round': 'Start Next Round',
  'ddz_continue_no': 'No Thanks',
  'ddz_continue_prompt': 'Round %s starting soon. Add 3 more rounds?',
  'ddz_continue_yes': 'Add 3 Rounds',
  'ddz_cumulative_scores': 'Cumulative Scores',
  'ddz_final_score': 'Final Score',
  'ddz_first_caller': 'First Caller Rule',
  'ddz_first_caller_random': 'Random Each Round',
  'ddz_first_caller_winner': 'Winner Calls First',
  'ddz_game_multiplier': 'Multiplier',
  'ddz_game_over_title': 'Game Over',
  'ddz_game_rules': 'Game Rules',
  'ddz_invalid_bid_action': 'Invalid bid',
  'ddz_invalid_vote': 'Invalid vote',
  'ddz_no_call': 'No Call',
  'ddz_no_rob': 'No Rob',
  'ddz_not_eligible_to_rob': "Can't rob if you didn't call",
  'ddz_play_time': 'Play Time',
  'ddz_play_time_10': '10s',
  'ddz_play_time_20': '20s',
  'ddz_play_time_300': '5min',
  'ddz_play_time_60': '60s',
  'ddz_rob': 'Rob',
  'ddz_round_end_title': 'Round %s End',
  'ddz_round_scores': 'Round Scores',
  'ddz_round_start': 'Round %s',
  'ddz_seconds': 's',
  'ddz_time_left': 'Remaining',
  'ddz_time_up': "Time's up, auto pass",
  'ddz_total_rounds': 'Total Rounds',
  'ddz_total_rounds_12': '12 rounds',
  'ddz_total_rounds_3': '3 rounds',
  'ddz_total_rounds_6': '6 rounds',
  'ddz_total_rounds_9': '9 rounds',

  // Draw Guess (dg_)
  'dg_cannot_pick_word_now': 'Cannot pick word now',
  'dg_cannot_draw_now': 'Cannot draw now',
  'dg_cannot_repeat_guess': 'Cannot repeat guess',
  'dg_wrong_try_again': 'Wrong, try again',
  'dg_round_ended': 'Round ended',
  'dg_pick_word_first': 'Pick a word first',
  'dg_not_your_word': 'Not your word',
  'dg_stage_ended': 'Stage ended',
  'dg_already_submitted': 'Already submitted',
  'dg_content_empty': 'Content is empty',
  'dg_invalid_vote': 'Invalid vote',
  'dg_game_not_running': 'Game is not running',

  // Exploding Kittens (ek_)
  'ek_you_are_out': 'You are out',
  'ek_deck_empty': 'Deck is empty',
  'ek_card_not_in_hand': 'Card not in hand',
  'ek_must_target_player': 'Must target a player',
  'ek_target_out': 'Target is out',

  // Liar's Bar (lb_)
  'lb_you_are_out': 'You are out',
  'lb_not_your_shot': 'Not your shot',
  'lb_shooting_in_progress': 'Shooting in progress, please wait',
  'lb_wrong_phase': 'Wrong phase',
  'lb_select_a_card': 'Select a card',
  'lb_max_three_cards': 'Max 3 cards per turn',
  'lb_no_hand': 'No hand',
  'lb_card_not_in_hand': 'Card not in hand',
  'lb_nothing_to_challenge': 'Nothing to challenge',
  'lb_cannot_challenge_self': 'Cannot challenge self',

  // Old Maid (om_)
  'om_no_hand': 'No hand',
  'om_choose_player': 'Choose a player to draw from',
  'om_cannot_draw_self': 'Cannot draw from yourself',
  'om_player_no_cards': 'That player has no cards',
  'om_invalid_draw_position': 'Invalid draw position',

  // Number Bomb (nb_)
  'nb_you_are_out': 'You are out',
  'nb_invalid_guess': 'Invalid guess',

  // Texas Hold'em (tx_)
  'tx_showdown_start_new': 'Showdown over, start a new game',
  'tx_you_folded': 'You folded',
  'tx_you_all_in': 'You are all in',
  'tx_must_call': 'Must call first',
  'tx_you_can_check': 'You can check',
  'tx_not_enough_chips_go_allin': 'Not enough chips, go all in',
  'tx_raise_too_low': 'Raise must be at least X chips',
  'tx_not_enough_chips': 'Not enough chips',

  // Rummikub (rk_)
  'rk_submit_at_least_one_set': 'Submit at least one set',
  'rk_invalid_set': 'Invalid set format',
  'rk_invalid_tile': 'Invalid tile in set',
  'rk_illegal_sets': 'Contains illegal sets',
  'rk_use_at_least_one_own': 'Must use at least one own tile',
  'rk_all_table_tiles_must_regroup': 'All table tiles must be regrouped',
  'rk_need_break_ice': 'Need to break ice (score ≥ 30)',
  'rk_table_empty': 'No sets on table',
  'rk_already_played': 'Already played this turn',
  'rk_card_not_in_hand': 'Card not in hand',
  'rk_cannot_form_set': 'Cannot form a valid set',
  'rk_cannot_join_set': 'Cannot join that set',
  'rk_invalid_play': 'Invalid play',

  // Flight Chess (fc_)
  'fc_need_to_select_plane': 'Need to select a plane first',
  'fc_roll_dice_first': 'Roll the dice first',
  'fc_invalid_plane': 'Invalid plane',
  'fc_plane_already_home': 'This plane is already home',
  'fc_must_roll_6_to_launch': 'Must roll 6 to launch',

  // Truth or Dare (td_)
  'td_choose_kind': 'Please choose Truth or Dare',
  'td_empty_deck': 'No cards available in the current deck',

  // Gomoku (gk_)
  'gk_invalid_position': 'Invalid position',
  'gk_out_of_bounds': 'Out of board range',
  'gk_position_occupied': 'Position occupied',

  // Go 9x9 (go_)
  'go_out_of_bounds': 'Out of bounds',
  'go_position_occupied': 'Position occupied',
  'go_ko_rule': 'Ko rule: cannot recapture immediately',
  'go_suicide_point': 'Suicide point: would be self-capture',

  // Hearts (ht_)
  'ht_select_3_to_pass': 'Select exactly 3 cards to pass',
  'ht_no_duplicate_selection': 'Cannot select the same card twice',
  'ht_card_not_in_hand': 'Card not in hand',
  'ht_wrong_phase': 'Operation not allowed in current phase',
  'ht_no_hand': 'No cards in hand',
  'ht_select_a_card': 'Select a card',
  'ht_illegal_card': 'Illegal card',

  // Minesweeper (ms_)
  'ms_you_are_out': 'You are out, spectating only',
  'ms_invalid_action': 'Invalid action',
  'ms_out_of_bounds': 'Coordinates out of range',
  'ms_already_revealed': 'Already revealed',
  'ms_flagged': 'Flagged, unflag first',
  'ms_invalid_action_type': 'Invalid action type',

  // Sheeptile (st_)
  'st_no_such_player': 'No such player',
  'st_you_are_out': 'You are out',
  'st_tile_not_found': 'Tile not found',
  'st_wrong_level': 'Wrong level tile',
  'st_already_removed': 'Already removed',
  'st_covered_cannot_click': 'Covered, cannot click',
  'st_no_undos_left': 'No undos left',
  'st_slot_empty': 'Slot is empty',
  'st_no_shuffles_left': 'No shuffles left',
  'st_no_removes_left': 'No removes left',

  // Snake Battle (sb_)
  'sb_player_not_found': 'Player not found',
  'sb_you_are_out': 'You are out',
  'sb_invalid_direction': 'Invalid direction',
  'sb_cannot_reverse': 'Cannot reverse immediately',

  // Suika Battle (sk_)
  'sk_you_are_out': 'You are out',

  // 24 Point (tf_)
  'tf_round_ended_wait_next': 'Round ended, waiting for next',
  'tf_game_not_started': 'Game not started',
  'tf_already_correct': 'Already correct, waiting for countdown',
  'tf_enter_expression': 'Enter an expression',
  'tf_use_all_4_numbers': 'Use all 4 numbers',
  'tf_wrong_numbers': 'Use each given number once',
  'tf_invalid_chars': 'Expression contains illegal characters',
  'tf_invalid_expression': 'Invalid expression',
  'tf_invalid_result': 'Invalid result',
  'tf_not_24': 'Result is not 24',

  // UNO (uno_)
  'uno_have_playable_card': 'You have a playable card',
  'uno_card_not_in_hand': 'Card not in hand',
  'uno_must_draw_or_play': 'Must draw or play +2/+4 stack',
  'uno_cannot_play_card': 'Cannot play this card',

  // Tic Tac Toe (ttt_)
  'ttt_invalid_cell': 'Invalid cell position',
  'ttt_position_occupied': 'Position occupied',

  // Battleship (bs_)
  'bs_invalid_phase': 'Invalid phase',
  'bs_invalid_player': 'Invalid player',
  'bs_invalid_coordinates': 'Invalid coordinates',
  'bs_invalid_orientation': 'Invalid orientation',
  'bs_wrong_ship_size': 'Wrong ship size',
  'bs_invalid_placement': 'Invalid ship placement',
  'bs_out_of_bounds': 'Out of bounds',
  'bs_already_shot': 'Already shot here',

  // Chess (ch_)
  'ch_invalid_move': 'Invalid move',
  'ch_illegal_move': 'Illegal move',

  // Reversi (rv_)
  'rv_invalid_move': 'Invalid move',
  'rv_out_of_bounds': 'Out of bounds',
  'rv_cell_occupied': 'Cell already occupied',
  'rv_illegal_move': 'Illegal move',

  // 2048 (g2048_)
  'g2048_dead': 'Locked out',
  'g2048_bad_dir': 'Invalid direction',
  'g2048_no_move': 'No movement',

  // Sudoku (su_)
  'su_wrong': 'Wrong answer',
  'su_eliminated': 'You are eliminated',
  'su_no_hints': 'No hints left',
  'su_invalid': 'Invalid input',
  'su_illegal_cell': 'Cannot edit a given clue',

  // Mahjong common (mj_)
  'mj_choose_void': 'Please choose the void suit',
  'mj_void_not_satisfied': 'Cannot win: you still hold void-suit tiles',
  'mj_not_winning': 'Not a winning hand',
  'mj_cannot_pung': 'Cannot pung this tile',
  'mj_cannot_kong': 'Cannot kong this tile',
  'mj_bad_claim': 'Invalid action',
  'mj_must_discard': 'You must discard a tile first',
  'mj_tile_not_in_hand': 'Tile not in hand',
  'mj_bad_void_suit': 'Invalid void suit',
  'mj_must_draw': 'Must draw a tile first',
  'mj_cannot_chow': 'Cannot chow this tile',
  'mj_invalid_move': 'Invalid move',
  'mj_invalid_claim': 'Invalid claim action',
  'mj_last_four_must_win': 'Must win on last 4 tiles',
  'mj_not_enough_fan': 'Not enough fan to win',
  'mj_choose_swap': 'Select 3 same-suit tiles to swap',
  'mj_bad_swap': 'Invalid swap (need 3 same-suit tiles)',

  'ww_not_now': 'You cannot do that now',
  'ww_bad_target': 'Invalid target',
  'ww_one_potion': 'Only one potion per night',
  'ww_no_potion': 'No potion available',
  'ww_no_self_save': 'The witch cannot heal herself',
  'sg_not_now': 'You cannot do that now',
  'sg_not_your_turn': 'It is not your turn',
  'sg_bad_card': 'That card cannot be used that way',
  'sg_bad_target': 'Invalid target',
  'sg_out_of_range': 'Target out of range',
  'sg_sha_limit': 'You already played a Slash this turn',
  'sg_full_hp': 'Already at full health',
  'sg_no_cards': 'The target has no cards',
  'sg_cannot_use': 'This card cannot be played now',
  'sg_discard_count': 'Wrong number of cards',
  'sg_bad_skill': 'You cannot use that skill',
  'sg_skill_used': 'Skill already used this turn',
};
