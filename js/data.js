/* =========================================================
   data.js — 全站演示数据（纯前端，无后端）
   ========================================================= */
window.JD = window.JD || {};

JD.brand = { name: '优选商城', slogan: '好物精选 · 品质生活' };

/** 分类：首页快捷入口与商品筛选共用 */
JD.categories = [
  { id: 'phone',     name: '手机数码', icon: '📱' },
  { id: 'computer',  name: '电脑办公', icon: '💻' },
  { id: 'appliance', name: '家用电器', icon: '🧊' },
  { id: 'fashion',   name: '服饰鞋包', icon: '🧥' },
  { id: 'beauty',    name: '美妆个护', icon: '🧴' },
  { id: 'food',      name: '食品生鲜', icon: '🍎' },
  { id: 'book',      name: '图书文娱', icon: '📚' },
  { id: 'sport',     name: '运动户外', icon: '👟' },
];

/**
 * 商品库
 * price 售价 / origin 划线价 / sales 销量文案 / tag 角标 / specs 可选规格
 */
JD.products = [
  {
    id: 'p1', name: '旗舰 5G 手机 12GB+256GB', desc: '2K 护眼屏 · 5000mAh 长续航 · 蔡司影像',
    price: 8999, origin: 9499, sales: '2.3万+', tag: '自营', cat: 'phone',
    specs: { 颜色: ['钛金属灰', '深空黑'], 容量: ['256GB', '512GB'] },
  },
  {
    id: 'p2', name: '轻旗舰 5G 手机 16GB+512GB', desc: '轻薄机身 · 120W 快充 · 一亿像素主摄',
    price: 6499, origin: 6999, sales: '1.8万+', tag: '', cat: 'phone',
    specs: { 颜色: ['曜石黑', '月光白'], 容量: ['256GB', '512GB'] },
  },
  {
    id: 'p3', name: '超轻薄笔记本 14.2 英寸 32G+1T', desc: '2.8K 触控屏 · 1.2kg 机身 · 全天续航',
    price: 9999, origin: 10999, sales: '3200+', tag: '新品', cat: 'computer',
    specs: { 颜色: ['深空灰', '月光银'], 配置: ['32G+1T', '16G+512G'] },
  },
  {
    id: 'p4', name: '高性能轻薄本 16 英寸 16G+1T', desc: '标压处理器 · 2.5K 高刷屏 · 全金属机身',
    price: 5499, origin: 5999, sales: '8600+', tag: '', cat: 'computer',
    specs: { 颜色: ['星空灰'], 配置: ['16G+1T', '32G+1T'] },
  },
  {
    id: 'p5', name: '变频冷暖空调 1.5 匹 新一级能效', desc: '静音运行 · 自清洁 · 快速冷暖',
    price: 2799, origin: 3199, sales: '1.2万+', tag: '满减', cat: 'appliance',
    specs: { 匹数: ['1 匹', '1.5 匹'], 颜色: ['白色'] },
  },
  {
    id: 'p6', name: '滚筒洗衣机 10 公斤 直驱变频', desc: '除菌螨洗 · 智能投放 · 低噪运行',
    price: 2599, origin: 2999, sales: '7800+', tag: '', cat: 'appliance',
    specs: { 容量: ['10 公斤', '12 公斤'], 颜色: ['白色'] },
  },
  {
    id: 'p7', name: '壁挂式空调 大 1 匹 静音自清洁', desc: '一级能效 · 无风感 · 智能控制',
    price: 3199, origin: 3599, sales: '5400+', tag: '', cat: 'appliance',
    specs: { 匹数: ['大 1 匹', '1.5 匹'], 颜色: ['白色'] },
  },
  {
    id: 'p8', name: '头戴式无线降噪耳机', desc: '40 小时续航 · 自适应降噪 · 空间音频',
    price: 2299, origin: 2899, sales: '1.5万+', tag: '爆款', cat: 'phone',
    specs: { 颜色: ['曜石黑', '雾灰'], 版本: ['标准版', '尊享版'] },
  },
  {
    id: 'p9', name: '无线手持吸尘器 轻量版', desc: '150AW 吸力 · 60 分钟续航 · 多刷头',
    price: 3490, origin: 3990, sales: '4100+', tag: '', cat: 'appliance',
    specs: { 颜色: ['曜石黑'], 套装: ['标准套装', '全能套装'] },
  },
  {
    id: 'p10', name: '无线静音鼠标 人体工学', desc: '静音微动 · 8000DPI · 三模连接',
    price: 699, origin: 799, sales: '2.1万+', tag: '', cat: 'computer',
    specs: { 颜色: ['石墨黑', '象牙白'] },
  },
  {
    id: 'p11', name: 'IH 电饭煲 4L 家用多功能', desc: 'IH 电磁加热 · 24 小时预约 · 不粘内胆',
    price: 899, origin: 1099, sales: '6300+', tag: '', cat: 'appliance',
    specs: { 容量: ['3L', '4L', '5L'] },
  },
  {
    id: 'p12', name: '破壁料理机 1.75L 家用', desc: '八叶刀头 · 冷热双打 · 一键清洗',
    price: 399, origin: 599, sales: '9800+', tag: '直降', cat: 'appliance',
    specs: { 颜色: ['白色', '粉色'] },
  },
  {
    id: 'p13', name: '缓震跑步鞋 轻质回弹', desc: '全掌缓震 · 透气网面 · 日常通勤',
    price: 359, origin: 499, sales: '3.2万+', tag: '', cat: 'sport',
    specs: { 尺码: ['40', '41', '42', '43'] },
  },
  {
    id: 'p14', name: '轻型羽绒外套 90% 白鸭绒', desc: '轻至 320g · 防泼水面料 · 可收纳',
    price: 599, origin: 799, sales: '1.4万+', tag: '', cat: 'fashion',
    specs: { 颜色: ['黑色', '米白'], 尺码: ['M', 'L', 'XL'] },
  },
  {
    id: 'p15', name: '天然饮用水 550ml×24 瓶', desc: '整箱家庭装 · 弱碱性 · 直接饮用',
    price: 39.9, origin: 48, sales: '12万+', tag: '', cat: 'food',
    specs: { 规格: ['24 瓶整箱', '12 瓶装'] },
  },
  {
    id: 'p16', name: '每日坚果 750g 30 袋', desc: '混合果仁 · 独立小包 · 随身携带',
    price: 129, origin: 158, sales: '8.6万+', tag: '热卖', cat: 'food',
    specs: { 规格: ['750g 30 袋', '1.5kg 60 袋'] },
  },
  {
    id: 'p17', name: '精装畅销小说套装 全 5 册', desc: '经典文学 · 精装典藏 · 附赠书签',
    price: 118, origin: 168, sales: '9600+', tag: '', cat: 'book',
    specs: { 版本: ['平装', '精装'] },
  },
  {
    id: 'p18', name: '氨基酸洁面乳 120g', desc: '温和清洁 · 不紧绷 · 敏感肌可用',
    price: 89, origin: 129, sales: '4.2万+', tag: '', cat: 'beauty',
    specs: { 规格: ['120g', '120g×2'] },
  },
];

