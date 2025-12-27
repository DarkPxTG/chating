
/**
 * Ultimate Messenger - Verified System
 * 
 * راهنما:
 * برای دادن تیک به هر کاربر، UID او را در بخش مربوطه وارد کنید.
 */

export type BadgeType = 'DEVELOPER' | 'PRESIDENT' | 'VERIFIED' | 'NONE';

export const VERIFIED_REGISTRY: Record<string, BadgeType> = {
  // تیک توسعه‌دهنده (تیک بنفش درخشان)
  'tiN6W65agYaoWn0KyblSV1QrvZl2': 'DEVELOPER', 
  
  // تیک رئیس (تیک طلایی با تاج)
  'YOUR_PRESIDENT_UID_HERE': 'PRESIDENT',
  
  // تیک آبی عادی (تایید شده)
  'SOME_FAMOUS_USER_UID': 'VERIFIED'
};

/**
 * دریافت نوع تیک بر اساس UID
 */
export const getUserBadge = (uid: string): BadgeType => {
  return VERIFIED_REGISTRY[uid] || 'NONE';
};
