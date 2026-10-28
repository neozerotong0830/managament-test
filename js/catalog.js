/** Department vocabulary. Labels here are the words staff already use. */

export const COMPANIES = ['建榮', '鑽達', '永峰'];

export const DISCIPLINES = [
  { code: 'BP', name: '鑽孔樁' },
  { code: 'DTH', name: '潛孔錘' },
  { code: 'SI', name: '探土' },
  { code: 'General', name: '一般' },
];

export const MACHINE_TYPES = [
  {
    code: 'CC',
    name: '履帶式吊機',
    short: '吊機',
    mountsEngine: true,
    fields: [
      { key: 'jibLengthM', label: '主臂長度', unit: 'm' },
      { key: 'flyJibM', label: '副臂長度', unit: 'm' },
      { key: 'counterweightT', label: '配重', unit: 't' },
      { key: 'swlT', label: '安全操作負荷', unit: 't' },
    ],
  },
  {
    code: 'RCD',
    name: '反循環系統鑽機',
    short: '鑽機',
    fields: [
      { key: 'maxDiameterMm', label: '最大鑽徑', unit: 'mm' },
      { key: 'maxDepthM', label: '最大深度', unit: 'm' },
    ],
  },
  {
    code: 'OS',
    name: '磨樁機',
    short: '磨樁',
    fields: [
      { key: 'casingDiameterMm', label: '套管直徑', unit: 'mm' },
      { key: 'torqueKnm', label: '扭矩', unit: 'kN·m' },
    ],
  },
  {
    code: 'SD',
    name: '探土機',
    short: '探土',
    fields: [
      { key: 'maxDepthM', label: '最大鑽探深度', unit: 'm' },
      { key: 'mastHeightM', label: '桅杆高度', unit: 'm' },
    ],
  },
  {
    code: 'TD',
    name: '炮機',
    short: '炮機',
    mountsEngine: true,
    fields: [
      { key: 'chiselKg', label: '錘頭重量', unit: 'kg' },
      { key: 'impactJ', label: '衝擊能量', unit: 'J' },
    ],
  },
  {
    code: 'AC',
    name: '風機',
    short: '風機',
    mountsEngine: true,
    fields: [
      { key: 'airflow', label: '出風量', unit: 'm³/min' },
      { key: 'pressureKpa', label: '風壓', unit: 'kPa' },
    ],
  },
];

export const STATUSES = ['在場', '維修中', '調遷', '停用'];

export const REPAIR_TYPES = ['保養', '突發維修', '檢查'];

/** Factories and Industrial Undertakings (Lifting Appliances and Lifting Gear) Regulations, plus EPD labels. */
export const CERT_FORMS = [
  { code: 'F1', group: 'statutory', name: '表格一', full: '起重機械每週檢查結果報告', lead: 2 },
  { code: 'F2', group: 'statutory', name: '表格二', full: '起重機錨定及壓重測試證明書', lead: 14 },
  { code: 'F3', group: 'statutory', name: '表格三', full: '起重機、起重滑車及絞車測試證明書', lead: 30 },
  { code: 'F4', group: 'statutory', name: '表格四', full: '其他起重機械測試證明書', lead: 30 },
  { code: 'F5', group: 'statutory', name: '表格五', full: '起重機械十二個月徹底檢驗證明書', lead: 30 },
  { code: 'F6', group: 'statutory', name: '表格六', full: '鏈條、纜索及起重裝置測試證明書', lead: 30 },
  { code: 'F7', group: 'statutory', name: '表格七', full: '鏈條、纜索及起重裝置六個月檢驗證明書', lead: 30 },
  { code: 'NRMM', group: 'env', name: 'NRMM', full: '非道路移動機械標籤', lead: 60 },
  { code: 'QPME', group: 'env', name: 'QPME', full: '優質機動設備標籤', lead: 60 },
];

export const DOC_KINDS = [
  { code: 'catalog', name: '目錄／產品冊' },
  { code: 'manual', name: '說明書' },
  { code: 'oil', name: '油路圖' },
  { code: 'circuit', name: '電路圖' },
];

export const ROLES = [
  { code: 'manager', zh: '管理', en: 'Lead' },
  { code: 'logistics', zh: '後勤', en: 'Logistics' },
  { code: 'workshop', zh: '工場', en: 'Workshop' },
  { code: 'site', zh: '地盤', en: 'Site' },
  { code: 'tech', zh: '技工', en: 'Technician' },
];

export const SHIFT_START = 8 * 60;
export const SHIFT_END = 18 * 60;
