// Quick Quiz extra questions: fun (fun1 - fun80)
module.exports = [
  // 依据: 植物分类学常识
  { id: 'fun1', cat: 'nature', diff: 1, zh: { q: '从植物学分类来看，以下哪种水果属于真正的浆果？', opts: ['香蕉', '草莓', '黑莓', '苹果'] }, en: { q: 'Botanically speaking, which fruit is a true berry?', opts: ['Banana', 'Strawberry', 'Blackberry', 'Apple'] }, answer: 0 },
  // 依据: 天体物理学与行星公转自转常识
  { id: 'fun2', cat: 'science', diff: 2, zh: { q: '太阳系中，哪颗行星上的一天比它的一年还要长？', opts: ['水星', '金星', '火星', '木星'] }, en: { q: 'On which planet is one day longer than one year?', opts: ['Mercury', 'Venus', 'Mars', 'Jupiter'] }, answer: 1 },
  // 依据: 海洋生物学常识
  { id: 'fun3', cat: 'nature', diff: 1, zh: { q: '章鱼体内的血液通常呈现什么颜色？', opts: ['红色', '绿色', '蓝色', '透明色'] }, en: { q: 'What color is the blood of an octopus?', opts: ['Red', 'Green', 'Blue', 'Clear'] }, answer: 2 },
  // 依据: 考古学与古生物年表
  { id: 'fun4', cat: 'history', diff: 3, zh: { q: '古埃及建造吉萨大金字塔时，地球上还活着哪种动物？', opts: ['霸王龙', '渡渡鸟', '剑齿虎', '猛犸象'] }, en: { q: 'Which animal was still alive when Giza pyramids were built?', opts: ['T-Rex', 'Dodo', 'Sabertooth cat', 'Mammoth'] }, answer: 3 },
  // 依据: 古生物学与植物进化史
  { id: 'fun5', cat: 'nature', diff: 2, zh: { q: '地球上最早出现的鲨鱼比下列哪种事物还要古老？', opts: ['树木', '海洋', '细菌', '三叶虫'] }, en: { q: 'Sharks are older than which of the following on Earth?', opts: ['Trees', 'Oceans', 'Bacteria', 'Trilobites'] }, answer: 0 },
  // 依据: 世界地理与地图测量
  { id: 'fun6', cat: 'geography', diff: 2, zh: { q: '船只从大西洋穿过巴拿马运河进入太平洋，航向大致朝哪？', opts: ['西北', '东南', '正北', '正东'] }, en: { q: 'Sailing through Panama Canal from Atlantic to Pacific, which way do you go?', opts: ['Northwest', 'Southeast', 'Due north', 'Due east'] }, answer: 1 },
  // 依据: 地理空间测绘常识
  { id: 'fun7', cat: 'geography', diff: 3, zh: { q: '在地理距离上，离非洲大陆最近的美国本土州是哪个？', opts: ['佛罗里达州', '北卡罗来纳州', '缅因州', '佐治亚州'] }, en: { q: 'Which US state is geographically closest to Africa?', opts: ['Florida', 'North Carolina', 'Maine', 'Georgia'] }, answer: 2 },
  // 依据: 企鹅解剖学常识
  { id: 'fun8', cat: 'nature', diff: 2, zh: { q: '企鹅站立和行走看似直挺，它们身体内部其实有膝盖吗？', opts: ['完全没有', '只有软骨', '退化消失了', '有且隐藏弯曲着'] }, en: { q: 'Do penguins have knees hidden inside their bodies?', opts: ['No knees at all', 'Only cartilage', 'Fully lost them', 'Yes bent inside'] }, answer: 3 },
  // 依据: 发明专利史常识
  { id: 'fun9', cat: 'history', diff: 1, zh: { q: '马口铁罐头在1810年发明，专用开罐器大约多久后才出现？', opts: ['约50年后', '约100年后', '同一年', '发明前就有'] }, en: { q: 'Cans were invented in 1810. When was can opener invented?', opts: ['About 50 years later', 'About 100 years later', 'The same year', 'Before cans existed'] }, answer: 0 },
  // 依据: 恒星物理学辐射区光子传输理论
  { id: 'fun10', cat: 'science', diff: 3, zh: { q: '太阳核心核聚变产生的光子，逃逸到太阳表面大约需要多久？', opts: ['约8分钟', '数万到数十万年', '约24小时', '约3秒钟'] }, en: { q: 'How long does a photon take to escape from the solar core to the surface?', opts: ['About 8 minutes', 'Tens of thousands of years', 'About 24 hours', 'About 3 seconds'] }, answer: 1 },
  // 依据: 鸟类生物学与色素摄入常识
  { id: 'fun11', cat: 'nature', diff: 2, zh: { q: '火烈鸟羽毛原本偏灰白，其标志性的粉红色主要来源于什么？', opts: ['自身基因色素', '阳光紫外线照射', '食物中的类胡萝卜素', '皮下血液渗透'] }, en: { q: 'Why do flamingo feathers turn pink in the wild?', opts: ['Gene pigments', 'Sunlight UV rays', 'Carotenoids in food', 'Blood in feathers'] }, answer: 2 },
  // 依据: 世界卫生组织(WHO)统计数据
  { id: 'fun12', cat: 'nature', diff: 2, zh: { q: '按每年直接或间接致人死亡的人数计算，地球上最致命的动物是？', opts: ['毒蛇', '大白鲨', '河马', '蚊子'] }, en: { q: 'Which animal causes the highest number of human deaths per year?', opts: ['Venomous snakes', 'Sharks', 'Hippos', 'Mosquitoes'] }, answer: 3 },
  // 依据: 食品科学与巧克力配方常识
  { id: 'fun13', cat: 'food', diff: 1, zh: { q: '严格从配方上看，白巧克力之所以颜色发白是因为它不含什么？', opts: ['可可固形物', '可可脂', '白砂糖', '脱脂奶粉'] }, en: { q: 'White chocolate is pale because it does not contain what?', opts: ['Cocoa solids', 'Cocoa butter', 'Sugar', 'Milk powder'] }, answer: 0 },
  // 依据: 世界历史年表常识
  { id: 'fun14', cat: 'history', diff: 3, zh: { q: '英国牛津大学与美洲阿兹特克帝国相比，哪一个历史更加悠久？', opts: ['阿兹特克帝国更早', '牛津大学更早', '两者同一年建立', '两者时间无法考证'] }, en: { q: 'Which one was founded earlier in history?', opts: ['Aztec Empire', 'University of Oxford', 'Same year exactly', 'Unknown timing'] }, answer: 1 },
  // 依据: 分子生物学与哺乳动物系统发育树
  { id: 'fun15', cat: 'nature', diff: 3, zh: { q: '从进化生物学来看，现代鲸类在陆地上现存最近的亲属动物是？', opts: ['大象', '犀牛', '河马', '海豹'] }, en: { q: 'Which land mammal is the closest living relative of whales?', opts: ['Elephant', 'Rhinoceros', 'Hippopotamus', 'Seal'] }, answer: 2 },
  // 依据: 人体解剖学常识
  { id: 'fun16', cat: 'science', diff: 1, zh: { q: '按表面积与总重量来计算，人体内部或表面最大的器官是？', opts: ['肝脏', '大肠', '脑', '皮肤'] }, en: { q: 'By surface area and weight, what is the largest organ of the human body?', opts: ['Liver', 'Large intestine', 'Brain', 'Skin'] }, answer: 3 },
  // 依据: 考古学与国家地理统计
  { id: 'fun17', cat: 'geography', diff: 3, zh: { q: '世界上现存古代金字塔数量最多的国家是哪一个？', opts: ['苏丹', '埃及', '墨西哥', '秘鲁'] }, en: { q: 'Which country has the most ancient pyramids in the world?', opts: ['Sudan', 'Egypt', 'Mexico', 'Peru'] }, answer: 0 },
  // 依据: 食品科学与考古发现
  { id: 'fun18', cat: 'food', diff: 1, zh: { q: '在常温密封避光的理想条件下，哪种食物理论上几乎永不变质？', opts: ['白酒', '纯蜂蜜', '脱脂奶粉', '干茶叶'] }, en: { q: 'When sealed dry, which food can last almost forever without rotting?', opts: ['Spirits', 'Pure honey', 'Skim milk powder', 'Dry tea leaves'] }, answer: 1 },
  // 依据: 鸟类飞行力学常识
  { id: 'fun19', cat: 'nature', diff: 2, zh: { q: '由于特殊的翅膀关节构造，世界上唯一能够倒退飞行的鸟类是？', opts: ['雨燕', '翠鸟', '蜂鸟', '海鸥'] }, en: { q: 'Which bird is the only one capable of flying backwards?', opts: ['Swift', 'Kingfisher', 'Hummingbird', 'Seagull'] }, answer: 2 },
  // 依据: 声学与材料物理常识
  { id: 'fun20', cat: 'science', diff: 3, zh: { q: '常温下，声音在钢铁固体中的传播速度大约是空气中的多少倍？', opts: ['约2倍', '约5倍', '约8倍', '约15倍'] }, en: { q: 'Sound travels through steel roughly how many times faster than in air?', opts: ['About 2 times', 'About 5 times', 'About 8 times', 'About 15 times'] }, answer: 3 },
  // 依据: 气象学与极地地理常识
  { id: 'fun21', cat: 'geography', diff: 3, zh: { q: '以年平均降水量极低为衡量标准，地球上最干燥的大陆是哪个？', opts: ['南极洲', '非洲', '大洋洲', '亚洲'] }, en: { q: 'By lowest annual precipitation, which continent is the driest on Earth?', opts: ['Antarctica', 'Africa', 'Oceania', 'Asia'] }, answer: 0 },
  // 依据: 海洋生物繁殖学常识
  { id: 'fun22', cat: 'nature', diff: 1, zh: { q: '在海马的繁殖繁育过程中，是由哪一方负责怀卵孵化并分娩的？', opts: ['雌海马', '雄海马', '双方轮流怀卵', '无性分裂'] }, en: { q: 'In seahorses, which parent carries eggs in a pouch and gives birth?', opts: ['Female', 'Male', 'Both in turn', 'Asexual division'] }, answer: 1 },
  // 依据: 企业史与任天堂官方资料
  { id: 'fun23', cat: 'history', diff: 2, zh: { q: '知名游戏公司任天堂最初于1889年创立，它最早主营的产品是？', opts: ['弹珠机', '木制拼图', '传统花札纸牌', '自动点唱机'] }, en: { q: 'Nintendo was founded in 1889. What did it sell originally?', opts: ['Pinball machines', 'Wooden puzzles', 'Hanafuda cards', 'Jukeboxes'] }, answer: 2 },
  // 依据: 热力学与物理实验现象
  { id: 'fun24', cat: 'science', diff: 3, zh: { q: '在特定实验条件下，热水比冷水更快结冰的反直觉物理现象叫什么？', opts: ['丁达尔效应', '多普勒效应', '霍尔效应', '姆潘巴效应'] }, en: { q: 'What is the effect where warm water can freeze faster than cold water?', opts: ['Tyndall effect', 'Doppler effect', 'Hall effect', 'Mpemba effect'] }, answer: 3 },
  // 依据: 生物光学与北极熊毛发微观结构
  { id: 'fun25', cat: 'nature', diff: 2, zh: { q: '北极熊看起来通体雪白，但实际上它每根毛发的微观结构是？', opts: ['透明中空的', '纯白色实心', '半反光实心', '表面附着白色粉末'] }, en: { q: 'Polar bear fur looks snow white, but what is its true physical structure?', opts: ['Transparent and hollow', 'Solid pure white', 'Semi reflective', 'Coated in powder'] }, answer: 0 },
  // 依据: 生物分类学常识
  { id: 'fun26', cat: 'nature', diff: 1, zh: { q: '下列哪种动物从现代生物学分类来看不属于哺乳动物？', opts: ['鸭嘴兽', '海马', '海豚', '蝙蝠'] }, en: { q: 'Which of the following animals is not classified as a mammal?', opts: ['Platypus', 'Seahorse', 'Dolphin', 'Bat'] }, answer: 1 },
  // 依据: 植物形态学与食用部位分类
  { id: 'fun27', cat: 'food', diff: 1, zh: { q: '我们在日常生活中食用的以下常见蔬菜中，哪一个不是植物的根？', opts: ['胡萝卜', '白萝卜', '土豆（马铃薯）', '红薯（地瓜）'] }, en: { q: 'Which of the following vegetables is a stem, not a plant root?', opts: ['Carrot', 'White radish', 'Potato', 'Sweet potato'] }, answer: 2 },
  // 依据: 世界地理与各国首都常识
  { id: 'fun28', cat: 'geography', diff: 1, zh: { q: '下列哪座闻名世界的国际大都市并不是所在国家的法定首都？', opts: ['渥太华', '开罗', '马德里', '悉尼'] }, en: { q: 'Which of the following famous cities is not a national capital?', opts: ['Ottawa', 'Cairo', 'Madrid', 'Sydney'] }, answer: 3 },
  // 依据: 二十四节气农历天象划分
  { id: 'fun29', cat: 'cncult', diff: 2, zh: { q: '下列传统二十四节气中，哪一个按气候划分不属于夏季节气？', opts: ['处暑', '小满', '芒种', '小暑'] }, en: { q: 'Which of the following traditional Chinese solar terms is not in summer?', opts: ['Chushu (End of Heat)', 'Xiaoman', 'Mangzhong', 'Xiaoshu'] }, answer: 0 },
  // 依据: 国际天文学联合会(IAU)2006年行星定义
  { id: 'fun30', cat: 'science', diff: 2, zh: { q: '按照国际天文学联合会现行定义，下列哪个不是太阳系八大行星？', opts: ['天王星', '冥王星', '海王星', '土星'] }, en: { q: 'Under IAU astronomical standards, which is not one of the eight planets?', opts: ['Uranus', 'Pluto', 'Neptune', 'Saturn'] }, answer: 1 },
  // 依据: 食品加工与调味品工艺常识
  { id: 'fun31', cat: 'food', diff: 1, zh: { q: '下列厨房常见调味品中，通常不经过微生物发酵工艺制成的是？', opts: ['酱油', '食醋', '白砂糖', '黄豆酱'] }, en: { q: 'Which common kitchen seasoning is normally not made via fermentation?', opts: ['Soy sauce', 'Vinegar', 'Granulated sugar', 'Bean paste'] }, answer: 2 },
  // 依据: 诺贝尔基金会奖项设立历史
  { id: 'fun32', cat: 'culture', diff: 1, zh: { q: '在诺贝尔生前遗嘱设立的各个奖项中，下列哪个学科没有设奖？', opts: ['化学', '物理学', '文学', '数学'] }, en: { q: 'Which of the following academic fields does not have a Nobel Prize?', opts: ['Chemistry', 'Physics', 'Literature', 'Mathematics'] }, answer: 3 },
  // 依据: 节肢动物门形态学常识
  { id: 'fun33', cat: 'nature', diff: 1, zh: { q: '从成虫具有三对足的昆虫纲定义来看，下列哪种生物不是昆虫？', opts: ['蜘蛛', '蚂蚁', '蜜蜂', '蝴蝶'] }, en: { q: 'Biologically speaking, which of these creatures is not an insect?', opts: ['Spider', 'Ant', 'Honeybee', 'Butterfly'] }, answer: 0 },
  // 依据: 古希腊古典文献中的世界奇迹名录
  { id: 'fun34', cat: 'history', diff: 3, zh: { q: '在西方古典文献记录的古代世界七大奇迹中，哪座建筑不在此列？', opts: ['吉萨金字塔', '罗马斗兽场', '巴比伦空中花园', '罗德岛巨像'] }, en: { q: 'Which of these was not among the Seven Wonders of the Ancient World?', opts: ['Pyramids of Giza', 'Colosseum of Rome', 'Hanging Gardens', 'Colossus of Rhodes'] }, answer: 1 },
  // 依据: 中国历史典故与成语出处
  { id: 'fun35', cat: 'idiom', diff: 2, zh: { q: '下列哪一个常用成语的历史典故与三国时期的人物故事无关？', opts: ['望梅止渴', '三顾茅庐', '负荆请罪', '如鱼得水'] }, en: { q: 'Which Chinese idiom story does not relate to the Three Kingdoms era?', opts: ['Wang mei zhi ke', 'San gu mao lu', 'Fu jing qing zui', 'Ru yu de shui'] }, answer: 2 },
  // 依据: 生物化学与营养学常识
  { id: 'fun36', cat: 'science', diff: 3, zh: { q: '下列人体必需的各种维生素中，哪一种属于水溶性而非脂溶性？', opts: ['维生素A', '维生素D', '维生素E', '维生素C'] }, en: { q: 'Which of the following is a water soluble vitamin, not fat soluble?', opts: ['Vitamin A', 'Vitamin D', 'Vitamin E', 'Vitamin C'] }, answer: 3 },
  // 依据: 亚洲水系与中国地理常识
  { id: 'fun37', cat: 'geography', diff: 3, zh: { q: '下列亚洲跨国大江大河中，其干流完全没有流经中国国土的是？', opts: ['恒河', '湄公河', '额尔齐斯河', '雅鲁藏布江'] }, en: { q: 'Which international Asian river does not flow through China at all?', opts: ['Ganges River', 'Mekong River', 'Irtysh River', 'Yarlung Tsangpo'] }, answer: 0 },
  // 依据: 中国传统乐律学五声音阶
  { id: 'fun38', cat: 'cncult', diff: 2, zh: { q: '中国传统音乐中的五声音阶由五个音组成，下列哪个字不在此列？', opts: ['角', '韵', '徵', '羽'] }, en: { q: 'In the traditional Chinese five tone scale, which is not one of them?', opts: ['Jue', 'Yun', 'Zhi', 'Yu'] }, answer: 1 },
  // 依据: 城市生活垃圾分类国家标准
  { id: 'fun39', cat: 'life', diff: 1, zh: { q: '在标准城市生活垃圾分类规范中，下列哪种废弃物不属于有害垃圾？', opts: ['废荧光灯管', '水银温度计', '纯旧报纸', '过期西药片'] }, en: { q: 'In standard waste sorting guidelines, which item is not hazardous waste?', opts: ['Fluorescent tubes', 'Mercury thermometer', 'Clean old newspapers', 'Expired medicine'] }, answer: 2 },
  // 依据: 元素周期表单质物理状态常识
  { id: 'fun40', cat: 'science', diff: 3, zh: { q: '在常温常压（25℃、1个大气压）下，下列哪种非金属单质不是气体？', opts: ['氖', '氮', '氯', '溴'] }, en: { q: 'At standard room conditions, which chemical element is not a gas?', opts: ['Neon', 'Nitrogen', 'Chlorine', 'Bromine'] }, answer: 3 },
  // 依据: 经典中文谜语与英文双关
  { id: 'fun41', cat: 'idiom', diff: 1, zh: { q: '脑筋急转弯："狼来了"打一种我们常吃的水果，谜底是什么？', opts: ['杨桃', '香蕉', '杨梅', '火龙果'] }, en: { q: 'Riddle: What has dozens of keys but cannot unlock a single door?', opts: ['A piano', 'A key ring', 'A treasure chest', 'A lockbox'] }, answer: 0 },
  // 依据: 汉字拆字谜与经典英文谜语
  { id: 'fun42', cat: 'idiom', diff: 1, zh: { q: '传统字谜："一口吃掉牛尾巴"，猜一个我们常用的汉字？', opts: ['午', '告', '生', '失'] }, en: { q: 'Riddle: What gets wetter and wetter the more it dries?', opts: ['A sponge', 'A towel', 'A water pipe', 'A cloud'] }, answer: 1 },
  // 依据: 谐音脑筋急转弯与经典英文谜语
  { id: 'fun43', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯：传说中的祥瑞神兽麒麟飞到了北极，会变成什么？', opts: ['独角兽', '驯鹿', '冰淇淋', '雪怪'] }, en: { q: 'Riddle: What kind of room has no doors, no walls, and no windows?', opts: ['A dining room', 'A bathroom', 'A mushroom', 'A classroom'] }, answer: 2 },
  // 依据: 汉字合体字谜与英文谜语
  { id: 'fun44', cat: 'idiom', diff: 2, zh: { q: '民间传统字谜："千里相逢"（打一个日常使用的汉字），谜底是？', opts: ['香', '街', '伯', '重'] }, en: { q: 'Riddle: What has a thumb and four fingers, but is not alive at all?', opts: ['A puppet', 'A clock face', 'A stone hand', 'A glove'] }, answer: 3 },
  // 依据: 经典成语谐音梗与英文谜语
  { id: 'fun45', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯："布"和"纸"这两种东西最害怕什么？（打一成语）', opts: ['只怕万一', '一鸣惊人', '万事俱备', '百发百中'] }, en: { q: 'Riddle: What can you catch easily, but can never throw away?', opts: ['A cold', 'A tennis ball', 'A fast train', 'A flying bird'] }, answer: 0 },
  // 依据: 动物谐音梗与英文倒拼构词
  { id: 'fun46', cat: 'culture', diff: 2, zh: { q: '脑筋急转弯：森林里哪种动物走路时最容易脚滑摔倒？', opts: ['袋鼠', '狐狸', '梅花鹿', '刺猬'] }, en: { q: 'Riddle: Forward I am heavy, but spelled backward I am not. What am I?', opts: ['Lead', 'Ton', 'Stone', 'Anchor'] }, answer: 1 },
  // 依据: 经典生活脑筋急转弯与英文谜语
  { id: 'fun47', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯：日常生活中"打"什么东西既不费力气也不花一分钱？', opts: ['打毛衣', '打水漂', '打哈欠', '打官司'] }, en: { q: 'Riddle: What has a neck but absolutely no head?', opts: ['A guitar', 'A snake', 'A bottle', 'A violin'] }, answer: 2 },
  // 依据: 汉字拆解字谜与英文谜语
  { id: 'fun48', cat: 'idiom', diff: 2, zh: { q: '民间趣味字谜："七十二小时"（打一常见汉字），谜底是？', opts: ['旬', '明', '晨', '晶'] }, en: { q: 'Riddle: What can run all day long without having legs or moving feet?', opts: ['A wheel', 'The wind', 'A clock', 'A river'] }, answer: 3 },
  // 依据: 经典食物谐音脑筋急转弯与英文谜语
  { id: 'fun49', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯：大鲨鱼在海里不小心吞了一颗绿豆，它变成了什么？', opts: ['绿豆沙', '海龟', '绿毛龟', '海带'] }, en: { q: 'Riddle: What has a single eye, but cannot see anything around it?', opts: ['A needle', 'A potato', 'A storm', 'A target'] }, answer: 0 },
  // 依据: 汉字拆字谜与经典英文双关谜语
  { id: 'fun50', cat: 'idiom', diff: 2, zh: { q: '趣味字谜："自大加一点"（打一日常汉字），谜底是哪一个？', opts: ['太', '臭', '白', '犬'] }, en: { q: 'Riddle: What begins with T, ends with T, and has T inside it?', opts: ['Target', 'Teapot', 'Tent', 'Toast'] }, answer: 1 },
  // 依据: 语言口语双关与经典英文谜语
  { id: 'fun51', cat: 'life', diff: 1, zh: { q: '脑筋急转弯：以下哪种日常口语中带"瓜"的词绝对不能食用？', opts: ['苦瓜', '香瓜', '傻瓜', '木瓜'] }, en: { q: 'Riddle: What kind of bank never holds or stores any coins or cash?', opts: ['Piggy bank', 'Data bank', 'River bank', 'Food bank'] }, answer: 2 },
  // 依据: 历史人物谐音梗与英文经典谜语
  { id: 'fun52', cat: 'history', diff: 2, zh: { q: '谐音冷知识：三国历史人物中，谁的名字听起来最像一道烹饪海鲜？', opts: ['曹操', '刘备', '孙权', '周瑜'] }, en: { q: 'Riddle: What belongs to you, but others use it far more than you do?', opts: ['Your wallet', 'Your shoes', 'Your home', 'Your name'] }, answer: 3 },
  // 依据: 经典文具拟人脑筋急转弯与英文谜语
  { id: 'fun53', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯：文具盒里哪件作图工具只有一只脚立着转圈圈？', opts: ['圆规', '三角尺', '橡皮擦', '量角器'] }, en: { q: 'Riddle: What goes up year after year but never comes back down?', opts: ['Your age', 'A balloon', 'A rocket', 'Smoke'] }, answer: 0 },
  // 依据: 经典连环草地谐音谜语与英文谜语
  { id: 'fun54', cat: 'culture', diff: 1, zh: { q: '脑筋急转弯：青青草地上来了一群饥饿的羊，打一种常见水果？', opts: ['杨梅', '草莓', '雪梨', '蓝莓'] }, en: { q: 'Riddle: What has dozens of teeth but cannot chew or bite anything?', opts: ['A zipper', 'A comb', 'A gear wheel', 'A hand saw'] }, answer: 1 },
  // 依据: 承接连环谐音谜语与英文双关谜语
  { id: 'fun55', cat: 'culture', diff: 2, zh: { q: '接上题脑筋急转弯：草地上接着又冲过来一群恶狼，再打一种水果？', opts: ['草莓', '荔枝', '杨梅', '菠萝'] }, en: { q: 'Riddle: Which building in the whole world contains the most stories?', opts: ['Skyscraper', 'Palace', 'Library', 'Art gallery'] }, answer: 2 },
  // 依据: 气象学与美国国家大气研究中心(NCAR)测算
  { id: 'fun56', cat: 'science', diff: 2, zh: { q: '气象学测算，一朵典型的晴天积云（约1立方公里）大约有多重？', opts: ['约500吨', '约50公斤', '约5吨', '约50万吨'] }, en: { q: 'Meteorologists estimate a typical fair weather cumulus cloud weighs about?', opts: ['About 500 tons', 'About 50 kg', 'About 5 tons', 'About 500k tons'] }, answer: 0 },
  // 依据: 神经解剖学标准测量数据(Herculano-Houzel等)
  { id: 'fun57', cat: 'science', diff: 2, zh: { q: '现代神经科学研究表明，正常成年人脑内大约包含多少个神经元？', opts: ['约86万个', '约860亿个', '约8600万个', '约8.6万亿个'] }, en: { q: 'About how many neurons are there inside a normal adult human brain?', opts: ['About 860 thousand', 'About 86 billion', 'About 86 million', 'About 8.6 trillion'] }, answer: 1 },
  // 依据: 皇家安大略博物馆蓝鲸解剖实测数据
  { id: 'fun58', cat: 'nature', diff: 3, zh: { q: '成年的蓝鲸是地球上已知最大的动物，其单颗心脏重量大约是多少？', opts: ['约1.8公斤', '约18公斤', '约180公斤', '约1800公斤'] }, en: { q: 'Roughly how much does the heart of an adult blue whale weigh?', opts: ['About 1.8 kg', 'About 18 kg', 'About 180 kg', 'About 1800 kg'] }, answer: 2 },
  // 依据: 国际天文学光速与日地平均距离(1.496亿公里)
  { id: 'fun59', cat: 'science', diff: 2, zh: { q: '太阳表面发出的光线穿越太空到达地球，大约需要耗费多长时间？', opts: ['约8秒钟', '约8小时', '约8天', '约8分20秒'] }, en: { q: 'About how long does sunlight take to travel through space to Earth?', opts: ['About 8 seconds', 'About 8 hours', 'About 8 days', 'About 8 minutes 20s'] }, answer: 3 },
  // 依据: 国际海道测量组织(IHO)深海测量数据
  { id: 'fun60', cat: 'geography', diff: 2, zh: { q: '地球海洋最深处马里亚纳海沟挑战者深渊的最大水深大约是多少？', opts: ['约11000米', '约3000米', '约35000米', '约800米'] }, en: { q: 'About how deep is Challenger Deep in the Mariana Trench?', opts: ['About 11000 meters', 'About 3000 meters', 'About 35000 meters', 'About 800 meters'] }, answer: 0 },
  // 依据: 人体解剖学与循环系统生理常识
  { id: 'fun61', cat: 'science', diff: 3, zh: { q: '如果将一个成年人体内全部的血管首尾相接，总长度大约是多少？', opts: ['约1000公里', '约10万公里', '约100公里', '约1000万公里'] }, en: { q: 'If all blood vessels in a human body were tied end to end, how long are they?', opts: ['About 1000 km', 'About 100000 km', 'About 100 km', 'About 10 million km'] }, answer: 1 },
  // 依据: 巴黎埃菲尔铁塔管理委员会工程测算
  { id: 'fun62', cat: 'culture', diff: 3, zh: { q: '由于钢铁受热膨胀，高约330米的埃菲尔铁塔在酷暑时大约伸长？', opts: ['约0.1毫米', '约1厘米', '约15厘米', '约3米'] }, en: { q: 'Because of thermal expansion, Eiffel Tower in hot summer grows by about?', opts: ['About 0.1 mm', 'About 1 cm', 'About 15 cm', 'About 3 meters'] }, answer: 2 },
  // 依据: 魏茨曼科学研究所2016年人体细胞与共生微生物研究
  { id: 'fun63', cat: 'science', diff: 3, zh: { q: '现代生物学精准测算，成年人体内的细菌细胞与自身体细胞数量比约为？', opts: ['约100比1', '约1比100', '约1000比1', '约1比1'] }, en: { q: 'Modern cell biology shows the ratio of bacteria to human cells is roughly?', opts: ['About 100 to 1', 'About 1 to 100', 'About 1000 to 1', 'About 1 to 1'] }, answer: 3 },
  // 依据: 美国农业部(USDA)与养蜂学测算
  { id: 'fun64', cat: 'nature', diff: 3, zh: { q: '一只普通的工蜂度过其忙碌的一生，总共大约只能酿造出多少蜂蜜？', opts: ['约十二分之一茶匙', '约一满玻璃瓶', '约半斤重', '约一大碗'] }, en: { q: 'In its entire lifetime, about how much honey does one worker bee make?', opts: ['About 1/12 teaspoon', 'About a full jar', 'About 250 grams', 'About a big bowl'] }, answer: 0 },
  // 依据: 波音民用飞机飞行手册巡航油耗数据
  { id: 'fun65', cat: 'general', diff: 3, zh: { q: '一架波音747大型宽体客机在万米高空巡航时，平均每秒消耗多少燃油？', opts: ['约0.01升', '约0.1升', '约4升', '约200升'] }, en: { q: 'During cruise flight, about how much fuel does a Boeing 747 burn each second?', opts: ['About 0.01 liter', 'About 0.1 liter', 'About 4 liters', 'About 200 liters'] }, answer: 2 },
  // 依据: 灵长类动物全基因组测序分析数据
  { id: 'fun66', cat: 'nature', diff: 3, zh: { q: '生物基因组测序表明，黑猩猩与人类的DNA序列相似度大约达到？', opts: ['约50%', '约75%', '约90%', '约98.8%'] }, en: { q: 'Genome sequencing shows chimpanzee DNA is how similar to human DNA?', opts: ['About 50%', 'About 75%', 'About 90%', 'About 98.8%'] }, answer: 3 },
  // 依据: 大地测量学与WGS-84参考椭球体数据
  { id: 'fun67', cat: 'geography', diff: 2, zh: { q: '大地测量学数据显示，地球赤道的周长大约是多少公里？', opts: ['约40000公里', '约12000公里', '约80000公里', '约6400公里'] }, en: { q: 'About how many kilometers is the circumference of the equator of the Earth?', opts: ['About 40000 km', 'About 12000 km', 'About 80000 km', 'About 6400 km'] }, answer: 0 },
  // 依据: 人体解剖学发育常识
  { id: 'fun68', cat: 'science', diff: 3, zh: { q: '新生婴儿出生时骨骼尚未完全愈合，全身骨骼总数大约有多少块？', opts: ['约100块', '约300块', '约206块', '约500块'] }, en: { q: 'About how many bones does a human baby have at birth before bones fuse?', opts: ['About 100 bones', 'About 300 bones', 'About 206 bones', 'About 500 bones'] }, answer: 1 },
  // 依据: 鸟类生理学吉尼斯世界纪录
  { id: 'fun69', cat: 'nature', diff: 3, zh: { q: '已知心率极快的蜂鸟在极速振翅飞翔时，心跳每分钟最高大约可达多少？', opts: ['约120次', '约300次', '约1200次', '约5000次'] }, en: { q: 'When flying at top speed, a hummingbird heart rate can reach up to about?', opts: ['About 120 bpm', 'About 300 bpm', 'About 1200 bpm', 'About 5000 bpm'] }, answer: 2 },
  // 依据: 国家文物局2012年明长城资源调查成果
  { id: 'fun70', cat: 'history', diff: 2, zh: { q: '国家文物局认定的明代长城墙体及险壕等防线总长度大约是多少？', opts: ['约800公里', '约2000公里', '约4000公里', '约8850公里'] }, en: { q: 'According to official survey data, the Ming Great Wall is about how long?', opts: ['About 800 km', 'About 2000 km', 'About 4000 km', 'About 8850 km'] }, answer: 3 },
  // 依据: 农艺学华蕉(Cavendish)栽培历史
  { id: 'fun71', cat: 'food', diff: 2, zh: { q: '目前全世界商业超市销售的无籽香蕉，绝大多数是通过什么方式培育的？', opts: ['种子播种', '无性克隆繁殖', '杂交嫁接', '野外自然采摘'] }, en: { q: 'Commercial seedless bananas sold in stores are mainly propagated by?', opts: ['Growing from seeds', 'Asexual cloning', 'Grafting onto trees', 'Wild harvesting'] }, answer: 1 },
  // 依据: 皇家学会动物学研究与流体动力学实验
  { id: 'fun72', cat: 'nature', diff: 2, zh: { q: '澳大利亚有袋类动物袋熊（Wombat），其排泄出的粪便具有什么独特形状？', opts: ['规则圆球形', '扁平圆盘形', '规整立方体', '长条弹簧形'] }, en: { q: 'What unique shape is the poop of an Australian wombat?', opts: ['Spherical balls', 'Flat discs', 'Regular cubes', 'Coiled springs'] }, answer: 2 },
  // 依据: 家用微波炉使用安全常识
  { id: 'fun73', cat: 'life', diff: 1, zh: { q: '在使用家用微波炉加热食物时，下列哪种材质的器皿严禁放入？', opts: ['高硼硅耐热玻璃', '普通家用陶瓷盘', '标有PP的塑料盒', '不锈钢金属碗'] }, en: { q: 'Which container material must never be placed inside a microwave oven?', opts: ['Tempered glass', 'Ceramic plate', 'PP plastic box', 'Stainless steel bowl'] }, answer: 3 },
  // 依据: 海洋哺乳动物行为学观察记录
  { id: 'fun74', cat: 'nature', diff: 2, zh: { q: '海獭在开阔水面上仰面漂浮睡觉时，通常采取什么办法防止被水流冲散？', opts: ['彼此手牵着手', '尾巴绑在礁石上', '缩在巨藻叶子底', '排成横排轮流划'] }, en: { q: 'How do sea otters keep from drifting apart while sleeping on water?', opts: ['Holding hands', 'Tying tails to rocks', 'Hiding under kelp', 'Swimming in turns'] }, answer: 0 },
  // 依据: 欧洲核子研究组织(CERN)万维网历史档案
  { id: 'fun75', cat: 'culture', diff: 3, zh: { q: '蒂姆·伯纳斯-李在CERN实验室搭建的世界上第一个互联网站点上线于哪一年？', opts: ['1983年', '1991年', '1998年', '2001年'] }, en: { q: 'In which year did the first website of the World Wide Web go online?', opts: ['1983', '1991', '1998', '2001'] }, answer: 1 },
  // 依据: 食品生物化学常识
  { id: 'fun76', cat: 'food', diff: 2, zh: { q: '生吃新鲜未煮的菠萝常常会让舌头刺痛，是因为菠萝中含有哪种物质？', opts: ['高浓度柠檬酸', '天然挥发芳香烃', '菠萝蛋白酶', '微量植物碱'] }, en: { q: 'Fresh pineapple makes your tongue sting because it contains what enzyme?', opts: ['Citric acid', 'Aromatic oils', 'Bromelain protease', 'Plant alkaloids'] }, answer: 2 },
  // 依据: 兽医解剖学常识
  { id: 'fun77', cat: 'nature', diff: 2, zh: { q: '家牛是典型的反刍食草动物，在解剖学上它的胃一共有几个胃室？', opts: ['1个', '2个', '3个', '4个'] }, en: { q: 'As a ruminant animal, how many stomach compartments does a cow have?', opts: ['1 compartment', '2 compartments', '3 compartments', '4 compartments'] }, answer: 3 },
  // 依据: 乐高集团官方历史与积木生产标准
  { id: 'fun78', cat: 'culture', diff: 2, zh: { q: '早在1958年生产的塑料乐高积木颗粒，与今天最新生产的乐高积木相比？', opts: ['依然能完美拼插', '凸粒变小无法卡紧', '原料不同无法咬合', '造型改版完全互斥'] }, en: { q: 'Can a plastic LEGO brick made in 1958 fit together with one made today?', opts: ['Yes fits perfectly', 'Too small to grip', 'Material slips off', 'Shape is incompatible'] }, answer: 0 },
  // 依据: 卡耐基梅隆大学计算机科学系BBS历史记录
  { id: 'fun79', cat: 'culture', diff: 3, zh: { q: '1982年，计算机科学家斯科特·法尔曼在BBS公告板上首次发明了什么？', opts: ['404错误提示', '字符笑脸表情:-)', '万维网超文本链接', '电子邮件@符号'] }, en: { q: 'In 1982, Scott Fahlman first proposed which symbol on a bulletin board?', opts: ['The 404 code', 'The smiley face :-)', 'The web hyperlink', 'The email @ sign'] }, answer: 1 },
  // 依据: 动物眼科学与双色视觉研究
  { id: 'fun80', cat: 'nature', diff: 2, zh: { q: '动物生理学实验证实，狗的视网膜双色视觉主要能够分辨哪两种颜色？', opts: ['红色与绿色', '黑色与白色', '紫色与粉色', '黄色与蓝色'] }, en: { q: 'Canine vision research shows dogs mainly see which two colors?', opts: ['Red and green', 'Black and white', 'Purple and pink', 'Yellow and blue'] }, answer: 3 },
];
