/***** ちばケアタクシー予約：Code.gs
  改善版・分割1/2
  役割:
  - 定数
  - Web API / JSONP
  - 公開API
  - 管理API
  - 予約/ブロック系API
  - GitHub画像保存対応
*****/

// ===== Sheets =====
const SHEETS = {
  CONFIG: '設定',
  RESERVATIONS: '予約内容',
  BLOCK: 'ブロック',
  ADMINLOG: 'AdminLog',
  PRICE_MASTER: 'マスタ_料金',
};

// JST
const TZ = 'Asia/Tokyo';

// ===== Default Config =====
const DEFAULT_CONFIG = {
  main_title: '介護タクシー予約',
  admin_password: '95123',
  admin_tap_count: '5',
  days_per_page: '7',
  max_forward_days: '30',
  slot_minutes: '30',
  service_block_minutes: '120',
  calendar_start_h: '6',
  calendar_end_h: '21',
  extended_enabled: '1',
  extended_start_h: '21',
  extended_end_h: '5',
  phone_notify_text: '090-6331-4289',
  gas_notify_url: 'https://script.google.com/macros/s/AKfycbxzM8EPlE-1hwHx6qwh4Q1jXgYa0nyc3_WtK0NYbYbcm5JExMJOi1zzjQocUhsoCuUQ/exec?secret=secret1',
  gas_notify_secret: 'secret1',
  sheet_reservations: '予約内容',
  sheet_blocks: 'ブロック',
  lock_minutes: '5',
  timezone: 'Asia/Tokyo',

  // ===== ロゴ =====
  logo_text: '介護タクシー予約',
  logo_subtext: '丁寧・安全な送迎をご提供します',
  logo_image_url: '',
  logo_drive_file_id: '',
  logo_use_drive_image: '0',
  logo_drive_folder_id: '',
  logo_use_github_image: '1',
  logo_github_path: 'logo/logo.webp',

  // ===== GitHub接続設定 =====
  github_username: '',
  github_repo: '',
  github_branch: 'main',
  github_token: '',
  github_assets_base_path: '',

  same_day_enabled: '0',
  same_day_min_hours: '3',

  // ===== 管理画面表示・拡張 =====
  admin_panels_collapsed_default: '1',

  // ===== 自動ルール設定 =====
  rule_force_body_assist_on_stair: '1',
  rule_force_body_assist_on_stretcher: '1',
  rule_force_stretcher_staff2_on_stretcher: '1',
  rule_force_staff_add_on_stair: '1',
  rule_force_staff_add_on_stretcher: '1',

  // ===== 追加自動ルール（管理画面で今後拡張用）=====
  auto_rule_enabled_1: '1',
  auto_rule_target_1: 'stair',
  auto_rule_trigger_key_1: 'STAIR_2F',
  auto_rule_apply_group_1: 'assistance',
  auto_rule_apply_key_1: 'BODY_ASSIST',

  auto_rule_enabled_2: '1',
  auto_rule_target_2: 'stair',
  auto_rule_trigger_key_2: 'STAIR_3F',
  auto_rule_apply_group_2: 'assistance',
  auto_rule_apply_key_2: 'BODY_ASSIST',

  auto_rule_enabled_3: '1',
  auto_rule_target_3: 'stair',
  auto_rule_trigger_key_3: 'STAIR_4F',
  auto_rule_apply_group_3: 'assistance',
  auto_rule_apply_key_3: 'BODY_ASSIST',

  auto_rule_enabled_4: '1',
  auto_rule_target_4: 'stair',
  auto_rule_trigger_key_4: 'STAIR_5F',
  auto_rule_apply_group_4: 'assistance',
  auto_rule_apply_key_4: 'BODY_ASSIST',

  auto_rule_enabled_5: '1',
  auto_rule_target_5: 'equipment',
  auto_rule_trigger_key_5: 'EQUIP_STRETCHER',
  auto_rule_apply_group_5: 'assistance',
  auto_rule_apply_key_5: 'BODY_ASSIST',

  auto_rule_enabled_6: '1',
  auto_rule_target_6: 'equipment',
  auto_rule_trigger_key_6: 'EQUIP_STRETCHER',
  auto_rule_apply_group_6: 'equipment',
  auto_rule_apply_key_6: 'EQUIP_STRETCHER_STAFF2',

  // ===== 警告文 =====
  warning_stair_bodyassist_text: '警告: 階段介助ご利用の場合、身体介助がセットになります',
  warning_wheelchair_damage_text: '警告: 車いす固定による傷、すり傷などは保証対象外になります',
  warning_stretcher_bodyassist_text: 'ストレッチャー利用時は身体介助が必要です',
  warning_staff_add_text: '表示価格は1名体制での目安です。状況により安全確保のため2名体制となる場合があります（＋5,000円）',
  warning_staff_add_confirm_text: '安全確保のため2名体制での対応となる場合があります',

  // ===== 予約フォーム文言 =====
  form_modal_title: 'ご予約',
  form_privacy_text: 'ご入力いただいた個人情報は、ご予約の受付およびサービス提供に用いたします。同意の上チェックをお願いいたします。',
  form_basic_section_title: '基本情報',
  form_basic_section_badge: '必須項目',
  form_usage_type_label: 'ご利用区分',
  form_usage_type_placeholder: '選択してください',
  form_usage_type_option_first: '初めて',
  form_usage_type_option_repeat: '2回目以上',
  form_customer_name_label: 'お名前(カタカナ)',
  form_customer_name_placeholder: 'ヤマダ タロウ',
  form_phone_label: '連絡先(電話番号)',
  form_phone_placeholder: '090-1234-5678',
  form_pickup_label: 'お伺い場所または施設名',
  form_pickup_placeholder: '東京都渋谷区...',
  form_optional_section_title: '追加情報',
  form_optional_section_badge: '任意項目',
  form_destination_label: '送迎先住所または施設名',
  form_destination_placeholder: '病院、クリニック など',
  form_notes_label: 'ご要望・備考',
  form_notes_placeholder: 'その他ご要望があればご記入ください',
  form_service_section_title: 'サービス選択',
  form_service_section_badge: '必須項目',
  form_assistance_label: '介助内容',
  form_stair_label: '階段介助',
  form_equipment_label: '機材レンタル',
  form_round_trip_label: '往復送迎',
  form_move_type_label: '移動方法',
  form_move_type_placeholder: '選択してください',
  form_move_type_help_text: '最初に移動方法をお選びください',
  form_move_type_note_wheelchair: '無料車いすで移動します。次に介助内容を選択してください。',
  form_move_type_note_reclining: 'リクライニング車いすで移動します。身体介助が必要になる場合があります。',
  form_move_type_note_stretcher: 'ストレッチャーで移動します。身体介助が必要です。状況により安全確保のため2名体制となる場合があります。',
  form_move_type_note_own: 'ご自身の車いすで移動します。固定可否を確認します。',
  form_price_section_title: '料金概算',
  form_price_total_label: '概算合計',
  form_price_notice_text: '上記料金に加え、距離運賃(2km以上200mごと/90円)が加算されます。また、時速10km以下の移行時は時間制運賃(1分30秒毎/90円)に切り替わります。',
  form_submit_button_text: '予約する',

  // ===== 完了画面文言 =====
  complete_title: 'ご予約ありがとう',
  complete_title_sub: 'ございます',
  complete_reservation_id_label: '予約ID',
  complete_phone_guide_prefix: '内容確認のため、以下の番号',
  complete_phone_guide_middle: 'よりお電話をさせていただきます。',
  complete_phone_guide_after: '確認が取れたら、正式な予約完了と致します。',
  complete_phone_guide_warning: 'お電話がつながらない場合、申し訳ございませんが自動キャンセルとさせていただく場合がございます。',
  complete_phone_guide_footer: 'あらかじめご了承ください。',
  complete_close_button_text: '閉じる',

  // ===== カレンダー周辺文言 =====
  calendar_toggle_extended_text: '他時間予約',
  calendar_toggle_regular_text: '通常時間',
  calendar_legend_available: '◎ 予約可能',
  calendar_legend_unavailable: 'X 予約不可',
  calendar_scroll_guide_text: '上下・左右にスクロールして、他の日付や時間を確認できます。'
};

