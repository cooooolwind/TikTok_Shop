export interface RouteMeta {
  path: string;
  title: string;
  icon?: string;
  showInMenu: boolean;
  parentKey?: string; // 所属父菜单 key，用于面包屑
}