/** 商品图统一按 id 映射到本地 SVG，避免逐条重复写路径 */
JD.products.forEach((product) => {
  product.img = `images/products/${product.id}.svg`;
});

JD.getProduct = (id) => JD.products.find((p) => p.id === id);

/**
 * 评分 / 库存 / 规格加价
 * 单独集中配置，商品主体数据保持简洁；specExtra 的键是规格选项文案，
 * 选中该选项时在基础价上加减对应金额。
 */
const productExtras = {
  p1: { rating: 4.9, stock: 12, specExtra: { '512GB': 800 } },
  p2: { rating: 4.8, stock: 26, specExtra: { '512GB': 600 } },
  p3: { rating: 4.9, stock: 8, specExtra: { '16G+512G': -1500 } },
  p4: { rating: 4.7, stock: 31, specExtra: { '32G+1T': 1000 } },
  p5: { rating: 4.8, stock: 18, specExtra: { '1.5 匹': 200 } },
  p6: { rating: 4.7, stock: 9, specExtra: { '12 公斤': 300 } },
  p7: { rating: 4.6, stock: 22, specExtra: { '1.5 匹': 250 } },
  p8: { rating: 4.9, stock: 6, specExtra: { '尊享版': 400 } },
  p9: { rating: 4.8, stock: 15, specExtra: { '全能套装': 600 } },
  p10: { rating: 4.8, stock: 40 },
  p11: { rating: 4.7, stock: 33, specExtra: { '5L': 120 } },
  p12: { rating: 4.6, stock: 50 },
  p13: { rating: 4.7, stock: 45 },
  p14: { rating: 4.8, stock: 20, specExtra: { 'XL': 50 } },
  p15: { rating: 4.9, stock: 60, specExtra: { '12 瓶装': -18 } },
  p16: { rating: 4.8, stock: 28, specExtra: { '1.5kg 60 袋': 110 } },
  p17: { rating: 4.7, stock: 17, specExtra: { '精装': 40 } },
  p18: { rating: 4.8, stock: 36, specExtra: { '120g×2': 60 } },
};

