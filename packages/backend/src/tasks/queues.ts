/** BullMQ 队列名称常量 */
export const QUEUES = {
  MATERIAL_ANALYSIS: 'material-analysis',
  SCRIPT_GENERATION: 'script-generation',
  VIDEO_GENERATION: 'video-generation',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