// ===== Default Price Master =====
const DEFAULT_PRICE_MASTER = [
  { key: 'BASE_FARE',               key_jp: '基本運賃',                 label: '運賃(初乗り)',                   price: 730,   note: '「から」表記',                     is_visible: true, sort_order: 10,  menu_group: 'price',      required_flag: false, auto_apply_group: '',           auto_apply_key: '' },
  { key: 'DISPATCH',                key_jp: '配車予約',                 label: '配車予約',                       price: 800,   note: '',                                 is_visible: true, sort_order: 20,  menu_group: 'price',      required_flag: false, auto_apply_group: '',           auto_apply_key: '' },
  { key: 'SPECIAL_VEHICLE',         key_jp: '特殊車両使用料',           label: '特殊車両使用料',                 price: 1000,  note: '',                                 is_visible: true, sort_order: 30,  menu_group: 'price',      required_flag: false, auto_apply_group: '',           auto_apply_key: '' },

  { key: 'BOARDING_ASSIST',         key_jp: '乗降介助',                 label: '乗降介助',                       price: 1400,  note: '玄関から車両への車いす等固定まで',    is_visible: true, sort_order: 100, menu_group: 'assistance', required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'BODY_ASSIST',             key_jp: '身体介助',                 label: '身体介助',                       price: 3000,  note: 'お部屋から車両への車いす等固定まで',  is_visible: true, sort_order: 110, menu_group: 'assistance', required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },

  { key: 'STAIR_NONE',              key_jp: '階段介助不要',             label: '不要',                           price: 0,     note: '',                                 is_visible: true, sort_order: 200, menu_group: 'stair',      required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'STAIR_WATCH',             key_jp: '階段見守り介助',           label: '見守り介助',                     price: 0,     note: '自力歩行可能で手を握る介助',          is_visible: true, sort_order: 210, menu_group: 'stair',      required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'STAIR_2F',                key_jp: '階段2階移動',              label: '2階移動',                        price: 6000,  note: '',                                 is_visible: true, sort_order: 220, menu_group: 'stair',      required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_3F',                key_jp: '階段3階移動',              label: '3階移動',                        price: 9000,  note: '',                                 is_visible: true, sort_order: 230, menu_group: 'stair',      required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_4F',                key_jp: '階段4階移動',              label: '4階移動',                        price: 12000, note: '',                                 is_visible: true, sort_order: 240, menu_group: 'stair',      required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_5F',                key_jp: '階段5階移動',              label: '5階移動',                        price: 15000, note: '',                                 is_visible: true, sort_order: 250, menu_group: 'stair',      required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },

  { key: 'EQUIP_WHEELCHAIR',        key_jp: '車いすレンタル',           label: '車いすレンタル',                 price: 0,     note: '',                                 is_visible: true, sort_order: 300, menu_group: 'equipment',  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_RECLINING',         key_jp: 'リクライニング車いす',     label: 'リクライニング車いすレンタル',   price: 2500,  note: '',                                 is_visible: true, sort_order: 310, menu_group: 'equipment',  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_STRETCHER',         key_jp: 'ストレッチャー',           label: 'ストレッチャーレンタル',         price: 5000,  note: '',                                 is_visible: true, sort_order: 320, menu_group: 'equipment',  required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'EQUIP_OWN_WHEELCHAIR',    key_jp: '持込車いす',               label: 'ご自身車いす',                   price: 0,     note: '',                                 is_visible: true, sort_order: 330, menu_group: 'equipment',  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_STRETCHER_STAFF2',  key_jp: 'ストレッチャー2名体制',    label: 'ストレッチャー2名体制介助料',    price: 5000,  note: '',                                 is_visible: true, sort_order: 340, menu_group: 'equipment',  required_flag: false, auto_apply_group: '',           auto_apply_key: '' },

  { key: 'ROUND_NONE',              key_jp: '往復不要',                 label: '不要',                           price: 0,     note: '',                                 is_visible: true, sort_order: 400, menu_group: 'round_trip', required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'ROUND_STANDBY',           key_jp: '待機',                     label: '待機',                           price: 800,   note: '「から/30分毎」',                  is_visible: true, sort_order: 410, menu_group: 'round_trip', required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'ROUND_HOSPITAL',          key_jp: '病院付き添い',             label: '病院付き添い',                   price: 1600,  note: '「から/30分毎」',                  is_visible: true, sort_order: 420, menu_group: 'round_trip', required_flag: true,  auto_apply_group: '',           auto_apply_key: '' }
];

// ===== 管理画面で選べるプルダウングループ =====
const MENU_GROUP_CATALOG = [
  { key: 'price',      label: '料金概算（基本料金）',    description: '料金概算の基本項目に使う' },
  { key: 'assistance', label: '介助内容',                description: '予約フォームの「介助内容」プルダウンに表示' },
  { key: 'stair',      label: '階段介助',                description: '予約フォームの「階段介助」プルダウンに表示' },
  { key: 'equipment',  label: '機材レンタル',            description: '予約フォームの「機材レンタル」プルダウンに表示' },
  { key: 'round_trip', label: '往復送迎',                description: '予約フォームの「往復送迎」プルダウンに表示' },
  { key: 'move_type',  label: '移動方法',                description: '予約フォームの「移動方法」プルダウンに表示' },
  { key: 'custom',     label: 'その他（表示先なし）',    description: '保存のみ。どのプルダウンにも出さない' },
  { key: 'auto_set',   label: '自動セット',              description: '予約フォームには出さず、内部加算だけに使う' }
];

// ===== 日本語キー候補（管理画面プルダウン用） =====
const MENU_KEY_CATALOG = [
  { key: 'BASE_FARE',               key_jp: '基本運賃',                 menu_group: 'price',      default_label: '運賃(初乗り)',                 default_price: 730,   required_flag: false, auto_apply_group: '',           auto_apply_key: '' },
  { key: 'DISPATCH',                key_jp: '配車予約',                 menu_group: 'price',      default_label: '配車予約',                     default_price: 800,   required_flag: false, auto_apply_group: '',           auto_apply_key: '' },
  { key: 'SPECIAL_VEHICLE',         key_jp: '特殊車両使用料',           menu_group: 'price',      default_label: '特殊車両使用料',               default_price: 1000,  required_flag: false, auto_apply_group: '',           auto_apply_key: '' },

  { key: 'BOARDING_ASSIST',         key_jp: '乗降介助',                 menu_group: 'assistance', default_label: '乗降介助',                     default_price: 1400,  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'BODY_ASSIST',             key_jp: '身体介助',                 menu_group: 'assistance', default_label: '身体介助',                     default_price: 3000,  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },

  { key: 'STAIR_NONE',              key_jp: '階段介助不要',             menu_group: 'stair',      default_label: '不要',                         default_price: 0,     required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'STAIR_WATCH',             key_jp: '階段見守り介助',           menu_group: 'stair',      default_label: '見守り介助',                   default_price: 0,     required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'STAIR_2F',                key_jp: '階段2階移動',              menu_group: 'stair',      default_label: '2階移動',                      default_price: 6000,  required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_3F',                key_jp: '階段3階移動',              menu_group: 'stair',      default_label: '3階移動',                      default_price: 9000,  required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_4F',                key_jp: '階段4階移動',              menu_group: 'stair',      default_label: '4階移動',                      default_price: 12000, required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_5F',                key_jp: '階段5階移動',              menu_group: 'stair',      default_label: '5階移動',                      default_price: 15000, required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },

  { key: 'EQUIP_WHEELCHAIR',        key_jp: '車いすレンタル',           menu_group: 'equipment',  default_label: '車いすレンタル',               default_price: 0,     required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_RECLINING',         key_jp: 'リクライニング車いす',     menu_group: 'equipment',  default_label: 'リクライニング車いすレンタル', default_price: 2500,  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_STRETCHER',         key_jp: 'ストレッチャー',           menu_group: 'equipment',  default_label: 'ストレッチャーレンタル',       default_price: 5000,  required_flag: true,  auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'EQUIP_OWN_WHEELCHAIR',    key_jp: '持込車いす',               menu_group: 'equipment',  default_label: 'ご自身車いす',                 default_price: 0,     required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'EQUIP_STRETCHER_STAFF2',  key_jp: 'ストレッチャー2名体制',    menu_group: 'equipment',  default_label: 'ストレッチャー2名体制介助料',  default_price: 5000,  required_flag: false, auto_apply_group: '',           auto_apply_key: '' },

  { key: 'ROUND_NONE',              key_jp: '往復不要',                 menu_group: 'round_trip', default_label: '不要',                         default_price: 0,     required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'ROUND_STANDBY',           key_jp: '待機',                     menu_group: 'round_trip', default_label: '待機',                         default_price: 800,   required_flag: true,  auto_apply_group: '',           auto_apply_key: '' },
  { key: 'ROUND_HOSPITAL',          key_jp: '病院付き添い',             menu_group: 'round_trip', default_label: '病院付き添い',                 default_price: 1600,  required_flag: true,  auto_apply_group: '',           auto_apply_key: '' }
];

// ===== Web API / JSONP =====
function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    const callback = String((e && e.parameter && e.parameter.callback) || '').trim();

    let result;

    if (!action) {
      result = _ok({
        message: 'APIは有効です',
        usage: [
          '?action=getConfig',
          '?action=getConfigPublic',
          '?action=getPublicBootstrap',
          '?action=getPublicBootstrapLite',
          '?action=getPublicInitLite&start=YYYY-MM-DD&end=YYYY-MM-DD',
          '?action=getAdminBootstrap',
          '?action=getBlockedSlotKeys&start=YYYY-MM-DD&end=YYYY-MM-DD',
          '?action=getReservationsRange&start=YYYY-MM-DD&end=YYYY-MM-DD',
          '?action=getBlocksRange&start=YYYY-MM-DD&end=YYYY-MM-DD',
          '?action=getInitData',
          '?action=getMenuMaster',
          '?action=getMenuKeyCatalog',
          '?action=getMenuGroupCatalog',
          '?action=getAutoRuleCatalog',
          '?action=getDriveImageDataUrl&fileId=FILE_ID',
          '?action=ping'
        ]
      });
      return _respond_(result, callback);
    }

    if (action === 'ping') {
      result = _ok({ pong: true, time: new Date().toISOString() });
      return _respond_(result, callback);
    }

    if (action === 'getConfig') {
      result = api_getConfig();
      return _respond_(result, callback);
    }

    if (action === 'getConfigPublic') {
      result = api_getConfigPublic();
      return _respond_(result, callback);
    }

    if (action === 'getPublicBootstrap') {
      result = api_getPublicBootstrap();
      return _respond_(result, callback);
    }

    if (action === 'getPublicBootstrapLite') {
      result = api_getPublicBootstrapLite();
      return _respond_(result, callback);
    }

    if (action === 'getPublicInitLite') {
      const start = String((e && e.parameter && e.parameter.start) || '').trim();
      const end = String((e && e.parameter && e.parameter.end) || '').trim();
      result = api_getPublicInitLite(start, end);
      return _respond_(result, callback);
    }

    if (action === 'getAdminBootstrap') {
      result = api_getAdminBootstrap();
      return _respond_(result, callback);
    }

    if (action === 'getBlockedSlotKeys') {
      const start = String((e && e.parameter && e.parameter.start) || '').trim();
      const end = String((e && e.parameter && e.parameter.end) || '').trim();
      result = api_getBlockedSlotKeys(start, end);
      return _respond_(result, callback);
    }

    if (action === 'getReservationsRange') {
      const start = String((e && e.parameter && e.parameter.start) || '').trim();
      const end = String((e && e.parameter && e.parameter.end) || '').trim();
      result = api_getReservationsRange(start, end);
      return _respond_(result, callback);
    }

    if (action === 'getBlocksRange') {
      const start = String((e && e.parameter && e.parameter.start) || '').trim();
      const end = String((e && e.parameter && e.parameter.end) || '').trim();
      result = api_getBlocksRange(start, end);
      return _respond_(result, callback);
    }

    if (action === 'getInitData') {
      result = api_getInitData();
      return _respond_(result, callback);
    }

    if (action === 'getMenuMaster') {
      result = api_getMenuMaster();
      return _respond_(result, callback);
    }

    if (action === 'getMenuKeyCatalog') {
      result = api_getMenuKeyCatalog();
      return _respond_(result, callback);
    }

    if (action === 'getMenuGroupCatalog') {
      result = api_getMenuGroupCatalog();
      return _respond_(result, callback);
    }

    if (action === 'getAutoRuleCatalog') {
      result = api_getAutoRuleCatalog();
      return _respond_(result, callback);
    }

    if (action === 'getDriveImageDataUrl') {
      const fileId = String((e && e.parameter && e.parameter.fileId) || '').trim();
      result = api_getDriveImageDataUrl(fileId);
      return _respond_(result, callback);
    }

    result = _ng(new Error('不明なアクション(GET): ' + action));
    return _respond_(result, callback);

  } catch (err) {
    return _respond_(_ng(err), '');
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
    const body = _parseRequestBody_(raw);

    const action = String(body.action || '').trim();
    const callback = String(body.callback || '').trim();
    const payload = body.payload || {};

    let result;

    if (action === 'createReservation') {
      result = api_createReservation(payload);
      return _respond_(result, callback);
    }

    if (action === 'updateReservation') {
      result = api_updateReservation(payload);
      return _respond_(result, callback);
    }

    if (action === 'releaseBlocksByReservation') {
      result = api_releaseBlocksByReservation(payload.reservationId || payload.reservation_id);
      return _respond_(result, callback);
    }

    if (action === 'toggleBlock') {
      result = api_toggleBlock(payload.dateStr, payload.hour, payload.minute);
      return _respond_(result, callback);
    }

    if (action === 'setRegularDayBlocked') {
      result = api_setRegularDayBlocked(payload.dateStr, payload.isBlocked);
      return _respond_(result, callback);
    }

    if (action === 'setOtherTimeDayBlocked') {
      result = api_setOtherTimeDayBlocked(payload.dateStr, payload.isBlocked);
      return _respond_(result, callback);
    }

    if (action === 'setEntireDayBlocked') {
      result = api_setEntireDayBlocked(payload.dateStr, payload.isBlocked);
      return _respond_(result, callback);
    }

    if (action === 'toggleEntireDay') {
      result = api_toggleEntireDay(payload.dateStr);
      return _respond_(result, callback);
    }

    if (action === 'blockEntireDay') {
      result = api_blockEntireDay(payload.dateStr);
      return _respond_(result, callback);
    }

    if (action === 'saveConfig') {
      result = api_saveConfig(payload);
      return _respond_(result, callback);
    }

    if (action === 'saveMenuMaster') {
      result = api_saveMenuMaster(payload);
      return _respond_(result, callback);
    }

    if (action === 'upsertMenuItem') {
      result = api_upsertMenuItem(payload);
      return _respond_(result, callback);
    }

    if (action === 'toggleMenuItemVisible') {
      result = api_toggleMenuItemVisible(payload.key, payload.is_visible);
      return _respond_(result, callback);
    }

    if (action === 'uploadLogoImage') {
      result = api_uploadLogoImage(payload);
      return _respond_(result, callback);
    }

    if (action === 'changeAdminPassword') {
      result = api_changeAdminPassword(payload);
      return _respond_(result, callback);
    }

    if (action === 'verifyAdminPassword') {
      result = api_verifyAdminPassword(payload);
      return _respond_(result, callback);
    }

    result = _ng(new Error('不明なアクション(POST): ' + action));
    return _respond_(result, callback);

  } catch (err) {
    return _respond_(_ng(err), '');
  }
}

function _respond_(obj, callback) {
  if (callback) {
    const safeCallback = String(callback).replace(/[^\w$.]/g, '');
    const js = safeCallback + '(' + JSON.stringify(obj) + ');';
    return ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _parseRequestBody_(raw) {
  const s = String(raw || '').trim();
  if (!s) return {};

  try {
    return JSON.parse(s);
  } catch (_) {}

  try {
    const out = {};
    s.split('&').forEach(function(pair) {
      const p = pair.split('=');
      const k = decodeURIComponent((p[0] || '').replace(/\+/g, ' '));
      const v = decodeURIComponent((p.slice(1).join('=') || '').replace(/\+/g, ' '));
      out[k] = v;
    });

    if (out.payload) {
      try {
        out.payload = JSON.parse(out.payload);
      } catch (_) {}
    }
    return out;
  } catch (_) {}

  return {};
}

// ===== API =====
function api_getConfig() {
  try {
    _ensureConfigDefaults_();

    const cacheKey = 'config_full_v' + _getPublicApiCacheVersion_('public_bootstrap');
    const cached = _cacheGetJson_(cacheKey);
    if (cached) return _ok(cached);

    const out = _readConfigSheetFast_();
    _cachePutJson_(cacheKey, out, 300);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getConfigPublic() {
  try {
    const result = api_getConfig();
    if (!result.isOk) return result;

    const out = _clone_(result.data || {});
    delete out.admin_password;
    delete out.github_token;

    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getPublicBootstrap() {
  try {
    _ensureConfigDefaults_();
    _ensurePriceMasterDefaults_();

    const cacheKey = 'public_bootstrap_v' + _getPublicApiCacheVersion_('public_bootstrap');
    const cached = _cacheGetJson_(cacheKey);
    if (cached) {
      return _ok(cached);
    }

    const configResult = api_getConfigPublic();
    if (!configResult.isOk) throw new Error(configResult.error || '公開設定取得失敗');

    const menuResult = api_getMenuMaster();
    if (!menuResult.isOk) throw new Error(menuResult.error || '料金マスタ取得失敗');

    const out = {
      config: configResult.data || {},
      menu_master: menuResult.data || [],
      menu_key_catalog: MENU_KEY_CATALOG,
      menu_group_catalog: _getResolvedMenuGroupCatalog_(),
      auto_rule_catalog: _buildAutoRuleCatalog_()
    };

    _cachePutJson_(cacheKey, out, 300);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}


function api_getPublicBootstrapLite() {
  try {
    _ensureConfigDefaults_();

    const cacheKey = 'public_bootstrap_lite_v' + _getPublicApiCacheVersion_('public_bootstrap');
    const cached = _cacheGetJson_(cacheKey);
    if (cached) {
      return _ok(cached);
    }

    const configResult = api_getConfigPublic();
    if (!configResult.isOk) throw new Error(configResult.error || '公開設定取得失敗');

    const out = {
      config: configResult.data || {}
    };

    _cachePutJson_(cacheKey, out, 300);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getPublicInitLite(startDate, endDate) {
  try {
    _ensureConfigDefaults_();

    const rangeStart = String(startDate || '').trim();
    const rangeEnd = String(endDate || '').trim();
    const cacheKey = 'public_init_lite_v'
      + _getPublicApiCacheVersion_('public_bootstrap')
      + '_b' + _getPublicApiCacheVersion_('blocked_slot_keys')
      + '__' + rangeStart + '__' + rangeEnd;

    const cached = _cacheGetJson_(cacheKey);
    if (cached) {
      return _ok(cached);
    }

    const configResult = api_getConfigPublic();
    if (!configResult.isOk) throw new Error(configResult.error || '公開設定取得失敗');

    const blocked = _getBlockedSlotKeysInRange_(rangeStart, rangeEnd);
    const out = {
      config: configResult.data || {},
      start: blocked.start,
      end: blocked.end,
      slot_keys: Array.isArray(blocked.slot_keys) ? blocked.slot_keys : [],
      keys: Array.isArray(blocked.slot_keys) ? blocked.slot_keys : []
    };

    _cachePutJson_(cacheKey, out, 300);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getBlockedSlotKeys(startDate, endDate) {
  try {
    const out = _getBlockedSlotKeysInRange_(startDate, endDate);
    return _ok({
      start: out.start,
      end: out.end,
      slot_keys: out.slot_keys,
      keys: out.slot_keys
    });
  } catch (e) {
    return _ng(e);
  }
}

function api_getInitData() {
  try {
    _ensureConfigDefaults_();
    _ensurePriceMasterDefaults_();

    const configResult = api_getConfig();
    if (!configResult.isOk) throw new Error(configResult.error || '設定取得失敗');

    const menuResult = api_getMenuMaster();
    if (!menuResult.isOk) throw new Error(menuResult.error || '料金マスタ取得失敗');

    const resSheet = _sh(SHEETS.RESERVATIONS);
    const blockSheet = _sh(SHEETS.BLOCK);

    const reservations = resSheet ? _sheetToObjects(resSheet) : [];
    const blocks = blockSheet ? _sheetToObjects(blockSheet) : [];

    return _ok({
      config: configResult.data || {},
      menu_master: menuResult.data || [],
      menu_key_catalog: MENU_KEY_CATALOG,
      menu_group_catalog: _getResolvedMenuGroupCatalog_(),
      auto_rule_catalog: _buildAutoRuleCatalog_(),
      reservations: reservations,
      blocks: blocks
    });
  } catch (e) {
    return _ng(e);
  }
}

function api_getAdminBootstrap() {
  try {
    _ensureConfigDefaults_();
    _ensurePriceMasterDefaults_();

    const cacheKey = 'admin_bootstrap_v' + _getPublicApiCacheVersion_('public_bootstrap');
    const cached = _cacheGetJson_(cacheKey);
    if (cached) return _ok(cached);

    const configResult = api_getConfig();
    if (!configResult.isOk) throw new Error(configResult.error || '設定取得失敗');

    const menuResult = api_getMenuMaster();
    if (!menuResult.isOk) throw new Error(menuResult.error || '料金マスタ取得失敗');

    const out = {
      config: configResult.data || {},
      menu_master: menuResult.data || [],
      menu_key_catalog: MENU_KEY_CATALOG,
      menu_group_catalog: _getResolvedMenuGroupCatalog_(),
      auto_rule_catalog: _buildAutoRuleCatalog_()
    };

    _cachePutJson_(cacheKey, out, 180);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getReservationsRange(startDate, endDate) {
  try {
    _ensureConfigDefaults_();

    const out = _getReservationsInRange_(startDate, endDate);
    return _ok({
      start: out.start,
      end: out.end,
      reservations: out.reservations
    });
  } catch (e) {
    return _ng(e);
  }
}

function api_getBlocksRange(startDate, endDate) {
  try {
    _ensureConfigDefaults_();

    const out = _getBlocksInRange_(startDate, endDate);
    return _ok({
      start: out.start,
      end: out.end,
      blocks: out.blocks
    });
  } catch (e) {
    return _ng(e);
  }
}

function api_getMenuMaster() {
  try {
    _ensurePriceMasterDefaults_();

    const cacheKey = 'menu_master_v' + _getPublicApiCacheVersion_('public_bootstrap');
    const cached = _cacheGetJson_(cacheKey);
    if (cached) return _ok(cached);

    const out = _readMenuMasterFast_();
    _cachePutJson_(cacheKey, out, 300);
    return _ok(out);
  } catch (e) {
    return _ng(e);
  }
}

function api_getMenuKeyCatalog() {
  try {
    return _ok(MENU_KEY_CATALOG);
  } catch (e) {
    return _ng(e);
  }
}

function api_getMenuGroupCatalog() {
  try {
    return _ok(_getResolvedMenuGroupCatalog_());
  } catch (e) {
    return _ng(e);
  }
}

function api_getAutoRuleCatalog() {
  try {
    return _ok(_buildAutoRuleCatalog_());
  } catch (e) {
    return _ng(e);
  }
}

/**
 * 互換維持用
 */
function api_getDriveImageDataUrl(fileId) {
  try {
    fileId = String(fileId || '').trim();
    if (!fileId) throw new Error('fileId が空です');

    const cache = CacheService.getScriptCache();
    const ck = 'icon_dataurl_' + fileId;
    const cached = cache.get(ck);
    if (cached) return _ok({ dataUrl: cached });

    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const mime = blob.getContentType() || 'image/png';
    const b64 = Utilities.base64Encode(blob.getBytes());
    const dataUrl = 'data:' + mime + ';base64,' + b64;

    cache.put(ck, dataUrl, 21600);
    return _ok({ dataUrl: dataUrl });
  } catch (e) {
    return _ng(e);
  }
}

/**
 * ロゴ画像アップロード
 * DriveではなくGitHub保存を優先
 * payload = {
 *   file_name: 'logo.webp',
 *   mime_type: 'image/webp',
 *   base64_data: 'data:image/png;base64,....'
 * }
 */
function api_uploadLogoImage(payload) {
  try {
    _ensureConfigDefaults_();

    payload = payload || {};

    const cfg = _getConfigMap_();

    const fileName = String(payload.file_name || payload.filename || '').trim() || ('logo_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.webp');
    let mimeType = String(payload.mime_type || payload.mimetype || 'image/webp').trim() || 'image/webp';
    let base64Data = String(payload.base64_data || payload.base64 || '').trim();

    if (!base64Data) throw new Error('base64_data が空です');

    const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = String(dataUrlMatch[1] || mimeType || 'image/png').trim();
      base64Data = String(dataUrlMatch[2] || '').trim();
    }

    if (!base64Data) throw new Error('base64_data の形式が不正です');

    const githubUsername = String(cfg.github_username || '').trim();
    const githubRepo = String(cfg.github_repo || '').trim();
    const githubBranch = String(cfg.github_branch || 'main').trim() || 'main';
    const githubToken = String(cfg.github_token || '').trim();
    const githubAssetsBasePath = String(cfg.github_assets_base_path || '').trim();
    const logoGithubPath = String(cfg.logo_github_path || '').trim() || ('logo/' + fileName);

    if (!githubUsername) throw new Error('GitHub ユーザー名が未設定です');
    if (!githubRepo) throw new Error('GitHub リポジトリ名が未設定です');
    if (!githubToken) throw new Error('GitHub Personal Access Token が未設定です');

    const finalPath = _joinGithubPath_(githubAssetsBasePath, logoGithubPath);
    const uploadResult = _uploadBase64FileToGitHub_(githubUsername, githubRepo, githubBranch, githubToken, finalPath, base64Data, 'logo upload');

    const rawUrl = _buildGithubRawUrl_(githubUsername, githubRepo, githubBranch, finalPath);

    const nextConfig = _getConfigMap_();
    nextConfig.logo_image_url = rawUrl;
    nextConfig.logo_use_github_image = '1';
    nextConfig.logo_use_drive_image = '0';
    nextConfig.logo_github_path = finalPath;
    _upsertConfigMap_(nextConfig);

    _logAdmin_(
      'UPLOAD_LOGO_IMAGE_GITHUB',
      finalPath,
      '',
      JSON.stringify({
        file_name: fileName,
        mime_type: mimeType,
        github_path: finalPath,
        sha: uploadResult.sha || ''
      }),
      ''
    );

    _invalidatePublicBootstrapCache_();
    return _ok({
      uploaded: true,
      provider: 'github',
      path: finalPath,
      sha: uploadResult.sha || '',
      raw_url: rawUrl,
      html_url: 'https://github.com/' + githubUsername + '/' + githubRepo + '/blob/' + githubBranch + '/' + finalPath
    });
  } catch (e) {
    return _ng(e);
  }
}

function api_changeAdminPassword(payload) {
  try {
    _ensureConfigDefaults_();

    payload = payload || {};

    const currentPassword = String(payload.current_password || '').trim();
    const newPassword = String(payload.new_password || '').trim();
    const confirmPassword = String(payload.confirm_password || '').trim();

    const cfg = _getConfigMap_();
    const nowPassword = String(cfg.admin_password || DEFAULT_CONFIG.admin_password || '').trim();

    if (!currentPassword) throw new Error('現在のパスワードを入力してください');
    if (!newPassword) throw new Error('新しいパスワードを入力してください');
    if (!confirmPassword) throw new Error('確認用パスワードを入力してください');
    if (currentPassword !== nowPassword) throw new Error('現在のパスワードが正しくありません');
    if (newPassword !== confirmPassword) throw new Error('新しいパスワードと確認用パスワードが一致しません');
    if (newPassword.length < 4) throw new Error('新しいパスワードは4文字以上で入力してください');

    const before = _clone_(cfg);
    cfg.admin_password = newPassword;
    _upsertConfigMap_(cfg);

    _logAdmin_(
      'CHANGE_ADMIN_PASSWORD',
      '',
      JSON.stringify({ admin_password: before.admin_password ? '***' : '' }),
      JSON.stringify({ admin_password: '***' }),
      ''
    );

    return _ok({ changed: true });
  } catch (e) {
    return _ng(e);
  }
}

function api_verifyAdminPassword(payload) {
  try {
    _ensureConfigDefaults_();

    payload = payload || {};

    const inputPassword = String(payload.password || '').trim();
    const cfg = _getConfigMap_();
    const nowPassword = String(cfg.admin_password || DEFAULT_CONFIG.admin_password || '').trim();

    if (!inputPassword) throw new Error('パスワードを入力してください');

    const matched = (inputPassword === nowPassword);

    _logAdmin_(
      'VERIFY_ADMIN_PASSWORD',
      '',
      '',
      JSON.stringify({ matched: matched }),
      ''
    );

    if (!matched) {
      return _ng(new Error('パスワードが正しくありません'));
    }

    return _ok({ verified: true });
  } catch (e) {
    return _ng(e);
  }
}

/**
 * 予約作成
 * - round_trip === '不要'               → 2枠（60分）
 * - round_trip === '待機'/'病院付き添い' → 4枠（120分）
 */

function _buildReservationNotifyUrl_(baseUrl, payload, secret) {
  var cleanUrl = String(baseUrl || '').trim();
  var pairs = [];
  var hasSecretInUrl = /(?:\?|&)secret=/.test(cleanUrl);
  var secretValue = String(secret || '').trim();

  if (secretValue && !hasSecretInUrl) {
    pairs.push('secret=' + encodeURIComponent(secretValue));
  }

  Object.keys(payload || {}).forEach(function(key){
    var value = payload[key];
    if (value === undefined || value === null) value = '';
    pairs.push(encodeURIComponent(String(key)) + '=' + encodeURIComponent(String(value)));
  });

  if (!pairs.length) return cleanUrl;
  return cleanUrl + (cleanUrl.indexOf('?') >= 0 ? '&' : '?') + pairs.join('&');
}

function _fireReservationNotify_(reservationObj) {
  try {
    var cfg = _getConfigMap_();
    var notifyUrl = String(cfg.gas_notify_url || DEFAULT_CONFIG.gas_notify_url || '').trim();
    var notifySecret = String(cfg.gas_notify_secret || DEFAULT_CONFIG.gas_notify_secret || '').trim();
    if (!notifyUrl) return;

    var payload = {
      reservation_id: String((reservationObj && reservationObj.reservation_id) || ''),
      reservation_datetime: String((reservationObj && reservationObj.reservation_datetime) || ''),
      slot_date: String((reservationObj && reservationObj.slot_date) || ''),
      slot_hour: String((reservationObj && reservationObj.slot_hour) || ''),
      slot_minute: String((reservationObj && reservationObj.slot_minute) || ''),
      customer_name: String((reservationObj && reservationObj.customer_name) || ''),
      phone_number: String((reservationObj && reservationObj.phone_number) || ''),
      pickup_location: String((reservationObj && reservationObj.pickup_location) || ''),
      destination: String((reservationObj && reservationObj.destination) || ''),
      move_type: String((reservationObj && reservationObj.move_type) || ''),
      assistance_type: String((reservationObj && reservationObj.assistance_type) || ''),
      stair_assistance: String((reservationObj && reservationObj.stair_assistance) || ''),
      equipment_rental: String((reservationObj && reservationObj.equipment_rental) || ''),
      round_trip: String((reservationObj && reservationObj.round_trip) || ''),
      total_price: String((reservationObj && reservationObj.total_price) || ''),
      status: String((reservationObj && reservationObj.status) || '')
    };

    var url = _buildReservationNotifyUrl_(notifyUrl, payload, notifySecret);
    UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true
    });
  } catch (notifyErr) {
    try {
      _logAdmin_('RESERVATION_NOTIFY_ERROR', String((reservationObj && reservationObj.reservation_id) || ''), '', String(notifyErr && notifyErr.message || notifyErr), '');
    } catch (_) {}
  }
}

function api_createReservation(obj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const sheet = _sh(SHEETS.RESERVATIONS);
    if (!sheet) throw new Error('予約内容シートが見つかりません');

    const rid = String((obj && obj.reservation_id) || '').trim();
    if (!rid) throw new Error('reservation_id がありません');

    const dateStr = String(obj.slot_date || '').trim();
    const hour = Number(obj.slot_hour);
    const minute = Number(obj.slot_minute || 0);

    if (!dateStr || Number.isNaN(hour) || Number.isNaN(minute)) {
      throw new Error('予約日時が不正です');
    }

    _validateSameDayBooking_(dateStr, hour, minute);

    const slots = _reservationBlockSlotsFromObj_(obj);
    _validateReservationSlotAvailable_(dateStr, hour, minute, slots, rid);

    _appendByHeader(sheet, obj);
    _upsertReservationBlocksBulk_(dateStr, hour, minute, slots, rid);

    _logAdmin_(
      'CREATE_RESERVATION',
      rid,
      '',
      JSON.stringify({
        slot_date: dateStr,
        slot_hour: hour,
        slot_minute: minute,
        slots: slots
      }),
      ''
    );

    _invalidateBlockedSlotKeysCache_();
    _fireReservationNotify_(obj || {});
    return _ok({ added: true });
  } catch (e) {
    return _ng(e);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function api_updateReservation(obj) {
  try {
    const sheet = _sh(SHEETS.RESERVATIONS);
    if (!sheet) throw new Error('予約内容シートが見つかりません');

    const rid = String((obj && obj.reservation_id) || '').trim();
    if (!rid) throw new Error('reservation_id がありません');

    const hm = _headerMap(sheet);
    const map = hm.map;
    const idCol = map['reservation_id'] ?? map['予約id'] ?? map['予約ID'] ?? map['id'] ?? null;
    if (!idCol) throw new Error('予約内容シートに reservation_id 列がありません');

    const last = sheet.getLastRow();
    if (last < 2) throw new Error('予約データがありません');

    const idValues = sheet.getRange(2, idCol, last - 1, 1).getValues().map(function(r) {
      return String(r[0] || '').trim();
    });
    const idx = idValues.findIndex(function(v) {
      return v === rid;
    });
    if (idx < 0) throw new Error('対象予約が見つかりません');

    const rowNumber = 2 + idx;
    const beforeObj = _rowToObject_(sheet, rowNumber);
    const beforeSlot = _getReservationSlotFromRow_(sheet, rowNumber);

    _updateRowByHeader(sheet, rowNumber, obj);

    const afterObj = _rowToObject_(sheet, rowNumber);

    const status = String((obj && obj.status) || '').trim();
    if (status === 'キャンセル') {
      const a = _releaseReservationBlocks_(rid);

      const afterSlot = _slotFromObj_(obj) || _getReservationSlotFromRow_(sheet, rowNumber);

      const slotsCount = _reservationBlockSlotsFromObj_(obj);
      const b = afterSlot ? _releaseReservationBlocksBySlot_(afterSlot.dateStr, afterSlot.hour, afterSlot.minute, rid, slotsCount) : 0;
      const c = beforeSlot ? _releaseReservationBlocksBySlot_(beforeSlot.dateStr, beforeSlot.hour, beforeSlot.minute, rid, slotsCount) : 0;

      _logAdmin_('UPDATE_RESERVATION', rid, JSON.stringify(beforeObj), JSON.stringify(afterObj), 'cancel');

      _invalidateBlockedSlotKeysCache_();
      return _ok({
        updated: true,
        cancelled_release: {
          byRid: a,
          bySlotAfter: b,
          bySlotBefore: c
        }
      });
    }

    _logAdmin_('UPDATE_RESERVATION', rid, JSON.stringify(beforeObj), JSON.stringify(afterObj), '');

    _invalidateBlockedSlotKeysCache_();
    return _ok({ updated: true });
  } catch (e) {
    return _ng(e);
  }
}

function api_releaseBlocksByReservation(reservationId) {
  try {
    const rid = String(reservationId || '').trim();
    if (!rid) throw new Error('reservation_id が不正です');

    const released = _releaseReservationBlocks_(rid);

    _logAdmin_('RELEASE_BLOCKS_BY_RESERVATION', rid, '', JSON.stringify({ released: released }), '');

    _invalidateBlockedSlotKeysCache_();
    return _ok({ reservation_id: rid, released: released });
  } catch (e) {
    return _ng(e);
  }
}

function api_toggleBlock(dateStr, hour, minute) {
  try {
    dateStr = String(dateStr || '').trim();
    hour = Number(hour);
    minute = Number(minute || 0);
    if (!dateStr || Number.isNaN(hour) || Number.isNaN(minute)) throw new Error('引数が不正です');

    const key = _normalizeYMD(dateStr) + '-' + hour + '-' + minute;

    const sheet = _sh(SHEETS.BLOCK);
    if (!sheet) throw new Error('ブロックシートが見つかりません');

    const hm = _headerMap(sheet);
    const map = hm.map;
    const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? 1;

    const last = sheet.getLastRow();
    if (last >= 2) {
      const keyRange = sheet.getRange(2, keyCol, last - 1, 1);
      const found = keyRange.createTextFinder(key).matchEntireCell(true).findNext();

      if (found) {
        const row = found.getRow();
        const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
        if (!isBlockedCol) throw new Error('ブロックシートに is_blocked 列がありません');

        const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const cur = rowValues[isBlockedCol - 1];
        const next = !_toBool(cur);
        rowValues[isBlockedCol - 1] = next;

        const updatedAtCol = map['updated_at'] ?? null;
        if (updatedAtCol) rowValues[updatedAtCol - 1] = new Date();

        const reasonCol = map['reason'] ?? null;
        if (reasonCol) rowValues[reasonCol - 1] = next ? 'MANUAL_TOGGLE' : 'MANUAL_UNBLOCK';

        sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);

        _logAdmin_('TOGGLE_BLOCK', key, String(cur), String(next), '');
        _invalidateBlockedSlotKeysCache_();

        return _ok({ toggled: true, is_blocked: next });
      }
    }

    _upsertBlock(dateStr, hour, minute, true, '');
    _logAdmin_('TOGGLE_BLOCK', key, 'not_found', 'true', 'append');
    _invalidateBlockedSlotKeysCache_();
    return _ok({ toggled: true, is_blocked: true });
  } catch (e) {
    return _ng(e);
  }
}

function api_blockEntireDay(dateStr) {
  try {
    dateStr = String(dateStr || '').trim();
    if (!dateStr) throw new Error('日付が不正です');

    for (let h = 0; h < 24; h++) {
      _upsertBlock(dateStr, h, 0, true, '');
      _upsertBlock(dateStr, h, 30, true, '');
    }

    _logAdmin_('BLOCK_ENTIRE_DAY', _normalizeYMD(dateStr), '', 'true', '');
    _invalidateBlockedSlotKeysCache_();

    return _ok({ blocked: true });
  } catch (e) {
    return _ng(e);
  }
}

function api_toggleEntireDay(dateStr) {
  try {
    dateStr = String(dateStr || '').trim();
    if (!dateStr) throw new Error('日付が不正です');

    const sheet = _sh(SHEETS.BLOCK);
    if (!sheet) throw new Error('ブロックシートが見つかりません');

    const hm = _headerMap(sheet);
    const map = hm.map;

    const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? 1;
    const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;

    const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
    const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
    const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;

    if (!isBlockedCol) throw new Error('ブロックシートに is_blocked 列がありません');

    const ymd = _normalizeYMD(dateStr);
    if (!ymd) throw new Error('日付形式が不正です');

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      api_setEntireDayBlocked(ymd, true);
      return _ok({ toggled: true, mode: 'block' });
    }

    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const trueSet = new Set();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const isBlocked = _toBool(row[isBlockedCol - 1]);
      if (!isBlocked) continue;

      let d = dateCol ? _normalizeYMD(row[dateCol - 1]) : '';
      let h = hourCol ? Number(row[hourCol - 1]) : NaN;
      let m = minuteCol ? Number(row[minuteCol - 1]) : NaN;

      if (!d || Number.isNaN(h) || Number.isNaN(m)) {
        const k = String(row[keyCol - 1] || '').trim();
        const mm = k.match(/^(\d{4}-\d{2}-\d{2})-(\d{1,2})-(\d{1,2})$/);
        if (mm) {
          d = d || mm[1];
          if (Number.isNaN(h)) h = Number(mm[2]);
          if (Number.isNaN(m)) m = Number(mm[3]);
        }
      }

      if (d !== ymd) continue;
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      if (!(m === 0 || m === 30)) continue;

      trueSet.add(h + '-' + m);
    }

    const isFullBlocked = (trueSet.size === 48);

    if (isFullBlocked) {
      api_setEntireDayBlocked(ymd, false);
      _logAdmin_('TOGGLE_ENTIRE_DAY', ymd, 'true', 'false', '');
      return _ok({ toggled: true, mode: 'unblock' });
    } else {
      api_setEntireDayBlocked(ymd, true);
      _logAdmin_('TOGGLE_ENTIRE_DAY', ymd, 'false', 'true', '');
      return _ok({ toggled: true, mode: 'block' });
    }
  } catch (e) {
    return _ng(e);
  }
}

function api_setEntireDayBlocked(dateStr, isBlocked) {
  try {
    const ymd = _normalizeYMD(dateStr);
    if (!ymd) throw new Error('dateStr が不正です');

    const slots = _slots_entireDay();
    const res = _setDayBlockedBySlots_(ymd, Boolean(isBlocked), slots, 'ENTIRE_DAY', 'UNBLOCK_ENTIRE_DAY');

    _logAdmin_('SET_ENTIRE_DAY_BLOCKED', ymd, '', JSON.stringify({ isBlocked: !!isBlocked }), '');
    _invalidateBlockedSlotKeysCache_();

    return res;
  } catch (e) {
    return _ng(e);
  }
}

function api_setRegularDayBlocked(dateStr, isBlocked) {
  try {
    const ymd = _normalizeYMD(dateStr);
    if (!ymd) throw new Error('dateStr が不正です');

    const slots = _slots_regular();
    const res = _setDayBlockedBySlots_(ymd, Boolean(isBlocked), slots, 'REGULAR_DAY', 'UNBLOCK_REGULAR_DAY');

    _logAdmin_('SET_REGULAR_DAY_BLOCKED', ymd, '', JSON.stringify({ isBlocked: !!isBlocked }), '');
    _invalidateBlockedSlotKeysCache_();

    return res;
  } catch (e) {
    return _ng(e);
  }
}

function api_setOtherTimeDayBlocked(dateStr, isBlocked) {
  try {
    const ymd = _normalizeYMD(dateStr);
    if (!ymd) throw new Error('dateStr が不正です');

    const slots = _slots_otherTime();
    const res = _setDayBlockedBySlots_(ymd, Boolean(isBlocked), slots, 'OTHER_TIME_DAY', 'UNBLOCK_OTHER_TIME_DAY');

    _logAdmin_('SET_OTHER_TIME_DAY_BLOCKED', ymd, '', JSON.stringify({ isBlocked: !!isBlocked }), '');
    _invalidateBlockedSlotKeysCache_();

    return res;
  } catch (e) {
    return _ng(e);
  }
}

function api_saveConfig(payload) {
  try {
    _ensureConfigDefaults_();

    const sheet = _sh(SHEETS.CONFIG);
    if (!sheet) throw new Error('設定シートが見つかりません');

    const current = _getConfigMap_();
    const next = _clone_(current);
    const input = payload || {};

    Object.keys(input).forEach(function(k) {
      next[k] = input[k];
    });

    Object.keys(DEFAULT_CONFIG).forEach(function(k) {
      if (next[k] === undefined || next[k] === null) {
        next[k] = DEFAULT_CONFIG[k];
      }
    });

    if (next.same_day_enabled !== undefined) next.same_day_enabled = _toBool(next.same_day_enabled) ? '1' : '0';
    if (next.logo_use_drive_image !== undefined) next.logo_use_drive_image = _toBool(next.logo_use_drive_image) ? '1' : '0';
    if (next.logo_use_github_image !== undefined) next.logo_use_github_image = _toBool(next.logo_use_github_image) ? '1' : '0';
    if (next.same_day_min_hours !== undefined) next.same_day_min_hours = String(Number(next.same_day_min_hours || 3));
    if (next.admin_tap_count !== undefined) next.admin_tap_count = String(Number(next.admin_tap_count || 5));
    if (next.max_forward_days !== undefined) next.max_forward_days = String(Number(next.max_forward_days || 30));

    if (next.rule_force_body_assist_on_stair !== undefined) next.rule_force_body_assist_on_stair = _toBool(next.rule_force_body_assist_on_stair) ? '1' : '0';
    if (next.rule_force_body_assist_on_stretcher !== undefined) next.rule_force_body_assist_on_stretcher = _toBool(next.rule_force_body_assist_on_stretcher) ? '1' : '0';
    if (next.rule_force_stretcher_staff2_on_stretcher !== undefined) next.rule_force_stretcher_staff2_on_stretcher = _toBool(next.rule_force_stretcher_staff2_on_stretcher) ? '1' : '0';
    if (next.admin_panels_collapsed_default !== undefined) next.admin_panels_collapsed_default = _toBool(next.admin_panels_collapsed_default) ? '1' : '0';

    for (var i = 1; i <= 6; i++) {
      if (next['auto_rule_enabled_' + i] !== undefined) {
        next['auto_rule_enabled_' + i] = _toBool(next['auto_rule_enabled_' + i]) ? '1' : '0';
      }
    }

    _upsertConfigMap_(next);

    _logAdmin_('SAVE_CONFIG', '', JSON.stringify(_maskSecretConfig_(current)), JSON.stringify(_maskSecretConfig_(next)), '');
    _invalidatePublicBootstrapCache_();

    return _ok({ saved: true, config: _maskSecretConfig_(next) });
  } catch (e) {
    return _ng(e);
  }
}

function api_saveMenuMaster(payload) {
  try {
    _ensurePriceMasterDefaults_();

    const list = (payload && payload.items) ? payload.items : payload;
    if (!Array.isArray(list)) throw new Error('items が配列ではありません');

    const sheet = _sh(SHEETS.PRICE_MASTER);
    if (!sheet) throw new Error('マスタ_料金シートが見つかりません');

    const headers = _ensurePriceMasterHeader_(sheet);

    const before = sheet.getLastRow() >= 2
      ? _sheetToObjects(sheet)
      : [];

    const normalizedList = list.map(function(item, idx) {
      return _normalizeMenuItem_(item, idx + 1);
    }).filter(function(item) {
      return !!item.key;
    });

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    const rows = normalizedList.map(function(obj) {
      return headers.map(function(h) {
        return obj[h] !== undefined ? obj[h] : '';
      });
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    const after = _sheetToObjects(sheet);

    _logAdmin_('SAVE_MENU_MASTER', '', JSON.stringify(before), JSON.stringify(after), '');

    _invalidatePublicBootstrapCache_();
    return _ok({ saved: true, count: rows.length });
  } catch (e) {
    return _ng(e);
  }
}

function api_upsertMenuItem(payload) {
  try {
    _ensurePriceMasterDefaults_();

    const item = _normalizeMenuItem_(payload || {}, 9999);
    if (!item.key) throw new Error('key がありません');

    const sheet = _sh(SHEETS.PRICE_MASTER);
    if (!sheet) throw new Error('マスタ_料金シートが見つかりません');

    const headers = _ensurePriceMasterHeader_(sheet);
    const hm = _headerMap(sheet);
    const keyCol = hm.map['key'] ?? 1;

    const last = sheet.getLastRow();
    let rowNo = -1;

    if (last >= 2) {
      const keys = sheet.getRange(2, keyCol, last - 1, 1).getValues().map(function(r) {
        return String(r[0] || '').trim();
      });
      const idx = keys.findIndex(function(v) {
        return v === item.key;
      });
      if (idx >= 0) rowNo = 2 + idx;
    }

    if (rowNo >= 2) {
      const before = _rowToObject_(sheet, rowNo);
      headers.forEach(function(h, i) {
        sheet.getRange(rowNo, i + 1).setValue(item[h] !== undefined ? item[h] : '');
      });
      const after = _rowToObject_(sheet, rowNo);
      _logAdmin_('UPSERT_MENU_ITEM', item.key, JSON.stringify(before), JSON.stringify(after), 'update');
      return _ok({ saved: true, mode: 'update', key: item.key });
    }

    const row = headers.map(function(h) {
      return item[h] !== undefined ? item[h] : '';
    });
    sheet.appendRow(row);

    _logAdmin_('UPSERT_MENU_ITEM', item.key, '', JSON.stringify(item), 'append');

    return _ok({ saved: true, mode: 'append', key: item.key });
  } catch (e) {
    return _ng(e);
  }
}

function api_toggleMenuItemVisible(key, is_visible) {
  try {
    _ensurePriceMasterDefaults_();

    const k = String(key || '').trim();
    if (!k) throw new Error('key が空です');

    const sheet = _sh(SHEETS.PRICE_MASTER);
    if (!sheet) throw new Error('マスタ_料金シートが見つかりません');

    const hm = _headerMap(sheet);
    const keyCol = hm.map['key'] ?? null;
    const visibleCol = hm.map['is_visible'] ?? null;

    if (!keyCol || !visibleCol) throw new Error('マスタ_料金シートに key / is_visible 列がありません');

    const last = sheet.getLastRow();
    if (last < 2) throw new Error('メニューデータがありません');

    const keys = sheet.getRange(2, keyCol, last - 1, 1).getValues().map(function(r) {
      return String(r[0] || '').trim();
    });

    const idx = keys.findIndex(function(v) {
      return v === k;
    });
    if (idx < 0) throw new Error('対象メニューが見つかりません');

    const rowNo = 2 + idx;
    const before = sheet.getRange(rowNo, visibleCol).getValue();
    const after = (is_visible === undefined || is_visible === null || is_visible === '') ? false : _toBool(is_visible);

    sheet.getRange(rowNo, visibleCol).setValue(after);

    _logAdmin_('TOGGLE_MENU_ITEM_VISIBLE', k, String(before), String(after), '');

    return _ok({ saved: true, key: k, is_visible: after });
  } catch (e) {
    return _ng(e);
  }
}