Object.entries(productExtras).forEach(([id, extra]) => {
  const product = JD.getProduct(id);
  if (product) Object.assign(product, extra, { specExtra: extra.specExtra || {} });
});

/** 评价摘要：按品类给几条通用评价，详情页展示 */
JD.reviews = {
  phone: [
    { user: '林**', stars: 5, text: '做工扎实，续航能撑一整天，包装完好。' },
    { user: '陈**', stars: 5, text: '操作顺手，连接稳定，物流也快。' },
    { user: '周**', stars: 4, text: '整体满意，就是包装盒有点大。' },
  ],
  computer: [
    { user: '吴**', stars: 5, text: '很轻，键盘手感不错，办公完全够用。' },
    { user: '郑**', stars: 4, text: '开机很快，风扇偶尔有点声音。' },
    { user: '孙**', stars: 5, text: '屏幕色彩好，接口够用，值得买。' },
  ],
  appliance: [
    { user: '李**', stars: 5, text: '安装师傅上门很快，运行声音小。' },
    { user: '王**', stars: 4, text: '制冷速度快，就是外机有点大。' },
    { user: '赵**', stars: 5, text: '用了一周很稳定，家里人都满意。' },
  ],
  fashion: [
    { user: '钱**', stars: 5, text: '版型好看，做工细致，尺码正常。' },
    { user: '冯**', stars: 4, text: '颜色比图片略深，保暖性不错。' },
    { user: '褚**', stars: 5, text: '很轻便，通勤穿正合适。' },
  ],
  beauty: [
    { user: '卫**', stars: 5, text: '泡沫细腻，洗完不紧绷。' },
    { user: '蒋**', stars: 4, text: '味道清淡，敏感肌用着没问题。' },
    { user: '沈**', stars: 5, text: '一直在用，性价比可以。' },
  ],
  food: [
    { user: '韩**', stars: 5, text: '包装严实，日期很新鲜。' },
    { user: '杨**', stars: 5, text: '分量足，独立包装很方便。' },
    { user: '朱**', stars: 4, text: '口感不错，就是甜度稍高。' },
  ],
  book: [
    { user: '秦**', stars: 5, text: '印刷清晰，纸张厚实，值得收藏。' },
    { user: '尤**', stars: 5, text: '包装完好，没有磕碰。' },
    { user: '许**', stars: 4, text: '内容不错，运输稍慢。' },
  ],
  sport: [
    { user: '何**', stars: 5, text: '脚感软，跑步不累，尺码标准。' },
    { user: '吕**', stars: 4, text: '鞋面透气，雨天不太合适。' },
    { user: '施**', stars: 5, text: '日常穿也好看，会回购。' },
  ],
};
JD.categoryName = (id) => (JD.categories.find((c) => c.id === id) || {}).name || '全部商品';

/** 首页轮播：纯 CSS 渐变绘制，不依赖图片 */
JD.banners = [
  {
    tag: '限时特惠',
    title: '精选好物 低至 5 折',
    sub: '每日 10 点上新 · 数量有限 先到先得',
    cta: '立即选购',
    theme: 'linear-gradient(120deg, #ff9a6c 0%, #e8453c 55%, #b3251f 100%)',
  },
  {
    tag: '新品上市',
    title: '轻薄本 · 旗舰手机',
    sub: '新一代性能升级 · 支持 12 期免息',
    cta: '查看新品',
    theme: 'linear-gradient(120deg, #24304a 0%, #3f5a85 55%, #6b8cba 100%)',
  },
  {
    tag: '家电焕新',
    title: '以旧换新 至高补贴 800 元',
    sub: '空调 / 冰箱 / 洗衣机 全场参与',
    cta: '去看看',
    theme: 'linear-gradient(120deg, #0f766e 0%, #0e9488 50%, #38bdf8 100%)',
  },
];

