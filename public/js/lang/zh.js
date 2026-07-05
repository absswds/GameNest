(function() {
  if (!window.__LANG) window.__LANG = {};
  window.__LANG.zh = {
    'join': '加入',
    'create_room': '创建房间',
    'back_to_lobby': '← 返回大厅',
    'return_to_room': '返回房间',
    'ready': '准备',
    'unready': '取消准备',
    'cancel_ready': '取消准备',
    'add_bot': '添加 AI',
    'start_game': '开始游戏',
    'view_rules': '查看规则',
    'restart': '重新开始',
    'play_again': '再来一局',
    'cancel': '取消',
    'swap_seat': '换座位',
    'confirm': '确定',
    'close': '关闭',
    'search_placeholder': '搜索游戏名、标签、类型',
    'name_placeholder': '你的名字',
    'room_code_placeholder': '输入房间号',
    'no_results': '没有找到匹配的游戏，换个关键词试试。',
    'waiting_players': '等待玩家加入',
    'waiting_all_ready': '等待所有玩家准备…',
    'waiting_host_start': '等待房主开始游戏…',
    'all_ready_start': '所有玩家已准备，可以开始！',
    'waiting_sync': '等待同步状态',
    'connecting_room': '正在连接房间…',
    'scan_join': '扫码或输入房间号加入',
    'host': '房主',
    'ready_status': '已准备',
    'not_ready': '未准备',
    'empty_seat': '空位',
    'you': '你',
    'player': '玩家',
    'you_win': '你赢了！',
    'you_lose': '你输了',
    'draw': '平局',
    'opponent_wins': '对手赢了',
    'joined_room': '加入了房间',
    'left_room': '离开了房间',
    'hero_title': '联机桌游',
    'hero_subtitle': '同一 Wi-Fi 下，选一个游戏，几秒开房，直接开玩。',
    'hero_game_count': '款游戏',
    'hero_player_count': '支持人数',
    'hero_connection': '局域网直连',
    'resume_title': '房间',
    'resume_subtitle': '你已在这间房中，点击返回',
    'resume_btn': '返回房间',
    'got_it': '知道了',
    'quick_start': '快速开玩',
    'your_turn': '轮到你了',
    'opponent_turn': '对手回合',
    'waiting': '等待中…',
    'game_over': '游戏结束',
    'room': '房间',
    'swap_hint': '点这里换到这个位置',
    'opponent_left': '对手离开了，等待中…',
    'landlord_win': '地主胜利',
    'farmer_win': '农民获胜',
    'not_in_room': '你没有加入任何房间',
    'can_add_bot': '可加 AI',
    'pvp_only': '纯玩家对战',
    'featured_label': '精选推荐',
    'featured_title': '先从这些局开始',
    'browse_label': '浏览全部',
    'browse_title': '按风格找局',
    'all_categories': '全部',
    'wifi_note': '确保所有设备连接到同一个 Wi-Fi 或手机热点。',
    'discovery_hint': '先选中，再点底部创建。再次点中同一张卡也会直接开房。',
    'join_room': '加入房间',
    'choose_avatar': '选择头像',
    'swap_hint_full': '选择你想换去的位置。',
    'room_expired': '房间已失效，请重新创建或输入房间号加入。',
    'connection_failed': '连接失败，服务器是否已启动？',
    'room_code_empty': '请输入房间号',
    'in_lobby': '在大厅',
    'seat_label': '位置',
    'reconnecting': '连接断开，正在重连…',
  };
  if (!window.__ACTIVE_LANG) window.__ACTIVE_LANG = 'zh';
  window._t = function(key) {
    var lang = window.__ACTIVE_LANG || 'zh';
    var pack = window.__LANG[lang];
    if (pack && pack[key] !== undefined) return pack[key];
    if (window.__LANG.zh && window.__LANG.zh[key] !== undefined) return window.__LANG.zh[key];
    return key;
  };
  window._switchLang = function(lang) {
    localStorage.setItem('lang', lang);
    window.__ACTIVE_LANG = lang;
    window.location.reload();
  };
  // Init from localStorage
  var saved = localStorage.getItem('lang');
  if (saved) window.__ACTIVE_LANG = saved;
})();
