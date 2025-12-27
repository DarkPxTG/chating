
/**
 * سیستم مانیتورینگ پشتیبانی و استایل‌های تیک آبی
 */

export const SUPPORT_TEAM_ID = "official_helper_channel";

// لیست UIDهایی که تیک بنفش توسعه‌دهنده می‌گیرند
export const DEV_UIDS = [
  'tiN6W65agYaoWn0KyblSV1QrvZl2',
  'YOUR_ADMIN_UID_HERE'
];

export const getBadgeStyle = (type: string) => {
  switch(type) {
    case 'DEVELOPER': 
      return 'text-purple-500 animate-pulse drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]';
    case 'PRESIDENT': 
      return 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]';
    case 'VERIFIED': 
      return 'text-[#24A1DE]';
    default: 
      return 'hidden';
  }
};

export const getBadgeIcon = (type: string) => {
  switch(type) {
    case 'DEVELOPER': return 'fa-solid fa-certificate';
    case 'PRESIDENT': return 'fa-solid fa-crown';
    case 'VERIFIED': return 'fa-solid fa-circle-check';
    default: return '';
  }
};
