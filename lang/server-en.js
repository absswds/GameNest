module.exports = {
  // Common server errors (used by server.js directly)
  'invalid_game_type': 'Invalid game type',
  'create_room_failed': 'Failed to create room',
  'host_only_add_bot': 'Only the host can add bots',
  'game_started_add_bot': 'Game already started, cannot add bots',
  'game_no_ai': 'This game does not support AI',
  'room_full': 'Room is full',
  'room_not_found': 'Room not found or has ended',
  'game_started': 'Game already started',
  'host_only_start': 'Only the host can start the game',
  'min_players': 'At least 2 players needed',
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
};
