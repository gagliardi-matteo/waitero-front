import { BusinessType } from './business-type.model';

export interface MenuCategory {
  id: number;
  businessType: BusinessType;
  code: string;
  label: string;
  sortOrder: number;
}