/** 消息中心 */
JD.messageCats = [
  { id: 'all', name: '全部消息' },
  { id: 'logistics', name: '订单物流' },
  { id: 'promo', name: '优惠活动' },
  { id: 'system', name: '系统公告' },
];

JD.seedMessages = () => [
  { id: 'm1', cat: 'logistics', title: '订单已发货', text: '你的订单已从仓库发出，预计明日送达，请注意查收。', time: '10-24 14:20', read: false },
  { id: 'm2', cat: 'promo', title: '限时特惠开始啦', text: '精选好物 5 折起，数量有限，先到先得。', time: '10-24 10:00', read: false },
  { id: 'm3', cat: 'system', title: '账号安全提醒', text: '你的账号在新设备登录，如非本人操作请及时修改密码。', time: '10-23 21:12', read: false },
  { id: 'm4', cat: 'logistics', title: '包裹已签收', text: '订单已签收，感谢你的购买，期待你的评价。', time: '10-23 16:40', read: true },
  { id: 'm5', cat: 'promo', title: '新人礼包已到账', text: '3 张满减券已放入你的账户，有效期 7 天。', time: '10-22 09:30', read: true },
  { id: 'm6', cat: 'system', title: '服务升级公告', text: '本站将于周日凌晨进行系统维护，期间部分功能可能短暂不可用。', time: '10-21 18:00', read: true },
];

/** 默认收货地址与支付方式（纯演示数据） */
JD.addresses = [
  {
    id: 'a1',
    name: '林小优',
    phone: '138****8888',
    region: '北京市 朝阳区',
    detail: '望京街道 望京西园 1 号楼 802 室',
    isDefault: true,
  },
  {
    id: 'a2',
    name: '林小优',
    phone: '138****8888',
    region: '上海市 浦东新区',
    detail: '张江镇 科苑路 88 号 B 座 1203',
    isDefault: false,
  },
];

JD.defaultAddress = JD.addresses[0];

/** 演示订单（首次打开时写入本地，方便直接看效果） */
JD.seedOrders = () => [
  {
    id: 'o1', no: 'YX20261024153012', time: '2026-10-24 15:30', status: 'unpaid',
    payment: '在线支付',
    items: [{ productId: 'p5', spec: '1.5 匹 / 白色', qty: 1 }],
  },
  {
    id: 'o2', no: 'YX20261023201008', time: '2026-10-23 20:10', status: 'shipped',
    payment: '在线支付',
    paidAt: '2026-10-23 20:15',
    shippedAt: '2026-10-23 22:40',
    items: [{ productId: 'p1', spec: '钛金属灰 / 256GB', qty: 1 }],
  },
  {
    id: 'o3', no: 'YX20261020090531', time: '2026-10-20 09:05', status: 'done',
    payment: '分期付款',
    paidAt: '2026-10-20 09:10',
    shippedAt: '2026-10-20 18:00',
    doneAt: '2026-10-22 14:20',
    review: { stars: 5, text: '坚果很新鲜，独立包装方便携带。', time: '2026-10-22 15:00' },
    items: [
      { productId: 'p16', spec: '750g 30 袋', qty: 2 },
      { productId: 'p15', spec: '24 瓶整箱', qty: 1 },
    ],
  },
  {
    id: 'o4', no: 'YX20261019112044', time: '2026-10-19 11:20', status: 'cancelled',
    payment: '在线支付',
    cancelledAt: '2026-10-19 12:05',
    items: [{ productId: 'p12', spec: '白色', qty: 1 }],
  },
  {
    id: 'o5', no: 'YX20261018164507', time: '2026-10-18 16:45', status: 'paid',
    payment: '货到付款',
    paidAt: '2026-10-18 16:50',
    items: [{ productId: 'p3', spec: '深空灰 / 32G+1T', qty: 1 }],
  },
  {
    id: 'o6', no: 'YX20261015100022', time: '2026-10-15 10:00', status: 'done',
    payment: '在线支付',
    paidAt: '2026-10-15 10:05',
    shippedAt: '2026-10-15 19:30',
    doneAt: '2026-10-17 11:10',
    items: [{ productId: 'p14', spec: '黑色 / L', qty: 1 }],
  },
];
