// games/drawguess-words.js — 你画我猜词库（按分类组织，~325 词）
// 用词原则：贴近日常和当下网络用语，避免生僻、过时、书面化的词
module.exports = {
  animal: {
    label: '动物',
    words: [
      '猫', '狗', '兔子', '大象', '长颈鹿', '企鹅', '猫头鹰', '章鱼', '螃蟹', '蝴蝶',
      '火烈鸟', '熊猫', '北极熊', '海豚', '鳄鱼', '老虎', '狮子', '猴子', '孔雀', '蜗牛',
      '刺猬', '袋鼠', '考拉', '羊驼', '仓鼠', '金鱼', '乌龟', '蛇', '青蛙', '蜜蜂',
      '蚊子', '恐龙', '鲨鱼', '鲸鱼', '柯基', '哈士奇', '橘猫', '小龙虾', '大闸蟹', '水母',
    ],
    wordsEn: [
      'Cat', 'Dog', 'Rabbit', 'Elephant', 'Giraffe', 'Penguin', 'Owl', 'Octopus', 'Crab', 'Butterfly',
      'Flamingo', 'Panda', 'Polar Bear', 'Dolphin', 'Crocodile', 'Tiger', 'Lion', 'Monkey', 'Peacock', 'Snail',
      'Hedgehog', 'Kangaroo', 'Koala', 'Alpaca', 'Hamster', 'Goldfish', 'Turtle', 'Snake', 'Frog', 'Bee',
      'Mosquito', 'Dinosaur', 'Shark', 'Whale', 'Corgi', 'Husky', 'Orange Cat', 'Crayfish', 'Crab', 'Jellyfish',
    ],
  },
  food: {
    label: '食物',
    words: [
      '西瓜', '汉堡', '披萨', '寿司', '火锅', '冰淇淋', '螺蛳粉', '烤串', '糖葫芦', '奶茶',
      '珍珠奶茶', '炸鸡', '薯条', '可乐', '方便面', '小笼包', '煎饼果子', '麻辣烫', '关东煮', '蛋挞',
      '肉夹馍', '臭豆腐', '烤冷面', '牛排', '粽子', '月饼', '汤圆', '饺子', '油条', '豆浆',
      '咖啡', '蛋糕', '巧克力', '棒棒糖', '爆米花', '薯片', '辣条', '榴莲', '草莓', '柠檬茶',
      '串串香', '芒果', '泡面', '烧烤', '酸菜鱼',
    ],
    wordsEn: [
      'Watermelon', 'Hamburger', 'Pizza', 'Sushi', 'Hot Pot', 'Ice Cream', 'Noodle Soup', 'Kebab', 'Candy Apple', 'Milk Tea',
      'Bubble Tea', 'Fried Chicken', 'Fries', 'Cola', 'Instant Noodles', 'Dumplings', 'Pancake', 'Spicy Hot Pot', 'Oden', 'Egg Tart',
      'Meat Pie', 'Stinky Tofu', 'Grilled Noodle', 'Steak', 'Rice Dumpling', 'Mooncake', 'Tangyuan', 'Dumpling', 'Fried Dough', 'Soy Milk',
      'Coffee', 'Cake', 'Chocolate', 'Lollipop', 'Popcorn', 'Chips', 'Spicy Strip', 'Durian', 'Strawberry', 'Lemon Tea',
      'Skewers', 'Mango', 'Ramen', 'BBQ', 'Pickled Fish',
    ],
  },
  daily: {
    label: '日常物品',
    words: [
      '雨伞', '自行车', '摩天轮', '直升机', '潜水艇', '望远镜', '吹风机', '电风扇', '沙漏', '指南针',
      '手机', '充电宝', '耳机', '蓝牙音箱', '自拍杆', '行李箱', '口罩', '眼镜', '墨镜', '帽子',
      '围巾', '手套', '雨衣', '拖鞋', '高跟鞋', '电动车', '共享单车', '地铁', '高铁', '飞机',
      '出租车', '红绿灯', '斑马线', '快递箱', '外卖', '扫地机器人', '空调', '冰箱', '洗衣机', '微波炉',
      '马桶', '牙刷', '镜子', '枕头', '台灯', '插座', '钥匙', '钱包', '垃圾桶', '体重秤',
    ],
    wordsEn: [
      'Umbrella', 'Bicycle', 'Ferris Wheel', 'Helicopter', 'Submarine', 'Telescope', 'Hair Dryer', 'Fan', 'Hourglass', 'Compass',
      'Phone', 'Power Bank', 'Headphones', 'Bluetooth Speaker', 'Selfie Stick', 'Suitcase', 'Mask', 'Glasses', 'Sunglasses', 'Hat',
      'Scarf', 'Gloves', 'Raincoat', 'Slippers', 'High Heels', 'Electric Scooter', 'Bike Share', 'Subway', 'Bullet Train', 'Airplane',
      'Taxi', 'Traffic Light', 'Crosswalk', 'Delivery Box', 'Takeout', 'Robot Vacuum', 'Air Conditioner', 'Refrigerator', 'Washing Machine', 'Microwave',
      'Toilet', 'Toothbrush', 'Mirror', 'Pillow', 'Desk Lamp', 'Power Outlet', 'Key', 'Wallet', 'Trash Can', 'Scale',
    ],
  },
  action: {
    label: '动作',
    words: [
      '跳绳', '冲浪', '打太极', '骑马', '爬山', '打喷嚏', '挠痒痒', '拔河', '捉迷藏', '做梦',
      '刷牙', '洗澡', '睡懒觉', '熬夜', '加班', '跑步', '游泳', '跳舞', '唱歌', '打篮球',
      '踢足球', '打羽毛球', '瑜伽', '举重', '俯卧撑', '仰卧起坐', '跳广场舞', '钓鱼', '放风筝', '堆雪人',
      '打雪仗', '拍照', '自拍', '直播', '刷手机', '点外卖', '网购', '排队', '鼓掌', '敬礼',
    ],
    wordsEn: [
      'Jump Rope', 'Surfing', 'Tai Chi', 'Horse Riding', 'Hiking', 'Sneezing', 'Tickling', 'Tug of War', 'Hide and Seek', 'Dreaming',
      'Brushing Teeth', 'Showering', 'Sleeping In', 'Staying Up Late', 'Overtime', 'Running', 'Swimming', 'Dancing', 'Singing', 'Basketball',
      'Soccer', 'Badminton', 'Yoga', 'Weightlifting', 'Push-ups', 'Sit-ups', 'Square Dance', 'Fishing', 'Flying Kite', 'Building Snowman',
      'Snowball Fight', 'Taking Photo', 'Selfie', 'Live Streaming', 'Scrolling Phone', 'Ordering Food', 'Online Shopping', 'Queuing', 'Clapping', 'Saluting',
    ],
  },
  place: {
    label: '场景',
    words: [
      '海底世界', '太空站', '古代城堡', '沙漠绿洲', '雨后彩虹', '樱花大道', '极光', '火山爆发', '游乐园', '电影院',
      '图书馆', '健身房', '网吧', '奶茶店', '火锅店', '菜市场', '超市', '地铁站', '机场', '海滩',
      '露营', '游泳池', '滑雪场', '动物园', '水族馆', '博物馆', '学校', '医院', '办公室', '理发店',
      'KTV', '密室逃脱', '剧本杀', '演唱会', '庙会',
    ],
    wordsEn: [
      'Underwater World', 'Space Station', 'Ancient Castle', 'Desert Oasis', 'Rainbow', 'Cherry Blossom Avenue', 'Northern Lights', 'Volcano Eruption', 'Amusement Park', 'Cinema',
      'Library', 'Gym', 'Internet Cafe', 'Milk Tea Shop', 'Hot Pot Restaurant', 'Vegetable Market', 'Supermarket', 'Subway Station', 'Airport', 'Beach',
      'Camping', 'Swimming Pool', 'Ski Resort', 'Zoo', 'Aquarium', 'Museum', 'School', 'Hospital', 'Office', 'Barber Shop',
      'Karaoke', 'Escape Room', 'Murder Mystery', 'Concert', 'Temple Fair',
    ],
  },
  idiom: {
    label: '成语俗语',
    words: [
      '亡羊补牢', '守株待兔', '画蛇添足', '塞翁失马', '对牛弹琴', '杯水车薪', '纸老虎', '变色龙', '井底之蛙', '狐假虎威',
      '画龙点睛', '掩耳盗铃', '刻舟求剑', '拔苗助长', '胸有成竹', '鸡飞狗跳', '鸡同鸭讲', '马马虎虎', '九牛一毛', '如鱼得水',
      '虎头蛇尾', '狼吞虎咽', '叶公好龙', '自相矛盾', '一石二鸟', '猴子捞月', '盲人摸象', '杀鸡儆猴', '打草惊蛇', '顺手牵羊',
      '指鹿为马', '愚公移山', '精卫填海', '画饼充饥', '三心二意',
    ],
    wordsEn: [
      'Lock the Stable After the Horse Has Bolted', 'Waiting for a Windfall', 'Gilding the Lily', 'Blessing in Disguise', 'Casting Pearls Before Swine', 'Futile Effort', 'Paper Tiger', 'Chameleon', 'Frog in a Well', 'Borrowing Power',
      'Finishing Touch', 'Deceiving Yourself', 'Marking the Boat to Find the Sword', 'Pulling Seedlings to Help Them Grow', 'Confident', 'Chaos', 'Talking Past Each Other', 'Careless', 'Drop in the Bucket', 'Like a Duck in Water',
      'Strong Start, Weak Finish', 'Wolfing Down Food', 'Superficial Interest', 'Self-Contradiction', 'Kill Two Birds with One Stone', 'Monkey Fishing the Moon', 'Blind Men Feeling an Elephant', 'Make an Example', 'Alerting the Enemy', 'Stealing on the Way',
      'Calling a Deer a Horse', 'Foolish Old Man Moving Mountains', 'Filling the Sea', 'Drawing Cake to Satisfy Hunger', 'Half-Hearted',
    ],
  },
  movie: {
    label: '影视动漫游戏',
    words: [
      '西游记', '孙悟空', '猪八戒', '白雪公主', '灰姑娘', '哪吒', '葫芦娃', '黑猫警长', '喜羊羊', '灰太狼',
      '熊大', '光头强', '海绵宝宝', '皮卡丘', '哆啦A梦', '蜡笔小新', '柯南', '奥特曼', '蜘蛛侠', '钢铁侠',
      '超人', '蝙蝠侠', '哈利波特', '泰坦尼克号', '功夫熊猫', '冰雪奇缘', '疯狂动物城', '千与千寻', '龙猫', '流浪地球',
      '王者荣耀', '吃鸡', '我的世界', '植物大战僵尸', '超级玛丽', '俄罗斯方块', '贪吃蛇', '愤怒的小鸟', '羊了个羊', '原神',
    ],
    wordsEn: [
      'Journey to the West', 'Monkey King', 'Pigsy', 'Snow White', 'Cinderella', 'Nezha', 'Calabash Brothers', 'Black Cat Detective', 'Pleasant Goat', 'Big Big Wolf',
      'Briar Bear', 'Vick', 'SpongeBob', 'Pikachu', 'Doraemon', 'Crayon Shin-chan', 'Detective Conan', 'Ultraman', 'Spider-Man', 'Iron Man',
      'Superman', 'Batman', 'Harry Potter', 'Titanic', 'Kung Fu Panda', 'Frozen', 'Zootopia', 'Spirited Away', 'My Neighbor Totoro', 'Wandering Earth',
      'Honor of Kings', 'PUBG', 'Minecraft', 'Plants vs Zombies', 'Super Mario', 'Tetris', 'Snake Game', 'Angry Birds', 'Sheep a Sheep', 'Genshin Impact',
    ],
  },
  internet: {
    label: '网络热词',
    words: [
      '表情包', '点赞', '弹幕', '网红', '直播带货', '双十一', '秒杀', '拼单', '砍一刀', '躺平',
      '内卷', '摸鱼', '打工人', '社恐', '社牛', '显眼包', '电子榨菜', '吃瓜', '真香', '破防',
      '锦鲤', '凡尔赛', '剁手', '夜猫子', '起床气', '选择困难症', '拖延症', '强迫症', '柠檬精', '杠精',
      '佛系', '断舍离', '种草', '拔草', '踩坑', '薅羊毛', '搬砖', '开盲盒', '云吸猫', '反向旅游',
    ],
    wordsEn: [
      'Meme', 'Like', 'Bullet Comments', 'Influencer', 'Live Commerce', "Singles' Day", 'Flash Sale', 'Group Buy', 'Help Me Slash', 'Lying Flat',
      'Involution', 'Slacking Off', 'Working Class', 'Social Anxiety', 'Social Butterfly', 'Attention Seeker', 'Digital Pickle', 'Spectator', 'So True', 'Emotional Breakdown',
      'Lucky Koi', 'Humble Brag', 'Impulse Buy', 'Night Owl', 'Morning Grumpiness', 'Indecision', 'Procrastination', 'OCD', 'Jealousy', 'Troll',
      'Zen Mode', 'Minimalism', 'Planting Grass', 'Pulling Grass', 'Falling for Trap', 'Bargain Hunting', 'Working Hard', 'Blind Box', 'Cloud Cat Petting', 'Reverse Tourism',
    ],
  },
};
