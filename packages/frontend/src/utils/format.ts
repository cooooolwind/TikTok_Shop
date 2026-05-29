/** 格式化文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** 格式化秒数为 mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface BeijingDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const BEIJING_TIME_ZONE = 'Asia/Shanghai';
const BEIJING_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

function getBeijingDateParts(value: string | Date): BeijingDateParts {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  }

  const parts = Object.fromEntries(
    BEIJING_DATE_TIME_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatBeijingDateTime(value: string | Date): string {
  const parts = getBeijingDateParts(value);
  if (parts.year === 0) return '-';
  return `${parts.year}/${parts.month}/${parts.day} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatScriptDisplayId(createdAt: string | Date): string {
  const parts = getBeijingDateParts(createdAt);
  if (parts.year === 0) return 'JB-';
  return `JB${parts.year}${pad2(parts.month)}${pad2(parts.day)}-${pad2(parts.hour)}${pad2(parts.minute)}`;
}

export function formatGenerationTaskDisplayId(task: { display_id?: string; script_display_id?: string; created_at: string | Date }): string {
  if (task.display_id) return task.display_id;
  const parts = getBeijingDateParts(task.created_at);
  if (parts.year === 0) return 'SP-';
  const taskTime = `SP${parts.year}${pad2(parts.month)}${pad2(parts.day)}-${pad2(parts.hour)}${pad2(parts.minute)}`;
  return task.script_display_id ? `${task.script_display_id}-SP${pad2(parts.hour)}${pad2(parts.minute)}` : taskTime;
}
